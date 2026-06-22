# Security Hardening Hidden Characters And Visible Links Phase 0 Baseline

## Metadata

- md2pdf version tested: `0.1.2`
- Date: `2026-06-22`
- Commit SHA at baseline: `c016edf5988a7954b176db11ca8732d15495a8e4`
- OS shell: Windows PowerShell
- Node.js: `v24.16.0`
- npm: `11.13.0`
- Author: Codex
- Status: `pass`

## Scope

This baseline implements Phase 0 from
`docs/security-hardening-hidden-characters-and-visible-links-implementation-plan.md`.

No production behavior was changed in this phase. The purpose is to record the
pre-hardening repository state, run the targeted checks, identify tests that
currently encode the old visible-link behavior, and confirm that no new artifact
is needed.

## Repository State

| Command | Observed result | Status |
| --- | --- | --- |
| `git status --short` | No output; working tree clean before Phase 0 evidence was added. | `pass` |

## Targeted Baseline Checks

The direct `npm ...` commands were blocked by the local PowerShell execution
policy because PowerShell tried to load `npm.ps1`. The same checks were rerun
through `npm.cmd`, which invokes npm without changing project state.

| Command | Expected result | Observed result | Status |
| --- | --- | --- | --- |
| `npm.cmd run typecheck` | TypeScript succeeds. | `tsc --noEmit` completed successfully. | `pass` |
| `npm.cmd test -- tests/unit/markdownRenderer/markdownRenderer.test.ts` | Targeted markdown renderer tests pass. | 1 file passed, 29 tests passed, 1 skipped. | `pass` |
| `npm.cmd test -- tests/integration/converter.test.ts` | Targeted converter integration tests pass. | 1 file passed, 12 tests passed. | `pass` |

## Tests Identified For Later Visible-Link Hardening

- `tests/unit/markdownRenderer/markdownRenderer.test.ts:422` currently tests
  that HTTPS links remain clickable when the visible label differs from the URL:
  `[remote](https://example.invalid/page)`.
- `tests/unit/markdownRenderer/markdownRenderer.test.ts:433` currently asserts
  that the mismatched-label HTTPS link keeps
  `href="https://example.invalid/page"`.
- `tests/integration/converter.test.ts:274` currently covers local HTML output
  with passive HTTPS links and blocked dangerous hrefs.
- `tests/integration/converter.test.ts:285` currently uses
  `[safe](https://example.invalid/report)`, whose visible label differs from the
  target URL.
- `tests/integration/converter.test.ts:305` currently asserts that this
  mismatched-label HTTPS link keeps
  `href="https://example.invalid/report"`.

The implementation point that explains the current behavior is
`src/markdownRenderer.ts:255`, where link blocking only checks `href` with
`isPassiveHttpsLink`, and `src/markdownRenderer.ts:785`, where the helper accepts
any trimmed value beginning with `https://`.

## Artifact Decision

No new third-party dependency, package lock entry, runtime driver, browser
binary, remote asset, vendored asset, generated artifact, or provisioned
artifact is required for Phase 0 or for the planned hidden-character and
visible-link hardening work.

No artifact was added, updated, embedded, locked, referenced, distributed,
vendored, generated from a third-party source, or provisioned by this Phase 0
baseline.
