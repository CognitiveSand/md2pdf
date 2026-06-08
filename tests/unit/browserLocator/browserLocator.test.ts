import { describe, expect, it } from "vitest";

import { ArtifactPolicy, type ArtifactRelease } from "../../../src/artifactPolicy.js";
import {
  ArtifactPolicyDriverResolver,
  BrowserLocator,
  type BrowserCandidate,
  type BrowserLocatorFileSystem,
  type BrowserDriverResolver,
  type LocatedDriver,
} from "../../../src/browserLocator.js";
import { BrowserNotFoundError } from "../../../src/errors.js";

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

  it("@req NFR-05 reports env-browser-no-eligible-driver for a pinned browser without driver", async () => {
    const locator = new BrowserLocator({
      env: { MD2PDF_BROWSER: "/apps/Google Chrome" },
      fileSystem: fakeFileSystem({
        "/apps/Google Chrome": { executable: true },
      }),
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

  it("@req NFR-03 reports no-eligible-driver when only browsers without drivers are found", async () => {
    const locator = new BrowserLocator({
      env: {},
      candidatePaths: ["/usr/bin/firefox"],
      fileSystem: fakeFileSystem({
        "/usr/bin/firefox": { executable: true },
      }),
      driverResolver: new FakeDriverResolver(),
    });

    await expect(locator.locate()).rejects.toMatchObject({
      context: {
        cause: "no-eligible-driver",
      },
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
