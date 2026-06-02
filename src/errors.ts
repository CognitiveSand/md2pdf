export class Md2PdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Md2PdfError';
    // Restore prototype chain for instanceof checks across compilation targets
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** CLI usage error — maps to exit code 2. */
export class UsageError extends Md2PdfError {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Conversion failure for a single source file — maps to exit code 1. */
export class ConversionError extends Md2PdfError {
  constructor(
    message: string,
    public readonly sourcePath?: string,
  ) {
    super(message);
    this.name = 'ConversionError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** No supported browser was found on the host. */
export class BrowserNotFoundError extends ConversionError {
  constructor() {
    super(
      [
        'No supported browser found.',
        'md2pdf requires Google Chrome, Chromium, or Firefox.',
        '',
        'Install one of:',
        '  Google Chrome  — https://www.google.com/chrome/',
        '  Chromium       — https://www.chromium.org/',
        '  Firefox        — https://www.mozilla.org/firefox/',
        '',
        'Or point MD2PDF_BROWSER to a browser executable:',
        '  export MD2PDF_BROWSER=/usr/bin/chromium',
      ].join('\n'),
    );
    this.name = 'BrowserNotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
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
        '  Chrome/Chromium — https://chromedriver.chromium.org/downloads',
        '  Firefox         — https://github.com/mozilla/geckodriver/releases',
      ].join('\n'),
    );
    this.name = 'DriverNotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** PDF rendering failed for a source file. */
export class RenderError extends ConversionError {
  constructor(message: string, sourcePath: string) {
    super(`Render failed for ${sourcePath}: ${message}`, sourcePath);
    this.name = 'RenderError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** An artifact version violates the 7-day freshness quarantine policy. */
export class ArtifactFreshnessError extends Md2PdfError {
  constructor(message: string) {
    super(message);
    this.name = 'ArtifactFreshnessError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
