import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConversionJob } from "../../../src/contracts.js";
import {
  decideOverwriteAction,
  evaluateOverwrite,
  isAffirmativeOverwriteResponse,
} from "../../../src/overwrite.js";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "md2pdf-overwrite-"));
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

describe("Stream A P2 overwrite policy", () => {
  it("@req FR-13 returns continue when the output does not exist", () => {
    expect(
      decideOverwriteAction({
        outputExists: false,
        mode: "interactive",
        forceOverwrite: false,
      }),
    ).toBe("continue");
    expect(
      decideOverwriteAction({
        outputExists: false,
        mode: "non-interactive",
        forceOverwrite: true,
      }),
    ).toBe("continue");
  });

  it("@req FR-13 gives --force-overwrite priority when the output exists", () => {
    expect(
      decideOverwriteAction({
        outputExists: true,
        mode: "interactive",
        forceOverwrite: true,
      }),
    ).toBe("overwrite");
    expect(
      decideOverwriteAction({
        outputExists: true,
        mode: "non-interactive",
        forceOverwrite: true,
      }),
    ).toBe("overwrite");
  });

  it("@req FR-12 prompts interactively and skips non-interactively when the output exists", () => {
    expect(
      decideOverwriteAction({
        outputExists: true,
        mode: "interactive",
        forceOverwrite: false,
      }),
    ).toBe("prompt");
    expect(
      decideOverwriteAction({
        outputExists: true,
        mode: "non-interactive",
        forceOverwrite: false,
      }),
    ).toBe("skip");
  });

  it("@req FR-12 accepts only y and yes as affirmative prompt answers", () => {
    expect(isAffirmativeOverwriteResponse("y")).toBe(true);
    expect(isAffirmativeOverwriteResponse(" yes ")).toBe(true);
    expect(isAffirmativeOverwriteResponse("n")).toBe(false);
    expect(isAffirmativeOverwriteResponse("no")).toBe(false);
    expect(isAffirmativeOverwriteResponse("")).toBe(false);
    expect(isAffirmativeOverwriteResponse(undefined)).toBe(false);
    expect(isAffirmativeOverwriteResponse("sure")).toBe(false);
  });

  it("@req FR-12 skips an existing output in non-interactive mode and reports stderr", async () => {
    const job = await existingOutputJob();
    const stderr = new MemoryWriter();

    await expect(
      evaluateOverwrite(job, {
        mode: "non-interactive",
        forceOverwrite: false,
        promptIo: {
          stdin: Readable.from([]),
          stderr,
        },
      }),
    ).resolves.toEqual({ shouldConvert: false });
    expect(stderr.toString()).toBe(`Skipping existing output: ${job.outputPath}\n`);
  });

  it("@req FR-14 treats an existing directory entry such as a dangling symlink as existing", async () => {
    const job = await missingOutputJob();
    const stderr = new MemoryWriter();
    const lstat = vi
      .spyOn(fs, "lstat")
      .mockResolvedValue({} as Awaited<ReturnType<typeof fs.lstat>>);

    try {
      await expect(
        evaluateOverwrite(job, {
          mode: "non-interactive",
          forceOverwrite: false,
          promptIo: {
            stdin: Readable.from([]),
            stderr,
          },
        }),
      ).resolves.toEqual({ shouldConvert: false });
      expect(lstat).toHaveBeenCalledWith(job.outputPath);
    } finally {
      lstat.mockRestore();
    }

    expect(stderr.toString()).toBe(`Skipping existing output: ${job.outputPath}\n`);
  });

  it("@req FR-12 keeps an existing output on EOF during an interactive prompt", async () => {
    const job = await existingOutputJob();
    const stderr = new MemoryWriter();

    await expect(
      evaluateOverwrite(job, {
        mode: "interactive",
        forceOverwrite: false,
        promptIo: {
          stdin: Readable.from([]),
          stderr,
        },
      }),
    ).resolves.toEqual({ shouldConvert: false });
    expect(stderr.toString()).toBe(
      `Overwrite existing output ${job.outputPath}? [y/N] \nSkipping existing output: ${job.outputPath}\n`,
    );
  });

  it("@req FR-13 allows conversion when an interactive prompt receives yes", async () => {
    const job = await existingOutputJob();
    const stderr = new MemoryWriter();

    await expect(
      evaluateOverwrite(job, {
        mode: "interactive",
        forceOverwrite: false,
        promptIo: {
          stdin: Readable.from(["yes\n"]),
          stderr,
        },
      }),
    ).resolves.toEqual({ shouldConvert: true });
    expect(stderr.toString()).toBe(`Overwrite existing output ${job.outputPath}? [y/N] `);
  });

  it("reports an existing output that cannot be replaced", async () => {
    const job = await existingOutputJob();
    const access = vi.spyOn(fs, "access").mockRejectedValue(
      Object.assign(new Error("permission denied"), { code: "EACCES" }),
    );

    try {
      await expect(
        evaluateOverwrite(job, {
          mode: "non-interactive",
          forceOverwrite: true,
          promptIo: {
            stdin: Readable.from([]),
            stderr: new MemoryWriter(),
          },
        }),
      ).rejects.toMatchObject({
        kind: "conversion",
        context: {
          message: "existing output is not replaceable",
          outputPath: job.outputPath,
          actionHint: "check output file permissions or choose a different output path",
        },
      });
    } finally {
      access.mockRestore();
    }
  });

  it("rejects an existing output directory as not replaceable", async () => {
    const job = await existingOutputDirectoryJob();

    await expect(
      evaluateOverwrite(job, {
        mode: "non-interactive",
        forceOverwrite: true,
        promptIo: {
          stdin: Readable.from([]),
          stderr: new MemoryWriter(),
        },
      }),
    ).rejects.toMatchObject({
      kind: "conversion",
      context: {
        message: "existing output is not replaceable",
        outputPath: job.outputPath,
        actionHint: "check output file permissions or choose a different output path",
      },
    });
  });

  it("rejects an existing output directory after interactive confirmation", async () => {
    const job = await existingOutputDirectoryJob();
    const stderr = new MemoryWriter();

    await expect(
      evaluateOverwrite(job, {
        mode: "interactive",
        forceOverwrite: false,
        promptIo: {
          stdin: Readable.from(["yes\n"]),
          stderr,
        },
      }),
    ).rejects.toMatchObject({
      kind: "conversion",
      context: {
        message: "existing output is not replaceable",
        outputPath: job.outputPath,
      },
    });
    expect(stderr.toString()).toBe(`Overwrite existing output ${job.outputPath}? [y/N] `);
  });

  it("wraps output inspection failures with output path and action hint", async () => {
    const job = await missingOutputJob();
    const lstat = vi.spyOn(fs, "lstat").mockRejectedValue(
      Object.assign(new Error("permission denied"), { code: "EACCES" }),
    );

    try {
      await expect(
        evaluateOverwrite(job, {
          mode: "non-interactive",
          forceOverwrite: false,
          promptIo: {
            stdin: Readable.from([]),
            stderr: new MemoryWriter(),
          },
        }),
      ).rejects.toMatchObject({
        kind: "conversion",
        context: {
          message: "could not inspect output path",
          outputPath: job.outputPath,
          actionHint: "check output path permissions before rerunning md2pdf",
        },
      });
    } finally {
      lstat.mockRestore();
    }
  });
});

async function missingOutputJob(): Promise<ConversionJob> {
  const sourcePath = path.join(tempRoot, "source.md");
  const outputPath = path.join(tempRoot, "source.pdf");
  await fs.writeFile(sourcePath, "# title\n", "utf8");

  return {
    sourcePath,
    outputPath,
    originEntry: "source.md",
  };
}

async function existingOutputJob(): Promise<ConversionJob> {
  const sourcePath = path.join(tempRoot, "source.md");
  const outputPath = path.join(tempRoot, "source.pdf");
  await fs.writeFile(sourcePath, "# title\n", "utf8");
  await fs.writeFile(outputPath, "existing pdf\n", "utf8");

  return {
    sourcePath,
    outputPath,
    originEntry: "source.md",
  };
}

async function existingOutputDirectoryJob(): Promise<ConversionJob> {
  const sourcePath = path.join(tempRoot, "source.md");
  const outputPath = path.join(tempRoot, "source.pdf");
  await fs.writeFile(sourcePath, "# title\n", "utf8");
  await fs.mkdir(outputPath);

  return {
    sourcePath,
    outputPath,
    originEntry: "source.md",
  };
}
