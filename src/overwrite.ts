import { createInterface } from "node:readline/promises";

export interface OverwritePolicyInput {
  readonly forceOverwrite: boolean;
  readonly interactive: boolean;
  readonly outputExists: boolean;
}

export type OverwriteDecision = "write" | "prompt" | "skip";

export interface OverwritePrompt {
  confirmOverwrite(outputPath: string): Promise<boolean>;
}

export function decideOverwrite(input: OverwritePolicyInput): OverwriteDecision {
  if (!input.outputExists) {
    return "write";
  }

  if (input.forceOverwrite) {
    return "write";
  }

  if (input.interactive) {
    return "prompt";
  }

  return "skip";
}

export function isInteractiveTerminal(
  input = process.stdin,
  output = process.stdout,
): boolean {
  return input.isTTY === true && output.isTTY === true;
}

export class ConsoleOverwritePrompt implements OverwritePrompt {
  async confirmOverwrite(outputPath: string): Promise<boolean> {
    const prompt = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      const answer = await prompt.question(`Overwrite ${outputPath}? [y/N] `);
      return isOverwriteConfirmed(answer);
    } finally {
      prompt.close();
    }
  }
}

export function isOverwriteConfirmed(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();
  return normalized === "y" || normalized === "yes";
}
