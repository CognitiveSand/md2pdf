import { parseArgs } from "node:util";
import { buildHelpText } from "./helpText.js";
import { UsageError } from "./errors.js";

export interface CliStreams {
  readonly stdout: TextOutput;
  readonly stderr: TextOutput;
}

interface TextOutput {
  write(chunk: string): boolean;
}

export function runCli(args: readonly string[], streams: CliStreams): number {
  try {
    const parsed = parseCommandLine(args);

    if (parsed.help) {
      streams.stdout.write(`${buildHelpText()}\n`);
      return 0;
    }

    throw new UsageError("Conversion is not implemented yet. Run md2pdf --help for usage.");
  } catch (error) {
    if (error instanceof UsageError) {
      streams.stderr.write(`md2pdf: ${error.message}\n`);
      return error.exitCode;
    }

    throw error;
  }
}

interface ParsedCommandLine {
  readonly help: boolean;
}

function parseCommandLine(args: readonly string[]): ParsedCommandLine {
  const parsed = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      help: {
        short: "h",
        type: "boolean",
      },
      output: {
        short: "o",
        type: "string",
      },
      "output-dir": {
        type: "string",
      },
      "force-overwrite": {
        short: "f",
        type: "boolean",
      },
    },
    strict: true,
  });

  return {
    help: parsed.values.help === true,
  };
}
