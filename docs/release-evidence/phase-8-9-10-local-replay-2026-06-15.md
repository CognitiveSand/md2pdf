# Phase 8-10 Local Release Replay Evidence

Status: `pass` for local Phase 8 packaging and Phase 10 gates; `blocked` for
global release because Phase 9 FR-20 multi-account system-scope proof and CI
matrix proof remain absent.

## Metadata

| Field | Value |
| --- | --- |
| md2pdf version tested | `0.1.2` |
| Date | `2026-06-15` |
| Author | `Codex` |
| Commit SHA | Base commit `72c69ba` plus current worktree changes for Windows package smoke, real-browser cache alignment, evidence refresh, rebuilt tarball |
| OS and exact version | Microsoft Windows 11 Famille 25H2, version `10.0.26200.8655` |
| CPU architecture | `x64` |
| Node.js version | `v24.16.0` |
| npm version | `11.13.0` |
| Shell/account | Windows PowerShell, account `gabriel-pc\codexsandboxoffline` |
| npm tarball | `md2pdf-0.1.2.tgz` |
| Tarball shasum | `970226a520e446e6e137d678392ff2da70448ab4` |
| Tarball integrity | `sha512-7Tlo4xQqDFocfFQMeQageLU6L+oCOlK70VdU8ldGrXWy/lhe/UHvcywR7CwT0VlS4lKeXMt1in5JDbbsK0YuOg==` |
| Tarball entry count | `62` |
| Tarball unpacked size | `277 465` bytes |

## Commands

```bash
npm.cmd run build
npm.cmd pack --dry-run --json --ignore-scripts --cache .tmp\npm-cache
npm.cmd run release:verify
Get-FileHash md2pdf-0.1.2.tgz -Algorithm SHA1
```

`npm.cmd run release:verify` expands to:

```bash
npm run test:all && npm run check:package
```

`npm run test:all` expands to:

```bash
npm run typecheck
npm test
npm run test:artifacts
npm run check:artifacts
npm run build
npm run test:browser
npm run test:real-browser
```

`npm.cmd run check:package` runs `scripts/checkPackage.mjs`, which:

- runs `npm pack --json --cache .tmp\npm-cache`;
- verifies required packlist entries;
- rejects orphan `dist/` outputs whose `src/*.ts` source no longer exists;
- installs the tarball into a temporary user-scope prefix;
- verifies the installed Windows `md2pdf.cmd` shim exists and the installed
  package contains `node_modules/md2pdf/dist/cli.js`; on POSIX the same script
  verifies the `bin/md2pdf` symlink target;
- runs installed `md2pdf --help`;
- reinstalls the same tarball into the same temporary prefix;
- runs installed `md2pdf --help` again.

## Expected Result

- `dist/` is deleted before `tsc` and regenerated from `src/`.
- No `dist/pdfRenderer.*` output exists or appears in the packlist.
- `prepack` runs the local essential gate `npm run test:all`.
- `npm run release:verify` exits `0`.
- Package smoke installs and reinstalls the same tarball successfully.
- Installed `md2pdf --help` prints the supported CLI options.

## Observed Result

| Check | Observed result |
| --- | --- |
| `npm.cmd run build` | PASS; `clean` removed `dist/` before `tsc` |
| `dist/pdfRenderer.*` after clean build | Absent |
| `npm.cmd pack --dry-run --json --ignore-scripts --cache .tmp\npm-cache` | PASS; `entryCount: 62`; no `dist/pdfRenderer.*` |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd test` | PASS; 155 passed, 4 skipped |
| `npm.cmd run test:artifacts` | PASS; 23 passed, 1 skipped |
| `npm.cmd run check:artifacts` | PASS; Artifact freshness policy passed |
| `npm.cmd run test:browser` | PASS; 25 passed |
| `npm.cmd run test:real-browser` | PASS; 1 passed |
| `npm.cmd run check:package` | PASS; install added 123 packages, reinstall changed 123 packages |
| `Get-FileHash md2pdf-0.1.2.tgz -Algorithm SHA1` | `970226a520e446e6e137d678392ff2da70448ab4` |

`npm.cmd run release:verify` final package-smoke output:

```text
added 123 packages in 16s
changed 123 packages in 18s
Package smoke passed: md2pdf-0.1.2.tgz
entryCount: 62
shasum: 970226a520e446e6e137d678392ff2da70448ab4
integrity: sha512-7Tlo4xQqDFocfFQMeQageLU6L+oCOlK70VdU8ldGrXWy/lhe/UHvcywR7CwT0VlS4lKeXMt1in5JDbbsK0YuOg==
```

## Packlist

```text
ARTIFACT_FRESHNESS_POLICY.md
README.md
artifacts.json
assets/default.css
assets/highlight.css
dist/artifactPolicy.d.ts
dist/artifactPolicy.d.ts.map
dist/artifactPolicy.js
dist/artifactPolicy.js.map
dist/browserLocator.d.ts
dist/browserLocator.d.ts.map
dist/browserLocator.js
dist/browserLocator.js.map
dist/cli.d.ts
dist/cli.d.ts.map
dist/cli.js
dist/cli.js.map
dist/contracts.d.ts
dist/contracts.d.ts.map
dist/contracts.js
dist/contracts.js.map
dist/converter.d.ts
dist/converter.d.ts.map
dist/converter.js
dist/converter.js.map
dist/errors.d.ts
dist/errors.d.ts.map
dist/errors.js
dist/errors.js.map
dist/fallbackBrowserProvisioner.d.ts
dist/fallbackBrowserProvisioner.d.ts.map
dist/fallbackBrowserProvisioner.js
dist/fallbackBrowserProvisioner.js.map
dist/markdownRenderer.d.ts
dist/markdownRenderer.d.ts.map
dist/markdownRenderer.js
dist/markdownRenderer.js.map
dist/overwrite.d.ts
dist/overwrite.d.ts.map
dist/overwrite.js
dist/overwrite.js.map
dist/paths.d.ts
dist/paths.d.ts.map
dist/paths.js
dist/paths.js.map
dist/pipeline.d.ts
dist/pipeline.d.ts.map
dist/pipeline.js
dist/pipeline.js.map
dist/releaseCatalog.d.ts
dist/releaseCatalog.d.ts.map
dist/releaseCatalog.js
dist/releaseCatalog.js.map
dist/webDriverClient.d.ts
dist/webDriverClient.d.ts.map
dist/webDriverClient.js
dist/webDriverClient.js.map
dist/webDriverSession.d.ts
dist/webDriverSession.d.ts.map
dist/webDriverSession.js
dist/webDriverSession.js.map
package.json
```

## Phase 9 Status

This local replay does not satisfy FR-20 global release evidence. A temporary
user-scope prefix proves package invocability and reinstall idempotence for the
current account only. It is not a real elevated system-scope installation and
does not prove visibility from a secondary user account.

CI/matrix evidence is also still blocked: this repository has
`docs/ci_matrix_v0.1.md`, but no current Linux/macOS/Windows CI run URL, logs,
or committed result summary for the Phase 10 gate.

## Phase 10 Decision

Local Phase 10 gates are green. Global v0.1.2 remains `NO-GO` until these
release-grade proofs are added:

- CI/browser-family matrix across target platforms;
- real FR-20 system-scope multi-account proof.
