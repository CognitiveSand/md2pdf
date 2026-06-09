# Stream A Phases 1-5 Additional Audit - 2026-06-09

Verdict: **GO for Phase 6 packaging smoke work only; NO-GO for final P3/browser
or release acceptance claims**.

The automatic gates for phases 1-5 are green, and the Phase 5 late-write
protections are implemented for the current renderer path. The additional risk
is not a red test. The risk is that the current implementation and evidence can
be read too broadly: the integration suite proves the CLI-to-renderer command
contract with a deterministic fake browser, not a real browser rendering path,
not Mermaid completion, and not the WebDriver/Firefox architecture still
described in the docs.

## Scope

- Requirement source: `docs/stream-a-implementation-plan-2026-06-08.md`,
  phases 1 through 5.
- Code inspected:
  - `src/cli.ts`
  - `src/converter.ts`
  - `src/pdfRenderer.ts`
  - `src/browserLocator.ts`
  - `src/markdownRenderer.ts`
  - `src/pipeline.ts`
  - `src/paths.ts`
  - `src/overwrite.ts`
- Tests inspected:
  - `tests/integration/cli-pdf.test.ts`
  - `tests/unit/converter/converter.test.ts`
  - `tests/unit/cli/cli.test.ts`
  - related Stream A P1/P2 unit suites
- Docs inspected:
  - `docs/release-evidence/release-checklist-v0.1.2.md`
  - `docs/architecture.md`
  - `README.md`

## Requirement and User Story Compliance

| Phase / Requirement | Status | Evidence | Problem |
| --- | --- | --- | --- |
| Phase 1.1 artifact freshness gate restored | Respected | `npm.cmd run check:artifacts` passes. | None found in this audit. |
| Phase 1.2 P2 global gates replayed | Respected | `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run test:contracts`, `npm.cmd run check:artifacts` pass. | None found in this audit. |
| Phase 2 release checklist separates P1/P2 pass from later blocked proof | Mostly respected | `docs/release-evidence/release-checklist-v0.1.2.md:66-67` separates integration pass from real browser/Mermaid blocked status. | Some surrounding docs still imply WebDriver/Firefox behavior that the current code does not implement. |
| Phase 3 runtime converter no longer uses the public stub | Respected | `src/contracts.ts:21`, `src/converter.ts:15-44`, `src/cli.ts:164-174`. | None for the narrow "not a stub" requirement. |
| Phase 3 Stream A / Stream B boundary | Partially respected | Plan says Stream A must not reimplement `browserLocator` or `pdfRenderer` at `docs/stream-a-implementation-plan-2026-06-08.md:128-129`; those modules now exist in `src/browserLocator.ts` and `src/pdfRenderer.ts`. | Scope boundary is now blurred unless this is explicitly accepted as temporary Stream A glue. |
| Phase 4 integration tests exist and pass | Respected for deterministic command-contract proof | `tests/integration/cli-pdf.test.ts:37-180`; `npm.cmd run test:browser` passes with 10 tests. | The tests do not prove real browser rendering or Mermaid rendering. |
| Phase 5 late write protections | Mostly respected | `src/pdfRenderer.ts:24-34`, `src/pdfRenderer.ts:128-137`, `tests/integration/cli-pdf.test.ts:132-180`. | Real OS permission/ACL variants remain untested. |

## Negative Findings

### Finding 1 - Phase 4/P3 Evidence Still Does Not Prove Real Browser Rendering

Severity: High

File: `tests/integration/cli-pdf.test.ts`

Lines: `37`, `201`, `206`

Problem: The integration suite proves that the CLI invokes a browser-like command
and receives a file beginning with `%PDF-`. The fake browser writes a static PDF
string; it does not load the generated HTML, run browser layout, render images,
render CSS, execute Mermaid, or prove the installed-browser path.

Risk: If this is treated as full P3 acceptance, md2pdf can move forward while
the actual user-visible conversion path remains unproven. A browser can be
missing, incompatible, unable to render the generated HTML, or unable to render
Mermaid, and these tests would still pass.

Evidence:

- `tests/integration/cli-pdf.test.ts:206` creates a fake browser.
- `tests/integration/cli-pdf.test.ts:201` validates only the `%PDF-` header.
- `docs/release-evidence/release-checklist-v0.1.2.md:67` correctly keeps real
  installed-browser/Mermaid proof blocked.

Suggested fix: Keep the fake-browser suite as a fast contract test, but add a
separate real-browser integration fixture before final P3/release acceptance.
That fixture should run against an installed supported browser, load a Markdown
fixture with representative content, and verify that the produced PDF is not
just a header-valid placeholder.

Test needed: Real installed-browser `md2pdf ENTRY` test, plus a content-level
assertion stronger than `%PDF-`.

### Finding 2 - Mermaid Completion Is Embedded But The Renderer Does Not Wait For It

Severity: High

File: `src/pdfRenderer.ts`

Lines: `65-66`

Problem: The renderer invokes the browser with `--print-to-pdf=<path>` and the
file URL directly. There is no explicit wait for
`document.documentElement.dataset.mermaidStatus === "done"` before printing.
The HTML renderer embeds an async Mermaid runner, but the PDF renderer has no
feedback loop to wait for that async script to finish.

Risk: A real browser can print before Mermaid has completed. That can produce a
PDF containing pending/raw diagram markup, a blank diagram area, or inconsistent
output depending on timing and browser behavior.

Evidence:

- `src/pdfRenderer.ts:65-66` sends `--print-to-pdf` and `request.fileUrl`.
- `src/markdownRenderer.ts:342-343` sets `mermaidStatus = "done"` only after
  `await mermaid.run(...)`.
- `docs/architecture.md:92-93` says the renderer waits until Mermaid reports
  completion before printing.
- `docs/release-evidence/release-checklist-v0.1.2.md:67` keeps Mermaid proof
  blocked.

Suggested fix: Either implement the architecture's wait step with a WebDriver
or equivalent browser-control path, or explicitly narrow current support to
non-Mermaid PDF output until that wait exists.

Test needed: Real browser Mermaid fixture proving the diagram renders as a
diagram before print.

### Finding 3 - Current Browser Implementation Diverges From The Documented WebDriver/Firefox Architecture

Severity: Medium

Files: `README.md`, `docs/architecture.md`, `src/browserLocator.ts`,
`src/pdfRenderer.ts`

Lines: `README.md:21`, `README.md:29-30`, `README.md:131`,
`docs/architecture.md:165-166`, `src/browserLocator.ts:38`,
`src/pdfRenderer.ts:45-66`

Problem: The docs still describe WebDriver, Firefox, matching drivers, and
driver provisioning. The current implementation directly launches Chrome/Edge/
Chromium-style executables with `--print-to-pdf`; it does not locate Firefox,
resolve a WebDriver, or provision `chromedriver`/`geckodriver`.

Risk: Users and release reviewers will follow inaccurate setup expectations.
They may install Firefox or a WebDriver and still fail because the current code
does not use them. The release checklist may also appear more complete than the
actual runtime architecture.

Evidence:

- `README.md:21` says conversion prints through WebDriver.
- `README.md:29-30` says Firefox and matching WebDriver are supported.
- `README.md:131` says `test:browser` requires local browser plus WebDriver.
- `src/browserLocator.ts:38` only tells users to install Chrome, Chromium, or
  Edge.
- `src/pdfRenderer.ts:45-66` uses direct browser launch and `--print-to-pdf`.

Suggested fix: In Phase 7, align README and architecture with the actual
accepted runtime path, or implement the missing WebDriver/Firefox path before
claiming those capabilities.

Test needed: Documentation comparison gate plus a browser-family matrix if
Firefox/WebDriver remains supported.

### Finding 4 - Stream A Now Owns Modules The Plan Says Belong Outside Stream A

Severity: Medium

Files: `docs/stream-a-implementation-plan-2026-06-08.md`,
`src/browserLocator.ts`, `src/pdfRenderer.ts`

Lines: `docs/stream-a-implementation-plan-2026-06-08.md:128-129`

Problem: The plan explicitly says Stream A must not reimplement
`browserLocator`, `webDriverClient`, `pdfRenderer`, `artifactPolicy`, or
provisioning. The current phase 4/5 implementation adds `browserLocator.ts` and
`pdfRenderer.ts` directly in `src/`.

Risk: This creates ownership drift between Stream A and Stream B. Future Stream
B work can either duplicate this path or replace it, and both outcomes increase
merge and regression risk.

Evidence:

- The boundary is stated at
  `docs/stream-a-implementation-plan-2026-06-08.md:128-129`.
- The implementation now includes `src/browserLocator.ts` and
  `src/pdfRenderer.ts`.

Suggested fix: Record an explicit architecture decision if this is accepted as
temporary Stream A glue. Otherwise, move these responsibilities into the
Stream B-owned runtime layer before expanding the browser implementation.

Test needed: Contract-level tests around the Stream A/Stream B boundary so CLI
orchestration can be tested independently from browser ownership.

### Finding 5 - Browser Executable Validation Checks Existence, Not Executability

Severity: Low

File: `src/browserLocator.ts`

Lines: `85-92`

Problem: `isUsableExecutable` calls `access(path)` without an execute-mode
check. On POSIX, a non-executable file can be accepted as "usable" and only fail
later when `spawn` runs.

Risk: Users get a later conversion error instead of a browser-location error,
and PATH scanning can select a bad candidate if a non-executable file happens
to match a browser name.

Evidence: `src/browserLocator.ts:91` uses `access(path)` with no mode.

Suggested fix: Use executable permission checks where the platform supports
them, while keeping Windows behavior compatible.

Test needed: POSIX test where `MD2PDF_BROWSER` points to an existing
non-executable file.

### Finding 6 - Phase 5 Permission Coverage Is Portable But Not A True ACL Matrix

Severity: Low

File: `tests/integration/cli-pdf.test.ts`

Lines: `149-180`

Problem: The late-write tests simulate path races by replacing the output with a
directory or replacing the parent with a file. They do not simulate true
read-only files, file locks, Windows ACLs, POSIX chmod behavior, antivirus
locks, or network filesystem semantics.

Risk: The common failure shape is covered, but platform-specific permission
bugs can survive until CI matrix or release smoke testing.

Evidence:

- `tests/integration/cli-pdf.test.ts:149-164` covers final output replaced by a
  directory.
- `tests/integration/cli-pdf.test.ts:167-180` covers parent path replaced by a
  file.

Suggested fix: Keep the current portable tests, and add OS-specific permission
coverage only if Phase 6/CI matrix or release acceptance requires it.

Test needed: Windows and POSIX permission/lock cases in the CI matrix.

## Test Audit

### Coverage Summary

| Area | Test Status | Problem |
| --- | --- | --- |
| P1 path resolution and CLI usage | Covered | No new gap found. |
| P2 overwrite and preflight behavior | Covered | No new gap found. |
| P3 runtime converter boundary | Covered at unit level | Real browser output still unproven. |
| P4 integration gate | Partially covered | Fake browser proves command contract only. |
| P5 late write protections | Partially covered | Portable race simulations exist; real ACL/lock matrix missing. |
| Mermaid browser rendering | Not covered | No real wait/render assertion. |
| WebDriver/Firefox support | Not covered | Current code does not implement the documented path. |

### Validation Commands Run

```text
npm.cmd run typecheck
PASS

npm.cmd run check:artifacts
PASS - Artifact freshness policy passed.

npm.cmd run test:browser
PASS - 1 integration file, 10 tests
Note: first sandbox attempt failed during Windows spawn setup; command passed
when rerun outside the sandbox.

npm.cmd test
PASS - 10 test files, 84 tests

npm.cmd run test:contracts
PASS - 1 test file, 10 tests

npm.cmd run build
PASS
Note: first sandbox attempt failed during Windows spawn setup; command passed
when rerun outside the sandbox.
```

## Documentation Sync Audit

### Findings

- README and architecture overstate the current runtime by describing WebDriver,
  Firefox, matching drivers, and provisioning while the code uses direct
  Chromium-family `--print-to-pdf`.
- The release checklist is more accurate than README/architecture because it
  keeps real installed-browser/Mermaid proof blocked.
- Phase 7 should not only "align README and --help"; it should also decide
  whether `docs/architecture.md` remains aspirational or must be rewritten to
  match the accepted runtime.

## Open Questions

1. Is the direct `--print-to-pdf` Chromium-family path an accepted replacement
   for the WebDriver/Firefox architecture, or only temporary Stream A glue?
2. Does "P3 produces a real PDF" mean "valid PDF bytes through the renderer
   command contract" or "real installed browser renders the generated HTML"?
3. Should Phase 6 packaging proceed before a real installed-browser smoke test,
   or should that test become an explicit prerequisite?

## Summary

Phases 1 and 2 remain solid. Phase 3 is solid for removing the public stub.
Phase 4 and 5 are solid for the deterministic fake-browser command contract and
late-write protections. The blocking risk is claim control: do not present this
as final browser/Mermaid/WebDriver acceptance. Treat Phase 6 as packaging smoke
work, not release readiness, until the real browser and Mermaid proof is added
or the documentation is narrowed to the implemented Chromium `--print-to-pdf`
path.
