export type ErrorKind =
  | "usage"
  | "input"
  | "conversion"
  | "render"
  | "browser"
  | "artifact";

export interface Md2PdfErrorContext {
  kind: ErrorKind;
  message: string;
  sourcePath?: string;
  outputPath?: string;
  artifactName?: string;
  actionHint?: string;
  cause?: unknown;
}

type ErrorContextInput = Omit<Md2PdfErrorContext, "kind">;

export class Md2PdfError extends Error {
  readonly context: Md2PdfErrorContext;
  readonly kind: ErrorKind;

  constructor(context: Md2PdfErrorContext) {
    super(context.message, context.cause === undefined ? undefined : { cause: context.cause });
    this.name = new.target.name;
    this.context = { ...context };
    this.kind = context.kind;
  }

  toJSON(): Md2PdfErrorContext {
    return { ...this.context };
  }
}

export class UsageError extends Md2PdfError {
  constructor(context: ErrorContextInput | string) {
    super(withKind("usage", context));
  }
}

export class InputNotFoundError extends Md2PdfError {
  constructor(context: ErrorContextInput | string) {
    super(withKind("input", context));
  }
}

export class ConversionError extends Md2PdfError {
  constructor(context: ErrorContextInput | string) {
    super(withKind("conversion", context));
  }
}

export class RenderError extends Md2PdfError {
  constructor(context: ErrorContextInput | string) {
    super(withKind("render", context));
  }
}

export class BrowserNotFoundError extends Md2PdfError {
  constructor(context: ErrorContextInput | string) {
    super(withKind("browser", context));
  }
}

export class ArtifactFreshnessError extends Md2PdfError {
  constructor(context: ErrorContextInput | string) {
    super(withKind("artifact", context));
  }
}

export function formatError(error: Md2PdfError): string {
  const { context } = error;
  const lines = [`[${context.kind}] ${context.message}`];

  appendField(lines, "source", context.sourcePath);
  appendField(lines, "output", context.outputPath);
  appendField(lines, "artifact", context.artifactName);
  appendField(lines, "hint", context.actionHint);
  appendField(lines, "cause", formatCause(context.cause));

  return lines.join("\n");
}

function withKind(kind: ErrorKind, context: ErrorContextInput | string): Md2PdfErrorContext {
  if (typeof context === "string") {
    return { kind, message: context };
  }

  return { ...context, kind };
}

function appendField(lines: string[], label: string, value: string | undefined): void {
  if (value !== undefined && value !== "") {
    lines.push(`${label}: ${value}`);
  }
}

function formatCause(cause: unknown): string | undefined {
  if (cause === undefined) {
    return undefined;
  }

  if (cause instanceof Error) {
    return cause.message;
  }

  if (typeof cause === "string") {
    return cause;
  }

  return String(cause);
}
