import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { LocatedBrowser } from "../../../src/browserLocator.js";
import {
  createConverter,
  type BrowserLocatorLike,
  type WebDriverSessionFactory,
} from "../../../src/converter.js";
import { RenderError } from "../../../src/errors.js";

let tempRoot: string;
let tempHomeRoot: string | undefined;
const originalPlatform = process.platform;
const originalHome = process.env.HOME;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "md2pdf-converter-"));
});

afterEach(async () => {
  Object.defineProperty(process, "platform", {
    value: originalPlatform,
  });
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
  if (tempHomeRoot !== undefined) {
    await fs.rm(tempHomeRoot, { recursive: true, force: true });
    tempHomeRoot = undefined;
  }
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("Stream A P3 runtime converter boundary", () => {
  it("renders Markdown to temporary HTML before calling the PDF renderer", async () => {
    const sourcePath = path.join(tempRoot, "source.md");
    const outputPath = path.join(tempRoot, "source.pdf");
    const calls: string[] = [];
    await fs.writeFile(sourcePath, "# Runtime\n", "utf8");

    const convertFile = createConverter({
      browserLocatorFactory: (options) => fakeLocator(options.browserPath ?? "/browser"),
      webdriverSessionFactory: fakeSessionFactory(),
      printPdf: async ({ browser, htmlFileUrl, driverProcess }) => {
        const htmlPath = fileURLToPath(htmlFileUrl);
        const html = await fs.readFile(htmlPath, "utf8");
        await driverProcess.stop();
        calls.push([
          html.includes("<h1>Runtime</h1>") ? "html" : "missing-html",
          htmlFileUrl.startsWith("file://") ? "file-url" : "missing-file-url",
          browser.browserPath,
        ].join("|"));

        return Buffer.from("%PDF-1.7\n", "utf8");
      },
    });

    await expect(
      convertFile(sourcePath, outputPath, {
        browserPath: "/browser",
        renderTimeoutMs: 5000,
      }),
    ).resolves.toBeUndefined();

    expect(calls).toEqual(["html|file-url|/browser"]);
    await expect(fs.readFile(outputPath, "utf8")).resolves.toBe("%PDF-1.7\n");
  });

  it("preserves Markdown render failures from the runtime path", async () => {
    const sourcePath = path.join(tempRoot, "source.md");
    const outputPath = path.join(tempRoot, "source.pdf");
    const convertFile = createConverter({
      browserLocatorFactory: () => fakeLocator("/browser"),
      webdriverSessionFactory: fakeSessionFactory(),
      printPdf: async () => {
        throw new Error("should not render PDF");
      },
    });
    await fs.writeFile(sourcePath, "![missing](./missing.png)\n", "utf8");

    await expect(convertFile(sourcePath, outputPath)).rejects.toBeInstanceOf(RenderError);
  });

  it("reports source read failures as conversion errors with both paths", async () => {
    const sourcePath = path.join(tempRoot, "missing.md");
    const outputPath = path.join(tempRoot, "missing.pdf");
    const convertFile = createConverter({
      browserLocatorFactory: () => fakeLocator("/browser"),
    });

    await expect(convertFile(sourcePath, outputPath)).rejects.toMatchObject({
      kind: "conversion",
      context: {
        message: "Markdown source does not exist or is not accessible",
        sourcePath,
        outputPath,
      },
    });
  });

  it("@req NFR-02 reports a missing source without entering browser provisioning", async () => {
    const sourcePath = path.join(tempRoot, "missing.md");
    const outputPath = path.join(tempRoot, "missing.pdf");
    let locatorCalled = false;
    const convertFile = createConverter({
      browserLocatorFactory: () => ({
        async locate() {
          locatorCalled = true;
          throw new Error("browser provisioning should not run for a missing source");
        },
      }),
    });

    await expect(convertFile(sourcePath, outputPath)).rejects.toMatchObject({
      kind: "conversion",
      context: {
        message: "Markdown source does not exist or is not accessible",
        sourcePath,
        outputPath,
      },
    });
    expect(locatorCalled).toBe(false);
  });

  it("@req NFR-08 writes the temporary HTML under $HOME for a snap browser", async () => {
    Object.defineProperty(process, "platform", {
      value: "linux",
    });
    tempHomeRoot = await fs.mkdtemp(path.join(process.cwd(), "md2pdf-test-home-"));
    process.env.HOME = tempHomeRoot;
    const sourcePath = path.join(tempRoot, "snap.md");
    const outputPath = path.join(tempRoot, "snap.pdf");
    await fs.writeFile(sourcePath, "# Snap\n", "utf8");
    let htmlPath = "";

    const convertFile = createConverter({
      browserLocatorFactory: () => ({
        async locate(): Promise<LocatedBrowser> {
          return {
            browserPath: "/snap/firefox/current/usr/lib/firefox/firefox",
            displayName: "Firefox",
            driverArtifactName: "geckodriver",
            driverPath: "/snap/bin/geckodriver",
            kind: "firefox",
          };
        },
      }),
      webdriverSessionFactory: fakeSessionFactory(),
      printPdf: async ({ htmlFileUrl, driverProcess }) => {
        htmlPath = fileURLToPath(htmlFileUrl);
        await driverProcess.stop();
        return Buffer.from("%PDF-1.7\n", "utf8");
      },
    });

    await expect(
      convertFile(sourcePath, outputPath, { renderTimeoutMs: 5000 }),
    ).resolves.toBeUndefined();

    const homeTemp = path.join(os.homedir(), "md2pdf-tmp");
    expect(htmlPath.startsWith(homeTemp)).toBe(true);
    expect(htmlPath.startsWith(os.tmpdir())).toBe(false);
    // withTempHtml removes the per-run dir; drop the now-empty root (only if empty).
    await fs.rmdir(homeTemp).catch(() => {});
  });

  it("@req NFR-08 falls back to the provisioned browser when the installed browser cannot render", async () => {
    const sourcePath = path.join(tempRoot, "fallback.md");
    const outputPath = path.join(tempRoot, "fallback.pdf");
    await fs.writeFile(sourcePath, "# Fallback\n", "utf8");

    const installed: LocatedBrowser = {
      browserPath: "/installed/firefox",
      displayName: "Firefox",
      driverArtifactName: "geckodriver",
      driverPath: "/installed/geckodriver",
      kind: "firefox",
    };
    const fallback: LocatedBrowser = {
      browserPath: "/cache/chrome",
      displayName: "Chromium",
      driverArtifactName: "chromedriver",
      driverPath: "/cache/chromedriver",
      kind: "chromium",
      provisioned: true,
    };
    const used: string[] = [];

    const convertFile = createConverter({
      browserLocatorFactory: () => ({
        async locate(): Promise<LocatedBrowser> {
          return installed;
        },
        async locateProvisionedFallbackBrowser(): Promise<LocatedBrowser | null> {
          return fallback;
        },
      }),
      webdriverSessionFactory: fakeSessionFactory(),
      printPdf: async ({ browser, driverProcess }) => {
        await driverProcess.stop();
        used.push(browser.browserPath);
        if (browser.browserPath === installed.browserPath) {
          throw new RenderError({ message: "installed browser failed", actionHint: "n/a", cause: "test" });
        }

        return Buffer.from("%PDF-1.7\n", "utf8");
      },
    });

    await expect(
      convertFile(sourcePath, outputPath, { renderTimeoutMs: 5000 }),
    ).resolves.toBeUndefined();
    expect(used).toEqual(["/installed/firefox", "/cache/chrome"]);
    await expect(fs.readFile(outputPath, "utf8")).resolves.toBe("%PDF-1.7\n");
  });

  it("@req NFR-08 does not retry when the provisioned browser itself fails", async () => {
    const sourcePath = path.join(tempRoot, "provisioned.md");
    const outputPath = path.join(tempRoot, "provisioned.pdf");
    await fs.writeFile(sourcePath, "# Provisioned\n", "utf8");

    let fallbackCalls = 0;
    const convertFile = createConverter({
      browserLocatorFactory: () => ({
        async locate(): Promise<LocatedBrowser> {
          return {
            browserPath: "/cache/chrome",
            displayName: "Chromium",
            driverArtifactName: "chromedriver",
            driverPath: "/cache/chromedriver",
            kind: "chromium",
            provisioned: true,
          };
        },
        async locateProvisionedFallbackBrowser(): Promise<LocatedBrowser | null> {
          fallbackCalls += 1;
          return null;
        },
      }),
      webdriverSessionFactory: fakeSessionFactory(),
      printPdf: async ({ driverProcess }) => {
        await driverProcess.stop();
        throw new RenderError({ message: "provisioned browser failed", actionHint: "n/a", cause: "test" });
      },
    });

    await expect(
      convertFile(sourcePath, outputPath, { renderTimeoutMs: 5000 }),
    ).rejects.toBeInstanceOf(RenderError);
    expect(fallbackCalls).toBe(0);
  });
});

function fakeLocator(browserPath: string): BrowserLocatorLike {
  return {
    async locate(): Promise<LocatedBrowser> {
      return {
        browserPath,
        displayName: "Test Chrome",
        driverArtifactName: "chromedriver",
        driverPath: "/drivers/chromedriver",
        kind: "chrome",
        version: "120.0.0",
      };
    },
  };
}

function fakeSessionFactory(): WebDriverSessionFactory {
  return {
    async start() {
      return {
        driverProcess: { async stop() {} },
        transport: { async request() { throw new Error("unused transport"); } },
      };
    },
  };
}
