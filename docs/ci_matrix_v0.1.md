# md2pdf v0.1 CI Matrix Plan

M7 records the release matrix without adding CI provider actions or other
third-party workflow artifacts. Any future workflow implementation must satisfy
`ARTIFACT_FRESHNESS_POLICY.md` before referencing external actions, runners, or
tooling.

## Required Platforms

| OS | Node.js | Fast Checks | Browser Checks |
|---|---|---|---|
| Linux | 20.x | `npm ci`, `npm run typecheck`, `npm test`, `npm run check:artifacts`, `npm run build`, `npm pack` | Chromium-family browser plus chromedriver; Firefox plus geckodriver |
| macOS | 20.x | `npm ci`, `npm run typecheck`, `npm test`, `npm run check:artifacts`, `npm run build`, `npm pack` | Chrome or Chromium plus chromedriver; Firefox plus geckodriver |
| Windows | 20.x | `npm ci`, `npm run typecheck`, `npm test`, `npm run check:artifacts`, `npm run build`, `npm pack` | Chrome or Chromium plus chromedriver; Firefox plus geckodriver |

## Packaging Smoke

Each platform should run:

```bash
npm run build
npm pack
npm install --global --prefix <temporary-user-prefix> ./md2pdf-0.1.0.tgz
<temporary-user-prefix>/bin/md2pdf --help
npm install --global --prefix <temporary-user-prefix> ./md2pdf-0.1.0.tgz
<temporary-user-prefix>/bin/md2pdf --help
```

On Windows, use the platform-specific npm bin path under the temporary prefix.
The second install verifies idempotent convergence on the same package version.

## Release Gate

The release gate is green only when:

- Fast checks pass on Linux, macOS, and Windows.
- At least one Chromium-family browser-backed test run passes.
- At least one Firefox-backed test run passes.
- `npm pack` contains `dist/`, `assets/`, `README.md`,
  `ARTIFACT_FRESHNESS_POLICY.md`, and `artifacts.json`.
- The installed `md2pdf --help` command works from a user-scope prefix without
  elevated privileges.
