import { createInterface } from 'node:readline/promises';
import type { Readable, Writable } from 'node:stream';

export type OverwriteDecision = 'write' | 'prompt' | 'skip';

export interface OverwriteInputs {
  outputExists: boolean;
  forceOverwrite: boolean;
  interactive: boolean;
}

export function decideOverwrite(inputs: OverwriteInputs): OverwriteDecision {
  if (!inputs.outputExists) return 'write';
  if (inputs.forceOverwrite) return 'write';
  if (inputs.interactive) return 'prompt';
  return 'skip';
}

export interface ConfirmOverwriteOptions {
  input: Readable;
  output: Writable;
}

export async function confirmOverwrite(
  outputPath: string,
  options: ConfirmOverwriteOptions,
): Promise<boolean> {
  const rl = createInterface({ input: options.input, output: options.output });
  try {
    const answer = await rl.question(`${outputPath} exists. Overwrite? [y/N] `);
    return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}
