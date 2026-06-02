import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildHelpText } from "../../src/helpText.js";

describe("buildHelpText", () => {
  it("documents the M2 command surface", () => {
    const helpText = buildHelpText();

    assert.match(helpText, /Usage: md2pdf/);
    assert.match(helpText, /--output/);
    assert.match(helpText, /--output-dir/);
    assert.match(helpText, /--force-overwrite/);
    assert.match(helpText, /--help/);
  });
});
