import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCommandLine } from "../../src/commandLine.js";
import { UsageError } from "../../src/errors.js";

describe("parseCommandLine", () => {
  it("parses supported options and aliases", () => {
    const options = parseCommandLine([
      "notes.md",
      "-o",
      "out/report.pdf",
      "-f",
    ]);

    assert.deepEqual(options.entries, ["notes.md"]);
    assert.equal(options.output, "out/report.pdf");
    assert.equal(options.outputDir, undefined);
    assert.equal(options.forceOverwrite, true);
    assert.equal(options.help, false);
  });

  it("allows help without an entry", () => {
    const options = parseCommandLine(["-h"]);

    assert.equal(options.help, true);
  });

  it("requires at least one entry when help is not requested", () => {
    assert.throws(
      () => parseCommandLine([]),
      usageErrorWithMessage(/At least one entry is required/),
    );
  });

  it("rejects mutually exclusive output options", () => {
    assert.throws(
      () => parseCommandLine(["notes.md", "--output", "a.pdf", "--output-dir", "out"]),
      usageErrorWithMessage(/cannot be used together/),
    );
  });

  it("rejects --output with several entries", () => {
    assert.throws(
      () => parseCommandLine(["a.md", "b.md", "--output", "one.pdf"]),
      usageErrorWithMessage(/only be used with one input entry/),
    );
  });

  it("reports unknown options as usage errors", () => {
    assert.throws(
      () => parseCommandLine(["notes.md", "--theme", "dark"]),
      usageErrorWithMessage(/Unknown option/),
    );
  });
});

function usageErrorWithMessage(message: RegExp) {
  return (error: unknown): boolean => {
    assert.ok(error instanceof UsageError);
    assert.match(error.message, message);
    assert.equal(error.exitCode, 2);
    return true;
  };
}
