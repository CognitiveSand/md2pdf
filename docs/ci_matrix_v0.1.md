# md2pdf v0.1 CI Matrix Plan

M7 records the release matrix without adding CI provider actions or other
third-party workflow artifacts. Any future workflow implementation must satisfy
`ARTIFACT_FRESHNESS_POLICY.md` before referencing external actions, runners, or
tooling.

Current Phase 9 status on 2026-06-15: `blocked` for global release evidence.
The matrix below is the required release matrix, but no current Linux, macOS,
and Windows CI run URL, logs, or committed CI result summary exists yet for the
Phase 10 release candidate.

## Required Platforms

| OS | Node.js | Fast Checks | Browser Checks |
|---|---|---|---|
| Linux | 20.x | `npm ci`, `npm run release:verify` | Chromium-family browser plus chromedriver; Firefox plus geckodriver |
| macOS | 20.x | `npm ci`, `npm run release:verify` | Chrome or Chromium plus chromedriver; Firefox plus geckodriver |
| Windows | 20.x | `npm ci`, `npm run release:verify` | Chrome or Chromium plus chromedriver; Firefox plus geckodriver |

## Packaging Smoke

Each platform should run:

```bash
npm run build
npm pack
npm install --global --prefix <temporary-user-prefix> ./md2pdf-0.1.2.tgz
<temporary-user-prefix>/bin/md2pdf --help
npm install --global --prefix <temporary-user-prefix> ./md2pdf-0.1.2.tgz
<temporary-user-prefix>/bin/md2pdf --help
```

On Windows, use `md2pdf.cmd --help` through `cmd.exe` from the platform-specific
npm bin path under the temporary prefix. The second install verifies idempotent
convergence on the same package version.

The local helper `npm run check:package` automates this smoke on the current
host and verifies the POSIX symlink target or Windows command shim, but it is
not a substitute for the full CI matrix above.

## Release Gate

The release gate is green only when:

- Fast checks pass on Linux, macOS, and Windows.
- At least one Chromium-family browser-backed test run passes.
- At least one Firefox-backed test run passes.
- `npm pack` contains `dist/`, `assets/`, `README.md`,
  `ARTIFACT_FRESHNESS_POLICY.md`, and `artifacts.json`.
- The installed `md2pdf --help` command works from a user-scope prefix without
  elevated privileges.
