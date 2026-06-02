# md2pdf

Convert Markdown files into clean, shareable PDFs — with the simplest possible
command, full Mermaid diagram support, and no LaTeX toolchain.

```bash
md2pdf report.md
# → report.pdf
```

## Status

**Specification and design phase.** The project's intent, requirements, user
stories, and architecture are written and mutually traceable (see `docs/`).
Implementation has not started yet — the commands below describe the designed
behaviour, not a shipped tool.

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
sharing them. md2pdf bridges the two with one command and sensible defaults —
readable typography, syntax-highlighted code, tables, footnotes, embedded
images, correct page breaks, and Mermaid diagrams — without requiring a LaTeX
install or uploading anything to a web service.

## Designed usage

```bash
md2pdf notes.md                 # → notes.pdf, beside the source
md2pdf notes.md -o out/report.pdf
md2pdf a.md b.md --output-dir build
md2pdf ./notes-folder           # convert every top-level .md in the folder
md2pdf notes.md -f              # overwrite an existing PDF without prompting
md2pdf --help
```

## Project structure

```
md2pdf/
  README.md                      this file
  ARTIFACT_FRESHNESS_POLICY.md   project-wide artifact version rule
  AGENTS.md                      instructions for LLMs and automation
  artifacts.json                 inventory for non-npm and provisioned artifacts
  renovate.json                  dependency automation quarantine policy
  docs/
    project_description.md       what md2pdf is and why (objectives, scope)
    project_requirements.md      functional + non-functional requirements (EARS/INCOSE)
    user_stories.md              user stories with Gherkin acceptance criteria
    architecture.md              how it is built (pipeline, components, ADRs, risks)
  src/                           TypeScript sources (to be implemented)
  assets/                        bundled CSS, fonts (to be added)
  tests/                         unit / integration / contract tests (to be added)
```

## Artifact freshness policy

Every artifact in md2pdf must be the newest eligible version available after a
7-day quarantine period. The policy applies to npm dependencies, transitive
lockfile entries, bundled assets, drivers, browser fallback builds, generated
vendor files, runtime provisioning paths, and any future external artifact.

The rule is actor-independent: humans, LLMs, automation, dependency bots,
scripts, local Git hooks, and runtime code must all preserve it. There is no
exception or override. See
[`ARTIFACT_FRESHNESS_POLICY.md`](ARTIFACT_FRESHNESS_POLICY.md).

## How to install / set up

Not yet published. Once implemented, md2pdf will install via npm with no `sudo`:

```bash
npx md2pdf file.md      # zero-install
npm i -g md2pdf         # per-user global
```

It will use a browser already installed on the host; if none is found, it will
report clearly and can provision one into a per-user cache. Set `MD2PDF_BROWSER`
to pin a specific browser binary.

## How to run / use

See **Designed usage** above. The authoritative behaviour is specified in
`docs/project_requirements.md` and `docs/user_stories.md`.

## How to run tests

A test suite (unit / integration / contract) is planned per `docs/architecture.md`
§15 but not yet present. Once implemented:

```bash
npm test                # fast unit + contract tests
npm run test:all        # includes slow browser-backed integration tests
```
