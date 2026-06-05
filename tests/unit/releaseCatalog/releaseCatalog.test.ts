import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { ArtifactRelease } from "../../../src/artifactPolicy.js";
import { ArtifactFreshnessError } from "../../../src/errors.js";
import { InMemoryReleaseCatalog, JsonReleaseCatalog } from "../../../src/releaseCatalog.js";

describe("JsonReleaseCatalog", () => {
  it("@req NFR-05 reads release timestamps from artifacts.json", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "md2pdf-release-catalog-"));

    try {
      const manifestPath = join(tempDir, "artifacts.json");
      writeManifest(manifestPath, {
        artifacts: [
          {
            name: "chromedriver",
            kind: "webdriver",
            platform: "mac-arm64",
            provenance: "Chrome for Testing known-good-versions-with-downloads",
            releases: [
              release("119.0.1", "2026-05-20T12:00:00.000Z"),
              { ...release("119.0.2", "2026-05-28T12:00:00.000Z"), platform: "linux-x64" },
            ],
          },
          {
            name: "highlight.js GitHub Light theme stylesheet",
            source: "highlight.js",
            version: "11.11.1",
            publishedAt: "2025-04-01T00:00:00.000Z",
            url: "https://registry.npmjs.org/highlight.js/-/highlight.js-11.11.1.tgz",
            sha256: "2".repeat(64),
            size: 1419,
            provenance: "locked npm package highlight.js@11.11.1",
          },
        ],
      });

      const catalog = new JsonReleaseCatalog({ manifestPath });

      await expect(catalog.listReleases("chromedriver")).resolves.toEqual([
        {
          ...release("119.0.1", "2026-05-20T12:00:00.000Z"),
          kind: "webdriver",
          platform: "mac-arm64",
        },
        {
          ...release("119.0.2", "2026-05-28T12:00:00.000Z"),
          kind: "webdriver",
          platform: "linux-x64",
        },
      ]);
      await expect(catalog.listReleases("highlight.js")).resolves.toMatchObject([
        { version: "11.11.1", publishedAt: "2025-04-01T00:00:00.000Z" },
      ]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("@req NFR-05 returns an empty release list for unknown artifacts", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "md2pdf-release-catalog-"));

    try {
      const manifestPath = join(tempDir, "artifacts.json");
      writeManifest(manifestPath, { artifacts: [] });

      const catalog = new JsonReleaseCatalog({ manifestPath });

      await expect(catalog.listReleases("missing")).resolves.toEqual([]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("@req NFR-05 fails loud when a declared release lacks a valid publishedAt", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "md2pdf-release-catalog-"));

    try {
      const manifestPath = join(tempDir, "artifacts.json");
      writeManifest(manifestPath, {
        artifacts: [
          {
            name: "chromedriver",
            provenance: "test catalog",
            releases: [release("119.0.1", "not-a-date")],
          },
        ],
      });

      const catalog = new JsonReleaseCatalog({ manifestPath });

      await expect(catalog.listReleases("chromedriver")).rejects.toThrow(ArtifactFreshnessError);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("InMemoryReleaseCatalog", () => {
  it("@req NFR-05 provides a configurable fake release catalog for tests", async () => {
    const catalog = new InMemoryReleaseCatalog({
      geckodriver: [release("0.34.0", "2026-05-20T12:00:00.000Z")],
    });

    const firstRead = await catalog.listReleases("geckodriver");
    firstRead[0]!.version = "mutated";
    catalog.setReleases("chromium-for-testing", [release("120.0.0", "2026-05-21T12:00:00.000Z")]);

    await expect(catalog.listReleases("geckodriver")).resolves.toMatchObject([
      { version: "0.34.0" },
    ]);
    await expect(catalog.listReleases("chromium-for-testing")).resolves.toMatchObject([
      { version: "120.0.0" },
    ]);
  });
});

function writeManifest(path: string, manifest: unknown): void {
  writeFileSync(path, JSON.stringify(manifest), "utf8");
}

function release(version: string, publishedAt: string): ArtifactRelease {
  return {
    version,
    publishedAt,
    url: `https://downloads.example.invalid/${version}.zip`,
    sha256: "1".repeat(64),
    size: 42,
    provenance: "test catalog",
  };
}
