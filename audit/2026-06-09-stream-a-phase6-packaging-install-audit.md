# Stream A Phase 6 Packaging And Install Audit - 2026-06-09

Verdict: **GO for Phase 7**, with FR-20 system-scope evidence and real
browser/Mermaid proof still pending.

Phase 6 packaging and user-scope installation evidence is complete for the local
Windows environment. The build produces `dist/cli.js`, `package.json` points the
`md2pdf` bin to that file, `npm pack --json` includes the required package
files, a temporary user-scope install succeeds, and reinstalling the same
tarball exits `0`.

## Scope

- Requirement: `docs/stream-a-implementation-plan-2026-06-08.md`, Phase 6.
- Files inspected or updated:
  - `package.json`
  - `dist/cli.js`
  - `docs/release-evidence/release-checklist-v0.1.2.md`

## Requirement and User Story Compliance

| Requirement | Status | Evidence | Problem |
| --- | --- | --- | --- |
| `npm run build` produces `dist/cli.js` | Respected | `npm.cmd run build` passed; `dist/cli.js` exists and starts with `#!/usr/bin/env node`. | None blocking. |
| `package.json` maps `bin.md2pdf` to `./dist/cli.js` | Respected | `package.json:22-23`. | None blocking. |
| `npm pack --json` packlist is valid | Respected | `npm.cmd pack --json` produced `md2pdf-0.1.2.tgz`; packlist includes `dist/`, `assets/`, `README.md`, `ARTIFACT_FRESHNESS_POLICY.md`, `artifacts.json`, and `package.json`. | None blocking. |
| User-scope install works | Respected | `npm.cmd install --global --prefix .tmp\phase6-prefix --cache .tmp\phase6-cache .\md2pdf-0.1.2.tgz --no-audit --no-fund` exited `0`; `md2pdf --help` ran through `cmd.exe` with the prefix on `PATH`. | PowerShell-specific shim caveat below. |
| Reinstall is idempotent | Respected | Second install of the same tarball in the same prefix exited `0` with `changed 123 packages`; `md2pdf --help` still ran afterwards. | None blocking for FR-21. |

## Negative Findings

### Finding 1 - PowerShell Resolves The npm `.ps1` Shim Before `.cmd`

Severity: Medium

File: generated install prefix, not repository source

Problem: In this Windows environment, invoking `md2pdf --help` from PowerShell
with the install prefix on `PATH` resolves to `md2pdf.ps1`. The local
ExecutionPolicy blocks that script, so the command fails in PowerShell even
though the npm `.cmd` shim works through `cmd.exe`.

Risk: A Windows user running from PowerShell with restricted script execution
can see a policy error after a successful user-scope install.

Evidence:

```text
md2pdf.ps1 cannot be loaded because script execution is disabled on this system.
```

The same prefix succeeds through:

```text
cmd.exe /d /c "set PATH=<prefix>;%PATH%&& md2pdf --help"
```

Suggested fix: In Phase 7 README/help documentation, add a Windows note that
PowerShell users may need to invoke `md2pdf.cmd` or adjust their local
ExecutionPolicy when npm's `.ps1` shim is selected.

Test needed: Windows install smoke that checks both `cmd.exe` shim invocation
and PowerShell behavior, with the PowerShell result documented rather than
silently assumed.

### Finding 2 - Phase 6 Does Not Resolve FR-20 Or Browser/Mermaid Release Proof

Severity: Medium

File: `docs/release-evidence/release-checklist-v0.1.2.md`

Problem: Phase 6 proves user-scope packaging/install and idempotent reinstall.
It does not prove system-scope account behavior (FR-20), real installed-browser
rendering, or Mermaid-as-diagram output.

Risk: Treating Phase 6 as release-ready would overclaim the remaining manual
and browser-backed evidence.

Evidence: FR-20 rows remain `pending`; browser-backed tests remain `blocked` in
the release checklist.

Suggested fix: Continue to Phase 7 for FR-20 and README/help alignment, while
keeping the real browser/Mermaid proof as a separate release blocker.

Test needed: FR-20 evidence file completed from a tested account or documented
valid simulation; real browser Mermaid fixture before final release acceptance.

## Validation

Commands executed:

```text
npm.cmd run build
PASS

dist/cli.js existence and shebang check
PASS

package.json bin check
PASS - "md2pdf": "./dist/cli.js"

npm.cmd pack --json
PASS - md2pdf-0.1.2.tgz
shasum fb8fc5f856797cf492e61e22c18af756e5f724b4
integrity sha512-KwRtaWNPIusd1wj/aMLAMi3HYTkeqTpY2PEgHAeLxWi8BbIYtz5KyOHSbDSE4IcMI7hvIuDuy5B4zBSINOTLXA==

npm.cmd install --global --prefix .tmp\phase6-prefix --cache .tmp\phase6-cache .\md2pdf-0.1.2.tgz --no-audit --no-fund
PASS - added 123 packages

cmd.exe /d /c "set PATH=<prefix>;%PATH%&& md2pdf --help"
PASS - help output printed

Second npm.cmd install of the same tarball into the same prefix
PASS - changed 123 packages, exit 0

Post-reinstall cmd.exe `md2pdf --help`
PASS - help output printed
```

## Summary

Stream A Phase 6 is complete for packaging/install smoke evidence. `FR-19` and
`FR-21` can be marked pass for the temporary user-scope install path. Phase 7
should now complete FR-20 and README/help alignment, including the Windows
PowerShell shim caveat and the existing browser/Mermaid limitations.
