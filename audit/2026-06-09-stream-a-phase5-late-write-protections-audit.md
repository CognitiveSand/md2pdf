# Stream A Phase 5 Late Write Protections Audit - 2026-06-09

Verdict: **GO for Phase 6**, with real-browser/Mermaid release proof still
blocked.

Phase 5's Stream A protections are implemented for the current runtime PDF
path. The renderer now writes to a same-directory temporary PDF, validates it,
and only then commits it to the final output path. Integration tests cover late
render failure without data loss, output becoming non-replaceable after
preflight, and output parent failure during real rendering.

## Scope

- Requirement: `docs/stream-a-implementation-plan-2026-06-08.md`, Phase 5.
- Files inspected:
  - `src/pdfRenderer.ts`
  - `tests/integration/cli-pdf.test.ts`
  - `docs/release-evidence/release-checklist-v0.1.2.md`

## Requirement and User Story Compliance

| Requirement | Status | Evidence | Problem |
| --- | --- | --- | --- |
| Recheck/protect output at final write time | Respected | `src/pdfRenderer.ts:24-34` writes to a temporary output, validates it, then commits via `commitPdfOutput`; `src/pdfRenderer.ts:128-137` wraps final rename failures as `ConversionError`. | None blocking. |
| Preserve existing output on late render failure | Respected | `tests/integration/cli-pdf.test.ts:132-146` keeps `%PDF-existing` when the browser emits invalid output during `--force-overwrite`. | None blocking. |
| Report output that becomes non-replaceable after preflight | Respected | `tests/integration/cli-pdf.test.ts:149-164` turns the final output into a directory after preflight and expects `[conversion] Could not replace final PDF output` with source/output/hint. | None blocking. |
| Report late output parent failure with useful context | Respected | `tests/integration/cli-pdf.test.ts:167-180` simulates a parent path becoming unusable during browser rendering and asserts `outputPath` plus `actionHint`. | None blocking. |
| Keep errors compatible with Stream A formatting | Respected | `src/pdfRenderer.ts:150-158` creates `ConversionError` with `sourcePath`, `outputPath`, and `actionHint`; integration tests assert formatted stderr. | None blocking. |
| Keep P2 protections true with real converter path | Respected | Existing overwrite preserve/force integration tests remain green, and Phase 5 adds late-failure cases around the renderer. | None blocking. |

## Negative Findings

### Finding 1 - Parent Non-Writable Is Simulated As Parent Becoming Unusable

Severity: Low

File: `tests/integration/cli-pdf.test.ts`

Line: 167

Problem: The parent-output failure test uses a deterministic fake browser to
replace the parent directory with a file. It does not rely on OS-specific ACL or
chmod semantics.

Risk: This is portable and reliable, but it is not a full ACL matrix test for
Windows/macOS/Linux permission systems.

Evidence: `tests/integration/cli-pdf.test.ts:167-180` validates the error path;
`docs/release-evidence/release-checklist-v0.1.2.md:67` still keeps real
installed-browser/Mermaid release proof blocked.

Suggested fix: Add OS-specific permission/ACL tests later if the release gate
requires true non-writable filesystem permissions rather than late parent-path
failure.

Test needed: Platform-specific real permission test in CI, if required.

### Finding 2 - Atomic Replace Depends On Same-Directory Rename Semantics

Severity: Low

File: `src/pdfRenderer.ts`

Line: 128

Problem: The renderer uses same-directory temp output plus `rename` for the
final commit. This is the right shape for atomic replacement, but exact replace
semantics still depend on the host filesystem.

Risk: Filesystem-specific edge cases can still exist, especially around
read-only attributes, antivirus locks, or network drives.

Evidence: `src/pdfRenderer.ts:24-34` creates a same-directory temporary file and
commits it at `src/pdfRenderer.ts:128-137`; integration tests cover common late
failure behavior.

Suggested fix: Keep Phase 6/P4 packaging and later CI runs on the supported OS
matrix, and add a true locked/read-only output test if needed.

Test needed: OS matrix test with real filesystem permission constraints.

## Validation

Commands executed:

```text
npm.cmd run typecheck
PASS

npm.cmd run test:browser
PASS - 1 integration test file, 10 tests

npm.cmd test
PASS - 10 unit test files, 84 tests

npm.cmd run test:contracts
PASS - 1 test file, 10 tests

npm.cmd run build
PASS

npm.cmd run check:artifacts
PASS - Artifact freshness policy passed.
```

## Summary

Phase 5 is complete for the current Stream A runtime path. Late render failures
no longer write directly to the final destination, existing outputs are
preserved on invalid late output, and final replacement failures report rich
Stream A errors. Stream A can move to Phase 6 packaging/install work, while the
real installed-browser/Mermaid proof remains a separate release blocker.
