#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import type { Readable, Writable } from 'node:stream';
import { UsageError } from './errors.js';
import {
  runConversionPipeline,
  type PipelineOptions,
  type PipelineResult,
} from './pipeline.js';

const HELP = `md2pdf [OPTIONS] ENTRY [ENTRY ...]

ENTRY                     a Markdown file or a directory of Markdown files
-o, --output PATH         output path for a single-file conversion
    --output-dir DIR      write every output PDF into DIR
-f, --force-overwrite     overwrite existing output PDFs without prompting
-h, --help                list options with one-line descriptions
`;

export interface CliMainOptions {
  stdin?: Readable;
  stdout?: Writable;
  stderr?: Writable;
  runner?: (options: PipelineOptions) => Promise<PipelineResult>;
}

function writeLine(stream: Writable, message: string): void {
  stream.write(`${message}\n`);
}

export async function main(
  argv: string[] = process.argv.slice(2),
  options: CliMainOptions = {},
): Promise<0 | 1 | 2> {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const runner = options.runner ?? runConversionPipeline;

  try {
    const parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        output: { type: 'string', short: 'o' },
        'output-dir': { type: 'string' },
        'force-overwrite': { type: 'boolean', short: 'f', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });

    if (parsed.values.help) {
      stdout.write(HELP);
      return 0;
    }

    if (parsed.positionals.length === 0) {
      throw new UsageError('At least one Markdown file or directory is required.');
    }
    if (parsed.values.output !== undefined && parsed.values['output-dir'] !== undefined) {
      throw new UsageError('--output and --output-dir are mutually exclusive.');
    }
    if (parsed.values.output !== undefined && parsed.positionals.length > 1) {
      throw new UsageError('--output can only be used with one conversion entry.');
    }

    const result = await runner({
      entries: parsed.positionals,
      outputPath: parsed.values.output,
      outputDir: parsed.values['output-dir'],
      forceOverwrite: parsed.values['force-overwrite'] ?? false,
      stdin: options.stdin,
      stdout,
      stderr,
    });

    return result.exitCode;
  } catch (err) {
    if (err instanceof UsageError) {
      writeLine(stderr, err.message);
      return 2;
    }
    if (
      err instanceof Error
      && 'code' in err
      && typeof err.code === 'string'
      && err.code.startsWith('ERR_PARSE_ARGS')
    ) {
      writeLine(stderr, err.message);
      return 2;
    }
    if (err instanceof Error) {
      writeLine(stderr, err.message);
      return 1;
    }
    writeLine(stderr, String(err));
    return 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(code => {
    process.exitCode = code;
  }, err => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
