import { promises as fs } from "node:fs";
import { constants as fsConstants } from "node:fs";
import { createInterface } from "node:readline";

import type { ConversionJob } from "./contracts.js";
import { ConversionError } from "./errors.js";

export type OverwriteMode = "interactive" | "non-interactive";

export type OverwritePolicyAction =
  | "continue"
  | "prompt"
  | "skip"
  | "overwrite";

export interface OverwritePolicyInput {
  outputExists: boolean;
  mode: OverwriteMode;
  forceOverwrite: boolean;
}

export interface OverwritePromptIo {
  stdin: NodeJS.ReadableStream;
  stderr: Pick<NodeJS.WritableStream, "write">;
}

export interface OverwriteEvaluationOptions {
  forceOverwrite: boolean;
  mode: OverwriteMode;
  promptIo: OverwritePromptIo;
}

export interface OverwriteEvaluation {
  shouldConvert: boolean;
}

export function decideOverwriteAction(input: OverwritePolicyInput): OverwritePolicyAction {
  if (!input.outputExists) {
    return "continue";
  }

  if (input.forceOverwrite) {
    return "overwrite";
  }

  if (input.mode === "interactive") {
    return "prompt";
  }

  return "skip";
}

export function isAffirmativeOverwriteResponse(response: string | undefined): boolean {
  if (response === undefined) {
    return false;
  }

  const normalized = response.trim().toLowerCase();
  return normalized === "y" || normalized === "yes";
}

export async function evaluateOverwrite(
  job: ConversionJob,
  options: OverwriteEvaluationOptions,
): Promise<OverwriteEvaluation> {
  const outputExists = await doesOutputExist(job.outputPath);
  const action = decideOverwriteAction({
    outputExists,
    mode: options.mode,
    forceOverwrite: options.forceOverwrite,
  });

  if (action === "continue") {
    return { shouldConvert: true };
  }

  if (action === "overwrite") {
    await ensureOutputReplaceable(job.outputPath);
    return { shouldConvert: true };
  }

  if (action === "skip") {
    options.promptIo.stderr.write(`Skipping existing output: ${job.outputPath}\n`);
    return { shouldConvert: false };
  }

  const promptIo = options.promptIo;
  promptIo.stderr.write(`Overwrite existing output ${job.outputPath}? [y/N] `);
  const response = await readFirstLine(promptIo.stdin);
  const shouldConvert = isAffirmativeOverwriteResponse(response);

  if (!shouldConvert) {
    promptIo.stderr.write(`\nSkipping existing output: ${job.outputPath}\n`);
    return { shouldConvert };
  }

  await ensureOutputReplaceable(job.outputPath);
  return { shouldConvert };
}

async function doesOutputExist(outputPath: string): Promise<boolean> {
  try {
    await fs.lstat(outputPath);
    return true;
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return false;
    }

    throw new ConversionError({
      message: "could not inspect output path",
      outputPath,
      actionHint: "check output path permissions before rerunning md2pdf",
      cause: error,
    });
  }
}

async function readFirstLine(input: NodeJS.ReadableStream): Promise<string | undefined> {
  const reader = createInterface({
    input,
    terminal: false,
  });

  try {
    for await (const line of reader) {
      return line;
    }

    return undefined;
  } finally {
    reader.close();
  }
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

async function ensureOutputReplaceable(outputPath: string): Promise<void> {
  const stat = await lstatReplaceableOutput(outputPath);

  if (!stat.isFile()) {
    throwExistingOutputNotReplaceable(
      outputPath,
      new Error("existing output is not a regular file"),
    );
  }

  await accessReplaceableOutput(outputPath);
}

async function lstatReplaceableOutput(outputPath: string): Promise<Awaited<ReturnType<typeof fs.lstat>>> {
  try {
    return await fs.lstat(outputPath);
  } catch (error) {
    throwExistingOutputNotReplaceable(outputPath, error);
  }
}

async function accessReplaceableOutput(outputPath: string): Promise<void> {
  try {
    await fs.access(outputPath, fsConstants.W_OK);
  } catch (error) {
    throwExistingOutputNotReplaceable(outputPath, error);
  }
}

function throwExistingOutputNotReplaceable(outputPath: string, cause: unknown): never {
  throw new ConversionError({
    message: "existing output is not replaceable",
    outputPath,
    actionHint: "check output file permissions or choose a different output path",
    cause,
  });
}
