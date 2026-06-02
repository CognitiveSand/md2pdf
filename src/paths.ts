import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { ConversionError, UsageError } from './errors.js';

export interface ConversionWorkItem {
  sourcePath: string;
  outputPath: string;
}

export interface WorkListOptions {
  outputPath?: string;
  outputDir?: string;
}

export function isMarkdownPath(path: string): boolean {
  return extname(path).toLowerCase() === '.md';
}

export function defaultOutputPath(sourcePath: string): string {
  if (!isMarkdownPath(sourcePath)) {
    return `${sourcePath}.pdf`;
  }
  return join(dirname(sourcePath), `${basename(sourcePath, extname(sourcePath))}.pdf`);
}

export function outputPathInDirectory(sourcePath: string, outputDir: string): string {
  return join(outputDir, `${basename(sourcePath, extname(sourcePath))}.pdf`);
}

export function resolveEntrySources(entryPath: string): string[] {
  let stats;
  try {
    stats = statSync(entryPath);
  } catch (err) {
    throw new ConversionError(
      `Input not found or unreadable: ${entryPath}`,
      entryPath,
    );
  }

  if (stats.isDirectory()) {
    return readdirSync(entryPath)
      .filter(isMarkdownPath)
      .sort((a, b) => a.localeCompare(b))
      .map(name => join(entryPath, name))
      .filter(path => {
        try {
          return statSync(path).isFile();
        } catch {
          return false;
        }
      });
  }

  if (!stats.isFile() || !isMarkdownPath(entryPath)) {
    throw new ConversionError(`Input is not a Markdown file: ${entryPath}`, entryPath);
  }

  return [entryPath];
}

export function resolveConversionSources(entries: string[]): string[] {
  return entries.flatMap(resolveEntrySources);
}

export function resolveWorkList(
  entries: string[],
  options: WorkListOptions = {},
): ConversionWorkItem[] {
  if (entries.length === 0) {
    throw new UsageError('At least one Markdown file or directory is required.');
  }
  if (options.outputPath !== undefined && options.outputDir !== undefined) {
    throw new UsageError('--output and --output-dir are mutually exclusive.');
  }

  const sources = resolveConversionSources(entries);

  if (options.outputPath !== undefined && sources.length !== 1) {
    throw new UsageError('--output can only be used when exactly one Markdown file is produced.');
  }

  return sources.map(sourcePath => ({
    sourcePath,
    outputPath: options.outputPath
      ?? (options.outputDir !== undefined
        ? outputPathInDirectory(sourcePath, options.outputDir)
        : defaultOutputPath(sourcePath)),
  }));
}

export function outputExists(outputPath: string): boolean {
  return existsSync(outputPath);
}
