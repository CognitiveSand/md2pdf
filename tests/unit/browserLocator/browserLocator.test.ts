import { describe, expect, it } from "vitest";

import { ArtifactPolicy, type ArtifactRelease } from "../../../src/artifactPolicy.js";
import {
  ArtifactPolicyDriverResolver,
  BrowserLocator,
  type BrowserCandidate,
  type BrowserLocatorFileSystem,
  type BrowserDriverResolver,
  type BrowserProbe,
  type BrowserProbeInspection,
  type FallbackBrowserResolver,
  type LocatedDriver,
  type LocatedBrowser,
} from "../../../src/browserLocator.js";
import { ArtifactFreshnessError, BrowserNotFoundError } from "../../../src/errors.js";

describe("BrowserLocator MD2PDF_BROWSER", () => {
  it("@req NFR-03 reports env-browser-not-found for a missing pinned browser", async () => {
    const locator = new BrowserLocator({
      env: { MD2PDF_BROWSER: "/missing/browser" },
      fileSystem: fakeFileSystem(),
    });

    await expect(locator.locate()).rejects.toMatchObject({
      kind: "browser",
      context: {
        cause: "env-browser-not-found",
        actionHint: expect.stringContaining("/missing/browser"),
      },
    });
  });

  it("@req NFR-03 reports env-browser-not-launchable for a non-executable pinned browser", async () => {
    const locator = new BrowserLocator({
      env: { MD2PDF_BROWSER: "/apps/firefox" },
      fileSystem: fakeFileSystem({
        "/apps/firefox": { executable: false },
      }),
    });

    await expect(locator.locate()).rejects.toMatchObject({
      context: {
        cause: "env-browser-not-launchable",
        actionHint: expect.stringContaining("/apps/firefox"),
      },
    });
  });

  it("@req NFR-03 reports env-browser-not-launchable for an unsupported pinned executable", async () => {
    const locator = new BrowserLocator({
      env: { MD2PDF_BROWSER: "/bin/not-a-browser" },
      fileSystem: fakeFileSystem({
        "/bin/not-a-browser": { executable: true },
      }),
    });

    await expect(locator.locate()).rejects.toMatchObject({
      context: {
        cause: "env-browser-not-launchable",
      },
    });
  });

  it("@req NFR-03 reports env-browser-not-launchable for a fake executable named like Chrome", async () => {
    const locator = new BrowserLocator({
      env: { MD2PDF_BROWSER: "/tmp/Google Chrome" },
      fileSystem: fakeFileSystem({
        "/tmp/Google Chrome": { executable: true },
      }),
      browserProbe: new FakeBrowserProbe(false),
    });

    await expect(locator.locate()).rejects.toMatchObject({
      context: {
        cause: "env-browser-not-launchable",
        actionHint: expect.stringContaining("/tmp/Google Chrome"),
      },
    });
  });

  it("@req NFR-05 reports env-browser-no-eligible-driver for a pinned browser without driver", async () => {
    const locator = new BrowserLocator({
      env: { MD2PDF_BROWSER: "/apps/Google Chrome" },
      fileSystem: fakeFileSystem({
        "/apps/Google Chrome": { executable: true },
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
    const locator = new BrowserLocator({
      env: { MD2PDF_BROWSER: "/apps/firefox" },
      fileSystem: fakeFileSystem({
        "/apps/firefox": { executable: true, realpath: "/snap/firefox/current/usr/lib/firefox/firefox" },
      }),
      browserProbe: new FakeBrowserProbe(),
      driverResolver: new FakeDriverResolver({
        geckodriver: { artifactName: "geckodriver", driverPath: "/drivers/geckodriver" },
      }),
    });

    await expect(locator.locate()).resolves.toMatchObject({
      browserPath: "/snap/firefox/current/usr/lib/firefox/firefox",
      kind: "firefox",
      driverPath: "/drivers/geckodriver",
      driverArtifactName: "geckodriver",
    });
  });

  it("@req NFR-03 resolves the Ubuntu snap Firefox wrapper to the real binary", async () => {
    const locator = new BrowserLocator({
      env: { MD2PDF_BROWSER: "/usr/bin/firefox" },
      fileSystem: fakeFileSystem({
        "/usr/bin/firefox": { executable: true },
        "/snap/firefox/current/usr/lib/firefox/firefox": { executable: true },
      }),
      browserProbe: new FakeBrowserProbe(),
      driverResolver: new FakeDriverResolver({
        geckodriver: { artifactName: "geckodriver", driverPath: "/drivers/geckodriver" },
      }),
    });

    await expect(locator.locate()).resolves.toMatchObject({
      browserPath: "/snap/firefox/current/usr/lib/firefox/firefox",
      kind: "firefox",
      driverArtifactName: "geckodriver",
    });
  });
});

describe("BrowserLocator installed browser scan", () => {
  it("@req NFR-03 skips missing and unsupported candidates before returning a supported browser", async () => {
    const locator = new BrowserLocator({
      env: {},
      candidatePaths: ["/missing/chrome", "/bin/not-browser", "/usr/bin/brave-browser"],
      fileSystem: fakeFileSystem({
        "/bin/not-browser": { executable: true },
        "/usr/bin/brave-browser": { executable: true },
      }),
      browserProbe: new FakeBrowserProbe(),
      driverResolver: new FakeDriverResolver({
        chromedriver: { artifactName: "chromedriver", driverPath: "/drivers/chromedriver" },
      }),
    });

    await expect(locator.locate()).resolves.toMatchObject({
      kind: "brave",
      browserPath: "/usr/bin/brave-browser",
      driverArtifactName: "chromedriver",
    });
  });

  it("@req NFR-03 inspects a launchable browser only once when version is needed", async () => {
    const browserProbe = new InspectingBrowserProbe({
      isLaunchable: true,
      version: "120.0.6099.71",
    });
    const locator = new BrowserLocator({
      env: {},
      candidatePaths: ["/usr/bin/google-chrome"],
      fileSystem: fakeFileSystem({
        "/usr/bin/google-chrome": { executable: true },
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
    const locator = new BrowserLocator({
      env: {},
      candidatePaths: ["/usr/bin/firefox"],
      fileSystem: fakeFileSystem({
        "/usr/bin/firefox": { executable: true },
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
    const locator = new BrowserLocator({
      env: {},
      candidatePaths: ["/usr/bin/firefox"],
      fileSystem: fakeFileSystem({
        "/usr/bin/firefox": { executable: true },
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
      candidatePaths: ["/missing/chrome"],
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
      candidatePaths: ["/missing/chrome"],
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
    const resolver = new ArtifactPolicyDriverResolver({
      policy: new ArtifactPolicy(),
      catalog: {
        async listReleases(artifactName: string): Promise<ArtifactRelease[]> {
          expect(artifactName).toBe("chromedriver");
          return [
            release("120.0.0", "2026-05-20T12:00:00.000Z", "/drivers/chromedriver-120"),
            release("121.0.0", "2026-06-01T12:00:00.000Z", "/drivers/chromedriver-121"),
          ];
        },
      },
      now: new Date("2026-06-04T12:00:00.000Z"),
      fileSystem: fakeFileSystem({
        "/drivers/chromedriver-120": { executable: true },
        "/drivers/chromedriver-121": { executable: true },
      }),
    });

    await expect(
      resolver.resolveDriver({
        browserPath: "/apps/Google Chrome",
        kind: "chrome",
        displayName: "Chrome",
      }),
    ).resolves.toMatchObject({
      artifactName: "chromedriver",
      driverPath: "/drivers/chromedriver-120",
      release: { version: "120.0.0" },
    });
  });

  it("@req NFR-05 selects a driver compatible with the detected Chromium major version", async () => {
    const resolver = new ArtifactPolicyDriverResolver({
      policy: new ArtifactPolicy(),
      catalog: {
        async listReleases(): Promise<ArtifactRelease[]> {
          return [
            release("120.0.0", "2026-05-20T12:00:00.000Z", "/drivers/chromedriver-120"),
            release("119.0.0", "2026-05-19T12:00:00.000Z", "/drivers/chromedriver-119"),
          ];
        },
      },
      now: new Date("2026-06-04T12:00:00.000Z"),
      fileSystem: fakeFileSystem({
        "/drivers/chromedriver-120": { executable: true },
        "/drivers/chromedriver-119": { executable: true },
      }),
    });

    await expect(
      resolver.resolveDriver({
        browserPath: "/apps/Google Chrome",
        kind: "chrome",
        displayName: "Chrome",
        version: "119.0.6045.105",
      }),
    ).resolves.toMatchObject({
      driverPath: "/drivers/chromedriver-119",
      release: { version: "119.0.0" },
    });
  });

  it("@req NFR-05 propagates malformed artifact policy errors instead of hiding them as no driver", async () => {
    const resolver = new ArtifactPolicyDriverResolver({
      policy: new ArtifactPolicy(),
      catalog: {
        async listReleases(): Promise<ArtifactRelease[]> {
          return [
            {
              ...release("120.0.0", "2026-05-20T12:00:00.000Z", "/drivers/chromedriver-120"),
              url: "latest",
            },
          ];
        },
      },
      now: new Date("2026-06-04T12:00:00.000Z"),
      fileSystem: fakeFileSystem({
        "/drivers/chromedriver-120": { executable: true },
      }),
    });

    await expect(
      resolver.resolveDriver({
        browserPath: "/apps/Google Chrome",
        kind: "chrome",
        displayName: "Chrome",
      }),
    ).rejects.toMatchObject({
      kind: "artifact",
      context: {
        cause: "invalid-artifact-manifest",
      },
    });
  });
});

interface FakeFile {
  executable: boolean;
  realpath?: string;
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
  constructor(private readonly drivers: Partial<Record<"chromedriver" | "geckodriver", LocatedDriver>> = {}) {}

  async resolveDriver(browser: BrowserCandidate): Promise<LocatedDriver | null> {
    return this.drivers[browser.kind === "firefox" ? "geckodriver" : "chromedriver"] ?? null;
  }
}

class FakeBrowserProbe implements BrowserProbe {
  constructor(private readonly launchable = true, private readonly browserVersion: string | null = null) {}

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

function release(version: string, publishedAt: string, path: string): ArtifactRelease {
  return {
    version,
    publishedAt,
    path,
    url: `https://downloads.example.invalid/${version}.zip`,
    sha256: "0".repeat(64),
    size: 42,
    provenance: "test driver catalog",
  };
}
