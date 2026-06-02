import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { convertFile, type ConvertOptions } from './converter.js';
import { ConversionError, Md2PdfError, UsageError } from './errors.js';
import {
  defaultOutputPath,
  outputExists,
  outputPathInDirectory,
  resolveEntrySources,
  type ConversionWorkItem,
} from './paths.js';
import { confirmOverwrite, decideOverwrite } from './overwrite.js';

export interface ConversionOutcome {
  sourcePath: string;
  outputPath: string;
  status: 'success' | 'failed' | 'skipped';
  error?: Error;
}

export interface PipelineResult {
  outcomes: ConversionOutcome[];
  succeeded: number;
  failed: number;
  skipped: number;
  exitCode: 0 | 1;
}

export type ConvertFn = (
  sourcePath: string,
  outputPath: string,
  options?: ConvertOptions,
) => Promise<void>;

export interface PipelineOptions {
  entries: string[];
  outputPath?: string;
  outputDir?: string;
  forceOverwrite?: boolean;
  interactive?: boolean;
  stdin?: Readable;
  stdout?: Writable;
  stderr?: Writable;
  converter?: ConvertFn;
  convertOptions?: ConvertOptions;
}

function writeLine(stream: Writable, message: string): void {
  stream.write(`${message}\n`);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function shouldConvert(
  item: ConversionWorkItem,
  options: Required<Pick<PipelineOptions, 'forceOverwrite' | 'interactive' | 'stdin' | 'stdout' | 'stderr'>>,
): Promise<boolean> {
  const decision = decideOverwrite({
    outputExists: outputExists(item.outputPath),
    forceOverwrite: options.forceOverwrite,
    interactive: options.interactive,
  });

  if (decision === 'write') return true;
  if (decision === 'skip') {
    writeLine(options.stderr, `Skipped existing output: ${item.outputPath}`);
    return false;
  }

  const confirmed = await confirmOverwrite(item.outputPath, {
    input: options.stdin,
    output: options.stdout,
  });
  if (!confirmed) {
    writeLine(options.stderr, `Skipped existing output: ${item.outputPath}`);
  }
  return confirmed;
}

export async function runConversionPipeline(
  options: PipelineOptions,
): Promise<PipelineResult> {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const stdin = options.stdin ?? process.stdin;
  const interactive = options.interactive
    ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const forceOverwrite = options.forceOverwrite ?? false;
  const converter = options.converter ?? convertFile;
  const outcomes: ConversionOutcome[] = [];

  if (options.entries.length === 0) {
    throw new UsageError('At least one Markdown file or directory is required.');
  }
  if (options.outputPath !== undefined && options.outputDir !== undefined) {
    throw new UsageError('--output and --output-dir are mutually exclusive.');
  }

  const sources: string[] = [];
  for (const entry of options.entries) {
    try {
      sources.push(...resolveEntrySources(entry));
    } catch (err) {
      const conversionError = err instanceof ConversionError
        ? err
        : new ConversionError(errorMessage(err), entry);
      outcomes.push({
        sourcePath: conversionError.sourcePath ?? entry,
        outputPath: '',
        status: 'failed',
        error: conversionError,
      });
      writeLine(stderr, conversionError.message);
    }
  }

  if (options.outputPath !== undefined && sources.length > 1) {
    throw new UsageError('--output can only be used when exactly one Markdown file is produced.');
  }

  if (options.outputDir !== undefined) mkdirSync(options.outputDir, { recursive: true });

  const workList = sources.map(sourcePath => ({
    sourcePath,
    outputPath: options.outputPath
      ?? (options.outputDir !== undefined
        ? outputPathInDirectory(sourcePath, options.outputDir)
        : defaultOutputPath(sourcePath)),
  }));

  for (const item of workList) {
    try {
      const canWrite = await shouldConvert(item, {
        forceOverwrite,
        interactive,
        stdin,
        stdout,
        stderr,
      });
      if (!canWrite) {
        outcomes.push({ ...item, status: 'skipped' });
        continue;
      }

      mkdirSync(dirname(item.outputPath), { recursive: true });
      await converter(item.sourcePath, item.outputPath, options.convertOptions);
      outcomes.push({ ...item, status: 'success' });
    } catch (err) {
      const wrapped = err instanceof Md2PdfError || err instanceof Error
        ? err
        : new ConversionError(String(err), item.sourcePath);
      outcomes.push({ ...item, status: 'failed', error: wrapped });
      writeLine(stderr, errorMessage(wrapped));
    }
  }

  const succeeded = outcomes.filter(outcome => outcome.status === 'success').length;
  const failed = outcomes.filter(outcome => outcome.status === 'failed').length;
  const skipped = outcomes.filter(outcome => outcome.status === 'skipped').length;
  writeLine(stdout, `Summary: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped.`);

  return {
    outcomes,
    succeeded,
    failed,
    skipped,
    exitCode: failed > 0 ? 1 : 0,
  };
}
