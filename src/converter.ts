import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { ConversionWorkItem } from "./paths.js";
import {
  ConsoleOverwritePrompt,
  OverwritePrompt,
  decideOverwrite,
  isInteractiveTerminal,
} from "./overwrite.js";

export interface PdfRenderer {
  render(sourcePath: string): Promise<Uint8Array>;
}

export interface DocumentConverterOptions {
  readonly forceOverwrite: boolean;
  readonly interactive?: boolean;
  readonly prompt?: OverwritePrompt;
  readonly renderer: PdfRenderer;
}

export type ConversionResult = ConvertedDocument | SkippedDocument;

export interface ConvertedDocument {
  readonly kind: "converted";
  readonly outputPath: string;
  readonly sourcePath: string;
}

export interface SkippedDocument {
  readonly kind: "skipped";
  readonly outputPath: string;
  readonly reason: string;
  readonly sourcePath: string;
}

export class DocumentConverter {
  private readonly forceOverwrite: boolean;
  private readonly interactive: boolean;
  private readonly prompt: OverwritePrompt;
  private readonly renderer: PdfRenderer;

  constructor(options: DocumentConverterOptions) {
    this.forceOverwrite = options.forceOverwrite;
    this.interactive = options.interactive ?? isInteractiveTerminal();
    this.prompt = options.prompt ?? new ConsoleOverwritePrompt();
    this.renderer = options.renderer;
  }

  async convert(workItem: ConversionWorkItem): Promise<ConversionResult> {
    const outputExists = existsSync(workItem.outputPath);
    const decision = decideOverwrite({
      forceOverwrite: this.forceOverwrite,
      interactive: this.interactive,
      outputExists,
    });

    if (decision === "skip") {
      return skipped(workItem, "Output exists.");
    }

    if (decision === "prompt" && !(await this.prompt.confirmOverwrite(workItem.outputPath))) {
      return skipped(workItem, "Overwrite declined.");
    }

    const pdf = await this.renderer.render(workItem.sourcePath);
    await mkdir(dirname(workItem.outputPath), { recursive: true });
    await writeFile(workItem.outputPath, pdf);

    return {
      kind: "converted",
      outputPath: workItem.outputPath,
      sourcePath: workItem.sourcePath,
    };
  }
}

function skipped(workItem: ConversionWorkItem, reason: string): SkippedDocument {
  return {
    kind: "skipped",
    outputPath: workItem.outputPath,
    reason,
    sourcePath: workItem.sourcePath,
  };
}
