import { existsSync, readFileSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { URL, fileURLToPath, pathToFileURL } from "node:url";

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
const mermaidBundleAssetPath = resolve(moduleDirectory, "../assets/mermaid.min.js");
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
const REMOVE_HIDDEN_FORMATTING_HINT =
  "Remove hidden formatting characters from the Markdown source before converting it.";
export const MIN_BASE_FONT_SIZE_PT = 4;
export const MAX_BASE_FONT_SIZE_PT = 72;

export interface MarkdownRenderContext {
  sourcePath: string;
  baseDir?: string;
  documentTitle?: string;
  baseFontSizePt?: number;
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

type SupportedImageFormat = "jpeg" | "png" | "webp";

interface SupportedImageType {
  format: SupportedImageFormat;
  mimeType: string;
}

interface ImageInfo {
  format: SupportedImageFormat;
  width: number;
  height: number;
}

interface DangerousMarkdownCharacter {
  codePoint: number;
  line: number;
  column: number;
  kind: "control" | "format";
}

export function renderToHtml(markdown: string, context: MarkdownRenderContext): string {
  validateMarkdownSize(markdown, context);
  validateMarkdownCharacters(markdown, context);

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
    token.attrSet("src", imageSourceToDataUri(src, renderEnv.state));
    token.attrSet("alt", self.renderInlineAsText(token.children ?? [], options, env));

    return self.renderToken(tokens, idx, options);
  };
}

function renderLinkOpen(): RenderRule {
  return (tokens, idx, options, _env, self) => {
    const token = tokens[idx];
    const href = token.attrGet("href");

    if (href !== null && !isClearVisibleHttpsLink(href, extractVisibleLinkText(tokens, idx))) {
      blockLinkHref(token);
    }

    return self.renderToken(tokens, idx, options);
  };
}

function blockLinkHref(token: Token): void {
  token.attrSet("data-md2pdf-blocked-href", "true");
  token.attrs = token.attrs?.filter(([name]) => name !== "href") ?? null;
}

function extractVisibleLinkText(tokens: Token[], openIndex: number): string {
  const closeIndex = findMatchingLinkCloseIndex(tokens, openIndex);

  if (closeIndex === undefined) {
    return "";
  }

  return extractVisibleInlineText(tokens.slice(openIndex + 1, closeIndex));
}

function findMatchingLinkCloseIndex(tokens: Token[], openIndex: number): number | undefined {
  const openToken = tokens[openIndex];

  for (let index = openIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token.type === "link_close" && token.level === openToken.level) {
      return index;
    }
  }

  return undefined;
}

function extractVisibleInlineText(tokens: Token[]): string {
  return tokens.map((token) => visibleTokenText(token)).join("");
}

function visibleTokenText(token: Token): string {
  if (token.type === "text" || token.type === "code_inline") {
    return token.content;
  }

  if (token.type === "softbreak" || token.type === "hardbreak") {
    return "\n";
  }

  if (token.type === "image") {
    return token.content || extractVisibleInlineText(token.children ?? []);
  }

  if (token.children !== null && token.children.length > 0) {
    return extractVisibleInlineText(token.children);
  }

  if (token.nesting === 0 && token.content !== "" && token.type !== "html_inline") {
    return token.content;
  }

  return "";
}

function imageSourceToDataUri(src: string, state: RenderState): string {
  const context = state.context;
  if (isRemoteOrSchemeReference(src)) {
    throw new RenderError({
      message: "Markdown images must use relative local paths",
      sourcePath: context.sourcePath,
      actionHint: "Reference images with a path relative to the Markdown source file.",
    });
  }

  const imageType = supportedImageType(src, context.sourcePath);
  const imagePath = resolveImagePath(src, context);
  const data = readValidatedImageFile(imagePath, imageType, state);

  return `data:${imageType.mimeType};base64,${data.toString("base64")}`;
}

function resolveImagePath(src: string, context: MarkdownRenderContext): string {
  if (isRemoteOrSchemeReference(src)) {
    throw new RenderError({
      message: "Markdown images must use relative local paths",
      sourcePath: context.sourcePath,
      actionHint: "Reference images with a path relative to the Markdown source file.",
    });
  }

  if (isAbsolute(src)) {
    throw new RenderError({
      message: "Absolute Markdown image paths are not supported during local rendering",
      sourcePath: context.sourcePath,
      actionHint: "Reference images with a path relative to the Markdown source file.",
    });
  }

  const sourceDirectory = dirname(resolve(context.sourcePath));
  const baseDirectory = realpathForExistingPath(
    resolve(context.baseDir ?? sourceDirectory),
    context.sourcePath,
    "Markdown image base directory could not be resolved",
  );
  const imagePath = resolve(sourceDirectory, src);
  const realImagePath = realpathForExistingPath(
    imagePath,
    context.sourcePath,
    "Markdown image could not be read",
  );

  if (!isPathInsideDirectory(realImagePath, baseDirectory)) {
    throw new RenderError({
      message: "Markdown image paths must stay inside the source image directory",
      sourcePath: context.sourcePath,
      actionHint: "Move the image under the Markdown source directory or pass a baseDir that contains it.",
    });
  }

  return realImagePath;
}

function realpathForExistingPath(path: string, sourcePath: string, message: string): string {
  try {
    return realpathSync(path);
  } catch (cause) {
    throw new RenderError({
      message,
      sourcePath,
      actionHint: `Check that the referenced image exists and is readable: ${path}`,
      cause,
    });
  }
}

function readValidatedImageFile(
  imagePath: string,
  expectedType: SupportedImageType,
  state: RenderState,
): Buffer {
  const data = readImageFile(imagePath, state.context.sourcePath);

  if (data.byteLength > MAX_SINGLE_IMAGE_BYTES) {
    throw new RenderError({
      message: "Markdown image file is too large to embed safely",
      sourcePath: state.context.sourcePath,
      actionHint: simplifyDocumentHint(),
    });
  }

  const imageInfo = parseImageInfo(data, state.context.sourcePath);
  if (imageInfo.format !== expectedType.format) {
    throw new RenderError({
      message: "Markdown image content does not match its file extension",
      sourcePath: state.context.sourcePath,
      actionHint: "Use an image whose file extension matches its PNG, JPEG, or WebP content.",
    });
  }

  rejectIfImageDimensionsTooLarge(imageInfo, state.context.sourcePath);
  registerImageBytes(state, data.byteLength);

  return data;
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
    baseFontSizeStyle(context),
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

function baseFontSizeStyle(context: MarkdownRenderContext): string {
  const sizePt = context.baseFontSizePt;
  if (sizePt === undefined) {
    return "";
  }

  if (!Number.isFinite(sizePt) || sizePt < MIN_BASE_FONT_SIZE_PT || sizePt > MAX_BASE_FONT_SIZE_PT) {
    throw new RenderError({
      message: `base font size must be between ${MIN_BASE_FONT_SIZE_PT} and ${MAX_BASE_FONT_SIZE_PT} points`,
      sourcePath: context.sourcePath,
      actionHint: "Pass --size with a point value inside the supported range.",
    });
  }

  return `<style data-md2pdf-asset="base-font-size">\nhtml { font-size: ${sizePt}pt; }\n</style>`;
}

function readTextAsset(path: string): string {
  return readFileSync(path, "utf8");
}

function mermaidBundlePath(): string {
  return mermaidBundleAssetPath;
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

function validateMarkdownCharacters(markdown: string, context: MarkdownRenderContext): void {
  const dangerousCharacter = findDangerousMarkdownCharacter(markdown);

  if (dangerousCharacter === undefined) {
    return;
  }

  throw new RenderError({
    message:
      dangerousCharacter.kind === "control"
        ? "Markdown document contains unsafe control characters"
        : "Markdown document contains hidden or unsafe formatting characters",
    sourcePath: context.sourcePath,
    actionHint: REMOVE_HIDDEN_FORMATTING_HINT,
    cause: [
      formatCodePoint(dangerousCharacter.codePoint),
      `at line ${dangerousCharacter.line}, column ${dangerousCharacter.column}`,
    ].join(" "),
  });
}

function findDangerousMarkdownCharacter(markdown: string): DangerousMarkdownCharacter | undefined {
  let line = 1;
  let column = 1;

  for (let index = 0; index < markdown.length; ) {
    const codePoint = markdown.codePointAt(index);

    if (codePoint === undefined) {
      return undefined;
    }

    const kind = dangerousMarkdownCharacterKind(codePoint);
    if (kind !== undefined) {
      return { codePoint, line, column, kind };
    }

    if (codePoint === 0x0d) {
      const nextCodePoint = markdown.codePointAt(index + 1);
      index += nextCodePoint === 0x0a ? 2 : 1;
      line += 1;
      column = 1;
      continue;
    }

    if (codePoint === 0x0a) {
      index += 1;
      line += 1;
      column = 1;
      continue;
    }

    index += codePoint > 0xffff ? 2 : 1;
    column += 1;
  }

  return undefined;
}

function dangerousMarkdownCharacterKind(
  codePoint: number,
): DangerousMarkdownCharacter["kind"] | undefined {
  if (isUnsafeControlCharacter(codePoint)) {
    return "control";
  }

  if (isUnsafeFormattingCharacter(codePoint)) {
    return "format";
  }

  return undefined;
}

function isUnsafeControlCharacter(codePoint: number): boolean {
  if (codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d) {
    return false;
  }

  return (
    (codePoint >= 0x00 && codePoint <= 0x1f) ||
    (codePoint >= 0x7f && codePoint <= 0x9f)
  );
}

function isUnsafeFormattingCharacter(codePoint: number): boolean {
  return (
    codePoint === 0x00ad ||
    (codePoint >= 0x200b && codePoint <= 0x200d) ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    codePoint === 0x2060 ||
    codePoint === 0x2063 ||
    (codePoint >= 0x2066 && codePoint <= 0x2069) ||
    codePoint === 0xfeff
  );
}

function formatCodePoint(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
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

function registerImageBytes(state: RenderState, byteLength: number): void {
  state.totalImageBytes += byteLength;

  if (state.totalImageBytes > MAX_TOTAL_IMAGE_BYTES) {
    throw new RenderError({
      message: "Markdown document embeds too many image bytes to render safely",
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

function supportedImageType(path: string, sourcePath: string): SupportedImageType {
  switch (extname(path).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return { format: "jpeg", mimeType: "image/jpeg" };
    case ".png":
      return { format: "png", mimeType: "image/png" };
    case ".svg":
      throw new RenderError({
        message: "SVG images are not supported for security reasons; use PNG/JPEG/WebP.",
        sourcePath,
        actionHint: "Export the image as PNG, JPEG, or WebP before referencing it.",
      });
    case ".webp":
      return { format: "webp", mimeType: "image/webp" };
    default:
      throw new RenderError({
        message: "Markdown image format is not supported; use PNG, JPEG, or WebP",
        sourcePath,
        actionHint: "Reference a local image with a .png, .jpg, .jpeg, or .webp extension.",
      });
  }
}

function parseImageInfo(data: Buffer, sourcePath: string): ImageInfo {
  const parsers: Array<() => ImageInfo | null> = [
    () => parsePngInfo(data),
    () => parseJpegInfo(data),
    () => parseWebpInfo(data),
  ];

  for (const parse of parsers) {
    const info = parse();
    if (info !== null) {
      return info;
    }
  }

  throw new RenderError({
    message: "Markdown image file is not a valid PNG, JPEG, or WebP image",
    sourcePath,
    actionHint: "Use a valid local PNG, JPEG, or WebP image.",
  });
}

function parsePngInfo(data: Buffer): ImageInfo | null {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  if (!data.subarray(0, pngSignature.length).equals(pngSignature)) {
    return null;
  }

  if (data.byteLength < 33 || data.readUInt32BE(8) !== 13 || data.toString("ascii", 12, 16) !== "IHDR") {
    return null;
  }

  const expectedCrc = data.readUInt32BE(29);
  const actualCrc = crc32(data.subarray(12, 29));
  if (actualCrc !== expectedCrc) {
    return null;
  }

  return validImageInfo("png", data.readUInt32BE(16), data.readUInt32BE(20));
}

function parseJpegInfo(data: Buffer): ImageInfo | null {
  if (data.byteLength < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 3 < data.byteLength) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (data[offset] === 0xff) {
      offset += 1;
    }

    const marker = data[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    if (isJpegStandaloneMarker(marker)) {
      continue;
    }

    if (offset + 2 > data.byteLength) {
      return null;
    }

    const segmentLength = data.readUInt16BE(offset);
    const segmentEnd = offset + segmentLength;
    if (segmentLength < 2 || segmentEnd > data.byteLength) {
      return null;
    }

    if (isJpegStartOfFrameMarker(marker)) {
      if (segmentLength < 7) {
        return null;
      }

      const height = data.readUInt16BE(offset + 3);
      const width = data.readUInt16BE(offset + 5);
      return validImageInfo("jpeg", width, height);
    }

    offset = segmentEnd;
  }

  return scanJpegStartOfFrame(data);
}

function scanJpegStartOfFrame(data: Buffer): ImageInfo | null {
  for (let offset = 2; offset + 8 < data.byteLength; offset += 1) {
    if (data[offset] !== 0xff || !isJpegStartOfFrameMarker(data[offset + 1])) {
      continue;
    }

    const segmentLength = data.readUInt16BE(offset + 2);
    if (segmentLength < 7 || offset + 2 + segmentLength > data.byteLength) {
      continue;
    }

    const height = data.readUInt16BE(offset + 5);
    const width = data.readUInt16BE(offset + 7);
    const info = validImageInfo("jpeg", width, height);
    if (info !== null) {
      return info;
    }
  }

  return null;
}

function parseWebpInfo(data: Buffer): ImageInfo | null {
  if (
    data.byteLength < 30 ||
    data.toString("ascii", 0, 4) !== "RIFF" ||
    data.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= data.byteLength) {
    const chunkType = data.toString("ascii", offset, offset + 4);
    const chunkSize = data.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;
    const chunkEnd = chunkDataOffset + chunkSize;
    if (chunkEnd > data.byteLength) {
      return null;
    }

    const imageInfo = parseWebpChunkInfo(data, chunkType, chunkDataOffset, chunkSize);
    if (imageInfo !== null) {
      return imageInfo;
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  return null;
}

function parseWebpChunkInfo(
  data: Buffer,
  chunkType: string,
  offset: number,
  size: number,
): ImageInfo | null {
  if (chunkType === "VP8 " && size >= 10) {
    if (data[offset + 3] !== 0x9d || data[offset + 4] !== 0x01 || data[offset + 5] !== 0x2a) {
      return null;
    }

    const width = data.readUInt16LE(offset + 6) & 0x3fff;
    const height = data.readUInt16LE(offset + 8) & 0x3fff;
    return validImageInfo("webp", width, height);
  }

  if (chunkType === "VP8L" && size >= 5) {
    if (data[offset] !== 0x2f) {
      return null;
    }

    const bits = data.readUInt32LE(offset + 1);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return validImageInfo("webp", width, height);
  }

  if (chunkType === "VP8X" && size >= 10) {
    const width = readUInt24LE(data, offset + 4) + 1;
    const height = readUInt24LE(data, offset + 7) + 1;
    return validImageInfo("webp", width, height);
  }

  return null;
}

function validImageInfo(format: SupportedImageFormat, width: number, height: number): ImageInfo | null {
  if (width <= 0 || height <= 0) {
    return null;
  }

  return { format, width, height };
}

function rejectIfImageDimensionsTooLarge(info: ImageInfo, sourcePath: string): void {
  if (info.width * info.height > MAX_IMAGE_PIXELS) {
    throw new RenderError({
      message: "Markdown image dimensions are too large to render safely",
      sourcePath,
      actionHint: simplifyDocumentHint(),
    });
  }
}

function isJpegStartOfFrameMarker(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function isJpegStandaloneMarker(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

function readUInt24LE(data: Buffer, offset: number): number {
  return data[offset] + (data[offset + 1] << 8) + (data[offset + 2] << 16);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function simplifyDocumentHint(): string {
  return "Simplify the document by reducing large sections, splitting long lines, or moving heavy content out of Markdown.";
}

function isClearVisibleHttpsLink(href: string, visibleText: string): boolean {
  const trimmedHref = href.trim();

  if (findDangerousMarkdownCharacter(trimmedHref) !== undefined) {
    return false;
  }

  if (!hasExplicitHttpsHost(trimmedHref)) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(trimmedHref);
  } catch {
    return false;
  }

  return (
    url.protocol === "https:" &&
    url.host !== "" &&
    url.username === "" &&
    url.password === "" &&
    visibleText.trim() === href
  );
}

function hasExplicitHttpsHost(value: string): boolean {
  const prefix = "https://";

  if (!value.toLowerCase().startsWith(prefix)) {
    return false;
  }

  const afterScheme = value.slice(prefix.length);
  const hostEndIndex = afterScheme.search(/[/?#]/u);
  const host = hostEndIndex === -1 ? afterScheme : afterScheme.slice(0, hostEndIndex);

  return host !== "";
}

function isRemoteOrSchemeReference(value: string): boolean {
  const normalizedValue = value.trim();
  return normalizedValue.startsWith("//") || hasUriScheme(normalizedValue);
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
