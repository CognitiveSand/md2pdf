import { describe, expect, it } from "vitest";

import type { LocatedBrowser } from "../../../src/browserLocator.js";
import { RenderError } from "../../../src/errors.js";
import {
  printPdfWithWebDriver,
  type DriverProcessHandle,
  type WebDriverRequest,
  type WebDriverTransport,
  WebDriverHttpTransport,
} from "../../../src/webDriverClient.js";

describe("printPdfWithWebDriver", () => {
  it("@req FR-07 opens a local file URL with offline browser flags and returns PDF bytes", async () => {
    const transport = new FakeTransport([
      { value: { sessionId: "session-1" } },
      { value: null },
      { value: true },
      { value: Buffer.from("%PDF-1.7").toString("base64") },
      { value: null },
    ]);
    const driverProcess = new FakeDriverProcess();

    const pdf = await printPdfWithWebDriver({
      browser: browser("chrome"),
      htmlFileUrl: "file:///tmp/doc.html",
      transport,
      driverProcess,
      renderTimeoutMs: 50,
      mermaidPollMs: 1,
    });

    expect(pdf.toString()).toBe("%PDF-1.7");
    expect(driverProcess.stopped).toBe(true);
    expect(transport.requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      "POST /session",
      "POST /session/session-1/url",
      "POST /session/session-1/execute/sync",
      "POST /session/session-1/print",
      "DELETE /session/session-1",
    ]);
    expect(transport.requests[0]?.body).toMatchObject({
      capabilities: {
        alwaysMatch: {
          proxy: { proxyType: "direct" },
          "goog:chromeOptions": {
            args: expect.arrayContaining([
              "--headless=new",
              "--disable-dev-shm-usage",
              "--no-proxy-server",
              "--proxy-server=direct://",
              expect.stringMatching(/^--user-data-dir=.+/u),
            ]),
          },
        },
      },
    });
    expect(transport.requests[3]?.body).toEqual({
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
    });
  });

  it("@req FR-07 starts Firefox with headless and offline flags", async () => {
    const transport = new FakeTransport([
      { value: { sessionId: "session-firefox" } },
      { value: null },
      { value: true },
      { value: Buffer.from("%PDF-1.7").toString("base64") },
      { value: null },
    ]);

    await printPdfWithWebDriver({
      browser: browser("firefox"),
      htmlFileUrl: "file:///tmp/doc.html",
      transport,
      driverProcess: new FakeDriverProcess(),
      renderTimeoutMs: 50,
      mermaidPollMs: 1,
    });

    expect(transport.requests[0]?.body).toMatchObject({
      capabilities: {
        alwaysMatch: {
          "moz:firefoxOptions": {
            args: expect.arrayContaining(["-headless", "--offline"]),
          },
        },
      },
    });
  });

  it("@req FR-07 sends explicit print settings to WebDriver", async () => {
    const transport = new FakeTransport([
      { value: { sessionId: "session-print-settings" } },
      { value: null },
      { value: true },
      { value: Buffer.from("%PDF-1.7").toString("base64") },
      { value: null },
    ]);

    await printPdfWithWebDriver({
      browser: browser("chrome"),
      htmlFileUrl: "file:///tmp/doc.html",
      transport,
      driverProcess: new FakeDriverProcess(),
      renderTimeoutMs: 50,
      mermaidPollMs: 1,
      print: {
        background: false,
        margin: { top: 0.2 },
        orientation: "landscape",
        page: { width: 11, height: 8.5 },
        scale: 0.9,
        shrinkToFit: false,
      },
    });

    expect(transport.requests[3]?.body).toEqual({
      background: false,
      margin: {
        top: 0.2,
        bottom: 0.4,
        left: 0.4,
        right: 0.4,
      },
      orientation: "landscape",
      page: {
        width: 11,
        height: 8.5,
      },
      scale: 0.9,
      shrinkToFit: false,
    });
  });

  it("@req FR-24 wraps Mermaid timeout and closes session and driver process", async () => {
    const transport = new FakeTransport([
      { value: { sessionId: "session-2" } },
      { value: null },
      { value: false },
      { value: false },
      { value: null },
    ]);
    const driverProcess = new FakeDriverProcess();

    await expect(
      printPdfWithWebDriver({
        browser: browser("firefox"),
        htmlFileUrl: "file:///tmp/doc.html",
        transport,
        driverProcess,
        renderTimeoutMs: 1,
        mermaidPollMs: 1,
      }),
    ).rejects.toMatchObject({
      kind: "render",
      context: { cause: "mermaid-timeout" },
    });

    expect(driverProcess.stopped).toBe(true);
    expect(transport.requests.some((request) => request.method === "DELETE")).toBe(true);
  });

  it("@req FR-24 surfaces Mermaid render errors and closes session and driver process", async () => {
    const transport = new FakeTransport([
      { value: { sessionId: "session-mermaid-err" } },
      { value: null },
      { value: { mermaidError: "Parse error on line 2" } },
      { value: null },
    ]);
    const driverProcess = new FakeDriverProcess();

    await expect(
      printPdfWithWebDriver({
        browser: browser("chrome"),
        htmlFileUrl: "file:///tmp/doc.html",
        transport,
        driverProcess,
        renderTimeoutMs: 100,
        mermaidPollMs: 1,
      }),
    ).rejects.toMatchObject({
      kind: "render",
      context: { cause: "Parse error on line 2" },
    });

    expect(driverProcess.stopped).toBe(true);
    expect(transport.requests.some((request) => request.method === "DELETE")).toBe(true);
  });

  it("@req NFR-02 rejects non-local URLs without leaving the driver process open", async () => {
    const driverProcess = new FakeDriverProcess();

    await expect(
      printPdfWithWebDriver({
        browser: browser("chrome"),
        htmlFileUrl: "https://example.invalid/doc.html",
        transport: new FakeTransport([]),
        driverProcess,
      }),
    ).rejects.toThrow(RenderError);

    expect(driverProcess.stopped).toBe(true);
  });

  it("@req NFR-02 rejects file URLs that point at a network host", async () => {
    const driverProcess = new FakeDriverProcess();

    await expect(
      printPdfWithWebDriver({
        browser: browser("chrome"),
        htmlFileUrl: "file://server/share/doc.html",
        transport: new FakeTransport([]),
        driverProcess,
      }),
    ).rejects.toMatchObject({
      kind: "render",
      context: { cause: "non-local-html" },
    });

    expect(driverProcess.stopped).toBe(true);
  });

  it("@req FR-07 wraps a hung WebDriver print command in RenderError", async () => {
    const transport = new FakeTransport([
      { value: { sessionId: "session-3" } },
      { value: null },
      { value: true },
      new Promise(() => {}),
      { value: null },
    ]);

    await expect(
      printPdfWithWebDriver({
        browser: browser("chrome"),
        htmlFileUrl: "file:///tmp/doc.html",
        transport,
        driverProcess: new FakeDriverProcess(),
        renderTimeoutMs: 1,
        mermaidPollMs: 1,
      }),
    ).rejects.toMatchObject({
      kind: "render",
      context: { cause: "webdriver-print-timeout" },
    });
  });

  it("@req FR-07 aborts a hung WebDriver transport request on timeout", async () => {
    let printSignal: AbortSignal | undefined;
    const transport = new FakeTransport([
      { value: { sessionId: "session-6" } },
      { value: null },
      { value: true },
      new Promise(() => {}),
      { value: null },
    ], (request) => {
      if (request.path.endsWith("/print")) {
        printSignal = request.signal;
      }
    });

    await expect(
      printPdfWithWebDriver({
        browser: browser("chrome"),
        htmlFileUrl: "file:///tmp/doc.html",
        transport,
        driverProcess: new FakeDriverProcess(),
        renderTimeoutMs: 1,
        mermaidPollMs: 1,
      }),
    ).rejects.toMatchObject({
      kind: "render",
      context: { cause: "webdriver-print-timeout" },
    });

    expect(printSignal?.aborted).toBe(true);
  });

  it("@req FR-07 fails loud when cleanup fails after a successful print", async () => {
    const transport = new FakeTransport([
      { value: { sessionId: "session-4" } },
      { value: null },
      { value: true },
      { value: Buffer.from("%PDF-1.7").toString("base64") },
      { value: null },
    ]);

    await expect(
      printPdfWithWebDriver({
        browser: browser("chrome"),
        htmlFileUrl: "file:///tmp/doc.html",
        transport,
        driverProcess: new FakeDriverProcess(new Error("stop failed")),
        renderTimeoutMs: 50,
        mermaidPollMs: 1,
      }),
    ).rejects.toMatchObject({
      kind: "render",
      context: {
        message: "WebDriver driver process cleanup failed",
      },
    });
  });

  it("@req FR-07 aborts a hung driver cleanup on timeout", async () => {
    const transport = new FakeTransport([
      { value: { sessionId: "session-7" } },
      { value: null },
      { value: true },
      { value: Buffer.from("%PDF-1.7").toString("base64") },
      { value: null },
    ]);
    let stopSignal: AbortSignal | undefined;

    await expect(
      printPdfWithWebDriver({
        browser: browser("chrome"),
        htmlFileUrl: "file:///tmp/doc.html",
        transport,
        driverProcess: {
          stop(signal?: AbortSignal): Promise<void> {
            stopSignal = signal;
            return new Promise(() => {});
          },
        },
        renderTimeoutMs: 50,
        mermaidPollMs: 1,
        cleanupTimeoutMs: 1,
      }),
    ).rejects.toMatchObject({
      kind: "render",
      context: {
        message: "WebDriver driver process cleanup failed",
        cause: {
          context: { cause: "webdriver-driver-cleanup-timeout" },
        },
      },
    });

    expect(stopSignal?.aborted).toBe(true);
  });

  it("@req FR-07 rejects non-PDF WebDriver print data", async () => {
    const transport = new FakeTransport([
      { value: { sessionId: "session-5" } },
      { value: null },
      { value: true },
      { value: Buffer.from("not a pdf").toString("base64") },
      { value: null },
    ]);

    await expect(
      printPdfWithWebDriver({
        browser: browser("chrome"),
        htmlFileUrl: "file:///tmp/doc.html",
        transport,
        driverProcess: new FakeDriverProcess(),
        renderTimeoutMs: 50,
        mermaidPollMs: 1,
      }),
    ).rejects.toMatchObject({
      kind: "render",
    });
  });
});

describe("WebDriverHttpTransport", () => {
  it("@req FR-07 sends JSON requests to a local WebDriver endpoint", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const transport = new WebDriverHttpTransport("http://127.0.0.1:9515/wd/hub/", {
      fetch: async (url, init) => {
        requests.push({ url: String(url), init });
        return new Response(JSON.stringify({ value: { sessionId: "session-http" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });

    await expect(
      transport.request({
        method: "POST",
        path: "/session",
        body: { capabilities: { alwaysMatch: {} } },
      }),
    ).resolves.toEqual({ value: { sessionId: "session-http" } });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("http://127.0.0.1:9515/wd/hub/session");
    expect(requests[0]?.init).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"capabilities":{"alwaysMatch":{}}}',
    });
  });

  it("@req NFR-02 rejects non-local WebDriver endpoints", () => {
    expect(() => new WebDriverHttpTransport("http://example.invalid:9515")).toThrow(RenderError);
  });

  it("@req NFR-02 rejects absolute request paths that would escape localhost", async () => {
    const transport = new WebDriverHttpTransport("http://127.0.0.1:9515/wd/hub/", {
      fetch: async () => {
        throw new Error("fetch should not be called");
      },
    });

    await expect(
      transport.request({
        method: "POST",
        path: "http://example.invalid/session",
        body: {},
      }),
    ).rejects.toMatchObject({
      kind: "render",
      context: { cause: "non-local-webdriver-path" },
    });
  });

  it("@req FR-07 wraps WebDriver HTTP errors with response context", async () => {
    const transport = new WebDriverHttpTransport("http://127.0.0.1:9515", {
      fetch: async () => new Response(JSON.stringify({ value: { error: "session not created" } }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    });

    await expect(
      transport.request({
        method: "POST",
        path: "/session",
        body: {},
      }),
    ).rejects.toMatchObject({
      kind: "render",
      context: {
        cause: {
          status: 500,
          path: "/session",
        },
      },
    });
  });

  it("@req FR-07 wraps WebDriver network failures with request context", async () => {
    const transport = new WebDriverHttpTransport("http://127.0.0.1:9515", {
      fetch: async () => {
        throw new TypeError("connection refused");
      },
    });

    await expect(
      transport.request({
        method: "POST",
        path: "/session",
        body: {},
      }),
    ).rejects.toMatchObject({
      kind: "render",
      context: {
        cause: {
          method: "POST",
          path: "/session",
          cause: expect.any(TypeError),
        },
      },
    });
  });
});

function browser(kind: LocatedBrowser["kind"]): LocatedBrowser {
  return {
    kind,
    displayName: kind,
    browserPath: `/browsers/${kind}`,
    driverPath: "/drivers/driver",
    driverArtifactName: kind === "firefox" ? "geckodriver" : "chromedriver",
  };
}

class FakeTransport implements WebDriverTransport {
  readonly requests: WebDriverRequest[] = [];

  constructor(
    private readonly responses: unknown[],
    private readonly onRequest: (request: WebDriverRequest) => void = () => {},
  ) {}

  async request<T>(request: WebDriverRequest): Promise<T> {
    this.requests.push(request);
    this.onRequest(request);
    return (this.responses.shift() ?? { value: null }) as T;
  }
}

class FakeDriverProcess implements DriverProcessHandle {
  stopped = false;

  constructor(private readonly stopError: Error | null = null) {}

  async stop(): Promise<void> {
    if (this.stopError !== null) {
      throw this.stopError;
    }

    this.stopped = true;
  }
}
