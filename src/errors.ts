export class Md2PdfError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.name = new.target.name;
    this.exitCode = exitCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** CLI usage error - maps to exit code 2. */
export class UsageError extends Md2PdfError {
  constructor(message: string) {
    super(message, 2);
  }
}

/** Conversion failure for a single source file - maps to exit code 1. */
export class ConversionError extends Md2PdfError {
  constructor(
    message: string,
    public readonly sourcePath?: string,
  ) {
    super(message, 1);
  }
}

export class PathError extends Md2PdfError {
  constructor(message: string) {
    super(message, 1);
  }
}

/** No supported browser was found on the host. */
export class BrowserNotFoundError extends ConversionError {
  constructor() {
    super(
      [
        'No supported default browser found.',
        'md2pdf requires the OS default browser to be Google Chrome, Chromium, or Firefox.',
        '',
        'Install one of these browsers and make it the default browser:',
        '  Google Chrome - https://www.google.com/chrome/',
        '  Chromium      - https://www.chromium.org/',
        '  Firefox       - https://www.mozilla.org/firefox/',
      ].join('\n'),
    );
  }
}

/** The required WebDriver binary was not found on the host. */
export class DriverNotFoundError extends ConversionError {
  constructor(browserKind: string) {
    super(
      [
        `No WebDriver found for ${browserKind}.`,
        '',
        'Install the matching driver and ensure it is on PATH:',
        '  Chrome/Chromium - https://chromedriver.chromium.org/downloads',
        '  Firefox         - https://github.com/mozilla/geckodriver/releases',
      ].join('\n'),
    );
  }
}

/** PDF rendering failed for a source file. */
export class RenderError extends ConversionError {
  constructor(message: string, sourcePath: string) {
    super(`Render failed for ${sourcePath}: ${message}`, sourcePath);
  }
}

/** An artifact version violates the 7-day freshness quarantine policy. */
export class ArtifactFreshnessError extends Md2PdfError {
  constructor(message: string) {
    super(message, 1);
  }
}
