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
| Commit SHA | Base commit `3f2ff86` plus current worktree changes for clean build, package smoke, evidence refresh, rebuilt tarball |
| OS and exact version | macOS `26.5` build `25F71` |
| CPU architecture | `arm64` |
| Node.js version | `v24.16.0` |
| npm version | `11.13.0` |
| Shell/account | `zsh`, account `samirtamboura` |
| npm tarball | `md2pdf-0.1.2.tgz` |
| Tarball shasum | `bf78b0eeeb9a9898fe2e9fddd3551d5730f356cd` |
| Tarball integrity | `sha512-TCb5FKFpI7c19aCMdTXPcUnE64phs4+hS+NJObdsPDsI6V0XNm0KPr499j6jw9FOyYTwNU+G58OQ4D4nChRxrw==` |
| Tarball entry count | `62` |
| Tarball unpacked size | `276 965` bytes |

## Commands

```bash
npm run build
npm pack --dry-run --json --ignore-scripts --cache .tmp/npm-cache
npm run release:verify
shasum md2pdf-0.1.2.tgz
```

`npm run release:verify` expands to:

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

`npm run check:package` runs `scripts/checkPackage.mjs`, which:

- runs `npm pack --json --cache .tmp/npm-cache`;
- verifies required packlist entries;
- rejects orphan `dist/` outputs whose `src/*.ts` source no longer exists;
- installs the tarball into a temporary user-scope prefix;
- verifies the installed POSIX `bin/md2pdf` symlink points to the package
  `dist/cli.js`;
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
| `npm run build` | PASS; `clean` removed `dist/` before `tsc` |
| `dist/pdfRenderer.*` after clean build | Absent |
| `npm pack --dry-run --json --ignore-scripts --cache .tmp/npm-cache` | PASS; `entryCount: 62`; no `dist/pdfRenderer.*` |
| `npm run typecheck` | PASS |
| `npm test` | PASS; 158 passed, 1 skipped |
| `npm run test:artifacts` | PASS; 24 passed |
| `npm run check:artifacts` | PASS; Artifact freshness policy passed |
| `npm run test:browser` | PASS; 25 passed |
| `npm run test:real-browser` | PASS; 1 passed |
| `npm run check:package` | PASS; install added 123 packages, reinstall changed 123 packages |
| `shasum md2pdf-0.1.2.tgz` | `bf78b0eeeb9a9898fe2e9fddd3551d5730f356cd` |

`npm run release:verify` final package-smoke output:

```text
added 123 packages in 3s
changed 123 packages in 2s
Package smoke passed: md2pdf-0.1.2.tgz
entryCount: 62
shasum: bf78b0eeeb9a9898fe2e9fddd3551d5730f356cd
integrity: sha512-TCb5FKFpI7c19aCMdTXPcUnE64phs4+hS+NJObdsPDsI6V0XNm0KPr499j6jw9FOyYTwNU+G58OQ4D4nChRxrw==
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
