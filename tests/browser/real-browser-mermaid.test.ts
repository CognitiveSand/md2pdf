import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { convertFile } from "../../src/converter.js";

const skipRealBrowserTests = process.env.MD2PDF_SKIP_REAL_BROWSER_TESTS === "1";
if (skipRealBrowserTests) {
  it("@req FR-24 [GATE] real browser smoke must not be skipped", () => {
    throw new Error(
      "MD2PDF_SKIP_REAL_BROWSER_TESTS=1 is set: the real browser Mermaid smoke was skipped. " +
      "This is not a valid gate result for phase 6. Remove the env var and ensure " +
      "an installed browser is available.",
    );
  });
}
const realBrowserIt = skipRealBrowserTests ? it.skip : it;

let tempRoot: string;
let previousArtifactCache: string | undefined;

beforeAll(() => {
  previousArtifactCache = process.env.MD2PDF_ARTIFACT_CACHE;
  process.env.MD2PDF_ARTIFACT_CACHE ??= path.join(
    process.cwd(),
    ".tmp",
    "md2pdf-real-browser-cache",
  );
});

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "md2pdf-real-browser-"));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

afterAll(() => {
  if (previousArtifactCache === undefined) {
    delete process.env.MD2PDF_ARTIFACT_CACHE;
    return;
  }

  process.env.MD2PDF_ARTIFACT_CACHE = previousArtifactCache;
});

describe("Stream A P3 real browser Mermaid smoke", () => {
  realBrowserIt(
    "@req FR-24 renders Mermaid in a real installed browser and produces a valid PDF",
    async () => {
      const sourcePath = path.join(tempRoot, "mermaid.md");
      const outputPath = path.join(tempRoot, "mermaid.pdf");
      const baselineSourcePath = path.join(tempRoot, "baseline.md");
      const baselineOutputPath = path.join(tempRoot, "baseline.pdf");
      const heading = "# Mermaid smoke";
      const markdown = [
        heading,
        "",
        "```mermaid",
        "flowchart TD",
        "  A[Start] --> B[Done]",
        "```",
        "",
      ].join("\n");

      await fs.writeFile(sourcePath, markdown, "utf8");
      await fs.writeFile(baselineSourcePath, `${heading}\n`, "utf8");

      await convertFile(sourcePath, outputPath, {
        renderTimeoutMs: 30_000,
      });
      await convertFile(baselineSourcePath, baselineOutputPath, {
        renderTimeoutMs: 30_000,
      });

      const pdf = await fs.readFile(outputPath);
      const baselinePdf = await fs.readFile(baselineOutputPath);
      const pdfText = pdf.toString("latin1");
      expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      // A rendered Mermaid diagram adds vector content that makes the PDF
      // substantially larger than the same document without the diagram.
      // Absolute byte bounds are browser-dependent (Chromium emits ~25 KB where
      // Firefox/cairo emits ~11 KB for this document), so compare against a
      // text-only baseline rendered by the same browser instead. Observed
      // diagram-to-baseline ratios: ~1.96x on Firefox 152, ~2.5x on Chromium.
      const MIN_DIAGRAM_TO_BASELINE_RATIO = 1.4;
      expect(pdf.byteLength).toBeGreaterThan(
        baselinePdf.byteLength * MIN_DIAGRAM_TO_BASELINE_RATIO,
      );
      expect(pdfText).not.toContain("flowchart TD");
      expect(pdfText).not.toContain("A[Start]");
    },
    90_000,
  );
});

