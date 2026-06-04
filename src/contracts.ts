import { type Md2PdfError, NotImplementedError } from "./errors.js";

export interface ConvertOptions {
  browserPath?: string;
  renderTimeoutMs?: number;
}

export async function convertFile(
  sourcePath: string,
  outputPath: string,
  options?: ConvertOptions,
): Promise<void> {
  void options;

  throw new NotImplementedError({
    message: "convertFile is not implemented yet",
    sourcePath,
    outputPath,
  });
}

export interface ConversionJob {
  sourcePath: string;
  outputPath: string;
  originEntry: string;
}

export type ConversionStatus = "success" | "failed" | "skipped";

export interface ConversionOutcome extends ConversionJob {
  status: ConversionStatus;
  error?: Md2PdfError;
}
