import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { locateBrowserAndDriver, type DriverProvisioner } from './browserLocator.js';
import { ConversionError } from './errors.js';
import { renderToTempHtml } from './markdownRenderer.js';
import { renderToPdf, type RenderOptions } from './pdfRenderer.js';

export interface ConvertOptions {
  /** Override the default render timeout. */
  renderTimeoutMs?: number;
  /** Injectable driver provisioner — used in tests to avoid real downloads. */
  provisioner?: DriverProvisioner;
}

/**
 * Converts a single Markdown file to a PDF at the given output path.
 *
 * The PDF is written only after a successful render: on any failure the output
 * path is left untouched (no partial file).
 */
export async function convertFile(
  sourcePath: string,
  outputPath: string,
  options: ConvertOptions = {},
): Promise<void> {
  // Stage 1–3: Markdown → self-contained local HTML
  let markdown: string;
  try {
    markdown = readFileSync(sourcePath, 'utf8');
  } catch (err) {
    throw new ConversionError(
      `Cannot read source file: ${(err as Error).message}`,
      sourcePath,
    );
  }

  const htmlPath = renderToTempHtml(markdown, { sourceFilePath: sourcePath });
  const htmlTempDir = dirname(htmlPath);

  try {
    // Stage 4: HTML → PDF via headless browser
    const { browser, driver } = await locateBrowserAndDriver(options.provisioner);

    const renderOpts: RenderOptions = {};
    if (options.renderTimeoutMs !== undefined) {
      renderOpts.timeoutMs = options.renderTimeoutMs;
    }

    const pdfBytes = await renderToPdf(htmlPath, sourcePath, browser, driver, renderOpts);

    // Stage 5: Atomic-ish write — write to a sibling temp file first, then rename
    const tmpOut = join(tmpdir(), `md2pdf-out-${Date.now()}.pdf`);
    writeFileSync(tmpOut, pdfBytes);
    renameSync(tmpOut, outputPath);
  } finally {
    // Always clean up the temporary HTML directory
    try {
      rmSync(htmlTempDir, { recursive: true, force: true });
    } catch {
      // non-fatal
    }
  }
}
