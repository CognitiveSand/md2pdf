import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

import type { LocatedBrowser } from "./browserLocator.js";
import type { ConvertOptions } from "./contracts.js";
import { RenderError } from "./errors.js";
import {
  type DriverProcessHandle,
  WebDriverHttpTransport,
  type WebDriverTransport,
} from "./webDriverClient.js";

export interface WebDriverSession {
  driverProcess: DriverProcessHandle;
  transport: WebDriverTransport;
}

export interface WebDriverSessionFactory {
  start(browser: LocatedBrowser, options?: ConvertOptions): Promise<WebDriverSession>;
}

export class SpawnedWebDriverSessionFactory implements WebDriverSessionFactory {
  async start(browser: LocatedBrowser, options: ConvertOptions = {}): Promise<WebDriverSession> {
    const port = await allocatePort();
    const child = spawn(browser.driverPath, driverArgs(browser, port), {
      stdio: "ignore",
      windowsHide: true,
    });
    const driverProcess = new SpawnedDriverProcess(child);

    try {
      await waitForDriver(port, options.renderTimeoutMs ?? 30_000, child);
    } catch (cause) {
      await driverProcess.stop();
      throw new RenderError({
        message: "WebDriver process did not become ready",
        actionHint: "Check that the selected browser and WebDriver binary are compatible.",
        cause,
      });
    }

    return {
      driverProcess,
      transport: new WebDriverHttpTransport(`http://127.0.0.1:${port}/`),
    };
  }
}

class SpawnedDriverProcess implements DriverProcessHandle {
  constructor(private readonly child: ChildProcess) {}

  async stop(signal?: AbortSignal): Promise<void> {
    if (this.child.exitCode !== null || this.child.signalCode !== null) {
      return;
    }

    this.child.kill();
    await waitForExit(this.child, signal);
  }
}

async function allocatePort(): Promise<number> {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.unref();
    server.on("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address !== "object" || address === null) {
        server.close(() => rejectPort(new Error("No TCP port was allocated")));
        return;
      }

      server.close(() => resolvePort(address.port));
    });
  });
}

function driverArgs(browser: LocatedBrowser, port: number): string[] {
  if (browser.driverArtifactName === "geckodriver") {
    return ["--host", "127.0.0.1", "--port", String(port)];
  }

  return [`--port=${port}`, "--allowed-ips="];
}

async function waitForDriver(
  port: number,
  timeoutMs: number,
  child: ChildProcess,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error("WebDriver process exited before accepting requests");
    }

    if (await driverResponds(port)) {
      return;
    }

    await delay(50);
  }

  throw new Error("Timed out waiting for WebDriver readiness");
}

async function driverResponds(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/status`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForExit(child: ChildProcess, signal: AbortSignal | undefined): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (signal?.aborted === true) {
    throw signal.reason;
  }

  const exit = once(child, "exit").then(() => undefined);
  if (signal === undefined) {
    await exit;
    return;
  }

  await Promise.race([
    exit,
    once(signal, "abort").then(() => {
      throw signal.reason;
    }),
  ]);
}
