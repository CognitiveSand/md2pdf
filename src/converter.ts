import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { type ConvertOptions } from "./contracts.js";
import { ConversionError } from "./errors.js";
import { withTempHtml } from "./markdownRenderer.js";
import { renderPdfFromHtml, type PdfRenderRequest } from "./pdfRenderer.js";

export type PdfRenderer = (request: PdfRenderRequest) => Promise<void>;

export interface ConverterDependencies {
  renderPdf?: PdfRenderer;
}

export const convertFile = createConverter();

export function createConverter(dependencies: ConverterDependencies = {}) {
  const renderPdf = dependencies.renderPdf ?? renderPdfFromHtml;

  return async function convertFile(
    sourcePath: string,
    outputPath: string,
    options: ConvertOptions = {},
  ): Promise<void> {
    const markdown = await readMarkdownSource(sourcePath, outputPath);

    await withTempHtml(
      markdown,
      {
        sourcePath,
        documentTitle: basename(sourcePath),
      },
      async (htmlPath, fileUrl, signal) => {
        signal.throwIfAborted();
        await renderPdf({
          htmlPath,
          fileUrl,
          sourcePath,
          outputPath,
          options,
          signal,
        });
      },
      options.renderTimeoutMs,
    );
  };
}

async function readMarkdownSource(sourcePath: string, outputPath: string): Promise<string> {
  try {
    return await readFile(sourcePath, "utf8");
  } catch (cause) {
    throw new ConversionError({
      message: "Markdown source could not be read during conversion",
      sourcePath,
      outputPath,
      actionHint: "Check that the source file still exists and is readable.",
      cause,
    });
  }
}
