# Security Hardening Phase 0 Baseline

## Metadata

- md2pdf version tested: `0.1.2`
- Date: `2026-06-22`
- Commit SHA at baseline: `c94bb43d3e081d71d53173507d06d0176f404be9`
- OS: `Microsoft Windows NT 10.0.26200.0`
- Node.js: `v24.16.0`
- npm: `11.13.0`
- Author: Codex
- Status: `pass`

## Automatic Baseline

| Command | Expected result | Observed result | Status |
| --- | --- | --- | --- |
| `npm.cmd run typecheck` | TypeScript succeeds. | `tsc --noEmit` completed successfully. | `pass` |
| `npm.cmd test -- tests/integration/converter.test.ts -t "stops the driver process when timeout fires during session start"` | Former intermittent timeout test succeeds deterministically. | 1 file passed, 1 test passed, 8 skipped. | `pass` |
| `npm.cmd test` | Unit and integration suite succeeds. | 16 files passed, 179 tests passed, 2 skipped. | `pass` |
| `npm.cmd run test:artifacts` | Artifact tests succeed. | 2 files passed, 23 tests passed, 1 skipped. | `pass` |
| `npm.cmd run check:artifacts` | Artifact freshness policy succeeds. | `Artifact freshness policy passed.` | `pass` |

Supplemental check after sharing the PNG fixture with browser-backed tests:
`npm.cmd run test:browser` passed with 3 files and 25 tests.

## Artifact Decision

No third-party dependency, package lock entry, runtime driver, browser binary,
remote asset, vendored asset, or provisioned artifact was added or changed for
Phase 0.

The Phase 0 test helpers added inline synthetic image buffers only. They do not
select, download, provision, vendor, lock, or reference any third-party artifact.
`tests/fixtures/imageFixtures.ts` carries the same provenance note in code so
the fixture bytes are not mistaken for external assets.

## Tests Identified For Later Hardening Phases

- `tests/unit/markdownRenderer/markdownRenderer.test.ts`: the current `@req NFR-02 emits no exploitable external resource URLs` expectation removes `href` from HTTPS anchors. Phase 6 must update this so HTTPS links remain passive and clickable while HTTP, dangerous schemes, and local absolute/root-relative links are blocked.
- `tests/unit/markdownRenderer/markdownRenderer.test.ts`: SVG is not yet covered by a deny-by-format test. Phase 3 must add simple SVG and hostile SVG variants and require rejection before content parsing.

## Phase 0 Test Fixtures

`tests/fixtures/imageFixtures.ts` now centralizes Markdown image fixture helpers:

- `tinyPng()`;
- `tinyJpeg()`;
- `tinyWebp()`;
- `deceptiveImageBytes()`;
- `syntheticOversizedImageBytes(byteLength)`.

`tests/unit/markdownRenderer/markdownRenderer.test.ts` now verifies that local
PNG, JPEG, and WebP raster fixtures embed as data URIs, preserving the expected
good path before hostile-image rejection phases begin.

## Reproducibility Notes

The timeout test in `tests/integration/converter.test.ts` was stabilized after
the audit by replacing absolute timer ordering with explicit synchronization:
the test now waits for WebDriver startup to enter, lets the render timeout
reject conversion, then releases startup and waits for driver cleanup.
