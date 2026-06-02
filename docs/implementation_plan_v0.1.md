# md2pdf - Implementation Plan v0.1

## 1. Goal

v0.1 delivers the MVP promised by the project description: one command converts
Markdown into a clean PDF, locally, without configuration, without TeX/LaTeX,
and with clear failure reporting.

The release implements US-01 to US-08. US-09 and the LaTeX backend remain
post-MVP.

## 2. Release Scope

### In scope

- Single-file conversion: `md2pdf notes.md` creates `notes.pdf` beside the
  source.
- Rich Markdown rendering: headings, paragraphs, lists, tables, task lists,
  footnotes, fenced code with syntax highlighting, relative images, and Mermaid
  code fences.
- Browser-backed PDF rendering through an installed browser via WebDriver
  Print.
- Local-only HTML assembly with no external URLs or CDN assets.
- Output path controls: `--output` for one file and `--output-dir` for one or
  more files.
- Batch conversion from several file entries or one top-level directory.
- Overwrite protection with prompt, forced overwrite, and non-interactive skip.
- Clear stderr errors, stdout summaries, and exit codes `0`, `1`, and `2`.
- npm package with a `md2pdf` bin entry, Node.js 20+, and no admin-required
  install path for the common case.
- `--help` output listing every supported option.

### Out of scope

- GUI or web UI.
- Live preview or editing.
- Theme selection.
- Recursive folder conversion.
- Multi-file book merging.
- LaTeX backend.
- PDF-to-Markdown round trip.

## 3. Implementation Strategy

Build v0.1 as a walking skeleton first, then fill fidelity and edge cases.

1. Bootstrap the TypeScript/npm project.
2. Add the artifact freshness policy gate before selecting or locking any
   dependency or external artifact.
3. Implement the CLI, path resolution, errors, and overwrite policy as pure or
   mostly pure components.
4. Implement Markdown-to-local-HTML assembly with bundled styles and Mermaid
   placeholders.
5. Implement browser detection, WebDriver PDF rendering, and Mermaid completion
   waiting.
6. Wire the batch pipeline and final CLI exit behavior.
7. Add integration, contract, packaging, and artifact freshness verification.

This order keeps fast tests available before the browser-backed work, while
still proving the real end-to-end conversion early.

## 4. Milestones

### M0 - Project Bootstrap

Deliverables:

- `package.json` with `type: module`, `bin`, scripts, pinned dependencies, and
  committed lockfile.
- `tsconfig.json` targeting Node.js 20+.
- Source tree matching the architecture: `src/`, `assets/`, `tests/`.
- Test runner setup with separate fast and browser-backed test commands.

Primary modules:

- `src/cli.ts`
- `src/errors.ts`

Dependencies to evaluate and pin:

- `typescript`
- `markdown-it`
- Markdown plugins for tables/task lists/footnotes as needed.
- `highlight.js`
- `mermaid`
- WebDriver client and driver provisioning packages or small local wrappers.

Done when:

- `npm test` runs a placeholder suite.
- `npm run build` emits `dist/`.
- `npx`/bin execution reaches the CLI help path locally.

### M0.5 - Artifact Freshness Policy

Deliverables:

- `ARTIFACT_FRESHNESS_POLICY.md` as the authoritative project-wide rule.
- `AGENTS.md` as the required entry point for humans, LLMs, automation, and
  dependency bots that modify the repository.
- `artifacts.json` as the inventory for non-npm and runtime-provisioned
  artifacts.
- `renovate.json` with a 7-day minimum release age and strict internal checks.
- Shared freshness selection logic once the TypeScript source tree exists.
- A repository check that verifies package lockfiles, non-npm artifacts,
  vendored assets, and runtime provisioning references.

Primary modules/files:

- `ARTIFACT_FRESHNESS_POLICY.md`
- `AGENTS.md`
- `artifacts.json`
- `renovate.json`
- `src/artifactPolicy.ts`
- `src/releaseCatalog.ts`
- `scripts/checkArtifactFreshness.mjs`

Stories covered:

- Cross-cutting project governance.

Tests:

- Unit tests for newest-eligible selection after a 7-day quarantine.
- Unit tests that versions inside quarantine are rejected.
- Unit tests that no bypass or force mode exists.
- Mocked catalog tests for npm release timestamps and driver release
  timestamps.
- Local pre-commit check that fails when a lockfile, vendored asset, or
  provisioned artifact is not the newest eligible version.

Done when:

- All code-modifying agents are pointed at `ARTIFACT_FRESHNESS_POLICY.md`.
- Every non-npm artifact has an `artifacts.json` entry.
- Dependency automation cannot propose versions inside quarantine.
- The local Git hook blocks artifact freshness violations before commit.

### M1 - CLI, Paths, and Error Model

Deliverables:

- Argument parsing with `node:util` `parseArgs`.
- Supported options: `--output`, `--output-dir`, `--force-overwrite`, `--help`
  and short aliases `-o`, `-f`, `-h`.
- Usage validation:
  - at least one entry is required;
  - `--output` and `--output-dir` are mutually exclusive;
  - `--output` is rejected for multiple outputs.
- Typed error hierarchy in `errors.ts`.
- Exit code mapping in `cli.ts`.

Primary modules:

- `src/cli.ts`
- `src/paths.ts`
- `src/errors.ts`

Stories covered:

- US-03
- US-06
- US-08

Tests:

- Contract tests for help text and invalid option combinations.
- Unit tests for default output path and explicit output path resolution.
- Unit tests for directory entry expansion, non-recursive by design.

Done when:

- CLI usage errors exit `2`.
- Help output lists all v0.1 options.
- Path resolution is covered without launching a browser.

### M2 - Overwrite Policy and File Safety

Deliverables:

- `OverwritePolicy` pure decision table.
- Interactive overwrite prompt defaulting to "No".
- Non-interactive existing-output skip path.
- Forced overwrite for both interactive and non-interactive contexts.
- Atomic-ish write behavior: only write the target PDF after successful render.

Primary modules:

- `src/overwrite.ts`
- `src/converter.ts`

Stories covered:

- US-05
- US-06

Tests:

- Unit test every row of the overwrite truth table.
- Contract tests for forced overwrite and non-interactive skip.
- Regression test that failed render does not replace an existing PDF.

Done when:

- Existing PDFs are preserved unless explicitly overwritten.
- Skipped files are reported on stderr.

### M3 - Markdown to Local HTML

Deliverables:

- Markdown rendering for supported dialect.
- Code highlighting through `highlight.js`.
- Mermaid fences emitted as browser-rendered Mermaid blocks.
- Relative images resolved from the source file directory.
- Full HTML document assembly with:
  - inlined default stylesheet;
  - inlined highlight theme;
  - inlined Mermaid engine;
  - print CSS for page margins and heading orphan avoidance;
  - no external `http:` or `https:` references.
- Temporary HTML output for the renderer.

Primary modules:

- `src/markdownRenderer.ts`
- `assets/default.css`
- `assets/highlight.css`

Stories covered:

- US-01
- US-02

Tests:

- Unit tests for prose, tables, task lists, footnotes, and code highlighting
  HTML output.
- Unit test for Mermaid placeholder generation.
- Unit test that assembled HTML contains no external URLs.
- Unit or integration test for relative image embedding/resolution.

Done when:

- A representative Markdown fixture produces self-contained local HTML.
- No network asset is referenced by the generated document.

### M4 - Browser Location and Driver Provisioning

Deliverables:

- Installed browser detection for Chromium-family browsers and Firefox.
- `MD2PDF_BROWSER` override.
- Matching WebDriver resolution/provisioning for detected browser, using only
  the newest eligible driver version after the 7-day quarantine.
- Clear `BrowserNotFoundError` guidance.
- Snap Firefox real-binary handling on Linux where applicable.
- Last-resort Chromium-for-Testing provisioning path can be deferred behind a
  clear error only if browser-less-host support is explicitly tracked for a
  follow-up patch before v0.1 release.

Primary modules:

- `src/browserLocator.ts`
- `src/errors.ts`

Stories covered:

- US-01
- US-07

Tests:

- Unit tests with mocked platform/browser candidates.
- Unit tests with mocked driver release catalogs and quarantine cutoffs.
- Contract test for `MD2PDF_BROWSER`.
- Contract test for missing-browser error text.

Done when:

- The renderer can obtain a browser plus driver on at least one local developer
  machine.
- Missing browser failures are explicit and actionable.

### M5 - WebDriver PDF Rendering

Deliverables:

- Headless browser launch through WebDriver.
- Local `file:` HTML load.
- Offline/no-proxy browser preferences where supported.
- Mermaid initialization and completion wait.
- WebDriver Print command returning PDF bytes.
- Render timeout and `RenderError` wrapping with source path context.

Primary modules:

- `src/pdfRenderer.ts`
- `src/converter.ts`

Stories covered:

- US-01
- US-02
- US-06

Tests:

- Browser-backed integration test for plain Markdown to PDF.
- Browser-backed integration test for Mermaid rendered as diagram output rather
  than raw code.
- Browser-backed test for page background/print CSS if feasible.
- Network-disabled or offline-mode test for local-only conversion.

Done when:

- An end-to-end conversion creates a readable PDF from a rich Markdown fixture.
- Mermaid diagrams render in the PDF.
- Render failures report the offending path and write no partial PDF.

### M6 - Batch Pipeline and Summaries

Deliverables:

- Conversion work-list from file and directory entries.
- Multi-file conversion in one invocation.
- Continue-on-error behavior.
- Per-run stdout summary with success and failure counts.
- Final exit status set once after all work completes.

Primary modules:

- `src/pipeline.ts`
- `src/converter.ts`
- `src/paths.ts`

Stories covered:

- US-04
- US-06

Tests:

- Integration or contract tests for several named files.
- Integration or contract tests for top-level folder conversion.
- Test that one failed file does not stop the batch.
- Exit code tests for all-success and any-failure runs.

Done when:

- Batch behavior matches US-04 exactly.
- Exit `0` means all conversions succeeded; exit `1` means at least one failed.

### M7 - Packaging, Install, and Documentation

Deliverables:

- npm package metadata ready for publish.
- `bin` points to built CLI.
- README usage updated for v0.1 commands and install options.
- Install smoke test using a non-admin user-scope path where practical.
- CI matrix plan or implementation for Windows, macOS, and Linux on Node.js 20+.

Primary modules/files:

- `package.json`
- `README.md`
- `docs/architecture.md` if implementation decisions change.

Stories covered:

- US-07
- US-08

Tests:

- `npm pack` smoke test.
- Local install smoke test.
- `md2pdf --help` after package install.

Done when:

- The packaged command runs from the installed bin.
- No TeX/LaTeX install is required.
- Re-running the install command converges on the same version.

## 5. Test Plan

Fast tests:

- Unit tests for `paths.ts`, `overwrite.ts`, `markdownRenderer.ts`,
  `browserLocator.ts` with mocks, and error formatting.
- Contract tests for CLI parsing, help, usage errors, stdout/stderr behavior,
  and exit codes.

Browser-backed tests:

- Single Markdown file to beside-source PDF.
- Rich Markdown fixture containing table, task list, footnote, highlighted code,
  relative image, and Mermaid diagram.
- Existing-output behavior around successful and failed renders.
- Batch conversion with one success and one failure.
- Local-only assertion: generated HTML has no external URL and conversion works
  under offline/no-proxy launch settings.

Release smoke tests:

- `npm run build`
- `npm test`
- `npm run check:artifacts`
- `npm run test:integration`
- `npm pack`
- install packed artifact in a temporary user-scope location;
- run `md2pdf --help`;
- run `md2pdf fixture.md` and inspect that `fixture.pdf` is produced.

## 6. Acceptance Gate for v0.1

v0.1 is ready when:

- US-01 through US-08 acceptance criteria pass.
- A new user can run one command and produce a PDF with no config file.
- Output is local-only and requires no document upload.
- No TeX/LaTeX toolchain is required.
- Mermaid renders through the browser path.
- The CLI reports errors clearly and exits with documented status codes.
- The artifact freshness policy passes; any in-quarantine version is covered by
  an approved quarantine waiver (audited and owner-approved), with no other
  exception or bypass.
- The package can be installed and invoked as `md2pdf`.
- README instructions match the implemented CLI.

## 7. Suggested Task Order

1. Create project skeleton and build/test scripts.
2. Implement the artifact freshness policy modules, inventory check, and
   Renovate gate.
3. Implement `errors.ts`, `paths.ts`, and `overwrite.ts` with unit tests.
4. Implement `cli.ts` help, parsing, and usage errors.
5. Implement `markdownRenderer.ts` plus bundled CSS/assets.
6. Add a temporary HTML fixture workflow for visual/browser debugging.
7. Implement `browserLocator.ts` with artifact freshness enforced for driver
   selection.
8. Implement `pdfRenderer.ts` with one browser family working end to end.
9. Add Mermaid completion waiting and Mermaid integration tests.
10. Add second browser-family support.
11. Wire `DocumentConverter` and `ConversionPipeline`.
12. Complete batch, summary, and exit-code behavior.
13. Add packaging smoke tests and README updates.
14. Run full release gate and fix gaps.

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Browser/driver version mismatch | Conversion fails on otherwise valid hosts | Provision matching drivers and test missing/mismatched cases with clear errors. |
| Output differs across browsers | PDFs may vary between users | Document variation and keep fixtures focused on observable correctness, not byte equality. |
| Mermaid completion race | PDF captures raw or partially rendered diagrams | Expose an explicit browser-side completion signal and wait with timeout. |
| Local-only guarantee is structural | Accidental CDN URL could violate privacy promise | Inline assets and test generated HTML for external URLs. |
| Artifact freshness checker coverage gaps | A future contributor or LLM could add a vendored artifact outside the known inventory | Require `AGENTS.md`, track non-npm artifacts in `artifacts.json`, and make the local pre-commit hook run `npm run check:artifacts` or `node scripts/checkArtifactFreshness.mjs`. |
| Browser-backed tests are slow/flaky | CI friction | Keep most tests unit/contract; isolate browser tests behind a dedicated command. |
| Scope creep around styling/themes | Delays v0.1 | Ship one polished default stylesheet; defer theme selection. |

## 9. Traceability

| Story | v0.1 milestone |
|---|---|
| US-01 Convert one Markdown file | M3, M5 |
| US-02 Rich Markdown content | M3, M5 |
| US-03 Choose output location | M1 |
| US-04 Batch conversion | M6 |
| US-05 Overwrite protection | M2 |
| US-06 Clear failures and exit codes | M1, M2, M5, M6 |
| US-07 Install without admin rights | M4, M7 |
| US-08 Discover usage | M1, M7 |
| US-09 LaTeX backend | Out of scope |
