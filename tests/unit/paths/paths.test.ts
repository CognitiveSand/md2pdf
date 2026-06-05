import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveConversionJobs } from "../../../src/paths.js";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "md2pdf-paths-"));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("Stream A P1 path resolution", () => {
  it("@req FR-02 accepts Markdown file extensions case-insensitively", async () => {
    await writeFile("Report.MD");

    const jobs = await resolveConversionJobs(["Report.MD"], { cwd: tempRoot });

    expect(jobs).toEqual([
      {
        sourcePath: path.join(tempRoot, "Report.MD"),
        outputPath: path.join(tempRoot, "Report.pdf"),
        originEntry: "Report.MD",
      },
    ]);
  });

  it("@req FR-09 expands directories non-recursively and keeps empty directories successful", async () => {
    await writeFile("folder/a.md");
    await writeFile("folder/b.MD");
    await writeFile("folder/ignore.txt");
    await writeFile("folder/nested/c.md");
    await fs.mkdir(path.join(tempRoot, "empty"));

    const jobs = await resolveConversionJobs(["folder"], { cwd: tempRoot });
    const emptyJobs = await resolveConversionJobs(["empty"], { cwd: tempRoot });

    expect(jobs.map((job) => path.basename(job.sourcePath))).toEqual(["a.md", "b.MD"]);
    expect(jobs.map((job) => path.basename(job.outputPath))).toEqual(["a.pdf", "b.pdf"]);
    expect(emptyJobs).toEqual([]);
  });

  it("@req FR-03 uses --output verbatim and creates a missing parent directory", async () => {
    await writeFile("source.md");

    const jobs = await resolveConversionJobs(["source.md"], {
      cwd: tempRoot,
      outputPath: "out/report.custom",
    });

    expect(jobs[0]?.outputPath).toBe(path.join(tempRoot, "out", "report.custom"));
    await expect(fs.stat(path.join(tempRoot, "out"))).resolves.toMatchObject({});
  });

  it("@req FR-23 supports --output-dir for single and batch jobs", async () => {
    await writeFile("a.md");
    await writeFile("b.md");

    const jobs = await resolveConversionJobs(["a.md", "b.md"], {
      cwd: tempRoot,
      outputDir: "build",
    });

    expect(jobs.map((job) => job.outputPath)).toEqual([
      path.join(tempRoot, "build", "a.pdf"),
      path.join(tempRoot, "build", "b.pdf"),
    ]);
    await expect(fs.stat(path.join(tempRoot, "build"))).resolves.toMatchObject({});
  });

  it("@req FR-03 rejects --output unless exactly one Markdown file is resolved", async () => {
    await writeFile("a.md");
    await writeFile("b.md");

    await expect(
      resolveConversionJobs(["a.md", "b.md"], {
        cwd: tempRoot,
        outputPath: "out.pdf",
      }),
    ).rejects.toMatchObject({
      kind: "usage",
      context: {
        message: "--output requires exactly one resolved Markdown file",
      },
    });
  });

  it("@req FR-17 rejects output paths equal to the source path", async () => {
    await writeFile("source.md");

    await expect(
      resolveConversionJobs(["source.md"], {
        cwd: tempRoot,
        outputPath: "source.md",
      }),
    ).rejects.toMatchObject({
      kind: "usage",
      context: {
        message: "output path must differ from source path",
      },
    });
  });

  it("@req FR-09 rejects duplicate entries that resolve to the same output", async () => {
    await writeFile("source.md");

    await expect(resolveConversionJobs(["source.md", "source.md"], { cwd: tempRoot })).rejects.toMatchObject({
      kind: "usage",
      context: {
        message: "multiple jobs resolve to the same output path",
      },
    });
  });

  it("@req FR-23 rejects basename collisions in --output-dir before creating output parents", async () => {
    await writeFile("a/report.md");
    await writeFile("b/report.md");

    await expect(
      resolveConversionJobs(["a/report.md", "b/report.md"], {
        cwd: tempRoot,
        outputDir: "build",
      }),
    ).rejects.toMatchObject({
      kind: "usage",
      context: {
        message: "multiple jobs resolve to the same output path",
        outputPath: path.join(tempRoot, "build", "report.pdf"),
      },
    });
    await expect(fs.stat(path.join(tempRoot, "build"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});

async function writeFile(relativePath: string): Promise<void> {
  const fullPath = path.join(tempRoot, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, "# title\n", "utf8");
}
