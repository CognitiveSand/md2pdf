import { createHash, randomUUID } from "node:crypto";
import { constants, createWriteStream } from "node:fs";
import { access, chmod, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { get as httpsGet } from "node:https";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";

import { unzipSync } from "fflate";

import {
  type ArtifactPolicy,
  type ArtifactRelease,
  type ReleaseCatalog,
} from "./artifactPolicy.js";
import { ArtifactFreshnessError } from "./errors.js";

export interface FallbackBrowserResult {
  browserPath: string;
  driverPath: string;
  release: ArtifactRelease;
  driverRelease?: ArtifactRelease;
}

export interface ArtifactDownloader {
  download(release: ArtifactRelease, destinationPath: string): Promise<void>;
}

export interface ArtifactExtractor {
  extract(archivePath: string, destinationDir: string): Promise<void>;
}

export interface FallbackBrowserProvisionerOptions {
  artifactName?: string;
  cacheDir?: string;
  now?: Date;
  platform?: string;
  downloader?: ArtifactDownloader;
  extractor?: ArtifactExtractor;
}

const defaultArtifactName = "chromium-for-testing";
const defaultDriverArtifactName = "chromedriver";
const archiveFileName = "artifact.zip";
const driverArchiveFileName = "driver-artifact.zip";
const metadataFileName = "cache-metadata.json";
const requiredQuarantineDays = 7;
const maxArchiveEntries = 20_000;
const maxArchiveUncompressedBytes = 1_500_000_000;

interface CacheMetadata {
  archiveSha256: string;
  archiveSize: number;
  browserPath: string;
  browserSha256: string;
  driverArchiveSha256?: string;
  driverArchiveSize?: number;
  driverReleaseVersion?: string;
  driverPath: string;
  driverSha256: string;
}

export async function provisionFallbackBrowser(
  policy: ArtifactPolicy,
  catalog: ReleaseCatalog,
  options: FallbackBrowserProvisionerOptions = {},
): Promise<FallbackBrowserResult> {
  const artifactName = options.artifactName ?? defaultArtifactName;
  const now = options.now ?? new Date();
  const platform = options.platform ?? currentArtifactPlatform();
  const cacheRoot = resolve(
    options.cacheDir ?? process.env.MD2PDF_ARTIFACT_CACHE ?? join(homedir(), ".cache", "md2pdf"),
  );
  const downloader = options.downloader ?? defaultDownloader;
  const extractor = options.extractor ?? defaultExtractor;
  const release = await selectRelease(policy, catalog, artifactName, platform, now);
  const driverRelease = await selectFallbackDriverRelease(
    policy,
    catalog,
    defaultDriverArtifactName,
    release,
    platform,
    now,
  );
  const artifactRoot = join(cacheRoot, artifactName);
  const releaseCacheDir = join(artifactRoot, safeSegment(release.version));

  await ensureCacheRoot(cacheRoot, artifactName);
  await purgeStaleCaches(artifactRoot, releaseCacheDir, artifactName);

  const cached = await usableCache(release, driverRelease, releaseCacheDir, artifactName);
  if (cached !== null) {
    return { ...cached, release, ...(driverRelease === null ? {} : { driverRelease }) };
  }

  await removeCacheEntry(releaseCacheDir, artifactName);
  return provisionIntoCache(
    release,
    driverRelease,
    releaseCacheDir,
    downloader,
    extractor,
    artifactName,
  );
}

async function selectRelease(
  policy: ArtifactPolicy,
  catalog: ReleaseCatalog,
  artifactName: string,
  platform: string,
  now: Date,
): Promise<ArtifactRelease> {
  try {
    return policy.selectNewestEligible(
      await catalog.listReleases(artifactName),
      { quarantineDays: requiredQuarantineDays, platform },
      now,
    );
  } catch (cause) {
    if (cause instanceof ArtifactFreshnessError) {
      if (cause.context.cause !== "no-eligible-release") {
        throw cause;
      }

      throw new ArtifactFreshnessError({
        message: "No eligible fallback browser artifact is available",
        artifactName,
        actionHint: "Declare a Chromium-for-Testing release that has completed quarantine.",
        cause,
      });
    }

    throw cause;
  }
}

async function selectFallbackDriverRelease(
  policy: ArtifactPolicy,
  catalog: ReleaseCatalog,
  driverArtifactName: string,
  browserRelease: ArtifactRelease,
  platform: string,
  now: Date,
): Promise<ArtifactRelease | null> {
  const releases = await catalog.listReleases(driverArtifactName);
  if (releases.length === 0) {
    return null;
  }

  const exactVersionReleases = releases.filter((release) =>
    (release.compatibleWith ?? release.version) === browserRelease.version,
  );

  try {
    return policy.selectNewestEligible(
      exactVersionReleases,
      {
        quarantineDays: requiredQuarantineDays,
        compatibleWith: browserRelease.version,
        platform,
      },
      now,
    );
  } catch (cause) {
    if (cause instanceof ArtifactFreshnessError && cause.context.cause === "no-eligible-release") {
      throw new ArtifactFreshnessError({
        message: "No eligible fallback WebDriver artifact is available",
        artifactName: driverArtifactName,
        actionHint: "Declare a matching chromedriver release that has completed quarantine.",
        cause,
      });
    }

    throw cause;
  }
}

async function provisionIntoCache(
  release: ArtifactRelease,
  driverRelease: ArtifactRelease | null,
  releaseCacheDir: string,
  downloader: ArtifactDownloader,
  extractor: ArtifactExtractor,
  artifactName: string,
): Promise<FallbackBrowserResult> {
  const tempDir = `${releaseCacheDir}.tmp-${randomUUID()}`;

  try {
    await mkdir(tempDir, { recursive: true });
    const archivePath = join(tempDir, archiveFileName);
    await downloader.download(release, archivePath);
    await assertChecksum(release, archivePath);
    await extractor.extract(archivePath, tempDir);

    if (driverRelease !== null) {
      const driverArchivePath = join(tempDir, driverArchiveFileName);
      await downloader.download(driverRelease, driverArchivePath);
      await assertChecksum(driverRelease, driverArchivePath);
      await extractor.extract(driverArchivePath, tempDir);
    }

    await makeExecutablePaths(release, tempDir, artifactName);
    await assertExecutablePaths(release, tempDir, artifactName);
    await writeCacheMetadata(release, driverRelease, tempDir, artifactName);
    await rename(tempDir, releaseCacheDir);

    return {
      ...(await assertUsableCache(release, driverRelease, releaseCacheDir, artifactName)),
      release,
      ...(driverRelease === null ? {} : { driverRelease }),
    };
  } catch (cause) {
    const cleanupError = await cleanupTempDir(tempDir);
    if (cause instanceof ArtifactFreshnessError) {
      throw cause;
    }

    if (isPermissionError(cause) || isPermissionError(cleanupError)) {
      throw cacheNotWritableError(artifactName, releaseCacheDir);
    }

    throw new ArtifactFreshnessError({
      message: "Fallback browser could not be provisioned",
      artifactName,
      actionHint: "Check cache permissions and the declared immutable artifact.",
      cause,
    });
  }
}

async function cleanupTempDir(tempDir: string): Promise<unknown> {
  try {
    await rm(tempDir, { recursive: true, force: true });
    return undefined;
  } catch (cause) {
    return cause;
  }
}

async function ensureCacheRoot(cacheRoot: string, artifactName: string): Promise<void> {
  try {
    await mkdir(cacheRoot, { recursive: true });
    await writeFile(join(cacheRoot, ".write-test"), "");
    await rm(join(cacheRoot, ".write-test"), { force: true });
  } catch (cause) {
    throw cacheNotWritableError(artifactName, cacheRoot);
  }
}

async function purgeStaleCaches(
  artifactRoot: string,
  selectedCacheDir: string,
  artifactName: string,
): Promise<void> {
  try {
    const rootStats = await stat(artifactRoot);
    if (!rootStats.isDirectory()) {
      await rm(artifactRoot, { force: true });
      return;
    }
  } catch {
    return;
  }

  try {
    for (const entry of await readdir(artifactRoot, { withFileTypes: true })) {
      const path = join(artifactRoot, entry.name);
      if (path !== selectedCacheDir) {
        await rm(path, { recursive: true, force: true });
      }
    }
  } catch (cause) {
    if (isPermissionError(cause)) {
      throw cacheNotWritableError(artifactName, artifactRoot);
    }

    throw cause;
  }
}

async function removeCacheEntry(releaseCacheDir: string, artifactName: string): Promise<void> {
  try {
    await rm(releaseCacheDir, { recursive: true, force: true });
  } catch (cause) {
    if (isPermissionError(cause)) {
      throw cacheNotWritableError(artifactName, releaseCacheDir);
    }

    throw cause;
  }
}

async function usableCache(
  release: ArtifactRelease,
  driverRelease: ArtifactRelease | null,
  releaseCacheDir: string,
  artifactName: string,
): Promise<Omit<FallbackBrowserResult, "release"> | null> {
  try {
    return await assertUsableCache(release, driverRelease, releaseCacheDir, artifactName);
  } catch {
    return null;
  }
}

async function assertUsableCache(
  release: ArtifactRelease,
  driverRelease: ArtifactRelease | null,
  releaseCacheDir: string,
  artifactName: string,
): Promise<Omit<FallbackBrowserResult, "release">> {
  await assertChecksum(release, join(releaseCacheDir, archiveFileName));
  if (driverRelease !== null) {
    await assertChecksum(driverRelease, join(releaseCacheDir, driverArchiveFileName));
  }
  const paths = await assertExecutablePaths(release, releaseCacheDir, artifactName);
  await assertCacheMetadata(release, driverRelease, releaseCacheDir, paths, artifactName);
  return paths;
}

async function assertChecksum(release: ArtifactRelease, archivePath: string): Promise<void> {
  const data = await readFile(archivePath);
  const sha256 = createHash("sha256").update(data).digest("hex");
  if (data.byteLength !== release.size || sha256 !== release.sha256) {
    throw new ArtifactFreshnessError({
      message: "Fallback browser artifact checksum did not match the release catalog",
      artifactName: release.version,
      actionHint: "Remove the corrupt cache entry and retry with the declared immutable artifact.",
      cause: "integrity-mismatch",
    });
  }
}

async function assertExecutablePaths(
  release: ArtifactRelease,
  cacheDir: string,
  artifactName: string,
): Promise<Omit<FallbackBrowserResult, "release">> {
  const { browserPath, driverPath } = executablePaths(release, cacheDir);

  if (!(await isExecutableFile(browserPath)) || !(await isExecutableFile(driverPath))) {
    throw missingExecutableError(artifactName);
  }

  return { browserPath, driverPath };
}

async function makeExecutablePaths(
  release: ArtifactRelease,
  cacheDir: string,
  artifactName: string,
): Promise<void> {
  const { browserPath, driverPath } = executablePaths(release, cacheDir);
  try {
    await chmod(browserPath, 0o755);
    await chmod(driverPath, 0o755);
  } catch (cause) {
    if (isPermissionError(cause)) {
      throw cacheNotWritableError(artifactName, cacheDir);
    }

    throw missingExecutableError(artifactName);
  }
}

function executablePaths(
  release: ArtifactRelease,
  cacheDir: string,
): Omit<FallbackBrowserResult, "release"> {
  return {
    browserPath: resolveInside(cacheDir, release.browserPath ?? "browser"),
    driverPath: resolveInside(cacheDir, release.driverPath ?? "driver"),
  };
}

async function writeCacheMetadata(
  release: ArtifactRelease,
  driverRelease: ArtifactRelease | null,
  cacheDir: string,
  artifactName: string,
): Promise<void> {
  const paths = await assertExecutablePaths(release, cacheDir, artifactName);
  const metadata: CacheMetadata = {
    archiveSha256: release.sha256,
    archiveSize: release.size,
    browserPath: release.browserPath ?? "browser",
    browserSha256: await sha256File(paths.browserPath),
    ...(driverRelease === null
      ? {}
      : {
        driverArchiveSha256: driverRelease.sha256,
        driverArchiveSize: driverRelease.size,
        driverReleaseVersion: driverRelease.version,
      }),
    driverPath: release.driverPath ?? "driver",
    driverSha256: await sha256File(paths.driverPath),
  };

  await writeFile(join(cacheDir, metadataFileName), `${JSON.stringify(metadata, null, 2)}\n`, {
    mode: 0o600,
  });
}

async function assertCacheMetadata(
  release: ArtifactRelease,
  driverRelease: ArtifactRelease | null,
  cacheDir: string,
  paths: Omit<FallbackBrowserResult, "release">,
  artifactName: string,
): Promise<void> {
  const metadata = parseCacheMetadata(
    await readFile(join(cacheDir, metadataFileName), "utf8"),
    artifactName,
  );

  if (
    metadata.archiveSha256 !== release.sha256 ||
    metadata.archiveSize !== release.size ||
    metadata.browserPath !== (release.browserPath ?? "browser") ||
    metadata.driverPath !== (release.driverPath ?? "driver") ||
    metadata.driverArchiveSha256 !== driverRelease?.sha256 ||
    metadata.driverArchiveSize !== driverRelease?.size ||
    metadata.driverReleaseVersion !== driverRelease?.version ||
    metadata.browserSha256 !== (await sha256File(paths.browserPath)) ||
    metadata.driverSha256 !== (await sha256File(paths.driverPath))
  ) {
    throw new ArtifactFreshnessError({
      message: "Fallback browser cache no longer matches the verified artifact extraction",
      artifactName,
      actionHint: "Remove the corrupt cache entry and reprovision the fallback browser.",
      cause: "integrity-mismatch",
    });
  }
}

function parseCacheMetadata(raw: string, artifactName: string): CacheMetadata {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isCacheMetadata(value)) {
      throw new Error("metadata shape mismatch");
    }

    return value;
  } catch (cause) {
    throw new ArtifactFreshnessError({
      message: "Fallback browser cache metadata is missing or invalid",
      artifactName,
      actionHint: "Remove the corrupt cache entry and reprovision the fallback browser.",
      cause,
    });
  }
}

function isCacheMetadata(value: unknown): value is CacheMetadata {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.archiveSha256 === "string" &&
    typeof candidate.archiveSize === "number" &&
    typeof candidate.browserPath === "string" &&
    typeof candidate.browserSha256 === "string" &&
    optionalString(candidate.driverArchiveSha256) &&
    optionalNumber(candidate.driverArchiveSize) &&
    optionalString(candidate.driverReleaseVersion) &&
    typeof candidate.driverPath === "string" &&
    typeof candidate.driverSha256 === "string"
  );
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function optionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === "number";
}

const defaultDownloader: ArtifactDownloader = {
  async download(release: ArtifactRelease, destinationPath: string): Promise<void> {
    await mkdir(dirname(destinationPath), { recursive: true });

    await new Promise<void>((resolveDownload, rejectDownload) => {
      const request = httpsGet(release.url, (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          rejectDownload(new Error(`download failed with HTTP ${response.statusCode ?? "unknown"}`));
          return;
        }

        const contentLength = response.headers["content-length"];
        if (contentLength !== undefined && Number(contentLength) !== release.size) {
          response.resume();
          rejectDownload(new Error("download size did not match the release catalog"));
          return;
        }

        let downloadedBytes = 0;
        const stream = createWriteStream(destinationPath, { mode: 0o600 });
        response.on("data", (chunk: Buffer) => {
          downloadedBytes += chunk.byteLength;
          if (downloadedBytes > release.size) {
            request.destroy(new Error("download exceeded the release catalog size"));
            stream.destroy();
            return;
          }

          stream.write(chunk);
        });
        response.once("end", () => {
          stream.end();
        });
        stream.once("finish", () => {
          stream.close((error) => {
            if (error === null || error === undefined) {
              resolveDownload();
            } else {
              rejectDownload(error);
            }
          });
        });
        stream.once("error", rejectDownload);
      });

      request.once("error", rejectDownload);
      request.setTimeout(30_000, () => {
        request.destroy(new Error("download timed out"));
      });
    });
  },
};

const defaultExtractor: ArtifactExtractor = {
  async extract(archivePath: string, destinationDir: string): Promise<void> {
    const archive = await readFile(archivePath);
    const fileEntries = inspectZipArchive(archive, destinationDir, archivePath);
    const entries = unzipSync(archive);

    for (const entry of fileEntries) {
      const data = entries[entry.name];
      if (data === undefined) {
        throw invalidArchiveError(archivePath, "Fallback browser artifact changed while extracting");
      }

      const outputPath = resolveInside(destinationDir, entry.name);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, data, { mode: 0o600 });
    }
  },
};

interface ZipFileEntry {
  name: string;
  uncompressedSize: number;
}

function inspectZipArchive(
  archive: Buffer,
  destinationDir: string,
  artifactName: string,
): ZipFileEntry[] {
  const eocdOffset = findEndOfCentralDirectory(archive);
  if (eocdOffset === -1) {
    throw invalidArchiveError(artifactName, "Fallback browser artifact is not a valid zip archive");
  }

  const diskNumber = archive.readUInt16LE(eocdOffset + 4);
  const centralDirectoryDisk = archive.readUInt16LE(eocdOffset + 6);
  const diskEntries = archive.readUInt16LE(eocdOffset + 8);
  const totalEntries = archive.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = archive.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = archive.readUInt32LE(eocdOffset + 16);
  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    diskEntries !== totalEntries ||
    totalEntries === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    throw invalidArchiveError(artifactName, "Fallback browser artifact uses an unsupported zip layout");
  }

  if (centralDirectoryOffset + centralDirectorySize > archive.byteLength) {
    throw invalidArchiveError(artifactName, "Fallback browser artifact central directory is truncated");
  }

  const entries: ZipFileEntry[] = [];
  let cursor = centralDirectoryOffset;
  let totalUncompressedBytes = 0;

  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > archive.byteLength || archive.readUInt32LE(cursor) !== 0x02014b50) {
      throw invalidArchiveError(artifactName, "Fallback browser artifact central directory is invalid");
    }

    const uncompressedSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const entryEnd = cursor + 46 + nameLength + extraLength + commentLength;
    if (uncompressedSize === 0xffffffff || entryEnd > archive.byteLength) {
      throw invalidArchiveError(artifactName, "Fallback browser artifact entry metadata is invalid");
    }

    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    if (!name.endsWith("/")) {
      resolveInside(destinationDir, name);
      totalUncompressedBytes += uncompressedSize;
      entries.push({ name, uncompressedSize });
      if (entries.length > maxArchiveEntries || totalUncompressedBytes > maxArchiveUncompressedBytes) {
        throw invalidArchiveError(artifactName, "Fallback browser artifact is larger than the supported extraction bounds");
      }
    }

    cursor = entryEnd;
  }

  if (cursor !== centralDirectoryOffset + centralDirectorySize) {
    throw invalidArchiveError(artifactName, "Fallback browser artifact central directory has trailing data");
  }

  return entries;
}

function findEndOfCentralDirectory(archive: Buffer): number {
  const eocdMinimumSize = 22;
  const maxCommentLength = 0xffff;
  const firstPossibleOffset = Math.max(0, archive.byteLength - eocdMinimumSize - maxCommentLength);

  for (let offset = archive.byteLength - eocdMinimumSize; offset >= firstPossibleOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  return -1;
}

function invalidArchiveError(artifactName: string, message: string): ArtifactFreshnessError {
  return new ArtifactFreshnessError({
    message,
    artifactName,
    actionHint: "Declare a smaller, bounded Chromium-for-Testing archive.",
    cause: "invalid-artifact-archive",
  });
}

async function isExecutableFile(path: string): Promise<boolean> {
  try {
    if (!(await stat(path)).isFile()) {
      return false;
    }

    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function safeSegment(value: string): string {
  return basename(value).replace(/[^a-z0-9._-]/giu, "_");
}

function resolveInside(root: string, childPath: string): string {
  const resolved = resolve(root, childPath);
  const childRelative = relative(root, resolved);
  if (childRelative === "" || childRelative.startsWith("..")) {
    throw new ArtifactFreshnessError({
      message: "Fallback browser artifact path escapes the cache directory",
      artifactName: childPath,
      actionHint: "Use relative browserPath and driverPath entries inside the artifact cache.",
      cause: "invalid-artifact-path",
    });
  }

  return resolved;
}

function missingExecutableError(artifactName: string): ArtifactFreshnessError {
  return new ArtifactFreshnessError({
    message: "Fallback browser artifact did not contain the expected browser and driver",
    artifactName,
    actionHint: "Declare browserPath and driverPath for this artifact release.",
    cause: "missing-executable",
  });
}

function cacheNotWritableError(artifactName: string, cachePath: string): ArtifactFreshnessError {
  return new ArtifactFreshnessError({
    message: "Fallback browser cache is not writable",
    artifactName,
    actionHint: `Make the md2pdf artifact cache writable: ${cachePath}`,
    cause: "cache-not-writable",
  });
}

function isPermissionError(cause: unknown): boolean {
  if (typeof cause !== "object" || cause === null) {
    return false;
  }

  const code = (cause as { code?: unknown }).code;
  return code === "EACCES" || code === "EPERM" || code === "EROFS";
}

function currentArtifactPlatform(): string {
  return `${process.platform}-${process.arch}`;
}
