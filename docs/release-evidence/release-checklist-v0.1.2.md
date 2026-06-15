# md2pdf v0.1.2 Release Checklist

Release status: `blocked`

P0 closure status: `pass`

Post-audit Phase 0 evidence reset status: `pass`; justified by
`audit/audit-postmerge-P0.md`

Post-audit Phase 1-2 strict evidence status: `pass` for the replayed local
gates; global release remains `blocked`.

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
| Checklist status | `blocked` for global release; historical Stream A strict `pass` |
| Date opened | `2026-06-04` |
| Date completed | Stream A strict completed `2026-06-11` as historical evidence; Phase 1-2 strict replay passed `2026-06-12`; global release pending |
| Owner | `Codex` |
| Commit SHA | Historical Stream A strict commit `b58c45775b5e25926d7567a230034576949bd603`; current Phase 1-2 evidence is tied to base commit `d7545014c387573ff5c7110db4cc44e2c5f988fc` plus the worktree deletion of `src/pdfRenderer.ts` |
| npm tarball or package source | Historical Stream A strict package evidence only: `md2pdf-0.1.2.tgz`; shasum `cc11a64ec297c708b2178727bd372f753fabee33`; integrity `sha512-KUOkmzNX9/0yaqlkpGBFWwu/WqoWHizE4Fe1xG43cuf8JQfnGmBFaA+s3uOvQRIr3cQraFXhNlqJdO9Kk6bGdw==`. This is not current global release-candidate evidence after the 2026-06-12 audit. |

## Post-Audit Phase 0 Reconciliation

This section resets the release evidence after
`audit/2026-06-12-global-project-progress-structure-problems-audit.md`.
The original Phase 0 reset did not replay technical gates. Later Phase 1 and
Phase 2 strict replays supersede the old red status for the fast local gates
listed below. They do not close global release evidence, browser proof, CI,
packlist, install, or FR-20.

Audited gates and post-merge replay status:

| Command | Current release status | Source | Notes |
| --- | --- | --- | --- |
| `npm.cmd run typecheck` | `pass` | `audit/2026-06-12-phase-1-2-teamcomplete-audit.md` | Phase 1-2 strict replay passed. |
| `npm.cmd test` | `pass` | `audit/2026-06-12-phase-1-2-teamcomplete-audit.md` | Phase 1-2 strict replay passed: 148 passed, 1 skipped. |
| `npm.cmd run test:contracts` | `pass` | Current 2026-06-12 checklist update; `audit/2026-06-12-phase-1-post-corrections-teamcomplete-audit.md` | Contract replay passed: 15 tests. |
| `npm.cmd run test:browser` | `fail` | `audit/2026-06-12-phase-1-post-corrections-teamcomplete-audit.md` | Browser/release proof still fails without skip because no supported local browser or eligible fallback artifact is available on the audited platform. |
| `npm.cmd run test:real-browser` | `fail` | `audit/2026-06-12-phase-1-post-corrections-teamcomplete-audit.md` | Real browser smoke fails because no supported browser executable is available in the audited environment. |
| `npm.cmd run test:artifacts` | `pass` | `audit/2026-06-12-phase-1-2-teamcomplete-audit.md` | Phase 1-2 strict replay passed: 20 tests. |
| `npm.cmd run check:artifacts` | `pass` | `audit/2026-06-12-phase-1-2-teamcomplete-audit.md` | Artifact freshness policy passed. This local pass does not make the global release ready by itself. |
| `npm.cmd run build` | `pass` | `audit/2026-06-12-phase-1-2-teamcomplete-audit.md` | `dist/` regenerates from the current source and does not recreate `dist/pdfRenderer.*`. |

Evidence classes after this reset:

| Evidence class | Status | Meaning |
| --- | --- | --- |
| Historical Stream A strict evidence | `pass` only where explicitly scoped to Stream A strict and dated before the 2026-06-12 audit | Preserved as historical evidence; it must not be read as proof that the current global v0.1.2 gates are green. |
| Global v0.1.2 release evidence | `blocked` or `fail` | The global release remains `NO-GO` until the remaining audited red gates and missing browser/CI evidence are resolved and rerun. |
| Simulated evidence | `blocked` for the release requirement unless the item is explicitly limited to simulation mechanics | Simulation records can remain useful, but they are not equivalent to release-grade proof. |
| Real release evidence | `pending` or `blocked` unless a current, committed run exists | Real release evidence must be tied to the current source, rebuilt `dist/`, current package, artifact gate, browser proof, and CI matrix. |

Current Phase 1-2 `pass` rows are limited to the replayed fast local gates and
build evidence recorded on 2026-06-12. Other `pass` rows remain documentation
facts, historical observations, or explicitly scoped simulation mechanics.
Package-backed, browser-backed, CI-backed, and release-candidate claims remain
`fail` or `blocked` until the relevant fresh command run proves them again.

Former `pass` rows reset by post-audit Phase 0:

| Checklist area | Former claim | Current release status | Reason |
| --- | --- | --- | --- |
| C0 contract trace | Contract shape and shared errors verified by tests | `pass` for the current Phase 1-2 strict worktree | `npm.cmd run test:contracts` is green in the current 2026-06-12 replay. |
| Automated release gates | Typecheck, unit, contract, artifact, build, integration, and browser gates | `pass` for fast P1/P2 gates; `fail` for browser/release gates | Fast local gates are current and green; browser/release evidence remains red or blocked. |
| FR-20 system-scope | Release candidate FR-20 completed | `blocked` | Only a Stream A strict simulation exists; no real system-scope multi-account proof exists. |
| Packaging and distribution | `dist/`, packlist, install, reinstall | `pass` for Phase 1-2 `dist`; `blocked` for release package evidence | Current `dist/` regeneration is green, but historical package evidence is tied to a stale package and cannot close the current release. |
| README and CLI options | Built CLI help and README/help parity | `blocked` | Fresh built CLI help and release package evidence have not been replayed for the global release. |
| Defensive decisions | Test-backed behavioral decisions | `pass` where covered by the current unit, contract, or artifact replay; otherwise `pending` or `blocked` | Fast local behavioral coverage is current and green for Phase 1-2. Release-only decisions remain blocked. |

## P0 Scope Check

These items are historical original-P0 closure evidence. They prove that the
original P0 stayed documentation-focused at the time it ran; they are not claims
about the current repository tree after later C0, Stream A, and Stream B work.
A scoped gate-maintenance exception is recorded below.

| Item | Status | Evidence / command | Notes |
| --- | --- | --- | --- |
| Phase 1 review exists | `pass` | `docs/p0_phase1_initial_review_v0.1.2.md` | Cadrage and initial divergence list created. |
| Phase 2 architecture alignment exists | `pass` | `docs/architecture.md` section 16 | P0 alignment checklist added to architecture. |
| Phase 3 release evidence README exists | `pass` | `docs/release-evidence/README.md` | Evidence rules and statuses defined. |
| Phase 4 FR-20 template exists | `pass` | `docs/release-evidence/fr-20-system-scope.md` | Template created with `pending` placeholders. |
| No C0 source work started during original P0 | `pass` | P0 final reconciliation review; historical `find src tests -maxdepth 2 -type f` | Historical original-P0 fact only. The current repository now contains `src/` and `tests/` from later phases, and current gates are tracked separately above. |
| Artifact gate Windows portability fix was scoped during original P0 | `pass` | `scripts/checkArtifactFreshness.mjs` | Historical original-P0 fact only. The current artifact gate replay is tracked separately in Automated Release Gates. |
| `docs/architecture.md` no longer diverged from plan v0.1.2 during original P0 | `pass` | `docs/architecture.md` section 4 and section 16; `docs/implementation_plan_v0.1.2.md` section 4 | Historical documentation-alignment fact only. Current code/runtime alignment is not inferred from this row. |

## P0 Gate

| Item | Status | Evidence / command | Expected Result | Observed Result |
| --- | --- | --- | --- | --- |
| Typecheck gate attempted | `blocked` | `npm.cmd run typecheck` | Either passes, or P0 exception is recorded because `src/` does not exist before C0. | Accepted P0-only exception: `TS18003: No inputs were found` observed before C0 because `src/**/*.ts` does not exist. C0 must create contract source before this can become green. |

## C0 Contract Trace

| Item | Status | Evidence / command | Notes |
| --- | --- | --- | --- |
| Contract test red state observed | `pass` | `audit/audit-c0-etape4.md`, lines 25 and 87-90 | Historical C0 step 4 captured the red contract gate: `npm run test:contracts` failed with missing script before steps 5-6 existed. |
| Contract gate green after C0 | `pass` | `npm.cmd run test:contracts`; current 2026-06-12 checklist update | Current replay passed: 15 tests. |
| `ConversionOutcome extends ConversionJob` verified | `pass` | `tests/unit/contracts/contracts.test.ts`, `instantiates conversion contracts with the expected fields`; `npm.cmd run test:contracts` | Current contract replay is green. |
| Shared error contracts importable and formattable | `pass` | `npm.cmd run test:contracts`; `tests/unit/contracts/contracts.test.ts` | Current contract replay proves importability and formatting. |

## Automated Release Gates

| Item | Status | Evidence / command | Notes |
| --- | --- | --- | --- |
| TypeScript typecheck | `pass` | `npm.cmd run typecheck`; `audit/2026-06-12-phase-1-2-teamcomplete-audit.md` | Current Phase 1-2 strict replay passed. |
| Unit tests | `pass` | `npm.cmd test`; `audit/2026-06-12-phase-1-2-teamcomplete-audit.md` | Current Phase 1-2 strict replay passed: 148 passed, 1 skipped. |
| Contract tests | `pass` | `npm.cmd run test:contracts`; current 2026-06-12 checklist update | Current replay passed: 15 tests. |
| Integration tests | `fail` | `npm.cmd run test:browser`; `audit/2026-06-12-phase-1-post-corrections-teamcomplete-audit.md` | Browser/release integration still fails on the two real browser proofs without skip. |
| Browser-backed tests | `blocked` | Stream B / global release evidence required | Real installed-browser, Mermaid-as-diagram, WebDriver/Firefox, fallback provisioning, and browser-family compatibility evidence are outside Stream A strict. |
| Artifact freshness gate | `pass` | `npm.cmd run check:artifacts`; `audit/2026-06-12-phase-1-2-teamcomplete-audit.md` | Current Phase 1-2 strict replay passed. This does not close browser, package, CI, FR-20, or global release evidence blockers. |
| Build / `dist` regeneration | `pass` | `npm.cmd run build`; `audit/2026-06-12-phase-1-2-teamcomplete-audit.md` | Current build passes and does not recreate `dist/pdfRenderer.*` after Phase 2 removed `src/pdfRenderer.ts`. |
| CI matrix | `blocked` | Global release CI run URL, logs, or committed summary | Linux, macOS, Windows on Node.js 20+. This remains global release evidence, not a Stream A strict implementation task. |

## Accepted Pre-C0 Exceptions

These exceptions are acceptable for closing P0 only. They remain blockers for
C0, P4, or the release candidate as indicated.

| Exception | Status | Applies until | Required resolution |
| --- | --- | --- | --- |
| `npm run typecheck` fails with `TS18003` because `src/**/*.ts` does not exist. | `pass` | Historical P0 closure only; resolved in C0 | This records the original P0 exception lifecycle. The current typecheck gate is green in the Phase 1-2 replay above. |
| C0 red/green contract evidence is not available yet. | `pass` | Historical P0 closure only; resolved in C0 | This records the original C0 red/green lifecycle. The current contract gate is green in the 2026-06-12 replay. |
| Release gates, browser tests, packlist, install evidence, and FR-20 proof are not runnable before a release candidate exists. | `pass` | Historical P0 closure only; later separated during Stream A strict finalization | This records the original P0 exception lifecycle. Current global release proof remains `fail` or `blocked` for browser, package, CI, install, and FR-20 evidence. |
| Existing `dist/` content is non-normative and may not match `package.json` bin layout. | `pass` | Historical P0 closure only | This records the original P0 exception lifecycle. Current `dist/` regeneration is green for Phase 1-2; packlist proof remains `blocked` in Packaging And Distribution. |

## FR-20 System-Scope Evidence

| Item | Status | Evidence / command | Notes |
| --- | --- | --- | --- |
| FR-20 evidence file present | `pass` | `docs/release-evidence/fr-20-system-scope.md` | Template exists from P0 phase 4. |
| FR-20 evidence completed for release candidate | `blocked` | `docs/release-evidence/fr-20-system-scope.md` | Only a Stream A strict simulation exists. No real elevated system-scope multi-account proof exists for the global release. |
| Command resolves by name in tested account | `pass` | `docs/release-evidence/fr-20-system-scope.md`, `where md2pdf` | Historical simulation evidence: temporary global-style npm prefix was placed on `PATH`; `where md2pdf` resolved the command by name. |
| `md2pdf --help` runs by command name in tested account | `pass` | `docs/release-evidence/fr-20-system-scope.md` | Historical simulation evidence: `md2pdf --help` exited `0` and printed the supported CLI options. |
| Secondary account or valid simulation documented | `blocked` | `docs/release-evidence/fr-20-system-scope.md` account coverage section | The simulation reason and limitations are documented, but this is not equivalent to real FR-20 release proof. |

## Packaging And Distribution

| Item | Status | Evidence / command | Notes |
| --- | --- | --- | --- |
| `dist/` regenerated from `src/` | `pass` for Phase 1-2 strict | `npm.cmd run build`; `audit/2026-06-12-phase-1-2-teamcomplete-audit.md` | Current build evidence is green and confirms `dist/pdfRenderer.*` is not regenerated after Phase 2. This is not full package/release evidence. |
| npm packlist verified | `blocked` | Historical Stream A strict packlist; global release replay pending | The 2026-06-11 packlist is historical Stream A strict evidence. It is not current release-candidate evidence until `npm pack` is replayed after the remaining release blockers are handled. |
| User-scope install works | `blocked` | Historical Stream A strict simulation evidence | The previous temporary-prefix install remains preserved as historical evidence, but it is tied to a stale tarball and cannot close the current global release. |
| Reinstall is idempotent | `blocked` | Historical Stream A strict simulation evidence | The previous reinstall proof remains preserved as historical evidence, but it is tied to a stale tarball and cannot close the current global release. |

## README And CLI Options

| Item | Status | Evidence / command | Notes |
| --- | --- | --- | --- |
| `md2pdf --help` lists supported options | `blocked` | `tests/unit/cli/cli.test.ts`, `@req NFR-04 prints one help line for each supported option` | Current unit coverage is green, but built CLI help output has not been replayed for the global release package. |
| README options match CLI help | `blocked` | `README.md`; historical `node dist\cli.js --help`; `audit.md` Stream A strict point 2 audit | Historical Stream A strict parity evidence is preserved, but current proof is blocked until built CLI help and package evidence are replayed. |
| Historical FR-20 simulation help output captured | `pass` | `docs/release-evidence/fr-20-system-scope.md` | Documentation fact only: the simulation output remains recorded. It is not release-grade FR-20 or current built-package help proof. |

## Defensive Decisions

Each defensive decision must have a test or documentation reference. Documentation
alone is acceptable only when the behavior cannot be executed before the relevant
phase exists.

| Decision | Status | Evidence / reference | Notes |
| --- | --- | --- | --- |
| Empty directory exits `0` with `0 succeeded, 0 failed, 0 skipped` | `pass` | `tests/unit/cli/cli.test.ts`, `@req FR-09 @req FR-11 keeps an empty Markdown directory successful`; `npm.cmd test` | Current Phase 1-2 unit replay is green. |
| `.MD` extension is accepted case-insensitively | `pass` | `tests/unit/paths/paths.test.ts`, `@req FR-02 accepts Markdown file extensions case-insensitively`; `tests/unit/cli/cli.test.ts`, valid single-file command; `npm.cmd test` | Current Phase 1-2 unit replay is green. |
| Explicit output extension is used verbatim | `pass` | `tests/unit/paths/paths.test.ts`, `@req FR-03 uses --output verbatim`; `tests/unit/cli/cli.test.ts`, valid single-file command; `npm.cmd test` | Current Phase 1-2 unit replay is green. |
| Output parent is created when possible | `pass` | `tests/unit/paths/paths.test.ts`, `@req FR-03 uses --output verbatim and creates a missing parent directory`; `npm.cmd test` | Current Phase 1-2 unit replay is green. |
| Output parent non-writable reports clear error | `pass` | `tests/unit/paths/paths.test.ts`, `reports non-writable output parents with output path and action hint`; `tests/unit/cli/cli.test.ts`, `@req FR-15 @req FR-17 returns exit 1 when the output parent is not writable`; `npm.cmd test` | Current Phase 7 unit replay proves the structured CLI error includes `outputPath` and `actionHint`. |
| Skipped outputs count in summary without causing failure | `pass` | `tests/unit/pipeline/pipeline.test.ts`, `@req FR-12 records non-interactive overwrite preserves as skipped outcomes`; `tests/unit/cli/cli.test.ts`, `@req FR-12 @req FR-18 reports non-interactive overwrite skips in the summary without failing`; `npm.cmd test` | Current Phase 7 unit replay proves skipped outputs are counted in stdout summary and do not make the CLI fail. |
| Duplicate entries or duplicate outputs fail preflight | `pass` | `tests/unit/paths/paths.test.ts`, duplicate entries; `tests/unit/pipeline/pipeline.test.ts`, output collisions; `tests/unit/cli/cli.test.ts`, CLI preflight collision; `npm.cmd test` | Current Phase 1-2 unit replay is green. |
| `--output-dir` basename collision blocks before render | `pass` | `tests/unit/paths/paths.test.ts`, `@req FR-23 rejects basename collisions`; `tests/unit/cli/cli.test.ts`, CLI preflight collision; `npm.cmd test` | Current Phase 1-2 unit replay is green. |
| Cache writes are atomic | `pass` | `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts`, `@req NFR-05 writes the browser cache atomically`; `npm.cmd run test:artifacts` | Current Phase 1-2 artifact replay is green. Runtime provisioning on target platforms remains release-blocking. |
| Cache non-writable reports explicit artifact/browser error | `pass` | `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts`, `@req NFR-05 reports a clear error when the cache directory is not writable`; `npm.cmd run test:artifacts` | Current Phase 1-2 artifact replay is green. Runtime provisioning on target platforms remains release-blocking. |
| C0 red then green evidence recorded | `pass` | C0 contract trace above; `npm.cmd run test:contracts` | Historical red state remains recorded, and the current contract replay is green. |
| FR-20 manual proof versioned | `pass` | FR-20 section above; `docs/release-evidence/fr-20-system-scope.md` | Documentation fact only: versioned Stream A strict simulation evidence exists. Real FR-20 release proof is `blocked`. |

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
| Release decision | Historical `GO Stream A strict`; current `GO Phase 1-2 strict`; current `NO-GO global release` until browser/release, package, CI, and FR-20 evidence are closed |
| Reviewer | `pending` |
| Decision date | Historical Stream A strict decision `2026-06-11`; post-audit global reset and Phase 1-2 strict replay `2026-06-12` |
| Blocking items remaining | Browser/integration gate, real installed-browser/Mermaid proof, fallback/provisioning evidence on target platforms, browser compatibility matrix, CI matrix, fresh tarball/packlist, install/reinstall replay, real FR-20 multi-account system-scope proof |
| Notes | Stream A strict final audit: `audit/2026-06-11-stream-a-strict-final-audit.md`. Phase 1-2 strict audit: `audit/2026-06-12-phase-1-2-teamcomplete-audit.md`. Fast local gates and build are green; global release remains `NO-GO v0.1.2`. |
