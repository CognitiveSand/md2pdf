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

const defaultDriverStopTimeoutMs = 5_000;
const readinessProbeTimeoutMs = 250;

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

export class SpawnedDriverProcess implements DriverProcessHandle {
  constructor(private readonly child: ChildProcess) {}

  async stop(signal?: AbortSignal): Promise<void> {
    if (this.child.exitCode !== null || this.child.signalCode !== null) {
      return;
    }

    this.child.kill();
    await waitForExit(this.child, signal, defaultDriverStopTimeoutMs);
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

export function driverArgs(browser: LocatedBrowser, port: number): string[] {
  if (browser.driverArtifactName === "geckodriver") {
    return ["--host", "127.0.0.1", "--port", String(port)];
  }

  return [`--port=${port}`, "--allowed-ips=127.0.0.1,::1"];
}

export async function waitForDriver(
  port: number,
  timeoutMs: number,
  child: ChildProcess,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error("WebDriver process exited before accepting requests");
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      break;
    }

    if (await driverResponds(port, Math.min(readinessProbeTimeoutMs, remainingMs))) {
      return;
    }

    await delay(Math.min(50, Math.max(0, deadline - Date.now())));
  }

  throw new Error("webdriver-readiness-timeout");
}

async function driverResponds(port: number, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error("webdriver-readiness-probe-timeout"));
  }, timeoutMs);
  timeout.unref();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/status`, {
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForExit(
  child: ChildProcess,
  signal: AbortSignal | undefined,
  killAfterMs: number,
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  const exit = once(child, "exit").then(() => undefined);
  const kill = (): void => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
  };
  const killTimeout = setTimeout(() => {
    kill();
  }, killAfterMs);
  killTimeout.unref();

  if (signal === undefined) {
    try {
      await exit;
      return;
    } finally {
      clearTimeout(killTimeout);
    }
  }

  let abortHandler: (() => void) | undefined;
  const abort = new Promise<never>((_resolve, reject) => {
    abortHandler = () => {
      kill();
      reject(signal.reason);
    };

    if (signal.aborted) {
      abortHandler();
      return;
    }

    signal.addEventListener("abort", abortHandler, { once: true });
  });

  try {
    await Promise.race([exit, abort]);
  } finally {
    if (abortHandler !== undefined) {
      signal.removeEventListener("abort", abortHandler);
    }
    clearTimeout(killTimeout);
  }
}
