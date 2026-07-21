import { stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { LocatedBrowser } from "../../../src/browserLocator.js";
import { RenderError } from "../../../src/errors.js";
import {
  printPdfWithWebDriver,
  type DriverProcessHandle,
  type WebDriverRequest,
  type WebDriverTransport,
  WebDriverHttpTransport,
} from "../../../src/webDriverClient.js";

const originalPlatform = process.platform;
const originalHome = process.env.HOME;

afterEach(() => {
  Object.defineProperty(process, "platform", {
    value: originalPlatform,
  });
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
});

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
              "--remote-debugging-pipe",
              "--disable-background-networking",
              "--disable-client-side-phishing-detection",
              "--disable-component-update",
              "--disable-dev-shm-usage",
              "--disable-domain-reliability",
              "--disable-extensions",
              "--disable-notifications",
              "--no-sandbox",
              "--no-first-run",
              "--no-proxy-server",
              "--proxy-server=direct://",
              "--proxy-bypass-list=*",
              "--deny-permission-prompts",
              "--disable-sync",
              "--disable-default-apps",
              "--metrics-recording-only",
              expect.stringMatching(/^--user-data-dir=.+/u),
            ]),
          },
        },
      },
    });
    const profileArg = chromeArgs(transport.requests[0]).find((arg) => arg.startsWith("--user-data-dir="));
    expect(profileArg).toBeDefined();
    await expect(stat(profileArg?.slice("--user-data-dir=".length) ?? "")).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(transport.requests[3]?.body).toEqual({
      background: true,
      margin: {
        top: 1,
        bottom: 1,
        left: 1,
        right: 1,
      },
      orientation: "portrait",
      page: {
        width: 21,
        height: 29.7,
      },
      scale: 1,
      shrinkToFit: true,
    });
  });

  it.each(["chrome", "chromium", "edge", "brave", "vivaldi"] as const)(
    "@req FR-07 hardens %s Chromium-family browser capabilities",
    async (kind) => {
      const transport = new FakeTransport([
        { value: { sessionId: `session-${kind}` } },
        { value: null },
        { value: true },
        { value: Buffer.from("%PDF-1.7").toString("base64") },
        { value: null },
      ]);

      await printPdfWithWebDriver({
        browser: browser(kind),
        htmlFileUrl: "file:///tmp/doc.html",
        transport,
        driverProcess: new FakeDriverProcess(),
        renderTimeoutMs: 50,
        mermaidPollMs: 1,
      });

      const capabilities = alwaysMatch(transport.requests[0]);
      expect(capabilities.browserName).toBe(kind === "edge" ? "MicrosoftEdge" : "chrome");
      expect(capabilities.proxy).toEqual({ proxyType: "direct" });
      expect(chromeArgs(transport.requests[0])).toEqual(expect.arrayContaining([
        "--disable-background-networking",
        "--disable-client-side-phishing-detection",
        "--disable-component-update",
        "--disable-domain-reliability",
        "--disable-extensions",
        "--disable-notifications",
        "--disable-sync",
        "--disable-default-apps",
        "--deny-permission-prompts",
        "--no-first-run",
        "--no-proxy-server",
        "--proxy-server=direct://",
        "--proxy-bypass-list=*",
      ]));
      expect(chromeArgs(transport.requests[0])).not.toContain("--disable-pdf-links");
    },
  );

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
            args: expect.arrayContaining(["-headless", "--offline", "-profile"]),
            prefs: expect.objectContaining({
              "browser.safebrowsing.downloads.remote.enabled": false,
              "datareporting.policy.dataSubmissionEnabled": false,
              "dom.push.enabled": false,
              "extensions.update.enabled": false,
              "geo.enabled": false,
              "identity.fxaccounts.enabled": false,
              "media.navigator.enabled": false,
              "network.captive-portal-service.enabled": false,
              "network.connectivity-service.enabled": false,
              "network.dns.disablePrefetch": true,
              "network.http.speculative-parallel-limit": 0,
              "network.predictor.enabled": false,
              "network.prefetch-next": false,
              "permissions.default.desktop-notification": 2,
              "toolkit.telemetry.enabled": false,
              "toolkit.telemetry.unified": false,
            }),
          },
        },
      },
    });
    const profileDir = firefoxProfileDir(transport.requests[0]);
    expect(profileDir).toBeDefined();
    await expect(stat(profileDir ?? "")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("@req NFR-08 omits the binary capability for a snap Firefox so geckodriver auto-detects it", async () => {
    Object.defineProperty(process, "platform", {
      value: "linux",
    });
    process.env.HOME = tmpdir();
    const transport = new FakeTransport([
      { value: { sessionId: "session-snap-firefox" } },
      { value: null },
      { value: true },
      { value: Buffer.from("%PDF-1.7").toString("base64") },
      { value: null },
    ]);

    await printPdfWithWebDriver({
      browser: {
        kind: "firefox",
        displayName: "Firefox",
        browserPath: "/snap/firefox/current/usr/lib/firefox/firefox",
        driverPath: "/snap/bin/geckodriver",
        driverArtifactName: "geckodriver",
      },
      htmlFileUrl: "file:///home/user/md2pdf-tmp/doc.html",
      transport,
      driverProcess: new FakeDriverProcess(),
      renderTimeoutMs: 50,
      mermaidPollMs: 1,
    });

    const firefoxOptions = firefoxOptionsOf(transport.requests[0]);
    expect(firefoxOptions.binary).toBeUndefined();
    expect(firefoxOptions.args).toEqual(expect.arrayContaining(["-headless", "--offline"]));
    const profileDir = firefoxProfileDir(transport.requests[0]);
    expect(profileDir?.startsWith(join(homedir(), "md2pdf-browser-profile-"))).toBe(true);
    await expect(stat(profileDir ?? "")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("@req NFR-08 keeps the binary capability for a non-snap Firefox", async () => {
    const transport = new FakeTransport([
      { value: { sessionId: "session-deb-firefox" } },
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

    const firefoxOptions = firefoxOptionsOf(transport.requests[0]);
    expect(firefoxOptions.binary).toBe("/browsers/firefox");
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
        bottom: 1,
        left: 1,
        right: 1,
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

  it("@req FR-24 keeps polling when the Mermaid status attribute is absent", async () => {
    const transport = new FakeTransport([
      { value: { sessionId: "session-mermaid-absent" } },
      { value: null },
      { value: false },
      { value: true },
      { value: Buffer.from("%PDF-1.7").toString("base64") },
      { value: null },
    ]);

    await expect(
      printPdfWithWebDriver({
        browser: browser("chrome"),
        htmlFileUrl: "file:///tmp/doc.html",
        transport,
        driverProcess: new FakeDriverProcess(),
        renderTimeoutMs: 100,
        mermaidPollMs: 1,
      }),
    ).resolves.toEqual(Buffer.from("%PDF-1.7"));

    expect(transport.requests.filter((request) => request.path.endsWith("/execute/sync"))).toHaveLength(2);
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

  it("@req NFR-02 rejects localhost WebDriver endpoints to avoid DNS or hosts-file ambiguity", () => {
    expect(() => new WebDriverHttpTransport("http://localhost:9515")).toThrow(RenderError);
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

  it.each(["../status", "/../status", "%2e%2e/status", "session\\status", "//example.invalid/session"])(
    "@req NFR-02 rejects unsafe WebDriver request path %s",
    async (path) => {
      const transport = new WebDriverHttpTransport("http://127.0.0.1:9515/wd/hub/", {
        fetch: async () => {
          throw new Error("fetch should not be called");
        },
      });

      await expect(
        transport.request({
          method: "POST",
          path,
          body: {},
        }),
      ).rejects.toMatchObject({
        kind: "render",
        context: { cause: "non-local-webdriver-path" },
      });
    },
  );

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

function alwaysMatch(request: WebDriverRequest | undefined): Record<string, unknown> {
  const body = request?.body as { capabilities?: { alwaysMatch?: Record<string, unknown> } } | undefined;
  return body?.capabilities?.alwaysMatch ?? {};
}

function chromeArgs(request: WebDriverRequest | undefined): string[] {
  const chromeOptions = alwaysMatch(request)["goog:chromeOptions"] as { args?: string[] } | undefined;
  return chromeOptions?.args ?? [];
}

function firefoxProfileDir(request: WebDriverRequest | undefined): string | undefined {
  const firefoxOptions = alwaysMatch(request)["moz:firefoxOptions"] as { args?: string[] } | undefined;
  const args = firefoxOptions?.args ?? [];
  const profileFlagIndex = args.indexOf("-profile");
  return profileFlagIndex === -1 ? undefined : args[profileFlagIndex + 1];
}

function firefoxOptionsOf(request: WebDriverRequest | undefined): Record<string, unknown> {
  return (alwaysMatch(request)["moz:firefoxOptions"] as Record<string, unknown> | undefined) ?? {};
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
