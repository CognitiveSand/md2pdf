import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runCli } from "../../src/runCli.js";

describe("runCli", () => {
  it("prints help and exits successfully", () => {
    const streams = createMemoryStreams();

    const exitCode = runCli(["--help"], streams);

    assert.equal(exitCode, 0);
    assert.match(streams.stdout.content, /Usage: md2pdf/);
    assert.equal(streams.stderr.content, "");
  });

  it("keeps conversion unavailable during M0", () => {
    const streams = createMemoryStreams();

    const exitCode = runCli(["notes.md"], streams);

    assert.equal(exitCode, 2);
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
