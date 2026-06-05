# Stream A P2 Point 4 Overwrite Audit - 2026-06-05

Verdict: **NO-GO for Stream A P2 point 5**.

Reason: the security audit found a blocking overwrite-protection bypass around
dangling symlinks. Per the requested workflow, work stops after point 4 until
that blocker is fixed and re-audited.

## Scope

Implementation audited:

- `src/overwrite.ts`
- `src/pipeline.ts`
- `src/cli.ts`
- `tests/unit/overwrite/overwrite.test.ts`
- `tests/unit/pipeline/pipeline.test.ts`
- `tests/unit/cli/cli.test.ts`

Source of truth:

- `docs/plan_stream_a.md`, P2 point 4
- `docs/implementation_plan_v0.1.2.md`, Stream A overwrite

Auditors used:

- code audit
- business-logic audit
- test audit
- security/data-loss audit

## Verification

Verified in the main workspace:

- `npm.cmd run typecheck`: passed
- `npm.cmd test`: passed, 42 tests in 5 files

Notes:

- Plain `npm` failed in PowerShell because local script execution blocks
  `npm.ps1`.
- `npm.cmd test` had to be rerun outside the sandbox after a Windows sandbox
  spawn failure.
- `npm run check:artifacts` was not run for this point in the main workspace.

## Requirement Coverage

| Requirement | Status | Evidence | Problem |
| --- | --- | --- | --- |
| Pure overwrite decision table | Covered | `src/overwrite.ts:36` | No functional blocker in the pure table. |
| Output absent continues | Covered | `src/overwrite.ts:37`, `tests/unit/overwrite/overwrite.test.ts:39` | Symlink edge case below changes what "absent" means. |
| Existing output + `--force-overwrite` overwrites | Covered | `src/overwrite.ts:41`, `tests/unit/cli/cli.test.ts:229` | No blocker found. |
| Existing output + interactive + no force prompts | Covered at overwrite level | `src/overwrite.ts:86`, `tests/unit/overwrite/overwrite.test.ts:117` | CLI interactive wiring lacks direct tests. |
| Prompt default No | Covered | `src/overwrite.ts:88`, `tests/unit/overwrite/overwrite.test.ts:117` | No blocker found. |
| Accepted answers `y`, `yes`, `n`, `no`, empty | Covered | `src/overwrite.ts:52`, `tests/unit/overwrite/overwrite.test.ts:90` | No blocker found. |
| EOF and non-affirmative preserve file | Covered at overwrite level | `src/overwrite.ts:87`, `tests/unit/overwrite/overwrite.test.ts:117` | No CLI-level EOF test. |
| Non-interactive existing output skips with stderr | Covered in CLI path | `src/overwrite.ts:77`, `tests/unit/cli/cli.test.ts:210` | API allows missing `promptIo`, which can suppress stderr outside CLI. |
| Skips visible in summary and not failures | Covered | `src/cli.ts:181`, `src/cli.ts:192`, `tests/unit/cli/cli.test.ts:210` | No blocker found. |

## Blocking Finding

### Dangling Symlink Bypasses Existing-Path Protection

Severity: **Medium, blocking**

File: `src/overwrite.ts`

Line: `97`

Problem: `doesOutputExist()` uses `fs.stat()`. Because `stat()` follows
symlinks, a dangling symlink at `outputPath` is reported as `ENOENT` and treated
as a missing output. The overwrite policy then returns `continue` without prompt
or `--force-overwrite`.

Risk: in non-interactive mode, an output path that already has a filesystem
entry can bypass the required preservation behavior. A later writer may also
follow the symlink and write outside the expected output location.

Suggested fix: use `fs.lstat()` for the existence check so any existing
directory entry, including dangling symlinks, counts as existing. Consider
rejecting symlink outputs unless `--force-overwrite` is explicit and the user is
warned.

Test needed: create an output path as a dangling symlink and assert that
non-interactive mode returns skip and does not call the converter.

Blocks next point: **Yes**. This directly affects P2 point 4's protection
against accidental overwrite/data loss.

## Non-Blocking Findings

### TOCTOU Window Between Check and Write

Severity: **Medium**

File: `src/pipeline.ts`

Line: `64`

Problem: overwrite evaluation checks the path, then conversion writes later. If
another process creates or replaces the output after the check, the final writer
could overwrite a file that was not prompted or forced.

Suggested fix: when the real writer lands, enforce the overwrite decision at the
write boundary, for example with exclusive creation for non-forced writes.

Test needed: writer-level race regression test once the real converter writes
PDFs.

### CLI Interactivity Uses `stdout` Instead of Prompt Stream

Severity: **Medium**

File: `src/cli.ts`

Line: `99`

Problem: `createProcessIo()` sets `isInteractive` from
`stdin.isTTY && stdout.isTTY`, while prompts are written to stderr. If stdout is
redirected but stdin/stderr are terminals, an existing PDF is skipped instead of
prompted.

Suggested fix: base prompt interactivity on `stdin.isTTY && stderr.isTTY`, or
separate prompt interactivity from general stdout behavior.

Test needed: CLI test with redirected stdout semantics or explicit
`isInteractive: true`.

### Optional `promptIo` Can Suppress Required Messages

Severity: **Medium**

File: `src/overwrite.ts`

Lines: `29`, `77`, `82`

Problem: `promptIo` is optional. Outside the current CLI path,
non-interactive skips can omit the required stderr message and interactive mode
can silently preserve without prompting.

Suggested fix: require prompt/stderr IO whenever overwrite handling is enabled,
or return an explicit action/message for the caller to emit.

Test needed: pipeline/API test proving skip messages cannot be lost.

### Interactive CLI Prompt Is Not Covered End-to-End

Severity: **Medium**

File: `tests/unit/cli/cli.test.ts`

Line: `253`

Problem: CLI tests use non-interactive fake IO. Interactive prompt behavior is
tested only at `overwrite.ts` level.

Suggested fix: add CLI tests for existing output with `isInteractive: true`,
stdin `yes`, EOF/default No, and non-affirmative input.

### Skip Tests Do Not Read Back Existing Output

Severity: **Low**

File: `tests/unit/cli/cli.test.ts`

Line: `210`

Problem: tests assert no converter call and skipped summary, but do not read the
existing output afterward.

Suggested fix: assert the existing file content remains unchanged after
non-interactive skip and interactive EOF/default No.

### Output Inspection Failure Branch Is Untested

Severity: **Low**

File: `src/overwrite.ts`

Line: `106`

Problem: non-`ENOENT` inspection failures are wrapped as `ConversionError`, but
the branch has no scoped test.

Suggested fix: add a permission/error simulation before P2 point 7.

## Decision

Do not proceed to Stream A P2 point 5 yet.

Required next action: fix the dangling-symlink overwrite bypass, add regression
coverage, rerun `npm.cmd run typecheck` and `npm.cmd test`, then rerun the
audits for the modified files.
