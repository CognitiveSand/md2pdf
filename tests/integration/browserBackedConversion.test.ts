import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ArtifactPolicy } from "../../src/artifactPolicy.js";
import type { LocatedBrowser } from "../../src/browserLocator.js";
import { DocumentConverter } from "../../src/converter.js";
import { provisionFallbackBrowser } from "../../src/fallbackBrowserProvisioner.js";
import { JsonReleaseCatalog } from "../../src/releaseCatalog.js";

const skipRealBrowserTests = process.env.MD2PDF_SKIP_REAL_BROWSER_TESTS === "1";
const realBrowserIt = skipRealBrowserTests ? it.skip : it;

describe("P3 browser-backed conversion", () => {
  const tempRoots: string[] = [];
  let previousArtifactCache: string | undefined;
  let preProvisionedBrowser: LocatedBrowser | undefined;

  beforeAll(async () => {
    previousArtifactCache = process.env.MD2PDF_ARTIFACT_CACHE;
    process.env.MD2PDF_ARTIFACT_CACHE ??= join(
      process.cwd(),
      ".tmp",
      "md2pdf-real-browser-cache",
    );

    if (!skipRealBrowserTests) {
      const fallback = await provisionFallbackBrowser(
        new ArtifactPolicy(),
        new JsonReleaseCatalog(),
      );
      preProvisionedBrowser = {
        browserPath: fallback.browserPath,
        displayName: "Chromium",
        driverArtifactName: "chromedriver",
        driverPath: fallback.driverPath,
        kind: "chromium",
        version: fallback.release.version,
      };
    }
  });

  afterEach(async () => {
    await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
    tempRoots.length = 0;
  });

  afterAll(() => {
    if (previousArtifactCache === undefined) {
      delete process.env.MD2PDF_ARTIFACT_CACHE;
      return;
    }

    process.env.MD2PDF_ARTIFACT_CACHE = previousArtifactCache;
  });

  realBrowserIt(
    "@req FR-01 @req FR-07 @req FR-24 @req NFR-02 renders Mermaid to a real PDF with a pre-provisioned browser",
    async () => {
      const tempRoot = await mkdtemp(join(tmpdir(), "md2pdf-real-browser-"));
      tempRoots.push(tempRoot);
      const sourcePath = join(tempRoot, "diagram.md");
      const outputPath = join(tempRoot, "diagram.pdf");

      await writeFile(
        sourcePath,
        [
          "# Real browser proof",
          "",
          "Before.",
          "",
          "| Left | Right |",
          "| --- | --- |",
          "| A | B |",
          "",
          "- [x] done",
          "",
          "```ts",
          "const answer: number = 42;",
          "```",
          "",
          "```mermaid",
          "flowchart TD",
          "  A[Start] --> B[Finish]",
          "```",
          "",
          "Footnote call.[^one]",
          "",
          "[^one]: Footnote body.",
          "",
          "After.",
        ].join("\n"),
        "utf8",
      );

      const locateCalls: string[] = [];
      const converter = preProvisionedConverter(tempRoot, locateCalls);

      await converter.convertFile(sourcePath, outputPath, {
        renderTimeoutMs: Number(process.env.MD2PDF_BROWSER_TEST_TIMEOUT_MS ?? 30_000),
      });

      const pdf = await readFile(outputPath);
      expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      expect(pdf.byteLength).toBeGreaterThan(1_000);

      const pdfText = pdf.toString("latin1");
      expect(pdfText).not.toContain("flowchart TD");
      expect(pdfText).not.toContain("A[Start] --> B[Finish]");
      expect(pdfText).toContain("Skia/PDF");
      expect(pdfText).toContain("/StructTreeRoot");
      expect(locateCalls).toEqual(["pre-provisioned"]);
    },
    60_000,
  );

  realBrowserIt(
    "@req FR-04 @req FR-05 @req FR-06 renders rich Markdown and a relative image to a real PDF",
    async () => {
      const tempRoot = await mkdtemp(join(tmpdir(), "md2pdf-real-browser-"));
      tempRoots.push(tempRoot);
      const sourcePath = join(tempRoot, "rich.md");
      const outputPath = join(tempRoot, "rich.pdf");
      const imagePath = join(tempRoot, "pixel.png");

      await writeFile(imagePath, tinyPng());
      await writeFile(
        sourcePath,
        [
          "# Rich Markdown proof",
          "",
          "| Left | Right |",
          "| --- | --- |",
          "| A | B |",
          "",
          "- [x] done",
          "",
          "```ts",
          "const answer: number = 42;",
          "```",
          "",
          "![pixel](./pixel.png)",
          "",
          "Footnote call.[^one]",
          "",
          "[^one]: Footnote body.",
        ].join("\n"),
        "utf8",
      );

      const locateCalls: string[] = [];
      const converter = preProvisionedConverter(tempRoot, locateCalls);

      await converter.convertFile(sourcePath, outputPath, {
        renderTimeoutMs: Number(process.env.MD2PDF_BROWSER_TEST_TIMEOUT_MS ?? 30_000),
      });

      const pdf = await readFile(outputPath);
      const pdfText = pdf.toString("latin1");
      expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      expect(pdf.byteLength).toBeGreaterThan(1_000);
      expect(pdfText).toContain("Skia/PDF");
      expect(pdfText).toContain("/StructTreeRoot");
      expect(pdfText).toContain("/S /Table");
      expect(pdfText).toContain("/Alt (pixel)");
      expect(pdfContainsVisualObject(pdfText)).toBe(true);
      expect(locateCalls).toEqual(["pre-provisioned"]);
    },
    60_000,
  );

  function preProvisionedConverter(tempDir: string, locateCalls: string[]): DocumentConverter {
    const browser = preProvisionedBrowser;
    if (browser === undefined) {
      throw new Error("Real browser tests require a pre-provisioned browser");
    }

    return new DocumentConverter({
      browserLocatorFactory: () => ({
        async locate() {
          locateCalls.push("pre-provisioned");
          return browser;
        },
      }),
      tempDir,
    });
  }
});

function pdfContainsVisualObject(pdfText: string): boolean {
  return /\/XObject\b/u.test(pdfText) ||
    /\/Subtype\s*\/Image\b/u.test(pdfText) ||
    /\/Subtype\s*\/Form\b/u.test(pdfText);
}

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  );
}
