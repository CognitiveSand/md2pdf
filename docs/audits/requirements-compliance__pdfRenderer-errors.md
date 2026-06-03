# Requirements Compliance Findings: pdfRenderer.ts + errors.ts

**Audit Date:** 2026-06-03
**File(s) Audited:**
- `/home/me/github/md2pdf/src/pdfRenderer.ts`
- `/home/me/github/md2pdf/src/errors.ts`
**Auditor:** Requirements Compliance Auditor Agent
**Mode:** READ-ONLY forensic audit (no remediation; defects identified and evidenced only)

## Executive Summary

`pdfRenderer.ts` implements pipeline stage 4 (WebDriver render + Print) and is the architecture-designated component for FR-07, FR-24, and NFR-02. `errors.ts` defines the typed error hierarchy designated for FR-15/FR-16 fail-loud reporting. The code is broadly functional, but the audit found a material **NFR-02 / CON-02 traceability gap**: the local-only "launch the browser offline" guarantee promised by architecture §9 and ADR-02 is **not actually implemented** in `pdfRenderer.ts` — the browser capability builders set only proxy-disabling flags, which do not prevent outbound network access. The audit also found a **requirements-vs-architecture contradiction** in the error hierarchy (`errors.ts` lacks the `InputNotFoundError` class that architecture §8 names as the FR-15 mechanism, and the root class is spelled `Md2PdfError`, not the architecture's `Md2pdfError`). No `@req` traceability tags exist in either file, breaking the traceability discipline mandated by requirements §10.

- **Requirements relevant to these files:** FR-07, FR-15, FR-16, FR-24, NFR-02, CON-01, CON-02 (plus error-hierarchy support for FR-17/FR-18)
- **Fully implemented & traceable:** 2 (FR-24 render-wait; FR-16 render-failure error carrier)
- **Partially implemented / weakly traceable:** 3 (FR-07, NFR-02, FR-15 error hierarchy)
- **Unmet / untraceable as designed:** 1 (NFR-02 offline-launch enforcement absent in stage-4 code)
- **Missing requirement references (no `@req` tags):** both files

## Requirement Coverage Matrix

| Req ID | Description | Referenced (`@req`) | Implemented | Status |
|---|---|---|---|---|
| FR-07 | No heading is last line on a page | No | Not in these files (CSS-driven per arch §10); Print params here are neutral | Untraceable here |
| FR-15 | Missing-input reporting via typed error | No | `errors.ts` has no `InputNotFoundError`; arch §8 names one | Partial / contradiction |
| FR-16 | Render-failure reporting, no partial PDF | No | `RenderError` carries `sourcePath`; thrown on any stage-4 failure | Met (untagged) |
| FR-24 | Mermaid rendered as image, not raw text | No | `waitForMermaid` + `MERMAID_DONE_SCRIPT` | Met (untagged) |
| NFR-02 | No outbound network connection during conversion | No | Only proxy-off flags set; no offline/network-block enforcement | Unmet as designed |
| CON-02 | Local-only computation, no external transmission | No | Same gap as NFR-02 | Partial |
| CON-01 | Node.js 20+ | No | Uses `node:` built-ins, `AbortSignal.timeout`; consistent with floor | Met (implicit) |

## Detailed Findings

### Compliant Requirements

#### FR-24 — Mermaid diagram rendering (Met, untagged)
- **Status:** Implemented.
- **Evidence:** `pdfRenderer.ts:115-122` defines `MERMAID_DONE_SCRIPT`, which polls every `.mermaid` element for a rendered `<svg>` or `data-processed="true"`; `pdfRenderer.ts:124-136` `waitForMermaid` blocks until completion or timeout; `pdfRenderer.ts:181` calls it before `printPage`. This ensures the PDF captures rendered diagrams rather than raw text, satisfying FR-24's "as an image … rather than as the block's raw text."
- **Defect (minor):** No `@req: FR-24` tag (see Convention Findings).

#### FR-16 — Render-failure reporting / no partial PDF (Met, untagged)
- **Status:** Implemented at the error-carrier level.
- **Evidence:** `pdfRenderer.ts:185-186` catches any stage-4 failure and rethrows `new RenderError((err as Error).message, sourcePath)`; `errors.ts:71-77` defines `RenderError extends ConversionError` carrying `sourcePath`, message prefixed `Render failed for ${sourcePath}: …`. `renderToPdf` returns bytes only on full success (`pdfRenderer.ts:183-184`), so a partial PDF is never returned to the caller — consistent with FR-16's "rather than write a partial output PDF" (the write-suppression itself lives in `converter.ts`, outside this audit's files).

### Partial Compliance

#### NFR-02 / CON-02 — Local-only processing, no outbound network (Partial → effectively Unmet in stage-4 code)
- **Status:** Partially compliant; the stage-4 enforcement promised by architecture is **absent**.
- **Issue:** Architecture §9 ("Local-only enforcement") and ADR-02 (`architecture.md:168-178`, `:267-273`) state the guarantee is structural and that "the browser is launched with **offline/no-proxy preferences so it cannot reach the network**." In `pdfRenderer.ts` only proxy-disabling is implemented, which is **not** an offline / network-blocking measure:
  - Chrome: `pdfRenderer.ts:75` sets `'--no-proxy-server'` (and `--headless=new`, `--disable-gpu`, etc.). `--no-proxy-server` disables proxy use; it does **not** block direct outbound connections.
  - Firefox: `pdfRenderer.ts:92-94` sets `prefs: { 'network.proxy.type': 0 }` with comment `// direct — no proxy`. `network.proxy.type: 0` means **DIRECT connection** — i.e., the browser bypasses any proxy and connects to the network directly. This is the *opposite* of offline; it permits direct network access.
- **Consequence:** A document that (contrary to the inlining design) references an `http:`/`https:` URL would be fetched by the browser, violating NFR-02 ("shall open no outbound network connection during conversion") and CON-02. The requirement's guarantee currently rests entirely on the inlining done in `markdownRenderer.ts` (outside these files); the stage-4 "offline launch" leg the architecture relies on does not exist here.
- **Location:** `pdfRenderer.ts:67-83` (`chromeCapabilities`), `pdfRenderer.ts:85-98` (`firefoxCapabilities`).
- **Evidence quote:** `'network.proxy.type': 0, // direct — no proxy` (line 93) — the comment confirms intent was proxy-bypass, not offline isolation.
- **Untraceable:** No `@req: NFR-02` / `@req: CON-02` tag marks this code as the enforcement point, so the architecture-to-code link is unverifiable by inspection.

#### FR-15 — Missing-input reporting: error-class contradiction (Partial)
- **Status:** Partial; requirements/architecture vs. code contradiction.
- **Issue:** Architecture §8 (`architecture.md:156-159`) names the FR-15 mechanism explicitly: "missing/unreadable input → `InputNotFoundError`". `errors.ts` defines **no** `InputNotFoundError` class (`errors.ts:1-86`); the codebase instead reports missing/unreadable input with a generic `ConversionError` (`paths.ts:35`, `paths.ts:56`). The architecture is therefore a defect relative to the implementation, or the implementation omits a required typed error — either way FR-15's traceability is broken at the error layer this file owns (errors.ts is the architecture-designated component for FR-15/FR-16, `architecture.md:110`).
- **Location:** `errors.ts:1-86` (no `InputNotFoundError`); contrast `architecture.md:158`.

#### FR-07 — Heading page-break integrity (Untraceable in this file)
- **Status:** Not implemented here; architecture assigns FR-07 to `pdfRenderer.ts` (`architecture.md:107`) yet the mechanism lives in CSS (`architecture.md:184-188`, `break-after: avoid-page`).
- **Issue:** `pdfRenderer.ts` only forwards `options.print` to `printPage` (`pdfRenderer.ts:183`); the Print defaults (A4, margins, `background`, `shrinkToFit`) live in `webDriverClient.ts:103-116`. Nothing in `pdfRenderer.ts` enforces or even references heading-orphan avoidance. The architecture's component-to-requirement mapping (`pdfRenderer.ts` "Serves … FR-07") is thus only nominally satisfied; the real FR-07 work is elsewhere (the bundled CSS). This is a traceability mismatch, not a functional gap.
- **Location:** `pdfRenderer.ts:142-193`; `architecture.md:107`.

### Non-Compliant / Missing

#### Traceability tags absent (Requirements §10) — both files
- **Status:** Not implemented.
- **Expected:** Requirements §10 (`project_requirements.md:148-153`) mandates downward traceability by tagging artifacts with requirement IDs (example `@req FR-08`). Architecture §15 reiterates "Each test is tagged with its requirement ID." Neither audited file contains any `@req`/`FR-`/`NFR-`/`CON-` reference (grep over `pdfRenderer.ts` and `errors.ts` returns only the two proxy comment lines, no requirement IDs).
- **Evidence:** `pdfRenderer.ts` and `errors.ts` — zero requirement-ID tags despite both being the architecture-designated owners of FR-07/FR-24/NFR-02 and FR-15/FR-16 respectively (`architecture.md:107`, `:110`).

## Coding Convention Findings (TypeScript / project AGENTS.md)

### Error Handling
- `pdfRenderer.ts:185-186` casts the caught value `(err as Error).message` without a type guard; a thrown non-Error (e.g. a string) would yield `undefined` in the message. Minor fail-loud weakness; the `RenderError` wrapper still fires.
- `pdfRenderer.ts:189` uses non-null assertion `port!` inside `finally`. If `findFreePort()` (line 173) rejects before `port` is assigned, `sessionId` is still `undefined` so the branch is skipped — the assertion is currently safe but fragile and relies on control-flow coincidence rather than an invariant. POLA/fail-loud concern, not a requirement breach.

### Naming / Units
- AGENTS.md §4 requires units in names; `pdfRenderer.ts` complies well: `DRIVER_READY_TIMEOUT_MS`, `MERMAID_POLL_INTERVAL_MS`, `DEFAULT_RENDER_TIMEOUT_MS`, `timeoutMs`. No defect.
- **Root error-class name mismatch:** code uses `Md2PdfError` (`errors.ts:1`) while architecture §8 (`architecture.md:152`) and the component table (`architecture.md:110`) call the root `Md2pdfError` / `Md2pdfError hierarchy` (lowercase `p`). A documentation-vs-code naming contradiction; given AGENTS.md §4 "one concept, one word", the docs and code disagree on the binding name.

### Security Considerations
- `pdfRenderer.ts:115-122` and `webDriverClient.ts` `executeScript` inject a fixed string script (`MERMAID_DONE_SCRIPT`) with no interpolated input — no injection risk here. Acceptable.
- The NFR-02 finding above is the security-relevant item: the stage-4 browser is not network-isolated, so the local-only confidentiality guarantee (CON-02 rationale: "Confidentiality success criterion") is weaker than the architecture claims.

## Findings Summary (severity)

1. **HIGH — NFR-02/CON-02 offline-launch enforcement missing.** `pdfRenderer.ts:75,93` set proxy-bypass (`--no-proxy-server`; `network.proxy.type:0` = DIRECT), which permits direct network access; architecture §9/ADR-02 promised an offline launch that does not exist. (1)
2. **MEDIUM — FR-15 error-class contradiction.** `errors.ts` has no `InputNotFoundError` despite architecture §8 naming it as the FR-15 mechanism. (1)
3. **MEDIUM — Traceability tags absent.** No `@req` IDs in either file, violating requirements §10 across both architecture-designated requirement owners. (1)
4. **LOW — FR-07 traceability mismatch.** `pdfRenderer.ts` is mapped to FR-07 but contains no heading-orphan logic (CSS-only elsewhere). (1)
5. **LOW — Root class name mismatch `Md2PdfError` vs docs `Md2pdfError`.** (1)
6. **LOW — Fragile error handling:** unchecked `(err as Error)` cast (`pdfRenderer.ts:186`) and `port!` non-null assertion in `finally` (`pdfRenderer.ts:189`). (1)

**Totals:** critical 0, high 1, medium 2, low 3, total 6.

## Appendix: Evidence Index

| Finding | File:line | Quoted evidence |
|---|---|---|
| NFR-02 offline missing (Firefox) | `pdfRenderer.ts:93` | `'network.proxy.type': 0, // direct — no proxy` |
| NFR-02 offline missing (Chrome) | `pdfRenderer.ts:75` | `'--no-proxy-server'` |
| Arch claims offline launch | `architecture.md:176` | "launched with offline/no-proxy preferences so it cannot reach the network" |
| FR-15 InputNotFoundError absent | `errors.ts:1-86` vs `architecture.md:158` | arch: "missing/unreadable input → `InputNotFoundError`" |
| Root class name | `errors.ts:1` vs `architecture.md:152` | code `Md2PdfError`; doc `Md2pdfError` |
| No `@req` tags | `pdfRenderer.ts`, `errors.ts` | grep returns no FR-/NFR-/CON-/@req IDs |
| FR-24 wait | `pdfRenderer.ts:124-136,181` | `waitForMermaid(...)` |
| FR-16 carrier | `pdfRenderer.ts:185-186`, `errors.ts:71-77` | `throw new RenderError(...)` |
