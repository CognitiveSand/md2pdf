import { parseArgs } from "node:util";
import { UsageError } from "./errors.js";

export interface CommandLineOptions {
  readonly entries: readonly string[];
  readonly forceOverwrite: boolean;
  readonly help: boolean;
  readonly output?: string;
  readonly outputDir?: string;
}

export function parseCommandLine(args: readonly string[]): CommandLineOptions {
  try {
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

    const options: CommandLineOptions = {
      entries: parsed.positionals,
      forceOverwrite: parsed.values["force-overwrite"] === true,
      help: parsed.values.help === true,
      output: optionalString(parsed.values.output),
      outputDir: optionalString(parsed.values["output-dir"]),
    };

    validateCommandLineOptions(options);
    return options;
  } catch (error) {
    if (error instanceof UsageError) {
      throw error;
    }

    if (error instanceof TypeError) {
      throw new UsageError(error.message);
    }

    throw error;
  }
}

function optionalString(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function validateCommandLineOptions(options: CommandLineOptions): void {
  if (options.help) {
    return;
  }

  if (options.entries.length === 0) {
    throw new UsageError("At least one entry is required.");
  }

  if (options.output !== undefined && options.outputDir !== undefined) {
    throw new UsageError("--output and --output-dir cannot be used together.");
  }

  if (options.output !== undefined && options.entries.length > 1) {
    throw new UsageError("--output can only be used with one input entry.");
  }
}
