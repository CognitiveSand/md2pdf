import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { zipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";

import { ArtifactPolicy, type ArtifactRelease } from "../../../src/artifactPolicy.js";
import { ArtifactFreshnessError } from "../../../src/errors.js";
import {
  provisionFallbackBrowser,
  type ArtifactDownloader,
  type ArtifactExtractor,
} from "../../../src/fallbackBrowserProvisioner.js";
import { InMemoryReleaseCatalog } from "../../../src/releaseCatalog.js";

const now = new Date("2026-06-08T12:00:00.000Z");
const payload = Buffer.from("chromium archive");
const payloadSha = sha256(payload);
const testPlatform = `${process.platform}-${process.arch}`;
const tempRoots: string[] = [];
const itOnPosix = process.platform === "win32" ? it.skip : it;

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("fallback browser provisioning", () => {
  it("@req NFR-05 provisions the newest eligible artifact and reuses a verified cache", async () => {
    const cacheDir = await tempRoot();
    const downloader = new RecordingDownloader(payload);
    const extractor = new FixtureExtractor();

    const first = await provisionFallbackBrowser(policy(), catalog([release("120.0.0")]), {
      cacheDir,
      downloader,
      extractor,
      now,
    });
    const second = await provisionFallbackBrowser(policy(), catalog([release("120.0.0")]), {
      cacheDir,
      downloader,
      extractor,
      now,
    });

    expect(first).toMatchObject({
      browserPath: expect.stringContaining("browser"),
      driverPath: expect.stringContaining("driver"),
      release: { version: "120.0.0" },
    });
    expect(second.browserPath).toBe(first.browserPath);
    expect(downloader.downloads).toHaveLength(1);
  });

  it("@req NFR-05 removes the temp cache and reports integrity-mismatch for invalid checksums", async () => {
    const cacheDir = await tempRoot();

    await expect(
      provisionFallbackBrowser(policy(), catalog([release("120.0.0", { sha256: "1".repeat(64) })]), {
        cacheDir,
        downloader: new RecordingDownloader(payload),
        extractor: new FixtureExtractor(),
        now,
      }),
    ).rejects.toMatchObject({
      kind: "artifact",
      context: { cause: "integrity-mismatch" },
    });

    expect(await tempEntries(cacheDir)).toEqual([]);
  });

  it("@req NFR-05 cleans up after an interrupted download", async () => {
    const cacheDir = await tempRoot();

    await expect(
      provisionFallbackBrowser(policy(), catalog([release("120.0.0")]), {
        cacheDir,
        downloader: {
          async download(_release: ArtifactRelease, destinationPath: string): Promise<void> {
            await writeFile(destinationPath, "partial");
            throw new Error("network interrupted");
          },
        },
        extractor: new FixtureExtractor(),
        now,
      }),
    ).rejects.toThrow(ArtifactFreshnessError);

    expect(await tempEntries(cacheDir)).toEqual([]);
  });

  it("@req NFR-05 re-provisions a partial cache entry", async () => {
    const cacheDir = await tempRoot();
    const partialCache = join(cacheDir, "chromium-for-testing", "120.0.0");
    await mkdir(partialCache, { recursive: true });
    await writeFile(join(partialCache, "artifact.zip"), payload);
    const downloader = new RecordingDownloader(payload);

    const result = await provisionFallbackBrowser(policy(), catalog([release("120.0.0")]), {
      cacheDir,
      downloader,
      extractor: new FixtureExtractor(),
      now,
    });

    expect(result.release.version).toBe("120.0.0");
    expect(downloader.downloads).toHaveLength(1);
    await expect(stat(result.browserPath)).resolves.toMatchObject({ size: 7 });
  });

  it("@req NFR-05 re-provisions when the artifact cache root is a partial file", async () => {
    const cacheDir = await tempRoot();
    await writeFile(join(cacheDir, "chromium-for-testing"), "partial root");
    const downloader = new RecordingDownloader(payload);

    const result = await provisionFallbackBrowser(policy(), catalog([release("120.0.0")]), {
      cacheDir,
      downloader,
      extractor: new FixtureExtractor(),
      now,
    });

    expect(result.release.version).toBe("120.0.0");
    expect(downloader.downloads).toHaveLength(1);
    await expect(readFile(result.browserPath, "utf8")).resolves.toBe("browser");
  });

  it("@req NFR-05 provisions a real zip archive with the default extractor", async () => {
    const cacheDir = await tempRoot();
    const archive = zipArchive({
      "bin/browser": "browser",
      "bin/driver": "driver",
      "README.txt": "not executable",
    });

    const result = await provisionFallbackBrowser(
      policy(),
      catalog([
        release("121.0.0", {
          browserPath: "bin/browser",
          driverPath: "bin/driver",
          sha256: sha256(archive),
          size: archive.byteLength,
        }),
      ]),
      {
        cacheDir,
        downloader: new RecordingDownloader(archive),
        now,
      },
    );

    await expect(readFile(result.browserPath, "utf8")).resolves.toBe("browser");
    await expect(readFile(result.driverPath, "utf8")).resolves.toBe("driver");

    if (process.platform !== "win32") {
      const readme = await stat(join(cacheDir, "chromium-for-testing", "121.0.0", "README.txt"));
      expect(readme.mode & 0o111).toBe(0);
    }
  });

  it("@req NFR-05 provisions Chrome and ChromeDriver from separate eligible archives", async () => {
    const cacheDir = await tempRoot();
    const browserArchive = zipArchive({
      "chrome-win64/chrome.exe": "browser",
    });
    const driverArchive = zipArchive({
      "chromedriver-win64/chromedriver.exe": "driver",
    });
    const browserRelease = release("151.0.7875.0", {
      browserPath: "chrome-win64/chrome.exe",
      driverPath: "chromedriver-win64/chromedriver.exe",
      sha256: sha256(browserArchive),
      size: browserArchive.byteLength,
      url: "https://downloads.example.invalid/chrome-win64.zip",
    });
    const driverRelease = release("151.0.7875.0", {
      sha256: sha256(driverArchive),
      size: driverArchive.byteLength,
      url: "https://downloads.example.invalid/chromedriver-win64.zip",
    });
    const downloader = new MappedDownloader({
      [browserRelease.url]: browserArchive,
      [driverRelease.url]: driverArchive,
    });

    const result = await provisionFallbackBrowser(
      policy(),
      catalog([browserRelease], [driverRelease]),
      {
        cacheDir,
        downloader,
        now,
      },
    );

    await expect(readFile(result.browserPath, "utf8")).resolves.toBe("browser");
    await expect(readFile(result.driverPath, "utf8")).resolves.toBe("driver");
    expect(result.release.version).toBe("151.0.7875.0");
    expect(result.driverRelease?.version).toBe("151.0.7875.0");
    expect(downloader.downloads).toEqual([
      browserRelease.url,
      driverRelease.url,
    ]);
  });

  it("@req NFR-05 selects the newest eligible fallback artifact for the host platform", async () => {
    const cacheDir = await tempRoot();

    const result = await provisionFallbackBrowser(
      policy(),
      catalog([
        release("122.0.0", {
          platform: "linux-x64",
          publishedAt: "2026-05-22T12:00:00.000Z",
        }),
        release("121.0.0", {
          platform: "darwin-arm64",
          publishedAt: "2026-05-20T12:00:00.000Z",
        }),
      ]),
      {
        cacheDir,
        downloader: new RecordingDownloader(payload),
        extractor: new FixtureExtractor(),
        now,
        platform: "darwin-arm64",
      },
    );

    expect(result.release.version).toBe("121.0.0");
    expect(result.release.platform).toBe("darwin-arm64");
  });

  it("@req NFR-05 rejects zip entries that escape the cache directory", async () => {
    const cacheDir = await tempRoot();
    const archive = zipArchive({
      "../outside": "escape",
      browser: "browser",
      driver: "driver",
    });

    await expect(
      provisionFallbackBrowser(
        policy(),
        catalog([
          release("121.0.0", {
            sha256: sha256(archive),
            size: archive.byteLength,
          }),
        ]),
        {
          cacheDir,
          downloader: new RecordingDownloader(archive),
          now,
        },
      ),
    ).rejects.toMatchObject({
      kind: "artifact",
      context: { cause: "invalid-artifact-path" },
    });

    expect(await tempEntries(cacheDir)).toEqual([]);
    await expect(stat(join(cacheDir, "chromium-for-testing", "outside"))).rejects.toThrow();
  });

  it("@req NFR-05 rejects oversized zip metadata before extraction", async () => {
    const cacheDir = await tempRoot();
    const archive = zipArchiveWithDeclaredUncompressedSize({
      browser: "browser",
      driver: "driver",
    }, "browser", 2_000_000_000);

    await expect(
      provisionFallbackBrowser(
        policy(),
        catalog([
          release("121.0.0", {
            sha256: sha256(archive),
            size: archive.byteLength,
          }),
        ]),
        {
          cacheDir,
          downloader: new RecordingDownloader(archive),
          now,
        },
      ),
    ).rejects.toMatchObject({
      kind: "artifact",
      context: { cause: "invalid-artifact-archive" },
    });

    expect(await tempEntries(cacheDir)).toEqual([]);
  });

  it("@req NFR-05 re-provisions a tampered executable cache entry", async () => {
    const cacheDir = await tempRoot();
    const downloader = new RecordingDownloader(payload);
    const extractor = new FixtureExtractor();

    const first = await provisionFallbackBrowser(policy(), catalog([release("120.0.0")]), {
      cacheDir,
      downloader,
      extractor,
      now,
    });
    await writeFile(first.browserPath, "tampered");

    const second = await provisionFallbackBrowser(policy(), catalog([release("120.0.0")]), {
      cacheDir,
      downloader,
      extractor,
      now,
    });

    expect(second.browserPath).toBe(first.browserPath);
    expect(downloader.downloads).toHaveLength(2);
    await expect(readFile(second.browserPath, "utf8")).resolves.toBe("browser");
  });

  itOnPosix("@req NFR-05 re-provisions a non-executable cached browser", async () => {
    const cacheDir = await tempRoot();
    const downloader = new RecordingDownloader(payload);
    const extractor = new FixtureExtractor();

    const first = await provisionFallbackBrowser(policy(), catalog([release("120.0.0")]), {
      cacheDir,
      downloader,
      extractor,
      now,
    });
    await chmod(first.browserPath, 0o644);

    const second = await provisionFallbackBrowser(policy(), catalog([release("120.0.0")]), {
      cacheDir,
      downloader,
      extractor,
      now,
    });

    expect(second.browserPath).toBe(first.browserPath);
    expect(downloader.downloads).toHaveLength(2);
  });

  it("@req NFR-05 purges a cache version that is no longer the newest eligible artifact", async () => {
    const cacheDir = await tempRoot();
    const oldCache = join(cacheDir, "chromium-for-testing", "119.0.0");
    await mkdir(oldCache, { recursive: true });
    await writeFile(join(oldCache, "artifact.zip"), payload);
    await writeFile(join(oldCache, "browser"), "browser");
    await writeFile(join(oldCache, "driver"), "driver");

    const result = await provisionFallbackBrowser(
      policy(),
      catalog([
        release("119.0.0", { publishedAt: "2026-05-01T12:00:00.000Z" }),
        release("120.0.0", { publishedAt: "2026-05-20T12:00:00.000Z" }),
      ]),
      {
        cacheDir,
        downloader: new RecordingDownloader(payload),
        extractor: new FixtureExtractor(),
        now,
      },
    );

    expect(result.release.version).toBe("120.0.0");
    await expect(stat(oldCache)).rejects.toThrow();
  });

  it("@req NFR-05 reports cache-not-writable when the cache root cannot be created", async () => {
    const cacheFile = join(await tempRoot(), "cache-file");
    await writeFile(cacheFile, "");

    await expect(
      provisionFallbackBrowser(policy(), catalog([release("120.0.0")]), {
        cacheDir: cacheFile,
        downloader: new RecordingDownloader(payload),
        extractor: new FixtureExtractor(),
        now,
      }),
    ).rejects.toMatchObject({
      kind: "artifact",
      context: { cause: "cache-not-writable" },
    });
  });

  it("@req NFR-05 reports cache-not-writable for artifact subtree write failures", async () => {
    const cacheDir = await tempRoot();
    const permissionError = Object.assign(new Error("read-only cache subtree"), {
      code: "EACCES",
    });

    await expect(
      provisionFallbackBrowser(policy(), catalog([release("120.0.0")]), {
        cacheDir,
        downloader: {
          async download(): Promise<void> {
            throw permissionError;
          },
        },
        extractor: new FixtureExtractor(),
        now,
      }),
    ).rejects.toMatchObject({
      kind: "artifact",
      context: { cause: "cache-not-writable" },
    });
  });
});

function policy(): ArtifactPolicy {
  return new ArtifactPolicy();
}

function catalog(
  releases: ArtifactRelease[],
  driverReleases: ArtifactRelease[] = [],
): InMemoryReleaseCatalog {
  return new InMemoryReleaseCatalog({
    "chromium-for-testing": releases,
    "chromedriver-for-testing": driverReleases,
  });
}

function release(version: string, overrides: Partial<ArtifactRelease> = {}): ArtifactRelease {
  return {
    version,
    publishedAt: "2026-05-20T12:00:00.000Z",
    url: `https://downloads.example.invalid/chromium-${version}.zip`,
    sha256: payloadSha,
    size: payload.byteLength,
    provenance: "test chromium-for-testing catalog",
    platform: testPlatform,
    browserPath: "browser",
    driverPath: "driver",
    ...overrides,
  };
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function zipArchive(entries: Record<string, string>): Buffer {
  return Buffer.from(
    zipSync(
      Object.fromEntries(
        Object.entries(entries).map(([entryName, contents]) => [
          entryName,
          Buffer.from(contents),
        ]),
      ),
    ),
  );
}

function zipArchiveWithDeclaredUncompressedSize(
  entries: Record<string, string>,
  entryName: string,
  uncompressedSize: number,
): Buffer {
  const archive = zipArchive(entries);
  const entryOffset = centralDirectoryEntryOffset(archive, entryName);
  archive.writeUInt32LE(uncompressedSize, entryOffset + 24);
  return archive;
}

function centralDirectoryEntryOffset(archive: Buffer, entryName: string): number {
  for (let offset = 0; offset <= archive.byteLength - 46; offset += 1) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) {
      continue;
    }

    const nameLength = archive.readUInt16LE(offset + 28);
    const name = archive.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (name === entryName) {
      return offset;
    }
  }

  throw new Error(`Missing central directory entry for ${entryName}`);
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "md2pdf-fallback-"));
  tempRoots.push(root);
  return root;
}

async function tempEntries(root: string): Promise<string[]> {
  try {
    return (await readdir(root, { recursive: true })).filter((entry) =>
      String(entry).includes(".tmp-"),
    );
  } catch {
    return [];
  }
}

class RecordingDownloader implements ArtifactDownloader {
  readonly downloads: string[] = [];

  constructor(private readonly data: Buffer) {}

  async download(release: ArtifactRelease, destinationPath: string): Promise<void> {
    this.downloads.push(release.url);
    await writeFile(destinationPath, this.data);
  }
}

class MappedDownloader implements ArtifactDownloader {
  readonly downloads: string[] = [];

  constructor(private readonly data: Record<string, Buffer>) {}

  async download(release: ArtifactRelease, destinationPath: string): Promise<void> {
    const payload = this.data[release.url];
    if (payload === undefined) {
      throw new Error(`Unexpected download URL: ${release.url}`);
    }

    this.downloads.push(release.url);
    await writeFile(destinationPath, payload);
  }
}

class FixtureExtractor implements ArtifactExtractor {
  async extract(_archivePath: string, destinationDir: string): Promise<void> {
    const browserPath = join(destinationDir, "browser");
    const driverPath = join(destinationDir, "driver");

    await writeFile(browserPath, "browser");
    await writeFile(driverPath, "driver");
    await chmod(browserPath, 0o755);
    await chmod(driverPath, 0o755);
  }
}
