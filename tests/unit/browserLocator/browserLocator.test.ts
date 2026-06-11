import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { locateBrowser } from "../../../src/browserLocator.js";
import { BrowserNotFoundError } from "../../../src/errors.js";

const itOnPosix = process.platform === "win32" ? it.skip : it;
const itOnWindows = process.platform === "win32" ? it : it.skip;

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "md2pdf-browser-locator-"));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("BrowserLocator", () => {
  itOnPosix("rejects an explicit POSIX browser path without execute permission", async () => {
    const browserPath = path.join(tempRoot, "browser");
    await fs.writeFile(browserPath, "#!/bin/sh\nexit 0\n", { encoding: "utf8", mode: 0o644 });

    await expect(locateBrowser(browserPath)).rejects.toMatchObject({
      kind: "browser-not-found",
      context: {
        cause: browserPath,
      },
    });
    await expect(locateBrowser(browserPath)).rejects.toBeInstanceOf(BrowserNotFoundError);
  });

  itOnPosix("accepts an explicit POSIX browser path with execute permission", async () => {
    const browserPath = path.join(tempRoot, "browser");
    await fs.writeFile(browserPath, "#!/bin/sh\nexit 0\n", { encoding: "utf8", mode: 0o755 });

    await expect(locateBrowser(browserPath)).resolves.toBe(browserPath);
  });

  itOnWindows("detects Brave from standard Chromium-family install paths", async () => {
    const programFiles = path.join(tempRoot, "Program Files");
    const programFilesX86 = path.join(tempRoot, "Program Files (x86)");
    const localAppData = path.join(tempRoot, "LocalAppData");
    const bravePath = path.join(
      programFiles,
      "BraveSoftware",
      "Brave-Browser",
      "Application",
      "brave.exe",
    );
    await fs.mkdir(path.dirname(bravePath), { recursive: true });
    await fs.writeFile(bravePath, "", "utf8");
    vi.stubEnv("ProgramFiles", programFiles);
    vi.stubEnv("ProgramFiles(x86)", programFilesX86);
    vi.stubEnv("LOCALAPPDATA", localAppData);
    vi.stubEnv("PATH", "");

    await expect(locateBrowser()).resolves.toBe(bravePath);
  });
});
