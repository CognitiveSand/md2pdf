import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { main, type CliIo } from "../../src/cli.js";

let tempRoot: string;
let browserPath: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "md2pdf-integration-"));
  browserPath = await createFakeBrowser(tempRoot);
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

    const exitCode = await main(["source.md"], fakeIo(stdout, stderr));

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

    const exitCode = await main(["--output", outputPath, "source.md"], fakeIo(stdout, stderr));

    expect(exitCode).toBe(0);
    await expectPdf(path.join(tempRoot, outputPath));
  });

  it("honors --output-dir for multiple jobs", async () => {
    await writeMarkdown("a.md", "# A\n");
    await writeMarkdown("b.md", "# B\n");
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(["--output-dir", "pdfs", "a.md", "b.md"], fakeIo(stdout, stderr));

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

    const exitCode = await main(["source.md"], fakeIo(stdout, stderr));

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

    const exitCode = await main(["--force-overwrite", "source.md"], fakeIo(stdout, stderr));

    expect(exitCode).toBe(0);
    await expectPdf(outputPath);
  });

  it("formats render failures with sourcePath, outputPath, and actionHint", async () => {
    await writeMarkdown("source.md", "# Fails\n");
    vi.stubEnv("MD2PDF_FAKE_BROWSER_FAIL", "1");
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(["source.md"], fakeIo(stdout, stderr));

    expect(exitCode).toBe(1);
    expect(stdout.toString()).toBe("0 succeeded, 1 failed, 0 skipped\n");
    expect(stderr.toString()).toContain("[conversion] Browser PDF renderer exited with code 7");
    expect(stderr.toString()).toContain(`source: ${path.join(tempRoot, "source.md")}`);
    expect(stderr.toString()).toContain(`output: ${path.join(tempRoot, "source.pdf")}`);
    expect(stderr.toString()).toContain("hint: Check the browser path and retry the conversion.");
  });

  it("passes MD2PDF_BROWSER to the runtime renderer", async () => {
    await writeMarkdown("source.md", "# Browser\n");
    const logPath = path.join(tempRoot, "browser.log");
    vi.stubEnv("MD2PDF_FAKE_BROWSER_LOG", logPath);
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(["source.md"], fakeIo(stdout, stderr));

    expect(exitCode).toBe(0);
    await expect(fs.readFile(logPath, "utf8")).resolves.toContain("--print-to-pdf=");
  });

  it("preserves an existing PDF when late rendering produces invalid output", async () => {
    await writeMarkdown("source.md", "# Preserve\n");
    const outputPath = path.join(tempRoot, "source.pdf");
    await fs.writeFile(outputPath, "%PDF-existing\n", "utf8");
    vi.stubEnv("MD2PDF_FAKE_BROWSER_WRITE_INVALID", "1");
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(["--force-overwrite", "source.md"], fakeIo(stdout, stderr));

    expect(exitCode).toBe(1);
    expect(stdout.toString()).toBe("0 succeeded, 1 failed, 0 skipped\n");
    expect(stderr.toString()).toContain("[conversion] Browser did not produce a valid PDF output");
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

    const exitCode = await main(["source.md"], fakeIo(stdout, stderr));

    expect(exitCode).toBe(1);
    expect(stderr.toString()).toContain("[conversion] Could not replace final PDF output");
    expect(stderr.toString()).toContain(`source: ${path.join(tempRoot, "source.md")}`);
    expect(stderr.toString()).toContain(`output: ${outputPath}`);
    expect(stderr.toString()).toContain("hint: Check the browser path and retry the conversion.");
    expect((await fs.stat(outputPath)).isDirectory()).toBe(true);
  });

  it("reports a late output parent failure with outputPath and actionHint", async () => {
    await writeMarkdown("source.md", "# Parent\n");
    const outputPath = path.join(tempRoot, "late", "source.pdf");
    vi.stubEnv("MD2PDF_FAKE_FINAL_OUTPUT", outputPath);
    vi.stubEnv("MD2PDF_FAKE_BROWSER_REPLACE_PARENT_WITH_FILE", "1");
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(["--output", outputPath, "source.md"], fakeIo(stdout, stderr));

    expect(exitCode).toBe(1);
    expect(stderr.toString()).toContain("[conversion] Browser PDF renderer exited with code");
    expect(stderr.toString()).toContain(`output: ${outputPath}`);
    expect(stderr.toString()).toContain("hint: Check the browser path and retry the conversion.");
  });
});

function fakeIo(stdout: MemoryWriter, stderr: MemoryWriter): CliIo {
  return {
    stdin: Readable.from([]),
    stdout,
    stderr,
    env: { MD2PDF_BROWSER: browserPath },
    cwd: tempRoot,
    isInteractive: false,
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

async function createFakeBrowser(root: string): Promise<string> {
  const scriptPath = path.join(root, "fake-browser.js");
  const script = [
    'import { appendFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";',
    'import { dirname } from "node:path";',
    'const args = process.argv.slice(2);',
    'if (process.env.MD2PDF_FAKE_BROWSER_LOG) {',
    '  appendFileSync(process.env.MD2PDF_FAKE_BROWSER_LOG, args.join("\\n") + "\\n");',
    '}',
    'if (process.env.MD2PDF_FAKE_BROWSER_FAIL === "1") {',
    '  console.error("fake browser failed");',
    '  process.exit(7);',
    '}',
    'const outputArg = args.find((arg) => arg.startsWith("--print-to-pdf="));',
    'if (!outputArg) {',
    '  console.error("missing --print-to-pdf");',
    '  process.exit(2);',
    '}',
    'const outputPath = outputArg.slice("--print-to-pdf=".length);',
    'const finalOutput = process.env.MD2PDF_FAKE_FINAL_OUTPUT;',
    'if (process.env.MD2PDF_FAKE_BROWSER_REPLACE_PARENT_WITH_FILE === "1" && finalOutput) {',
    '  rmSync(dirname(finalOutput), { recursive: true, force: true });',
    '  writeFileSync(dirname(finalOutput), "not a directory");',
    '}',
    'if (process.env.MD2PDF_FAKE_BROWSER_WRITE_INVALID === "1") {',
    '  writeFileSync(outputPath, "not a pdf");',
    '  process.exit(0);',
    '}',
    'writeFileSync(outputPath, "%PDF-1.7\\n1 0 obj\\n<<>>\\nendobj\\ntrailer\\n<<>>\\n%%EOF\\n");',
    'if (process.env.MD2PDF_FAKE_BROWSER_REPLACE_FINAL_WITH_DIRECTORY === "1" && finalOutput) {',
    '  rmSync(finalOutput, { recursive: true, force: true });',
    '  mkdirSync(finalOutput, { recursive: true });',
    '}',
  ].join("\n");
  await fs.writeFile(scriptPath, script, "utf8");

  if (process.platform === "win32") {
    const commandPath = path.join(root, "fake-browser.cmd");
    await fs.writeFile(
      commandPath,
      `@echo off\r\n"${process.execPath}" "${scriptPath}" %*\r\n`,
      "utf8",
    );
    return commandPath;
  }

  const commandPath = path.join(root, "fake-browser");
  await fs.writeFile(
    commandPath,
    `#!/bin/sh\nexec "${process.execPath}" "${scriptPath}" "$@"\n`,
    { encoding: "utf8", mode: 0o755 },
  );
  return commandPath;
}
