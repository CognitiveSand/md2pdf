import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToHtml, renderToTempHtml } from '../../src/markdownRenderer.js';

const _dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(_dirname, '..', 'fixtures');
const sampleMd = join(fixturesDir, 'sample.md');

function render(markdown: string, sourceFilePath = sampleMd): string {
  return renderToHtml(markdown, { sourceFilePath });
}

describe('renderToHtml', () => {
  describe('HTML structure', () => {
    it('produces a complete HTML document', () => {
      const html = render('# Hello');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('class="markdown-body"');
    });

    it('contains no external http/https URLs', () => {
      const markdown = [
        readFileSync(sampleMd, 'utf8'),
        '![remote](https://example.com/img.png)',
        '[remote link](http://example.com/page)',
      ].join('\n\n');
      const html = render(markdown);
      // Strip inline script content (mermaid bundle may reference protocol-relative URLs in comments)
      // Check that no src/href/url() points to an external server
      const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '');
      expect(withoutScripts).not.toMatch(/https?:\/\//);
    });
  });

  describe('prose rendering', () => {
    it('renders headings', () => {
      const html = render('# H1\n## H2\n### H3');
      expect(html).toContain('<h1>H1</h1>');
      expect(html).toContain('<h2>H2</h2>');
      expect(html).toContain('<h3>H3</h3>');
    });

    it('renders bold and italic', () => {
      const html = render('**bold** _italic_');
      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<em>italic</em>');
    });

    it('renders paragraphs', () => {
      const html = render('First paragraph.\n\nSecond paragraph.');
      expect(html).toContain('<p>First paragraph.</p>');
      expect(html).toContain('<p>Second paragraph.</p>');
    });

    it('renders unordered lists', () => {
      const html = render('- Alpha\n- Beta\n- Gamma');
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>Alpha</li>');
    });

    it('renders ordered lists', () => {
      const html = render('1. First\n2. Second');
      expect(html).toContain('<ol>');
      expect(html).toContain('<li>First</li>');
    });

    it('renders blockquotes', () => {
      const html = render('> A quoted line');
      expect(html).toContain('<blockquote>');
      expect(html).toContain('A quoted line');
    });
  });

  describe('tables', () => {
    it('renders a GFM table', () => {
      const md = '| A | B |\n|---|---|\n| 1 | 2 |';
      const html = render(md);
      expect(html).toContain('<table>');
      expect(html).toContain('<th>A</th>');
      expect(html).toContain('<td>1</td>');
    });
  });

  describe('task lists', () => {
    it('renders checked and unchecked task items', () => {
      const md = '- [x] Done\n- [ ] Todo';
      const html = render(md);
      expect(html).toContain('checked');
      expect(html).toContain('Done');
      expect(html).toContain('Todo');
    });
  });

  describe('footnotes', () => {
    it('renders a footnote reference and definition', () => {
      const md = 'Text[^fn]\n\n[^fn]: The footnote.';
      const html = render(md);
      expect(html).toContain('fn');
      expect(html).toContain('The footnote.');
    });
  });

  describe('code highlighting', () => {
    it('wraps fenced code in a pre.hljs element', () => {
      const md = '```javascript\nconst x = 1;\n```';
      const html = render(md);
      expect(html).toContain('class="hljs"');
      expect(html).toContain('language-javascript');
    });

    it('handles fenced code with an unknown language without throwing', () => {
      const md = '```unknownlang\nsome code\n```';
      expect(() => render(md)).not.toThrow();
    });

    it('handles fenced code with no language', () => {
      const md = '```\nplain code\n```';
      const html = render(md);
      expect(html).toContain('plain code');
    });

    it('renders inline code', () => {
      const html = render('Use `npm install`.');
      expect(html).toContain('<code>npm install</code>');
    });
  });

  describe('mermaid', () => {
    it('emits a .mermaid div for mermaid fences', () => {
      const md = '```mermaid\ngraph TD\n  A --> B\n```';
      const html = render(md);
      expect(html).toContain('class="mermaid"');
      expect(html).toContain('graph TD');
    });

    it('does not wrap mermaid in a pre/code block', () => {
      const md = '```mermaid\ngraph LR\n  A --> B\n```';
      const html = render(md);
      // Should be a div, not a pre
      const mermaidIdx = html.indexOf('class="mermaid"');
      const tagBefore = html.lastIndexOf('<', mermaidIdx);
      expect(html.slice(tagBefore, mermaidIdx)).toContain('<div');
    });

    it('includes the mermaid initializer script', () => {
      const html = render('# no diagrams');
      expect(html).toContain('mermaid.initialize');
    });

    it('escapes HTML special chars inside mermaid div', () => {
      const md = '```mermaid\ngraph LR\n  A["<value>"] --> B\n```';
      const html = render(md);
      expect(html).toContain('&lt;value&gt;');
    });
  });

  describe('assets inlining', () => {
    it('inlines default stylesheet', () => {
      const html = render('# doc');
      expect(html).toContain('markdown-body');
    });

    it('inlines highlight stylesheet', () => {
      const html = render('# doc');
      expect(html).toContain('.hljs');
    });

    it('inlines mermaid bundle script', () => {
      const html = render('# doc');
      // mermaid bundle contains its own module-level code
      expect(html).toContain('mermaid');
    });
  });

  describe('relative image resolution', () => {
    it('replaces a relative image src with a base64 data URI', () => {
      // Create a minimal 1x1 transparent PNG in the fixtures dir
      const pngPath = join(fixturesDir, 'pixel.png');
      // Minimal valid PNG bytes (1x1 transparent pixel)
      const pngBytes = Buffer.from(
        '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
          '0000000a49444154789c6260000000020001e221bc330000000049454e44ae426082',
        'hex',
      );
      writeFileSync(pngPath, pngBytes);

      const md = '![alt](pixel.png)';
      const html = render(md, pngPath.replace('pixel.png', 'sample.md'));
      expect(html).toContain('data:image/png;base64,');
    });

    it('removes absolute image URLs so HTML remains local-only', () => {
      const md = '![ext](https://example.com/img.png)';
      const html = render(md);
      expect(html).not.toContain('https://example.com/img.png');
      expect(html).toContain('data:image/gif;base64,');
    });
  });

  describe('links', () => {
    it('removes external href attributes so HTML remains local-only', () => {
      const html = render('[external](https://example.com/docs)');
      expect(html).not.toContain('https://example.com/docs');
      expect(html).toContain('<a>external</a>');
    });
  });
});

describe('renderToTempHtml', () => {
  it('writes a file to a temporary directory and returns its path', () => {
    const path = renderToTempHtml('# Hello', { sourceFilePath: sampleMd });
    expect(existsSync(path)).toBe(true);
  });

  it('returned path ends with document.html', () => {
    const path = renderToTempHtml('# Test', { sourceFilePath: sampleMd });
    expect(path).toMatch(/document\.html$/);
  });

  it('written file contains valid HTML', () => {
    const path = renderToTempHtml('# Hello\n\nParagraph.', { sourceFilePath: sampleMd });
    const content = readFileSync(path, 'utf8');
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('<h1>Hello</h1>');
  });

  it('each call writes to a distinct temp file', () => {
    const path1 = renderToTempHtml('# A', { sourceFilePath: sampleMd });
    const path2 = renderToTempHtml('# B', { sourceFilePath: sampleMd });
    expect(path1).not.toBe(path2);
  });
});
