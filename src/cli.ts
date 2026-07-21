#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { type ConversionOutcome } from "./contracts.js";
import { convertFile as defaultConvertFile } from "./converter.js";
import {
  ConversionError,
  formatError,
  Md2PdfError,
  UsageError,
} from "./errors.js";
import {
  MAX_BASE_FONT_SIZE_PT,
  MIN_BASE_FONT_SIZE_PT,
} from "./markdownRenderer.js";
import {
  type ConvertFile,
  ConversionPipeline,
} from "./pipeline.js";

export interface CliIo {
  stdin: NodeJS.ReadableStream;
  stdout: Pick<NodeJS.WritableStream, "write">;
  stderr: Pick<NodeJS.WritableStream, "write">;
  env: NodeJS.ProcessEnv;
  cwd: string;
  isInteractive: boolean;
}

export interface CliCommand {
  entries: string[];
  outputPath?: string;
  outputDir?: string;
  forceOverwrite: boolean;
  help: boolean;
  version: boolean;
  browserPath?: string;
  baseFontSizePt?: number;
}

export interface CliDependencies {
  convertFile?: ConvertFile;
}

export const HELP_TEXT = [
  "md2pdf [OPTIONS] ENTRY [ENTRY ...]",
  "",
  "ENTRY                     a Markdown file or a directory of Markdown files",
  "-o, --output PATH         output path for a single-file conversion",
  "    --output-dir DIR      write every output PDF into DIR",
  "-f, --force-overwrite     overwrite existing output PDFs without prompting",
  "    --size PT             base font size in points (default: 9)",
  "-h, --help                list options with one-line descriptions",
  "    --version             print the version, license, and publisher",
].join("\n");

const packageMetadata = createRequire(import.meta.url)("../package.json") as {
  version: string;
  license: string;
};

export const VERSION_TEXT = [
  `md2pdf ${packageMetadata.version}`,
  `${packageMetadata.license} license. Built by CognitiveSand: https://cognitivesand.ai`,
].join("\n");

export async function main(
  argv: string[],
  io: CliIo,
  dependencies: CliDependencies = {},
): Promise<number> {
  try {
    const command = parseCommandLine(argv, io.env);

    if (command.help) {
      io.stdout.write(`${HELP_TEXT}\n`);
      return 0;
    }

    if (command.version) {
      io.stdout.write(`${VERSION_TEXT}\n`);
      return 0;
    }

    return await executeCommand(command, io, dependencies);
  } catch (error) {
    const md2pdfError = toMd2PdfError(error);
    io.stderr.write(`${formatError(md2pdfError)}\n`);
    return exitCodeFor(md2pdfError);
  }
}

export function parseCommandLine(argv: string[], env: NodeJS.ProcessEnv): CliCommand {
  const parsed = parseCliArgs(argv);
  const command: CliCommand = {
    entries: parsed.positionals,
    outputPath: valueAsString(parsed.values.output),
    outputDir: valueAsString(parsed.values["output-dir"]),
    forceOverwrite: parsed.values["force-overwrite"] === true,
    help: parsed.values.help === true,
    version: parsed.values.version === true,
    browserPath: emptyToUndefined(env.MD2PDF_BROWSER),
    baseFontSizePt: parseBaseFontSize(valueAsString(parsed.values.size)),
  };

  if (command.help || command.version) {
    return command;
  }

  validateCommand(command);
  return command;
}

export function createProcessIo(): CliIo {
  return {
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
    env: process.env,
    cwd: process.cwd(),
    isInteractive: isPromptInteractive(process.stdin, process.stdout),
  };
}

export function isPromptInteractive(
  stdin: { isTTY?: boolean },
  stdout: { isTTY?: boolean },
): boolean {
  return Boolean(stdin.isTTY && stdout.isTTY);
}

function parseCliArgs(argv: string[]): ReturnType<typeof parseArgs> {
  try {
    return parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        output: {
          type: "string",
          short: "o",
        },
        "output-dir": {
          type: "string",
        },
        "force-overwrite": {
          type: "boolean",
          short: "f",
          default: false,
        },
        size: {
          type: "string",
        },
        help: {
          type: "boolean",
          short: "h",
          default: false,
        },
        version: {
          type: "boolean",
          default: false,
        },
      },
    });
  } catch (error) {
    throw new UsageError({
      message: errorMessage(error),
      actionHint: "run md2pdf --help",
      cause: error,
    });
  }
}

function parseBaseFontSize(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const sizePt = Number(value.trim());
  if (!Number.isFinite(sizePt) || sizePt < MIN_BASE_FONT_SIZE_PT || sizePt > MAX_BASE_FONT_SIZE_PT) {
    throw new UsageError({
      message: `--size must be a number between ${MIN_BASE_FONT_SIZE_PT} and ${MAX_BASE_FONT_SIZE_PT} (points), got: ${value}`,
      actionHint: "run md2pdf --help",
    });
  }

  return sizePt;
}

function validateCommand(command: CliCommand): void {
  if (command.entries.length === 0) {
    throw new UsageError({
      message: "missing ENTRY",
      actionHint: "run md2pdf --help",
    });
  }

  if (command.outputPath !== undefined && command.outputDir !== undefined) {
    throw new UsageError({
      message: "--output and --output-dir cannot be used together",
      actionHint: "choose exactly one output location option",
    });
  }
}

async function executeCommand(
  command: CliCommand,
  io: CliIo,
  dependencies: CliDependencies,
): Promise<number> {
  const pipeline = new ConversionPipeline(dependencies.convertFile ?? defaultConvertFile);
  const outcomes = await pipeline.run({
    entries: command.entries,
    cwd: io.cwd,
    outputPath: command.outputPath,
    outputDir: command.outputDir,
    convertOptions: {
      browserPath: command.browserPath,
      baseFontSizePt: command.baseFontSizePt,
    },
    overwrite: {
      forceOverwrite: command.forceOverwrite,
      mode: io.isInteractive ? "interactive" : "non-interactive",
      promptIo: {
        stdin: io.stdin,
        stderr: io.stderr,
      },
    },
  });

  writeFailedOutcomes(outcomes, io);
  io.stdout.write(`${formatSummary(outcomes)}\n`);

  return outcomes.some((outcome) => outcome.status === "failed") ? 1 : 0;
}

function writeFailedOutcomes(outcomes: ConversionOutcome[], io: CliIo): void {
  for (const outcome of outcomes) {
    if (outcome.status === "failed" && outcome.error !== undefined) {
      io.stderr.write(`${formatError(outcome.error)}\n`);
    }
  }
}

function formatSummary(outcomes: ConversionOutcome[]): string {
  const succeeded = countByStatus(outcomes, "success");
  const failed = countByStatus(outcomes, "failed");
  const skipped = countByStatus(outcomes, "skipped");

  return `${succeeded} succeeded, ${failed} failed, ${skipped} skipped`;
}

function countByStatus(
  outcomes: ConversionOutcome[],
  status: ConversionOutcome["status"],
): number {
  return outcomes.filter((outcome) => outcome.status === status).length;
}

function toMd2PdfError(error: unknown): Md2PdfError {
  if (error instanceof Md2PdfError) {
    return error;
  }

  return new ConversionError({
    message: "unexpected CLI failure",
    actionHint: "rerun with the same arguments and report the full stderr output",
    cause: error,
  });
}

function exitCodeFor(error: Md2PdfError): number {
  if (error.kind === "usage" || error.kind === "input") {
    return 2;
  }

  return 1;
}

function valueAsString(value: string | boolean | (string | boolean)[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  return value;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function isDirectEntrypoint(metaUrl: string, argvPath: string | undefined): boolean {
  if (argvPath === undefined) {
    return false;
  }

  return canonicalPath(fileURLToPath(metaUrl)) === canonicalPath(argvPath);
}

function canonicalPath(filePath: string): string {
  try {
    return realpathSync.native(filePath);
  } catch {
    return filePath;
  }
}

if (isDirectEntrypoint(import.meta.url, process.argv[1])) {
  main(process.argv.slice(2), createProcessIo()).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
