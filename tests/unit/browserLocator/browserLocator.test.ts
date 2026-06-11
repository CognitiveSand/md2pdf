import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArtifactPolicy, type ArtifactRelease } from "../../../src/artifactPolicy.js";
import {
  ArtifactPolicyDriverResolver,
  BrowserLocator,
  locateBrowser,
  type BrowserCandidate,
  type BrowserDriverResolver,
  type BrowserLocatorFileSystem,
  type BrowserProbe,
  type BrowserProbeInspection,
  type FallbackBrowserResolver,
  type LocatedBrowser,
  type LocatedDriver,
} from "../../../src/browserLocator.js";
import { ArtifactFreshnessError, BrowserNotFoundError } from "../../../src/errors.js";

const itOnPosix = process.platform === "win32" ? it.skip : it;
const itOnWindows = process.platform === "win32" ? it : it.skip;

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "md2pdf-browser-locator-"));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("locateBrowser compatibility wrapper", () => {
  itOnPosix("rejects an explicit POSIX browser path without execute permission", async () => {
    const browserPath = path.join(tempRoot, "browser");
    await fs.writeFile(browserPath, "#!/bin/sh\nexit 0\n", { encoding: "utf8", mode: 0o644 });

    await expect(locateBrowser(browserPath)).rejects.toMatchObject({
      kind: "browser",
      context: {
        cause: browserPath,
      },
    });
    await expect(locateBrowser(browserPath)).rejects.toBeInstanceOf(BrowserNotFoundError);
  });

  itOnPosix("accepts an explicit POSIX browser path with execute permission", async () => {
    const browserPath = path.join(tempRoot, "browser");
    await fs.writeFile(browserPath, "#!/bin/sh\nexit 0\n", { encoding: "utf8", mode: 0o755 });

    await expect(locateBrowser(browserPath)).resolves.toBe(browserPath);
  });

  itOnWindows("detects Brave from standard Chromium-family install paths", async () => {
    const programFiles = path.join(tempRoot, "Program Files");
    const programFilesX86 = path.join(tempRoot, "Program Files (x86)");
    const localAppData = path.join(tempRoot, "LocalAppData");
    const bravePath = path.join(
      programFiles,
      "BraveSoftware",
      "Brave-Browser",
      "Application",
      "brave.exe",
    );
    await fs.mkdir(path.dirname(bravePath), { recursive: true });
    await fs.writeFile(bravePath, "", "utf8");
    vi.stubEnv("ProgramFiles", programFiles);
    vi.stubEnv("ProgramFiles(x86)", programFilesX86);
    vi.stubEnv("LOCALAPPDATA", localAppData);
    vi.stubEnv("PATH", "");

    await expect(locateBrowser()).resolves.toBe(bravePath);
  });
});

describe("BrowserLocator MD2PDF_BROWSER", () => {
  it("@req NFR-03 reports env-browser-not-found for a missing pinned browser", async () => {
    const browserPath = absoluteTestPath("missing", "browser");
    const locator = new BrowserLocator({
      env: { MD2PDF_BROWSER: browserPath },
      fileSystem: fakeFileSystem(),
    });

    await expect(locator.locate()).rejects.toMatchObject({
      kind: "browser",
      context: {
        cause: "env-browser-not-found",
        actionHint: expect.stringContaining(browserPath),
      },
    });
  });

  it("@req NFR-03 reports env-browser-not-launchable for a non-executable pinned browser", async () => {
    const browserPath = absoluteTestPath("apps", "firefox");
    const locator = new BrowserLocator({
      env: { MD2PDF_BROWSER: browserPath },
      fileSystem: fakeFileSystem({
        [browserPath]: { executable: false },
      }),
    });

    await expect(locator.locate()).rejects.toMatchObject({
      context: {
        cause: "env-browser-not-launchable",
        actionHint: expect.stringContaining(browserPath),
      },
    });
  });

  it("@req NFR-03 reports env-browser-not-launchable for an unsupported pinned executable", async () => {
    const browserPath = absoluteTestPath("bin", "not-a-browser");
    const locator = new BrowserLocator({
      env: { MD2PDF_BROWSER: browserPath },
      fileSystem: fakeFileSystem({
        [browserPath]: { executable: true },
      }),
    });

    await expect(locator.locate()).rejects.toMatchObject({
      context: {
        cause: "env-browser-not-launchable",
      },
    });
  });

  it("@req NFR-03 reports env-browser-not-launchable for a fake executable named like Chrome", async () => {
    const browserPath = absoluteTestPath("tmp", "Google Chrome");
    const locator = new BrowserLocator({
      env: { MD2PDF_BROWSER: browserPath },
      fileSystem: fakeFileSystem({
        [browserPath]: { executable: true },
      }),
      browserProbe: new FakeBrowserProbe(false),
    });

    await expect(locator.locate()).rejects.toMatchObject({
      context: {
        cause: "env-browser-not-launchable",
        actionHint: expect.stringContaining(browserPath),
      },
    });
  });

  it("@req NFR-05 reports env-browser-no-eligible-driver for a pinned browser without driver", async () => {
    const browserPath = absoluteTestPath("apps", "Google Chrome");
    const locator = new BrowserLocator({
      env: { MD2PDF_BROWSER: browserPath },
      fileSystem: fakeFileSystem({
        [browserPath]: { executable: true },
      }),
      browserProbe: new FakeBrowserProbe(),
      driverResolver: new FakeDriverResolver(),
    });

    await expect(locator.locate()).rejects.toMatchObject({
      context: {
        cause: "env-browser-no-eligible-driver",
      },
    });
  });

  it("@req NFR-05 returns a pinned browser with an eligible driver", async () => {
    const browserPath = absoluteTestPath("apps", "firefox");
    const realBrowserPath = "/snap/firefox/current/usr/lib/firefox/firefox";
    const locator = new BrowserLocator({
      env: { MD2PDF_BROWSER: browserPath },
      fileSystem: fakeFileSystem({
        [browserPath]: { executable: true, realpath: realBrowserPath },
        [realBrowserPath]: { executable: true },
      }),
      browserProbe: new FakeBrowserProbe(),
      driverResolver: new FakeDriverResolver({
        geckodriver: { artifactName: "geckodriver", driverPath: "/drivers/geckodriver" },
      }),
    });

    await expect(locator.locate()).resolves.toMatchObject({
      browserPath: realBrowserPath,
      kind: "firefox",
      driverPath: "/drivers/geckodriver",
      driverArtifactName: "geckodriver",
    });
  });

  it("@req NFR-03 resolves the Ubuntu snap Firefox wrapper to the real binary", async () => {
    const browserPath = absoluteTestPath("usr", "bin", "firefox");
    const snapWrapper = "/usr/bin/firefox";
    const snapBrowser = "/snap/firefox/current/usr/lib/firefox/firefox";
    const locator = new BrowserLocator({
      env: { MD2PDF_BROWSER: browserPath },
      fileSystem: fakeFileSystem({
        [browserPath]: { executable: true, realpath: snapWrapper },
        [snapBrowser]: { executable: true },
      }),
      browserProbe: new FakeBrowserProbe(),
      driverResolver: new FakeDriverResolver({
        geckodriver: { artifactName: "geckodriver", driverPath: "/drivers/geckodriver" },
      }),
    });

    await expect(locator.locate()).resolves.toMatchObject({
      browserPath: snapBrowser,
      kind: "firefox",
      driverArtifactName: "geckodriver",
    });
  });
});

describe("BrowserLocator installed browser scan", () => {
  it("@req NFR-03 skips missing and unsupported candidates before returning a supported browser", async () => {
    const missingBrowser = absoluteTestPath("missing", "chrome");
    const unsupportedBrowser = absoluteTestPath("bin", "not-browser");
    const braveBrowser = absoluteTestPath("usr", "bin", "brave-browser");
    const locator = new BrowserLocator({
      env: {},
      candidatePaths: [missingBrowser, unsupportedBrowser, braveBrowser],
      fileSystem: fakeFileSystem({
        [unsupportedBrowser]: { executable: true },
        [braveBrowser]: { executable: true },
      }),
      browserProbe: new FakeBrowserProbe(),
      driverResolver: new FakeDriverResolver({
        chromedriver: { artifactName: "chromedriver", driverPath: "/drivers/chromedriver" },
      }),
    });

    await expect(locator.locate()).resolves.toMatchObject({
      kind: "brave",
      browserPath: braveBrowser,
      driverArtifactName: "chromedriver",
    });
  });

  it("@req NFR-03 inspects a launchable browser only once when version is needed", async () => {
    const chromePath = absoluteTestPath("usr", "bin", "google-chrome");
    const browserProbe = new InspectingBrowserProbe({
      isLaunchable: true,
      version: "120.0.6099.71",
    });
    const locator = new BrowserLocator({
      env: {},
      candidatePaths: [chromePath],
      fileSystem: fakeFileSystem({
        [chromePath]: { executable: true },
      }),
      browserProbe,
      driverResolver: new FakeDriverResolver({
        chromedriver: { artifactName: "chromedriver", driverPath: "/drivers/chromedriver" },
      }),
    });

    await expect(locator.locate()).resolves.toMatchObject({
      version: "120.0.6099.71",
    });
    expect(browserProbe.inspections).toBe(1);
  });

  it("@req NFR-03 reports no-eligible-driver when only browsers without drivers are found", async () => {
    const firefoxPath = absoluteTestPath("usr", "bin", "firefox");
    const locator = new BrowserLocator({
      env: {},
      candidatePaths: [firefoxPath],
      fileSystem: fakeFileSystem({
        [firefoxPath]: { executable: true },
      }),
      browserProbe: new FakeBrowserProbe(),
      driverResolver: new FakeDriverResolver(),
    });

    await expect(locator.locate()).rejects.toMatchObject({
      context: {
        cause: "no-eligible-driver",
      },
    });
  });

  it("@req NFR-05 tries the fallback browser when installed browsers have no eligible driver", async () => {
    const firefoxPath = absoluteTestPath("usr", "bin", "firefox");
    const locator = new BrowserLocator({
      env: {},
      candidatePaths: [firefoxPath],
      fileSystem: fakeFileSystem({
        [firefoxPath]: { executable: true },
      }),
      browserProbe: new FakeBrowserProbe(),
      driverResolver: new FakeDriverResolver(),
      fallbackBrowserResolver: new SuccessfulFallbackBrowserResolver(),
    });

    await expect(locator.locate()).resolves.toMatchObject({
      browserPath: "/fallback/chromium",
      driverPath: "/fallback/chromedriver",
      driverArtifactName: "chromedriver",
    });
  });

  it("@req NFR-03 reports supported browser guidance when no browser is found", async () => {
    const locator = new BrowserLocator({
      env: {},
      candidatePaths: [absoluteTestPath("missing", "chrome")],
      fileSystem: fakeFileSystem(),
    });

    await expect(locator.locate()).rejects.toThrow(BrowserNotFoundError);
    await expect(locator.locate()).rejects.toMatchObject({
      context: {
        cause: "no-compatible-browser",
        actionHint: expect.stringContaining("Chrome, Chromium, Edge, Brave, Firefox"),
      },
    });
  });

  it("@req NFR-05 reports fallback artifact causes when no installed browser is available", async () => {
    const locator = new BrowserLocator({
      env: {},
      candidatePaths: [absoluteTestPath("missing", "chrome")],
      fileSystem: fakeFileSystem(),
      fallbackBrowserResolver: new FailingFallbackBrowserResolver(),
    });

    await expect(locator.locate()).rejects.toMatchObject({
      kind: "browser",
      context: {
        cause: expect.any(ArtifactFreshnessError),
        actionHint: expect.stringContaining("eligible fallback browser artifact"),
      },
    });
  });
});

describe("ArtifactPolicyDriverResolver", () => {
  it("@req NFR-05 selects an eligible declared driver through ArtifactPolicy", async () => {
    const driver120Path = absoluteTestPath("drivers", "chromedriver-120");
    const driver121Path = absoluteTestPath("drivers", "chromedriver-121");
    const resolver = new ArtifactPolicyDriverResolver({
      policy: new ArtifactPolicy(),
      catalog: {
        async listReleases(artifactName: string): Promise<ArtifactRelease[]> {
          expect(artifactName).toBe("chromedriver");
          return [
            release("120.0.0", "2026-05-20T12:00:00.000Z", driver120Path),
            release("121.0.0", "2026-06-01T12:00:00.000Z", driver121Path),
          ];
        },
      },
      now: new Date("2026-06-04T12:00:00.000Z"),
      fileSystem: fakeFileSystem({
        [driver120Path]: { executable: true },
        [driver121Path]: { executable: true },
      }),
    });

    await expect(
      resolver.resolveDriver({
        browserPath: absoluteTestPath("apps", "Google Chrome"),
        kind: "chrome",
        displayName: "Chrome",
      }),
    ).resolves.toMatchObject({
      artifactName: "chromedriver",
      driverPath: driver120Path,
      release: { version: "120.0.0" },
    });
  });

  it("@req NFR-05 selects a driver compatible with the detected Chromium major version", async () => {
    const driver119Path = absoluteTestPath("drivers", "chromedriver-119");
    const driver120Path = absoluteTestPath("drivers", "chromedriver-120");
    const resolver = new ArtifactPolicyDriverResolver({
      policy: new ArtifactPolicy(),
      catalog: {
        async listReleases(): Promise<ArtifactRelease[]> {
          return [
            release("120.0.0", "2026-05-20T12:00:00.000Z", driver120Path),
            release("119.0.0", "2026-05-19T12:00:00.000Z", driver119Path),
          ];
        },
      },
      now: new Date("2026-06-04T12:00:00.000Z"),
      fileSystem: fakeFileSystem({
        [driver119Path]: { executable: true },
        [driver120Path]: { executable: true },
      }),
    });

    await expect(
      resolver.resolveDriver({
        browserPath: absoluteTestPath("apps", "Google Chrome"),
        kind: "chrome",
        displayName: "Chrome",
        version: "119.0.6045.105",
      }),
    ).resolves.toMatchObject({
      driverPath: driver119Path,
      release: { version: "119.0.0" },
    });
  });

  it("@req NFR-05 returns null when no eligible declared driver exists", async () => {
    const resolver = new ArtifactPolicyDriverResolver({
      policy: new ArtifactPolicy(),
      catalog: {
        async listReleases(): Promise<ArtifactRelease[]> {
          return [release("120.0.0", "2026-06-03T12:00:00.000Z", "/drivers/chromedriver-120")];
        },
      },
      now: new Date("2026-06-04T12:00:00.000Z"),
      fileSystem: fakeFileSystem(),
    });

    await expect(
      resolver.resolveDriver({
        browserPath: absoluteTestPath("apps", "Google Chrome"),
        kind: "chrome",
        displayName: "Chrome",
      }),
    ).resolves.toBeNull();
  });

  it("@req NFR-05 returns null when the selected driver path is not executable", async () => {
    const driverPath = absoluteTestPath("drivers", "chromedriver-120");
    const resolver = new ArtifactPolicyDriverResolver({
      policy: new ArtifactPolicy(),
      catalog: {
        async listReleases(): Promise<ArtifactRelease[]> {
          return [release("120.0.0", "2026-05-20T12:00:00.000Z", driverPath)];
        },
      },
      now: new Date("2026-06-04T12:00:00.000Z"),
      fileSystem: fakeFileSystem({
        [driverPath]: { executable: false },
      }),
    });

    await expect(
      resolver.resolveDriver({
        browserPath: absoluteTestPath("apps", "Google Chrome"),
        kind: "chrome",
        displayName: "Chrome",
      }),
    ).resolves.toBeNull();
  });
});

interface FakeFile {
  executable: boolean;
  realpath?: string;
}

function absoluteTestPath(...segments: string[]): string {
  return path.resolve(path.parse(process.cwd()).root, ...segments);
}

function fakeFileSystem(files: Record<string, FakeFile> = {}): BrowserLocatorFileSystem {
  return {
    async exists(path: string): Promise<boolean> {
      return files[path] !== undefined;
    },
    async isExecutable(path: string): Promise<boolean> {
      return files[path]?.executable ?? false;
    },
    async realpath(path: string): Promise<string> {
      return files[path]?.realpath ?? path;
    },
  };
}

class FakeDriverResolver implements BrowserDriverResolver {
  constructor(
    private readonly drivers: Partial<Record<"chromedriver" | "geckodriver", LocatedDriver>> = {},
  ) {}

  async resolveDriver(browser: BrowserCandidate): Promise<LocatedDriver | null> {
    return this.drivers[browser.kind === "firefox" ? "geckodriver" : "chromedriver"] ?? null;
  }
}

class FakeBrowserProbe implements BrowserProbe {
  constructor(
    private readonly launchable = true,
    private readonly browserVersion: string | null = null,
  ) {}

  async isLaunchable(): Promise<boolean> {
    return this.launchable;
  }

  async version(): Promise<string | null> {
    return this.browserVersion;
  }
}

class InspectingBrowserProbe implements BrowserProbe {
  inspections = 0;

  constructor(private readonly inspection: BrowserProbeInspection) {}

  async inspect(): Promise<BrowserProbeInspection> {
    this.inspections += 1;
    return this.inspection;
  }

  async isLaunchable(): Promise<boolean> {
    throw new Error("inspect should be used instead of separate launch probing");
  }
}

class FailingFallbackBrowserResolver implements FallbackBrowserResolver {
  async resolveFallbackBrowser(): Promise<never> {
    throw new ArtifactFreshnessError({
      message: "No eligible fallback",
      artifactName: "chromium-for-testing",
      cause: "no-eligible-release",
    });
  }
}

class SuccessfulFallbackBrowserResolver implements FallbackBrowserResolver {
  async resolveFallbackBrowser(): Promise<LocatedBrowser> {
    return {
      browserPath: "/fallback/chromium",
      kind: "chromium",
      displayName: "Chromium",
      driverPath: "/fallback/chromedriver",
      driverArtifactName: "chromedriver",
    };
  }
}

function release(version: string, publishedAt: string, driverPath: string): ArtifactRelease {
  return {
    version,
    publishedAt,
    path: driverPath,
    url: `https://downloads.example.invalid/${version}.zip`,
    sha256: "0".repeat(64),
    size: 42,
    provenance: "test driver catalog",
  };
}
