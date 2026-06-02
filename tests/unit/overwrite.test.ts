import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideOverwrite, isOverwriteConfirmed } from "../../src/overwrite.js";

describe("decideOverwrite", () => {
  it("writes when the output does not exist", () => {
    assert.equal(
      decideOverwrite({
        forceOverwrite: false,
        interactive: false,
        outputExists: false,
      }),
      "write",
    );
  });

  it("writes existing output when force overwrite is enabled", () => {
    assert.equal(
      decideOverwrite({
        forceOverwrite: true,
        interactive: false,
        outputExists: true,
      }),
      "write",
    );
  });

  it("prompts for existing output in interactive mode", () => {
    assert.equal(
      decideOverwrite({
        forceOverwrite: false,
        interactive: true,
        outputExists: true,
      }),
      "prompt",
    );
  });

  it("skips existing output in non-interactive mode", () => {
    assert.equal(
      decideOverwrite({
        forceOverwrite: false,
        interactive: false,
        outputExists: true,
      }),
      "skip",
    );
  });
});

describe("isOverwriteConfirmed", () => {
  it("defaults blank answers to no", () => {
    assert.equal(isOverwriteConfirmed(""), false);
    assert.equal(isOverwriteConfirmed("   "), false);
  });

  it("accepts explicit yes answers", () => {
    assert.equal(isOverwriteConfirmed("y"), true);
    assert.equal(isOverwriteConfirmed("YES"), true);
  });

  it("rejects non-yes answers", () => {
    assert.equal(isOverwriteConfirmed("n"), false);
    assert.equal(isOverwriteConfirmed("anything else"), false);
  });
});
