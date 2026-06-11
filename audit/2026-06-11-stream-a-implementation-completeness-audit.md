# Audit Stream A - implementation completeness - 2026-06-11

Verdict: **PARTIAL / NO-GO for the full 2026-06-08 Stream A implementation plan.**

Stream A is **implemented for the strict scope** defined on 2026-06-11:
CLI parsing, path resolution, batch orchestration, overwrite/skip behavior,
summaries, exit codes, npm packaging, README/help alignment, and command
invocability evidence.

Stream A is **not fully implemented if the 2026-06-08 plan is read as requiring
vertical browser-backed proof**. The remaining blockers are real installed
browser/Mermaid evidence, global release browser/provisioning evidence, CI
matrix evidence, and the fact that FR-20 is accepted only as a documented
simulation rather than a real elevated multi-account system-scope install.

## Sources audited

- `ARTIFACT_FRESHNESS_POLICY.md`
- `docs/plan_stream_a.md`
- `docs/stream-a-implementation-plan-2026-06-08.md`
- `docs/stream-a-strict-finalization-plan.md`
- `docs/release-evidence/fr-20-system-scope.md`
- `docs/release-evidence/release-checklist-v0.1.2.md`
- `README.md`
- `package.json`
- `src/cli.ts`
- `src/paths.ts`
- `src/pipeline.ts`
- `src/overwrite.ts`
- `src/converter.ts`
- `src/pdfRenderer.ts`
- `tests/unit/**`
- `tests/integration/cli-pdf.test.ts`
- `tests/integration/real-browser-mermaid.test.ts`

## Commands replayed

| Command | Result | Evidence observed |
| --- | --- | --- |
| `npm.cmd run typecheck` | Pass | `tsc --noEmit` exited `0`. |
| `npm.cmd test` | Pass | 11 test files passed; 85 tests passed; 2 POSIX-only tests skipped on Windows. |
| `npm.cmd run test:contracts` | Pass | 1 test file passed; 10 tests passed. |
| `npm.cmd run check:artifacts` | Pass | `Artifact freshness policy passed.` |
| `npm.cmd run build` | Pass | `tsc` exited `0`. First sandbox launch failed before execution; rerun outside sandbox succeeded. |
| `npm.cmd run test:browser` | Pass | 1 integration file passed; 13 tests passed. Uses fake browser harness from `tests/integration/cli-pdf.test.ts`. |
| `npm.cmd pack --json` | Pass | Produced `md2pdf-0.1.2.tgz`; shasum `cc11a64ec297c708b2178727bd372f753fabee33`; integrity `sha512-KUOkmzNX9/0yaqlkpGBFWwu/WqoWHizE4Fe1xG43cuf8JQfnGmBFaA+s3uOvQRIr3cQraFXhNlqJdO9Kk6bGdw==`. |
| `node dist\cli.js --help` | Pass | Help lists `ENTRY`, `--output`, `--output-dir`, `--force-overwrite`, `--help`. |
| `npm.cmd run test:real-browser` | **Fail** | `tests/integration/real-browser-mermaid.test.ts` failed after 25.76s with `Timed out waiting for browser-rendered HTML`. |

## Requirement compliance

| Requirement / Story | Status | Evidence | Problem |
| --- | --- | --- | --- |
| Respect artifact freshness policy and keep artifact gate enforceable | Respected | `package.json:45`; `scripts/checkArtifactFreshness.mjs`; replayed `npm.cmd run check:artifacts` passed. | No Stream A blocker observed. |
| P1 CLI is testable, injectable, formats errors, returns usage errors as exit `2`, and exposes help | Respected | `src/cli.ts:40-50`, `src/cli.ts:108`, `src/cli.ts:164`, `src/cli.ts:184`, `tests/unit/cli/cli.test.ts:41`. | No blocking issue. |
| P1 path/job resolution covers Markdown files, non-recursive directories, default outputs, `--output`, `--output-dir`, parent creation, duplicate outputs, and source/output equality | Respected | `src/paths.ts:33`, `src/paths.ts:47`, `src/paths.ts:68`, `src/paths.ts:199`, `tests/unit/paths/paths.test.ts:20`, `:49`, `:107`, `:184`, `:195`. | No blocking issue. |
| P1/P2 preflight resolves all jobs before rendering and rejects global preflight collisions before prompts | Respected | `src/pipeline.ts:67`, `src/pipeline.ts:84`, `tests/unit/pipeline/pipeline.test.ts:38`, `:57`, `:81`. | No blocking issue. |
| P2 overwrite policy supports force overwrite, interactive prompt, non-interactive skip, EOF/default-no behavior, and skip summary | Respected | `src/overwrite.ts:37`, `src/overwrite.ts:83`, `src/overwrite.ts:88`, `tests/unit/overwrite/overwrite.test.ts:39`, `:73`, `:90`, `:143`; CLI tests at `tests/unit/cli/cli.test.ts:346`, `:366`, `:387`, `:411`, `:437`. | No blocking issue. |
| P2 conversion batch continues on conversion errors and exits `1` when any conversion fails | Respected | `src/pipeline.ts:84`, `src/cli.ts:197`; `tests/unit/pipeline/pipeline.test.ts:116`; `tests/unit/cli/cli.test.ts:313`. | No blocking issue. |
| P2 permission/error cases report useful `sourcePath`, `outputPath`, and `actionHint` | Mostly respected | `src/paths.ts:214`, `src/overwrite.ts:176`, `tests/unit/paths/paths.test.ts:61`, `:83`, `:123`; `tests/unit/overwrite/overwrite.test.ts:179`, `:208`, `:230`, `:253`. | Several permissions are mocked rather than proven through real OS ACL scenarios. This is acceptable for Stream A strict, but weak release evidence. |
| P3 runtime no longer uses the public `NotImplementedError` stub | Respected | `src/cli.ts:6`, `src/cli.ts:164`; `src/converter.ts:15`; `tests/unit/cli/cli.test.ts:99`; `tests/unit/converter/converter.test.ts:20`. | No Stream A strict blocker. |
| P3 CLI forwards `MD2PDF_BROWSER` / `ConvertOptions.browserPath` to the converter | Respected | `src/cli.ts:79`, `src/cli.ts:170`; `tests/unit/cli/cli.test.ts:119`; `tests/integration/cli-pdf.test.ts:119`. | No blocking issue. |
| P3 integration proves CLI -> runtime converter -> PDF output | Partially respected | `npm.cmd run test:browser` passed; `tests/integration/cli-pdf.test.ts:37`, `:50`, `:62`, `:76`, `:90`, `:103`, `:119`, `:203`, `:220`, `:238`; generated files start with `%PDF-`. | The test uses a fake browser harness created in `tests/integration/cli-pdf.test.ts:277`, not a real installed browser. |
| Mermaid rendered as a diagram in a real browser | **Not respected / not proven** | `tests/integration/real-browser-mermaid.test.ts:20` exists, but `npm.cmd run test:real-browser` failed with `Timed out waiting for browser-rendered HTML`; failure maps to `src/pdfRenderer.ts:173` and `src/pdfRenderer.ts:314`. | This blocks a full reading of Stream A P3 if browser-backed Mermaid proof is included. |
| P5 late write protections preserve existing output and report late write failures | Respected in fake-browser integration | `src/pdfRenderer.ts:20-35`, `src/pdfRenderer.ts:239-262`, `tests/integration/cli-pdf.test.ts:203`, `:220`, `:238`; `npm.cmd run test:browser` passed. | Real OS ACL/permission behavior remains weaker than the fake-browser race simulation. |
| P6 packaging builds `dist/cli.js`, exposes `bin.md2pdf`, verifies packlist, and supports user-scope install/reinstall evidence | Respected for local evidence | `package.json:22`, `package.json:37`; replayed `npm.cmd run build` and `npm.cmd pack --json`; checklist `docs/release-evidence/release-checklist-v0.1.2.md:97-100`. | The tarball is generated from a dirty local working tree; acceptable for audit evidence, not ideal for a final release candidate. |
| P7 FR-20 system-scope command invocability | Partial | `docs/release-evidence/fr-20-system-scope.md:6`, `:38`, `:55`, `:96`, `:100`, `:133`; checklist `docs/release-evidence/release-checklist-v0.1.2.md:88-91`. | The proof is explicitly a simulation, not a real elevated install visible from a secondary Windows account. |
| P7 README/help alignment and Windows PowerShell caveat | Respected | Help from `node dist\cli.js --help`; `README.md:79-88`, `README.md:108-120`, `README.md:70`; checklist `docs/release-evidence/release-checklist-v0.1.2.md:106-108`. | No Stream A strict blocker. |
| Final Stream A gates from the 2026-06-08 plan | Mostly respected | Replayed all listed automatic gates: typecheck, unit tests, contract tests, artifact check, build, `test:browser`, pack. | `test:real-browser` is not in the strict gate list and failed. If treated as part of P3 acceptance, Stream A is not complete. |

## Negative findings

### 1. Full P3 browser/Mermaid proof is failing

Severity: **High**

File: `tests/integration/real-browser-mermaid.test.ts`  
Line: `20`

Problem: The repository has a real-browser Mermaid smoke test, but it fails in
the current environment. The observed failure was:

```text
Timed out waiting for browser-rendered HTML
```

Evidence:

- `npm.cmd run test:real-browser` exited `1`.
- The failure points to `src/pdfRenderer.ts:173` timeout handling and
  `src/pdfRenderer.ts:314` error construction.
- The strict audit already classifies real installed-browser rendering and
  Mermaid-as-diagram proof as outside Stream A strict.

Risk: If the 2026-06-08 Stream A plan is interpreted literally as requiring
vertical browser-backed Mermaid evidence, Stream A cannot be declared fully
implemented. The fake browser integration proves orchestration and error
contracts, not actual browser rendering fidelity.

Suggested fix: Keep the strict Stream A verdict separate, but do not claim full
P3 browser/Mermaid completion until `npm.cmd run test:real-browser` passes or
Stream B supplies equivalent accepted evidence.

Test needed: Passing real installed-browser test for Markdown containing a
Mermaid diagram, plus a recorded browser/runtime environment in release
evidence.

### 2. FR-20 is accepted only through simulation

Severity: **Medium**

File: `docs/release-evidence/fr-20-system-scope.md`  
Line: `55`

Problem: FR-20 is marked `pass`, but the evidence explicitly says no real
host-wide administrator install or secondary Windows account was used.

Evidence:

- `docs/release-evidence/fr-20-system-scope.md:55` states the simulation reason
  and limitation.
- `docs/release-evidence/fr-20-system-scope.md:100` says the run does not prove
  a real elevated system-scope install visible to a separate Windows account.
- `docs/release-evidence/release-checklist-v0.1.2.md:88-91` accepts that
  simulation for Stream A strict.

Risk: This is acceptable for Stream A strict if the project explicitly accepts
simulation, but it is not the same as proving FR-20 under real system-scope
deployment conditions.

Suggested fix: Keep the current status as "Stream A strict simulation pass" and
require a real elevated/multi-account proof before a release claim that needs
true system-scope availability.

Test needed: Install the packed tarball into a real system-scope location, then
run `where md2pdf` and `md2pdf --help` from a secondary account.

### 3. Stream A / Stream B ownership remains ambiguous around PDF/browser code

Severity: **Medium**

File: `docs/stream-a-implementation-plan-2026-06-08.md`  
Line: `128`

Problem: The plan says Stream A must not reimplement `markdownRenderer`,
`browserLocator`, `webDriverClient`, `pdfRenderer`, `artifactPolicy`, or
provisioning. The current runtime path uses `src/converter.ts` and
`src/pdfRenderer.ts`, and integration tests validate PDF renderer behavior from
the Stream A side.

Evidence:

- Boundary statement: `docs/stream-a-implementation-plan-2026-06-08.md:128`.
- Runtime dependency: `src/converter.ts:6-7`.
- Browser/PDF implementation: `src/pdfRenderer.ts:21`, `:32`, `:33`.
- Existing additional audit already noted this drift:
  `audit/2026-06-09-stream-a-phases-1-5-additional-audit.md:45`.

Risk: Future audits can reach opposite conclusions depending on whether
`pdfRenderer.ts` is treated as temporary Stream A glue or Stream B-owned
runtime. This also makes "everything in Stream A is implemented" a moving
target.

Suggested fix: Add an explicit boundary decision: either classify the current
renderer as accepted temporary glue for Stream A strict, or move final
browser/PDF ownership back under Stream B before global release.

Test needed: Contract tests that prove Stream A only depends on a converter
interface and can swap renderer implementations without changing CLI behavior.

### 4. Final evidence has a small consistency gap against the current replay

Severity: **Low**

File: `docs/release-evidence/release-checklist-v0.1.2.md`  
Line: `66`

Problem: The checklist says the Stream A integration gate passes with 1 file
and 10 tests, but the current replay passed 1 file and 13 tests.

Evidence:

- Current `npm.cmd run test:browser`: 13 tests passed.
- Checklist `docs/release-evidence/release-checklist-v0.1.2.md:66` still says
  10 tests.

Risk: Low implementation risk, but the evidence file is stale enough to make
final audit traceability noisy.

Suggested fix: Update the checklist during the next evidence refresh to record
the current 13-test integration result.

Test needed: None beyond rerunning `npm.cmd run test:browser` and recording the
observed count.

## Test audit notes

| Required behavior | Test status | Problem |
| --- | --- | --- |
| P1/P2 CLI, paths, overwrite, batch, summaries | Covered | Strong unit coverage with injected converter. |
| P2 global gates | Covered in this audit replay | Typecheck, unit tests, contracts, and artifact check passed. |
| P3 fake-browser integration | Covered | `npm.cmd run test:browser` passed with 13 tests. |
| P3 real installed browser and Mermaid diagram rendering | **Not covered / failing** | `npm.cmd run test:real-browser` failed with timeout. |
| P4 packlist | Covered locally | `npm.cmd pack --json` passed. |
| P4 user-scope install/reinstall | Covered by existing evidence, not replayed in this audit | Checklist points to prior temporary-prefix install. |
| FR-20 true system-scope multi-account install | Not covered | Only simulation evidence exists. |
| CI matrix Linux/macOS/Windows | Not covered | Explicitly blocked/global-release evidence. |

## Final decision

**Yes**: Stream A strict is implemented.

**No**: the full Stream A 2026-06-08 implementation plan is not completely
closed if it includes real browser-backed Mermaid proof, true system-scope
FR-20, and global release evidence.

The correct current status is:

```text
GO Stream A strict.
NO-GO full Stream A / global release until real browser/Mermaid, FR-20 real
system-scope, CI matrix, and Stream B browser/provisioning evidence are closed.
```
