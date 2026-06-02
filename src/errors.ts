export class Md2PdfError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.name = new.target.name;
    this.exitCode = exitCode;
  }
}

export class UsageError extends Md2PdfError {
  constructor(message: string) {
    super(message, 2);
  }
}

export class ConversionError extends Md2PdfError {
  constructor(message: string) {
    super(message, 1);
  }
}

export class PathError extends Md2PdfError {
  constructor(message: string) {
    super(message, 1);
  }
}
