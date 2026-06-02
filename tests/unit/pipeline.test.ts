import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { ConversionError, UsageError } from '../../src/errors.js';
import { runConversionPipeline, type ConvertFn } from '../../src/pipeline.js';

class MemoryWritable extends Writable {
  private readonly chunks: string[] = [];

  _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.chunks.push(String(chunk));
    callback();
  }

  text(): string {
    return this.chunks.join('');
  }
}

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'md2pdf-pipeline-'));
}

function fakeConverter(failingBasename?: string): ConvertFn {
  return async (sourcePath, outputPath) => {
    if (sourcePath.endsWith(failingBasename ?? '<never>')) {
      throw new ConversionError(`Render failed for ${sourcePath}`, sourcePath);
    }
    writeFileSync(outputPath, `pdf:${sourcePath}`, 'utf8');
  };
}

describe('runConversionPipeline', () => {
  it('rejects an empty invocation as a usage error', async () => {
    await expect(runConversionPipeline({ entries: [], interactive: false }))
      .rejects.toThrowError(UsageError);
  });

  it('converts several named Markdown files in one invocation', async () => {
    const dir = makeTempDir();
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();
    try {
      const a = join(dir, 'a.md');
      const b = join(dir, 'b.md');
      writeFileSync(a, '# A');
      writeFileSync(b, '# B');

      const result = await runConversionPipeline({
        entries: [a, b],
        stdout,
        stderr,
        converter: fakeConverter(),
        interactive: false,
      });

      expect(result.exitCode).toBe(0);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(existsSync(join(dir, 'a.pdf'))).toBe(true);
      expect(existsSync(join(dir, 'b.pdf'))).toBe(true);
      expect(stdout.text()).toContain('Summary: 2 succeeded, 0 failed, 0 skipped.');
      expect(stderr.text()).toBe('');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('converts only top-level Markdown files from a directory entry', async () => {
    const dir = makeTempDir();
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();
    try {
      const notes = join(dir, 'notes');
      mkdirSync(join(notes, 'nested'), { recursive: true });
      writeFileSync(join(notes, 'x.md'), '# X');
      writeFileSync(join(notes, 'y.md'), '# Y');
      writeFileSync(join(notes, 'ignore.txt'), 'nope');
      writeFileSync(join(notes, 'nested', 'z.md'), '# Z');

      const result = await runConversionPipeline({
        entries: [notes],
        stdout,
        stderr,
        converter: fakeConverter(),
        interactive: false,
      });

      expect(result.exitCode).toBe(0);
      expect(result.succeeded).toBe(2);
      expect(existsSync(join(notes, 'x.pdf'))).toBe(true);
      expect(existsSync(join(notes, 'y.pdf'))).toBe(true);
      expect(existsSync(join(notes, 'nested', 'z.pdf'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes batch outputs into --output-dir', async () => {
    const dir = makeTempDir();
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();
    try {
      const a = join(dir, 'a.md');
      const b = join(dir, 'b.md');
      const outDir = join(dir, 'build');
      writeFileSync(a, '# A');
      writeFileSync(b, '# B');

      const result = await runConversionPipeline({
        entries: [a, b],
        outputDir: outDir,
        stdout,
        stderr,
        converter: fakeConverter(),
        interactive: false,
      });

      expect(result.exitCode).toBe(0);
      expect(existsSync(join(outDir, 'a.pdf'))).toBe(true);
      expect(existsSync(join(outDir, 'b.pdf'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('continues after one file fails and exits 1', async () => {
    const dir = makeTempDir();
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();
    try {
      const good = join(dir, 'good.md');
      const broken = join(dir, 'broken.md');
      const later = join(dir, 'later.md');
      writeFileSync(good, '# Good');
      writeFileSync(broken, '# Broken');
      writeFileSync(later, '# Later');

      const result = await runConversionPipeline({
        entries: [good, broken, later],
        stdout,
        stderr,
        converter: fakeConverter('broken.md'),
        interactive: false,
      });

      expect(result.exitCode).toBe(1);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
      expect(existsSync(join(dir, 'good.pdf'))).toBe(true);
      expect(existsSync(join(dir, 'broken.pdf'))).toBe(false);
      expect(existsSync(join(dir, 'later.pdf'))).toBe(true);
      expect(stdout.text()).toContain('Summary: 2 succeeded, 1 failed, 0 skipped.');
      expect(stderr.text()).toContain('broken.md');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('records a missing entry failure and still converts valid entries', async () => {
    const dir = makeTempDir();
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();
    try {
      const good = join(dir, 'good.md');
      const missing = join(dir, 'missing.md');
      writeFileSync(good, '# Good');

      const result = await runConversionPipeline({
        entries: [missing, good],
        stdout,
        stderr,
        converter: fakeConverter(),
        interactive: false,
      });

      expect(result.exitCode).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(existsSync(join(dir, 'good.pdf'))).toBe(true);
      expect(stderr.text()).toContain(missing);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('skips existing outputs in non-interactive mode without counting a failure', async () => {
    const dir = makeTempDir();
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();
    try {
      const src = join(dir, 'notes.md');
      const out = join(dir, 'notes.pdf');
      writeFileSync(src, '# Notes');
      writeFileSync(out, 'keep me');

      const result = await runConversionPipeline({
        entries: [src],
        stdout,
        stderr,
        converter: fakeConverter(),
        interactive: false,
      });

      expect(result.exitCode).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(1);
      expect(readFileSync(out, 'utf8')).toBe('keep me');
      expect(stderr.text()).toContain(`Skipped existing output: ${out}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
