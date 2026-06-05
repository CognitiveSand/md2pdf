import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { RenderError } from "../../../src/errors.js";
import {
  cleanupTempHtml,
  htmlPathToFileUrl,
  renderToTempHtml,
  withTempHtml,
} from "../../../src/markdownRenderer.js";

describe("markdownRenderer local harness", () => {
  it("@req NFR-02 renders Markdown to a temporary file URL loadable as file:", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "md2pdf-harness-"));

    try {
      const htmlPath = await renderToTempHtml("# Temporary", {
        sourcePath: join(tempDir, "source.md"),
        tempDir,
      });

      expect(existsSync(htmlPath)).toBe(true);
      expect(htmlPathToFileUrl(htmlPath)).toMatch(/^file:\/\//u);
      expect(readFileSync(htmlPath, "utf8")).toContain("<h1>Temporary</h1>");

      await cleanupTempHtml(htmlPath);
      expect(existsSync(dirname(htmlPath))).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("@req NFR-02 refuses to clean unmanaged paths", async () => {
    await expect(cleanupTempHtml(join(tmpdir(), "not-owned", "document.html"))).rejects.toThrow(
      RenderError,
    );
  });

  it("@req NFR-02 cleans temporary HTML after successful use", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "md2pdf-harness-"));
    let observedHtmlPath = "";

    try {
      await expect(
        withTempHtml(
          "# Done",
          { sourcePath: join(tempDir, "source.md"), tempDir },
          async (htmlPath, fileUrl) => {
            observedHtmlPath = htmlPath;
            expect(fileUrl).toBe(htmlPathToFileUrl(htmlPath));
            expect(existsSync(htmlPath)).toBe(true);
            return "ok";
          },
        ),
      ).resolves.toBe("ok");

      expect(existsSync(dirname(observedHtmlPath))).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("@req FR-16 cleans temporary HTML after callback errors", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "md2pdf-harness-"));
    let observedHtmlPath = "";

    try {
      await expect(
        withTempHtml(
          "# Error",
          { sourcePath: join(tempDir, "source.md"), tempDir },
          async (htmlPath) => {
            observedHtmlPath = htmlPath;
            throw new Error("callback failed");
          },
        ),
      ).rejects.toThrow("callback failed");

      expect(existsSync(dirname(observedHtmlPath))).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("@req FR-16 cleans temporary HTML after timeout", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "md2pdf-harness-"));
    let observedHtmlPath = "";
    let observedSignal: AbortSignal | undefined;

    try {
      await expect(
        withTempHtml(
          "# Timeout",
          { sourcePath: join(tempDir, "source.md"), tempDir },
          async (htmlPath, _fileUrl, signal) => {
            observedHtmlPath = htmlPath;
            observedSignal = signal;
            await new Promise<void>((resolve, reject) => {
              signal.addEventListener("abort", () => reject(signal.reason), { once: true });
              setTimeout(resolve, 50);
            });
          },
          1,
        ),
      ).rejects.toThrow(RenderError);

      expect(observedSignal?.aborted).toBe(true);
      expect(observedSignal?.reason).toBeInstanceOf(RenderError);
      expect(existsSync(dirname(observedHtmlPath))).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
