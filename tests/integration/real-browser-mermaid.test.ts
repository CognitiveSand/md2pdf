import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { locateBrowser } from "../../src/browserLocator.js";
import { convertFile } from "../../src/converter.js";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "md2pdf-real-browser-"));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("Stream A P3 real browser Mermaid smoke", () => {
  it("renders Mermaid in a real installed browser and produces a PDF", async () => {
    const browserPath = await locateBrowser(process.env.MD2PDF_BROWSER);
    const sourcePath = path.join(tempRoot, "mermaid.md");
    const outputPath = path.join(tempRoot, "mermaid.pdf");
    const markdown = [
      "# Mermaid smoke",
      "",
      "```mermaid",
      "flowchart TD",
      "  A[Start] --> B[Done]",
      "```",
      "",
    ].join("\n");

    await fs.writeFile(sourcePath, markdown, "utf8");

    await convertFile(sourcePath, outputPath, {
      browserPath,
      renderTimeoutMs: 30_000,
    });

    const pdf = await fs.readFile(outputPath);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1_000);
  });
});
