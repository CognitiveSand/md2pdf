import { execFileSync, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { provisionDriver } from './driverProvisioner.js';
import { BrowserNotFoundError } from './errors.js';

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
// Platform candidate paths
// --------------------------------------------------------------------------

interface BrowserCandidate {
  kind: BrowserKind;
  path: string;
}

const CANDIDATES_DARWIN: BrowserCandidate[] = [
  { kind: 'chrome', path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
  {
    kind: 'chrome',
    path: '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
  },
  {
    kind: 'chrome',
    path: '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  },
  { kind: 'chromium', path: '/Applications/Chromium.app/Contents/MacOS/Chromium' },
  { kind: 'firefox', path: '/Applications/Firefox.app/Contents/MacOS/firefox' },
];

const CANDIDATES_LINUX: BrowserCandidate[] = [
  { kind: 'chrome', path: '/usr/bin/google-chrome' },
  { kind: 'chrome', path: '/usr/bin/google-chrome-stable' },
  { kind: 'chromium', path: '/usr/bin/chromium-browser' },
  { kind: 'chromium', path: '/usr/bin/chromium' },
  { kind: 'firefox', path: '/usr/bin/firefox' },
  // Snap paths are handled separately below
];

const CANDIDATES_WIN32: BrowserCandidate[] = [
  {
    kind: 'chrome',
    path: join(
      process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)',
      'Google',
      'Chrome',
      'Application',
      'chrome.exe',
    ),
  },
  {
    kind: 'chrome',
    path: join(
      process.env['PROGRAMFILES'] ?? 'C:\\Program Files',
      'Google',
      'Chrome',
      'Application',
      'chrome.exe',
    ),
  },
  {
    kind: 'chrome',
    path: join(
      process.env['LOCALAPPDATA'] ?? '',
      'Google',
      'Chrome',
      'Application',
      'chrome.exe',
    ),
  },
  {
    kind: 'firefox',
    path: join(
      process.env['PROGRAMFILES'] ?? 'C:\\Program Files',
      'Mozilla Firefox',
      'firefox.exe',
    ),
  },
  {
    kind: 'firefox',
    path: join(
      process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)',
      'Mozilla Firefox',
      'firefox.exe',
    ),
  },
];

function candidatesForPlatform(): BrowserCandidate[] {
  switch (platform()) {
    case 'darwin':
      return CANDIDATES_DARWIN;
    case 'win32':
      return CANDIDATES_WIN32;
    default:
      return CANDIDATES_LINUX;
  }
}

// --------------------------------------------------------------------------
// Version helpers
// --------------------------------------------------------------------------

function getBrowserVersion(executablePath: string): string {
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

// --------------------------------------------------------------------------
// Snap Firefox (Linux)
// --------------------------------------------------------------------------

/**
 * On Linux, `snap install firefox` places a wrapper at `/snap/bin/firefox` that
 * is not a real executable WebDriver can launch.  The actual binary lives under
 * the snap mount.
 */
function resolveSnapFirefox(): LocatedBrowser | null {
  if (platform() !== 'linux') return null;

  const snapWrapper = '/snap/bin/firefox';
  const snapReal = '/snap/firefox/current/usr/lib/firefox/firefox';

  if (!existsSync(snapWrapper) && !existsSync(snapReal)) return null;

  const realPath = existsSync(snapReal) ? snapReal : snapWrapper;
  return {
    kind: 'firefox',
    executablePath: realPath,
    version: getBrowserVersion(realPath),
  };
}

// --------------------------------------------------------------------------
// MD2PDF_BROWSER override
// --------------------------------------------------------------------------

function resolveEnvOverride(): LocatedBrowser | null {
  const override = process.env['MD2PDF_BROWSER'];
  if (!override) return null;

  if (!existsSync(override)) {
    throw new Error(
      `MD2PDF_BROWSER="${override}" — no file exists at that path.`,
    );
  }

  // Infer kind from path string; default to chrome-family
  const lower = override.toLowerCase();
  const kind: BrowserKind = lower.includes('firefox') ? 'firefox' : 'chrome';
  return {
    kind,
    executablePath: override,
    version: getBrowserVersion(override),
  };
}

// --------------------------------------------------------------------------
// Browser detection
// --------------------------------------------------------------------------

/**
 * Finds an installed browser.  Checks `MD2PDF_BROWSER` first, then
 * platform-specific default paths.  Throws {@link BrowserNotFoundError} when
 * nothing is found.
 */
export function locateBrowser(): LocatedBrowser {
  const fromEnv = resolveEnvOverride();
  if (fromEnv) return fromEnv;

  // Snap Firefox needs special handling on Linux
  const snapFirefox = resolveSnapFirefox();
  if (snapFirefox) return snapFirefox;

  for (const candidate of candidatesForPlatform()) {
    if (existsSync(candidate.path)) {
      return {
        kind: candidate.kind,
        executablePath: candidate.path,
        version: getBrowserVersion(candidate.path),
      };
    }
  }

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
    return { kind, executablePath: pathBin, version: getDriverVersion(pathBin) };
  }

  // 2. Cache directory
  const cacheBin = join(cacheDir, binaryName);
  if (existsSync(cacheBin)) {
    return { kind, executablePath: cacheBin, version: getDriverVersion(cacheBin) };
  }

  // 3. Provision — download the newest eligible version (quarantine enforced inside)
  const provisionedPath = await provisioner(kind, browser.version, cacheDir);
  return { kind, executablePath: provisionedPath, version: getDriverVersion(provisionedPath) };
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
