import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import type { LocatedBrowser } from "../../src/browserLocator.js";
import {
  DocumentConverter,
  type BrowserLocatorLike,
  type ConverterFileSystem,
  type WebDriverSessionFactory,
} from "../../src/converter.js";
import { RenderError } from "../../src/errors.js";
import type { ConvertOptions } from "../../src/contracts.js";

const pdfBytes = Buffer.from("%PDF-1.7\n%md2pdf test\n", "utf8");

describe("P3-8 DocumentConverter", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
    tempRoots.length = 0;
  });

  it("@req FR-01 @req FR-07 renders Markdown through local HTML and writes the PDF atomically", async () => {
    const tempRoot = await createTempRoot(tempRoots);
    const sourcePath = join(tempRoot, "doc.md");
    const outputPath = join(tempRoot, "out", "doc.pdf");
    const order: string[] = [];
    let htmlPathDuringRender = "";
    let htmlDuringRender = "";
    let driverStopped = false;

    await writeFile(sourcePath, "# Title\n\n```mermaid\ngraph TD; A-->B;\n```\n", "utf8");

    const converter = new DocumentConverter({
      browserLocatorFactory: () => fakeLocator(order),
      fileSystem: recordingFileSystem(order),
      tempDir: tempRoot,
      webdriverSessionFactory: fakeSessionFactory(order, () => {
        driverStopped = true;
      }),
      printPdf: async ({ driverProcess, htmlFileUrl }) => {
        order.push("print");
        htmlPathDuringRender = fileURLToPath(htmlFileUrl);
        htmlDuringRender = await readFile(htmlPathDuringRender, "utf8");
        await driverProcess.stop();
        return pdfBytes;
      },
    });

    await converter.convertFile(sourcePath, outputPath, { renderTimeoutMs: 1000 });

    await expect(readFile(outputPath, "utf8")).resolves.toBe(pdfBytes.toString("utf8"));
    await expect(stat(htmlPathDuringRender)).rejects.toMatchObject({ code: "ENOENT" });
    expect(htmlDuringRender).toContain("<h1>Title</h1>");
    expect(htmlDuringRender).toContain('class="mermaid"');
    expect(driverStopped).toBe(true);
    expect(order).toEqual(["read", "locate", "start", "print", "mkdir", "write", "rename"]);
  });

  it("@req NFR-01 converts without any options or config file", async () => {
    const tempRoot = await createTempRoot(tempRoots);
    const sourcePath = join(tempRoot, "doc.md");
    const outputPath = join(tempRoot, "doc.pdf");
    let driverStopped = false;

    await writeFile(sourcePath, "# Hello\n", "utf8");

    const converter = new DocumentConverter({
      browserLocatorFactory: () => fakeLocator([]),
      tempDir: tempRoot,
      webdriverSessionFactory: fakeSessionFactory([], () => { driverStopped = true; }),
      printPdf: async () => pdfBytes,
    });

    await converter.convertFile(sourcePath, outputPath);

    await expect(readFile(outputPath, "utf8")).resolves.toBe(pdfBytes.toString("utf8"));
    expect(driverStopped).toBe(true);
  });

  it("@req NFR-02 browserLocatorFactory does not receive Markdown source content", async () => {
    const tempRoot = await createTempRoot(tempRoots);
    const sourcePath = join(tempRoot, "private.md");
    const outputPath = join(tempRoot, "private.pdf");
    const markdownContent = "# Private\n\nSensitive source content that must not reach provisioning.\n";
    let capturedOptions: ConvertOptions | undefined;

    await writeFile(sourcePath, markdownContent, "utf8");

    const converter = new DocumentConverter({
      browserLocatorFactory: (options) => {
        capturedOptions = options;
        return fakeLocator([]);
      },
      tempDir: tempRoot,
      webdriverSessionFactory: fakeSessionFactory([]),
      printPdf: async () => pdfBytes,
    });

    await converter.convertFile(sourcePath, outputPath);

    expect(capturedOptions).toBeDefined();
    const serialized = JSON.stringify(capturedOptions);
    expect(serialized).not.toContain("Private");
    expect(serialized).not.toContain("Sensitive source content");
  });

  it("@req FR-16 stops the driver process when the render timeout fires", async () => {
    const tempRoot = await createTempRoot(tempRoots);
    const sourcePath = join(tempRoot, "doc.md");
    const outputPath = join(tempRoot, "out.pdf");
    let driverStopped = false;

    await writeFile(sourcePath, "# Test\n", "utf8");

    const converter = new DocumentConverter({
      browserLocatorFactory: () => fakeLocator([]),
      tempDir: tempRoot,
      webdriverSessionFactory: fakeSessionFactory([], () => { driverStopped = true; }),
      printPdf: () => new Promise<never>(() => undefined),
    });

    await expect(
      converter.convertFile(sourcePath, outputPath, { renderTimeoutMs: 50 }),
    ).rejects.toMatchObject({ kind: "render" });

    expect(driverStopped).toBe(true);
  });

  it("@req FR-16 stops the driver process when timeout fires during session start", async () => {
    const tempRoot = await createTempRoot(tempRoots);
    const sourcePath = join(tempRoot, "doc.md");
    const outputPath = join(tempRoot, "out.pdf");
    let driverStopped = false;
    let printCalled = false;
    let resolveStart!: () => void;
    const startGate = new Promise<void>((resolve) => { resolveStart = resolve; });

    await writeFile(sourcePath, "# Test\n", "utf8");

    const converter = new DocumentConverter({
      browserLocatorFactory: () => fakeLocator([]),
      tempDir: tempRoot,
      webdriverSessionFactory: {
        async start() {
          await startGate;
          return {
            driverProcess: { async stop() { driverStopped = true; } },
            transport: { async request() { throw new Error("unused"); } },
          };
        },
      },
      printPdf: async () => {
        printCalled = true;
        return pdfBytes;
      },
    });

    // Schedule start() completion after the timeout fires — no gap before handler attachment
    setTimeout(() => resolveStart(), 100);

    await expect(
      converter.convertFile(sourcePath, outputPath, { renderTimeoutMs: 50 }),
    ).rejects.toMatchObject({ kind: "render" });

    // Wait for the delayed start() to complete and the post-start cleanup to run
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    expect(driverStopped).toBe(true);
    expect(printCalled).toBe(false);
  });

  it("@req FR-24 keeps existing output untouched and removes temporary PDF files when rendering fails", async () => {
    const tempRoot = await createTempRoot(tempRoots);
    const sourcePath = join(tempRoot, "broken.md");
    const outputPath = join(tempRoot, "broken.pdf");

    await writeFile(sourcePath, "# Broken\n", "utf8");
    await writeFile(outputPath, "previous pdf", "utf8");

    const converter = new DocumentConverter({
      browserLocatorFactory: () => fakeLocator([]),
      tempDir: tempRoot,
      webdriverSessionFactory: fakeSessionFactory([]),
      printPdf: async () => {
        throw new RenderError("render failed");
      },
    });

    await expect(converter.convertFile(sourcePath, outputPath)).rejects.toMatchObject({
      kind: "render",
    });

    await expect(readFile(outputPath, "utf8")).resolves.toBe("previous pdf");
    await expect(readdir(tempRoot)).resolves.not.toContain(expect.stringContaining(".broken.pdf."));
  });
});

async function createTempRoot(tempRoots: string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "md2pdf-converter-test-"));
  tempRoots.push(root);
  return root;
}

function fakeLocator(order: string[]): BrowserLocatorLike {
  return {
    async locate(): Promise<LocatedBrowser> {
      order.push("locate");
      return {
        browserPath: "/test/browser",
        displayName: "Test Chrome",
        driverArtifactName: "chromedriver",
        driverPath: "/test/chromedriver",
        kind: "chrome",
        version: "120.0.0",
      };
    },
  };
}

function fakeSessionFactory(
  order: string[],
  onStop: () => void = () => undefined,
): WebDriverSessionFactory {
  return {
    async start() {
      order.push("start");
      return {
        driverProcess: {
          async stop() {
            onStop();
          },
        },
        transport: {
          async request() {
            throw new Error("Fake transport should not be called by this test");
          },
        },
      };
    },
  };
}

function recordingFileSystem(order: string[]): ConverterFileSystem {
  return {
    async mkdir(path, options) {
      order.push("mkdir");
      const fs = await import("node:fs/promises");
      return fs.mkdir(path, options);
    },
    async readFile(path, encoding) {
      order.push("read");
      return readFile(path, encoding);
    },
    async rename(oldPath, newPath) {
      order.push("rename");
      const fs = await import("node:fs/promises");
      return fs.rename(oldPath, newPath);
    },
    async rm(path, options) {
      const fs = await import("node:fs/promises");
      return fs.rm(path, options);
    },
    async writeFile(path, data) {
      order.push("write");
      const fs = await import("node:fs/promises");
      return fs.writeFile(path, data);
    },
  };
}
