import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";

import { afterEach, describe, expect, it, vi } from "vitest";

import { SpawnedDriverProcess, waitForDriver } from "../../../src/webDriverSession.js";

describe("SpawnedDriverProcess", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("@req FR-16 escalates to SIGKILL when the stop signal is already aborted", async () => {
    const child = new FakeChildProcess();
    const abortController = new AbortController();
    const abortReason = new Error("conversion timeout");
    abortController.abort(abortReason);

    const stop = new SpawnedDriverProcess(child.asChildProcess()).stop(abortController.signal);

    await expect(stop).rejects.toBe(abortReason);
    expect(child.killSignals).toEqual([undefined, "SIGKILL"]);
  });

  it("@req FR-16 escalates to SIGKILL when the driver ignores the first stop signal", async () => {
    vi.useFakeTimers();
    const child = new FakeChildProcess();

    const stop = new SpawnedDriverProcess(child.asChildProcess()).stop();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(child.killSignals).toEqual([undefined, "SIGKILL"]);
    child.exit(null, "SIGKILL");
    await expect(stop).resolves.toBeUndefined();
  });
});

describe("waitForDriver", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("@req FR-16 aborts a /status probe that accepts the connection but never responds", async () => {
    vi.stubGlobal("fetch", (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(init.signal?.reason);
        }, { once: true });
      }));

    const child = new FakeChildProcess();
    const startedAt = Date.now();

    await expect(
      waitForDriver(12345, 100, child.asChildProcess()),
    ).rejects.toThrow("webdriver-readiness-timeout");
    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });
});

class FakeChildProcess extends EventEmitter {
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  readonly killSignals: Array<NodeJS.Signals | undefined> = [];

  kill(signal?: NodeJS.Signals): boolean {
    this.killSignals.push(signal);
    return true;
  }

  exit(code: number | null, signal: NodeJS.Signals | null): void {
    this.exitCode = code;
    this.signalCode = signal;
    this.emit("exit", code, signal);
  }

  asChildProcess(): ChildProcess {
    return this as unknown as ChildProcess;
  }
}
