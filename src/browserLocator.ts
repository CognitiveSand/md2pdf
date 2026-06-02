import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { provisionDriver } from './driverProvisioner.js';
import { BrowserNotFoundError, DriverNotFoundError } from './errors.js';

export type BrowserKind = 'chrome' | 'chromium' | 'firefox';
export type DriverKind = 'chromedriver' | 'geckodriver';

export interface LocatedBrowser {
  kind: BrowserKind;
  executablePath: string;
  version: string;
}

export interface LocatedDriver {
  kind: DriverKind;
  executablePath: string;
  version: string;
}

export interface BrowserAndDriver {
  browser: LocatedBrowser;
  driver: LocatedDriver;
}

// --------------------------------------------------------------------------
// Version helpers
// --------------------------------------------------------------------------

function parseVersion(output: string): string | null {
  const match = output.match(/\d+\.\d+(?:\.\d+)*/);
  return match ? match[0] : null;
}

function readExecutableVersion(executablePath: string, args: string[]): string | null {
  try {
    const output = execFileSync(executablePath, args, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return parseVersion(output);
  } catch {
    return null;
  }
}

function powerShellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function readWindowsFileVersion(executablePath: string): string | null {
  if (platform() !== 'win32') return null;

  try {
    const output = execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `$ErrorActionPreference = 'Stop'; (Get-Item -LiteralPath ${powerShellSingleQuote(executablePath)}).VersionInfo.ProductVersion`,
    ], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return parseVersion(output);
  } catch {
    return null;
  }
}

function getBrowserVersion(executablePath: string): string {
  return readExecutableVersion(executablePath, ['--version'])
    ?? readExecutableVersion(executablePath, ['--product-version'])
    ?? readWindowsFileVersion(executablePath)
    ?? '0.0.0';
}

function getDriverVersion(executablePath: string): string {
  try {
    const output = execFileSync(executablePath, ['--version'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const match = output.match(/\d+\.\d+(?:\.\d+)*/);
    return match ? match[0] : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function majorVersion(version: string): number | null {
  const major = parseInt(version.split('.')[0] ?? '', 10);
  return Number.isFinite(major) && major > 0 ? major : null;
}

function isCompatibleDriver(browser: LocatedBrowser, driver: LocatedDriver): boolean {
  if (browser.kind === 'firefox') {
    return driver.kind === 'geckodriver';
  }

  if (driver.kind !== 'chromedriver') {
    return false;
  }

  const browserMajor = majorVersion(browser.version);
  const driverMajor = majorVersion(driver.version);
  return browserMajor !== null && driverMajor !== null && browserMajor === driverMajor;
}

function compatibleDriverOrNull(
  browser: LocatedBrowser,
  kind: DriverKind,
  executablePath: string,
): LocatedDriver | null {
  const driver = { kind, executablePath, version: getDriverVersion(executablePath) };
  return isCompatibleDriver(browser, driver) ? driver : null;
}

// --------------------------------------------------------------------------
// Default browser detection
// --------------------------------------------------------------------------

function expandWindowsEnvVars(value: string): string {
  return value.replace(/%([^%]+)%/g, (_, name: string) => process.env[name] ?? '');
}

function executableFromCommand(command: string): string | null {
  const trimmed = expandWindowsEnvVars(command).trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('"')) {
    const endQuote = trimmed.indexOf('"', 1);
    return endQuote > 1 ? trimmed.slice(1, endQuote) : null;
  }

  const firstToken = trimmed.split(/\s+/)[0];
  return firstToken || null;
}

function inferBrowserKind(executablePath: string): BrowserKind | null {
  const lower = executablePath.toLowerCase();
  if (lower.includes('firefox')) return 'firefox';
  if (lower.includes('chromium')) return 'chromium';
  if (
    lower.includes('chrome')
    || lower.includes('brave')
    || lower.includes('msedge')
    || lower.includes('edge')
  ) {
    return 'chrome';
  }
  return null;
}

function locatedBrowserFromExecutable(executablePath: string): LocatedBrowser | null {
  const kind = inferBrowserKind(executablePath);
  if (!kind || !existsSync(executablePath)) return null;

  return {
    kind,
    executablePath,
    version: getBrowserVersion(executablePath),
  };
}

function readWindowsRegistryValue(key: string, valueName: string): string | null {
  try {
    const args = valueName === '(default)'
      ? ['query', key, '/ve']
      : ['query', key, '/v', valueName];
    const output = execFileSync('reg.exe', args, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const defaultMatch = output.match(/\s+REG_\w+\s+(.+)/);
    if (valueName === '(default)') return defaultMatch?.[1]?.trim() ?? null;

    const escapedName = valueName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = output.match(new RegExp(`\\s${escapedName}\\s+REG_\\w+\\s+(.+)`));
    return match?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

function resolveWindowsDefaultBrowser(): LocatedBrowser | null {
  const userChoiceKeys = [
    'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice',
    'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice',
  ];

  const progId = userChoiceKeys
    .map(key => readWindowsRegistryValue(key, 'ProgId'))
    .find((value): value is string => Boolean(value));
  if (!progId) return null;

  const commandKeys = [
    `HKCU\\Software\\Classes\\${progId}\\shell\\open\\command`,
    `HKLM\\Software\\Classes\\${progId}\\shell\\open\\command`,
    `HKCR\\${progId}\\shell\\open\\command`,
  ];

  const command = commandKeys
    .map(key => readWindowsRegistryValue(key, '(default)'))
    .find((value): value is string => Boolean(value));
  const executablePath = command ? executableFromCommand(command) : null;
  return executablePath ? locatedBrowserFromExecutable(executablePath) : null;
}

function resolveDarwinDefaultBrowser(): LocatedBrowser | null {
  try {
    const appPath = execFileSync('osascript', [
      '-e',
      'POSIX path of (path to default application for URL "https://example.com")',
    ], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    const appName = appPath.replace(/\/$/, '').split('/').pop() ?? '';
    const executableName = appName === 'Firefox.app'
      ? 'firefox'
      : appName.replace(/\.app$/, '');
    const executablePath = join(appPath, 'Contents', 'MacOS', executableName);
    return locatedBrowserFromExecutable(executablePath);
  } catch {
    return null;
  }
}

function desktopSearchDirs(): string[] {
  return [
    join(homedir(), '.local', 'share', 'applications'),
    '/usr/local/share/applications',
    '/usr/share/applications',
  ];
}

function resolveLinuxDesktopExec(desktopId: string): string | null {
  for (const dir of desktopSearchDirs()) {
    const desktopPath = join(dir, desktopId);
    if (!existsSync(desktopPath)) continue;

    try {
      const content = readFileSync(desktopPath, 'utf8');
      const execLine = content.split(/\r?\n/).find(line => line.startsWith('Exec='));
      if (!execLine) continue;
      return execLine.slice('Exec='.length).replace(/\s+%[fFuUdDnNickvm]|\s+%%/g, '');
    } catch {
      continue;
    }
  }
  return null;
}

function resolveLinuxDefaultBrowser(): LocatedBrowser | null {
  try {
    const desktopId = execFileSync('xdg-settings', ['get', 'default-web-browser'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!desktopId) return null;

    const command = resolveLinuxDesktopExec(desktopId);
    const executable = command ? executableFromCommand(command) : null;
    if (!executable) return null;
    const executablePath = executable.includes('/') ? executable : findBinaryInPath(executable);
    return executablePath ? locatedBrowserFromExecutable(executablePath) : null;
  } catch {
    return null;
  }
}

function resolveDefaultBrowser(): LocatedBrowser | null {
  switch (platform()) {
    case 'darwin':
      return resolveDarwinDefaultBrowser();
    case 'win32':
      return resolveWindowsDefaultBrowser();
    default:
      return resolveLinuxDefaultBrowser();
  }
}

// --------------------------------------------------------------------------
// Browser detection
// --------------------------------------------------------------------------

/**
 * Finds the OS default browser. Throws {@link BrowserNotFoundError} when the
 * default browser cannot be resolved or is not supported by md2pdf.
 */
export function locateBrowser(): LocatedBrowser {
  const defaultBrowser = resolveDefaultBrowser();
  if (defaultBrowser) return defaultBrowser;
  throw new BrowserNotFoundError();
}

// --------------------------------------------------------------------------
// Driver detection
// --------------------------------------------------------------------------

function findBinaryInPath(name: string): string | null {
  try {
    const cmd = platform() === 'win32' ? `where "${name}"` : `which "${name}"`;
    const result = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return result.trim().split('\n')[0]?.trim() || null;
  } catch {
    return null;
  }
}

/** Default per-user driver cache directory. */
export function driverCacheDir(): string {
  return join(homedir(), '.cache', 'md2pdf', 'drivers');
}

/**
 * Injectable provisioner — downloads and installs a driver binary.
 * Signature matches {@link provisionDriver} from driverProvisioner.ts.
 */
export type DriverProvisioner = (
  kind: DriverKind,
  browserVersion: string,
  destDir: string,
) => Promise<string>;

/**
 * Resolves the driver binary for the given browser.
 *
 * Resolution order:
 * 1. Driver found on `PATH`.
 * 2. Driver found in `~/.cache/md2pdf/drivers/`.
 * 3. Driver provisioned (downloaded) into the cache directory.
 *
 * Pass a custom `provisioner` in tests to avoid real network calls.
 */
export async function locateDriver(
  browser: LocatedBrowser,
  provisioner: DriverProvisioner = provisionDriver,
): Promise<LocatedDriver> {
  const kind: DriverKind =
    browser.kind === 'firefox' ? 'geckodriver' : 'chromedriver';
  const binaryName = platform() === 'win32' ? `${kind}.exe` : kind;
  const cacheDir = driverCacheDir();

  // 1. PATH search
  const pathBin = findBinaryInPath(kind);
  if (pathBin) {
    const pathDriver = compatibleDriverOrNull(browser, kind, pathBin);
    if (pathDriver) return pathDriver;
  }

  // 2. Cache directory
  const cacheBin = join(cacheDir, binaryName);
  if (existsSync(cacheBin)) {
    const cacheDriver = compatibleDriverOrNull(browser, kind, cacheBin);
    if (cacheDriver) return cacheDriver;
  }

  // 3. Provision — download the newest eligible version (quarantine enforced inside)
  const provisionedPath = await provisioner(kind, browser.version, cacheDir);
  const provisionedDriver = {
    kind,
    executablePath: provisionedPath,
    version: getDriverVersion(provisionedPath),
  };
  if (!isCompatibleDriver(browser, provisionedDriver)) {
    throw new DriverNotFoundError(
      `${kind} (driver ${provisionedDriver.version} does not match browser ${browser.version})`,
    );
  }
  return provisionedDriver;
}

/**
 * Convenience wrapper — locates both the browser and its matching driver.
 * Pass a custom `provisioner` to override the real download in tests.
 */
export async function locateBrowserAndDriver(
  provisioner?: DriverProvisioner,
): Promise<BrowserAndDriver> {
  const browser = locateBrowser();
  const driver = await locateDriver(browser, provisioner);
  return { browser, driver };
}
