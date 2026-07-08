<p align="center">
  <img src="docs/images/banner_readme_md2pdf.png" alt="md2pdf banner">
</p>

<h1 align="center">md2pdf</h1>

<p align="center">
  Convert Markdown to clean PDFs with one command.<br>
  Lightweight and fully local.
</p>

## Quick Start

You need Node.js 20 or later and one installed browser: Google Chrome,
Chromium, Microsoft Edge, Brave, Vivaldi, or Firefox.

```bash
npx @cognitivesand/md2pdf notes.md
# creates notes.pdf beside notes.md
```

Or install the command globally:

```bash
npm install --global @cognitivesand/md2pdf
md2pdf notes.md
```

Works with Bun: `bunx @cognitivesand/md2pdf notes.md` resolves the same npm
package.

## Why md2pdf

AI assistants and coding agents write Markdown by default. Chat exports,
generated reports, design documents, meeting summaries, project documentation:
the volume of Markdown produced every day has grown with every model release,
and most of it eventually needs to reach someone who does not read Markdown.
PDF is how that document lands in an inbox, a review, or an archive.

The existing routes to a PDF each ask for a trade-off. A TeX/LaTeX toolchain
means a multi-gigabyte install to convert a two-page note. Converters built on
a bundled headless browser download hundreds of megabytes of Chromium per
project. Online converters are the worst trade: your document leaves your
machine for a server you do not control.

md2pdf takes none of those trades. It renders your Markdown in the browser you
already have, entirely on your machine.

## Objectives

- **Fully local.** Your documents never leave your machine. No telemetry, no
  remote rendering, no network calls with your content.
- **Open source.** MIT-licensed, developed in the open at
  [CognitiveSand/md2pdf](https://github.com/CognitiveSand/md2pdf).
- **Complete Markdown support.** Tables, task lists, footnotes,
  syntax-highlighted code fences, local raster images (PNG, JPEG, WebP), and
  Mermaid diagrams rendered to vector graphics in the PDF.
- **Lightweight.** Five small, actively maintained runtime dependencies. The
  Mermaid renderer ships inside the package as a single pinned, checksummed
  asset instead of pulling in its ~100-package dependency tree, and md2pdf
  drives the browser already installed on your system instead of shipping one.
- **Minimal attack surface.** Remote scripts, stylesheets, and images are never
  loaded. Non-HTTPS and active link schemes (`javascript:`, `data:`, `file:`,
  ...) are neutralized to plain text. Inputs are bounded by safety limits, and
  every dependency and vendored asset passes a 7-day quarantine before adoption
  (see the [Artifact Freshness Policy](ARTIFACT_FRESHNESS_POLICY.md)).

## Usage

```bash
md2pdf [OPTIONS] ENTRY [ENTRY ...]

ENTRY                     a Markdown file or a directory of Markdown files
-o, --output PATH         output path for a single-file conversion
    --output-dir DIR      write every output PDF into DIR
-f, --force-overwrite     overwrite existing output PDFs without prompting
-h, --help                list options with one-line descriptions
```

Examples:

```bash
md2pdf notes.md
md2pdf notes.md --output out/report.pdf
md2pdf a.md b.md --output-dir build
md2pdf ./notes-folder
md2pdf notes.md --force-overwrite
```

Directory conversion is non-recursive: only top-level `.md` files in
the named directory are converted. The `.md` extension is matched
case-insensitively.

### Behavior Notes

- By default, `notes.md` writes `notes.pdf` beside the source.
- `--output` is valid only when exactly one Markdown file is produced. The
  extension is used verbatim; the CLI does not force `.pdf`.
- `--output-dir` uses each source file's base name.
- `--output` and `--output-dir` are mutually exclusive.
- Existing outputs are preserved unless `--force-overwrite` is supplied or an
  interactive overwrite prompt is accepted.
- In non-interactive mode, an existing output without `--force-overwrite` is
  skipped and counted in the final summary.
- Batch conversion continues after per-file conversion failures and prints a
  final summary: `<succeeded> succeeded, <failed> failed, <skipped> skipped`.

Exit codes:

- `0`: every conversion succeeded, or all existing outputs were skipped without
  conversion failures.
- `1`: at least one conversion failed.
- `2`: invalid command-line usage.

### Markdown Scope

md2pdf supports headings, paragraphs, lists, tables, task lists, footnotes,
fenced code blocks, relative raster images (PNG, JPEG, and WebP), and Mermaid
code fences. Browser-backed tests cover the rendered PDF behavior for the rich
Markdown and Mermaid paths.

Images must be local relative files under the Markdown source directory. SVG,
GIF, remote image URLs, absolute image paths, file URLs, unknown extensions,
mismatched image content, and symlinks that escape the source directory are
rejected before rendering.

Safe HTTPS links remain clickable in the generated PDF. Non-HTTPS, local, and
active schemes such as `http:`, `javascript:`, `data:`, `file:`, `blob:`, and
`ftp:` are rendered as text links without an `href`.

Safety limits enforced during rendering: Markdown documents up to 10 MB,
individual lines up to 1 MB, up to 100 images, up to 50 Mermaid blocks, Mermaid
blocks up to 256 KB, highlighted code fences up to 1 MB, individual images up
to 20 MB, total embedded image bytes up to 100 MB, and image dimensions up to
25 megapixels.

### Browser and Driver Selection

md2pdf detects an installed browser on first run and resolves a matching
WebDriver from the artifacts declared in `artifacts.json`, provisioned into a
per-user cache. It does not select arbitrary drivers from `PATH`. For a browser
whose WebDriver ships bundled with it (such as the Firefox snap), md2pdf uses
that bundled driver after a compatibility check.

`MD2PDF_BROWSER` may point the converter at a specific browser executable. It
is an environment variable, not a CLI option:

```bash
MD2PDF_BROWSER=/usr/bin/chromium md2pdf notes.md
```

### Windows PowerShell Shim

On Windows, npm can generate both `md2pdf.cmd` and `md2pdf.ps1` shims.
PowerShell may resolve `md2pdf` to the `.ps1` shim first, and the local
ExecutionPolicy can block that script even when the `.cmd` shim is available.
Use the command shim directly when that happens:

```powershell
md2pdf.cmd --help
```

## Project Structure

```
src/          TypeScript sources: CLI, converter pipeline, Markdown renderer,
              browser locator, WebDriver client, artifact policy
tests/        unit, integration, and browser-backed test suites plus fixtures
docs/         architecture, requirements, user stories, CI matrix, research
scripts/      artifact freshness, package, and build check scripts
assets/       default and highlight stylesheets bundled into the PDF
security/     security audit records
artifacts.json           declared runtime artifacts (browsers, drivers)
ARTIFACT_FRESHNESS_POLICY.md  the dependency quarantine policy
```

## Contributing

Issues and pull requests are welcome at
[CognitiveSand/md2pdf](https://github.com/CognitiveSand/md2pdf).

To install from source:

```bash
git clone https://github.com/CognitiveSand/md2pdf.git
cd md2pdf
npm install --global .
md2pdf --help
```

The `prepare` script compiles `dist/` during install, so `md2pdf` lands on your
`PATH` in one step on Linux, macOS, or Windows. Re-run the same command after
pulling changes.

### Development

```bash
npm ci
npm run typecheck
npm test
npm run test:contracts
npm run check:artifacts
npm run build
```

`npm test` runs fast unit and contract coverage. `npm run test:browser` runs
the browser-backed integration tests and requires a local browser plus an
eligible WebDriver declared in `artifacts.json`. `npm run test:all` is the full
release gate; it runs automatically before every publish.

Publishing is automated: creating a GitHub release triggers
[`publish.yml`](.github/workflows/publish.yml), which runs the full release
gate and publishes to npm via trusted publishing (OIDC) with provenance.

Local development may set `MD2PDF_SKIP_REAL_BROWSER_TESTS=1` to skip the real
browser proof explicitly; release evidence must run without that skip.

To smoke-test the exact tarball that would be published:

```bash
npm ci
npm pack
npm install --global --prefix /tmp/md2pdf-user ./cognitivesand-md2pdf-<version>.tgz
/tmp/md2pdf-user/bin/md2pdf --help
```

### Artifact Freshness Policy

Every artifact in md2pdf must be the newest eligible version available after a
7-day quarantine period. The policy applies to npm dependencies, transitive
lockfile entries, bundled assets, drivers, browser fallback builds, generated
vendor files, and runtime provisioning paths. There is no emergency bypass or
force mode. See [`ARTIFACT_FRESHNESS_POLICY.md`](ARTIFACT_FRESHNESS_POLICY.md).

## Project Status

The current release is published as
[`@cognitivesand/md2pdf`](https://www.npmjs.com/package/@cognitivesand/md2pdf)
on npm; see the
[GitHub releases](https://github.com/CognitiveSand/md2pdf/releases) for
version history. The release covers the user-visible CLI surface,
browser-backed Markdown rendering,
Mermaid diagrams, local WebDriver printing, overwrite/skip behavior, batch
summaries, npm packaging, artifact freshness checks, and release validation
paths.

---

<p align="center">
  <a href="https://cognitivesand.ai">
    <img src="docs/images/cognitivesand-logo-light.png" alt="CognitiveSand" width="280">
  </a>
</p>

<p align="center">
  md2pdf is built by <strong>CognitiveSand</strong>.<br>
  Discover our work at
  <a href="https://cognitivesand.ai">visit cognitivesand.ai&nbsp;→</a>
</p>
