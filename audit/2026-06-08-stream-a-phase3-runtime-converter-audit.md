# Stream A Phase 3 Runtime Converter Audit - 2026-06-08

Verdict: **GO for Phase 4 test planning, but not GO for P3 PDF acceptance**.

Phase 3's Stream A-side runtime preparation is implemented: the CLI default path
no longer reaches the public `convertFile` `NotImplementedError` stub, and
`ConvertOptions.browserPath` still reaches the selected converter. Real PDF
production remains blocked by the missing Stream B PDF/browser renderer.

## Scope

- Requirement: `docs/stream-a-implementation-plan-2026-06-08.md`, Phase 3.
- Files inspected:
  - `src/contracts.ts`
  - `src/converter.ts`
  - `src/cli.ts`
  - `tests/unit/converter/converter.test.ts`
  - `tests/unit/cli/cli.test.ts`
  - `tests/unit/contracts/contracts.test.ts`
  - `docs/release-evidence/release-checklist-v0.1.2.md`

## Requirement and User Story Compliance

| Requirement | Status | Evidence | Problem |
| --- | --- | --- | --- |
| Keep `src/contracts.ts` as public contract surface | Respected | `src/contracts.ts:1-21` now contains the conversion types and re-exports `convertFile` from the runtime module. | None blocking. |
| Move concrete `convertFile` implementation out of `contracts.ts` | Respected | `src/contracts.ts:21` re-exports `convertFile`; `src/converter.ts:8-32` owns the concrete runtime implementation. | None blocking. |
| CLI default runtime uses the runtime converter while preserving test injection | Respected | `src/cli.ts:6` imports the runtime converter; `src/cli.ts:164` still prefers `dependencies.convertFile` when injected. | None blocking. |
| `ConvertOptions.browserPath` reaches the converter | Respected | `src/cli.ts:79` reads `MD2PDF_BROWSER`; `src/cli.ts:164` wires the pipeline; `tests/unit/cli/cli.test.ts:114-132` proves `/browser` reaches the selected converter. | None blocking. |
| User path without injection no longer launches `NotImplementedError` | Respected | `tests/unit/cli/cli.test.ts:99-112` proves the default CLI path returns a conversion failure for missing PDF renderer and does not print `[not-implemented]`. | None blocking. |
| Runtime attempts a real conversion path instead of a pure stub | Partially respected | `src/converter.ts:15-32` reads Markdown and calls `withTempHtml` before failing with `ConversionError`; `tests/unit/converter/converter.test.ts:21-45` covers this boundary. | The PDF write itself is still unavailable until Stream B supplies the PDF/browser renderer. |
| Do not reimplement Stream B internals | Respected | `src/converter.ts:6` calls the existing `markdownRenderer` harness; it does not add `browserLocator`, `webDriverClient`, `pdfRenderer`, artifact policy, or provisioning logic. | None blocking. |

## Negative Findings

### Finding 1 - P3 Is Prepared But Still Cannot Produce A PDF

Severity: Medium

File: `src/converter.ts`

Line: 24

Problem: The runtime converter still fails every otherwise-renderable Markdown
conversion with `PDF renderer is not available yet`.

Risk: A real `md2pdf ENTRY` invocation now follows the runtime converter path,
but it still exits `1` and writes no PDF. This satisfies Phase 3 preparation,
not P3 integration acceptance.

Evidence: `src/converter.ts:15-32` prepares temporary HTML and throws
`ConversionError`; `tests/unit/cli/cli.test.ts:99-112` expects summary
`0 succeeded, 1 failed, 0 skipped`.

Suggested fix: In the later Stream B/P3 integration step, replace this boundary
failure with a call to the real PDF/browser renderer and keep the same
`sourcePath`, `outputPath`, `browserPath`, and `actionHint` error propagation.

Test needed: `npm.cmd run build` and `npm.cmd run test:browser` with at least
one real CLI-to-PDF fixture.

### Finding 2 - Release Checklist Correctly Remains Blocked For Browser/PDF

Severity: Low

File: `docs/release-evidence/release-checklist-v0.1.2.md`

Line: 66

Problem: Phase 3 changed the blocker from "public stub" to "missing PDF/browser
renderer"; the checklist was updated accordingly, but it remains a release
blocker.

Risk: None for Phase 3 preparation. The release still cannot be accepted.

Evidence: `docs/release-evidence/release-checklist-v0.1.2.md:66-67` keeps
integration and browser-backed tests `blocked` until the Stream B PDF/browser
path produces a real PDF.

Suggested fix: Leave these rows blocked until Phase 4 integration tests pass.

Test needed: Browser-backed integration tests after Stream B renderer exists.

## Validation

Commands executed:

```text
npm.cmd run typecheck
PASS

npm.cmd run test:contracts
PASS - 1 test file, 10 tests

npm.cmd test -- tests/unit/cli/cli.test.ts tests/unit/converter/converter.test.ts
PASS - 2 test files, 24 tests

npm.cmd test
PASS - 10 test files, 84 tests

npm.cmd run check:artifacts
PASS - Artifact freshness policy passed.
```

## Summary

Stream A Phase 3 is complete for the preparation scope: the default CLI path is
now wired to a runtime converter module, test injection still works, and
`MD2PDF_BROWSER` reaches the selected converter. The next blocking work is not
another Stream A stub move; it is the Stream B-backed PDF/browser renderer and
the Phase 4 integration tests that prove real PDF output.
