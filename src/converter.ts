import { randomUUID } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";

import { ArtifactPolicy } from "./artifactPolicy.js";
import {
  ArtifactPolicyDriverResolver,
  BrowserLocator,
  type FallbackBrowserResolver,
  type LocatedBrowser,
} from "./browserLocator.js";
import type { ConvertOptions } from "./contracts.js";
import { ConversionError } from "./errors.js";
import { provisionFallbackBrowser } from "./fallbackBrowserProvisioner.js";
import { withTempHtml } from "./markdownRenderer.js";
import { JsonReleaseCatalog } from "./releaseCatalog.js";
import {
  printPdfWithWebDriver,
  type DriverProcessHandle,
  type WebDriverPrintOptions,
} from "./webDriverClient.js";
import {
  SpawnedWebDriverSessionFactory,
  type WebDriverSessionFactory,
} from "./webDriverSession.js";

export type { WebDriverSession, WebDriverSessionFactory } from "./webDriverSession.js";

export interface BrowserLocatorLike {
  locate(): Promise<LocatedBrowser>;
}

export interface ConverterFileSystem {
  mkdir(path: string, options: { recursive: true }): Promise<unknown>;
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  rename(oldPath: string, newPath: string): Promise<void>;
  rm(path: string, options: { force: true }): Promise<void>;
  writeFile(path: string, data: Buffer): Promise<void>;
}

export interface DocumentConverterDependencies {
  browserLocatorFactory?: (options: ConvertOptions) => BrowserLocatorLike;
  fileSystem?: ConverterFileSystem;
  printPdf?: (options: WebDriverPrintOptions) => Promise<Buffer>;
  tempDir?: string;
  webdriverSessionFactory?: WebDriverSessionFactory;
}

export type ConvertFile = (
  sourcePath: string,
  outputPath: string,
  options?: ConvertOptions,
) => Promise<void>;

const defaultRenderTimeoutMs = 30_000;

const nodeFileSystem: ConverterFileSystem = {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
};

export function createConverter(dependencies: DocumentConverterDependencies = {}): ConvertFile {
  const converter = new DocumentConverter(dependencies);

  return (sourcePath, outputPath, options) =>
    converter.convertFile(sourcePath, outputPath, options);
}

export async function convertFile(
  sourcePath: string,
  outputPath: string,
  options: ConvertOptions = {},
): Promise<void> {
  await new DocumentConverter().convertFile(sourcePath, outputPath, options);
}

export class DocumentConverter {
  private readonly browserLocatorFactory: (options: ConvertOptions) => BrowserLocatorLike;
  private readonly fileSystem: ConverterFileSystem;
  private readonly printPdf: (options: WebDriverPrintOptions) => Promise<Buffer>;
  private readonly tempDir: string | undefined;
  private readonly webdriverSessionFactory: WebDriverSessionFactory;

  constructor(dependencies: DocumentConverterDependencies = {}) {
    this.browserLocatorFactory = dependencies.browserLocatorFactory ?? defaultBrowserLocatorFactory;
    this.fileSystem = dependencies.fileSystem ?? nodeFileSystem;
    this.printPdf = dependencies.printPdf ?? printPdfWithWebDriver;
    this.tempDir = dependencies.tempDir;
    this.webdriverSessionFactory = dependencies.webdriverSessionFactory ?? new SpawnedWebDriverSessionFactory();
  }

  async convertFile(
    sourcePath: string,
    outputPath: string,
    options: ConvertOptions = {},
  ): Promise<void> {
    const absoluteSourcePath = resolve(sourcePath);
    const absoluteOutputPath = resolve(outputPath);
    const renderTimeoutMs = options.renderTimeoutMs ?? defaultRenderTimeoutMs;
    let markdown: string;
    try {
      markdown = await this.fileSystem.readFile(absoluteSourcePath, "utf8");
    } catch (cause) {
      throw new ConversionError({
        message: "Markdown source could not be read during conversion",
        sourcePath: absoluteSourcePath,
        outputPath: absoluteOutputPath,
        actionHint: "Check that the Markdown source still exists and is readable.",
        cause,
      });
    }

    const browser = await this.browserLocatorFactory(options).locate();

    // renderTimeoutMs bounds two clocks that start at different instants: the
    // outer withTempHtml budget covers the whole callback including WebDriver
    // session startup, while the same value caps each WebDriver request after
    // the session exists. The outer timeout aborts the inner work via the
    // callback signal, so the conversion never outlives the outer budget.
    const pdf = await withTempHtml(
      markdown,
      {
        sourcePath: absoluteSourcePath,
        baseDir: dirname(absoluteSourcePath),
        documentTitle: basename(absoluteSourcePath),
        tempDir: this.tempDir,
      },
      (_htmlPath, htmlFileUrl, signal) =>
        this.printWithSpawnedDriver(browser, options, htmlFileUrl, signal, renderTimeoutMs),
      renderTimeoutMs,
    );

    await this.writePdfAtomically(absoluteOutputPath, pdf, sourcePath);
  }

  private async printWithSpawnedDriver(
    browser: LocatedBrowser,
    options: ConvertOptions,
    htmlFileUrl: string,
    signal: AbortSignal,
    renderTimeoutMs: number,
  ): Promise<Buffer> {
    let driverProcess: DriverProcessHandle | undefined;
    const onAbort = (): void => { void driverProcess?.stop(signal); };
    signal.addEventListener("abort", onAbort, { once: true });

    try {
      const session = await this.webdriverSessionFactory.start(browser, options);
      driverProcess = session.driverProcess;
      if (signal.aborted) {
        void session.driverProcess.stop();
      }
      return await this.printPdf({
        browser,
        htmlFileUrl,
        transport: session.transport,
        driverProcess: session.driverProcess,
        renderTimeoutMs,
      });
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
  }

  private async writePdfAtomically(
    outputPath: string,
    pdf: Buffer,
    originalSourcePath: string,
  ): Promise<void> {
    const outputDirectory = dirname(outputPath);
    const temporaryOutputPath = join(
      outputDirectory,
      `.${basename(outputPath)}.${randomUUID()}.tmp`,
    );

    try {
      await this.fileSystem.mkdir(outputDirectory, { recursive: true });
      await this.fileSystem.writeFile(temporaryOutputPath, pdf);
      await this.fileSystem.rename(temporaryOutputPath, outputPath);
    } catch (cause) {
      await this.removeTemporaryOutput(temporaryOutputPath);
      throw new ConversionError({
        message: "Failed to write rendered PDF output",
        sourcePath: originalSourcePath,
        outputPath,
        actionHint: "Check that the output directory is writable and has enough free space.",
        cause,
      });
    }
  }

  private async removeTemporaryOutput(temporaryOutputPath: string): Promise<void> {
    try {
      await this.fileSystem.rm(temporaryOutputPath, { force: true });
    } catch {
      // Best effort cleanup: the conversion has already failed.
    }
  }
}

function defaultBrowserLocatorFactory(options: ConvertOptions): BrowserLocatorLike {
  const env = options.browserPath === undefined
    ? process.env
    : { ...process.env, MD2PDF_BROWSER: options.browserPath };
  const policy = new ArtifactPolicy();
  const catalog = new JsonReleaseCatalog();

  return new BrowserLocator({
    env,
    driverResolver: new ArtifactPolicyDriverResolver({ policy, catalog }),
    fallbackBrowserResolver: new ArtifactPolicyFallbackBrowserResolver(policy, catalog),
  });
}

class ArtifactPolicyFallbackBrowserResolver implements FallbackBrowserResolver {
  constructor(
    private readonly policy: ArtifactPolicy,
    private readonly catalog: JsonReleaseCatalog,
  ) {}

  async resolveFallbackBrowser(): Promise<LocatedBrowser | null> {
    const fallback = await provisionFallbackBrowser(this.policy, this.catalog);

    return {
      browserPath: fallback.browserPath,
      displayName: "Chromium",
      driverArtifactName: "chromedriver",
      driverPath: fallback.driverPath,
      kind: "chromium",
      version: fallback.release.version,
    };
  }
}
