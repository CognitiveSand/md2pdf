import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  HELP_TEXT,
  type CliIo,
  main,
  parseCommandLine,
} from "../../../src/cli.js";
import { ConversionError } from "../../../src/errors.js";
import { type ConvertFile } from "../../../src/pipeline.js";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "md2pdf-cli-"));
});

afterEach(async () => {
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

describe("Stream A P1 CLI", () => {
  it("@req NFR-04 prints one help line for each supported option", async () => {
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(["--help"], fakeIo(stdout, stderr));

    expect(exitCode).toBe(0);
    expect(stdout.toString()).toBe(`${HELP_TEXT}\n`);
    expect(stdout.toString()).toContain("md2pdf [OPTIONS] ENTRY [ENTRY ...]");
    expect(stdout.toString()).toContain("-o, --output PATH");
    expect(stdout.toString()).toContain("    --output-dir DIR");
    expect(stdout.toString()).toContain("-f, --force-overwrite");
    expect(stdout.toString()).toContain("-h, --help");
    expect(stderr.toString()).toBe("");
  });

  it("@req FR-17 returns exit 2 for missing entries and formats via formatError", async () => {
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main([], fakeIo(stdout, stderr));

    expect(exitCode).toBe(2);
    expect(stdout.toString()).toBe("");
    expect(stderr.toString()).toBe(
      ["[usage] missing ENTRY", "hint: run md2pdf --help"].join("\n") + "\n",
    );
  });

  it("@req FR-17 returns exit 2 for unknown options and keeps stderr structured", async () => {
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(["--unknown", "doc.md"], fakeIo(stdout, stderr));

    expect(exitCode).toBe(2);
    expect(stdout.toString()).toBe("");
    expect(stderr.toString()).toContain("[usage]");
    expect(stderr.toString()).toContain("Unknown option '--unknown'");
    expect(stderr.toString()).toContain("hint: run md2pdf --help");
  });

  it("@req FR-03 @req FR-13 parses entries, aliases, and injected environment", () => {
    expect(
      parseCommandLine(["-f", "-o", "out.custom", "doc.md"], {
        MD2PDF_BROWSER: "/browser",
      }),
    ).toEqual({
      entries: ["doc.md"],
      outputPath: "out.custom",
      outputDir: undefined,
      forceOverwrite: true,
      help: false,
      browserPath: "/browser",
    });
  });

  it("@req FR-17 rejects mutually exclusive output location options as usage", async () => {
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    const exitCode = await main(
      ["--output", "single.pdf", "--output-dir", "build", "doc.md"],
      fakeIo(stdout, stderr),
    );

    expect(exitCode).toBe(2);
    expect(stderr.toString()).toBe(
      [
        "[usage] --output and --output-dir cannot be used together",
        "hint: choose exactly one output location option",
      ].join("\n") + "\n",
    );
  });

  it("@req FR-03 @req FR-11 @req FR-18 runs a valid single-file command and prints the summary", async () => {
    await writeFile("source.MD");
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();
    const calls: string[] = [];

    const exitCode = await main(
      ["--output", "out/report.custom", "source.MD"],
      fakeIo(stdout, stderr, tempRoot),
      { convertFile: recordingConverter(calls) },
    );

    expect(exitCode).toBe(0);
    expect(calls).toEqual([
      `${path.join(tempRoot, "source.MD")} -> ${path.join(tempRoot, "out", "report.custom")} default`,
    ]);
    expect(stdout.toString()).toBe("1 succeeded, 0 failed, 0 skipped\n");
    expect(stderr.toString()).toBe("");
  });

  it("@req FR-09 @req FR-11 keeps an empty Markdown directory successful", async () => {
    await fs.mkdir(path.join(tempRoot, "empty"));
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();
    const calls: string[] = [];

    const exitCode = await main(
      ["empty"],
      fakeIo(stdout, stderr, tempRoot),
      { convertFile: recordingConverter(calls) },
    );

    expect(exitCode).toBe(0);
    expect(calls).toEqual([]);
    expect(stdout.toString()).toBe("0 succeeded, 0 failed, 0 skipped\n");
    expect(stderr.toString()).toBe("");
  });

  it("@req FR-09 @req FR-17 returns exit 2 for preflight output collisions from the CLI", async () => {
    await writeFile("a/report.md");
    await writeFile("b/report.md");
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();
    const calls: string[] = [];

    const exitCode = await main(
      ["--output-dir", "build", "a/report.md", "b/report.md"],
      fakeIo(stdout, stderr, tempRoot),
      { convertFile: recordingConverter(calls) },
    );

    expect(exitCode).toBe(2);
    expect(calls).toEqual([]);
    expect(stdout.toString()).toBe("");
    expect(stderr.toString()).toContain("[usage] multiple jobs resolve to the same output path");
    expect(stderr.toString()).toContain(`output: ${path.join(tempRoot, "build", "report.pdf")}`);
    await expect(fs.stat(path.join(tempRoot, "build"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("@req FR-10 @req FR-18 returns exit 1 when one batch conversion fails and continues", async () => {
    await writeFile("bad.md");
    await writeFile("ok.md");
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();
    const calls: string[] = [];

    const exitCode = await main(
      ["bad.md", "ok.md"],
      fakeIo(stdout, stderr, tempRoot),
      {
        convertFile: async (sourcePath, outputPath) => {
          calls.push(`${path.basename(sourcePath)} -> ${path.basename(outputPath)}`);

          if (path.basename(sourcePath) === "bad.md") {
            throw new ConversionError({
              message: "fake render failed",
              sourcePath,
              outputPath,
            });
          }
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(calls).toEqual(["bad.md -> bad.pdf", "ok.md -> ok.pdf"]);
    expect(stdout.toString()).toBe("1 succeeded, 1 failed, 0 skipped\n");
    expect(stderr.toString()).toContain("[conversion] fake render failed");
    expect(stderr.toString()).toContain(`source: ${path.join(tempRoot, "bad.md")}`);
    expect(stderr.toString()).toContain(`output: ${path.join(tempRoot, "bad.pdf")}`);
  });
});

function fakeIo(stdout: MemoryWriter, stderr: MemoryWriter, cwd = "/work"): CliIo {
  return {
    stdin: Readable.from([]),
    stdout,
    stderr,
    env: {},
    cwd,
    isInteractive: false,
  };
}

function recordingConverter(calls: string[]): ConvertFile {
  return async (sourcePath, outputPath, options) => {
    calls.push(`${sourcePath} -> ${outputPath} ${options?.browserPath ?? "default"}`);
  };
}

async function writeFile(relativePath: string): Promise<void> {
  const fullPath = path.join(tempRoot, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, "# title\n", "utf8");
}
