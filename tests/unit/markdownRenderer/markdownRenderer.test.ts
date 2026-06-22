import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { RenderError } from "../../../src/errors.js";
import { renderToHtml } from "../../../src/markdownRenderer.js";
import { tinyJpeg, tinyPng, tinyWebp } from "../../fixtures/imageFixtures.js";

describe("markdownRenderer renderToHtml", () => {
  it("@req FR-04 renders CommonMark with tables, task lists, and footnotes", () => {
    const html = renderToHtml(
      [
        "# Title",
        "",
        "| Left | Right |",
        "| --- | --- |",
        "| A | B |",
        "",
        "- [x] done",
        "- [ ] todo",
        "",
        "Footnote call.[^one]",
        "",
        "[^one]: Footnote body.",
      ].join("\n"),
      context(),
    );

    expect(html).toContain("<table>");
    expect(html).toContain('class="contains-task-list"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('class="footnotes"');
  });

  it("@req FR-05 highlights non-Mermaid fenced code locally", () => {
    const html = renderToHtml(
      ["```ts", "const answer: number = 42;", "```"].join("\n"),
      context(),
    );

    expect(html).toContain('data-md2pdf-asset="highlight.css"');
    expect(html).toContain('class="hljs');
    expect(html).toContain("hljs-keyword");
    expect(html).toContain("answer");
  });

  it("@req FR-07 inlines heading page-break protection", () => {
    const html = renderToHtml("# Heading\n\nBody", context());

    expect(html).toContain("break-after: avoid-page");
  });

  it("@req FR-24 leaves Mermaid blocks as browser-renderable local HTML", () => {
    const html = renderToHtml(
      ["```mermaid", "flowchart TD", "  A --> B", "```"].join("\n"),
      context(),
    );

    expect(html).toContain('class="mermaid"');
    expect(html).toContain('data-md2pdf-asset="mermaid.min.js"');
    expect(html).toContain('data-md2pdf-asset="mermaid-runner"');
    expect(html).toContain("flowchart TD");
    expect(html).not.toContain("<pre><code class=\"language-mermaid\"");
  });

  it("@req FR-24 marks documents without Mermaid as already rendered", () => {
    const html = renderToHtml("# No diagrams here", context());

    expect(html).toContain('data-mermaid-status="done"');
    expect(html).not.toContain('data-md2pdf-asset="mermaid-runner"');
  });

  it("@req FR-06 embeds relative images as data URIs", () => {
    const dir = mkdtempSync(join(tmpdir(), "md2pdf-markdown-renderer-"));
    try {
      writeFileSync(join(dir, "pixel.png"), tinyPng());

      const html = renderToHtml("![pixel](./pixel.png)", {
        sourcePath: join(dir, "source.md"),
      });

      expect(html).toContain('src="data:image/png;base64,');
      expect(html).toContain('alt="pixel"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("@req FR-06 embeds local raster image fixtures as data URIs", () => {
    const dir = mkdtempSync(join(tmpdir(), "md2pdf-markdown-renderer-"));
    try {
      writeFileSync(join(dir, "pixel.png"), tinyPng());
      writeFileSync(join(dir, "pixel.jpg"), tinyJpeg());
      writeFileSync(join(dir, "pixel.webp"), tinyWebp());

      const html = renderToHtml(
        [
          "![png](./pixel.png)",
          "![jpeg](./pixel.jpg)",
          "![webp](./pixel.webp)",
        ].join("\n"),
        {
          sourcePath: join(dir, "source.md"),
        },
      );

      expect(html).toContain('src="data:image/png;base64,');
      expect(html).toContain('src="data:image/jpeg;base64,');
      expect(html).toContain('src="data:image/webp;base64,');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("@req FR-06 allows relative images under an explicit baseDir", () => {
    const dir = mkdtempSync(join(tmpdir(), "md2pdf-markdown-renderer-"));
    const imageDir = join(dir, "assets");
    const sourceDir = join(dir, "docs");

    try {
      mkdirSync(imageDir);
      writeFileSync(join(imageDir, "pixel.png"), tinyPng());

      const html = renderToHtml("![pixel](../assets/pixel.png)", {
        sourcePath: join(sourceDir, "source.md"),
        baseDir: dir,
      });

      expect(html).toContain('src="data:image/png;base64,');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("@req FR-16 reports unreadable relative images with source path and hint", () => {
    const dir = mkdtempSync(join(tmpdir(), "md2pdf-markdown-renderer-"));
    const sourcePath = join(dir, "source.md");

    try {
      expect(() => renderToHtml("![missing](./missing.png)", { sourcePath })).toThrowError(
        RenderError,
      );

      try {
        renderToHtml("![missing](./missing.png)", { sourcePath });
      } catch (error) {
        expect(error).toMatchObject({
          context: {
            sourcePath,
            actionHint: expect.stringContaining("missing.png"),
          },
        });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("@req NFR-02 emits no exploitable external resource URLs", () => {
    const html = renderToHtml(
      [
        "[remote](https://example.invalid/page)",
        "",
        "https://example.invalid/plain-text",
      ].join("\n"),
      context(),
    );

    expect(html).not.toMatch(/<a\b[^>]*\bhref=["']https?:/iu);
    expect(html).not.toMatch(/<img\b[^>]*\bsrc=["']https?:/iu);
    expect(html).not.toMatch(/<script\b[^>]*\bsrc=/iu);
    expect(html).not.toMatch(/<link\b[^>]*\bhref=/iu);
    expect(html).toContain("img-src data:");
    expect(html).not.toContain("img-src data: file:");
    expect(html).toContain("remote");
    expect(html).toContain("https://example.invalid/plain-text");
  });

  it("@req NFR-02 rejects remote image URLs", () => {
    expect(() =>
      renderToHtml("![remote](https://example.invalid/image.png)", context()),
    ).toThrowError(RenderError);
  });

  it("@req FR-06 @req NFR-02 rejects file URL and absolute image paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "md2pdf-markdown-renderer-"));
    const imagePath = join(dir, "pixel.png");

    try {
      writeFileSync(imagePath, tinyPng());

      expect(() =>
        renderToHtml(`![file-url](${pathToFileURL(imagePath).href})`, {
          sourcePath: join(dir, "source.md"),
        }),
      ).toThrowError(RenderError);

      expect(() =>
        renderToHtml(`![absolute](${imagePath})`, {
          sourcePath: join(dir, "source.md"),
        }),
      ).toThrowError(RenderError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("@req FR-06 @req NFR-02 rejects relative image traversal outside baseDir", () => {
    const dir = mkdtempSync(join(tmpdir(), "md2pdf-markdown-renderer-"));

    try {
      writeFileSync(join(dir, "outside.png"), tinyPng());

      expect(() =>
        renderToHtml("![outside](../outside.png)", {
          sourcePath: join(dir, "docs", "source.md"),
        }),
      ).toThrowError(RenderError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function context(): { sourcePath: string } {
  return { sourcePath: "/tmp/source.md" };
}
