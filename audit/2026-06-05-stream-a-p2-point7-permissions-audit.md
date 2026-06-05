# Stream A P2 Point 7 Permissions Audit - 2026-06-05

Verdict: **NO-GO for completing Stream A P2**.

Per the requested workflow, work stops here because the audit found blocking
issues in P2 point 7.

## Scope

Files audited:

- `src/paths.ts`
- `src/overwrite.ts`
- `src/cli.ts`, formatting and fallback behavior only
- `tests/unit/paths/paths.test.ts`
- `tests/unit/overwrite/overwrite.test.ts`

Source of truth:

- `docs/plan_stream_a.md`, P2 point 7

Auditors used:

- code audit
- business/test audit
- security/data-loss audit

## Verification

Main workspace validation before audit:

- `npm.cmd run typecheck`: passed
- `npm.cmd test`: passed, 54 tests in 5 files
- `npm.cmd run check:artifacts`: passed

Targeted audit validation reported by agents:

- `npm.cmd test -- tests/unit/paths/paths.test.ts tests/unit/overwrite/overwrite.test.ts`:
  passed, 20 tests in 2 files
- `npm.cmd test -- tests/unit/paths tests/unit/overwrite`:
  passed, 20 tests in 2 files

## Requirement Coverage

| Requirement | Status | Evidence | Problem |
| --- | --- | --- | --- |
| Input file unreadable -> `InputNotFoundError` with `sourcePath` and `actionHint` | Partially covered | `src/paths.ts:201`, `tests/unit/paths/paths.test.ts:61` | File inputs are covered, but directory inputs are not. |
| Output parent non-writable -> `ConversionError` with `outputPath` and `actionHint` | Covered for mocked parent access failure | `src/paths.ts:176`, `tests/unit/paths/paths.test.ts:99` | No blocker found in the tested parent case. |
| Existing output non-replaceable -> clear message with path | Partially covered | `src/overwrite.ts:145`, `tests/unit/overwrite/overwrite.test.ts:179` | W_OK failure is covered, but existing output directory is not. |

## Blocking Findings

### 1. Unreadable Directory Inputs Are Not Wrapped As Input Errors

Severity: **Medium, blocking**

File: `src/paths.ts`

Lines: `80`, `104`

Problem: file inputs call `ensureReadableFile()` and are wrapped as
`InputNotFoundError` with `sourcePath` and `actionHint`. Directory inputs go
directly through `resolveDirectory()`, where `fs.readdir()` is not caught. If a
directory entry exists but cannot be read, the raw `EACCES` or `EPERM` escapes.
The CLI then turns it into a generic `[conversion] unexpected CLI failure`.

Risk: valid directory inputs can violate P2 point 7's clear input-error contract
and likely exit with the wrong code/message.

Suggested fix: wrap `fs.readdir()` failures in `InputNotFoundError` with
`sourcePath: directoryPath` and an action hint such as
`check that <entry> exists and is readable`.

Test needed: mock `fs.readdir()` to throw `EACCES` for a directory input and
assert `kind: "input"`, `sourcePath`, `actionHint`, and CLI exit `2`.

Blocks completing P2: **Yes**.

### 2. Existing Output Directory Can Pass Replaceability Check

Severity: **Medium, blocking**

File: `src/overwrite.ts`

Lines: `101`, `145`

Problem: existing output detection uses `lstat()`, but the resulting file type
is not inspected. `ensureOutputReplaceable()` only checks
`fs.access(outputPath, W_OK)`. A writable directory at the target output path can
pass that check and fail later in the converter, losing the required clear
"existing output is not replaceable" message with the output path.

Risk: an existing output path that is a directory can escape the P2 point 7
diagnostic and degrade into a later generic conversion failure.

Suggested fix: keep the `lstat()` result or re-`lstat()` in
`ensureOutputReplaceable()`, reject non-file outputs before conversion, and
return `ConversionError` with `outputPath` and an explicit action hint.

Test needed: create a directory at the would-be output path, run overwrite with
`forceOverwrite: true` or interactive `yes`, and assert `ConversionError` with
message `existing output is not replaceable` and `outputPath`.

Blocks completing P2: **Yes**.

## Non-Blocking Findings

### `fs.access()` Checks Are Advisory

Severity: **Medium, not blocking for P2 if treated as diagnostics**

Files: `src/paths.ts`, `src/overwrite.ts`

Problem: readability and writability are checked before the later actual read or
write. Another process can change permissions or replace paths between preflight
and conversion.

Risk: these checks improve early diagnostics, but do not enforce write-time
safety.

Suggested follow-up: when the real converter lands, wrap actual read/write
failures clearly and enforce overwrite semantics at the write boundary.

### Symlink Target Is Not Disclosed On Confirmed/Forced Overwrite

Severity: **Low**

File: `src/overwrite.ts`

Line: `88`

Problem: `lstat()` treats symlink entries as existing, but after `yes` or
`--force-overwrite`, `fs.access(outputPath, W_OK)` follows the symlink target.
The prompt names only the link path, not the resolved target.

Suggested follow-up: reject symlink outputs or disclose the resolved target
before allowing overwrite.

## Decision

Do not continue beyond Stream A P2 point 7 yet.

Required next action: fix the two blocking point 7 findings, add regression
tests, rerun `npm.cmd run typecheck`, `npm.cmd test`, and
`npm.cmd run check:artifacts`, then re-audit P2 point 7.
