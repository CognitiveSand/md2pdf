import { spawn, type ChildProcessByStdio } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { basename, dirname, join, resolve } from "node:path";
import type { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";

import { ArtifactPolicy } from "./artifactPolicy.js";
import {
  ArtifactPolicyDriverResolver,
  BrowserLocator,
  type FallbackBrowserResolver,
  type LocatedBrowser,
} from "./browserLocator.js";
import type { ConvertOptions } from "./contracts.js";
import { ConversionError, RenderError } from "./errors.js";
import { provisionFallbackBrowser } from "./fallbackBrowserProvisioner.js";
import { withTempHtml } from "./markdownRenderer.js";
import { JsonReleaseCatalog } from "./releaseCatalog.js";
import {
  printPdfWithWebDriver,
  type DriverProcessHandle,
  type WebDriverPrintOptions,
  type WebDriverTransport,
  WebDriverHttpTransport,
} from "./webDriverClient.js";

export interface BrowserLocatorLike {
  locate(): Promise<LocatedBrowser>;
}

interface WebDriverSession {
  transport: WebDriverTransport;
  driverProcess: DriverProcessHandle;
}

export interface WebDriverSessionFactory {
  start(browser: LocatedBrowser, options: ConvertOptions): Promise<WebDriverSession>;
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

const defaultRenderTimeoutMs = 30_000;
const driverStartupTimeoutMs = 10_000;
const driverStartupPollMs = 50;
const driverShutdownTimeoutMs = 5_000;

const nodeFileSystem: ConverterFileSystem = {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
};

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
    const markdown = await this.fileSystem.readFile(absoluteSourcePath, "utf8");
    const browser = await this.browserLocatorFactory(options).locate();

    const pdf = await withTempHtml(
      markdown,
      {
        sourcePath: absoluteSourcePath,
        baseDir: dirname(absoluteSourcePath),
        documentTitle: basename(absoluteSourcePath),
        tempDir: this.tempDir,
      },
      async (_htmlPath, htmlFileUrl, signal) => {
        let driverProcess: DriverProcessHandle | undefined;
        const onAbort = (): void => { void driverProcess?.stop(); };
        signal.addEventListener("abort", onAbort, { once: true });

        try {
          const session = await this.webdriverSessionFactory.start(browser, options);
          driverProcess = session.driverProcess;
          if (signal.aborted) {
            void driverProcess.stop();
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
      },
      renderTimeoutMs,
    );

    await this.writePdfAtomically(absoluteOutputPath, pdf, sourcePath);
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

const driverStartupPortRetries = 3;

export class SpawnedWebDriverSessionFactory implements WebDriverSessionFactory {
  async start(browser: LocatedBrowser): Promise<WebDriverSession> {
    let lastCause: unknown;

    for (let attempt = 0; attempt < driverStartupPortRetries; attempt++) {
      const port = await findOpenLocalPort();
      const driverProcess = new SpawnedDriverProcess(
        spawn(browser.driverPath, driverArguments(browser, port), {
          stdio: ["ignore", "pipe", "pipe"],
        }),
      );
      const baseUrl = `http://127.0.0.1:${port}/`;

      try {
        await waitForWebDriverStatus(baseUrl, driverProcess);
        return {
          transport: new WebDriverHttpTransport(baseUrl),
          driverProcess,
        };
      } catch (cause) {
        await driverProcess.stop().catch(() => undefined);
        lastCause = cause;
      }
    }

    throw new RenderError({
      message: "WebDriver process did not become ready",
      actionHint: "Check that the selected WebDriver binary can start on a local port.",
      cause: lastCause,
    });
  }
}

class SpawnedDriverProcess implements DriverProcessHandle {
  readonly process: DriverChildProcess;
  private startupError: Error | undefined;
  private stopped = false;

  constructor(process: DriverChildProcess) {
    this.process = process;
    this.process.stdout.resume();
    this.process.stderr.resume();
    this.process.once("error", (error) => {
      this.startupError = error;
    });
  }

  async stop(signal?: AbortSignal): Promise<void> {
    if (this.stopped || this.process.exitCode !== null || this.process.signalCode !== null) {
      this.stopped = true;
      return;
    }

    this.stopped = true;
    this.process.kill();

    await waitForProcessExit(this.process, signal);
  }

  hasExited(): boolean {
    return this.startupError !== undefined ||
      this.process.exitCode !== null ||
      this.process.signalCode !== null;
  }

  failure(): Error | undefined {
    return this.startupError;
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

function driverArguments(browser: LocatedBrowser, port: number): string[] {
  if (browser.driverArtifactName === "geckodriver") {
    return ["--port", String(port)];
  }

  return [`--port=${port}`];
}

async function findOpenLocalPort(): Promise<number> {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.once("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close(() => rejectPort(new Error("Could not allocate a local WebDriver port")));
        return;
      }

      server.close(() => resolvePort(address.port));
    });
  });
}

async function waitForWebDriverStatus(
  baseUrl: string,
  driverProcess: SpawnedDriverProcess,
): Promise<void> {
  const deadline = Date.now() + driverStartupTimeoutMs;
  let lastError: unknown;

  while (Date.now() <= deadline) {
    const startupFailure = driverProcess.failure();
    if (startupFailure !== undefined) {
      throw startupFailure;
    }

    if (driverProcess.hasExited()) {
      throw new Error("WebDriver process exited before it was ready");
    }

    try {
      const response = await fetch(new URL("status", baseUrl));
      if (response.ok) {
        return;
      }
      lastError = new Error(`WebDriver status returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(driverStartupPollMs);
  }

  throw lastError ?? new Error("Timed out waiting for WebDriver status");
}

async function waitForProcessExit(
  process: DriverChildProcess,
  signal?: AbortSignal,
): Promise<void> {
  if (process.exitCode !== null || process.signalCode !== null) {
    return;
  }

  await new Promise<void>((resolveExit, rejectExit) => {
    const timeout = setTimeout(() => {
      process.kill("SIGKILL");
      resolveExit();
    }, driverShutdownTimeoutMs);

    const cleanup = (): void => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      process.removeListener("close", onExit);
      process.removeListener("error", onError);
    };
    const onExit = (): void => {
      cleanup();
      resolveExit();
    };
    const onError = (error: Error): void => {
      cleanup();
      rejectExit(error);
    };
    const onAbort = (): void => {
      process.kill("SIGKILL");
      cleanup();
      rejectExit(signal?.reason);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
    process.once("close", onExit);
    process.once("error", onError);
  });
}

type DriverChildProcess = ChildProcessByStdio<null, Readable, Readable>;
