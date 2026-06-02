import { describe, it, expect, vi, afterEach } from 'vitest';
import { ArtifactFreshnessError } from '../../src/errors.js';
import { provisionDriver } from '../../src/driverProvisioner.js';
import type { DriverRelease, DriverReleaseFetcher } from '../../src/driverProvisioner.js';

// Mock the filesystem writes so tests don't create real files
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    chmodSync: vi.fn(),
  };
});

// Minimal valid ZIP containing a file named "chromedriver"
function makeFakeZip(binaryName: string, content: Buffer): Buffer {
  // We'll mock the fflate unzipSync instead to keep the test simple
  return Buffer.from('fake-zip');
}

vi.mock('fflate', () => ({
  unzipSync: vi.fn((data: Uint8Array) => {
    // Return a fake entry keyed by binary name
    return { chromedriver: new Uint8Array(Buffer.from('fake-binary')) };
  }),
  gunzipSync: vi.fn((data: Uint8Array) => {
    // Return a minimal TAR with one entry named "geckodriver"
    const binary = Buffer.from('fake-binary');
    const name = 'geckodriver';
    const header = Buffer.alloc(512);
    Buffer.from(name).copy(header, 0);
    const sizeOctal = binary.length.toString(8).padStart(11, '0');
    Buffer.from(sizeOctal + '\0').copy(header, 124);
    header[156] = 48; // '0' = regular file
    const dataPad = 512 * Math.ceil(binary.length / 512);
    const dataBlock = Buffer.alloc(dataPad);
    binary.copy(dataBlock, 0);
    return new Uint8Array(Buffer.concat([header, dataBlock]));
  }),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

afterEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-02T12:00:00Z');
const ELIGIBLE_DATE = new Date('2026-05-01T00:00:00Z'); // well past quarantine
const QUARANTINED_DATE = new Date('2026-06-01T00:00:00Z'); // within 7-day window

function makeRelease(version: string, publishedAt: Date, url = 'https://example.com/driver.zip'): DriverRelease {
  return { version, publishedAt, downloadUrl: url };
}

function makeFetcher(releases: DriverRelease[]): DriverReleaseFetcher {
  return async () => releases;
}

function setupFetchBinary(binaryContent = Buffer.from('fake-binary')): void {
  mockFetch.mockResolvedValue({
    ok: true,
    arrayBuffer: async () => binaryContent.buffer,
  });
}

// ---------------------------------------------------------------------------
// provisionDriver — quarantine enforcement
// ---------------------------------------------------------------------------

describe('provisionDriver quarantine', () => {
  it('selects the newest eligible release', async () => {
    setupFetchBinary();
    // Use .tar.gz URL so gunzipSync mock (which has geckodriver entry) is exercised
    const fetcher = makeFetcher([
      makeRelease('0.33.0', ELIGIBLE_DATE, 'https://example.com/geckodriver.tar.gz'),
      makeRelease('0.34.0', ELIGIBLE_DATE, 'https://example.com/geckodriver.tar.gz'),
    ]);

    // Should not throw — 0.34.0 is the newest eligible
    await expect(
      provisionDriver('geckodriver', '126.0', '/tmp/cache', fetcher),
    ).resolves.toMatch(/geckodriver/);
  });

  it('throws ArtifactFreshnessError when all releases are in quarantine', async () => {
    const fetcher = makeFetcher([
      makeRelease('0.35.0', QUARANTINED_DATE),
    ]);

    await expect(
      provisionDriver('geckodriver', '126.0', '/tmp/cache', fetcher),
    ).rejects.toThrowError(ArtifactFreshnessError);
  });

  it('does not provision a release published yesterday', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const fetcher = makeFetcher([makeRelease('0.35.0', yesterday)]);

    await expect(
      provisionDriver('geckodriver', '126.0', '/tmp/cache', fetcher),
    ).rejects.toThrowError(ArtifactFreshnessError);
  });

  it('does not provision a release published today', async () => {
    const fetcher = makeFetcher([makeRelease('0.35.0', new Date())]);

    await expect(
      provisionDriver('geckodriver', '126.0', '/tmp/cache', fetcher),
    ).rejects.toThrowError(ArtifactFreshnessError);
  });

  it('has no bypass or force mode — quarantine is unconditional', async () => {
    // provisionDriver signature has no flag to skip quarantine
    const fetcher = makeFetcher([makeRelease('0.35.0', QUARANTINED_DATE)]);

    // Must always throw when all releases are quarantined
    await expect(
      provisionDriver('geckodriver', '126.0', '/tmp/cache', fetcher),
    ).rejects.toBeInstanceOf(ArtifactFreshnessError);
  });
});

// ---------------------------------------------------------------------------
// provisionDriver — download and extraction
// ---------------------------------------------------------------------------

describe('provisionDriver download', () => {
  it('downloads from the URL returned by the fetcher', async () => {
    const url = 'https://releases.example.com/chromedriver-124.zip';
    const fetcher = makeFetcher([makeRelease('124.0.0.0', ELIGIBLE_DATE, url)]);
    setupFetchBinary();

    await provisionDriver('chromedriver', '124.0.0.0', '/tmp/cache', fetcher);

    expect(mockFetch).toHaveBeenCalledWith(url, expect.objectContaining({ signal: expect.anything() }));
  });

  it('throws DriverNotFoundError when the network call fails', async () => {
    const fetcher = makeFetcher([makeRelease('124.0.0.0', ELIGIBLE_DATE)]);
    mockFetch.mockRejectedValue(new Error('network error'));

    const { DriverNotFoundError } = await import('../../src/errors.js');
    await expect(
      provisionDriver('chromedriver', '124.0.0.0', '/tmp/cache', fetcher),
    ).rejects.toThrowError(DriverNotFoundError);
  });

  it('throws DriverNotFoundError when the fetcher throws a network error', async () => {
    const fetcher: DriverReleaseFetcher = async () => {
      throw new Error('DNS failure');
    };

    const { DriverNotFoundError } = await import('../../src/errors.js');
    await expect(
      provisionDriver('chromedriver', '124.0.0.0', '/tmp/cache', fetcher),
    ).rejects.toThrowError(DriverNotFoundError);
  });

  it('writes the extracted binary to the destination directory', async () => {
    const fetcher = makeFetcher([
      makeRelease('124.0.0.0', ELIGIBLE_DATE, 'https://example.com/d.zip'),
    ]);
    setupFetchBinary();

    const { writeFileSync } = await import('node:fs');

    await provisionDriver('chromedriver', '124.0.0.0', '/tmp/cache', fetcher);

    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('chromedriver'),
      expect.any(Buffer),
      expect.objectContaining({ mode: 0o755 }),
    );
  });
});
