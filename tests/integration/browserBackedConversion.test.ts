import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DocumentConverter } from "../../src/converter.js";

const skipRealBrowserTests = process.env.MD2PDF_SKIP_REAL_BROWSER_TESTS === "1";
const realBrowserIt = skipRealBrowserTests ? it.skip : it;

describe("P3 browser-backed conversion", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
    tempRoots.length = 0;
  });

  realBrowserIt(
    "@req FR-01 @req FR-07 @req FR-24 @req NFR-02 renders Mermaid to a real PDF with a pre-provisioned browser",
    async () => {
      const tempRoot = await mkdtemp(join(tmpdir(), "md2pdf-real-browser-"));
      tempRoots.push(tempRoot);
      const sourcePath = join(tempRoot, "diagram.md");
      const outputPath = join(tempRoot, "diagram.pdf");

      await writeFile(
        sourcePath,
        [
          "# Real browser proof",
          "",
          "Before.",
          "",
          "| Left | Right |",
          "| --- | --- |",
          "| A | B |",
          "",
          "- [x] done",
          "",
          "```ts",
          "const answer: number = 42;",
          "```",
          "",
          "```mermaid",
          "flowchart TD",
          "  A[Start] --> B[Finish]",
          "```",
          "",
          "Footnote call.[^one]",
          "",
          "[^one]: Footnote body.",
          "",
          "After.",
        ].join("\n"),
        "utf8",
      );

      const converter = new DocumentConverter({
        tempDir: tempRoot,
      });

      await converter.convertFile(sourcePath, outputPath, {
        renderTimeoutMs: Number(process.env.MD2PDF_BROWSER_TEST_TIMEOUT_MS ?? 30_000),
      });

      const pdf = await readFile(outputPath);
      expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      expect(pdf.byteLength).toBeGreaterThan(1_000);

      const pdfText = pdf.toString("latin1");
      expect(pdfText).not.toContain("flowchart TD");
      expect(pdfText).not.toContain("A[Start] --> B[Finish]");
      expect(pdfContainsVisualObject(pdfText)).toBe(true);
    },
    60_000,
  );

  realBrowserIt(
    "@req FR-04 @req FR-05 @req FR-06 renders rich Markdown and a relative image to a real PDF",
    async () => {
      const tempRoot = await mkdtemp(join(tmpdir(), "md2pdf-real-browser-"));
      tempRoots.push(tempRoot);
      const sourcePath = join(tempRoot, "rich.md");
      const outputPath = join(tempRoot, "rich.pdf");
      const imagePath = join(tempRoot, "pixel.png");

      await writeFile(imagePath, tinyPng());
      await writeFile(
        sourcePath,
        [
          "# Rich Markdown proof",
          "",
          "| Left | Right |",
          "| --- | --- |",
          "| A | B |",
          "",
          "- [x] done",
          "",
          "```ts",
          "const answer: number = 42;",
          "```",
          "",
          "![pixel](./pixel.png)",
          "",
          "Footnote call.[^one]",
          "",
          "[^one]: Footnote body.",
        ].join("\n"),
        "utf8",
      );

      const converter = new DocumentConverter({
        tempDir: tempRoot,
      });

      await converter.convertFile(sourcePath, outputPath, {
        renderTimeoutMs: Number(process.env.MD2PDF_BROWSER_TEST_TIMEOUT_MS ?? 30_000),
      });

      const pdf = await readFile(outputPath);
      const pdfText = pdf.toString("latin1");
      expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      expect(pdf.byteLength).toBeGreaterThan(1_000);
      expect(pdfContainsVisualObject(pdfText)).toBe(true);
      // FR-04: rich Markdown elements present in PDF text layer
      expect(pdfText).toContain("Left");
      expect(pdfText).toContain("Right");
      expect(pdfText).toContain("done");
      expect(pdfText).toContain("Footnote body");
    },
    60_000,
  );
});

function pdfContainsVisualObject(pdfText: string): boolean {
  return /\/XObject\b/u.test(pdfText) ||
    /\/Subtype\s*\/Image\b/u.test(pdfText) ||
    /\/Subtype\s*\/Form\b/u.test(pdfText);
}

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  );
}
