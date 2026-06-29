import {
  type ConversionJob,
  type ConversionOutcome,
  type ConvertOptions,
} from "./contracts.js";
import {
  ArtifactFreshnessError,
  BrowserNotFoundError,
  ConversionError,
  InputNotFoundError,
  Md2PdfError,
  RenderError,
  UsageError,
} from "./errors.js";
import {
  evaluateOverwrite,
  type OverwriteMode,
  type OverwritePromptIo,
} from "./overwrite.js";
import {
  resolveConversionPlan,
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
  overwrite?: PipelineOverwriteOptions;
}

export interface PipelineOverwriteOptions {
  forceOverwrite: boolean;
  mode: OverwriteMode;
  promptIo: OverwritePromptIo;
}

export class ConversionPipeline {
  constructor(private readonly convertFile: ConvertFile) {}

  async run(options: ConversionPipelineOptions): Promise<ConversionOutcome[]> {
    const plan = await resolveConversionPlan(options.entries, options);
    const outcomes = [...plan.failures];

    outcomes.push(...await this.convertJobs(plan.jobs, options));
    return outcomes;
  }

  private async convertJobs(
    jobs: ConversionJob[],
    pipelineOptions: ConversionPipelineOptions,
  ): Promise<ConversionOutcome[]> {
    const outcomes: ConversionOutcome[] = [];

    for (const job of jobs) {
      outcomes.push(await this.convertJob(job, pipelineOptions));
    }

    return outcomes;
  }

  private async convertJob(
    job: ConversionJob,
    pipelineOptions: ConversionPipelineOptions,
  ): Promise<ConversionOutcome> {
    const overwrite = pipelineOptions.overwrite;

    if (overwrite !== undefined) {
      const evaluation = await evaluateOverwrite(job, overwrite);

      if (!evaluation.shouldConvert) {
        return { ...job, status: "skipped" };
      }
    }

    return this.runConverter(job, pipelineOptions.convertOptions);
  }

  private async runConverter(
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
    return withJobContext(error, job);
  }

  return new ConversionError({
    message: "conversion failed",
    sourcePath: job.sourcePath,
    outputPath: job.outputPath,
    actionHint: "inspect the conversion error cause",
    cause: error,
  });
}

function withJobContext(error: Md2PdfError, job: ConversionJob): Md2PdfError {
  const sourcePath = error.context.sourcePath ?? job.sourcePath;
  const outputPath = error.context.outputPath ?? job.outputPath;

  if (sourcePath === error.context.sourcePath && outputPath === error.context.outputPath) {
    return error;
  }

  const context = {
    ...error.context,
    sourcePath,
    outputPath,
  };

  switch (error.kind) {
    case "usage":
      return new UsageError(context);
    case "input":
      return new InputNotFoundError(context);
    case "conversion":
      return new ConversionError(context);
    case "render":
      return new RenderError(context);
    case "browser":
      return new BrowserNotFoundError(context);
    case "artifact":
      return new ArtifactFreshnessError(context);
  }
}
