import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { DocumentConverter, PdfRenderer } from "../../src/converter.js";
import { OverwritePrompt } from "../../src/overwrite.js";
import { ConversionWorkItem } from "../../src/paths.js";

describe("DocumentConverter", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "md2pdf-converter-"));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it("writes a PDF after a successful render", async () => {
    const renderer = new StaticRenderer("rendered");
    const workItem = createWorkItem("notes.md", "out/notes.pdf");

    const result = await createConverter(renderer).convert(workItem);

    assert.equal(result.kind, "converted");
    assert.equal(readFile("out/notes.pdf"), "rendered");
    assert.deepEqual(renderer.renderedSources, [workItem.sourcePath]);
  });

  it("skips existing output in non-interactive mode", async () => {
    writeFile("notes.pdf", "original");
    const renderer = new StaticRenderer("rendered");

    const result = await createConverter(renderer).convert(createWorkItem("notes.md", "notes.pdf"));

    assert.equal(result.kind, "skipped");
    assert.match(result.reason, /Output exists/);
    assert.equal(readFile("notes.pdf"), "original");
    assert.deepEqual(renderer.renderedSources, []);
  });

  it("overwrites existing output when forced", async () => {
    writeFile("notes.pdf", "original");
    const renderer = new StaticRenderer("rendered");
    const converter = createConverter(renderer, { forceOverwrite: true });

    const result = await converter.convert(createWorkItem("notes.md", "notes.pdf"));

    assert.equal(result.kind, "converted");
    assert.equal(readFile("notes.pdf"), "rendered");
  });

  it("skips when the interactive prompt is declined", async () => {
    writeFile("notes.pdf", "original");
    const renderer = new StaticRenderer("rendered");
    const converter = createConverter(renderer, {
      interactive: true,
      prompt: new StaticPrompt(false),
    });

    const result = await converter.convert(createWorkItem("notes.md", "notes.pdf"));

    assert.equal(result.kind, "skipped");
    assert.match(result.reason, /declined/);
    assert.equal(readFile("notes.pdf"), "original");
    assert.deepEqual(renderer.renderedSources, []);
  });

  it("overwrites when the interactive prompt is accepted", async () => {
    writeFile("notes.pdf", "original");
    const renderer = new StaticRenderer("rendered");
    const converter = createConverter(renderer, {
      interactive: true,
      prompt: new StaticPrompt(true),
    });

    const result = await converter.convert(createWorkItem("notes.md", "notes.pdf"));

    assert.equal(result.kind, "converted");
    assert.equal(readFile("notes.pdf"), "rendered");
  });

  it("does not replace an existing PDF when render fails", async () => {
    writeFile("notes.pdf", "original");
    const converter = createConverter(new FailingRenderer(), { forceOverwrite: true });

    await assert.rejects(
      converter.convert(createWorkItem("notes.md", "notes.pdf")),
      /render failed/,
    );

    assert.equal(readFile("notes.pdf"), "original");
  });

  function createConverter(
    renderer: PdfRenderer,
    options: Partial<ConstructorParameters<typeof DocumentConverter>[0]> = {},
  ): DocumentConverter {
    return new DocumentConverter({
      forceOverwrite: options.forceOverwrite ?? false,
      interactive: options.interactive ?? false,
      prompt: options.prompt,
      renderer,
    });
  }

  function createWorkItem(source: string, output: string): ConversionWorkItem {
    writeFile(source, "# Notes\n");

    return {
      sourcePath: join(workspace, source),
      outputPath: join(workspace, output),
    };
  }

  function readFile(path: string): string {
    return readFileSync(join(workspace, path), "utf8");
  }

  function writeFile(path: string, content: string): void {
    mkdirSync(join(workspace, path, ".."), { recursive: true });
    writeFileSync(join(workspace, path), content);
  }
});

class StaticRenderer implements PdfRenderer {
  readonly renderedSources: string[] = [];

  constructor(private readonly content: string) {}

  async render(sourcePath: string): Promise<Uint8Array> {
    this.renderedSources.push(sourcePath);
    return Buffer.from(this.content);
  }
}

class FailingRenderer implements PdfRenderer {
  async render(): Promise<Uint8Array> {
    throw new Error("render failed");
  }
}

class StaticPrompt implements OverwritePrompt {
  constructor(private readonly answer: boolean) {}

  async confirmOverwrite(): Promise<boolean> {
    return this.answer;
  }
}
