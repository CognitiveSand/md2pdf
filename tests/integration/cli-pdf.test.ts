import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LocatedBrowser } from "../../src/browserLocator.js";
import { main, type CliIo, type CliDependencies } from "../../src/cli.js";
import {
  createConverter,
  type BrowserLocatorLike,
  type ConverterFileSystem,
  type WebDriverSessionFactory,
} from "../../src/converter.js";
import { RenderError } from "../../src/errors.js";
import type { ConvertOptions } from "../../src/contracts.js";
import type { WebDriverPrintOptions } from "../../src/webDriverClient.js";

let tempRoot: string;
let browserPath: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "md2pdf-integration-"));
  browserPath = path.join(tempRoot, "Google Chrome");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

class MemoryWriter {
  private readonly chunks: string[] = [];

  write(chunk: string | Uint8Array): boolean {
    this.chunks.push(String(chunk));
    return true;
  }

  toString(): string {
    return this.chunks.join("");
  }
}

describe("Stream A P3 CLI PDF integration", () => {
  it("converts a single Markdown entry to a PDF through the runtime converter", async () => {
    await writeMarkdown("source.md", "# Hello\n");
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(["source.md"], fakeIo(stdout, stderr), runtimeDependencies());

    expect(exitCode).toBe(0);
    expect(stdout.toString()).toBe("1 succeeded, 0 failed, 0 skipped\n");
    expect(stderr.toString()).toBe("");
    await expectPdf(path.join(tempRoot, "source.pdf"));
  });

  it("honors --output with the requested path", async () => {
    await writeMarkdown("source.md", "# Output\n");
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();
    const outputPath = path.join("build", "custom.result");

    const exitCode = await main(
      ["--output", outputPath, "source.md"],
      fakeIo(stdout, stderr),
      runtimeDependencies(),
    );

    expect(exitCode).toBe(0);
    await expectPdf(path.join(tempRoot, outputPath));
  });

  it("honors --output-dir for multiple jobs", async () => {
    await writeMarkdown("a.md", "# A\n");
    await writeMarkdown("b.md", "# B\n");
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(
      ["--output-dir", "pdfs", "a.md", "b.md"],
      fakeIo(stdout, stderr),
      runtimeDependencies(),
    );

    expect(exitCode).toBe(0);
    expect(stdout.toString()).toBe("2 succeeded, 0 failed, 0 skipped\n");
    await expectPdf(path.join(tempRoot, "pdfs", "a.pdf"));
    await expectPdf(path.join(tempRoot, "pdfs", "b.pdf"));
  });

  it("preserves an existing PDF without --force-overwrite", async () => {
    await writeMarkdown("source.md", "# Existing\n");
    const outputPath = path.join(tempRoot, "source.pdf");
    await fs.writeFile(outputPath, "existing", "utf8");
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(["source.md"], fakeIo(stdout, stderr), runtimeDependencies());

    expect(exitCode).toBe(0);
    expect(stdout.toString()).toBe("0 succeeded, 0 failed, 1 skipped\n");
    await expect(fs.readFile(outputPath, "utf8")).resolves.toBe("existing");
  });

  it("overwrites an existing PDF with --force-overwrite", async () => {
    await writeMarkdown("source.md", "# Existing\n");
    const outputPath = path.join(tempRoot, "source.pdf");
    await fs.writeFile(outputPath, "existing", "utf8");
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(
      ["--force-overwrite", "source.md"],
      fakeIo(stdout, stderr),
      runtimeDependencies(),
    );

    expect(exitCode).toBe(0);
    await expectPdf(outputPath);
  });

  it("formats render failures with sourcePath, outputPath, and actionHint", async () => {
    await writeMarkdown("source.md", "# Fails\n");
    vi.stubEnv("MD2PDF_FAKE_RENDER_FAIL", "1");
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(["source.md"], fakeIo(stdout, stderr), runtimeDependencies());

    expect(exitCode).toBe(1);
    expect(stdout.toString()).toBe("0 succeeded, 1 failed, 0 skipped\n");
    expect(stderr.toString()).toContain("[render] WebDriver PDF rendering failed");
    expect(stderr.toString()).toContain(`source: ${path.join(tempRoot, "source.md")}`);
    expect(stderr.toString()).toContain(`output: ${path.join(tempRoot, "source.pdf")}`);
    expect(stderr.toString()).toContain("hint: Check that the browser and WebDriver are compatible.");
  });

  it("passes MD2PDF_BROWSER to the runtime renderer", async () => {
    await writeMarkdown("source.md", "# Browser\n");
    const customBrowserPath = path.join(tempRoot, "Custom Chrome");
    const logPath = path.join(tempRoot, "browser.log");
    vi.stubEnv("MD2PDF_FAKE_BROWSER_LOG", logPath);
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(
      ["source.md"],
      fakeIo(stdout, stderr, { env: { MD2PDF_BROWSER: customBrowserPath } }),
      runtimeDependencies(),
    );

    expect(exitCode).toBe(0);
    await expect(fs.readFile(logPath, "utf8")).resolves.toContain(customBrowserPath);
  });

  it("rejects Mermaid when the browser DOM dump only contains SVG text inside scripts", async () => {
    await writeMarkdown(
      "source.md",
      ["# Diagram", "", "```mermaid", "flowchart TD", "  A --> B", "```"].join("\n"),
    );
    vi.stubEnv(
      "MD2PDF_FAKE_BROWSER_DUMP_DOM",
      [
        '<html data-mermaid-status="done">',
        "<body>",
        '<main><div class="mermaid">flowchart TD A --&gt; B</div></main>',
        '<script>const falsePositive = "<svg>";</script>',
        "</body>",
        "</html>",
      ].join(""),
    );
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(["source.md"], fakeIo(stdout, stderr), runtimeDependencies());

    expect(exitCode).toBe(1);
    expect(stderr.toString()).toContain("[render] Mermaid diagram rendering failed");
    expect(stderr.toString()).toContain(`source: ${path.join(tempRoot, "source.md")}`);
  });

  it("accepts Mermaid when the rendered DOM contains an SVG in the Mermaid container", async () => {
    await writeMarkdown(
      "source.md",
      ["# Diagram", "", "```mermaid", "flowchart TD", "  A --> B", "```"].join("\n"),
    );
    vi.stubEnv(
      "MD2PDF_FAKE_BROWSER_DUMP_DOM",
      [
        '<html data-mermaid-status="done">',
        "<body>",
        '<main><div class="mermaid"><svg role="graphics-document"></svg></div></main>',
        '<script>const bundleText = "<svg>";</script>',
        "</body>",
        "</html>",
      ].join(""),
    );
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(["source.md"], fakeIo(stdout, stderr), runtimeDependencies());

    expect(exitCode).toBe(0);
    expect(stderr.toString()).toBe("");
    await expectPdf(path.join(tempRoot, "source.pdf"));
  });

  it("reports a Mermaid timeout before the temporary HTML timeout", async () => {
    await writeMarkdown(
      "source.md",
      ["# Diagram", "", "```mermaid", "flowchart TD", "  A --> B", "```"].join("\n"),
    );
    vi.stubEnv("MD2PDF_FAKE_BROWSER_HANG_DUMP_DOM", "1");
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(["source.md"], fakeIo(stdout, stderr), runtimeDependencies());

    expect(exitCode).toBe(1);
    expect(stderr.toString()).toContain(
      "[render] Timed out waiting for Mermaid diagrams to finish rendering",
    );
    expect(stderr.toString()).not.toContain("Timed out while using temporary HTML");
  });

  it("preserves an existing PDF when late rendering produces invalid output", async () => {
    await writeMarkdown("source.md", "# Preserve\n");
    const outputPath = path.join(tempRoot, "source.pdf");
    await fs.writeFile(outputPath, "%PDF-existing\n", "utf8");
    vi.stubEnv("MD2PDF_FAKE_BROWSER_WRITE_INVALID", "1");
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(
      ["--force-overwrite", "source.md"],
      fakeIo(stdout, stderr),
      runtimeDependencies(),
    );

    expect(exitCode).toBe(1);
    expect(stdout.toString()).toBe("0 succeeded, 1 failed, 0 skipped\n");
    expect(stderr.toString()).toContain("[render] WebDriver Print did not return PDF data");
    expect(stderr.toString()).toContain(`output: ${outputPath}`);
    await expect(fs.readFile(outputPath, "utf8")).resolves.toBe("%PDF-existing\n");
  });

  it("reports an output that becomes non-replaceable between preflight and commit", async () => {
    await writeMarkdown("source.md", "# Race\n");
    const outputPath = path.join(tempRoot, "source.pdf");
    vi.stubEnv("MD2PDF_FAKE_FINAL_OUTPUT", outputPath);
    vi.stubEnv("MD2PDF_FAKE_BROWSER_REPLACE_FINAL_WITH_DIRECTORY", "1");
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(["source.md"], fakeIo(stdout, stderr), runtimeDependencies());

    expect(exitCode).toBe(1);
    expect(stderr.toString()).toContain("[conversion] Failed to write rendered PDF output");
    expect(stderr.toString()).toContain(`source: ${path.join(tempRoot, "source.md")}`);
    expect(stderr.toString()).toContain(`output: ${outputPath}`);
    expect(stderr.toString()).toContain("hint: Check that the output directory is writable");
    expect((await fs.stat(outputPath)).isDirectory()).toBe(true);
  });

  it("reports a late output parent failure with outputPath and actionHint", async () => {
    await writeMarkdown("source.md", "# Parent\n");
    const outputPath = path.join(tempRoot, "late", "source.pdf");
    vi.stubEnv("MD2PDF_FAKE_FINAL_OUTPUT", outputPath);
    vi.stubEnv("MD2PDF_FAKE_BROWSER_REPLACE_PARENT_WITH_FILE", "1");
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(
      ["--output", outputPath, "source.md"],
      fakeIo(stdout, stderr),
      runtimeDependencies(),
    );

    expect(exitCode).toBe(1);
    expect(stderr.toString()).toContain("[conversion] Failed to write rendered PDF output");
    expect(stderr.toString()).toContain(`output: ${outputPath}`);
    expect(stderr.toString()).toContain("hint: Check that the output directory is writable");
  });
});

function fakeIo(
  stdout: MemoryWriter,
  stderr: MemoryWriter,
  options: { env?: NodeJS.ProcessEnv } = {},
): CliIo {
  return {
    stdin: Readable.from([]),
    stdout,
    stderr,
    env: { MD2PDF_BROWSER: browserPath, ...options.env },
    cwd: tempRoot,
    isInteractive: false,
  };
}

function runtimeDependencies(): CliDependencies {
  return {
    convertFile: createConverter({
      browserLocatorFactory: fakeLocatorFactory,
      fileSystem: fakeFileSystem(),
      printPdf: fakePrintPdf,
      tempDir: tempRoot,
      webdriverSessionFactory: fakeSessionFactory(),
    }),
  };
}

function fakeLocatorFactory(options: ConvertOptions): BrowserLocatorLike {
  return {
    async locate(): Promise<LocatedBrowser> {
      return {
        browserPath: options.browserPath ?? browserPath,
        displayName: "Test Chrome",
        driverArtifactName: "chromedriver",
        driverPath: path.join(tempRoot, "chromedriver"),
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
        transport: { async request() { throw new Error("unused fake transport"); } },
      };
    },
  };
}

async function fakePrintPdf(options: WebDriverPrintOptions): Promise<Buffer> {
  await options.driverProcess.stop();
  const html = await fs.readFile(fileURLToPath(options.htmlFileUrl), "utf8");

  if (process.env.MD2PDF_FAKE_BROWSER_LOG !== undefined) {
    await fs.appendFile(process.env.MD2PDF_FAKE_BROWSER_LOG, `${options.browser.browserPath}\n`);
  }

  if (process.env.MD2PDF_FAKE_RENDER_FAIL === "1") {
    throw new RenderError({
      message: "WebDriver PDF rendering failed",
      actionHint: "Check that the browser and WebDriver are compatible.",
      cause: "fake-render-failure",
    });
  }

  if (html.includes('class="mermaid"')) {
    if (process.env.MD2PDF_FAKE_BROWSER_HANG_DUMP_DOM === "1") {
      throw new RenderError({
        message: "Timed out waiting for Mermaid diagrams to finish rendering",
        actionHint: "Reduce diagram complexity or increase the render timeout.",
        cause: "mermaid-timeout",
      });
    }

    const renderedDom = process.env.MD2PDF_FAKE_BROWSER_DUMP_DOM ??
      '<html data-mermaid-status="done"><body><main><div class="mermaid"><svg></svg></div></main></body></html>';
    if (!/<div class="mermaid"[^>]*>\s*<svg\b/u.test(renderedDom)) {
      throw new RenderError({
        message: "Mermaid diagram rendering failed",
        actionHint: "Check the Mermaid diagram syntax in the source Markdown.",
        cause: "Mermaid diagrams were not rendered before PDF output",
      });
    }
  }

  if (process.env.MD2PDF_FAKE_BROWSER_WRITE_INVALID === "1") {
    throw new RenderError({
      message: "WebDriver Print did not return PDF data",
      actionHint: "Check that the browser supports WebDriver Print.",
      cause: "invalid-pdf",
    });
  }

  return Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n", "utf8");
}

function fakeFileSystem(): ConverterFileSystem {
  return {
    async access(filePath) {
      return fs.access(filePath);
    },
    async mkdir(filePath, options) {
      if (process.env.MD2PDF_FAKE_BROWSER_REPLACE_PARENT_WITH_FILE === "1") {
        const finalOutput = process.env.MD2PDF_FAKE_FINAL_OUTPUT;
        if (finalOutput !== undefined && filePath === path.dirname(finalOutput)) {
          await fs.rm(filePath, { recursive: true, force: true });
          await fs.writeFile(filePath, "not a directory", "utf8");
        }
      }

      return fs.mkdir(filePath, options);
    },
    async readFile(filePath, encoding) {
      return fs.readFile(filePath, encoding);
    },
    async rename(oldPath, newPath) {
      if (
        process.env.MD2PDF_FAKE_BROWSER_REPLACE_FINAL_WITH_DIRECTORY === "1" &&
        process.env.MD2PDF_FAKE_FINAL_OUTPUT === newPath
      ) {
        await fs.rm(newPath, { recursive: true, force: true });
        await fs.mkdir(newPath, { recursive: true });
      }

      return fs.rename(oldPath, newPath);
    },
    async rm(filePath, options) {
      return fs.rm(filePath, options);
    },
    async writeFile(filePath, data) {
      return fs.writeFile(filePath, data);
    },
  };
}

async function writeMarkdown(relativePath: string, markdown: string): Promise<void> {
  const fullPath = path.join(tempRoot, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, markdown, "utf8");
}

async function expectPdf(pdfPath: string): Promise<void> {
  const pdf = await fs.readFile(pdfPath);
  expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
}
