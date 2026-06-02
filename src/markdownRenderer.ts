import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import footnote from 'markdown-it-footnote';
import hljs from 'highlight.js';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const _require = createRequire(import.meta.url);
const _dirname = dirname(fileURLToPath(import.meta.url));

function readAsset(name: string): string {
  return readFileSync(resolve(_dirname, '..', 'assets', name), 'utf8');
}

function getMermaidBundle(): string {
  const mermaidPath = _require.resolve('mermaid/dist/mermaid.min.js');
  return readFileSync(mermaidPath, 'utf8');
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  bmp: 'image/bmp',
};

const TRANSPARENT_PIXEL_DATA_URI =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

function imageToDataUri(imgPath: string): string {
  const ext = extname(imgPath).toLowerCase().slice(1);
  const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';
  const data = readFileSync(imgPath);
  return `data:${mime};base64,${data.toString('base64')}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isExternalNetworkUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export interface RenderOptions {
  /** Absolute path to the source Markdown file — used to resolve relative images. */
  sourceFilePath: string;
}

/**
 * Renders Markdown to a self-contained HTML file written inside a per-run
 * temporary directory.  Returns the absolute path to that file so the browser
 * renderer can load it via a `file:` URL.
 *
 * The caller is responsible for cleaning up the temporary directory after the
 * PDF has been produced.
 */
export function renderToTempHtml(markdown: string, options: RenderOptions): string {
  const html = renderToHtml(markdown, options);
  const tempDir = mkdtempSync(join(tmpdir(), 'md2pdf-'));
  const htmlPath = join(tempDir, 'document.html');
  writeFileSync(htmlPath, html, 'utf8');
  return htmlPath;
}

export function renderToHtml(markdown: string, options: RenderOptions): string {
  const sourceDir = dirname(options.sourceFilePath);

  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          const highlighted = hljs.highlight(code, {
            language: lang,
            ignoreIllegals: true,
          }).value;
          return `<pre class="hljs"><code class="language-${lang}">${highlighted}</code></pre>`;
        } catch {
          // fall through to default
        }
      }
      return `<pre class="hljs"><code>${hljs.highlight(code, { language: 'plaintext' }).value}</code></pre>`;
    },
  })
    .use(taskLists, { enabled: true, label: true })
    .use(footnote);

  // Keep the assembled document local-only: inline relative images and remove
  // network image sources so the browser never performs an outbound fetch.
  const origImageRule = md.renderer.rules['image'];
  md.renderer.rules['image'] = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];
    if (!token) {
      return self.renderToken(tokens, idx, opts);
    }

    const srcIdx = token.attrIndex('src');
    const srcAttr = token.attrs?.[srcIdx];
    if (srcIdx >= 0 && srcAttr) {
      const src = srcAttr[1];
      if (src && isExternalNetworkUrl(src)) {
        srcAttr[1] = TRANSPARENT_PIXEL_DATA_URI;
      } else if (src && !src.startsWith('data:')) {
        const imgPath = resolve(sourceDir, src);
        if (existsSync(imgPath)) {
          srcAttr[1] = imageToDataUri(imgPath);
        }
      }
    }
    return origImageRule
      ? origImageRule(tokens, idx, opts, env, self)
      : self.renderToken(tokens, idx, opts);
  };

  const origLinkOpenRule = md.renderer.rules['link_open'];
  md.renderer.rules['link_open'] = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];
    if (!token) {
      return self.renderToken(tokens, idx, opts);
    }

    const hrefIdx = token.attrIndex('href');
    const hrefAttr = token.attrs?.[hrefIdx];
    if (hrefIdx >= 0 && hrefAttr && isExternalNetworkUrl(hrefAttr[1])) {
      token.attrs?.splice(hrefIdx, 1);
    }

    return origLinkOpenRule
      ? origLinkOpenRule(tokens, idx, opts, env, self)
      : self.renderToken(tokens, idx, opts);
  };

  // Emit mermaid fences as browser-rendered divs instead of code blocks
  const origFenceRule = md.renderer.rules['fence'];
  md.renderer.rules['fence'] = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];
    if (!token) {
      return self.renderToken(tokens, idx, opts);
    }

    const lang = token.info.trim().split(/\s+/)[0];
    if (lang === 'mermaid') {
      // Escape content so HTML stays valid; Mermaid reads .textContent which decodes entities
      return `<div class="mermaid">\n${escapeHtml(token.content.trim())}\n</div>\n`;
    }
    return origFenceRule
      ? origFenceRule(tokens, idx, opts, env, self)
      : self.renderToken(tokens, idx, opts);
  };

  const body = md.render(markdown);

  const defaultCss = readAsset('default.css');
  const highlightCss = readAsset('highlight.css');
  const mermaidBundle = getMermaidBundle();

  return assembleHtml(body, defaultCss, highlightCss, mermaidBundle);
}

function assembleHtml(
  body: string,
  defaultCss: string,
  highlightCss: string,
  mermaidBundle: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <style>
${defaultCss}
  </style>
  <style>
${highlightCss}
  </style>
  <style>
@media print {
  @page { margin: 2cm 2.5cm; }
  h1, h2, h3, h4, h5, h6 { orphans: 3; widows: 3; page-break-after: avoid; }
  pre, blockquote { page-break-inside: avoid; }
  table { page-break-inside: avoid; }
  .mermaid svg { max-width: 100%; }
}
  </style>
  <script>
${mermaidBundle}
  </script>
</head>
<body>
  <div class="markdown-body">
${body}
  </div>
  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
  </script>
</body>
</html>`;
}
