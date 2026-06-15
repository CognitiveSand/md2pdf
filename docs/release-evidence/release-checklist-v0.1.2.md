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
| Date completed | Stream A strict completed `2026-06-11` as historical evidence; Phase 1-2 strict replay passed `2026-06-12`; Phase 8 packaging and full local `test:all` replay passed `2026-06-15`; global release pending |
| Owner | `Codex` |
| Commit SHA | Historical Stream A strict commit `b58c45775b5e25926d7567a230034576949bd603`; Phase 8 evidence tied to base commit `7fa612b` plus current worktree changes to packaging scripts, CLI symlink entrypoint handling, CLI regression tests, rebuilt `dist/`, and tarball |
| npm tarball or package source | Phase 8 current tarball: `md2pdf-0.1.2.tgz`; shasum `19fccd38288d9ef091a95cabf89c836f3ffe3ee0`; integrity `sha512-v+nQdtF7laHFc6BvFhaQYj5zRk9J7mgqUTENXgBL/lQXsBh75NaDxZ1WcYJ4dFeKtckAFsPW7ayP1uMyGsU5Iw==`; packed `2026-06-15`; 62 files, 276 820 bytes unpacked. |

## Post-Audit Phase 0 Reconciliation

This section resets the release evidence after
`audit/2026-06-12-global-project-progress-structure-problems-audit.md`.
The original Phase 0 reset did not replay technical gates. Later Phase 1 and
Phase 2 strict replays supersede the old red status for the fast local gates
listed below. Phase 8 then replays current package, packlist, user-scope
install, reinstall, browser, and real-browser evidence. These local passes do
not close CI/matrix or FR-20.

Audited gates and post-merge replay status:

| Command | Current release status | Source | Notes |
| --- | --- | --- | --- |
| `npm run typecheck` | `pass` | Current 2026-06-15 Phase 8 replay | Typecheck passed after packaging/CLI changes. |
| `npm test` | `pass` | Current 2026-06-15 Phase 8 replay | Phase 8 replay passed: 158 passed, 1 skipped. |
| `npm.cmd run test:contracts` | `pass` | Current 2026-06-12 checklist update; `audit/2026-06-12-phase-1-post-corrections-teamcomplete-audit.md` | Contract replay passed: 15 tests. |
| `npm run test:browser` | `pass` | Current 2026-06-15 Phase 8 replay outside sandbox | Browser integration replay passed: 25 tests. The sandboxed attempt failed with `listen EPERM 127.0.0.1`, then passed outside sandbox. |
| `npm run test:real-browser` | `pass` | Current 2026-06-15 Phase 8 replay outside sandbox | Real installed-browser Mermaid smoke passed: 1 test. |
| `npm run test:artifacts` | `pass` | Current 2026-06-15 Phase 8 replay via `npm run test:all` | Artifact unit replay passed: 24 tests. |
| `npm run check:artifacts` | `pass` | Current 2026-06-15 Phase 8 replay | Artifact freshness policy passed. This local pass does not make the global release ready by itself. |
| `npm run build` | `pass` | Current 2026-06-15 Phase 8 replay | `dist/` regenerates from the current source and does not recreate `dist/pdfRenderer.*`. |
| `npm run test:all` | `pass` | Current 2026-06-15 Phase 8 replay outside sandbox | Executes typecheck, unit tests, artifact tests, artifact freshness, build, browser integration, and real-browser smoke. |

Evidence classes after this reset:

| Evidence class | Status | Meaning |
| --- | --- | --- |
| Historical Stream A strict evidence | `pass` only where explicitly scoped to Stream A strict and dated before the 2026-06-12 audit | Preserved as historical evidence; it must not be read as proof that the current global v0.1.2 gates are green. |
| Global v0.1.2 release evidence | `blocked` | The global release remains `NO-GO` until CI/matrix and FR-20 evidence are resolved and rerun. |
| Simulated evidence | `blocked` for the release requirement unless the item is explicitly limited to simulation mechanics | Simulation records can remain useful, but they are not equivalent to release-grade proof. |
| Real release evidence | `pending` or `blocked` unless a current, committed run exists | Real release evidence must be tied to the current source, rebuilt `dist/`, current package, artifact gate, browser proof, and CI matrix. |

Current Phase 1-2 `pass` rows are limited to the replayed fast local gates and
build evidence recorded on 2026-06-12. Other `pass` rows remain documentation
facts, historical observations, or explicitly scoped simulation mechanics.
Package-backed and browser-backed Phase 8 claims are current for the local
worktree. CI-backed, FR-20, and release-candidate claims remain `blocked` until
the relevant fresh command run proves them again.

Former `pass` rows reset by post-audit Phase 0:

| Checklist area | Former claim | Current release status | Reason |
| --- | --- | --- | --- |
| C0 contract trace | Contract shape and shared errors verified by tests | `pass` for the current Phase 1-2 strict worktree | `npm.cmd run test:contracts` is green in the current 2026-06-12 replay. |
| Automated release gates | Typecheck, unit, contract, artifact, build, integration, and browser gates | `pass` for current local Phase 8 gates | Fast local gates, browser integration, and real-browser smoke are current and green. CI matrix evidence remains blocked. |
| FR-20 system-scope | Release candidate FR-20 completed | `blocked` | Only a Stream A strict simulation exists; no real system-scope multi-account proof exists. |
| Packaging and distribution | `dist/`, packlist, install, reinstall | `pass` for Phase 8 local package evidence | Current `dist/` regeneration, packlist, user-scope install, and reinstall are green for the Phase 8 worktree. |
| README and CLI options | Built CLI help and README/help parity | `pass` for built/package help output; README parity historical | `node dist/cli.js --help` and installed `.tmp/phase8-final-prefix/bin/md2pdf --help` both print the supported options. |
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
| TypeScript typecheck | `pass` | `npm run typecheck`; current 2026-06-15 Phase 8 replay | Current Phase 8 replay passed. |
| Unit tests | `pass` | `npm test`; current 2026-06-15 Phase 8 replay | Current Phase 8 replay passed: 158 passed, 1 skipped. |
| Contract tests | `pass` | `npm.cmd run test:contracts`; current 2026-06-12 checklist update | Current replay passed: 15 tests. |
| Integration tests | `pass` | `npm run test:browser`; current 2026-06-15 Phase 8 replay outside sandbox | Browser integration passed: 25 tests. |
| Browser-backed tests | `pass` for Phase 8 local browser evidence | `npm run test:browser`; `npm run test:real-browser`; `npm run test:all` | Local browser integration passed: 25 browser tests plus 1 real-browser Mermaid smoke. Cross-platform browser-family and CI matrix evidence remain separate release blockers. |
| Artifact freshness gate | `pass` | `npm run check:artifacts`; current 2026-06-15 Phase 8 replay | Artifact freshness policy passed. This does not close CI, FR-20, or global release evidence blockers. |
| Build / `dist` regeneration | `pass` | `npm run build`; current 2026-06-15 Phase 8 replay | Current build passes and does not recreate `dist/pdfRenderer.*` after Phase 2 removed `src/pdfRenderer.ts`. |
| CI matrix | `blocked` | Global release CI run URL, logs, or committed summary | Linux, macOS, Windows on Node.js 20+. This remains global release evidence, not a Stream A strict implementation task. |

## Accepted Pre-C0 Exceptions

These exceptions are acceptable for closing P0 only. They remain blockers for
C0, P4, or the release candidate as indicated.

| Exception | Status | Applies until | Required resolution |
| --- | --- | --- | --- |
| `npm run typecheck` fails with `TS18003` because `src/**/*.ts` does not exist. | `pass` | Historical P0 closure only; resolved in C0 | This records the original P0 exception lifecycle. The current typecheck gate is green in the Phase 1-2 replay above. |
| C0 red/green contract evidence is not available yet. | `pass` | Historical P0 closure only; resolved in C0 | This records the original C0 red/green lifecycle. The current contract gate is green in the 2026-06-12 replay. |
| Release gates, browser tests, packlist, install evidence, and FR-20 proof are not runnable before a release candidate exists. | `pass` | Historical P0 closure only; later separated during Stream A strict finalization | This records the original P0 exception lifecycle. Current Phase 8 package/install/browser evidence is green; global release proof remains `blocked` for CI/matrix and FR-20 evidence. |
| Existing `dist/` content is non-normative and may not match `package.json` bin layout. | `pass` | Historical P0 closure only | This records the original P0 exception lifecycle. Current `dist/` regeneration and packlist proof are green for Phase 8 local package evidence. |

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
| `dist/` regenerated from `src/` | `pass` for Phase 8 local package evidence | `npm run build`; `npm pack --json --cache .tmp/npm-cache` prepack replay | Current build evidence is green and confirms `dist/pdfRenderer.*` is not regenerated after Phase 2. |
| npm packlist verified | `pass` for Phase 8 local package evidence | `npm pack --json --cache .tmp/npm-cache` | Tarball `md2pdf-0.1.2.tgz` contains 62 files including `dist/`, `assets/`, `README.md`, `ARTIFACT_FRESHNESS_POLICY.md`, `artifacts.json`, and `package.json`. |
| User-scope install works | `pass` for Phase 8 local package evidence | `npm install --global --prefix .tmp/phase8-final-prefix --cache .tmp/npm-cache ./md2pdf-0.1.2.tgz --no-audit --no-fund --fetch-timeout=5000 --fetch-retries=0`; `.tmp/phase8-final-prefix/bin/md2pdf --help` | Install added 123 packages and the installed symlink printed the CLI help. Initial sandboxed dependency resolution failed with `ENOTFOUND`; rerun with approved network access populated the local cache. |
| Reinstall is idempotent | `pass` for Phase 8 local package evidence | Repeated `npm install --global --prefix .tmp/phase8-final-prefix --cache .tmp/npm-cache ./md2pdf-0.1.2.tgz --no-audit --no-fund --fetch-timeout=5000 --fetch-retries=0` | Reinstall completed with `changed 123 packages in 2s`; post-reinstall `.tmp/phase8-final-prefix/bin/md2pdf --help` still printed the CLI help. |

## README And CLI Options

| Item | Status | Evidence / command | Notes |
| --- | --- | --- | --- |
| `md2pdf --help` lists supported options | `pass` for Phase 8 local package evidence | `node dist/cli.js --help`; `.tmp/phase8-final-prefix/bin/md2pdf --help`; `tests/unit/cli/cli.test.ts`, `@req NFR-04 prints one help line for each supported option` | Current unit, built CLI, and installed package help output are green. |
| README options match CLI help | `pass` for Phase 8 local package evidence | `README.md`; `node dist/cli.js --help`; `.tmp/phase8-final-prefix/bin/md2pdf --help` | README usage lists the same supported options as the current built and installed CLI help. |
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
| Release decision | Historical `GO Stream A strict`; current `GO Phase 1-2 strict`; current `GO Phase 8 local packaging and browser replay`; current `NO-GO global release` until CI/matrix and FR-20 evidence are closed |
| Reviewer | `pending` |
| Decision date | Historical Stream A strict decision `2026-06-11`; post-audit global reset and Phase 1-2 strict replay `2026-06-12` |
| Blocking items remaining | CI matrix and browser-family matrix across target platforms; real FR-20 multi-account system-scope proof |
| Notes | Stream A strict final audit: `audit/2026-06-11-stream-a-strict-final-audit.md`. Phase 1-2 strict audit: `audit/2026-06-12-phase-1-2-teamcomplete-audit.md`. Phase 7 old-runtime test review found no obsolete runtime-only tests to delete. Phase 8 found and fixed POSIX npm symlink invocability before final package replay. Fast local gates, build, packlist, user-scope install, reinstall, browser integration, and real-browser smoke are green; global release remains `NO-GO v0.1.2` pending CI/matrix and FR-20. |
