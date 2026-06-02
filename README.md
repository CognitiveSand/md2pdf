# md2pdf

Convert Markdown files into clean, shareable PDFs with the simplest possible
command, full Mermaid diagram support, and no LaTeX toolchain.

```bash
md2pdf report.md
# -> report.pdf
```

## Status

**M1 CLI, paths, and error model implemented.** The project's intent,
requirements, user stories, and architecture are written and mutually traceable
(see `docs/`). The TypeScript/npm skeleton is present, `md2pdf --help` works
locally, supported options are parsed and validated, source entries are resolved,
and output paths are computed.

Markdown-to-PDF rendering has not started yet. Valid conversion commands are
accepted through M1 resolution, then stop with a clear "not implemented yet"
conversion error until later milestones add the renderer.

Key design decisions, validated by hands-on spikes:

- **Implemented in TypeScript on Node.js 20+.** The Markdown and Mermaid
  ecosystem is JavaScript-native.
- **Renders through the user's own installed browser** (Chrome/Edge/Brave/
  Chromium via `chromedriver`, or Firefox via `geckodriver`) using the browser's
  WebDriver Print command. No multi-hundred-MB browser download in the common
  case, and no `sudo`.
- **Fully local.** No document is ever sent over the network; all rendering
  assets are bundled.
- **Mermaid diagrams render natively** at full fidelity (a stock-Firefox spike
  confirmed this end-to-end).

## What it does

Markdown is the default format for notes and docs; PDF is the default format for
sharing them. md2pdf bridges the two with one command and sensible defaults:
readable typography, syntax-highlighted code, tables, footnotes, embedded
images, correct page breaks, and Mermaid diagrams, without requiring a LaTeX
install or uploading anything to a web service.

## Designed usage

```bash
md2pdf notes.md                 # -> notes.pdf, beside the source
md2pdf notes.md -o out/report.pdf
md2pdf a.md b.md --output-dir build
md2pdf ./notes-folder           # convert every top-level .md in the folder
md2pdf notes.md -f              # overwrite an existing PDF without prompting
md2pdf --help
```

## Project structure

```text
md2pdf/
  README.md                      this file
  AGENTS.md                      instructions for LLMs and automation
  package.json                   npm package manifest and scripts
  package-lock.json              pinned npm dependency lockfile
  tsconfig.json                  TypeScript compiler configuration
  .policy/
    ARTIFACT_FRESHNESS_POLICY.md project-wide artifact version rule
    artifacts.json               inventory for non-npm and provisioned artifacts
    renovate.json                dependency automation quarantine policy
  docs/
    project_description.md       what md2pdf is and why (objectives, scope)
    project_requirements.md      functional + non-functional requirements
    user_stories.md              user stories with Gherkin acceptance criteria
    architecture.md              how it is built (pipeline, components, ADRs)
  src/                           TypeScript CLI bootstrap sources
  assets/                        bundled CSS, fonts (to be added)
  tests/                         unit and browser-backed test harnesses
```

## Artifact freshness policy

Every artifact in md2pdf must be the newest eligible version available after a
7-day quarantine period. The policy applies to npm dependencies, transitive
lockfile entries, bundled assets, drivers, browser fallback builds, generated
vendor files, runtime provisioning paths, and any future external artifact.

The rule is actor-independent: humans, LLMs, automation, dependency bots,
scripts, local Git hooks, and runtime code must all preserve it. There is no
exception or override. See
[`ARTIFACT_FRESHNESS_POLICY.md`](.policy/ARTIFACT_FRESHNESS_POLICY.md).

## How to install / set up

Not yet published. For local development:

```bash
npm install
npm run build
npm exec -- md2pdf --help
```

Once implemented and published, md2pdf will install via npm with no `sudo`:

```bash
npx md2pdf file.md      # zero-install
npm i -g md2pdf         # per-user global
```

It will use a browser already installed on the host; if none is found, it will
report clearly and can provision one into a per-user cache. Set `MD2PDF_BROWSER`
to pin a specific browser binary.

## How to run / use

The implemented M1 command surface is:

```bash
npm exec -- md2pdf --help
```

The CLI already validates `--output`, `--output-dir`, `--force-overwrite`, and
entry arguments. See **Designed usage** above for planned end-to-end conversion
commands. The authoritative behaviour is specified in
`docs/project_requirements.md` and `docs/user_stories.md`.

## How to run tests

The M1 test harness is present:

```bash
npm test                # fast unit tests
npm run test:browser    # browser-backed placeholder harness for later milestones
npm run test:all
npm run check:artifacts
```
