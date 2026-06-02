import { describe, it, expect, vi, afterEach } from 'vitest';
import { join } from 'node:path';
import { platform } from 'node:os';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, existsSync: vi.fn() };
});

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, execFileSync: vi.fn(), execSync: vi.fn() };
});

import { existsSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import {
  locateBrowser,
  locateDriver,
  driverCacheDir,
  type LocatedBrowser,
  type DriverProvisioner,
} from '../../src/browserLocator.js';
import { BrowserNotFoundError, DriverNotFoundError } from '../../src/errors.js';

const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>;
const mockExecFileSync = execFileSync as unknown as ReturnType<typeof vi.fn>;
const mockExecSync = execSync as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.resetAllMocks();
  delete process.env['MD2PDF_BROWSER'];
});

// ---------------------------------------------------------------------------
// locateBrowser
// ---------------------------------------------------------------------------

describe('locateBrowser', () => {
  it('returns the browser from MD2PDF_BROWSER when it exists', () => {
    process.env['MD2PDF_BROWSER'] = '/custom/chrome';
    mockExistsSync.mockImplementation((p: string) => p === '/custom/chrome');
    mockExecFileSync.mockReturnValue('Google Chrome 120.0.0.0\n');

    const browser = locateBrowser();

    expect(browser.executablePath).toBe('/custom/chrome');
    expect(browser.kind).toBe('chrome');
  });

  it('infers firefox kind from MD2PDF_BROWSER path containing "firefox"', () => {
    process.env['MD2PDF_BROWSER'] = '/usr/bin/firefox';
    mockExistsSync.mockImplementation((p: string) => p === '/usr/bin/firefox');
    mockExecFileSync.mockReturnValue('Mozilla Firefox 120.0\n');

    const browser = locateBrowser();
    expect(browser.kind).toBe('firefox');
  });

  it('throws when MD2PDF_BROWSER points to a missing file', () => {
    process.env['MD2PDF_BROWSER'] = '/nonexistent/browser';
    mockExistsSync.mockReturnValue(false);

    expect(() => locateBrowser()).toThrow('MD2PDF_BROWSER');
    expect(() => locateBrowser()).toThrow('/nonexistent/browser');
  });

  it('throws BrowserNotFoundError when no candidate exists', () => {
    mockExistsSync.mockReturnValue(false);
    expect(() => locateBrowser()).toThrowError(BrowserNotFoundError);
  });

  it('BrowserNotFoundError message mentions Chrome, Chromium, Firefox and MD2PDF_BROWSER', () => {
    mockExistsSync.mockReturnValue(false);

    let caught: unknown;
    try { locateBrowser(); } catch (err) { caught = err; }

    expect(caught).toBeInstanceOf(BrowserNotFoundError);
    const msg = (caught as BrowserNotFoundError).message;
    expect(msg).toContain('Chrome');
    expect(msg).toContain('Chromium');
    expect(msg).toContain('Firefox');
    expect(msg).toContain('MD2PDF_BROWSER');
  });

  it('returns the first existing candidate in priority order', () => {
    const chromePath = firstChromeCandidateForCurrentPlatform();
    mockExistsSync.mockImplementation((p: string) => p === chromePath);
    mockExecFileSync.mockReturnValue('Google Chrome 124.0.0.0\n');

    const browser = locateBrowser();
    expect(browser.executablePath).toBe(chromePath);
    expect(browser.version).toMatch(/\d+\.\d+/);
  });
});

// ---------------------------------------------------------------------------
// locateDriver (async)
// ---------------------------------------------------------------------------

const chromeBrowser: LocatedBrowser = {
  kind: 'chrome',
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  version: '124.0.0.0',
};

const firefoxBrowser: LocatedBrowser = {
  kind: 'firefox',
  executablePath: '/Applications/Firefox.app/Contents/MacOS/firefox',
  version: '126.0',
};

/** Provisioner that always fails — simulates no network / no auto-install. */
const failingProvisioner: DriverProvisioner = async (kind) => {
  throw new DriverNotFoundError(kind);
};

describe('locateDriver', () => {
  it('returns chromedriver from PATH for a chrome browser', async () => {
    mockExecSync.mockReturnValue('/usr/local/bin/chromedriver\n');
    mockExecFileSync.mockReturnValue('ChromeDriver 124.0.0.0\n');

    const driver = await locateDriver(chromeBrowser, failingProvisioner);

    expect(driver.kind).toBe('chromedriver');
    expect(driver.executablePath).toBe('/usr/local/bin/chromedriver');
  });

  it('returns geckodriver from PATH for a firefox browser', async () => {
    mockExecSync.mockReturnValue('/usr/local/bin/geckodriver\n');
    mockExecFileSync.mockReturnValue('geckodriver 0.34.0\n');

    const driver = await locateDriver(firefoxBrowser, failingProvisioner);
    expect(driver.kind).toBe('geckodriver');
  });

  it('falls back to cache directory when driver is not on PATH', async () => {
    mockExecSync.mockImplementation(() => { throw new Error('not found'); });

    const driverBinary = platform() === 'win32' ? 'chromedriver.exe' : 'chromedriver';
    const cacheBin = join(driverCacheDir(), driverBinary);
    mockExistsSync.mockImplementation((p: string) => p === cacheBin);
    mockExecFileSync.mockReturnValue('ChromeDriver 124.0.0.0\n');

    const driver = await locateDriver(chromeBrowser, failingProvisioner);
    expect(driver.executablePath).toBe(cacheBin);
  });

  it('calls the provisioner when driver is absent from PATH and cache', async () => {
    mockExecSync.mockImplementation(() => { throw new Error('not found'); });
    mockExistsSync.mockReturnValue(false);

    const provisionedPath = '/tmp/md2pdf-drivers/chromedriver';
    const provisioner: DriverProvisioner = vi.fn().mockResolvedValue(provisionedPath);
    mockExecFileSync.mockReturnValue('ChromeDriver 124.0.0.0\n');

    const driver = await locateDriver(chromeBrowser, provisioner);

    expect(provisioner).toHaveBeenCalledWith('chromedriver', '124.0.0.0', driverCacheDir());
    expect(driver.executablePath).toBe(provisionedPath);
  });

  it('propagates DriverNotFoundError from the provisioner', async () => {
    mockExecSync.mockImplementation(() => { throw new Error(); });
    mockExistsSync.mockReturnValue(false);

    await expect(locateDriver(chromeBrowser, failingProvisioner))
      .rejects.toThrowError(DriverNotFoundError);
  });
});

function firstChromeCandidateForCurrentPlatform(): string {
  switch (platform()) {
    case 'darwin':
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    case 'win32':
      return join(
        process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)',
        'Google',
        'Chrome',
        'Application',
        'chrome.exe',
      );
    default:
      return '/usr/bin/google-chrome';
  }
}
