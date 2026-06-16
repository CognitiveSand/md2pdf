import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ConversionError } from "../../../src/errors.js";
import {
  type ConvertFile,
  ConversionPipeline,
} from "../../../src/pipeline.js";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "md2pdf-pipeline-"));
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

describe("Stream A P1 conversion pipeline preflight", () => {
  it("@req FR-10 @req FR-15 records missing batch entries as failures and continues", async () => {
    await writeFile("ready.md");
    const calls: string[] = [];
    const pipeline = new ConversionPipeline(recordingConverter(calls));

    const outcomes = await pipeline.run({
      entries: ["ready.md", "missing.md"],
      cwd: tempRoot,
    });

    expect(calls).toEqual([
      `${path.join(tempRoot, "ready.md")} -> ${path.join(tempRoot, "ready.pdf")} default`,
    ]);
    expect(outcomes).toMatchObject([
      {
        sourcePath: path.join(tempRoot, "missing.md"),
        outputPath: path.join(tempRoot, "missing.pdf"),
        originEntry: "missing.md",
        status: "failed",
        error: {
          kind: "input",
          context: {
            message: "input entry was not found",
            sourcePath: path.join(tempRoot, "missing.md"),
          },
        },
      },
      {
        sourcePath: path.join(tempRoot, "ready.md"),
        outputPath: path.join(tempRoot, "ready.pdf"),
        originEntry: "ready.md",
        status: "success",
      },
    ]);
  });

  it("@req FR-09 rejects preflight output collisions before any conversion", async () => {
    await writeFile("a/report.md");
    await writeFile("b/report.md");
    const calls: string[] = [];
    const pipeline = new ConversionPipeline(recordingConverter(calls));

    await expect(
      pipeline.run({
        entries: ["a/report.md", "b/report.md"],
        cwd: tempRoot,
        outputDir: "build",
      }),
    ).rejects.toMatchObject({
      kind: "usage",
      context: {
        message: "multiple jobs resolve to the same output path",
      },
    });
    expect(calls).toEqual([]);
    await expect(fs.stat(path.join(tempRoot, "build"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("@req FR-08 converts resolved jobs with an injected fake converter", async () => {
    await writeFile("a.md");
    await writeFile("b.md");
    const calls: string[] = [];
    const pipeline = new ConversionPipeline(recordingConverter(calls));

    const outcomes = await pipeline.run({
      entries: ["a.md", "b.md"],
      cwd: tempRoot,
      convertOptions: {
        browserPath: "/browser",
        renderTimeoutMs: 1000,
      },
    });

    expect(calls).toEqual([
      `${path.join(tempRoot, "a.md")} -> ${path.join(tempRoot, "a.pdf")} /browser`,
      `${path.join(tempRoot, "b.md")} -> ${path.join(tempRoot, "b.pdf")} /browser`,
    ]);
    expect(outcomes).toEqual([
      {
        sourcePath: path.join(tempRoot, "a.md"),
        outputPath: path.join(tempRoot, "a.pdf"),
        originEntry: "a.md",
        status: "success",
      },
      {
        sourcePath: path.join(tempRoot, "b.md"),
        outputPath: path.join(tempRoot, "b.pdf"),
        originEntry: "b.md",
        status: "success",
      },
    ]);
  });

  it("@req FR-10 records converter failures as failed outcomes and continues", async () => {
    await writeFile("ok.md");
    await writeFile("bad.md");
    const pipeline = new ConversionPipeline(async (sourcePath, outputPath) => {
      if (sourcePath.endsWith(`bad${path.sep}never`)) {
        throw new Error("unreachable");
      }

      if (path.basename(sourcePath) === "bad.md") {
        throw new ConversionError({
          message: "fake render failed",
          sourcePath,
          outputPath,
        });
      }
    });

    const outcomes = await pipeline.run({
      entries: ["bad.md", "ok.md"],
      cwd: tempRoot,
    });

    expect(outcomes).toMatchObject([
      {
        sourcePath: path.join(tempRoot, "bad.md"),
        outputPath: path.join(tempRoot, "bad.pdf"),
        status: "failed",
        error: {
          kind: "conversion",
          context: {
            message: "fake render failed",
            sourcePath: path.join(tempRoot, "bad.md"),
            outputPath: path.join(tempRoot, "bad.pdf"),
          },
        },
      },
      {
        sourcePath: path.join(tempRoot, "ok.md"),
        outputPath: path.join(tempRoot, "ok.pdf"),
        status: "success",
      },
    ]);
  });

  it("@req FR-12 records non-interactive overwrite preserves as skipped outcomes", async () => {
    await writeFile("existing.md");
    await fs.writeFile(path.join(tempRoot, "existing.pdf"), "already here\n", "utf8");
    const calls: string[] = [];
    const stderr = new MemoryWriter();
    const pipeline = new ConversionPipeline(recordingConverter(calls));

    const outcomes = await pipeline.run({
      entries: ["existing.md"],
      cwd: tempRoot,
      overwrite: {
        forceOverwrite: false,
        mode: "non-interactive",
        promptIo: {
          stdin: Readable.from([]),
          stderr,
        },
      },
    });

    expect(calls).toEqual([]);
    expect(stderr.toString()).toBe(`Skipping existing output: ${path.join(tempRoot, "existing.pdf")}\n`);
    expect(outcomes).toEqual([
      {
        sourcePath: path.join(tempRoot, "existing.md"),
        outputPath: path.join(tempRoot, "existing.pdf"),
        originEntry: "existing.md",
        status: "skipped",
      },
    ]);
  });
});

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
