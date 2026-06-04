# md2pdf v0.1.2 Release Checklist

Status: `pending`

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
| Checklist status | `pending` |
| Date opened | `2026-06-04` |
| Date completed | `pending` |
| Owner | `pending` |
| Commit SHA | `pending` |
| npm tarball or package source | `pending` |

## P0 Scope Check

These items prove that P0 stayed documentary before C0.

| Item | Status | Evidence / command | Notes |
| --- | --- | --- | --- |
| Phase 1 review exists | `pass` | `docs/p0_phase1_initial_review_v0.1.2.md` | Cadrage and initial divergence list created. |
| Phase 2 architecture alignment exists | `pass` | `docs/architecture.md` section 16 | P0 alignment checklist added to architecture. |
| Phase 3 release evidence README exists | `pass` | `docs/release-evidence/README.md` | Evidence rules and statuses defined. |
| Phase 4 FR-20 template exists | `pass` | `docs/release-evidence/fr-20-system-scope.md` | Template created with `pending` placeholders. |
| No C0 source work started during P0 | `pending` | `git status --short` or PR diff summary | Must show no `src/`, contract tests, implementation scripts, or `dist/` regeneration introduced by P0. |
| `docs/architecture.md` no longer diverges from plan v0.1.2 | `pending` | Architecture section 16 plus reviewer sign-off | Must be confirmed after all P0 docs are present. |

## P0 Gate

| Item | Status | Evidence / command | Expected Result | Observed Result |
| --- | --- | --- | --- | --- |
| Typecheck gate attempted | `blocked` | `npm.cmd run typecheck` | Either passes, or P0 exception is recorded because `src/` does not exist before C0. | `TS18003: No inputs were found` observed before C0 because `src/**/*.ts` does not exist. |

## C0 Contract Trace

| Item | Status | Evidence / command | Notes |
| --- | --- | --- | --- |
| Contract test red state observed | `pending` | Commit, log, or note of failing contract test | Required before marking C0 complete. |
| Contract gate green after C0 | `pending` | `npm run typecheck` and `npm run test:contracts` | Required after C0 contracts/stubs exist. |
| `ConversionOutcome extends ConversionJob` verified | `pending` | Contract test import or type assertion | Must preserve `sourcePath`, `outputPath`, `originEntry`, and `options`. |
| Shared error contracts importable and formattable | `pending` | Contract test | Must cover stable context fields, not message parsing. |

## Automated Release Gates

| Item | Status | Evidence / command | Notes |
| --- | --- | --- | --- |
| TypeScript typecheck | `pending` | `npm run typecheck` | Required for release candidate. |
| Unit tests | `pending` | `npm test` or scoped unit command | Include requirement tags where applicable. |
| Contract tests | `pending` | `npm run test:contracts` | Required after C0. |
| Integration tests | `pending` | Integration test command | Required before release. |
| Browser-backed tests | `pending` | `npm run test:browser` or equivalent | Must prove at least one real PDF and Mermaid as diagram. |
| Artifact freshness gate | `pending` | `npm run check:artifacts` or equivalent | Must enforce `ARTIFACT_FRESHNESS_POLICY.md` and `artifacts.json`. |
| CI matrix | `pending` | CI run URL, logs, or committed summary | Linux, macOS, Windows on Node.js 20+. |

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
| `md2pdf --help` lists supported options | `pending` | Help output from built package | Covers NFR-04. |
| README options match CLI help | `pending` | Review note or comparison output | README must not document stale or missing CLI options. |
| FR-20 help output captured | `pending` | `fr-20-system-scope.md` | Should be the output from the tested system-scope account context. |

## Defensive Decisions

Each defensive decision must have a test or documentation reference. Documentation
alone is acceptable only when the behavior cannot be executed before the relevant
phase exists.

| Decision | Status | Evidence / reference | Notes |
| --- | --- | --- | --- |
| Empty directory exits `0` with `0 succeeded, 0 failed, 0 skipped` | `pending` | Stream A test | From plan v0.1.2 defensive decisions. |
| `.MD` extension is accepted case-insensitively | `pending` | Stream A test | From plan v0.1.2 defensive decisions. |
| Explicit output extension is used verbatim | `pending` | Stream A test and README | From plan v0.1.2 defensive decisions. |
| Output parent is created when possible | `pending` | Stream A test | From plan v0.1.2 defensive decisions. |
| Output parent non-writable reports clear error | `pending` | Stream A test | Must include `outputPath` and `actionHint`. |
| Skipped outputs count in summary without causing failure | `pending` | Stream A test | From plan v0.1.2 defensive decisions. |
| Duplicate entries or duplicate outputs fail preflight | `pending` | Stream A test | Includes duplicates and output collisions. |
| `--output-dir` basename collision blocks before render | `pending` | Stream A test | Example: `a/report.md` and `b/report.md`. |
| Cache writes are atomic | `pending` | Stream B artifact test | `.tmp` then atomic rename after verification. |
| Cache non-writable reports explicit artifact/browser error | `pending` | Stream B artifact test | Must not become a generic failure. |
| C0 red then green evidence recorded | `pending` | C0 contract trace above | Required for C0 proof. |
| FR-20 manual proof versioned | `pending` | FR-20 section above | Required for release. |

## Architecture Alignment

| Item | Status | Evidence / reference | Notes |
| --- | --- | --- | --- |
| Public contracts documented | `pass` | `docs/architecture.md` section 4 | Includes `ConvertOptions`, `ConversionJob`, `ConversionOutcome`, `convertFile`. |
| `ConversionOutcome extends ConversionJob` documented | `pass` | `docs/architecture.md` section 4 | Corrected after phase 1/2 audit. |
| Browser/artifact responsibilities separated | `pass` | `docs/architecture.md` sections 5, 11, 13 | `BrowserLocator`, `ReleaseCatalog`, `ArtifactPolicy`, `FallbackBrowserProvisioner`. |
| Chromium-for-Testing fallback constrained by policy | `pass` | `docs/architecture.md` sections 11, 13, 14 | Last resort, declared artifact, `newest eligible`, SHA-256, freshness. |
| Provisioning vs conversion local-only boundary documented | `pass` | `docs/architecture.md` sections 9, 14 | Conversion remains local-only from pre-provisioned state. |
| Remaining architecture audit questions resolved or accepted | `pending` | `audit.md` phase 1/2 and phase 4 audit sections | Must review before C0. |

## Final Release Decision

| Field | Value |
| --- | --- |
| Release decision | `pending` |
| Reviewer | `pending` |
| Decision date | `pending` |
| Blocking items remaining | `pending` |
| Notes | `pending` |
