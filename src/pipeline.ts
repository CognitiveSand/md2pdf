import {
  type ConversionJob,
  type ConversionOutcome,
  type ConvertOptions,
} from "./contracts.js";
import { ConversionError, Md2PdfError } from "./errors.js";
import {
  resolveConversionJobs,
  type ResolveJobsOptions,
} from "./paths.js";

export type ConvertFile = (
  sourcePath: string,
  outputPath: string,
  options?: ConvertOptions,
) => Promise<void>;

export interface ConversionPipelineOptions extends ResolveJobsOptions {
  entries: string[];
  convertOptions?: ConvertOptions;
}

export class ConversionPipeline {
  constructor(private readonly convertFile: ConvertFile) {}

  async run(options: ConversionPipelineOptions): Promise<ConversionOutcome[]> {
    const jobs = await resolveConversionJobs(options.entries, options);

    return this.convertJobs(jobs, options.convertOptions);
  }

  private async convertJobs(
    jobs: ConversionJob[],
    options: ConvertOptions | undefined,
  ): Promise<ConversionOutcome[]> {
    const outcomes: ConversionOutcome[] = [];

    for (const job of jobs) {
      outcomes.push(await this.convertJob(job, options));
    }

    return outcomes;
  }

  private async convertJob(
    job: ConversionJob,
    options: ConvertOptions | undefined,
  ): Promise<ConversionOutcome> {
    try {
      await this.convertFile(job.sourcePath, job.outputPath, options);
      return { ...job, status: "success" };
    } catch (error) {
      return {
        ...job,
        status: "failed",
        error: toMd2PdfError(error, job),
      };
    }
  }
}

function toMd2PdfError(error: unknown, job: ConversionJob): Md2PdfError {
  if (error instanceof Md2PdfError) {
    return error;
  }

  return new ConversionError({
    message: "conversion failed",
    sourcePath: job.sourcePath,
    outputPath: job.outputPath,
    actionHint: "inspect the conversion error cause",
    cause: error,
  });
}
