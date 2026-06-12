import { type Md2PdfError } from "./errors.js";

export interface ConvertOptions {
  browserPath?: string;
  renderTimeoutMs?: number;
}

export { convertFile } from "./converter.js";

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
