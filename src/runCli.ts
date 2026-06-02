import { buildHelpText } from "./helpText.js";
import { parseCommandLine } from "./commandLine.js";
import { ConversionError, Md2PdfError } from "./errors.js";
import { ConversionResult, DocumentConverter, PdfRenderer } from "./converter.js";
import { resolveConversionWorkItems } from "./paths.js";

export interface CliStreams {
  readonly stdout: TextOutput;
  readonly stderr: TextOutput;
}

interface TextOutput {
  write(chunk: string): boolean;
}

export async function runCli(args: readonly string[], streams: CliStreams): Promise<number> {
  try {
    const parsed = parseCommandLine(args);

    if (parsed.help) {
      streams.stdout.write(`${buildHelpText()}\n`);
      return 0;
    }

    const workItems = resolveConversionWorkItems(parsed);
    const converter = new DocumentConverter({
      forceOverwrite: parsed.forceOverwrite,
      renderer: new NotImplementedRenderer(),
    });

    for (const workItem of workItems) {
      reportConversionResult(await converter.convert(workItem), streams);
    }

    return 0;
  } catch (error) {
    if (error instanceof Md2PdfError) {
      streams.stderr.write(`md2pdf: ${error.message}\n`);
      return error.exitCode;
    }

    throw error;
  }
}

function reportConversionResult(result: ConversionResult, streams: CliStreams): void {
  if (result.kind === "skipped") {
    streams.stderr.write(`Skipped ${result.outputPath}: ${result.reason}\n`);
  }
}

class NotImplementedRenderer implements PdfRenderer {
  async render(): Promise<Uint8Array> {
    throw new ConversionError("Conversion is not implemented yet.");
  }
}
