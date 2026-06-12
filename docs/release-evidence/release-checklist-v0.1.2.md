# md2pdf v0.1.2 Release Checklist

Release status: `blocked`

P0 closure status: `pass`

Post-audit Phase 0 evidence reset status: `pass`

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
| Date completed | Stream A strict completed `2026-06-11` as historical evidence; global release pending |
| Owner | `Codex` |
| Commit SHA | `b58c45775b5e25926d7567a230034576949bd603` |
| npm tarball or package source | Historical Stream A strict package evidence only: `md2pdf-0.1.2.tgz`; shasum `cc11a64ec297c708b2178727bd372f753fabee33`; integrity `sha512-KUOkmzNX9/0yaqlkpGBFWwu/WqoWHizE4Fe1xG43cuf8JQfnGmBFaA+s3uOvQRIr3cQraFXhNlqJdO9Kk6bGdw==`. This is not current global release-candidate evidence after the 2026-06-12 audit. |

## Post-Audit Phase 0 Reconciliation

This section resets the release evidence after
`audit/2026-06-12-global-project-progress-structure-problems-audit.md`.
No new technical gate was replayed for this Phase 0 reset, and no command is
claimed green here without a fresh execution record.

Audited red gates for the current repository state:

| Command | Current release status | Source | Notes |
| --- | --- | --- | --- |
| `npm.cmd run typecheck` | `fail` | `audit/2026-06-12-global-project-progress-structure-problems-audit.md` | The current TypeScript source does not compile. |
| `npm.cmd test` | `fail` | `audit/2026-06-12-global-project-progress-structure-problems-audit.md` | The global unit test gate fails in the audited state. |
| `npm.cmd run test:contracts` | `fail` | `audit/2026-06-12-global-project-progress-structure-problems-audit.md` | Contract tests fail before execution because the public contract import reaches missing runtime modules. |
| `npm.cmd run test:browser` | `fail` | `audit/2026-06-12-global-project-progress-structure-problems-audit.md` | Integration/browser gate fails before the relevant suites can prove release behavior. |
| `npm.cmd run check:artifacts` | `fail` | `audit/2026-06-12-global-project-progress-structure-problems-audit.md` | `assets/default.css` no longer matches `artifacts.json`. |

Evidence classes after this reset:

| Evidence class | Status | Meaning |
| --- | --- | --- |
| Historical Stream A strict evidence | `pass` only where explicitly scoped to Stream A strict and dated before the 2026-06-12 audit | Preserved as historical evidence; it must not be read as proof that the current global v0.1.2 gates are green. |
| Global v0.1.2 release evidence | `blocked` or `fail` | The global release remains `NO-GO` until the audited red gates and missing browser/CI evidence are resolved and rerun. |
| Simulated evidence | `blocked` for the release requirement unless the item is explicitly limited to simulation mechanics | Simulation records can remain useful, but they are not equivalent to release-grade proof. |
| Real release evidence | `pending` or `blocked` unless a current, committed run exists | Real release evidence must be tied to the current source, rebuilt `dist/`, current package, artifact gate, browser proof, and CI matrix. |

The previous `pass` rows below are either historical Stream A strict evidence or
specific unit-level facts. The current release gate rows are reset in
"Automated Release Gates" and related sections so this checklist no longer
claims that the current repository is globally green.

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
| Contract test red state observed | `pass` | `audit/audit-c0-etape4.md`, lines 25 and 87-90 | Historical C0 step 4 captured the red contract gate: `npm run test:contracts` failed with missing script before steps 5-6 existed. |
| Contract gate green after C0 | `fail` | `npm.cmd run test:contracts`; `audit/2026-06-12-global-project-progress-structure-problems-audit.md` | Historical C0 commands passed on 2026-06-04, but the current audited repository fails because contract import reaches missing runtime modules. |
| `ConversionOutcome extends ConversionJob` verified | `pass` | `tests/unit/contracts/contracts.test.ts`, `instantiates conversion contracts with the expected fields` | Verifies `sourcePath`, `outputPath`, `originEntry`, status, and typed error context. |
| Shared error contracts importable and formattable | `fail` | `npm.cmd run test:contracts`; `audit/2026-06-12-global-project-progress-structure-problems-audit.md` | The historical test intent is preserved, but current contract importability is not proven because the gate fails before execution. |

## Automated Release Gates

| Item | Status | Evidence / command | Notes |
| --- | --- | --- | --- |
| TypeScript typecheck | `fail` | `npm.cmd run typecheck`; `audit/2026-06-12-global-project-progress-structure-problems-audit.md` | The 2026-06-11 Stream A strict pass is historical. The current audited source does not compile. |
| Unit tests | `fail` | `npm.cmd test`; `audit/2026-06-12-global-project-progress-structure-problems-audit.md` | The 2026-06-11 Stream A strict pass is historical. The current audited global test gate fails. |
| Contract tests | `fail` | `npm.cmd run test:contracts`; `audit/2026-06-12-global-project-progress-structure-problems-audit.md` | Earlier passes are historical. The current audited contract gate fails before executing tests because missing runtime modules are imported. |
| Integration tests | `fail` | `npm.cmd run test:browser`; `audit/2026-06-12-global-project-progress-structure-problems-audit.md` | Earlier Stream A integration evidence is historical. The current audited browser/integration gate does not start cleanly. |
| Browser-backed tests | `blocked` | Stream B / global release evidence required | Real installed-browser, Mermaid-as-diagram, WebDriver/Firefox, fallback provisioning, and browser-family compatibility evidence are outside Stream A strict. |
| Artifact freshness gate | `fail` | `npm.cmd run check:artifacts`; `audit/2026-06-12-global-project-progress-structure-problems-audit.md` | Earlier artifact passes are historical. The current audited gate fails because `assets/default.css` does not match `artifacts.json`. |
| CI matrix | `blocked` | Global release CI run URL, logs, or committed summary | Linux, macOS, Windows on Node.js 20+. This remains global release evidence, not a Stream A strict implementation task. |

## Accepted Pre-C0 Exceptions

These exceptions are acceptable for closing P0 only. They remain blockers for
C0, P4, or the release candidate as indicated.

| Exception | Status | Applies until | Required resolution |
| --- | --- | --- | --- |
| `npm run typecheck` fails with `TS18003` because `src/**/*.ts` does not exist. | `pass` | Resolved in C0 | C0 contract source/stubs now exist and `npm run typecheck` passed on 2026-06-04. |
| C0 red/green contract evidence is not available yet. | `pass` | Resolved in C0 | Red gate captured in `audit/audit-c0-etape4.md`; green gate captured with `npm run typecheck` and `npm run test:contracts` on 2026-06-04. |
| Release gates, browser tests, packlist, install evidence, and FR-20 proof are not runnable before a release candidate exists. | `pass` | Resolved or separated during Stream A strict finalization | FR-20 simulation and install evidence are versioned; final pack replay is tracked in Point 5; real browser/rendering evidence is explicitly Stream B/global release scope. |
| Existing `dist/` content is non-normative and may not match `package.json` bin layout. | `pass` | Stream A Phase 6, 2026-06-09 | Resolved by `npm.cmd run build` and `npm.cmd pack --json`; `package.json` maps `bin.md2pdf` to `./dist/cli.js`, and the packlist includes the built `dist/cli.js`. |

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
| `dist/` regenerated from `src/` | `blocked` | `audit/2026-06-12-global-project-progress-structure-problems-audit.md` | The 2026-06-09 build evidence is historical. The current audited source cannot regenerate `dist/` because earlier gates are red. |
| npm packlist verified | `blocked` | `audit/2026-06-12-global-project-progress-structure-problems-audit.md` | The 2026-06-11 packlist is historical Stream A strict evidence. It is not current release-candidate evidence while typecheck and artifact freshness are red. |
| User-scope install works | `blocked` | Historical Stream A strict simulation evidence | The previous temporary-prefix install remains preserved as historical evidence, but it is tied to a stale tarball and cannot close the current global release. |
| Reinstall is idempotent | `blocked` | Historical Stream A strict simulation evidence | The previous reinstall proof remains preserved as historical evidence, but it is tied to a stale tarball and cannot close the current global release. |

## README And CLI Options

| Item | Status | Evidence / command | Notes |
| --- | --- | --- | --- |
| `md2pdf --help` lists supported options | `pass` | `tests/unit/cli/cli.test.ts`, `@req NFR-04 prints one help line for each supported option` | Unit proof covers CLI help formatting. Built-package help output remains part of P4 packaging evidence. |
| README options match CLI help | `pass` | `README.md`; `node dist\cli.js --help`; `audit.md` Stream A strict point 2 audit | README documents `ENTRY`, `--output`, `--output-dir`, `--force-overwrite`, and `--help`; it does not document a nonexistent `--browser` option. |
| FR-20 help output captured | `pass` | `docs/release-evidence/fr-20-system-scope.md` | Help output from the tested Stream A strict simulation context is recorded. |

## Defensive Decisions

Each defensive decision must have a test or documentation reference. Documentation
alone is acceptable only when the behavior cannot be executed before the relevant
phase exists.

| Decision | Status | Evidence / reference | Notes |
| --- | --- | --- | --- |
| Empty directory exits `0` with `0 succeeded, 0 failed, 0 skipped` | `pass` | `tests/unit/cli/cli.test.ts`, `@req FR-09 @req FR-11 keeps an empty Markdown directory successful` | From plan v0.1.2 defensive decisions. |
| `.MD` extension is accepted case-insensitively | `pass` | `tests/unit/paths/paths.test.ts`, `@req FR-02 accepts Markdown file extensions case-insensitively`; `tests/unit/cli/cli.test.ts`, valid single-file command | From plan v0.1.2 defensive decisions. |
| Explicit output extension is used verbatim | `pass` | `tests/unit/paths/paths.test.ts`, `@req FR-03 uses --output verbatim`; `tests/unit/cli/cli.test.ts`, valid single-file command | README documentation remains a P4 item. |
| Output parent is created when possible | `pass` | `tests/unit/paths/paths.test.ts`, `@req FR-03 uses --output verbatim and creates a missing parent directory` | From plan v0.1.2 defensive decisions. |
| Output parent non-writable reports clear error | `pending` | Stream A test | Must include `outputPath` and `actionHint`. |
| Skipped outputs count in summary without causing failure | `pending` | Stream A test | From plan v0.1.2 defensive decisions. |
| Duplicate entries or duplicate outputs fail preflight | `pass` | `tests/unit/paths/paths.test.ts`, duplicate entries; `tests/unit/pipeline/pipeline.test.ts`, output collisions; `tests/unit/cli/cli.test.ts`, CLI preflight collision | Includes duplicates and output collisions. |
| `--output-dir` basename collision blocks before render | `pass` | `tests/unit/paths/paths.test.ts`, `@req FR-23 rejects basename collisions`; `tests/unit/cli/cli.test.ts`, CLI preflight collision | Example: `a/report.md` and `b/report.md`. |
| Cache writes are atomic | `pass` | `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts`, `@req NFR-05 writes the browser cache atomically` | `.tmp` then atomic rename after checksum verification. Implemented in `src/fallbackBrowserProvisioner.ts`. |
| Cache non-writable reports explicit artifact/browser error | `pass` | `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts`, `@req NFR-05 reports a clear error when the cache directory is not writable` | Throws `ArtifactCacheError` with `actionHint`. Implemented in `src/fallbackBrowserProvisioner.ts`. |
| C0 red then green evidence recorded | `pass` | C0 contract trace above | Required C0 proof is now recorded. |
| FR-20 manual proof versioned | `pass` | FR-20 section above; `docs/release-evidence/fr-20-system-scope.md` | Versioned Stream A strict simulation evidence is present. |

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
| Release decision | Historical `GO Stream A strict`; current `NO-GO global release` after the 2026-06-12 audited red gates |
| Reviewer | `pending` |
| Decision date | Historical Stream A strict decision `2026-06-11`; post-audit global reset `2026-06-12` |
| Blocking items remaining | Current typecheck, unit tests, contract tests, browser/integration gate, artifact freshness, regenerated `dist/`, fresh tarball, real installed-browser/Mermaid proof, fallback/provisioning evidence, browser compatibility matrix, CI matrix, real FR-20 multi-account system-scope proof |
| Notes | Stream A strict final audit: `audit/2026-06-11-stream-a-strict-final-audit.md`. The 2026-06-12 global audit supersedes any reading of those historical passes as current global release readiness. Global release remains `NO-GO v0.1.2`. |
