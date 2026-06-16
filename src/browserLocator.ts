import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, readFile, realpath as fsRealpath, stat } from "node:fs/promises";
import { basename, delimiter, extname, join, resolve } from "node:path";

import {
  type ArtifactPolicy,
  type ArtifactRelease,
  type ReleaseCatalog,
} from "./artifactPolicy.js";
import { ArtifactFreshnessError, BrowserNotFoundError } from "./errors.js";

export type BrowserKind = "chrome" | "chromium" | "edge" | "brave" | "firefox" | "vivaldi";
export type DriverArtifactName = "chromedriver" | "geckodriver";

export interface BrowserLocatorOptions {
  env?: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
  candidatePaths?: string[];
  fileSystem?: BrowserLocatorFileSystem;
  driverResolver?: BrowserDriverResolver;
  fallbackBrowserResolver?: FallbackBrowserResolver;
  browserProbe?: BrowserProbe;
}

export interface BrowserLocatorFileSystem {
  exists(path: string): Promise<boolean>;
  isExecutable(path: string): Promise<boolean>;
  readFile(path: string): Promise<Buffer>;
  realpath(path: string): Promise<string>;
}

export interface BrowserDriverResolver {
  resolveDriver(browser: BrowserCandidate): Promise<LocatedDriver | null>;
}

export interface BrowserProbe {
  isLaunchable(browser: BrowserCandidate): Promise<boolean>;
  version?(browser: BrowserCandidate): Promise<string | null>;
  inspect?(browser: BrowserCandidate): Promise<BrowserProbeInspection>;
}

export interface BrowserProbeInspection {
  isLaunchable: boolean;
  version: string | null;
}

export interface FallbackBrowserResolver {
  resolveFallbackBrowser(): Promise<LocatedBrowser | null>;
}

export interface BrowserCandidate {
  browserPath: string;
  kind: BrowserKind;
  displayName: string;
  version?: string;
}

export interface LocatedDriver {
  driverPath: string;
  artifactName: DriverArtifactName;
  release?: ArtifactRelease;
}

export interface LocatedBrowser extends BrowserCandidate {
  driverPath: string;
  driverArtifactName: DriverArtifactName;
}

export interface ArtifactPolicyDriverResolverOptions {
  policy: ArtifactPolicy;
  catalog: ReleaseCatalog;
  now?: Date;
  quarantineDays?: number;
  platform?: string;
  fileSystem?: BrowserLocatorFileSystem;
}

const supportedBrowsers = ["Chrome", "Chromium", "Edge", "Brave", "Firefox", "Vivaldi"];
const envBrowserVariable = "MD2PDF_BROWSER";

const WINDOWS_BROWSER_PATHS = [
  ["ProgramFiles", "Microsoft", "Edge", "Application", "msedge.exe"],
  ["ProgramFiles(x86)", "Microsoft", "Edge", "Application", "msedge.exe"],
  ["LOCALAPPDATA", "Microsoft", "Edge", "Application", "msedge.exe"],
  ["ProgramFiles", "Google", "Chrome", "Application", "chrome.exe"],
  ["ProgramFiles(x86)", "Google", "Chrome", "Application", "chrome.exe"],
  ["LOCALAPPDATA", "Google", "Chrome", "Application", "chrome.exe"],
  ["ProgramFiles", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"],
  ["ProgramFiles(x86)", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"],
  ["LOCALAPPDATA", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"],
  ["ProgramFiles", "Vivaldi", "Application", "vivaldi.exe"],
  ["ProgramFiles(x86)", "Vivaldi", "Application", "vivaldi.exe"],
  ["LOCALAPPDATA", "Vivaldi", "Application", "vivaldi.exe"],
];

const POSIX_BROWSER_NAMES = [
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
  "microsoft-edge",
  "microsoft-edge-stable",
  "msedge",
  "brave-browser",
  "brave",
  "firefox",
  "vivaldi",
  "vivaldi-stable",
];

export class BrowserLocator {
  private readonly env: Record<string, string | undefined>;
  private readonly platform: NodeJS.Platform;
  private readonly candidatePaths: string[];
  private readonly fileSystem: BrowserLocatorFileSystem;
  private readonly driverResolver: BrowserDriverResolver;
  private readonly fallbackBrowserResolver: FallbackBrowserResolver | undefined;
  private readonly browserProbe: BrowserProbe;

  constructor(options: BrowserLocatorOptions = {}) {
    this.env = options.env ?? process.env;
    this.platform = options.platform ?? process.platform;
    this.fileSystem = options.fileSystem ?? nodeFileSystem;
    this.driverResolver = options.driverResolver ?? new NullDriverResolver();
    this.fallbackBrowserResolver = options.fallbackBrowserResolver;
    this.browserProbe = options.browserProbe ?? nodeBrowserProbe;
    this.candidatePaths =
      options.candidatePaths ?? defaultBrowserCandidates(this.platform, this.env);
  }

  async locate(): Promise<LocatedBrowser> {
    const envBrowser = this.env[envBrowserVariable]?.trim();
    if (envBrowser !== undefined && envBrowser !== "") {
      return this.locateEnvBrowser(envBrowser);
    }

    return this.locateInstalledBrowser();
  }

  private async locateEnvBrowser(browserPath: string): Promise<LocatedBrowser> {
    const candidate = await this.validateExplicitBrowser(browserPath);
    const driver = await this.driverResolver.resolveDriver(candidate);

    if (driver === null) {
      throw browserError({
        message: "Pinned browser has no eligible WebDriver",
        cause: "env-browser-no-eligible-driver",
        actionHint: `${envBrowserVariable}=${browserPath} resolved to ${candidate.displayName}, but no eligible driver was found.`,
      });
    }

    return locatedBrowser(candidate, driver);
  }

  private async locateInstalledBrowser(): Promise<LocatedBrowser> {
    let sawSupportedBrowserWithoutDriver = false;

    for (const candidatePath of this.candidatePaths) {
      const candidate = await this.candidateFromPath(candidatePath);
      if (candidate === null) {
        continue;
      }

      const driver = await this.driverResolver.resolveDriver(candidate);
      if (driver !== null) {
        return locatedBrowser(candidate, driver);
      }

      sawSupportedBrowserWithoutDriver = true;
    }

    const fallback = await this.locateFallbackBrowser();
    if (fallback !== null) {
      return fallback;
    }

    if (sawSupportedBrowserWithoutDriver) {
      throw browserError({
        message: "No eligible WebDriver was found for an installed supported browser",
        cause: "no-eligible-driver",
        actionHint: `Install one of ${supportedBrowsers.join(", ")} with an eligible WebDriver, or set ${envBrowserVariable}.`,
      });
    }

    throw browserError({
      message: "No supported browser was found",
      cause: "no-compatible-browser",
      actionHint: `Install one of ${supportedBrowsers.join(", ")} with an eligible WebDriver, or set ${envBrowserVariable}.`,
    });
  }

  private async locateFallbackBrowser(): Promise<LocatedBrowser | null> {
    if (this.fallbackBrowserResolver === undefined) {
      return null;
    }

    try {
      return await this.fallbackBrowserResolver.resolveFallbackBrowser();
    } catch (error) {
      if (error instanceof ArtifactFreshnessError) {
        throw browserError({
          message: "No supported browser was found and no eligible fallback browser artifact is available",
          cause: error,
          actionHint: `Install one of ${supportedBrowsers.join(", ")} or declare an eligible fallback browser artifact.`,
        });
      }

      throw error;
    }
  }

  private async validateExplicitBrowser(browserPath: string): Promise<BrowserCandidate> {
    const resolvedPath = resolve(browserPath);

    let exists: boolean;
    try {
      exists = await this.fileSystem.exists(resolvedPath);
    } catch {
      throw browserError({
        message: "Pinned browser path is not accessible",
        cause: "env-browser-not-launchable",
        actionHint: explicitBrowserHint(browserPath, resolvedPath, "points to a file that cannot be accessed"),
      });
    }

    if (!exists) {
      throw browserError({
        message: "Pinned browser path does not exist",
        cause: "env-browser-not-found",
        actionHint: explicitBrowserHint(browserPath, resolvedPath, "points to a missing file"),
      });
    }

    if (!(await this.fileSystem.isExecutable(resolvedPath))) {
      throw browserError({
        message: "Pinned browser path is not executable",
        cause: "env-browser-not-launchable",
        actionHint: explicitBrowserHint(browserPath, resolvedPath, "must point to an executable browser binary"),
      });
    }

    const realBrowserPath = await resolveBrowserPath(
      await this.fileSystem.realpath(resolvedPath),
      this.fileSystem,
    );
    const candidate = browserKindFromPath(realBrowserPath);
    if (candidate === null) {
      throw browserError({
        message: "Pinned browser path is not a supported browser",
        cause: "env-browser-not-launchable",
        actionHint: explicitBrowserHint(browserPath, realBrowserPath, `must point to ${supportedBrowsers.join(", ")}`),
      });
    }

    const browser = { ...candidate, browserPath: realBrowserPath };
    const inspection = await inspectBrowser(browser, this.browserProbe);
    if (!inspection.isLaunchable) {
      throw browserError({
        message: "Pinned browser path is not launchable as a supported browser",
        cause: "env-browser-not-launchable",
        actionHint: explicitBrowserHint(browserPath, realBrowserPath, `must point to a launchable ${supportedBrowsers.join(", ")} binary`),
      });
    }

    return withBrowserInspection(browser, inspection);
  }

  private async candidateFromPath(candidatePath: string): Promise<BrowserCandidate | null> {
    const resolvedPath = resolve(candidatePath);
    try {
      if (!(await this.fileSystem.exists(resolvedPath))) {
        return null;
      }
    } catch {
      return null;
    }

    if (!(await this.fileSystem.isExecutable(resolvedPath))) {
      return null;
    }

    const realBrowserPath = await resolveBrowserPath(
      await this.fileSystem.realpath(resolvedPath),
      this.fileSystem,
    );
    const candidate = browserKindFromPath(realBrowserPath);
    if (candidate === null) {
      return null;
    }

    const browser = { ...candidate, browserPath: realBrowserPath };
    const inspection = await inspectBrowser(browser, this.browserProbe);
    if (!inspection.isLaunchable) {
      return null;
    }

    return withBrowserInspection(browser, inspection);
  }
}

export class ArtifactPolicyDriverResolver implements BrowserDriverResolver {
  private readonly policy: ArtifactPolicy;
  private readonly catalog: ReleaseCatalog;
  private readonly now: Date;
  private readonly quarantineDays: number;
  private readonly platform: string | undefined;
  private readonly fileSystem: BrowserLocatorFileSystem;

  constructor(options: ArtifactPolicyDriverResolverOptions) {
    this.policy = options.policy;
    this.catalog = options.catalog;
    this.now = options.now ?? new Date();
    this.quarantineDays = options.quarantineDays ?? 7;
    this.platform = options.platform;
    this.fileSystem = options.fileSystem ?? nodeFileSystem;
  }

  async resolveDriver(browser: BrowserCandidate): Promise<LocatedDriver | null> {
    const artifactName = driverArtifactNameForBrowser(browser.kind);
    let release: ArtifactRelease | null;
    try {
      release = this.policy.selectNewestEligible(
        await this.catalog.listReleases(artifactName),
        {
          quarantineDays: this.quarantineDays,
          platform: this.platform,
          ...driverCompatibilityConstraint(browser),
        },
        this.now,
      );
    } catch (error) {
      if (isNoEligibleArtifact(error)) {
        return null;
      }

      throw error;
    }

    if (release?.path === undefined) {
      return null;
    }

    const driverPath = resolve(release.path);
    if (!(await this.fileSystem.exists(driverPath)) || !(await this.fileSystem.isExecutable(driverPath))) {
      return null;
    }

    await assertDriverIntegrity(release, driverPath, artifactName, this.fileSystem);

    return { artifactName, driverPath, release };
  }
}

class NullDriverResolver implements BrowserDriverResolver {
  async resolveDriver(): Promise<LocatedDriver | null> {
    return null;
  }
}

const nodeFileSystem: BrowserLocatorFileSystem = {
  async exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw error;
    }
  },
  async isExecutable(path: string): Promise<boolean> {
    try {
      const fileStats = await stat(path);
      if (!fileStats.isFile()) {
        return false;
      }

      await access(path, process.platform === "win32" ? constants.F_OK : constants.X_OK);
      return true;
    } catch {
      return false;
    }
  },
  async readFile(path: string): Promise<Buffer> {
    return readFile(path);
  },
  async realpath(path: string): Promise<string> {
    try {
      return await fsRealpath(path);
    } catch {
      return path;
    }
  },
};

async function assertDriverIntegrity(
  release: ArtifactRelease,
  driverPath: string,
  artifactName: string,
  fileSystem: BrowserLocatorFileSystem,
): Promise<void> {
  let data: Buffer;
  try {
    data = await fileSystem.readFile(driverPath);
  } catch (cause) {
    throw new ArtifactFreshnessError({
      message: "Declared WebDriver artifact could not be read for integrity verification",
      artifactName,
      actionHint: "Declare a readable local WebDriver artifact or provision an eligible fallback artifact.",
      cause,
    });
  }

  const sha256 = createHash("sha256").update(data).digest("hex");
  if (data.byteLength !== release.size || sha256 !== release.sha256) {
    throw new ArtifactFreshnessError({
      message: "Declared WebDriver artifact checksum did not match the release catalog",
      artifactName,
      actionHint: "Replace the local WebDriver artifact or update artifacts.json with the verified newest eligible artifact.",
      cause: "integrity-mismatch",
    });
  }
}

const nodeBrowserProbe: BrowserProbe = {
  async inspect(browser: BrowserCandidate): Promise<BrowserProbeInspection> {
    try {
      const output = await execBrowserVersion(browser.browserPath);
      return {
        isLaunchable: browserVersionMatchesKind(output, browser.kind),
        version: parseBrowserVersion(output),
      };
    } catch {
      return { isLaunchable: false, version: null };
    }
  },
  async isLaunchable(browser: BrowserCandidate): Promise<boolean> {
    try {
      const output = await execBrowserVersion(browser.browserPath);
      return browserVersionMatchesKind(output, browser.kind);
    } catch {
      return false;
    }
  },
  async version(browser: BrowserCandidate): Promise<string | null> {
    try {
      return parseBrowserVersion(await execBrowserVersion(browser.browserPath));
    } catch {
      return null;
    }
  },
};

function locatedBrowser(candidate: BrowserCandidate, driver: LocatedDriver): LocatedBrowser {
  return {
    ...candidate,
    driverPath: driver.driverPath,
    driverArtifactName: driver.artifactName,
  };
}

function browserError(input: {
  message: string;
  cause: unknown;
  actionHint: string;
}): BrowserNotFoundError {
  return new BrowserNotFoundError({
    message: input.message,
    actionHint: input.actionHint,
    cause: input.cause,
  });
}

function explicitBrowserHint(inputPath: string, resolvedPath: string, message: string): string {
  if (inputPath === resolvedPath) {
    return `${envBrowserVariable} ${message}: ${resolvedPath}`;
  }

  return `${envBrowserVariable} ${message}: ${inputPath} (resolved: ${resolvedPath})`;
}

function isNoEligibleArtifact(error: unknown): boolean {
  return error instanceof ArtifactFreshnessError && error.context.cause === "no-eligible-release";
}

async function execBrowserVersion(browserPath: string): Promise<string> {
  return execFileOutput(browserPath, ["--version"], 3_000);
}

async function execFileOutput(path: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolveVersion, rejectVersion) => {
    execFile(
      path,
      args,
      { timeout, windowsHide: true },
      (error, stdout, stderr) => {
        if (error !== null) {
          rejectVersion(error);
          return;
        }

        resolveVersion(`${stdout}\n${stderr}`.trim());
      },
    );
  });
}

function browserVersionMatchesKind(output: string, kind: BrowserKind): boolean {
  const normalized = output.toLowerCase();

  if (kind === "chrome") {
    return normalized.includes("google chrome") || /^chrome\s+\d/u.test(normalized);
  }

  if (kind === "chromium") {
    return normalized.includes("chromium");
  }

  if (kind === "edge") {
    return normalized.includes("microsoft edge") || normalized.includes("msedge");
  }

  if (kind === "brave") {
    return normalized.includes("brave");
  }

  if (kind === "vivaldi") {
    return normalized.includes("vivaldi");
  }

  return normalized.includes("firefox");
}

function browserKindFromPath(path: string): Omit<BrowserCandidate, "browserPath"> | null {
  const normalized = path.toLowerCase();
  const name = basename(normalized);

  if (
    normalized.includes("google chrome") ||
    name === "chrome" ||
    name === "chrome.exe" ||
    name === "google-chrome" ||
    name === "google-chrome-stable"
  ) {
    return { kind: "chrome", displayName: "Chrome" };
  }

  if (
    normalized.includes("microsoft edge") ||
    name === "msedge" ||
    name === "msedge.exe" ||
    name === "microsoft-edge" ||
    name === "microsoft-edge-stable"
  ) {
    return { kind: "edge", displayName: "Edge" };
  }

  if (
    normalized.includes("brave browser") ||
    normalized.includes("brave-browser") ||
    name === "brave" ||
    name === "brave.exe" ||
    name === "brave-browser"
  ) {
    return { kind: "brave", displayName: "Brave" };
  }

  if (name === "chromium" || name === "chromium-browser" || name === "chromium.exe") {
    return { kind: "chromium", displayName: "Chromium" };
  }

  if (
    normalized.includes("vivaldi") ||
    name === "vivaldi" ||
    name === "vivaldi.exe" ||
    name === "vivaldi-stable"
  ) {
    return { kind: "vivaldi", displayName: "Vivaldi" };
  }

  if (name === "firefox" || name === "firefox.exe" || normalized.includes("firefox.app")) {
    return { kind: "firefox", displayName: "Firefox" };
  }

  return null;
}

function driverArtifactNameForBrowser(kind: BrowserKind): DriverArtifactName {
  return kind === "firefox" ? "geckodriver" : "chromedriver";
}

function driverCompatibilityConstraint(browser: BrowserCandidate): { compatibleWith?: string } {
  if (browser.kind === "firefox" || browser.version === undefined) {
    return {};
  }

  return { compatibleWith: browser.version };
}

async function inspectBrowser(
  browser: BrowserCandidate,
  probe: BrowserProbe,
): Promise<BrowserProbeInspection> {
  if (probe.inspect !== undefined) {
    return probe.inspect(browser);
  }

  if (!(await probe.isLaunchable(browser))) {
    return { isLaunchable: false, version: null };
  }

  return {
    isLaunchable: true,
    version: await probe.version?.(browser) ?? null,
  };
}

function withBrowserInspection(
  browser: BrowserCandidate,
  inspection: BrowserProbeInspection,
): BrowserCandidate {
  if (inspection.version === null || inspection.version === "") {
    return browser;
  }

  return { ...browser, version: inspection.version };
}

function parseBrowserVersion(output: string): string | null {
  const match = /(\d+(?:[.]\d+)+|\d+)/u.exec(output);
  return match?.[1] ?? null;
}

function defaultBrowserCandidates(
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>,
): string[] {
  if (platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      "/Applications/Firefox.app/Contents/MacOS/firefox",
      "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi",
    ];
  }

  if (platform === "win32") {
    return [
      ...windowsRoots(env).map((root) => join(root, "Google", "Chrome", "Application", "chrome.exe")),
      ...windowsRoots(env).map((root) => join(root, "Chromium", "Application", "chromium.exe")),
      ...windowsRoots(env).map((root) => join(root, "Microsoft", "Edge", "Application", "msedge.exe")),
      ...windowsRoots(env).map((root) =>
        join(root, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
      ),
      ...windowsRoots(env).map((root) => join(root, "Mozilla Firefox", "firefox.exe")),
      ...windowsRoots(env).map((root) => join(root, "Vivaldi", "Application", "vivaldi.exe")),
      ...pathExecutablesForEnv(env, platform, "msedge.exe", "chrome.exe", "chromium.exe", "brave.exe", "vivaldi.exe"),
    ];
  }

  return [
    ...pathExecutablesForEnv(env, platform, ...POSIX_BROWSER_NAMES),
    "/snap/firefox/current/usr/lib/firefox/firefox",
    "/usr/bin/firefox",
  ];
}

function windowsRoots(env: Record<string, string | undefined>): string[] {
  const roots = [
    env.ProgramFiles,
    env["ProgramFiles(x86)"],
    env.LOCALAPPDATA,
  ].filter((root): root is string => root !== undefined && root !== "");

  return [...new Set(roots)];
}

function pathExecutablesForEnv(
  env: Record<string, string | undefined>,
  platform: NodeJS.Platform,
  ...names: string[]
): string[] {
  const suffixes = platform === "win32"
    ? (env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
      .split(";")
      .map((suffix) => suffix.toLowerCase())
    : [""];

  return (env.PATH ?? "")
    .split(delimiter)
    .filter((path) => path !== "")
    .flatMap((path) =>
      names.flatMap((name) => {
        if (platform !== "win32" || extname(name) !== "") {
          return [join(path, name)];
        }

        return suffixes.map((suffix) => join(path, `${name}${suffix}`));
      })
    );
}

async function resolveBrowserPath(
  path: string,
  fileSystem: BrowserLocatorFileSystem,
): Promise<string> {
  if (path !== "/usr/bin/firefox") {
    return path;
  }

  const snapPath = "/snap/firefox/current/usr/lib/firefox/firefox";
  if (await fileSystem.exists(snapPath)) {
    return snapPath;
  }

  return path;
}
