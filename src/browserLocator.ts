import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter, isAbsolute, join } from "node:path";

import { BrowserNotFoundError } from "./errors.js";

const WINDOWS_BROWSER_PATHS = [
  ["ProgramFiles", "Microsoft", "Edge", "Application", "msedge.exe"],
  ["ProgramFiles(x86)", "Microsoft", "Edge", "Application", "msedge.exe"],
  ["LOCALAPPDATA", "Microsoft", "Edge", "Application", "msedge.exe"],
  ["ProgramFiles", "Google", "Chrome", "Application", "chrome.exe"],
  ["ProgramFiles(x86)", "Google", "Chrome", "Application", "chrome.exe"],
  ["LOCALAPPDATA", "Google", "Chrome", "Application", "chrome.exe"],
  ["ProgramFiles", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"],
  ["ProgramFiles(x86)", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"],
  ["LOCALAPPDATA", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"],
  ["ProgramFiles", "Vivaldi", "Application", "vivaldi.exe"],
  ["ProgramFiles(x86)", "Vivaldi", "Application", "vivaldi.exe"],
  ["LOCALAPPDATA", "Vivaldi", "Application", "vivaldi.exe"],
];

const POSIX_BROWSER_NAMES = [
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
  "microsoft-edge",
  "msedge",
  "brave-browser",
  "brave",
  "vivaldi",
  "vivaldi-stable",
];

export async function locateBrowser(explicitBrowserPath?: string): Promise<string> {
  if (explicitBrowserPath !== undefined && explicitBrowserPath.trim() !== "") {
    return requireExecutable(explicitBrowserPath, "configured browser path is not usable");
  }

  for (const candidate of browserCandidates()) {
    if (await isUsableExecutable(candidate)) {
      return candidate;
    }
  }

  throw new BrowserNotFoundError({
    message: "No supported browser executable was found",
    actionHint:
      "Install a Chromium-family browser, or set MD2PDF_BROWSER to a browser executable path.",
  });
}

async function requireExecutable(path: string, message: string): Promise<string> {
  if (await isUsableExecutable(path)) {
    return path;
  }

  throw new BrowserNotFoundError({
    message,
    actionHint: "Check MD2PDF_BROWSER or pass an existing browser executable path.",
    cause: path,
  });
}

function browserCandidates(): string[] {
  return process.platform === "win32" ? windowsCandidates() : posixCandidates();
}

function windowsCandidates(): string[] {
  const candidates: string[] = [];

  for (const [envName, ...parts] of WINDOWS_BROWSER_PATHS) {
    const root = process.env[envName];
    if (root !== undefined && root !== "") {
      candidates.push(join(root, ...parts));
    }
  }

  candidates.push(
    ...pathCandidates(["msedge.exe", "chrome.exe", "chromium.exe", "brave.exe", "vivaldi.exe"]),
  );

  return candidates;
}

function posixCandidates(): string[] {
  return pathCandidates(POSIX_BROWSER_NAMES);
}

function pathCandidates(names: string[]): string[] {
  const path = process.env.PATH ?? "";
  return path
    .split(delimiter)
    .filter(Boolean)
    .flatMap((directory) => names.map((name) => join(directory, name)));
}

async function isUsableExecutable(path: string): Promise<boolean> {
  if (!isAbsolute(path) && !path.includes("/") && !path.includes("\\")) {
    return false;
  }

  try {
    await access(path, process.platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
