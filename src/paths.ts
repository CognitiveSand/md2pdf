import { Dirent, existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { PathError, UsageError } from "./errors.js";
import { CommandLineOptions } from "./commandLine.js";

export interface ConversionWorkItem {
  readonly sourcePath: string;
  readonly outputPath: string;
}

export function resolveConversionWorkItems(
  options: CommandLineOptions,
  cwd = process.cwd(),
): readonly ConversionWorkItem[] {
  const sourcePaths = expandEntries(options.entries, cwd);

  if (options.output !== undefined && sourcePaths.length > 1) {
    throw new UsageError("--output can only be used when one PDF will be produced.");
  }

  return sourcePaths.map((sourcePath) => ({
    sourcePath,
    outputPath: resolveOutputPath(sourcePath, options, cwd),
  }));
}

function expandEntries(entries: readonly string[], cwd: string): readonly string[] {
  return entries.flatMap((entry) => expandEntry(entry, cwd));
}

function expandEntry(entry: string, cwd: string): readonly string[] {
  const entryPath = resolve(cwd, entry);

  if (!existsSync(entryPath)) {
    throw new PathError(`Entry does not exist: ${entry}`);
  }

  const entryStat = statSync(entryPath);

  if (entryStat.isDirectory()) {
    return expandDirectory(entryPath);
  }

  if (!entryStat.isFile()) {
    throw new PathError(`Entry is not a file or directory: ${entry}`);
  }

  if (!isMarkdownFile(entryPath)) {
    throw new PathError(`Entry is not a Markdown file: ${entry}`);
  }

  return [entryPath];
}

function expandDirectory(directoryPath: string): readonly string[] {
  return readdirSync(directoryPath, { withFileTypes: true })
    .filter(isTopLevelMarkdownFile)
    .map((entry) => join(directoryPath, entry.name))
    .sort(comparePaths);
}

function isTopLevelMarkdownFile(entry: Dirent): boolean {
  return entry.isFile() && isMarkdownFile(entry.name);
}

function isMarkdownFile(path: string): boolean {
  return extname(path).toLowerCase() === ".md";
}

function resolveOutputPath(
  sourcePath: string,
  options: CommandLineOptions,
  cwd: string,
): string {
  if (options.output !== undefined) {
    return resolve(cwd, options.output);
  }

  const outputFileName = `${basename(sourcePath, extname(sourcePath))}.pdf`;

  if (options.outputDir !== undefined) {
    return resolve(cwd, options.outputDir, outputFileName);
  }

  return join(dirname(sourcePath), outputFileName);
}

function comparePaths(left: string, right: string): number {
  return left.localeCompare(right);
}
