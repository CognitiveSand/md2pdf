/**
 * Downloads and caches chromedriver / geckodriver binaries.
 *
 * Version selection applies the 7-day quarantine from releaseCatalog.ts:
 *   - geckodriver  — dates come from the GitHub Releases API directly.
 *   - chromedriver — dates come from the npm registry (the `chromedriver`
 *     package mirrors official releases within 1-2 days, well within the
 *     quarantine margin).
 */

import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { arch, platform } from 'node:os';
import { basename, join } from 'node:path';
import { gunzipSync, unzipSync } from 'fflate';
import type { DriverKind } from './browserLocator.js';
import { ArtifactFreshnessError, DriverNotFoundError } from './errors.js';
import { type Release, selectNewestEligible } from './releaseCatalog.js';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface DriverRelease extends Release {
  downloadUrl: string;
}

export type DriverReleaseFetcher = (
  kind: DriverKind,
  browserMajorVersion: number,
) => Promise<DriverRelease[]>;

// --------------------------------------------------------------------------
// Platform helpers
// --------------------------------------------------------------------------

function chromePlatformId(): string {
  const os = platform();
  const cpu = arch();
  if (os === 'darwin') return cpu === 'arm64' ? 'mac-arm64' : 'mac-x64';
  if (os === 'win32') return 'win64';
  return 'linux64'; // linux arm64 is not offered by Chrome for Testing
}

function geckoPlatformId(): string {
  const os = platform();
  const cpu = arch();
  if (os === 'darwin') return cpu === 'arm64' ? 'macos-aarch64' : 'macos';
  if (os === 'win32') return cpu === 'x64' ? 'win64' : 'win32';
  return cpu === 'arm64' ? 'linux-aarch64' : 'linux64';
}

function binaryName(kind: DriverKind): string {
  return platform() === 'win32'
    ? `${kind}.exe`
    : kind === 'chromedriver' ? 'chromedriver' : 'geckodriver';
}

// --------------------------------------------------------------------------
// HTTP helpers — uses Node 20 built-in fetch
// --------------------------------------------------------------------------

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'md2pdf-driver-provisioner' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json();
}

async function fetchBinary(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'md2pdf-driver-provisioner' },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// --------------------------------------------------------------------------
// Archive extraction
// --------------------------------------------------------------------------

function extractFromZip(data: Buffer, binary: string): Buffer {
  const files = unzipSync(new Uint8Array(data));
  // The binary may be nested in a subdirectory (e.g. chromedriver-linux64/chromedriver)
  const entry = Object.entries(files).find(([name]) => basename(name) === binary);
  if (!entry) throw new Error(`"${binary}" not found in ZIP archive`);
  return Buffer.from(entry[1]);
}

function extractFromTarGz(data: Buffer, binary: string): Buffer {
  const tar = gunzipSync(new Uint8Array(data));
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const rawName = tar.subarray(offset, offset + 100);
    const name = String.fromCharCode(...rawName).replace(/\0/g, '');
    if (!name) break;
    const rawSize = tar.subarray(offset + 124, offset + 136);
    const size = parseInt(String.fromCharCode(...rawSize).trim().replace(/\0/g, ''), 8);
    const typeFlag = tar[offset + 156];
    offset += 512;
    const isFile = typeFlag === 0 || typeFlag === 48;
    if (isFile && basename(name) === binary && size > 0) {
      return Buffer.from(tar.subarray(offset, offset + size));
    }
    offset += Math.ceil(size / 512) * 512;
  }
  throw new Error(`"${binary}" not found in tar archive`);
}

// --------------------------------------------------------------------------
// Release catalog fetchers
// --------------------------------------------------------------------------

interface NpmTimeResponse {
  time: Record<string, string>;
}

interface GithubRelease {
  tag_name: string;
  published_at: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

export async function fetchChromedriverReleases(
  browserMajorVersion: number,
): Promise<DriverRelease[]> {
  const platformId = chromePlatformId();
  const npmData = await fetchJson(
    'https://registry.npmjs.org/chromedriver',
  ) as NpmTimeResponse;

  const releases: DriverRelease[] = [];
  for (const [version, dateStr] of Object.entries(npmData.time ?? {})) {
    if (version === 'created' || version === 'modified') continue;
    const major = parseInt(version.split('.')[0] ?? '0', 10);
    if (major !== browserMajorVersion) continue;

    releases.push({
      version,
      publishedAt: new Date(dateStr),
      downloadUrl: `https://storage.googleapis.com/chrome-for-testing-public/${version}/${platformId}/chromedriver-${platformId}.zip`,
    });
  }

  return releases;
}

export async function fetchGeckodriverReleases(): Promise<DriverRelease[]> {
  const platformId = geckoPlatformId();
  const isWindows = platform() === 'win32';
  const ext = isWindows || platformId.startsWith('linux') && !platformId.includes('linux')
    ? '.zip'
    : platformId.startsWith('win') ? '.zip' : '.tar.gz';
  const actualExt = platformId.startsWith('win') || platform() === 'win32' ? '.zip' : '.tar.gz';

  const ghReleases = await fetchJson(
    'https://api.github.com/repos/mozilla/geckodriver/releases?per_page=30',
  ) as GithubRelease[];

  const releases: DriverRelease[] = [];
  for (const rel of ghReleases) {
    const version = rel.tag_name.replace(/^v/, '');
    const assetName = `geckodriver-v${version}-${platformId}${actualExt}`;
    const asset = rel.assets.find(a => a.name === assetName);
    if (!asset) continue;
    releases.push({
      version,
      publishedAt: new Date(rel.published_at),
      downloadUrl: asset.browser_download_url,
    });
  }
  return releases;
}

// --------------------------------------------------------------------------
// Main provision entry point
// --------------------------------------------------------------------------

/**
 * Downloads the newest eligible (post-quarantine) driver for `kind` into
 * `destDir`, and returns the path to the extracted binary.
 *
 * Pass a custom `fetcher` in tests to avoid real network calls.
 */
export async function provisionDriver(
  kind: DriverKind,
  browserVersion: string,
  destDir: string,
  fetcher: DriverReleaseFetcher = defaultFetcher,
): Promise<string> {
  const browserMajor = parseInt(browserVersion.split('.')[0] ?? '0', 10);

  let releases: DriverRelease[];
  try {
    releases = await fetcher(kind, browserMajor);
  } catch (err) {
    throw new DriverNotFoundError(
      `${kind} (network error fetching release catalog: ${(err as Error).message})`,
    );
  }

  let best: Release & { downloadUrl: string };
  try {
    best = selectNewestEligible(releases) as DriverRelease;
  } catch (err) {
    if (err instanceof ArtifactFreshnessError) throw err;
    throw new DriverNotFoundError(kind);
  }

  let archive: Buffer;
  try {
    archive = await fetchBinary((best as DriverRelease).downloadUrl);
  } catch (err) {
    throw new DriverNotFoundError(
      `${kind} (download failed: ${(err as Error).message})`,
    );
  }

  const binary = binaryName(kind);
  let binaryData: Buffer;
  const url = (best as DriverRelease).downloadUrl;
  if (url.endsWith('.zip')) {
    binaryData = extractFromZip(archive, binary);
  } else {
    binaryData = extractFromTarGz(archive, binary);
  }

  mkdirSync(destDir, { recursive: true });
  const destPath = join(destDir, binary);
  writeFileSync(destPath, binaryData, { mode: 0o755 });
  if (platform() !== 'win32') {
    chmodSync(destPath, 0o755);
  }

  return destPath;
}

async function defaultFetcher(
  kind: DriverKind,
  browserMajorVersion: number,
): Promise<DriverRelease[]> {
  if (kind === 'geckodriver') return fetchGeckodriverReleases();
  return fetchChromedriverReleases(browserMajorVersion);
}
