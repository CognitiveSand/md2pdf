# Stream A P1 Point 3 Pipeline Audit - 2026-06-05

Scope:

- `src/pipeline.ts`
- `tests/unit/pipeline/pipeline.test.ts`

Source requirements:

- `docs/plan_stream_a.md`, P1 point 3: preflight and batch model.
- `docs/implementation_plan_v0.1.2.md`, Stream A P1: preflight `ConversionJob`.
- `docs/architecture.md`, `pipeline.ts` responsibility and error model.

Validation commands:

- `npm.cmd run typecheck`: passed.
- `npm.cmd run test`: passed with 28 tests.

Blocking status: no blocking finding found.

## Code Audit

### Requirement and User Story Compliance

| Requirement / Story | Status | Evidence | Problem |
| --- | --- | --- | --- |
| Resolve all `ConversionJob` values before rendering | Respected | `src/pipeline.ts:26`, `tests/unit/pipeline/pipeline.test.ts:24` | No blocking problem. |
| Detect output collisions in preflight | Respected through resolver dependency | `src/pipeline.ts:26`, `src/paths.ts:146`, `tests/unit/pipeline/pipeline.test.ts:43` | No blocking problem. |
| Preflight collisions do not open overwrite prompt | Respected for current scope | `tests/unit/pipeline/pipeline.test.ts:43` | No overwrite layer exists yet, and converter is not called. |
| Tests use fake converter without browser dependency | Respected | `tests/unit/pipeline/pipeline.test.ts:67`, `tests/unit/pipeline/pipeline.test.ts:147` | No blocking problem. |
| Batch outcome model exists | Respected | `src/pipeline.ts:32`, `src/pipeline.ts:45`, `tests/unit/pipeline/pipeline.test.ts:102` | Summary and exit-code mapping remain for P2. |

### Negative Findings

No blocking code findings.

#### Finding 1

Severity: Low
File: `src/pipeline.ts`
Line: 26
Problem: The pipeline is not yet wired into `src/cli.ts`.
Risk: A real CLI invocation still reaches the temporary `NotImplementedError` stub in `cli.ts`, so this point is only available to tests and future integration code.
Evidence: `src/cli.ts` still contains the placeholder execution path from P1 point 1.
Suggested fix: Wire `ConversionPipeline` into `cli.ts` when the Stream A plan reaches summary/exit-code behavior or when the next step explicitly asks for CLI integration.
Test needed: CLI-level test with an injected fake pipeline or converter proving parsed commands reach preflight.

#### Finding 2

Severity: Low
File: `src/pipeline.ts`
Line: 32
Problem: Conversion runs sequentially with no explicit concurrency policy.
Risk: This is acceptable for MVP simplicity, but the behavior should stay intentional because later browser-backed conversion may be expensive.
Evidence: `convertJobs` awaits each `convertJob` inside a `for` loop.
Suggested fix: Keep sequential execution unless the architecture later introduces bounded concurrency.
Test needed: No immediate test required; document the decision if concurrency becomes a requirement.

## Business Logic Audit

### Requirement Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| Preflight resolves before render | Covered | `tests/unit/pipeline/pipeline.test.ts:24` |
| Collision blocks before converter call | Covered | `tests/unit/pipeline/pipeline.test.ts:43` |
| Converter is fakeable in tests | Covered | `src/pipeline.ts:12`, `tests/unit/pipeline/pipeline.test.ts:147` |
| Per-document outcome shape preserves paths | Covered | `tests/unit/pipeline/pipeline.test.ts:67`, `tests/unit/pipeline/pipeline.test.ts:102` |

### Functional Findings

No blocking business-logic findings.

#### Finding: Empty batch behavior is not asserted at pipeline level

Severity: Low
Requirement: Directory without Markdown succeeds with summary `0 succeeded, 0 failed, 0 skipped`.
File: `tests/unit/pipeline/pipeline.test.ts`
Line: 24
Problem: `paths.ts` covers empty-directory resolution, but the pipeline suite does not prove it returns an empty outcome list and avoids converter calls.
User/business impact: The final user-visible summary belongs to P2, but a pipeline-level regression could be missed before then.
Suggested fix: Add a pipeline test for an empty directory before implementing summary output.
Test needed: `pipeline.run({ entries: ["empty"], cwd })` returns `[]` and converter calls stay empty.

### Unverified Assumptions

- Pipeline-level stderr/stdout summary is intentionally absent because P2 owns complete batch summaries and exit codes.
- Overwrite prompts are intentionally absent because P2 owns overwrite policy.

## Test Audit

### Requirement and User Story Coverage

| Requirement / Story | Test Status | Problem |
| --- | --- | --- |
| Resolve all jobs before conversion | Covered | No blocking problem. |
| Missing later entry prevents earlier conversion | Covered | No blocking problem. |
| Output collision blocks conversion | Covered | No blocking problem. |
| Fake converter receives resolved source/output/options | Covered | No blocking problem. |
| Converter failure creates failed outcome and continues | Covered | This is slightly ahead of P1 and useful for the batch model. |
| Empty directory through pipeline | Not covered | Add before P2 summary work. |
| Unknown non-`Md2PdfError` converter throw wrapping | Not covered | Add when error formatting/summary behavior is wired. |

### Test Problems

No blocking test findings.

#### Finding: Dead branch in fake converter test

Severity: Low
Test/file: `tests/unit/pipeline/pipeline.test.ts`
Problem: The failure test contains an unreachable branch checking `sourcePath.endsWith("bad/never")`.
Evidence: The test only creates and passes `bad.md` and `ok.md`.
Risk: Low. It adds noise and can distract future maintainers reading the test.
Missing validation: Remove the branch or replace it with a meaningful assertion if a generic-error case is added.

### Missing Regression Coverage

- Pipeline-level empty directory behavior.
- Generic `Error` thrown by converter becomes `ConversionError` with source and output paths.
- Parent output creation failure propagated from resolver into pipeline as a typed error.

### Flaky or Misleading Tests

- No flaky filesystem pattern found. Tests use isolated temp roots and cleanup.

## Security Audit

### Threat Model

Assets: source paths, output paths, conversion outcomes, converter error causes.
Actors: local CLI caller, scripts passing untrusted paths, future browser-backed converter.
Trust boundaries: `entries`, `cwd`, output options, and converter errors cross into the orchestration layer.
Sensitive flows: pipeline itself does not read document contents; errors can later be formatted to stderr.

### Findings

No blocking security findings.

#### Finding: Unknown converter errors preserve original cause

Severity: Low
Category: Information disclosure through error causes
File: `src/pipeline.ts`
Line: 62
Attack scenario: A downstream converter throws an error containing a sensitive local path or environment-derived value, then CLI formatting includes the cause.
Problem: Wrapping unknown errors as `ConversionError` keeps the raw cause.
Impact: Low for a local CLI, but centralized logs may retain more detail than expected.
Suggested mitigation: When CLI summary/error printing is implemented, avoid dumping complete stack traces or argv/env values.
Test needed: Generic converter error formatting test that proves no stack trace is printed by default.

### Abuse Cases

- Preflight errors must stop before browser launch or overwrite prompt. Current tests prove converter is not called for missing inputs and collisions.
- A malicious batch containing one bad file should not prevent preflight validation of the whole batch. Current resolver-first design enforces this.

### Residual Risk

- Real overwrite, prompt, browser launch, and filesystem-write security risks begin in later Stream A/P2 and Stream B work.

## Summary

No blocking issue was found in Stream A P1 point 3. The implementation satisfies the preflight and fake-converter requirements for this point. Follow-up work should wire the pipeline to the CLI at the appropriate Stream A step, add empty-directory pipeline coverage, and remove the minor dead branch in the failure test.
