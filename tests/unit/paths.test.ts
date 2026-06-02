import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { parseCommandLine } from "../../src/commandLine.js";
import { PathError, UsageError } from "../../src/errors.js";
import { resolveConversionWorkItems } from "../../src/paths.js";

describe("resolveConversionWorkItems", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "md2pdf-paths-"));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it("places the default PDF beside the source file", () => {
    writeFile("notes.md");

    const workItems = resolveConversionWorkItems(parseCommandLine(["notes.md"]), workspace);

    assert.deepEqual(workItems, [
      {
        sourcePath: join(workspace, "notes.md"),
        outputPath: join(workspace, "notes.pdf"),
      },
    ]);
  });

  it("uses an explicit output path for one file", () => {
    writeFile("notes.md");

    const workItems = resolveConversionWorkItems(
      parseCommandLine(["notes.md", "--output", "build/report.pdf"]),
      workspace,
    );

    assert.equal(workItems[0]?.outputPath, join(workspace, "build", "report.pdf"));
  });

  it("uses an explicit output directory for several files", () => {
    writeFile("a.md");
    writeFile("b.md");

    const workItems = resolveConversionWorkItems(
      parseCommandLine(["a.md", "b.md", "--output-dir", "build"]),
      workspace,
    );

    assert.deepEqual(
      workItems.map((item) => item.outputPath),
      [join(workspace, "build", "a.pdf"), join(workspace, "build", "b.pdf")],
    );
  });

  it("expands one directory non-recursively", () => {
    mkdirSync(join(workspace, "notes"));
    mkdirSync(join(workspace, "notes", "nested"));
    writeFile("notes/a.md");
    writeFile("notes/b.txt");
    writeFile("notes/nested/c.md");

    const workItems = resolveConversionWorkItems(parseCommandLine(["notes"]), workspace);

    assert.deepEqual(
      workItems.map((item) => item.sourcePath),
      [join(workspace, "notes", "a.md")],
    );
  });

  it("rejects --output when directory expansion produces several outputs", () => {
    mkdirSync(join(workspace, "notes"));
    writeFile("notes/a.md");
    writeFile("notes/b.md");

    assert.throws(
      () =>
        resolveConversionWorkItems(
          parseCommandLine(["notes", "--output", "one.pdf"]),
          workspace,
        ),
      usageErrorWithMessage(/one PDF will be produced/),
    );
  });

  it("rejects missing entries", () => {
    assert.throws(
      () => resolveConversionWorkItems(parseCommandLine(["missing.md"]), workspace),
      pathErrorWithMessage(/does not exist/),
    );
  });

  it("rejects non-Markdown file entries", () => {
    writeFile("notes.txt");

    assert.throws(
      () => resolveConversionWorkItems(parseCommandLine(["notes.txt"]), workspace),
      pathErrorWithMessage(/not a Markdown file/),
    );
  });

  function writeFile(relativePath: string): void {
    writeFileSync(join(workspace, relativePath), "# Notes\n");
  }
});

function pathErrorWithMessage(message: RegExp) {
  return (error: unknown): boolean => {
    assert.ok(error instanceof PathError);
    assert.match(error.message, message);
    assert.equal(error.exitCode, 1);
    return true;
  };
}

function usageErrorWithMessage(message: RegExp) {
  return (error: unknown): boolean => {
    assert.ok(error instanceof UsageError);
    assert.match(error.message, message);
    assert.equal(error.exitCode, 2);
    return true;
  };
}
