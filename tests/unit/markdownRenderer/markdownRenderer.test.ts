import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { RenderError } from "../../../src/errors.js";
import { renderToHtml } from "../../../src/markdownRenderer.js";
import {
  deceptiveImageBytes,
  syntheticOversizedImageBytes,
  tinyJpeg,
  tinyPng,
  tinyWebp,
} from "../../fixtures/imageFixtures.js";

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

  it("@req NFR-02 rejects oversized Markdown before parsing", () => {
    expectRenderError("a".repeat(10 * 1024 * 1024 + 1), (error) => {
      expect(error.message).toContain("Markdown document is too large");
      expect(error.context.actionHint).toContain("Simplify the document");
    });
  });

  it("@req NFR-02 rejects oversized Markdown lines before parsing", () => {
    expectRenderError(`short\n${"a".repeat(1024 * 1024 + 1)}`, (error) => {
      expect(error.message).toContain("line that is too large");
      expect(error.context.actionHint).toContain("Simplify the document");
    });
  });

  it("@req NFR-02 rejects oversized highlighted code fences", () => {
    const largeCode = Array.from({ length: 1025 }, () => "a".repeat(1024)).join("\n");
    const markdown = ["```ts", largeCode, "```"].join("\n");

    expectRenderError(markdown, (error) => {
      expect(error.message).toContain("Code fence is too large");
      expect(error.context.actionHint).toContain("Simplify the document");
    });
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

  it("@req FR-24 @req NFR-02 rejects too many Mermaid blocks", () => {
    const markdown = Array.from({ length: 51 }, (_, index) =>
      ["```mermaid", `flowchart TD`, `  A${index} --> B${index}`, "```"].join("\n"),
    ).join("\n\n");

    expectRenderError(markdown, (error) => {
      expect(error.message).toContain("too many Mermaid blocks");
      expect(error.context.actionHint).toContain("Simplify the document");
    });
  });

  it("@req FR-24 @req NFR-02 rejects oversized Mermaid blocks", () => {
    const markdown = ["```mermaid", "a".repeat(256 * 1024 + 1), "```"].join("\n");

    expectRenderError(markdown, (error) => {
      expect(error.message).toContain("Mermaid block is too large");
      expect(error.context.actionHint).toContain("Simplify the document");
    });
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

  it("@req FR-06 accepts normal images in the source directory and subdirectories", () => {
    const dir = mkdtempSync(join(tmpdir(), "md2pdf-markdown-renderer-"));
    const imageDir = join(dir, "images");

    try {
      mkdirSync(imageDir);
      writeFileSync(join(dir, "pixel.png"), tinyPng());
      writeFileSync(join(imageDir, "nested.png"), tinyPng());

      const html = renderToHtml(["![root](./pixel.png)", "![nested](./images/nested.png)"].join("\n"), {
        sourcePath: join(dir, "source.md"),
      });

      expect(html).toContain('alt="root"');
      expect(html).toContain('alt="nested"');
      expect(html.match(/src="data:image\/png;base64,/gu)).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("@req FR-06 @req NFR-02 rejects more than 100 Markdown images", () => {
    const dir = mkdtempSync(join(tmpdir(), "md2pdf-markdown-renderer-"));

    try {
      writeFileSync(join(dir, "pixel.png"), tinyPng());
      const markdown = Array.from({ length: 101 }, (_, index) => {
        return `![pixel-${index}](./pixel.png)`;
      }).join("\n");

      expectRenderError(
        markdown,
        (error) => {
          expect(error.message).toContain("too many images");
          expect(error.context.actionHint).toContain("Simplify the document");
        },
        { sourcePath: join(dir, "source.md") },
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("@req FR-06 @req NFR-02 rejects SVG images before content handling", () => {
    const dir = mkdtempSync(join(tmpdir(), "md2pdf-markdown-renderer-"));
    const svgPayloads = [
      "<svg></svg>",
      '<svg><image href="http://example.invalid/x.png"/></svg>',
      '<svg><image href="https://example.invalid/x.png"/></svg>',
      '<svg><image href="file:///etc/passwd"/></svg>',
      "<svg><script>alert(1)</script></svg>",
      "<svg><foreignObject>html</foreignObject></svg>",
    ];

    try {
      for (const [index, payload] of svgPayloads.entries()) {
        writeFileSync(join(dir, `hostile-${index}.svg`), payload);

        expectRenderError(
          `![hostile](./hostile-${index}.svg)`,
          (error) => {
            expect(error.message).toBe(
              "SVG images are not supported for security reasons; use PNG/JPEG/WebP.",
            );
            expect(error.context.actionHint).toContain("PNG");
          },
          { sourcePath: join(dir, "source.md") },
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("@req FR-06 @req NFR-02 rejects GIF, extensionless, and unknown image formats", () => {
    for (const src of ["./animated.gif", "./no-extension", "./archive.bmp"]) {
      expectRenderError(`![unsupported](${src})`, (error) => {
        expect(error.message).toContain("image format is not supported");
        expect(error.context.actionHint).toContain(".png");
      });
    }
  });

  it("@req FR-06 @req NFR-02 rejects image content that does not match the extension", () => {
    const dir = mkdtempSync(join(tmpdir(), "md2pdf-markdown-renderer-"));

    try {
      for (const fileName of ["fake.png", "fake.jpg", "fake.jpeg", "fake.webp"]) {
        writeFileSync(join(dir, fileName), deceptiveImageBytes());

        expectRenderError(
          `![fake](./${fileName})`,
          (error) => {
            expect(error.message).toContain("not a valid PNG, JPEG, or WebP");
            expect(error.context.actionHint).toContain("valid local");
          },
          { sourcePath: join(dir, "source.md") },
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("@req FR-06 @req NFR-02 rejects mismatched image signatures", () => {
    const dir = mkdtempSync(join(tmpdir(), "md2pdf-markdown-renderer-"));

    try {
      writeFileSync(join(dir, "wrong.png"), tinyJpeg());

      expectRenderError(
        "![wrong](./wrong.png)",
        (error) => {
          expect(error.message).toContain("does not match");
          expect(error.context.actionHint).toContain("extension matches");
        },
        { sourcePath: join(dir, "source.md") },
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("@req FR-06 @req NFR-02 rejects oversized single image files", () => {
    const dir = mkdtempSync(join(tmpdir(), "md2pdf-markdown-renderer-"));

    try {
      writeFileSync(join(dir, "large.png"), syntheticOversizedImageBytes(20 * 1024 * 1024 + 1));

      expectRenderError(
        "![large](./large.png)",
        (error) => {
          expect(error.message).toContain("image file is too large");
          expect(error.context.actionHint).toContain("Simplify the document");
        },
        { sourcePath: join(dir, "source.md") },
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("@req FR-06 @req NFR-02 rejects images above the pixel limit", () => {
    const dir = mkdtempSync(join(tmpdir(), "md2pdf-markdown-renderer-"));

    try {
      writeFileSync(join(dir, "huge-dimensions.png"), pngWithDimensions(5001, 5000));

      expectRenderError(
        "![huge](./huge-dimensions.png)",
        (error) => {
          expect(error.message).toContain("image dimensions are too large");
          expect(error.context.actionHint).toContain("Simplify the document");
        },
        { sourcePath: join(dir, "source.md") },
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("@req FR-06 @req NFR-02 rejects cumulative image bytes above the total limit", () => {
    const dir = mkdtempSync(join(tmpdir(), "md2pdf-markdown-renderer-"));
    const twentyMbPng = pngWithTrailingBytes(20 * 1024 * 1024);

    try {
      for (let index = 0; index < 5; index += 1) {
        writeFileSync(join(dir, `large-${index}.png`), twentyMbPng);
      }
      writeFileSync(join(dir, "one-more.png"), tinyPng());

      const markdown = [
        ...Array.from({ length: 5 }, (_, index) => `![large-${index}](./large-${index}.png)`),
        "![one-more](./one-more.png)",
      ].join("\n");

      expectRenderError(
        markdown,
        (error) => {
          expect(error.message).toContain("too many image bytes");
          expect(error.context.actionHint).toContain("Simplify the document");
        },
        { sourcePath: join(dir, "source.md") },
      );
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

  it("@req NFR-02 keeps HTTPS links passive and blocks active resource URLs", () => {
    const html = renderToHtml(
      [
        "[remote](https://example.invalid/page)",
        "[insecure](http://example.invalid/page)",
        "",
        "https://example.invalid/plain-text",
      ].join("\n"),
      context(),
    );

    expect(html).toMatch(/<a\b[^>]*\bhref="https:\/\/example\.invalid\/page"/iu);
    expect(html).not.toMatch(/<a\b[^>]*\bhref="http:\/\/example\.invalid\/page"/iu);
    expect(html).toMatch(/<a\b[^>]*data-md2pdf-blocked-href="true"[^>]*>insecure<\/a>/iu);
    expect(html).not.toMatch(/<img\b[^>]*\bsrc=["']https?:/iu);
    expect(html).not.toMatch(/<script\b[^>]*\bsrc=/iu);
    expect(html).not.toMatch(/<link\b[^>]*\bhref=/iu);
    expect(html).toContain("img-src data:");
    expect(html).not.toContain("img-src data: file:");
    expect(html).toContain("remote");
    expect(html).toContain("https://example.invalid/plain-text");
  });

  it("@req NFR-02 blocks dangerous and local link hrefs", () => {
    const html = renderToHtml(
      [
        "[javascript](javascript:alert(1))",
        "[data](data:text/html;base64,PGgxPkJvb208L2gxPg==)",
        "[file](file:///etc/passwd)",
        "[blob](blob:https://example.invalid/id)",
        "[ftp](ftp://example.invalid/file)",
        "[unknown](custom://example.invalid/file)",
        "[root](/etc/passwd)",
        "[relative](./local-file.md)",
      ].join("\n"),
      context(),
    );

    expect(mainContent(html)).not.toMatch(/<a\b[^>]*\shref=/iu);
    expect(html.match(/data-md2pdf-blocked-href="true"/gu)).toHaveLength(8);
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

  it("@req FR-06 @req NFR-02 rejects symlinks that escape the real baseDir", () => {
    const dir = mkdtempSync(join(tmpdir(), "md2pdf-markdown-renderer-"));
    const docsDir = join(dir, "docs");
    const outsideDir = join(dir, "outside");

    try {
      mkdirSync(docsDir);
      mkdirSync(outsideDir);
      writeFileSync(join(outsideDir, "outside.png"), tinyPng());

      try {
        symlinkSync(join(outsideDir, "outside.png"), join(docsDir, "linked.png"), "file");
      } catch {
        return;
      }

      expectRenderError(
        "![linked](./linked.png)",
        (error) => {
          expect(error.message).toContain("must stay inside");
          expect(error.context.actionHint).toContain("baseDir");
        },
        { sourcePath: join(docsDir, "source.md") },
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function context(): { sourcePath: string } {
  return { sourcePath: "/tmp/source.md" };
}

function expectRenderError(
  markdown: string,
  inspect: (error: RenderError) => void,
  renderContext = context(),
): void {
  try {
    renderToHtml(markdown, renderContext);
    throw new Error("Expected renderToHtml to throw a RenderError");
  } catch (error) {
    expect(error).toBeInstanceOf(RenderError);
    inspect(error as RenderError);
  }
}

function pngWithDimensions(width: number, height: number): Buffer {
  const data = Buffer.from(tinyPng());
  data.writeUInt32BE(width, 16);
  data.writeUInt32BE(height, 20);
  return data;
}

function pngWithTrailingBytes(byteLength: number): Buffer {
  const image = tinyPng();
  if (byteLength < image.byteLength) {
    throw new RangeError("byteLength must fit the tiny PNG fixture");
  }

  return Buffer.concat([image, Buffer.alloc(byteLength - image.byteLength)]);
}

function mainContent(html: string): string {
  const match = html.match(/<main class="markdown-body">\n(?<body>[\s\S]*?)<\/main>/u);
  return match?.groups?.body ?? html;
}
