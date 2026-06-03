# Forensic Audit — docs/architecture.md

Subject: `/home/me/github/md2pdf/docs/architecture.md`
Cross-checked against: `src/*.ts`, `scripts/checkArtifactFreshness.mjs`, `assets/`, `package.json`, `tests/`.
Mode: READ-ONLY. No remediation performed.

## Verdict

This document reads beautifully and lies in at least three load-bearing places. It is a polished
brochure for a product that is *mostly* built — but the moment you cross-reference the prose against
`src/`, the seams split open. The headline crime is the "last-resort browser provisioning" fantasy:
four separate sections (§8, §11, ADR-05, R-1) confidently promise that when no browser is found,
md2pdf "can provision a Chromium-for-Testing build plus its chromedriver." Open `browserLocator.ts`
and `locateBrowser()` does exactly one thing on a browser-less host: it throws `BrowserNotFoundError`
and stops. There is no browser download anywhere in the tree. The only `chrome-for-testing` string in
the codebase is a *chromedriver* URL. That is not a nuance; that is a documented capability that does
not exist, recited four times, and even cross-referenced by the error-handling section as "the
last-resort provisioning path (§11)" — a pointer to nothing.

Second crime: fonts. The document insists three times that fonts are *bundled* — §3 ("a faithful
PDF"), §5 (`assets/` row lists "fonts — all local"), §10 ("Fonts are bundled so output is consistent
regardless of host-installed fonts"), and §12's tree literally draws `assets/ fonts/`. There is no
`assets/fonts/` directory. `default.css` resolves typography through *system* font stacks
(`-apple-system, BlinkMacSystemFont, "Segoe UI"…`). The stated rationale — output consistency
*regardless of host fonts* — is the exact property the actual implementation cannot provide, because
it falls back to host fonts by design. The document promises the opposite of what the CSS does.

Third: the document describes an architecture that has since grown a whole organ it never mentions.
The driver-provisioning + artifact-freshness subsystem — `driverProvisioner.ts`, `releaseCatalog.ts`,
a 7-day quarantine policy, `ArtifactFreshnessError`, `DriverNotFoundError`, the root-level
`ARTIFACT_FRESHNESS_POLICY.md`, `artifacts.json`, and `scripts/checkArtifactFreshness.mjs` — is a
substantial, network-touching, governance-bearing mechanism with its own error type and its own
policy document. The architecture's component table (§5) lists nine modules and none of these. The
word "quarantine" and "freshness" appear zero times in the document. An architecture doc that claims
to be "authoritative on internal structure" (§1) and omits two of its own modules and an entire CI
policy is not authoritative; it is stale.

The coherence map: §5's component table is the spine, and it is wrong in three independent ways —
wrong module count (omits `webDriverClient.ts`, `driverProvisioner.ts`, `releaseCatalog.ts`), wrong
component naming style (the doc names class-style nouns `ConversionPipeline`, `DocumentConverter`,
`WebDriverPdfRenderer`, `OverwritePolicy`, `OutputPathResolver`, `ConversionEntryResolver` for a
codebase that is purely functional — `runConversionPipeline`, `convertFile`, `renderToPdf`,
`decideOverwrite`, `defaultOutputPath`, `resolveEntrySources`), and wrong error-type vocabulary
(`InputNotFoundError` and `Md2pdfError` do not exist; the real names are `ConversionError` and
`Md2PdfError`). §15's verification mapping routes a dozen requirements to "contract tests" and a
`contract/` suite that §12 also declares — but `tests/` contains only `unit/` and `integration/`.
There is no contract test directory and no contract-tagged suite. The traceability story the document
sells is therefore unbacked.

Architectural-approach compliance: the doc declares SRP and the 40-line / 300-line limits (§5) and a
five-stage pipeline (§4) where "Stages 1–3 run in Node and are pure functions." `renderToTempHtml` and
`renderToHtml` are not pure — they read assets and the Mermaid bundle from disk and `mkdtempSync` a
temp dir. That is fine engineering, but it falsifies the "pure functions of their input plus local
assets" claim as literally written, since stage 3 writes a temp file as a side effect. Minor, but the
document chose to make a purity claim it does not keep.

The good news, stated once: the conversion pipeline narrative (§4), the overwrite truth table (§7),
and the local-only enforcement strategy (§9) genuinely match the code (`decideOverwrite`,
inlined assets, `--no-proxy-server`/`network.proxy.type:0`, `file:` loading). Those sections are
honest. The rest needs to be dragged back to reality.

## Findings

See structured list below. Severity counts: CRITICAL 2, MAJOR 5, MINOR 4, SMELL 2. Total 13.
(Index mapping for the workflow: critical=2, high[MAJOR]=5, medium[MINOR]=4, low[SMELL]=2.)

---

### Issue 1 — Promised last-resort browser provisioning does not exist
- **Category:** missing_mechanism
- **Severity:** CRITICAL (criticality 9, confidence 5)
- **Evidence:** architecture.md §8 "and the last-resort provisioning path (§11)"; §11 "as a last resort, can provision a Chromium-for-Testing build plus its chromedriver into the per-user cache"; ADR-05 "if no browser exists, report clearly and optionally provision a Chromium-for-Testing build as a fallback"; R-1 "plus the last-resort Chromium-for-Testing download (ADR-05)" || browserLocator.ts:228 `throw new BrowserNotFoundError();`
- **Detail:** Four sections promise a browser-download fallback for browser-less hosts. The code has no browser-download path; `locateBrowser()` throws and stops. The only `chrome-for-testing` reference (driverProvisioner.ts:143) is a *chromedriver* URL, not a browser. A core documented capability is entirely absent.
- **Locations:** architecture.md 161-162, 208-210, 294-296, 308; src/browserLocator.ts 228
- **Affected req:** FR-19 (no-sudo install), ADR-05; **Components:** BrowserLocator

### Issue 2 — "Fonts are bundled" is false; CSS uses host system fonts
- **Category:** requirement_violation
- **Severity:** CRITICAL (criticality 8, confidence 5)
- **Evidence:** architecture.md §10 "Fonts are bundled so output is consistent regardless of host-installed fonts."; §5 `assets/` row "Default CSS, highlight.js theme CSS, fonts — all local."; §12 tree shows `assets/ fonts/` || assets/default.css:16 `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,` ; ABSENT: `ls assets/fonts` → "No such file or directory"
- **Detail:** No `assets/fonts/` directory exists; `default.css` has no `@font-face` and resolves type through system font stacks. The document's stated rationale — consistent output regardless of host fonts — is exactly the property the implementation cannot deliver, since it falls back to host-installed fonts. The claim is repeated three times and drawn in the tree.
- **Locations:** architecture.md 111, 192-193, 241-244; assets/default.css 16, 89
- **Affected req:** NFR-01, NFR-02; **Components:** assets/, MarkdownToHtmlRenderer

### Issue 3 — Driver-provisioning and artifact-freshness subsystem entirely undocumented
- **Category:** loose_end
- **Severity:** MAJOR (criticality 7, confidence 5)
- **Evidence:** architecture.md §5 component table lists only cli/pipeline/converter/markdownRenderer/browserLocator/pdfRenderer/paths/overwrite/errors/assets || src/driverProvisioner.ts, src/releaseCatalog.ts present; releaseCatalog.ts:3 `export const QUARANTINE_DAYS = 7;`; errors.ts:80 `ArtifactFreshnessError`; ABSENT: grep "quarantine|freshness|artifacts.json" architecture.md → no match
- **Detail:** A network-touching subsystem (release-catalog fetch over npm/GitHub, 7-day quarantine selection, archive extraction, `DriverNotFoundError`, `ArtifactFreshnessError`) plus a root governance file `ARTIFACT_FRESHNESS_POLICY.md`, `artifacts.json`, and `scripts/checkArtifactFreshness.mjs` exist in the repo. The architecture — which claims in §1 to be "authoritative on internal structure" — never mentions any of it. Two whole modules and a CI policy are missing from the design.
- **Locations:** architecture.md 95-111 (table), 196-217; src/driverProvisioner.ts 1-247; src/releaseCatalog.ts 1-49
- **Components:** (undocumented) DriverProvisioner, ReleaseCatalog

### Issue 4 — webDriverClient.ts module absent from component view
- **Category:** loose_end
- **Severity:** MAJOR (criticality 6, confidence 5)
- **Evidence:** architecture.md §5 table and §12 tree omit any WebDriver client module; pdfRenderer.ts:7-15 imports `deleteSession, executeScript, navigateTo, newSession, printPage, waitForDriverReady` from `./webDriverClient.js` || src/webDriverClient.ts:1 "Minimal W3C WebDriver HTTP client."
- **Detail:** The actual W3C WebDriver protocol implementation lives in `webDriverClient.ts`, a real 150-line module owning session/navigation/print/status concerns. §7 of the document repeatedly invokes "the WebDriver Print command" yet the component that implements it has no row in §5 and no node in §12's project tree. The Print/session concern is silently folded into `WebDriverPdfRenderer` in the prose.
- **Locations:** architecture.md 100-111, 231-240; src/webDriverClient.ts 1-150; src/pdfRenderer.ts 7-15
- **Components:** (undocumented) WebDriverClient

### Issue 5 — `InputNotFoundError` named in §8 does not exist in code
- **Category:** undefined_behavior
- **Severity:** MAJOR (criticality 6, confidence 5)
- **Evidence:** architecture.md §8 "(missing/unreadable input → `InputNotFoundError`; un-renderable content → `RenderError`)" || ABSENT: grep "InputNotFoundError" src/ → no match; errors.ts defines `ConversionError`, `BrowserNotFoundError`, `DriverNotFoundError`, `RenderError`, `ArtifactFreshnessError`; paths.ts:35 `throw new ConversionError("Input not found or unreadable: ...")`
- **Detail:** §8 names a specific typed error, `InputNotFoundError`, as the mechanism for missing/unreadable input. No such class exists. The real path throws a generic `ConversionError`. The document's typed-error contract (FR-15/FR-16) cites a type that was never built; conversely the real `DriverNotFoundError` is never mentioned in the document.
- **Locations:** architecture.md 156; src/errors.ts 1-87; src/paths.ts 33-39
- **Affected req:** FR-15, FR-16; **Components:** Md2PdfError hierarchy

### Issue 6 — Component names are class-style; codebase is functional ("Architecture B")
- **Category:** incoherence
- **Severity:** MAJOR (criticality 6, confidence 5)
- **Evidence:** architecture.md §5 "`pipeline.ts` | `ConversionPipeline`", "`converter.ts` | `DocumentConverter`", "`pdfRenderer.ts` | `WebDriverPdfRenderer`", "`overwrite.ts` | `OverwritePolicy`", "`paths.ts` | `OutputPathResolver`, `ConversionEntryResolver`" || pipeline.ts:84 `export async function runConversionPipeline`; converter.ts:21 `export async function convertFile`; pdfRenderer.ts:158 `export async function renderToPdf`; overwrite.ts:12 `export function decideOverwrite`; paths.ts:19 `export function defaultOutputPath`
- **Detail:** Every "Component" name in §5 is a class/object noun, implying an OO design. The implementation has no such classes — it is module-level functions throughout. `ConversionEntryResolver` and `OutputPathResolver` are not types; they are loose functions (`resolveEntrySources`, `defaultOutputPath`, `outputPathInDirectory`). The document describes a structure that does not exist as named, making §5 untraceable to source.
- **Locations:** architecture.md 103-109; src/pipeline.ts 84, src/converter.ts 21, src/pdfRenderer.ts 158, src/overwrite.ts 12, src/paths.ts 19-30
- **Components:** ConversionPipeline, DocumentConverter, WebDriverPdfRenderer, OverwritePolicy, OutputPathResolver, ConversionEntryResolver

### Issue 7 — Declared `contract/` test suite and contract-test verification do not exist
- **Category:** untestable
- **Severity:** MAJOR (criticality 6, confidence 5)
- **Evidence:** architecture.md §12 "contract/ # CLI options, exit codes, stderr messages"; §15 "FR-03, FR-23 | contract test", "FR-12–14 | ... contract test", "FR-15–18 | contract test", "NFR-04 | contract test" || ABSENT: `find tests -type d` → only `tests/unit`, `tests/integration`, `tests/fixtures`
- **Detail:** The document declares a third test category, `contract/`, and §15 routes at least five requirement groups to "contract tests." No `tests/contract/` directory exists; the suite has only `unit/` and `integration/`. CLI/exit-code coverage lives in `tests/unit/cli.test.ts`. The verification mapping promises a test category that was never created, so the stated traceability is fiction for those rows.
- **Locations:** architecture.md 248, 326-339; tests/ (unit, integration, fixtures only)
- **Affected req:** FR-03, FR-12-18, FR-23, NFR-04

### Issue 8 — `Md2pdfError` (doc) vs `Md2PdfError` (code) casing drift
- **Category:** terminology_drift
- **Severity:** MINOR (criticality 4, confidence 5)
- **Evidence:** architecture.md §5 "`Md2pdfError` hierarchy", §8 "defines a single root `Md2pdfError`", §12 "Md2pdfError hierarchy" || errors.ts:1 `export class Md2PdfError extends Error`
- **Detail:** The root error class is spelled `Md2pdfError` (lowercase p) in three places in the document; the actual exported symbol is `Md2PdfError` (capital P). A name is an API contract (§4 of project guidelines); a reader copying the documented identifier gets a compile error. Three occurrences.
- **Locations:** architecture.md 110, 152, 240; src/errors.ts 1
- **Components:** Md2PdfError hierarchy

### Issue 9 — §10 CSS snippet `break-after: avoid-page` not present in the real stylesheet
- **Category:** incoherence
- **Severity:** MINOR (criticality 4, confidence 5)
- **Evidence:** architecture.md §10 "`h1, h2, h3, h4, h5, h6 { break-after: avoid-page; }`" || assets/default.css: ABSENT (no break-after); markdownRenderer.ts:161 `h1, h2, h3, h4, h5, h6 { orphans: 3; widows: 3; page-break-after: avoid; }`
- **Detail:** The document presents a specific CSS rule as the FR-07 orphan-avoidance mechanism living in `default.css`. That rule (`break-after: avoid-page`) appears nowhere. The real rule is the legacy `page-break-after: avoid`, and it is injected inline by `markdownRenderer.ts`, not stored in `default.css`. Both the property name and its location are misstated.
- **Locations:** architecture.md 186-188; src/markdownRenderer.ts 159-165; assets/default.css
- **Affected req:** FR-07; **Components:** assets/, MarkdownToHtmlRenderer

### Issue 10 — Stage-4 "waits until the Mermaid engine reports completion" misdescribes the mechanism
- **Category:** incoherence
- **Severity:** MINOR (criticality 3, confidence 4)
- **Evidence:** architecture.md §4.4 "waits until the Mermaid engine reports completion"; §5 pdfRenderer "await Mermaid completion" || pdfRenderer.ts:115-122 MERMAID_DONE_SCRIPT polls the DOM: `el.querySelector('svg') !== null || el.getAttribute('data-processed') === 'true'`
- **Detail:** The document says the renderer waits for the Mermaid *engine* to report completion, implying a callback/promise from Mermaid. The code never asks the engine anything; it polls the DOM every 100 ms for an injected `<svg>` or `data-processed` attribute and gives up after a timeout. The actual completion signal is a heuristic DOM probe, not an engine report — a materially different reliability profile (a partially-rendered diagram can satisfy the probe).
- **Locations:** architecture.md 89-91, 107; src/pdfRenderer.ts 110-136
- **Affected req:** FR-24; **Components:** WebDriverPdfRenderer

### Issue 11 — `BrowserNotFoundError` message omits the promised provisioning guidance
- **Category:** happy_path_only
- **Severity:** MINOR (criticality 4, confidence 5)
- **Evidence:** architecture.md §8 "`BrowserNotFoundError` reported once on stderr with guidance (install Chrome/Edge/Firefox, or set `MD2PDF_BROWSER`), and the last-resort provisioning path (§11)." || errors.ts:33-50 message lists Chrome/Chromium/Firefox + `MD2PDF_BROWSER` only; no mention of any provisioning fallback; mentions Chrome but not Edge
- **Detail:** §8 says the error message includes "the last-resort provisioning path (§11)." The actual `BrowserNotFoundError` text mentions only installing a browser or setting `MD2PDF_BROWSER`. It also names "Chrome/Edge/Firefox" in the doc but the message lists Chrome, Chromium, Firefox (no Edge), while §3 claims Edge/Brave support. The documented user-facing guidance does not match the shipped string.
- **Locations:** architecture.md 160-162; src/errors.ts 33-50
- **Components:** Md2PdfError hierarchy, BrowserLocator

### Issue 12 — "Stages 1–3 ... are pure functions" but stage 3 writes a temp file
- **Category:** architectural_principle_violation
- **Severity:** SMELL (criticality 3, confidence 4)
- **Evidence:** architecture.md §4 "Stages 1–3 run in Node and are pure functions of their input plus local assets; only stage 4 touches a browser." || markdownRenderer.ts:60-66 `renderToTempHtml` calls `mkdtempSync(...)` and `writeFileSync(htmlPath, html)`
- **Detail:** The document asserts stages 1–3 are pure. Stage 3 as packaged in `renderToTempHtml` performs filesystem side effects (creates a temp dir, writes the HTML file) and `renderToHtml` reads assets and the Mermaid bundle from disk. The pure core (`renderToHtml` string assembly) exists, but the stage as described and invoked by `convertFile` is not pure, falsifying the literal claim.
- **Locations:** architecture.md 64-65; src/markdownRenderer.ts 60-66, 133-137
- **Components:** MarkdownToHtmlRenderer

### Issue 13 — §11 calls `package.json` "the single source of truth" while §2 driver row implies npm lockfile authority; mixed source-of-truth wording
- **Category:** scope_drift
- **Severity:** SMELL (criticality 2, confidence 3)
- **Evidence:** architecture.md §11 "`package.json` is the single source of truth; the lockfile is committed." || repo has `package-lock.json` plus a separate governance artifact `artifacts.json` and `ARTIFACT_FRESHNESS_POLICY.md` that also pin/authorize driver versions, none referenced by the document
- **Detail:** The document declares `package.json` the single source of truth for packaging, but the shipped system introduces a *second* version-governing artifact set (`artifacts.json` + the freshness policy + `checkArtifactFreshness.mjs`) that authorizes driver versions independently of `package.json`. The "single source of truth" assertion is no longer accurate once that subsystem exists, and the document never reconciles the two. Smell rather than defect because packaging deps proper do still live in `package.json`.
- **Locations:** architecture.md 198-199; artifacts.json, ARTIFACT_FRESHNESS_POLICY.md, scripts/checkArtifactFreshness.mjs
- **Components:** (undocumented) freshness governance

---

## Severity tally
- CRITICAL: 2 (Issues 1, 2)
- MAJOR: 5 (Issues 3, 4, 5, 6, 7)
- MINOR: 4 (Issues 8, 9, 10, 11)
- SMELL: 2 (Issues 12, 13)
- **Total: 13**
