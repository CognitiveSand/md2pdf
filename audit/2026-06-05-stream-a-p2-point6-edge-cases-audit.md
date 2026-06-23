# Stream A P2 Point 6 Edge Cases Audit - 2026-06-05

Verdict: **GO for Stream A P2 point 7**.

## Scope

Files audited:

- `src/cli.ts`
- `src/paths.ts`
- `src/overwrite.ts`
- `tests/unit/cli/cli.test.ts`
- `tests/unit/paths/paths.test.ts`
- `tests/unit/overwrite/overwrite.test.ts`

Source of truth:

- `docs/plan_stream_a.md`, P2 point 6

Auditors used:

- code audit
- business/test audit
- local test audit pass

## Verification

Main workspace validation:

- `npm.cmd run typecheck`: passed
- `npm.cmd test`: passed, 51 tests in 5 files
- `npm.cmd run check:artifacts`: passed

Targeted audit validation reported by agents:

- `npm.cmd test -- tests/unit/paths tests/unit/cli tests/unit/overwrite tests/unit/pipeline`:
  passed, 40 tests in 4 files
- `npm.cmd test -- tests/unit/cli/cli.test.ts tests/unit/paths/paths.test.ts tests/unit/overwrite/overwrite.test.ts`:
  passed, 35 tests in 3 files

## Requirement Coverage

| Requirement | Status | Evidence | Problem |
| --- | --- | --- | --- |
| Collision `--output-dir` with identical basenames cross-directory | Covered | `src/paths.ts:139`, `src/paths.ts:163`, `tests/unit/paths/paths.test.ts:121`, `tests/unit/cli/cli.test.ts:161` | No blocker found. |
| Empty directory exits `0` with `0 succeeded, 0 failed, 0 skipped` | Covered | `tests/unit/cli/cli.test.ts:143` | No blocker found. |
| Prompt EOF preserves existing output | Covered | `src/overwrite.ts:82`, `tests/unit/overwrite/overwrite.test.ts:143`, `tests/unit/cli/cli.test.ts:340` | No blocker found. |
| Duplicate entries produce `UsageError` before rendering | Covered | `src/paths.ts:163`, `tests/unit/paths/paths.test.ts:110`, `tests/unit/cli/cli.test.ts:203` | No blocker found. |
| `outputPath === sourcePath` produces `UsageError` before rendering | Covered | `src/paths.ts:150`, `tests/unit/paths/paths.test.ts:94`, `tests/unit/cli/cli.test.ts:222` | No blocker found. |

## Findings

No blocking finding.

### Non-Blocking Gap: Duplicate Alias Inputs Are Not Directly Tested

Severity: **Low**

Problem: duplicate entries are tested with the exact same CLI string, not
equivalent aliases such as `source.md` plus `./source.md`.

Risk: low. The implementation canonicalizes output paths, so this should still
be caught.

Suggested follow-up: add alias duplicate tests if the resolver grows more path
normalization rules.

### Non-Blocking Gap: Case-Only Source/Output Equality Is Not Directly Tested

Severity: **Low**

Problem: `outputPath === sourcePath` is tested for direct equality, not
case-only equality on Windows.

Risk: low. The implementation lowercases canonical paths on Windows.

Suggested follow-up: add a Windows-specific case-only equality regression if
release evidence requires it.

## Decision

Stream A may continue to **P2 point 7**.
