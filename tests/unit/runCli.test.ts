import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { runCli } from "../../src/runCli.js";

describe("runCli", () => {
  let originalCwd: string;
  let workspace: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    workspace = mkdtempSync(join(tmpdir(), "md2pdf-cli-"));
    process.chdir(workspace);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  });

  it("prints help and exits successfully", () => {
    const streams = createMemoryStreams();

    const exitCode = runCli(["--help"], streams);

    assert.equal(exitCode, 0);
    assert.match(streams.stdout.content, /Usage: md2pdf/);
    assert.equal(streams.stderr.content, "");
  });

  it("returns usage errors with exit code 2", () => {
    const streams = createMemoryStreams();

    const exitCode = runCli([], streams);

    assert.equal(exitCode, 2);
    assert.equal(streams.stdout.content, "");
    assert.match(streams.stderr.content, /At least one entry is required/);
  });

  it("returns conversion errors with exit code 1 after valid M1 resolution", () => {
    const streams = createMemoryStreams();
    writeFileSync(join(workspace, "notes.md"), "# Notes\n");

    const exitCode = runCli(["notes.md"], streams);

    assert.equal(exitCode, 1);
    assert.equal(streams.stdout.content, "");
    assert.match(streams.stderr.content, /not implemented yet/);
  });
});

function createMemoryStreams() {
  return {
    stdout: new MemoryWritableStream(),
    stderr: new MemoryWritableStream(),
  };
}

class MemoryWritableStream {
  content = "";

  write(chunk: string | Uint8Array): boolean {
    this.content += chunk.toString();
    return true;
  }
}
