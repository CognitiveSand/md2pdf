import { buildHelpText } from "./helpText.js";
import { parseCommandLine } from "./commandLine.js";
import { ConversionError, Md2PdfError } from "./errors.js";
import { resolveConversionWorkItems } from "./paths.js";

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

    resolveConversionWorkItems(parsed);
    throw new ConversionError("Conversion is not implemented yet.");
  } catch (error) {
    if (error instanceof Md2PdfError) {
      streams.stderr.write(`md2pdf: ${error.message}\n`);
      return error.exitCode;
    }

    throw error;
  }
}
