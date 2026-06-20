import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { isSnapBrowser, type BrowserKind, type LocatedBrowser } from "./browserLocator.js";
import { RenderError } from "./errors.js";

export interface WebDriverRequest {
  method: "DELETE" | "POST";
  path: string;
  body?: unknown;
  signal?: AbortSignal;
}

export interface WebDriverTransport {
  request<T>(request: WebDriverRequest): Promise<T>;
}

export interface DriverProcessHandle {
  stop(signal?: AbortSignal): Promise<void>;
}

export interface WebDriverPrintOptions {
  browser: LocatedBrowser;
  htmlFileUrl: string;
  transport: WebDriverTransport;
  driverProcess: DriverProcessHandle;
  renderTimeoutMs?: number;
  mermaidPollMs?: number;
  cleanupTimeoutMs?: number;
  print?: WebDriverPrintSettings;
}

export interface WebDriverPrintSettings {
  background?: boolean;
  margin?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  orientation?: "portrait" | "landscape";
  page?: {
    width?: number;
    height?: number;
  };
  scale?: number;
  shrinkToFit?: boolean;
}

export interface WebDriverHttpTransportOptions {
  fetch?: typeof fetch;
}

interface SessionResponse {
  value?: {
    sessionId?: string;
    capabilities?: unknown;
  };
  sessionId?: string;
}

interface ExecuteResponse {
  value?: unknown;
}

interface PrintResponse {
  value?: {
    data?: string;
  } | string;
}

const defaultRenderTimeoutMs = 30_000;
const defaultMermaidPollMs = 100;
const defaultCleanupTimeoutMs = 5_000;
const defaultPrintSettings: Required<WebDriverPrintSettings> = {
  background: true,
  margin: {
    top: 0.4,
    bottom: 0.4,
    left: 0.4,
    right: 0.4,
  },
  orientation: "portrait",
  page: {
    width: 8.27,
    height: 11.69,
  },
  scale: 1,
  shrinkToFit: true,
};

export class WebDriverHttpTransport implements WebDriverTransport {
  private readonly baseUrl: URL;
  private readonly fetch: typeof fetch;

  constructor(baseUrl: string | URL, options: WebDriverHttpTransportOptions = {}) {
    this.baseUrl = localWebDriverUrl(baseUrl);
    this.fetch = options.fetch ?? fetch;
  }

  async request<T>(request: WebDriverRequest): Promise<T> {
    const endpoint = webDriverEndpoint(this.baseUrl, request.path);
    let response: Response;
    try {
      response = await this.fetch(endpoint, {
        method: request.method,
        headers: request.body === undefined ? undefined : { "content-type": "application/json" },
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        signal: request.signal,
      });
    } catch (cause) {
      throw new RenderError({
        message: "WebDriver request failed",
        actionHint: "Check that the local WebDriver process is running and reachable.",
        cause: {
          method: request.method,
          path: request.path,
          cause,
        },
      });
    }

    const raw = await response.text();
    const body = raw === "" ? {} : parseJson(raw, request.path);
    if (!response.ok) {
      throw new RenderError({
        message: "WebDriver request failed",
        actionHint: "Check that the local WebDriver process is running and compatible with the browser.",
        cause: {
          method: request.method,
          path: request.path,
          status: response.status,
          body,
        },
      });
    }

    return body as T;
  }
}

export async function printPdfWithWebDriver(options: WebDriverPrintOptions): Promise<Buffer> {
  const timeoutMs = options.renderTimeoutMs ?? defaultRenderTimeoutMs;
  const pollMs = options.mermaidPollMs ?? defaultMermaidPollMs;
  const cleanupTimeoutMs = options.cleanupTimeoutMs ?? defaultCleanupTimeoutMs;
  let sessionId: string | null = null;
  let primaryFailure: unknown;
  let browserProfileDir: string | undefined;

  try {
    assertFileUrl(options.htmlFileUrl);
    browserProfileDir = await createBrowserProfileDir(options.browser);
    const session = await requestWithTimeout<SessionResponse>(options.transport, {
      method: "POST",
      path: "/session",
      body: {
        capabilities: {
          alwaysMatch: browserCapabilities(
            options.browser.kind,
            options.browser.browserPath,
            browserProfileDir,
          ),
        },
      },
    }, timeoutMs, "webdriver-session-timeout");
    sessionId = readSessionId(session);
    await navigateToFile(options.transport, sessionId, options.htmlFileUrl, timeoutMs);
    await waitForMermaid(options.transport, sessionId, timeoutMs, pollMs);

    const printed = await requestWithTimeout<PrintResponse>(options.transport, {
      method: "POST",
      path: `/session/${encodeURIComponent(sessionId)}/print`,
      body: printCommandBody(options.print),
    }, timeoutMs, "webdriver-print-timeout");

    return readPdfData(printed);
  } catch (cause) {
    primaryFailure = cause;
    if (cause instanceof RenderError) {
      throw cause;
    }

    throw new RenderError({
      message: "WebDriver PDF rendering failed",
      actionHint: "Check that the browser and WebDriver are compatible and that the HTML file is local.",
      cause,
    });
  } finally {
    if (sessionId !== null) {
      await handleCleanup(
        requestWithTimeout(
          options.transport,
          {
            method: "DELETE",
            path: `/session/${encodeURIComponent(sessionId)}`,
          },
          cleanupTimeoutMs,
          "webdriver-session-cleanup-timeout",
        ),
        primaryFailure,
        "WebDriver session cleanup failed",
      );
    }

    await handleCleanup(
      withAbortableTimeout(
        (signal) => options.driverProcess.stop(signal),
        cleanupTimeoutMs,
        "webdriver-driver-cleanup-timeout",
      ),
      primaryFailure,
      "WebDriver driver process cleanup failed",
    );

    if (browserProfileDir !== undefined) {
      await handleCleanup(
        rm(browserProfileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }),
        primaryFailure,
        "Browser profile cleanup failed",
      );
    }
  }
}

function printCommandBody(settings: WebDriverPrintSettings = {}): Required<WebDriverPrintSettings> {
  return {
    background: settings.background ?? defaultPrintSettings.background,
    margin: {
      top: settings.margin?.top ?? defaultPrintSettings.margin.top,
      bottom: settings.margin?.bottom ?? defaultPrintSettings.margin.bottom,
      left: settings.margin?.left ?? defaultPrintSettings.margin.left,
      right: settings.margin?.right ?? defaultPrintSettings.margin.right,
    },
    orientation: settings.orientation ?? defaultPrintSettings.orientation,
    page: {
      width: settings.page?.width ?? defaultPrintSettings.page.width,
      height: settings.page?.height ?? defaultPrintSettings.page.height,
    },
    scale: settings.scale ?? defaultPrintSettings.scale,
    shrinkToFit: settings.shrinkToFit ?? defaultPrintSettings.shrinkToFit,
  };
}

function localWebDriverUrl(value: string | URL): URL {
  const url = new URL(value);
  if (url.protocol !== "http:" || !isLocalHost(url.hostname)) {
    throw new RenderError({
      message: "WebDriver transport only accepts local HTTP endpoints",
      actionHint: "Start the WebDriver process on localhost or 127.0.0.1.",
      cause: "non-local-webdriver",
    });
  }

  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }

  return url;
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function parseJson(raw: string, path: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new RenderError({
      message: "WebDriver returned invalid JSON",
      actionHint: "Check that the endpoint is a W3C WebDriver server.",
      cause: { path, cause },
    });
  }
}

function webDriverEndpoint(baseUrl: URL, path: string): URL {
  if (/^[a-z][a-z0-9+.-]*:/iu.test(path) || path.startsWith("//")) {
    throw new RenderError({
      message: "WebDriver request path must stay on the local WebDriver endpoint",
      actionHint: "Use a relative WebDriver command path such as /session.",
      cause: "non-local-webdriver-path",
    });
  }

  const endpoint = new URL(path.startsWith("/") ? path.slice(1) : path, baseUrl);
  if (endpoint.origin !== baseUrl.origin) {
    throw new RenderError({
      message: "WebDriver request path must stay on the local WebDriver endpoint",
      actionHint: "Use a relative WebDriver command path such as /session.",
      cause: "non-local-webdriver-path",
    });
  }

  return endpoint;
}

function requestWithTimeout<T>(
  transport: WebDriverTransport,
  request: WebDriverRequest,
  timeoutMs: number,
  cause: string,
): Promise<T> {
  return withAbortableTimeout(
    (signal) => transport.request<T>({ ...request, signal }),
    timeoutMs,
    cause,
  );
}

async function withAbortableTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  cause: string,
): Promise<T> {
  const controller = new AbortController();
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          const error = timeoutError(cause);
          controller.abort(error);
          reject(error);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

function timeoutError(cause: string): RenderError {
  return new RenderError({
    message: "WebDriver operation timed out",
    actionHint: "Check that the browser and WebDriver are responsive.",
    cause,
  });
}

async function handleCleanup(
  cleanup: Promise<unknown>,
  primaryFailure: unknown,
  message: string,
): Promise<void> {
  try {
    await cleanup;
  } catch (cause) {
    if (primaryFailure !== undefined) {
      return;
    }

    throw new RenderError({
      message,
      actionHint: "Ensure WebDriver can close sessions and stop the driver process.",
      cause,
    });
  }
}

async function createBrowserProfileDir(browser: LocatedBrowser): Promise<string | undefined> {
  if (browser.kind === "firefox") {
    return undefined;
  }

  return mkdtemp(join(tmpdir(), "md2pdf-browser-profile-"));
}

function browserCapabilities(
  kind: BrowserKind,
  browserPath: string,
  browserProfileDir: string | undefined,
): Record<string, unknown> {
  const proxy = { proxyType: "direct" };

  if (kind === "firefox") {
    // Snap Firefox: omit the binary capability so geckodriver auto-detects and
    // launches the snap launcher. Passing the snap path fails with
    // "binary is not a Firefox executable".
    const firefoxOptions: Record<string, unknown> = {
      args: ["-headless", "--offline"],
    };
    if (!isSnapBrowser(browserPath)) {
      firefoxOptions.binary = browserPath;
    }

    return {
      browserName: "firefox",
      proxy,
      "moz:firefoxOptions": firefoxOptions,
    };
  }

  return {
    browserName: kind === "edge" ? "MicrosoftEdge" : "chrome",
    proxy,
    "goog:chromeOptions": {
      binary: browserPath,
      args: [
        "--headless=new",
        "--remote-debugging-pipe",
        "--disable-background-networking",
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--no-proxy-server",
        "--proxy-server=direct://",
        "--proxy-bypass-list=*",
        ...(browserProfileDir === undefined ? [] : [`--user-data-dir=${browserProfileDir}`]),
      ],
    },
  };
}

async function navigateToFile(
  transport: WebDriverTransport,
  sessionId: string,
  htmlFileUrl: string,
  timeoutMs: number,
): Promise<void> {
  await requestWithTimeout(transport, {
    method: "POST",
    path: `/session/${encodeURIComponent(sessionId)}/url`,
    body: { url: htmlFileUrl },
  }, timeoutMs, "webdriver-navigation-timeout");
}

async function waitForMermaid(
  transport: WebDriverTransport,
  sessionId: string,
  timeoutMs: number,
  pollMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const remainingMs = Math.max(1, deadline - Date.now());
    const response = await requestWithTimeout<ExecuteResponse>(transport, {
      method: "POST",
      path: `/session/${encodeURIComponent(sessionId)}/execute/sync`,
      body: { script: mermaidReadyScript, args: [] },
    }, remainingMs, "webdriver-mermaid-poll-timeout");

    if (response.value === true) {
      return;
    }

    if (isMermaidRenderError(response.value)) {
      throw new RenderError({
        message: "Mermaid diagram rendering failed",
        actionHint: "Check the Mermaid diagram syntax in the source Markdown.",
        cause: response.value.mermaidError,
      });
    }

    await delay(pollMs);
  }

  throw new RenderError({
    message: "Timed out waiting for Mermaid diagrams to finish rendering",
    actionHint: "Reduce diagram complexity or increase the render timeout.",
    cause: "mermaid-timeout",
  });
}

function isMermaidRenderError(value: unknown): value is { mermaidError: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "mermaidError" in value &&
    typeof (value as { mermaidError: unknown }).mermaidError === "string"
  );
}

function readSessionId(response: SessionResponse): string {
  const sessionId = response.value?.sessionId ?? response.sessionId;
  if (typeof sessionId !== "string" || sessionId === "") {
    throw new Error("WebDriver did not return a session id");
  }

  return sessionId;
}

function readPdfData(response: PrintResponse): Buffer {
  const value = response.value;
  const data = typeof value === "string" ? value : value?.data;
  if (typeof data !== "string" || data === "") {
    throw new Error("WebDriver Print did not return PDF data");
  }

  const pdf = Buffer.from(data, "base64");
  if (pdf.byteLength < 5 || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("WebDriver Print did not return PDF data");
  }

  return pdf;
}

function assertFileUrl(value: string): void {
  try {
    const url = new URL(value);
    if (url.protocol === "file:" && (url.hostname === "" || url.hostname === "localhost")) {
      return;
    }
  } catch {
    // Wrapped below with the stable project error type.
  }

  throw new RenderError({
    message: "WebDriver rendering only accepts local file: URLs",
    actionHint: "Render Markdown to a temporary local HTML file before printing.",
    cause: "non-local-html",
  });
}

const mermaidReadyScript = `
const status = document.documentElement.getAttribute("data-mermaid-status");
if (status === "done") return true;
if (status === "error") {
  const msg = document.documentElement.getAttribute("data-mermaid-error") || "Mermaid diagram rendering failed";
  return { mermaidError: msg };
}
return false;
`;
