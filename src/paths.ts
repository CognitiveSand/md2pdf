import { promises as fs, type Dirent } from "node:fs";
import path from "node:path";

import type { ConversionJob } from "./contracts.js";
import { ConversionError, InputNotFoundError, UsageError } from "./errors.js";

export interface ResolveJobsOptions {
  cwd: string;
  outputPath?: string;
  outputDir?: string;
}

interface ResolvedSource {
  sourcePath: string;
  originEntry: string;
}

export async function resolveConversionJobs(
  entries: string[],
  options: ResolveJobsOptions,
): Promise<ConversionJob[]> {
  validateResolveOptions(entries, options);

  const sources = await resolveSources(entries, options.cwd);
  const jobs = createJobs(sources, options);
  validateJobs(jobs);
  await createOutputParents(jobs);

  return jobs;
}

export function isMarkdownPath(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === ".md";
}

function validateResolveOptions(entries: string[], options: ResolveJobsOptions): void {
  if (entries.length === 0) {
    throw new UsageError({
      message: "missing ENTRY",
      actionHint: "run md2pdf --help",
    });
  }

  if (options.outputPath !== undefined && options.outputDir !== undefined) {
    throw new UsageError({
      message: "--output and --output-dir cannot be used together",
      actionHint: "choose exactly one output location option",
    });
  }
}

async function resolveSources(entries: string[], cwd: string): Promise<ResolvedSource[]> {
  const sources: ResolvedSource[] = [];

  for (const entry of entries) {
    sources.push(...(await resolveEntry(entry, cwd)));
  }

  return sources;
}

async function resolveEntry(entry: string, cwd: string): Promise<ResolvedSource[]> {
  const entryPath = path.resolve(cwd, entry);
  const stat = await statEntry(entryPath, entry);

  if (stat.isFile()) {
    if (!isMarkdownPath(entryPath)) {
      throw new UsageError({
        message: "entry is not a Markdown file",
        sourcePath: entryPath,
        actionHint: "use a .md file or a directory containing top-level .md files",
      });
    }

    return [{ sourcePath: entryPath, originEntry: entry }];
  }

  if (stat.isDirectory()) {
    return resolveDirectory(entryPath, entry);
  }

  throw new UsageError({
    message: "entry is neither a file nor a directory",
    sourcePath: entryPath,
    actionHint: "use a .md file or a directory containing top-level .md files",
  });
}

async function statEntry(entryPath: string, originEntry: string): Promise<{ isFile(): boolean; isDirectory(): boolean }> {
  try {
    return await fs.stat(entryPath);
  } catch (error) {
    throw new InputNotFoundError({
      message: "input entry was not found",
      sourcePath: entryPath,
      actionHint: `check that ${originEntry} exists and is readable`,
      cause: error,
    });
  }
}

async function resolveDirectory(directoryPath: string, originEntry: string): Promise<ResolvedSource[]> {
  const dirents = await fs.readdir(directoryPath, { withFileTypes: true });

  return dirents
    .filter((dirent) => isTopLevelMarkdownFile(dirent))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((dirent) => ({
      sourcePath: path.join(directoryPath, dirent.name),
      originEntry,
    }));
}

function isTopLevelMarkdownFile(dirent: Dirent): boolean {
  return dirent.isFile() && isMarkdownPath(dirent.name);
}

function createJobs(sources: ResolvedSource[], options: ResolveJobsOptions): ConversionJob[] {
  if (options.outputPath !== undefined && sources.length !== 1) {
    throw new UsageError({
      message: "--output requires exactly one resolved Markdown file",
      actionHint: "use --output-dir for batch conversion",
    });
  }

  return sources.map((source) => ({
    ...source,
    outputPath: resolveOutputPath(source.sourcePath, options),
  }));
}

function resolveOutputPath(sourcePath: string, options: ResolveJobsOptions): string {
  if (options.outputPath !== undefined) {
    return path.resolve(options.cwd, options.outputPath);
  }

  const outputFileName = `${path.parse(sourcePath).name}.pdf`;

  if (options.outputDir !== undefined) {
    return path.join(path.resolve(options.cwd, options.outputDir), outputFileName);
  }

  return path.join(path.dirname(sourcePath), outputFileName);
}

function validateJobs(jobs: ConversionJob[]): void {
  const outputs = new Map<string, ConversionJob>();

  for (const job of jobs) {
    if (samePath(job.sourcePath, job.outputPath)) {
      throw new UsageError({
        message: "output path must differ from source path",
        sourcePath: job.sourcePath,
        outputPath: job.outputPath,
        actionHint: "choose a different output file",
      });
    }

    const key = canonicalPath(job.outputPath);
    const existing = outputs.get(key);
    if (existing !== undefined) {
      throw new UsageError({
        message: "multiple jobs resolve to the same output path",
        sourcePath: job.sourcePath,
        outputPath: job.outputPath,
        actionHint: `choose distinct output paths for ${existing.originEntry} and ${job.originEntry}`,
      });
    }

    outputs.set(key, job);
  }
}

async function createOutputParents(jobs: ConversionJob[]): Promise<void> {
  const parents = [...new Set(jobs.map((job) => canonicalPath(path.dirname(job.outputPath))))];

  for (const parent of parents) {
    try {
      await fs.mkdir(parent, { recursive: true });
    } catch (error) {
      throw new ConversionError({
        message: "could not create output directory",
        outputPath: parent,
        actionHint: "check output directory permissions",
        cause: error,
      });
    }
  }
}

function samePath(left: string, right: string): boolean {
  return canonicalPath(left) === canonicalPath(right);
}

function canonicalPath(filePath: string): string {
  const normalized = path.normalize(filePath);

  if (path.sep === "\\") {
    return normalized.toLowerCase();
  }

  return normalized;
}
