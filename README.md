# md2pdf

Convert Markdown files into PDFs locally, without a TeX or LaTeX toolchain.

```bash
md2pdf report.md
# creates report.pdf beside report.md
```

## Status

v0.1.2 is the current MVP implementation. It covers the user-visible CLI
surface, browser-backed Markdown rendering, Mermaid diagrams, local WebDriver
printing, overwrite/skip behavior, batch summaries, npm packaging, artifact
freshness checks, and release validation paths.

## Requirements

- Node.js 20 or later.
- One supported browser installed locally: Google Chrome, Chromium, another
  Chromium-family browser, or Firefox.
- A matching WebDriver binary declared in `artifacts.json` and selected by the
  artifact freshness policy, or a fallback browser/driver provisioned by md2pdf
  into a per-user cache from an eligible declared artifact.

`MD2PDF_BROWSER` may point the runtime converter at a specific browser
executable. It is an environment variable, not a CLI option:

```bash
MD2PDF_BROWSER=/usr/bin/chromium md2pdf notes.md
```

WebDriver binaries are runtime artifacts. They must be declared in
`artifacts.json`; md2pdf does not select arbitrary drivers from `PATH`.

## Install

After publication, the package can be used without administrator privileges:

```bash
npx md2pdf notes.md
npm install --global md2pdf
md2pdf --help
```

For local development or release smoke testing:

```bash
npm ci
npm run build
npm pack
npm install --global --prefix /tmp/md2pdf-user ./<tarball-from-npm-pack>.tgz
/tmp/md2pdf-user/bin/md2pdf --help
```

Re-running the same install command converges on the same package version and
exits successfully.

### Windows PowerShell Shim

On Windows, npm can generate both `md2pdf.cmd` and `md2pdf.ps1` shims. PowerShell
may resolve `md2pdf` to the `.ps1` shim first, and the local ExecutionPolicy can
block that script even when the `.cmd` shim is available.

Use the command shim directly when PowerShell blocks the script shim:

```powershell
md2pdf.cmd --help
```

Or invoke the command from `cmd.exe`:

```cmd
md2pdf --help
```

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
md2pdf --help
```

Directory conversion is non-recursive for v0.1: only top-level `.md` files in
the named directory are converted. The `.md` extension is matched
case-insensitively.

## Options

`ENTRY` is one Markdown file or one directory containing top-level Markdown
files. Multiple entries are allowed.

`-o, --output PATH` writes a single-file conversion to `PATH`. It is valid only
when exactly one Markdown file is produced. The extension is used verbatim; the
CLI does not force `.pdf`.

`--output-dir DIR` writes every output PDF into `DIR` using each source file's
base name.

`-f, --force-overwrite` overwrites existing output PDFs without prompting.

`-h, --help` prints the CLI usage text and exits with status `0`.

## Output And Errors

- By default, `notes.md` writes `notes.pdf` beside the source.
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

## Markdown Scope

md2pdf supports Markdown features such as headings, paragraphs, lists, tables,
task lists, footnotes, fenced code blocks, relative images, and Mermaid code
fences. Browser-backed tests cover the rendered PDF behavior for the rich
Markdown and Mermaid paths.

## Development

```bash
npm ci
npm run typecheck
npm test
npm run test:contracts
npm run check:artifacts
npm run build
```

`npm test` runs fast unit and contract coverage. `npm run test:browser` runs the
browser-backed integration tests and requires a local browser plus an eligible
WebDriver declared in `artifacts.json`, or an eligible declared fallback
browser/driver artifact.
Local development may set `MD2PDF_SKIP_REAL_BROWSER_TESTS=1` to skip the real
browser proof explicitly; release evidence must run without that skip.

## Artifact Freshness Policy

Every artifact in md2pdf must be the newest eligible version available after a
7-day quarantine period. The policy applies to npm dependencies, transitive
lockfile entries, bundled assets, drivers, browser fallback builds, generated
vendor files, runtime provisioning paths, and any future external artifact.

There is no exception or override. See
[`ARTIFACT_FRESHNESS_POLICY.md`](ARTIFACT_FRESHNESS_POLICY.md).
