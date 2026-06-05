import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import hljs from "highlight.js";
import MarkdownIt from "markdown-it";
import type { PluginWithOptions, PluginSimple } from "markdown-it";
import type { Options } from "markdown-it/lib/index.mjs";
import type Renderer from "markdown-it/lib/renderer.mjs";
import type { RenderRule } from "markdown-it/lib/renderer.mjs";
import type Token from "markdown-it/lib/token.mjs";

import { RenderError } from "./errors.js";

const require = createRequire(import.meta.url);
const footnotePlugin = require("markdown-it-footnote") as PluginSimple;
const taskListPlugin = require("markdown-it-task-lists") as PluginWithOptions<{
  enabled?: boolean;
  label?: boolean;
  labelAfter?: boolean;
}>;

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const defaultCssPath = resolve(moduleDirectory, "../assets/default.css");
const highlightCssPath = resolve(moduleDirectory, "../assets/highlight.css");
let cachedRenderer: MarkdownIt | undefined;
let cachedDefaultCss: string | undefined;
let cachedHighlightCss: string | undefined;
let cachedMermaidBundlePath: string | undefined;
let cachedMermaidBundle: string | undefined;
const tempHtmlDirectories = new Set<string>();

export interface MarkdownRenderContext {
  sourcePath: string;
  baseDir?: string;
  documentTitle?: string;
}

export interface TempMarkdownRenderContext extends MarkdownRenderContext {
  tempDir?: string;
}

export type TempHtmlCallback<T> = (
  htmlPath: string,
  fileUrl: string,
  signal: AbortSignal,
) => Promise<T>;

interface RenderEnvironment {
  context: MarkdownRenderContext;
}

export function renderToHtml(markdown: string, context: MarkdownRenderContext): string {
  const renderer = getMarkdownRenderer();
  const body = renderer.render(markdown, { context } satisfies RenderEnvironment);

  return assembleHtml(body, context);
}

export async function renderToTempHtml(
  markdown: string,
  context: TempMarkdownRenderContext,
): Promise<string> {
  const tempRoot = resolve(context.tempDir ?? tmpdir());
  await mkdir(tempRoot, { recursive: true });
  const tempDirectory = await mkdtemp(resolve(tempRoot, "md2pdf-html-"));
  const htmlPath = resolve(tempDirectory, "document.html");
  tempHtmlDirectories.add(tempDirectory);

  try {
    await writeFile(htmlPath, renderToHtml(markdown, context), "utf8");
    return htmlPath;
  } catch (error) {
    await cleanupTempHtml(htmlPath);
    throw error;
  }
}

export async function cleanupTempHtml(htmlPath: string): Promise<void> {
  const tempDirectory = dirname(resolve(htmlPath));
  if (!tempHtmlDirectories.has(tempDirectory)) {
    throw new RenderError({
      message: "Refusing to clean an unmanaged temporary HTML path",
      actionHint: "Only pass paths returned by renderToTempHtml to cleanupTempHtml.",
    });
  }

  await rm(tempDirectory, { recursive: true, force: true });
  tempHtmlDirectories.delete(tempDirectory);
}

export async function withTempHtml<T>(
  markdown: string,
  context: TempMarkdownRenderContext,
  useHtml: TempHtmlCallback<T>,
  timeoutMs?: number,
): Promise<T> {
  const htmlPath = await renderToTempHtml(markdown, context);
  const abortController = new AbortController();

  try {
    const work = useHtml(htmlPath, htmlPathToFileUrl(htmlPath), abortController.signal);
    return await (timeoutMs === undefined
      ? work
      : withTimeout(work, timeoutMs, context, abortController));
  } finally {
    await cleanupTempHtml(htmlPath);
  }
}

export function htmlPathToFileUrl(htmlPath: string): string {
  return pathToFileURL(htmlPath).href;
}

function createMarkdownRenderer(): MarkdownIt {
  const md = new MarkdownIt("commonmark", {
    html: false,
    linkify: false,
    typographer: false,
    highlight: highlightCode,
  });
  md.validateLink = () => true;

  md.enable("table");
  md.use(footnotePlugin);
  md.use(taskListPlugin, { enabled: false });

  md.renderer.rules.fence = renderFence(md);
  md.renderer.rules.image = renderImage(md);
  md.renderer.rules.link_open = renderLinkOpen();

  return md;
}

function getMarkdownRenderer(): MarkdownIt {
  cachedRenderer ??= createMarkdownRenderer();
  return cachedRenderer;
}

function renderFence(md: MarkdownIt): RenderRule {
  return (tokens, idx, options, _env, self) => {
    const token = tokens[idx];
    const language = firstInfoWord(token.info);

    if (language === "mermaid") {
      return [
        '<div class="mermaid" data-md2pdf-mermaid="pending">',
        md.utils.escapeHtml(token.content),
        "</div>\n",
      ].join("");
    }

    return renderHighlightedFence(token, options, self);
  };
}

function renderHighlightedFence(token: Token, options: Options, self: Renderer): string {
  const language = firstInfoWord(token.info);
  const languageClass = language === "" ? "" : ` class="language-${mdEscapeAttr(language)}"`;
  const highlighted = highlightCode(token.content, language, "");
  const attrs = self.renderAttrs(token);

  return `<pre class="hljs"${attrs}><code${languageClass}>${highlighted}</code></pre>\n`;
}

function highlightCode(code: string, language: string, _attrs: string): string {
  const normalizedLanguage = language.trim();

  if (normalizedLanguage !== "" && hljs.getLanguage(normalizedLanguage) !== undefined) {
    return hljs.highlight(code, {
      language: normalizedLanguage,
      ignoreIllegals: true,
    }).value;
  }

  return mdEscapeHtml(code);
}

function renderImage(md: MarkdownIt): RenderRule {
  return (tokens, idx, options, env, self) => {
    const renderEnv = env as RenderEnvironment;
    const token = tokens[idx];
    const src = token.attrGet("src");

    if (src === null || src.trim() === "") {
      throw new RenderError({
        message: "Markdown image is missing a source path",
        sourcePath: renderEnv.context.sourcePath,
        actionHint: "Provide a relative image path, for example: ![alt](./image.png).",
      });
    }

    token.attrSet("src", imageSourceToDataUri(src, renderEnv.context));
    token.attrSet("alt", self.renderInlineAsText(token.children ?? [], options, env));

    return self.renderToken(tokens, idx, options);
  };
}

function renderLinkOpen(): RenderRule {
  return (tokens, idx, options, _env, self) => {
    const token = tokens[idx];
    const href = token.attrGet("href");

    if (href !== null && (isHttpUrl(href) || hasUriScheme(href))) {
      token.attrSet("data-md2pdf-blocked-href", "true");
      token.attrs = token.attrs?.filter(([name]) => name !== "href") ?? null;
    }

    return self.renderToken(tokens, idx, options);
  };
}

function imageSourceToDataUri(src: string, context: MarkdownRenderContext): string {
  if (isHttpUrl(src) || src.startsWith("//") || hasUriScheme(src)) {
    throw new RenderError({
      message: "Markdown images must use relative local paths",
      sourcePath: context.sourcePath,
      actionHint: "Reference images with a path relative to the Markdown source file.",
    });
  }

  const imagePath = resolveImagePath(src, context);
  const data = readImageFile(imagePath, context.sourcePath);
  const mimeType = mimeTypeForPath(imagePath);

  if (mimeType === "image/svg+xml" && containsHttpUrl(data.toString("utf8"))) {
    throw new RenderError({
      message: "SVG images with external URLs are not supported during local rendering",
      sourcePath: context.sourcePath,
      actionHint: "Remove external references from the SVG or use a raster local image.",
    });
  }

  return `data:${mimeType};base64,${data.toString("base64")}`;
}

function resolveImagePath(src: string, context: MarkdownRenderContext): string {
  if (isAbsolute(src)) {
    throw new RenderError({
      message: "Absolute Markdown image paths are not supported during local rendering",
      sourcePath: context.sourcePath,
      actionHint: "Reference images with a path relative to the Markdown source file.",
    });
  }

  const sourceDirectory = dirname(resolve(context.sourcePath));
  const baseDirectory = resolve(context.baseDir ?? sourceDirectory);
  const imagePath = resolve(sourceDirectory, src);

  if (!isPathInsideDirectory(imagePath, baseDirectory)) {
    throw new RenderError({
      message: "Markdown image paths must stay inside the source image directory",
      sourcePath: context.sourcePath,
      actionHint: "Move the image under the Markdown source directory or pass a baseDir that contains it.",
    });
  }

  return imagePath;
}

function readImageFile(imagePath: string, sourcePath: string): Buffer {
  try {
    return readFileSync(imagePath);
  } catch (cause) {
    throw new RenderError({
      message: "Markdown image could not be read",
      sourcePath,
      actionHint: `Check that the referenced image exists and is readable: ${imagePath}`,
      cause,
    });
  }
}

function assembleHtml(body: string, context: MarkdownRenderContext): string {
  const title = mdEscapeHtml(context.documentTitle ?? "md2pdf document");
  const defaultCss = readTextAsset(defaultCssPath, "default");
  const highlightCss = readTextAsset(highlightCssPath, "highlight");
  const hasMermaid = body.includes('class="mermaid"');

  return [
    "<!doctype html>",
    `<html lang="en" data-mermaid-status="${hasMermaid ? "pending" : "done"}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\';">',
    `<title>${title}</title>`,
    `<style data-md2pdf-asset="default.css">\n${defaultCss}\n</style>`,
    `<style data-md2pdf-asset="highlight.css">\n${highlightCss}\n</style>`,
    "</head>",
    "<body>",
    `<main class="markdown-body">\n${body}</main>`,
    hasMermaid
      ? `<script data-md2pdf-asset="mermaid.min.js">\n${readTextAsset(
          mermaidBundlePath(),
          "mermaid",
        )}\n</script>`
      : "",
    hasMermaid
      ? `<script data-md2pdf-asset="mermaid-runner">\n${mermaidRunnerScript()}\n</script>`
      : "",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function readTextAsset(path: string, asset: "default" | "highlight" | "mermaid"): string {
  if (asset === "default") {
    cachedDefaultCss ??= readFileSync(path, "utf8");
    return cachedDefaultCss;
  }

  if (asset === "highlight") {
    cachedHighlightCss ??= readFileSync(path, "utf8");
    return cachedHighlightCss;
  }

  cachedMermaidBundle ??= readFileSync(path, "utf8");
  return cachedMermaidBundle;
}

function mermaidBundlePath(): string {
  cachedMermaidBundlePath ??= require.resolve(["mermaid", "dist", "mermaid.min.js"].join("/"));
  return cachedMermaidBundlePath;
}

function mermaidRunnerScript(): string {
  return [
    "(async () => {",
    "  const diagrams = document.querySelectorAll('.mermaid');",
    "  if (diagrams.length === 0) {",
    "    document.documentElement.dataset.mermaidStatus = 'done';",
    "    return;",
    "  }",
    "  try {",
    "    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });",
    "    await mermaid.run({ nodes: diagrams });",
    "    document.documentElement.dataset.mermaidStatus = 'done';",
    "  } catch (error) {",
    "    document.documentElement.dataset.mermaidStatus = 'error';",
    "    document.documentElement.dataset.mermaidError = error instanceof Error ? error.message : String(error);",
    "    throw error;",
    "  }",
    "})();",
  ].join("\n");
}

function firstInfoWord(info: string): string {
  return info.trim().split(/\s+/u)[0]?.toLowerCase() ?? "";
}

function mimeTypeForPath(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".avif":
      return "image/avif";
    case ".gif":
      return "image/gif";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function isHttpUrl(value: string): boolean {
  return /^https?:/iu.test(value.trim());
}

function hasUriScheme(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/iu.test(value.trim());
}

function isPathInsideDirectory(path: string, directory: string): boolean {
  const relativePath = relative(directory, path);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function containsHttpUrl(value: string): boolean {
  return /\bhttps?:/iu.test(value);
}

function mdEscapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function mdEscapeAttr(value: string): string {
  return mdEscapeHtml(value).replaceAll("'", "&#39;");
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  context: MarkdownRenderContext,
  abortController: AbortController,
): Promise<T> {
  return new Promise<T>((resolvePromise, rejectPromise) => {
    const timeout = setTimeout(() => {
      const error = new RenderError({
        message: "Timed out while using temporary HTML",
        sourcePath: context.sourcePath,
        actionHint: `Increase the render timeout above ${timeoutMs}ms or simplify the document.`,
      });

      abortController.abort(error);
      rejectPromise(error);
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolvePromise(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        rejectPromise(error);
      },
    );
  });
}
