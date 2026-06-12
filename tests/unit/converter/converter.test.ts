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
import { ConversionError, RenderError } from "../../../src/errors.js";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "md2pdf-converter-"));
});

afterEach(async () => {
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
    const convertFile = createConverter();

    await expect(convertFile(sourcePath, outputPath)).rejects.toMatchObject({
      kind: "conversion",
      context: {
        message: "Markdown source could not be read during conversion",
        sourcePath,
        outputPath,
      },
    });
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
