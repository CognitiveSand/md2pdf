# md2pdf v0.1.2 Release Checklist

Release status: `pending`

P0 closure status: `pass`

This checklist tracks the release evidence required for md2pdf v0.1.2. It is
created during P0 and must be completed before the release candidate is accepted.
Use the statuses defined in `README.md`: `pending`, `pass`, `fail`, `blocked`,
or `n/a`.

Blank statuses are invalid. A release-blocking item with status `pending`,
`fail`, or `blocked` means the release is not ready unless the reason is
explicitly accepted in this checklist.

## Checklist Metadata

| Field | Value |
| --- | --- |
| md2pdf version | `0.1.2` |
| Checklist status | `pending` for release; P0 closure `pass` |
| Date opened | `2026-06-04` |
| Date completed | `pending` |
| Owner | `pending` |
| Commit SHA | `pending` |
| npm tarball or package source | `pending` |

## P0 Scope Check

These items prove that P0 stayed documentation-focused and did not start C0
application implementation. A scoped gate-maintenance exception is recorded
below.

| Item | Status | Evidence / command | Notes |
| --- | --- | --- | --- |
| Phase 1 review exists | `pass` | `docs/p0_phase1_initial_review_v0.1.2.md` | Cadrage and initial divergence list created. |
| Phase 2 architecture alignment exists | `pass` | `docs/architecture.md` section 16 | P0 alignment checklist added to architecture. |
| Phase 3 release evidence README exists | `pass` | `docs/release-evidence/README.md` | Evidence rules and statuses defined. |
| Phase 4 FR-20 template exists | `pass` | `docs/release-evidence/fr-20-system-scope.md` | Template created with `pending` placeholders. |
| No C0 source work started during P0 | `pass` | P0 final reconciliation review; `find src tests -maxdepth 2 -type f` | No `src/**/*.ts`, no contract tests and no regenerated `dist/` output are present. Existing `.DS_Store` files are not C0 source work. |
| Artifact gate Windows portability fix is scoped | `pass` | `scripts/checkArtifactFreshness.mjs` | The only non-documentary P0 correction is gate maintenance: resolving `npm.cmd` on Windows for the existing artifact freshness check. It does not create C0 contracts, runtime conversion behavior, tests, or regenerated `dist/`. |
| `docs/architecture.md` no longer diverges from plan v0.1.2 | `pass` | `docs/architecture.md` section 4 and section 16; `docs/implementation_plan_v0.1.2.md` section 4 | Public contracts now match the parent plan: `ConversionJob` has `sourcePath`, `outputPath`, `originEntry`; `ConversionOutcome extends ConversionJob`; shared error root is `Md2PdfError`. |

## P0 Gate

| Item | Status | Evidence / command | Expected Result | Observed Result |
| --- | --- | --- | --- | --- |
| Typecheck gate attempted | `blocked` | `npm.cmd run typecheck` | Either passes, or P0 exception is recorded because `src/` does not exist before C0. | Accepted P0-only exception: `TS18003: No inputs were found` observed before C0 because `src/**/*.ts` does not exist. C0 must create contract source before this can become green. |

## C0 Contract Trace

| Item | Status | Evidence / command | Notes |
| --- | --- | --- | --- |
| Contract test red state observed | `pass` | `audit/audit-c0-etape4.md`, lines 25 and 87-90 | C0 step 4 captured the red contract gate: `npm run test:contracts` failed with missing script before steps 5-6 existed. |
| Contract gate green after C0 | `pass` | `npm run typecheck`; `npm run test:contracts` on 2026-06-04 | Both commands passed after C0 contracts, stubs, script, and contract tests were added. |
| `ConversionOutcome extends ConversionJob` verified | `pass` | `tests/unit/contracts/contracts.test.ts`, `instantiates conversion contracts with the expected fields` | Verifies `sourcePath`, `outputPath`, `originEntry`, status, and typed error context. |
| Shared error contracts importable and formattable | `pass` | `tests/unit/contracts/contracts.test.ts`, `C0 shared errors` | Covers stable `kind`, message, paths, artifact, hint, cause, and JSON context formatting. |

## Automated Release Gates

| Item | Status | Evidence / command | Notes |
| --- | --- | --- | --- |
| TypeScript typecheck | `pass` | `npm.cmd run typecheck`; `audit/2026-06-08-stream-a-phase1-point2-p2-global-audit.md` | P2 global gate passed on 2026-06-08. Final release candidate should rerun the gate. |
| Unit tests | `pass` | `npm.cmd test`; `audit/2026-06-08-stream-a-phase1-point2-p2-global-audit.md`; Stream A Phase 3 local replay | P2 global gate passed; after Phase 3, the current unit suite passes with 10 test files and 84 tests. Final release candidate should rerun the gate. |
| Contract tests | `pass` | `npm.cmd run test:contracts`; `audit/2026-06-08-stream-a-phase1-point2-p2-global-audit.md`; Stream A Phase 3 local replay | P2 global gate passed; after Phase 3, the current contract suite passes with 1 test file and 10 tests. Final release candidate should rerun the gate. |
| Integration tests | `pass` | `npm.cmd run test:browser`; `tests/integration/cli-pdf.test.ts` | Stream A P3/P5 integration gate passes with 1 test file and 10 tests covering CLI -> runtime converter -> PDF renderer contract plus late write failure protections. |
| Browser-backed tests | `blocked` | Real installed-browser/Mermaid test still required | `test:browser` now covers the browser command contract with a deterministic fake browser. A real installed browser and Mermaid-as-diagram proof remain required before release. |
| Artifact freshness gate | `pass` | `npm.cmd run check:artifacts`; `audit/2026-06-08-stream-a-phase1-point1-artifacts-audit.md`; `audit/2026-06-08-stream-a-phase1-point2-p2-global-audit.md` | P2 global gate passed after restoring the declared `assets/highlight.css` bytes. Final release candidate should rerun the gate. |
| CI matrix | `pending` | CI run URL, logs, or committed summary | Linux, macOS, Windows on Node.js 20+. |

## Accepted Pre-C0 Exceptions

These exceptions are acceptable for closing P0 only. They remain blockers for
C0, P4, or the release candidate as indicated.

| Exception | Status | Applies until | Required resolution |
| --- | --- | --- | --- |
| `npm run typecheck` fails with `TS18003` because `src/**/*.ts` does not exist. | `pass` | Resolved in C0 | C0 contract source/stubs now exist and `npm run typecheck` passed on 2026-06-04. |
| C0 red/green contract evidence is not available yet. | `pass` | Resolved in C0 | Red gate captured in `audit/audit-c0-etape4.md`; green gate captured with `npm run typecheck` and `npm run test:contracts` on 2026-06-04. |
| Release gates, browser tests, packlist, install evidence, and FR-20 proof are not runnable before a release candidate exists. | `pending` | P4/release candidate | Complete the automated and manual evidence sections below. |
| Existing `dist/` content is non-normative and may not match `package.json` bin layout. | `blocked` | First valid build after C0/P3 | Regenerate `dist/` from `src/`; prove `bin.md2pdf` resolves to a real built `dist/cli.js` in `npm pack --json`. |

## FR-20 System-Scope Evidence

| Item | Status | Evidence / command | Notes |
| --- | --- | --- | --- |
| FR-20 evidence file present | `pass` | `docs/release-evidence/fr-20-system-scope.md` | Template exists from P0 phase 4. |
| FR-20 evidence completed for release candidate | `pending` | `docs/release-evidence/fr-20-system-scope.md` | Required before release. |
| Command resolves by name in tested account | `pending` | Windows: `where md2pdf`; POSIX: `command -v md2pdf` or `which md2pdf` | Proves PATH availability; absolute path alone is diagnostic, not sufficient. |
| `md2pdf --help` runs by command name in tested account | `pending` | Exact command and output in FR-20 evidence | Required to prove invocability for the account. |
| Secondary account or valid simulation documented | `pending` | FR-20 account coverage section | Prefer standard non-admin secondary account. Simulation must explain why a real account was unavailable and prove equivalent PATH/invocation behavior. |

## Packaging And Distribution

| Item | Status | Evidence / command | Notes |
| --- | --- | --- | --- |
| `dist/` regenerated from `src/` | `pending` | `npm run build` plus commit/diff note | `dist/` must not be a source of truth. |
| npm packlist verified | `pending` | `npm pack --json` | Must include `dist/`, `assets/`, `README.md`, `ARTIFACT_FRESHNESS_POLICY.md`, and `artifacts.json`. |
| User-scope install works | `pending` | Temporary npm prefix install and `md2pdf --help` | Covers FR-19. |
| Reinstall is idempotent | `pending` | Second install of same tarball exits `0` | Covers FR-21. |

## README And CLI Options

| Item | Status | Evidence / command | Notes |
| --- | --- | --- | --- |
| `md2pdf --help` lists supported options | `pass` | `tests/unit/cli/cli.test.ts`, `@req NFR-04 prints one help line for each supported option` | Unit proof covers CLI help formatting. Built-package help output remains part of P4 packaging evidence. |
| README options match CLI help | `pending` | Review note or comparison output | README must not document stale or missing CLI options. |
| FR-20 help output captured | `pending` | `fr-20-system-scope.md` | Should be the output from the tested system-scope account context. |

## Defensive Decisions

Each defensive decision must have a test or documentation reference. Documentation
alone is acceptable only when the behavior cannot be executed before the relevant
phase exists.

| Decision | Status | Evidence / reference | Notes |
| --- | --- | --- | --- |
| Empty directory exits `0` with `0 succeeded, 0 failed, 0 skipped` | `pass` | `tests/unit/cli/cli.test.ts`, `@req FR-09 @req FR-11 keeps an empty Markdown directory successful` | Covered by Stream A P1/P2 unit tests. |
| `.MD` extension is accepted case-insensitively | `pass` | `tests/unit/paths/paths.test.ts`, `@req FR-02 accepts Markdown file extensions case-insensitively`; `tests/unit/cli/cli.test.ts`, valid single-file command | Covered by Stream A P1/P2 unit tests. |
| Explicit output extension is used verbatim | `pass` | `tests/unit/paths/paths.test.ts`, `@req FR-03 uses --output verbatim`; `tests/unit/cli/cli.test.ts`, valid single-file command | Covered by Stream A P1/P2 unit tests. README documentation remains a P4 item. |
| Output parent is created when possible | `pass` | `tests/unit/paths/paths.test.ts`, `@req FR-03 uses --output verbatim and creates a missing parent directory` | Covered by Stream A P1/P2 unit tests. |
| Output parent non-writable reports clear error | `pass` | `tests/unit/paths/paths.test.ts`, `reports non-writable output parents with output path and action hint` | Unit proof covers `outputPath` and `actionHint`. Real write-time permission failures remain a later P3/P5 integration concern. |
| Skipped outputs count in summary without causing failure | `pass` | `tests/unit/cli/cli.test.ts`, `@req FR-12 @req FR-18 reports non-interactive overwrite skips in the summary without failing` | Covered by Stream A P1/P2 unit tests. |
| Duplicate entries or duplicate outputs fail preflight | `pass` | `tests/unit/paths/paths.test.ts`, duplicate entries; `tests/unit/pipeline/pipeline.test.ts`, output collisions; `tests/unit/cli/cli.test.ts`, CLI preflight collision | Covered by Stream A P1/P2 unit tests; includes duplicates and output collisions. |
| `--output-dir` basename collision blocks before render | `pass` | `tests/unit/paths/paths.test.ts`, `@req FR-23 rejects basename collisions`; `tests/unit/cli/cli.test.ts`, CLI preflight collision | Covered by Stream A P1/P2 unit tests. Example: `a/report.md` and `b/report.md`. |
| Cache writes are atomic | `pending` | Stream B artifact test | `.tmp` then atomic rename after verification. |
| Cache non-writable reports explicit artifact/browser error | `pending` | Stream B artifact test | Must not become a generic failure. |
| C0 red then green evidence recorded | `pass` | C0 contract trace above | Required C0 proof is now recorded. |
| FR-20 manual proof versioned | `pending` | FR-20 section above | Required for release. |

## Architecture Alignment

| Item | Status | Evidence / reference | Notes |
| --- | --- | --- | --- |
| Public contracts documented | `pass` | `docs/architecture.md` section 4 | Includes `ConvertOptions`, `ConversionJob`, `ConversionOutcome`, `convertFile`. |
| `ConversionOutcome extends ConversionJob` documented | `pass` | `docs/architecture.md` section 4 | Corrected after phase 1/2 audit. |
| Browser/artifact responsibilities separated | `pass` | `docs/architecture.md` sections 5, 11, 13 | `BrowserLocator`, `ReleaseCatalog`, `ArtifactPolicy`, `FallbackBrowserProvisioner`. |
| Chromium-for-Testing fallback constrained by policy | `pass` | `docs/architecture.md` sections 11, 13, 14 | Last resort, declared artifact, `newest eligible`, SHA-256, freshness. |
| Provisioning vs conversion local-only boundary documented | `pass` | `docs/architecture.md` sections 9, 14 | Conversion remains local-only from pre-provisioned state. |
| Remaining architecture audit questions resolved or accepted | `pass` | `audit/2026-06-04-p0-phases-1-2-audit.md`, `audit/2026-06-04-p0-phase-4-audit.md`, `audit/2026-06-04-p0-phase-5-audit.md`, `audit/2026-06-04-p0-final-validation.md`; this checklist | Open P0 blockers were resolved or converted into explicit pre-C0 exceptions above. |

## Final Release Decision

| Field | Value |
| --- | --- |
| Release decision | `pending` |
| Reviewer | `pending` |
| Decision date | `pending` |
| Blocking items remaining | `pending` |
| Notes | `pending` |
