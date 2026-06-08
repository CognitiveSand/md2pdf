import { constants } from "node:fs";
import { access, realpath as fsRealpath, stat } from "node:fs/promises";
import { basename, delimiter, join, resolve } from "node:path";

import {
  type ArtifactPolicy,
  type ArtifactRelease,
  type ReleaseCatalog,
} from "./artifactPolicy.js";
import { BrowserNotFoundError } from "./errors.js";

export type BrowserKind = "chrome" | "chromium" | "edge" | "brave" | "firefox";
export type DriverArtifactName = "chromedriver" | "geckodriver";

export interface BrowserLocatorOptions {
  env?: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
  candidatePaths?: string[];
  fileSystem?: BrowserLocatorFileSystem;
  driverResolver?: BrowserDriverResolver;
}

export interface BrowserLocatorFileSystem {
  exists(path: string): Promise<boolean>;
  isExecutable(path: string): Promise<boolean>;
  realpath(path: string): Promise<string>;
}

export interface BrowserDriverResolver {
  resolveDriver(browser: BrowserCandidate): Promise<LocatedDriver | null>;
}

export interface BrowserCandidate {
  browserPath: string;
  kind: BrowserKind;
  displayName: string;
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
  fileSystem?: BrowserLocatorFileSystem;
}

const supportedBrowsers = ["Chrome", "Chromium", "Edge", "Brave", "Firefox"];
const envBrowserVariable = "MD2PDF_BROWSER";

export class BrowserLocator {
  private readonly env: Record<string, string | undefined>;
  private readonly platform: NodeJS.Platform;
  private readonly candidatePaths: string[];
  private readonly fileSystem: BrowserLocatorFileSystem;
  private readonly driverResolver: BrowserDriverResolver;

  constructor(options: BrowserLocatorOptions = {}) {
    this.env = options.env ?? process.env;
    this.platform = options.platform ?? process.platform;
    this.fileSystem = options.fileSystem ?? nodeFileSystem;
    this.driverResolver = options.driverResolver ?? new NullDriverResolver();
    this.candidatePaths = options.candidatePaths ?? defaultBrowserCandidates(this.platform);
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

    throw browserError({
      message: sawSupportedBrowserWithoutDriver
        ? "No eligible WebDriver was found for an installed supported browser"
        : "No supported browser was found",
      cause: sawSupportedBrowserWithoutDriver ? "no-eligible-driver" : "no-compatible-browser",
      actionHint: `Install one of ${supportedBrowsers.join(", ")} with an eligible WebDriver, or set ${envBrowserVariable}.`,
    });
  }

  private async validateExplicitBrowser(browserPath: string): Promise<BrowserCandidate> {
    const resolvedPath = resolve(browserPath);
    if (!(await this.fileSystem.exists(resolvedPath))) {
      throw browserError({
        message: "Pinned browser path does not exist",
        cause: "env-browser-not-found",
        actionHint: `${envBrowserVariable} points to a missing file: ${resolvedPath}`,
      });
    }

    if (!(await this.fileSystem.isExecutable(resolvedPath))) {
      throw browserError({
        message: "Pinned browser path is not executable",
        cause: "env-browser-not-launchable",
        actionHint: `${envBrowserVariable} must point to an executable browser binary: ${resolvedPath}`,
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
        actionHint: `${envBrowserVariable} must point to Chrome, Chromium, Edge, Brave, or Firefox: ${realBrowserPath}`,
      });
    }

    return { ...candidate, browserPath: realBrowserPath };
  }

  private async candidateFromPath(candidatePath: string): Promise<BrowserCandidate | null> {
    const resolvedPath = resolve(candidatePath);
    if (!(await this.fileSystem.exists(resolvedPath))) {
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

    return { ...candidate, browserPath: realBrowserPath };
  }
}

export class ArtifactPolicyDriverResolver implements BrowserDriverResolver {
  private readonly policy: ArtifactPolicy;
  private readonly catalog: ReleaseCatalog;
  private readonly now: Date;
  private readonly quarantineDays: number;
  private readonly fileSystem: BrowserLocatorFileSystem;

  constructor(options: ArtifactPolicyDriverResolverOptions) {
    this.policy = options.policy;
    this.catalog = options.catalog;
    this.now = options.now ?? new Date();
    this.quarantineDays = options.quarantineDays ?? 7;
    this.fileSystem = options.fileSystem ?? nodeFileSystem;
  }

  async resolveDriver(browser: BrowserCandidate): Promise<LocatedDriver | null> {
    const artifactName = driverArtifactNameForBrowser(browser.kind);
    const releases = await this.catalog.listReleases(artifactName);
    const release = this.policy.selectNewestEligible(releases, {
      quarantineDays: this.quarantineDays,
    }, this.now);

    if (release === null || release.path === undefined) {
      return null;
    }

    const driverPath = resolve(release.path);
    if (!(await this.fileSystem.exists(driverPath)) || !(await this.fileSystem.isExecutable(driverPath))) {
      return null;
    }

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
    } catch {
      return false;
    }
  },
  async isExecutable(path: string): Promise<boolean> {
    try {
      const fileStats = await stat(path);
      if (!fileStats.isFile()) {
        return false;
      }

      await access(path, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  },
  async realpath(path: string): Promise<string> {
    try {
      return await fsRealpath(path);
    } catch {
      return path;
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
  cause: string;
  actionHint: string;
}): BrowserNotFoundError {
  return new BrowserNotFoundError({
    message: input.message,
    actionHint: input.actionHint,
    cause: input.cause,
  });
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
    name === "brave" ||
    name === "brave.exe" ||
    name === "brave-browser"
  ) {
    return { kind: "brave", displayName: "Brave" };
  }

  if (name === "chromium" || name === "chromium-browser" || name === "chromium.exe") {
    return { kind: "chromium", displayName: "Chromium" };
  }

  if (name === "firefox" || name === "firefox.exe" || normalized.includes("firefox.app")) {
    return { kind: "firefox", displayName: "Firefox" };
  }

  return null;
}

function driverArtifactNameForBrowser(kind: BrowserKind): DriverArtifactName {
  return kind === "firefox" ? "geckodriver" : "chromedriver";
}

function defaultBrowserCandidates(platform: NodeJS.Platform): string[] {
  if (platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      "/Applications/Firefox.app/Contents/MacOS/firefox",
    ];
  }

  if (platform === "win32") {
    const roots = [
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
      process.env.LOCALAPPDATA,
    ].filter((value): value is string => value !== undefined && value !== "");

    return [
      ...roots.map((root) => join(root, "Google", "Chrome", "Application", "chrome.exe")),
      ...roots.map((root) => join(root, "Chromium", "Application", "chromium.exe")),
      ...roots.map((root) => join(root, "Microsoft", "Edge", "Application", "msedge.exe")),
      ...roots.map((root) => join(root, "BraveSoftware", "Brave-Browser", "Application", "brave.exe")),
      ...roots.map((root) => join(root, "Mozilla Firefox", "firefox.exe")),
    ];
  }

  return [
    ...pathExecutables("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "microsoft-edge-stable", "brave-browser", "firefox"),
    "/snap/firefox/current/usr/lib/firefox/firefox",
    "/usr/bin/firefox",
  ];
}

function pathExecutables(...names: string[]): string[] {
  return (process.env.PATH ?? "")
    .split(delimiter)
    .filter((path) => path !== "")
    .flatMap((path) => names.map((name) => join(path, name)));
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
