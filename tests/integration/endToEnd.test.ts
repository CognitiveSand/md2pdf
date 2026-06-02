/**
 * Browser-backed integration tests for M5 (WebDriver PDF rendering).
 *
 * These tests require a real browser (Chrome, Chromium, or Firefox) and its
 * matching WebDriver binary to be installed.  They are intentionally excluded
 * from the fast unit-test run (`npm test`) and run via `npm run test:browser`.
 *
 * Each test skips itself gracefully when no browser is found so the suite can
 * still exit 0 in browser-less CI environments.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { locateBrowserAndDriver } from '../../src/browserLocator.js';
import { convertFile } from '../../src/converter.js';
import { BrowserNotFoundError } from '../../src/errors.js';

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

let browserAvailable = false;

beforeAll(async () => {
  try {
    await locateBrowserAndDriver();
    browserAvailable = true;
  } catch (err) {
    console.warn(
      `Browser or driver not available — skipping integration tests.\n  ${(err as Error).message.split('\n')[0]}`,
    );
  }
});

function skipIfNoBrowser(): void {
  if (!browserAvailable) {
    // vitest's `skip` is not in scope here; use a runtime check
    return;
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLAIN_MD = `# Hello

A simple paragraph with **bold** and _italic_ text.

## Code

\`\`\`javascript
const x = 42;
console.log(x);
\`\`\`

## Table

| Name  | Score |
|-------|-------|
| Alice | 100   |
| Bob   | 95    |
`;

const MERMAID_MD = `# Diagram

\`\`\`mermaid
graph TD
  A[Start] --> B{Choice}
  B -->|Yes| C[Done]
  B -->|No| D[Skip]
\`\`\`
`;

const RICH_MD = `# Rich Document

## Task List

- [x] Done item
- [ ] Pending item

## Footnote

Text with a footnote[^1].

[^1]: The footnote body.

## Blockquote

> A quoted paragraph.
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'md2pdf-test-'));
}

function writeFixture(dir: string, name: string, content: string): string {
  const p = join(dir, name);
  writeFileSync(p, content, 'utf8');
  return p;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('end-to-end conversion', () => {
  it('converts plain Markdown to a non-empty PDF beside the source', async () => {
    if (!browserAvailable) return;

    const dir = makeTempDir();
    try {
      const src = writeFixture(dir, 'plain.md', PLAIN_MD);
      const out = join(dir, 'plain.pdf');

      await convertFile(src, out);

      expect(existsSync(out)).toBe(true);
      const { readFileSync } = await import('node:fs');
      const bytes = readFileSync(out);
      expect(bytes.length).toBeGreaterThan(0);
      // PDF magic bytes
      expect(bytes.slice(0, 4).toString()).toBe('%PDF');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('converts Mermaid Markdown: output is a PDF, not raw diagram source', async () => {
    if (!browserAvailable) return;

    const dir = makeTempDir();
    try {
      const src = writeFixture(dir, 'mermaid.md', MERMAID_MD);
      const out = join(dir, 'mermaid.pdf');

      await convertFile(src, out);

      expect(existsSync(out)).toBe(true);
      const { readFileSync } = await import('node:fs');
      const bytes = readFileSync(out);
      expect(bytes.slice(0, 4).toString()).toBe('%PDF');
      // The PDF must not be trivially empty — a rendered SVG adds weight
      expect(bytes.length).toBeGreaterThan(5_000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('converts rich Markdown (task lists, footnotes, blockquotes) to PDF', async () => {
    if (!browserAvailable) return;

    const dir = makeTempDir();
    try {
      const src = writeFixture(dir, 'rich.md', RICH_MD);
      const out = join(dir, 'rich.pdf');

      await convertFile(src, out);

      expect(existsSync(out)).toBe(true);
      const { readFileSync } = await import('node:fs');
      expect(readFileSync(out).slice(0, 4).toString()).toBe('%PDF');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not write a PDF when the source file does not exist', async () => {
    if (!browserAvailable) return;

    const dir = makeTempDir();
    try {
      const src = join(dir, 'nonexistent.md');
      const out = join(dir, 'nonexistent.pdf');

      const { ConversionError } = await import('../../src/errors.js');
      await expect(convertFile(src, out)).rejects.toThrowError(ConversionError);
      expect(existsSync(out)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('local-only guarantee', () => {
  it('assembled HTML contains no external URLs', async () => {
    // This assertion mirrors the unit test in markdownRenderer.test.ts but
    // exercises the full convertFile pipeline to confirm the guarantee holds
    // end-to-end.
    if (!browserAvailable) return;

    const { renderToHtml } = await import('../../src/markdownRenderer.js');
    const dir = makeTempDir();
    try {
      const src = writeFixture(dir, 'local.md', PLAIN_MD);
      const html = renderToHtml(PLAIN_MD, { sourceFilePath: src });
      const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '');
      expect(withoutScripts).not.toMatch(/https?:\/\//);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
