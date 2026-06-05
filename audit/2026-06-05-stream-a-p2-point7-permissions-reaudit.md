# Stream A P2 Point 7 Permissions Re-Audit - 2026-06-05

Verdict: **GO for completing Stream A P2 point 7**.

This audit is scoped to **P2 point 7 only**.

## Scope

Files audited:

- `src/paths.ts`
- `src/overwrite.ts`
- `src/cli.ts`, only for user-visible input error behavior
- `tests/unit/paths/paths.test.ts`
- `tests/unit/overwrite/overwrite.test.ts`
- `tests/unit/cli/cli.test.ts`, only for unreadable-directory CLI coverage

Source of truth:

- `docs/plan_stream_a.md`, P2 point 7:
  - input unreadable -> `InputNotFoundError` with `sourcePath` and `actionHint`
  - output parent non-writable -> `ConversionError` with `outputPath` and `actionHint`
  - existing output non-replaceable -> clear message with path

Audit angles used:

- code audit
- business-logic audit
- security/data-loss audit

## Verification

Validation run in the main workspace:

- `npm.cmd run typecheck`: passed
- `npm.cmd test -- tests/unit/paths/paths.test.ts tests/unit/overwrite/overwrite.test.ts`:
  passed, 23 tests in 2 files
- `npm.cmd test`: passed, 58 tests in 5 files
- `npm.cmd run check:artifacts`: passed

Note: Vitest and `check:artifacts` had to be run outside the sandbox after the
usual Windows sandbox spawn failure.

## Requirement Coverage

| Requirement | Status | Evidence | Problem |
| --- | --- | --- | --- |
| Unreadable file input -> `InputNotFoundError` with `sourcePath` and `actionHint` | Covered | `src/paths.ts:203`, `src/paths.ts:217`, `tests/unit/paths/paths.test.ts:61` | No blocker found. |
| Unreadable directory input -> `InputNotFoundError` with `sourcePath` and `actionHint` | Covered | `src/paths.ts:104`, `src/paths.ts:108`, `src/paths.ts:111`, `tests/unit/paths/paths.test.ts:83`, `tests/unit/cli/cli.test.ts:203` | Previous blocker fixed. |
| Non-writable output parent -> `ConversionError` with `outputPath` and `actionHint` | Covered | `src/paths.ts:189`, `src/paths.ts:192`, `tests/unit/paths/paths.test.ts:112` | No blocker found. |
| Existing output not replaceable due to access failure -> clear error with path | Covered | `src/overwrite.ts:145`, `src/overwrite.ts:176`, `tests/unit/overwrite/overwrite.test.ts:179` | No blocker found. |
| Existing output path is a directory -> clear not-replaceable error with path | Covered | `src/overwrite.ts:145`, `src/overwrite.ts:148`, `tests/unit/overwrite/overwrite.test.ts:208`, `tests/unit/overwrite/overwrite.test.ts:230` | Previous blocker fixed. |

## Findings

No blocking finding.

### Residual Risk: Permission Checks Are Still Advisory

Severity: **Medium, non-blocking for P2 point 7**

Files: `src/paths.ts`, `src/overwrite.ts`

Problem: `fs.access()` and `lstat()` checks happen before the eventual file
read/write performed by later conversion code. A path can still be changed
between preflight and conversion.

Risk: preflight diagnostics are now clear, but final writer safety still needs
to be enforced when the real converter writes PDFs.

Suggested follow-up: in P3/converter integration, wrap actual read/write
failures with the same path-rich errors and enforce overwrite semantics at the
write boundary.

### Residual Risk: Symlink Target Disclosure Is Still Limited

Severity: **Low, non-blocking for P2 point 7**

File: `src/overwrite.ts`

Problem: symlink outputs are treated as existing, but confirmed or forced
overwrite still reports the link path rather than disclosing the resolved target.

Risk: user consent is clear for the CLI path entered, but less explicit for
symlink targets.

Suggested follow-up: either reject symlink outputs or disclose the resolved
target before confirmed/forced overwrite if stricter data-loss evidence is
required.

## Decision

The two previous P2 point 7 blockers are resolved:

- unreadable directory input is now wrapped as `InputNotFoundError`;
- existing output directories are now rejected as not replaceable before
  conversion.

Stream A P2 point 7 is **accepted**.
