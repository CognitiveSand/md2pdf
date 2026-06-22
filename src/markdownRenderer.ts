import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, relative, resolve } from "node:path";
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
const tempHtmlMarkerFileName = ".md2pdf-temp-html";
const tempHtmlFileName = "document.html";
const tempHtmlDirectoryPrefix = "md2pdf-html-";
const MAX_MARKDOWN_BYTES = 10 * 1024 * 1024;
const MAX_MARKDOWN_LINE_BYTES = 1 * 1024 * 1024;
const MAX_IMAGE_COUNT = 100;
const MAX_MERMAID_BLOCK_COUNT = 50;
const MAX_MERMAID_BLOCK_BYTES = 256 * 1024;
const MAX_HIGHLIGHT_CODE_BYTES = 1 * 1024 * 1024;
const MAX_SINGLE_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 25_000_000;

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

interface RenderState {
  context: MarkdownRenderContext;
  imageCount: number;
  totalImageBytes: number;
  mermaidBlockCount: number;
}

interface RenderEnvironment {
  state: RenderState;
}

export function renderToHtml(markdown: string, context: MarkdownRenderContext): string {
  validateMarkdownSize(markdown, context);

  const renderer = getMarkdownRenderer();
  const body = renderer.render(markdown, {
    state: createRenderState(context),
  } satisfies RenderEnvironment);

  return assembleHtml(body, context);
}

export async function renderToTempHtml(
  markdown: string,
  context: TempMarkdownRenderContext,
): Promise<string> {
  const tempRoot = resolve(context.tempDir ?? tmpdir());
  await mkdir(tempRoot, { recursive: true });
  const tempDirectory = await mkdtemp(resolve(tempRoot, tempHtmlDirectoryPrefix));
  const htmlPath = resolve(tempDirectory, tempHtmlFileName);

  try {
    await writeFile(resolve(tempDirectory, tempHtmlMarkerFileName), "", "utf8");
    await writeFile(htmlPath, renderToHtml(markdown, context), "utf8");
    return htmlPath;
  } catch (error) {
    await cleanupTempHtml(htmlPath);
    throw error;
  }
}

export async function cleanupTempHtml(htmlPath: string): Promise<void> {
  const tempDirectory = dirname(resolve(htmlPath));
  if (!isManagedTempHtmlPath(htmlPath, tempDirectory)) {
    throw new RenderError({
      message: "Refusing to clean an unmanaged temporary HTML path",
      actionHint: "Only pass paths returned by renderToTempHtml to cleanupTempHtml.",
    });
  }

  await rm(tempDirectory, { recursive: true, force: true });
}

function isManagedTempHtmlPath(htmlPath: string, tempDirectory: string): boolean {
  return (
    basename(resolve(htmlPath)) === tempHtmlFileName &&
    basename(tempDirectory).startsWith(tempHtmlDirectoryPrefix) &&
    existsSync(resolve(tempDirectory, tempHtmlMarkerFileName))
  );
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
  // Keep tokenization permissive; renderLinkOpen applies the local link policy.
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
  return createMarkdownRenderer();
}

function renderFence(md: MarkdownIt): RenderRule {
  return (tokens, idx, options, env, self) => {
    const renderEnv = env as RenderEnvironment;
    const token = tokens[idx];
    const language = firstInfoWord(token.info);

    if (language === "mermaid") {
      registerMermaidBlock(renderEnv.state, token.content);
      return [
        '<div class="mermaid" data-md2pdf-mermaid="pending">',
        md.utils.escapeHtml(token.content),
        "</div>\n",
      ].join("");
    }

    return renderHighlightedFence(token, options, self, renderEnv.state.context);
  };
}

function renderHighlightedFence(
  token: Token,
  options: Options,
  self: Renderer,
  context: MarkdownRenderContext,
): string {
  rejectIfCodeFenceTooLarge(token.content, context);

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
        sourcePath: renderEnv.state.context.sourcePath,
        actionHint: "Provide a relative image path, for example: ![alt](./image.png).",
      });
    }

    registerImage(renderEnv.state);
    token.attrSet("src", imageSourceToDataUri(src, renderEnv.state.context));
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

  const mimeType = supportedImageMimeType(src, context.sourcePath);
  const imagePath = resolveImagePath(src, context);
  const data = readImageFile(imagePath, context.sourcePath);

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
  const defaultCss = readTextAsset(defaultCssPath);
  const highlightCss = readTextAsset(highlightCssPath);
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

function readTextAsset(path: string): string {
  return readFileSync(path, "utf8");
}

function mermaidBundlePath(): string {
  return require.resolve(["mermaid", "dist", "mermaid.min.js"].join("/"));
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

function validateMarkdownSize(markdown: string, context: MarkdownRenderContext): void {
  if (Buffer.byteLength(markdown, "utf8") > MAX_MARKDOWN_BYTES) {
    throw new RenderError({
      message: "Markdown document is too large to render safely",
      sourcePath: context.sourcePath,
      actionHint: simplifyDocumentHint(),
    });
  }

  for (const line of markdown.split(/\r\n|[\n\r]/u)) {
    if (Buffer.byteLength(line, "utf8") > MAX_MARKDOWN_LINE_BYTES) {
      throw new RenderError({
        message: "Markdown document contains a line that is too large to render safely",
        sourcePath: context.sourcePath,
        actionHint: simplifyDocumentHint(),
      });
    }
  }
}

function createRenderState(context: MarkdownRenderContext): RenderState {
  return {
    context,
    imageCount: 0,
    totalImageBytes: 0,
    mermaidBlockCount: 0,
  };
}

function registerImage(state: RenderState): void {
  state.imageCount += 1;

  if (state.imageCount > MAX_IMAGE_COUNT) {
    throw new RenderError({
      message: "Markdown document contains too many images to render safely",
      sourcePath: state.context.sourcePath,
      actionHint: simplifyDocumentHint(),
    });
  }
}

function registerMermaidBlock(state: RenderState, content: string): void {
  state.mermaidBlockCount += 1;

  if (state.mermaidBlockCount > MAX_MERMAID_BLOCK_COUNT) {
    throw new RenderError({
      message: "Markdown document contains too many Mermaid blocks to render safely",
      sourcePath: state.context.sourcePath,
      actionHint: simplifyDocumentHint(),
    });
  }

  if (Buffer.byteLength(content, "utf8") > MAX_MERMAID_BLOCK_BYTES) {
    throw new RenderError({
      message: "Mermaid block is too large to render safely",
      sourcePath: state.context.sourcePath,
      actionHint: simplifyDocumentHint(),
    });
  }
}

function rejectIfCodeFenceTooLarge(code: string, context: MarkdownRenderContext): void {
  if (Buffer.byteLength(code, "utf8") > MAX_HIGHLIGHT_CODE_BYTES) {
    throw new RenderError({
      message: "Code fence is too large to highlight safely",
      sourcePath: context.sourcePath,
      actionHint: simplifyDocumentHint(),
    });
  }
}

function supportedImageMimeType(path: string, sourcePath: string): string {
  switch (extname(path).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".svg":
      throw new RenderError({
        message: "SVG images are not supported for security reasons; use PNG/JPEG/WebP.",
        sourcePath,
        actionHint: "Export the image as PNG, JPEG, or WebP before referencing it.",
      });
    case ".webp":
      return "image/webp";
    default:
      throw new RenderError({
        message: "Markdown image format is not supported; use PNG, JPEG, or WebP",
        sourcePath,
        actionHint: "Reference a local image with a .png, .jpg, .jpeg, or .webp extension.",
      });
  }
}

function simplifyDocumentHint(): string {
  return "Simplify the document by reducing large sections, splitting long lines, or moving heavy content out of Markdown.";
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
