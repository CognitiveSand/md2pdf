# Stream A Phase 4 Integration Tests Audit - 2026-06-09

Verdict: **GO for Phase 5**, with release browser/Mermaid proof still blocked.

The Phase 4 no-go from the Phase 3 audit is resolved for Stream A's integration
gate: `test:browser` now has integration tests and passes. The tests prove the
CLI -> runtime converter -> PDF renderer contract, including output routing,
overwrite behavior, rich render errors, and `MD2PDF_BROWSER` propagation.

## Scope

- Requirement: `docs/stream-a-implementation-plan-2026-06-08.md`, Phase 4.
- Prior blocker: `audit/2026-06-08-stream-a-phase3-runtime-converter-audit.md`
  reported that runtime conversion still ended at `PDF renderer is not
  available yet`.
- Files inspected:
  - `src/browserLocator.ts`
  - `src/pdfRenderer.ts`
  - `src/converter.ts`
  - `tests/integration/cli-pdf.test.ts`
  - `tests/unit/converter/converter.test.ts`
  - `docs/release-evidence/release-checklist-v0.1.2.md`

## Requirement and User Story Compliance

| Requirement | Status | Evidence | Problem |
| --- | --- | --- | --- |
| `test:browser` must discover integration tests | Respected | `vitest.browser.config.ts` targets `tests/integration/**/*.test.ts`; `tests/integration/cli-pdf.test.ts` now exists and `npm.cmd run test:browser` passes with 1 file and 7 tests. | None blocking. |
| Single-file `md2pdf ENTRY` produces a PDF artifact | Respected | `tests/integration/cli-pdf.test.ts` covers default single-entry conversion and validates the `%PDF-` header. | None blocking for the deterministic integration gate. |
| `--output` writes the requested file | Respected | `tests/integration/cli-pdf.test.ts:54-59`. | None blocking. |
| `--output-dir` works for multiple jobs | Respected | `tests/integration/cli-pdf.test.ts` covers two jobs into `pdfs/`. | None blocking. |
| Existing PDF is preserved without `--force-overwrite` | Respected | `tests/integration/cli-pdf.test.ts:76-87`. | None blocking. |
| `--force-overwrite` writes the PDF | Respected | `tests/integration/cli-pdf.test.ts:90-100`. | None blocking. |
| Render failure propagates `sourcePath`, `outputPath`, and `actionHint` | Respected | `src/pdfRenderer.ts:130-135`; integration failure test asserts source, output, and hint. | None blocking. |
| `MD2PDF_BROWSER` reaches the runtime renderer | Respected | `tests/integration/cli-pdf.test.ts:119-129` logs the fake browser invocation; `src/browserLocator.ts:24-31` accepts explicit browser paths. | None blocking. |
| Runtime no longer stops at "PDF renderer is not available yet" | Respected | `src/converter.ts:17-43` calls `renderPdfFromHtml`; `src/pdfRenderer.ts:19-28` invokes browser print-to-PDF and validates output. | None blocking. |

## Negative Findings

### Finding 1 - Browser/Mermaid Release Proof Is Still Not Satisfied

Severity: Medium

File: `docs/release-evidence/release-checklist-v0.1.2.md`

Line: 67

Problem: The Phase 4 integration gate uses a deterministic fake browser command
to prove the CLI and PDF-renderer contract. It does not prove rendering through
a real installed Chrome/Edge/Chromium browser, and it does not prove Mermaid is
rendered as a diagram.

Risk: Treating this as final browser-backed release proof would overclaim. The
release still needs a real installed-browser run and Mermaid visual/PDF evidence.

Evidence: `docs/release-evidence/release-checklist-v0.1.2.md:66` marks
integration tests as `pass`, while `:67` keeps browser-backed tests `blocked`
for real installed browser and Mermaid proof.

Suggested fix: Add a later real-browser integration fixture when the target
environment has Chrome/Edge/Chromium available, including a Mermaid diagram
assertion appropriate for the release gate.

Test needed: Real browser-backed `npm.cmd run test:browser` or equivalent with
Mermaid output inspected as diagram, not only raw source text.

### Finding 2 - Browser Locator Is Minimal

Severity: Low

File: `src/browserLocator.ts`

Line: 24

Problem: Browser location currently checks explicit `MD2PDF_BROWSER`, common
Windows install paths, and PATH candidates. It does not yet implement a full
driver/version compatibility story.

Risk: This is enough for the Phase 4 print-to-PDF command path, but not a full
replacement for the richer Stream B browser/WebDriver architecture described in
the docs.

Evidence: `src/browserLocator.ts:24-39` provides direct executable location;
`src/pdfRenderer.ts:45-60` uses browser headless `--print-to-pdf`, not WebDriver.

Suggested fix: Keep the richer WebDriver/browser compatibility work tracked as
future Stream B/release hardening if it remains a requirement.

Test needed: Browser-family matrix tests on Windows/macOS/Linux with installed
Chrome/Edge/Chromium.

## Validation

Commands executed:

```text
npm.cmd run typecheck
PASS

npm.cmd test
PASS - 10 test files, 84 tests

npm.cmd run test:contracts
PASS - 1 test file, 10 tests

npm.cmd run build
PASS

npm.cmd run test:browser
PASS - 1 integration test file, 7 tests

npm.cmd run check:artifacts
PASS - Artifact freshness policy passed.
```

## Summary

The Phase 4 Stream A no-go is resolved: `test:browser` is no longer empty or
red, and the integration suite proves the CLI-to-PDF-renderer path. The release
still must not claim final browser/Mermaid support until a real installed
browser and Mermaid diagram proof are added.
