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

  it("prints help and exits successfully", async () => {
    const streams = createMemoryStreams();

    const exitCode = await runCli(["--help"], streams);

    assert.equal(exitCode, 0);
    assert.match(streams.stdout.content, /Usage: md2pdf/);
    assert.equal(streams.stderr.content, "");
  });

  it("returns usage errors with exit code 2", async () => {
    const streams = createMemoryStreams();

    const exitCode = await runCli([], streams);

    assert.equal(exitCode, 2);
    assert.equal(streams.stdout.content, "");
    assert.match(streams.stderr.content, /At least one entry is required/);
  });

  it("returns conversion errors with exit code 1 after valid M2 checks", async () => {
    const streams = createMemoryStreams();
    writeFileSync(join(workspace, "notes.md"), "# Notes\n");

    const exitCode = await runCli(["notes.md"], streams);

    assert.equal(exitCode, 1);
    assert.equal(streams.stdout.content, "");
    assert.match(streams.stderr.content, /not implemented yet/);
  });

  it("reports non-interactive skips on stderr", async () => {
    const streams = createMemoryStreams();
    writeFileSync(join(workspace, "notes.md"), "# Notes\n");
    writeFileSync(join(workspace, "notes.pdf"), "original");

    const exitCode = await runCli(["notes.md"], streams);

    assert.equal(exitCode, 0);
    assert.equal(streams.stdout.content, "");
    assert.match(streams.stderr.content, /Skipped/);
    assert.match(streams.stderr.content, /Output exists/);
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
