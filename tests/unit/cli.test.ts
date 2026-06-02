import { describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import { main } from '../../src/cli.js';
import type { PipelineOptions, PipelineResult } from '../../src/pipeline.js';

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

function result(exitCode: 0 | 1): PipelineResult {
  return {
    outcomes: [],
    succeeded: exitCode === 0 ? 1 : 0,
    failed: exitCode === 0 ? 0 : 1,
    skipped: 0,
    exitCode,
  };
}

describe('cli main', () => {
  it('prints help and exits 0', async () => {
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();

    const code = await main(['--help'], { stdout, stderr });

    expect(code).toBe(0);
    expect(stdout.text()).toContain('--output-dir DIR');
    expect(stdout.text()).toContain('--force-overwrite');
    expect(stderr.text()).toBe('');
  });

  it('returns usage exit 2 when no entry is provided', async () => {
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();

    const code = await main([], { stdout, stderr });

    expect(code).toBe(2);
    expect(stderr.text()).toContain('At least one Markdown file or directory is required.');
  });

  it('returns usage exit 2 for mutually exclusive output options', async () => {
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();

    const code = await main(['a.md', '--output', 'a.pdf', '--output-dir', 'build'], {
      stdout,
      stderr,
    });

    expect(code).toBe(2);
    expect(stderr.text()).toContain('--output and --output-dir are mutually exclusive.');
  });

  it('returns usage exit 2 for parse errors', async () => {
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();

    const code = await main(['--definitely-not-real', 'a.md'], { stdout, stderr });

    expect(code).toBe(2);
    expect(stderr.text()).toContain('Unknown option');
  });

  it('passes parsed options to the pipeline runner', async () => {
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();
    let seen: PipelineOptions | undefined;

    const code = await main(['a.md', 'b.md', '--output-dir', 'build', '-f'], {
      stdout,
      stderr,
      runner: async options => {
        seen = options;
        return result(0);
      },
    });

    expect(code).toBe(0);
    expect(seen?.entries).toEqual(['a.md', 'b.md']);
    expect(seen?.outputDir).toBe('build');
    expect(seen?.forceOverwrite).toBe(true);
  });

  it('returns exit 1 when the pipeline reports a failed conversion', async () => {
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();

    const code = await main(['broken.md'], {
      stdout,
      stderr,
      runner: async () => result(1),
    });

    expect(code).toBe(1);
  });
});
