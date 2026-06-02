import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { pathToFileURL } from 'node:url';
import type { LocatedBrowser, LocatedDriver } from './browserLocator.js';
import { RenderError } from './errors.js';
import {
  deleteSession,
  executeScript,
  navigateTo,
  newSession,
  printPage,
  waitForDriverReady,
  type PrintOptions,
} from './webDriverClient.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DRIVER_READY_TIMEOUT_MS = 10_000;
const MERMAID_POLL_INTERVAL_MS = 100;
const DEFAULT_RENDER_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Free-port helper
// ---------------------------------------------------------------------------

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : null;
      server.close(() => {
        if (port) resolve(port);
        else reject(new Error('Could not obtain a free port'));
      });
    });
    server.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Driver process management
// ---------------------------------------------------------------------------

function startDriverProcess(driverPath: string, port: number): ChildProcess {
  return spawn(driverPath, [`--port=${port}`], {
    stdio: 'ignore',
    detached: false,
  });
}

function stopDriverProcess(proc: ChildProcess): void {
  try {
    proc.kill();
  } catch {
    // already dead
  }
}

// ---------------------------------------------------------------------------
// Capabilities builders
// ---------------------------------------------------------------------------

function chromeCapabilities(browser: LocatedBrowser): unknown {
  return {
    alwaysMatch: {
      browserName: 'chrome',
      'goog:chromeOptions': {
        binary: browser.executablePath,
        args: [
          '--headless=new',
          '--no-proxy-server',
          '--disable-gpu',
          '--disable-extensions',
          '--window-size=1920,1080',
        ],
      },
    },
  };
}

function firefoxCapabilities(browser: LocatedBrowser): unknown {
  return {
    alwaysMatch: {
      browserName: 'firefox',
      'moz:firefoxOptions': {
        binary: browser.executablePath,
        args: ['-headless'],
        prefs: {
          'network.proxy.type': 0, // direct — no proxy
        },
      },
    },
  };
}

function buildCapabilities(browser: LocatedBrowser): unknown {
  return browser.kind === 'firefox'
    ? firefoxCapabilities(browser)
    : chromeCapabilities(browser);
}

// ---------------------------------------------------------------------------
// Mermaid completion wait
// ---------------------------------------------------------------------------

// Injected into the browser: returns true once every .mermaid element has been
// processed (Mermaid replaces the element content with an SVG and sets
// data-processed="true").
// WebDriver execute/sync runs this string as a function body — explicit `return`
// is required to pass a value back to Node.js.
const MERMAID_DONE_SCRIPT = `
  var elems = Array.from(document.querySelectorAll('.mermaid'));
  if (elems.length === 0) return true;
  return elems.every(function(el) {
    return el.querySelector('svg') !== null ||
           el.getAttribute('data-processed') === 'true';
  });
`;

async function waitForMermaid(
  port: number,
  sessionId: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const done = await executeScript<boolean>(port, sessionId, MERMAID_DONE_SCRIPT);
    if (done) return;
    await new Promise<void>(r => setTimeout(r, MERMAID_POLL_INTERVAL_MS));
  }
  throw new Error('Mermaid diagrams did not finish rendering within the timeout');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RenderOptions {
  /** Maximum time in ms to wait for the full render. Default: 30 s. */
  timeoutMs?: number;
  /** Options forwarded to the WebDriver Print command. */
  print?: PrintOptions;
}

/**
 * Renders a local HTML file to PDF bytes using a headless browser via WebDriver.
 *
 * @param htmlPath    Absolute path to the assembled HTML file.
 * @param sourcePath  Path of the original Markdown source — used in error messages.
 * @param browser     Located browser from {@link locateBrowserAndDriver}.
 * @param driver      Located WebDriver binary from {@link locateBrowserAndDriver}.
 * @param options     Render and print options.
 */
export async function renderToPdf(
  htmlPath: string,
  sourcePath: string,
  browser: LocatedBrowser,
  driver: LocatedDriver,
  options: RenderOptions = {},
): Promise<Buffer> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS;
  const fileUrl = pathToFileURL(htmlPath).href;

  let port: number;
  let proc: ChildProcess | undefined;
  let sessionId: string | undefined;

  try {
    port = await findFreePort();
    proc = startDriverProcess(driver.executablePath, port);

    await waitForDriverReady(port, DRIVER_READY_TIMEOUT_MS);

    sessionId = await newSession(port, buildCapabilities(browser));

    await navigateTo(port, sessionId, fileUrl);
    await waitForMermaid(port, sessionId, timeoutMs);

    const pdfBytes = await printPage(port, sessionId, options.print);
    return pdfBytes;
  } catch (err) {
    throw new RenderError((err as Error).message, sourcePath);
  } finally {
    if (sessionId !== undefined) {
      try { await deleteSession(port!, sessionId); } catch { /* ignore */ }
    }
    if (proc !== undefined) stopDriverProcess(proc);
  }
}
