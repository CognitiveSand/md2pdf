# Stream A P1 Point 1 CLI Audit - 2026-06-05

Scope:

- `src/cli.ts`
- `tests/unit/cli/cli.test.ts`

Source requirements:

- `docs/plan_stream_a.md`, P1 point 1: testable CLI.
- `docs/implementation_plan_v0.1.2.md`, Stream A livrable 1.
- `docs/architecture.md`, section 6 and section 8.

Validation commands:

- `npm.cmd run typecheck`: passed.
- `npm.cmd run test`: passed with 16 tests.

Blocking status: no blocking finding found.

## Code Audit

### Requirement and User Story Compliance

| Requirement / Story | Status | Evidence | Problem |
| --- | --- | --- | --- |
| `main(argv, io)` without strong dependency on global `process` | Respected | `src/cli.ts:41`, `src/cli.ts:76`, `src/cli.ts:198` | No blocking problem. Process access is isolated to `createProcessIo` and the direct entrypoint guard. |
| `io` exposes `stdin`, `stdout`, `stderr`, `env`, `cwd`, `isInteractive` | Respected | `src/cli.ts:13` | No blocking problem. |
| Command signature `md2pdf [OPTIONS] ENTRY [ENTRY ...]` | Respected | `src/cli.ts:31`, `tests/unit/cli/cli.test.ts:26` | No blocking problem. |
| `--help`: one line per option, all options described | Respected | `src/cli.ts:31`, `tests/unit/cli/cli.test.ts:26` | No blocking problem. |
| Usage errors exit `2` | Respected for current parser-level cases | `src/cli.ts:53`, `src/cli.ts:163`, `tests/unit/cli/cli.test.ts:42`, `tests/unit/cli/cli.test.ts:55`, `tests/unit/cli/cli.test.ts:83` | Future path-resolution usage errors must keep using the same mapping. |
| CLI formats errors via `formatError` | Respected | `src/cli.ts:53` | No blocking problem. |

### Negative Findings

No blocking code findings.

#### Finding 1

Severity: Low
File: `src/cli.ts`
Line: 140
Problem: A valid non-help invocation currently ends in a formatted `NotImplementedError`.
Risk: This is acceptable for P1 point 1, but it will become misleading as soon as point 2 starts resolving jobs because parsed commands will still fail before any real preflight or conversion.
Evidence: `executeCommand` always throws `NotImplementedError`.
Suggested fix: Replace the placeholder during Stream A point 2/3 with the path-resolution and pipeline preflight entrypoint.
Test needed: A parser-to-preflight test proving that a valid command reaches the resolver without returning the placeholder error.

## Business Logic Audit

### Requirement Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| CLI is testable through injected IO | Covered | `src/cli.ts:13`, `tests/unit/cli/cli.test.ts:26` |
| CLI exposes expected user-facing options | Covered | `src/cli.ts:31` |
| Usage errors are distinguishable from conversion failures | Covered for parser-level errors | `src/cli.ts:163` |
| `MD2PDF_BROWSER` can flow from env into parsed command | Covered as preparatory behavior | `src/cli.ts:59`, `tests/unit/cli/cli.test.ts:68` |

### Functional Findings

No blocking business-logic findings.

#### Finding: Valid conversion path is intentionally incomplete

Severity: Low
Requirement: Stream A P1 point 1, bounded to CLI parsing.
File: `src/cli.ts`
Line: 140
Problem: The CLI cannot yet produce jobs or conversions after successful parsing.
User/business impact: Users cannot run a real conversion from this point alone.
Suggested fix: Implement point 2 job resolution next, then connect the CLI to preflight once `paths.ts` exists.
Test needed: End-to-end CLI unit test with a fake resolver/pipeline once point 2 or 3 is implemented.

### Unverified Assumptions

- `cwd` is modeled as a string in `CliIo`; this matches the current need, but point 2 must confirm whether the resolver expects a string or callable current working directory.

## Test Audit

### Requirement and User Story Coverage

| Requirement / Story | Test Status | Problem |
| --- | --- | --- |
| `--help` lists supported options | Covered | `tests/unit/cli/cli.test.ts:26` |
| Missing entry exits `2` and uses formatted stderr | Covered | `tests/unit/cli/cli.test.ts:42` |
| Unknown option exits `2` | Covered | `tests/unit/cli/cli.test.ts:55` |
| Short aliases and env parsing | Covered | `tests/unit/cli/cli.test.ts:68` |
| `--output` / `--output-dir` conflict | Covered | `tests/unit/cli/cli.test.ts:83` |

### Test Problems

No blocking test findings.

#### Finding: Missing-value parser errors are not explicitly tested

Severity: Low
Test/file: `tests/unit/cli/cli.test.ts`
Problem: The suite covers unknown options but not `--output` without a value or `--output-dir` without a value.
Evidence: Existing parser-error coverage starts at `tests/unit/cli/cli.test.ts:55`.
Risk: A future refactor could accidentally stop treating missing option values as usage errors.
Missing validation: Add tests for `md2pdf --output` and `md2pdf --output-dir`.

### Missing Regression Coverage

- A direct-bin smoke test should be added later in P4 after `dist/cli.js` is built.
- A valid parse-to-preflight test should be added once point 2/3 introduces the resolver/pipeline boundary.

### Flaky or Misleading Tests

- No flaky test pattern found in the current scope.

## Security Audit

### Threat Model

Assets: local Markdown file paths, output paths, environment-provided browser path, terminal stderr/stdout.
Actors: local CLI caller, automation invoking md2pdf, future resolver/converter code.
Trust boundaries: untrusted argv and environment enter `parseCommandLine`; filesystem access is not implemented in this point.
Sensitive flows: no document contents are read in this point.

### Findings

No blocking security findings.

#### Finding: Raw parser messages are echoed to stderr

Severity: Low
Category: Information disclosure / terminal hygiene
File: `src/cli.ts`
Line: 103
Attack scenario: A wrapper passes a sensitive token as an invalid option name and logs stderr centrally.
Problem: Native parser messages include user-supplied option text.
Impact: Low, because the CLI already treats argv as caller-visible input; centralized logging can still preserve accidental secrets.
Suggested mitigation: Keep usage-error messages concise and avoid adding full argv dumps in later changes.
Test needed: Regression test that unknown-option stderr does not include the complete argv list.

### Abuse Cases

- Passing malformed flags should only produce `UsageError` and must not trigger filesystem or browser work. Current code satisfies this for point 1.
- Passing `MD2PDF_BROWSER` should not execute anything during parsing. Current code only stores the value.

### Residual Risk

- Real filesystem and process-launch security risks start in points 2 and 3 when path resolution and conversion orchestration are connected.

## Summary

No blocking issue was found in Stream A P1 point 1. The implementation is safe to continue to point 2, with low-priority follow-up tests for missing option values and future replacement of the temporary `NotImplementedError` execution stub.
