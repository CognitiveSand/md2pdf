import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rename, rm, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { type ConvertOptions } from "./contracts.js";
import { ConversionError } from "./errors.js";
import { locateBrowser } from "./browserLocator.js";

export interface PdfRenderRequest {
  fileUrl: string;
  htmlPath: string;
  sourcePath: string;
  outputPath: string;
  options?: ConvertOptions;
  signal?: AbortSignal;
}

export async function renderPdfFromHtml(request: PdfRenderRequest): Promise<void> {
  const browserPath = await locateBrowserForRender(request);
  const outputPath = resolve(request.outputPath);
  const outputDirectory = dirname(outputPath);
  const temporaryOutputPath = join(
    outputDirectory,
    `.md2pdf-${randomUUID()}.pdf.tmp`,
  );
  const userDataDir = await mkdtemp(join(tmpdir(), "md2pdf-browser-"));

  try {
    await mkdir(outputDirectory, { recursive: true });
    await printToPdf(browserPath, userDataDir, temporaryOutputPath, request);
    await assertPdfWritten(temporaryOutputPath, request);
    await commitPdfOutput(temporaryOutputPath, outputPath, request);
  } finally {
    await Promise.all([
      rm(temporaryOutputPath, { force: true }),
      rm(userDataDir, { recursive: true, force: true }),
    ]);
  }
}

async function locateBrowserForRender(request: PdfRenderRequest): Promise<string> {
  try {
    return await locateBrowser(request.options?.browserPath);
  } catch (cause) {
    throw renderFailure("No supported browser executable was found", request, cause);
  }
}

async function printToPdf(
  browserPath: string,
  userDataDir: string,
  outputPath: string,
  request: PdfRenderRequest,
): Promise<void> {
  const args = [
    "--headless",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-background-networking",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${userDataDir}`,
    `--print-to-pdf=${outputPath}`,
    request.fileUrl,
  ];

  await new Promise<void>((resolvePromise, rejectPromise) => {
    let stderr = "";
    const command = browserCommand(browserPath, args);
    const browser = spawn(command.executable, command.args, {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });

    const onAbort = (): void => {
      browser.kill();
      rejectPromise(
        renderFailure("PDF rendering was aborted", request, request.signal?.reason),
      );
    };

    request.signal?.addEventListener("abort", onAbort, { once: true });

    browser.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    browser.on("error", (cause) => {
      request.signal?.removeEventListener("abort", onAbort);
      rejectPromise(renderFailure("Failed to start browser PDF renderer", request, cause));
    });

    browser.on("close", (code) => {
      request.signal?.removeEventListener("abort", onAbort);
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        renderFailure(
          `Browser PDF renderer exited with code ${code ?? "unknown"}`,
          request,
          stderr.trim() === "" ? undefined : stderr.trim(),
        ),
      );
    });
  });
}

async function assertPdfWritten(outputPath: string, request: PdfRenderRequest): Promise<void> {
  try {
    const [{ size }, header] = await Promise.all([
      stat(outputPath),
      readFile(outputPath),
    ]);

    if (size < 5 || !header.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      throw new Error("output does not start with a PDF header");
    }
  } catch (cause) {
    throw renderFailure("Browser did not produce a valid PDF output", request, cause);
  }
}

async function commitPdfOutput(
  temporaryOutputPath: string,
  outputPath: string,
  request: PdfRenderRequest,
): Promise<void> {
  try {
    await rename(temporaryOutputPath, outputPath);
  } catch (cause) {
    throw renderFailure("Could not replace final PDF output", request, cause);
  }
}

function browserCommand(browserPath: string, args: string[]): { executable: string; args: string[] } {
  if (process.platform !== "win32" || !/\.(?:cmd|bat)$/iu.test(browserPath)) {
    return { executable: browserPath, args };
  }

  return {
    executable: process.env.ComSpec ?? "cmd.exe",
    args: ["/d", "/c", browserPath, ...args],
  };
}

function renderFailure(message: string, request: PdfRenderRequest, cause?: unknown): ConversionError {
  return new ConversionError({
    message,
    sourcePath: request.sourcePath,
    outputPath: request.outputPath,
    actionHint: "Check the browser path and retry the conversion.",
    cause,
  });
}
