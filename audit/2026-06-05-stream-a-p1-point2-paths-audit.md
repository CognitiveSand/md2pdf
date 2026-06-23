# Stream A P1 Point 2 Paths Audit - 2026-06-05

Scope:

- `src/paths.ts`
- `tests/unit/paths/paths.test.ts`

Source requirements:

- `docs/plan_stream_a.md`, P1 point 2: job resolution.
- `docs/implementation_plan_v0.1.2.md`, Stream A livrable 2.
- `docs/architecture.md`, `paths.ts` responsibility and CLI/path rules.

Validation commands:

- `npm.cmd run typecheck`: passed.
- `npm.cmd run test`: passed with 24 tests.

Blocking status: no blocking finding found.

## Code Audit

### Requirement and User Story Compliance

| Requirement / Story | Status | Evidence | Problem |
| --- | --- | --- | --- |
| File entry `.md` extension is case-insensitive | Respected | `src/paths.ts:32`, `tests/unit/paths/paths.test.ts:20` | No blocking problem. |
| Directory entry is non-recursive and top-level Markdown only | Respected | `src/paths.ts:102`, `src/paths.ts:115`, `tests/unit/paths/paths.test.ts:34` | No blocking problem. |
| Directory with no Markdown resolves successfully with no jobs | Respected at resolver level | `tests/unit/paths/paths.test.ts:34` | Pipeline point must print the required summary. |
| Default output beside source | Respected | `src/paths.ts:132`, `tests/unit/paths/paths.test.ts:20` | No blocking problem. |
| `--output` limited to exactly one resolved job | Respected | `src/paths.ts:118`, `tests/unit/paths/paths.test.ts:77` | No blocking problem. |
| `--output` extension used verbatim | Respected | `src/paths.ts:133`, `tests/unit/paths/paths.test.ts:49` | No blocking problem. |
| `--output-dir` compatible with single and batch | Respected | `src/paths.ts:139`, `tests/unit/paths/paths.test.ts:61` | No blocking problem. |
| Parent output created if absent | Respected after preflight | `src/paths.ts:174`, `tests/unit/paths/paths.test.ts:49`, `tests/unit/paths/paths.test.ts:61` | No blocking problem. |
| `outputPath === sourcePath` raises `UsageError` | Respected | `src/paths.ts:148`, `tests/unit/paths/paths.test.ts:94` | No blocking problem. |
| Multiple jobs to same output raise `UsageError` before render | Respected | `src/paths.ts:159`, `tests/unit/paths/paths.test.ts:110`, `tests/unit/paths/paths.test.ts:121` | No blocking problem. |
| Explicit basename collision with `a/report.md` and `b/report.md` under `--output-dir` | Respected | `tests/unit/paths/paths.test.ts:121` | No blocking problem. |

### Negative Findings

No blocking code findings.

#### Finding 1

Severity: Low
File: `src/paths.ts`
Line: 89
Problem: `statEntry` wraps every `fs.stat` failure as "input entry was not found".
Risk: Permission-denied and transient filesystem errors can be mislabeled as not found.
Evidence: The catch block at `src/paths.ts:89` does not inspect `error.code`.
Suggested fix: In the later dedicated permission cases, distinguish missing from unreadable while keeping the required `InputNotFoundError` shape where specified.
Test needed: Input unreadable permission case from Stream A P2/P7.

#### Finding 2

Severity: Low
File: `src/paths.ts`
Line: 102
Problem: `fs.readdir` failures for directories are not wrapped in an `Md2PdfError`.
Risk: Once connected to the CLI, an unreadable directory can become a generic CLI conversion error instead of a path-specific input error.
Evidence: `resolveDirectory` directly awaits `fs.readdir` without a local catch.
Suggested fix: Wrap directory read failures with a typed error carrying `sourcePath` and `actionHint` during the permission edge-case pass.
Test needed: Unreadable directory test.

## Business Logic Audit

### Requirement Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| Resolve all jobs before render | Covered by resolver API shape | `src/paths.ts:18` |
| Reject duplicate outputs before output parent creation | Covered | `src/paths.ts:25`, `src/paths.ts:26`, `src/paths.ts:27`, `tests/unit/paths/paths.test.ts:121` |
| Preserve origin entry for reporting | Covered | `src/paths.ts:74`, `src/paths.ts:106` |
| Empty directory produces no jobs | Covered | `tests/unit/paths/paths.test.ts:34` |

### Functional Findings

No blocking business-logic findings.

#### Finding: `--output` with zero resolved jobs remains a product ambiguity

Severity: Low
Requirement: `--output` limited to one resolved job; empty directory succeeds.
File: `src/paths.ts`
Line: 118
Problem: An empty directory with `--output` currently raises usage because zero jobs is not exactly one job.
User/business impact: This is defensible, but the two requirements can be read differently.
Suggested fix: Clarify in the next plan/audit pass whether `md2pdf empty-dir --output x.pdf` should be usage `2` or success with `0 succeeded, 0 failed, 0 skipped`.
Test needed: Lock the clarified behavior.

### Unverified Assumptions

- Symlinks are not treated as Markdown files because `Dirent.isFile()` excludes symlink entries. The current requirement says files, not symlinks, so this is not blocking.

## Test Audit

### Requirement and User Story Coverage

| Requirement / Story | Test Status | Problem |
| --- | --- | --- |
| Case-insensitive `.md` file input | Covered | No blocking problem. |
| Directory non-recursive expansion | Covered | No blocking problem. |
| Empty directory returns zero jobs | Covered at resolver level | Pipeline summary remains for point 3. |
| `--output` verbatim extension and parent creation | Covered | No blocking problem. |
| `--output-dir` batch outputs | Covered | No blocking problem. |
| Duplicate output and basename collision | Covered | No blocking problem. |
| Missing input and non-Markdown file usage | Not covered | Add in follow-up. |
| Permission failures | Not covered | Planned by Stream A edge/permission cases. |

### Test Problems

No blocking test findings.

#### Finding: Missing negative-path tests for invalid entries

Severity: Low
Test/file: `tests/unit/paths/paths.test.ts`
Problem: The suite does not yet assert missing inputs, unsupported file extensions, or special filesystem entries.
Evidence: Existing tests focus on valid resolution and output-collision rules.
Risk: Error kind/message drift can appear when the CLI starts formatting resolver errors.
Missing validation: Add tests for missing file, `.txt` file, and a non-file/non-directory entry where practical.

### Missing Regression Coverage

- Case-only output collision behavior on case-insensitive filesystems is not directly tested.
- Single Markdown file discovered from a directory with `--output` is not tested.
- Empty directory plus `--output` is not tested because the intended behavior should be clarified first.

### Flaky or Misleading Tests

- No flaky pattern found. Tests use isolated temporary directories and remove them after each case.

## Security Audit

### Threat Model

Assets: source document paths, output paths, output parent directories, filesystem metadata.
Actors: local CLI caller, scripts invoking md2pdf with untrusted path input.
Trust boundaries: argv/cwd/options enter filesystem resolution; no document content is read.
Sensitive flows: absolute paths may appear in typed error context later formatted to stderr.

### Findings

No blocking security findings.

#### Finding: Output parent creation is the first filesystem write boundary

Severity: Low
Category: Unsafe file handling / path trust
File: `src/paths.ts`
Line: 174
Attack scenario: A script passes a surprising absolute `--output-dir` and md2pdf creates directories before conversion.
Problem: The behavior is required, but later CLI wiring must make it obvious that parent creation happens after preflight and before render.
Impact: Low for a local CLI; the caller controls the path.
Suggested mitigation: Keep output parent creation after all collision checks, as currently implemented, and add integration tests when CLI and pipeline are wired.
Test needed: A CLI-level test that a collision does not create the requested output directory.

### Abuse Cases

- Duplicate entries should not create output directories before being rejected. Current code satisfies this through `validateJobs` before `createOutputParents`.
- Basename collisions under `--output-dir` should not open overwrite prompts. Current resolver rejects before any overwrite layer exists.

### Residual Risk

- Permission and symlink behavior need explicit decisions before release hardening.
- Actual overwrite and conversion safety depend on later Stream A points.

## Summary

No blocking issue was found in Stream A P1 point 2. The resolver is ready for the next Stream A step, with low-priority follow-ups around typed permission errors, invalid-entry tests, and the clarified `--output` plus empty-directory behavior.
