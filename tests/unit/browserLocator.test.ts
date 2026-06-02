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
});

// ---------------------------------------------------------------------------
// locateBrowser
// ---------------------------------------------------------------------------

describe('locateBrowser', () => {
  it('throws BrowserNotFoundError when the default browser cannot be resolved', () => {
    mockExistsSync.mockReturnValue(false);
    expect(() => locateBrowser()).toThrowError(BrowserNotFoundError);
  });

  it('BrowserNotFoundError message mentions the required default browser rule', () => {
    mockExistsSync.mockReturnValue(false);

    let caught: unknown;
    try { locateBrowser(); } catch (err) { caught = err; }

    expect(caught).toBeInstanceOf(BrowserNotFoundError);
    const msg = (caught as BrowserNotFoundError).message;
    expect(msg).toContain('default browser');
    expect(msg).toContain('Chrome');
    expect(msg).toContain('Chromium');
    expect(msg).toContain('Firefox');
  });

  it('uses the Windows default browser from the registry', () => {
    if (platform() !== 'win32') return;

    const firefoxPath = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    mockExistsSync.mockImplementation((p: string) => p === firefoxPath || p === chromePath);
    mockExecFileSync.mockImplementation((command: string, args?: string[]) => {
      if (command === 'reg.exe' && args?.some(arg => arg.includes('UrlAssociations\\https'))) {
        return 'HKEY_CURRENT_USER\\Software\\...\\UserChoice\r\n    ProgId    REG_SZ    FirefoxURL\r\n';
      }
      if (command === 'reg.exe' && args?.some(arg => arg.includes('FirefoxURL\\shell\\open\\command'))) {
        return `HKEY_CURRENT_USER\\Software\\Classes\\FirefoxURL\\shell\\open\\command\r\n    (Default)    REG_SZ    "${firefoxPath}" -osint -url "%1"\r\n`;
      }
      if (command === firefoxPath) return 'Mozilla Firefox 126.0\n';
      throw new Error('unexpected command');
    });

    const browser = locateBrowser();
    expect(browser.executablePath).toBe(firefoxPath);
    expect(browser.kind).toBe('firefox');
    expect(browser.version).toBe('126.0');
  });

  it('throws when the Windows default browser is not supported', () => {
    if (platform() !== 'win32') return;

    const notepadPath = 'C:\\Windows\\System32\\notepad.exe';
    mockExistsSync.mockImplementation((p: string) => p === notepadPath);
    mockExecFileSync.mockImplementation((command: string, args?: string[]) => {
      if (command === 'reg.exe' && args?.some(arg => arg.includes('UrlAssociations\\https'))) {
        return 'HKEY_CURRENT_USER\\Software\\...\\UserChoice\r\n    ProgId    REG_SZ    txtfile\r\n';
      }
      if (command === 'reg.exe' && args?.some(arg => arg.includes('txtfile\\shell\\open\\command'))) {
        return `HKEY_CLASSES_ROOT\\txtfile\\shell\\open\\command\r\n    (Default)    REG_SZ    "${notepadPath}" "%1"\r\n`;
      }
      throw new Error('unexpected command');
    });

    expect(() => locateBrowser()).toThrowError(BrowserNotFoundError);
  });

  it('uses Windows file metadata when browser --version output is unavailable', () => {
    if (platform() !== 'win32') return;

    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    mockExistsSync.mockImplementation((p: string) => p === chromePath);
    mockExecFileSync.mockImplementation((command: string, args?: string[]) => {
      if (command === 'reg.exe' && args?.some(arg => arg.includes('UrlAssociations\\https'))) {
        return 'HKEY_CURRENT_USER\\Software\\...\\UserChoice\r\n    ProgId    REG_SZ    ChromeHTML\r\n';
      }
      if (command === 'reg.exe' && args?.some(arg => arg.includes('ChromeHTML\\shell\\open\\command'))) {
        return `HKEY_CLASSES_ROOT\\ChromeHTML\\shell\\open\\command\r\n    (Default)    REG_SZ    "${chromePath}" --single-argument "%1"\r\n`;
      }
      if (command === 'powershell.exe') return '148.0.7778.179\n';
      return '';
    });

    const browser = locateBrowser();

    expect(browser.version).toBe('148.0.7778.179');
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

  it('ignores a chromedriver from PATH when its major version does not match the browser', async () => {
    mockExecSync.mockReturnValue('/usr/local/bin/chromedriver\n');
    mockExistsSync.mockReturnValue(false);

    const provisionedPath = '/tmp/md2pdf-drivers/chromedriver';
    const provisioner: DriverProvisioner = vi.fn().mockResolvedValue(provisionedPath);
    mockExecFileSync.mockImplementation((executablePath: string) => {
      if (executablePath === '/usr/local/bin/chromedriver') return 'ChromeDriver 123.0.0.0\n';
      if (executablePath === provisionedPath) return 'ChromeDriver 124.0.0.0\n';
      return '';
    });

    const driver = await locateDriver(chromeBrowser, provisioner);

    expect(provisioner).toHaveBeenCalledWith('chromedriver', '124.0.0.0', driverCacheDir());
    expect(driver.executablePath).toBe(provisionedPath);
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

  it('ignores a cached chromedriver when its major version does not match the browser', async () => {
    mockExecSync.mockImplementation(() => { throw new Error('not found'); });

    const driverBinary = platform() === 'win32' ? 'chromedriver.exe' : 'chromedriver';
    const cacheBin = join(driverCacheDir(), driverBinary);
    const provisionedPath = '/tmp/md2pdf-drivers/chromedriver';
    const provisioner: DriverProvisioner = vi.fn().mockResolvedValue(provisionedPath);

    mockExistsSync.mockImplementation((p: string) => p === cacheBin);
    mockExecFileSync.mockImplementation((executablePath: string) => {
      if (executablePath === cacheBin) return 'ChromeDriver 123.0.0.0\n';
      if (executablePath === provisionedPath) return 'ChromeDriver 124.0.0.0\n';
      return '';
    });

    const driver = await locateDriver(chromeBrowser, provisioner);

    expect(driver.executablePath).toBe(provisionedPath);
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
