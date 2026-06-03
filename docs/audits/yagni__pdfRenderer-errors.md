# YAGNI Audit — `src/pdfRenderer.ts` and `src/errors.ts`

**Scope:** Read-only forensic YAGNI audit of two files. No remediation performed.
**Date:** 2026-06-03
**Auditor task:** Identify speculative configurability, premature abstraction, unused exports/parameters, and over-engineering, cross-checked against actual repo usage.

---

## Detailed Analysis

Both files were read in full. Every exported symbol and every optional parameter was traced across `src/`, `tests/`, and `scripts/` with `grep` before being flagged. The dominant pattern found is a chain of optional configurability in the render path (`RenderOptions.print`, `RenderOptions.timeoutMs`) that is wired all the way through the call stack but is never populated by any real caller or test — classic YAGNI "just in case we want to configure it later" plumbing. The `errors.ts` file is largely justified (each error class is constructed somewhere), with one minor over-engineering note on duplicated `Object.setPrototypeOf` calls that is borderline-but-defensible, not flagged as a violation.

### Usage cross-check evidence

Error classes (`src/errors.ts`) — all constructed somewhere outside `errors.ts`:
- `Md2PdfError` — referenced/instanceof in `src/pipeline.ts:153`.
- `UsageError` — thrown in `src/paths.ts`, `src/cli.ts`, `src/pipeline.ts`.
- `ConversionError` — thrown in `src/converter.ts:31`, `src/paths.ts`, `src/pipeline.ts`.
- `BrowserNotFoundError` — thrown in `src/browserLocator.ts:228`.
- `DriverNotFoundError` — thrown in `src/driverProvisioner.ts:199,209,216`.
- `RenderError` — thrown in `src/pdfRenderer.ts:186`.
- `ArtifactFreshnessError` — thrown in `src/releaseCatalog.ts:30`; instanceof in `src/driverProvisioner.ts:208`.

Conclusion: no dead error class. `errors.ts` is clean of unused-export YAGNI.

Render options (`src/pdfRenderer.ts`):
- `RenderOptions.print` (line 146) → forwarded to `printPage(port, sessionId, options.print)` at line 183. Grep for `print:` / `.print` population across `src/` and `tests/` returns **zero** call sites that ever set this field. `converter.ts:44–47` constructs `renderOpts` and only ever assigns `timeoutMs`, never `print`.
- `RenderOptions.timeoutMs` (line 144) → `converter.ts:45–46` sets it from `ConvertOptions.renderTimeoutMs`; `renderTimeoutMs` is in turn never set by any caller. The CLI (`src/cli.ts:42–51`) defines no timeout flag and `cli.ts:68–76` builds the pipeline options without any `convertOptions`. `pipeline.ts:150` forwards `options.convertOptions`, which is never populated. So `timeoutMs` is reachable in principle but dead in practice — the default `DEFAULT_RENDER_TIMEOUT_MS` (30 s) is always used.
- There is no unit test for `pdfRenderer.ts` (no file in `tests/unit/` references `renderToPdf`/`pdfRenderer`), so the option is not exercised for test seams either.

---

## Findings

### [YAGNI-SpeculativeGenerality] `RenderOptions.print` is plumbed but never populated by any caller or test

**Location:** `src/pdfRenderer.ts:142–147` (interface), consumed at `src/pdfRenderer.ts:183`

**Code:**
```ts
export interface RenderOptions {
  /** Maximum time in ms to wait for the full render. Default: 30 s. */
  timeoutMs?: number;
  /** Options forwarded to the WebDriver Print command. */
  print?: PrintOptions;
}
...
const pdfBytes = await printPage(port, sessionId, options.print);
```

**Issue:** The `print` field exists solely to forward page-size/margin/background overrides to `printPage`. A repo-wide search for any code that sets `print` returns nothing: the only caller, `convertFile`, builds `renderOpts` at `converter.ts:44–47` and assigns only `timeoutMs`. There is no CLI flag, no pipeline option, and no test that supplies print parameters. `printPage` already applies sensible defaults (A4 page, fixed margins, backgrounds on) at `webDriverClient.ts:103–116`, so the override path is purely speculative — configurability added in anticipation of a need that does not exist in the current spec.

**Recommendation:** Remove the `print` field from `RenderOptions` and call `printPage(port, sessionId)` (letting its defaults apply) until a requirement for configurable page geometry actually lands.

**Confidence:** High
The field is statically wired but has zero population sites anywhere in `src/` or `tests/`.

---

### [YAGNI-SpeculativeGenerality] `RenderOptions.timeoutMs` is configurable end-to-end but never set through any real entry point

**Location:** `src/pdfRenderer.ts:142–147` (interface), consumed at `src/pdfRenderer.ts:165`

**Code:**
```ts
export interface RenderOptions {
  /** Maximum time in ms to wait for the full render. Default: 30 s. */
  timeoutMs?: number;
  ...
}
...
const timeoutMs = options.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS;
```

**Issue:** `timeoutMs` is technically wired (`converter.ts:45–46` copies it from `ConvertOptions.renderTimeoutMs`), but the chain dead-ends: the CLI (`cli.ts:42–51`) exposes no timeout flag, `cli.ts:68–76` constructs the runner options with no `convertOptions`, and `pipeline.ts:150` forwards an always-`undefined` `options.convertOptions`. No test sets it either (grep for `renderTimeoutMs`/`timeoutMs` in `tests/` yields nothing). In every actual execution path `DEFAULT_RENDER_TIMEOUT_MS` (30 s) is used, so the option is speculative flexibility with no current consumer.

**Recommendation:** Either expose a real `--timeout` CLI flag (making the option earn its place against the spec) or collapse the render timeout to the `DEFAULT_RENDER_TIMEOUT_MS` constant and drop the unused parameter chain. Do not keep an option that nothing can set.

**Confidence:** Medium
The plumbing exists across multiple files (the dead-end is partly in out-of-scope `converter.ts`/`cli.ts`), but within the audited file the `timeoutMs` option is provably never supplied by any reachable caller.

---

### [YAGNI-SpeculativeGenerality] `RenderOptions` default-parameter object exists only to carry two never-set fields

**Location:** `src/pdfRenderer.ts:158–165`

**Code:**
```ts
export async function renderToPdf(
  htmlPath: string,
  sourcePath: string,
  browser: LocatedBrowser,
  driver: LocatedDriver,
  options: RenderOptions = {},
): Promise<Buffer> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS;
```

**Issue:** This is the aggregate consequence of the two findings above. The fifth parameter `options: RenderOptions = {}` is, in current practice, always either omitted or passed as an empty/`timeoutMs`-only object (`converter.ts:49`). Given that `print` is never set and `timeoutMs` is never set through a real entry point, the `options` parameter contributes no behavior the defaults wouldn't already provide. It is a configuration seam added ahead of need.

**Recommendation:** If both fields are removed/deferred per the findings above, drop the `options` parameter entirely and rely on the module constants. Reintroduce a parameter when a spec'd, caller-set option exists.

**Confidence:** Medium
Depends on the two findings above; flagged separately because the surplus parameter is itself a maintenance and API-surface cost even if one sub-field is later justified.

---

## YAGNI Summary

**Total violations found:** 3
- Unused Code: 0
- Premature Abstraction: 0
- Speculative Generality: 3
- Over-Engineering: 0
- Defensive Coding Excess: 0
- Future-Proofing: 0

**Impact Assessment:**
The violations are concentrated in the optional-configuration surface of `renderToPdf`. None are dangerous, but together they form a plumbing chain (`RenderOptions.print`, `RenderOptions.timeoutMs`, the `options` parameter) that is threaded through `converter.ts` → `pipeline.ts` → `cli.ts` yet is never populated by any real caller or test. This adds API surface, suggests configurability that does not exist, and obscures the fact that page geometry and timeout are effectively hardcoded by the defaults in `printPage` and `DEFAULT_RENDER_TIMEOUT_MS`. `src/errors.ts` is clean: every exported error class is constructed somewhere in the codebase, so no unused-export or dead-class YAGNI was found there. The duplicated `Object.setPrototypeOf(this, new.target.prototype)` in each error subclass is a known TypeScript-down-level-compilation idiom and is intentionally not flagged.

**Top Priority Removals:**
1. `RenderOptions.print` (`src/pdfRenderer.ts:146`, consumed at `:183`) — zero population sites anywhere; highest-confidence removal.
2. The `options` parameter of `renderToPdf` (`src/pdfRenderer.ts:163`) — collapses to defaults once the two fields are gone.
3. `RenderOptions.timeoutMs` (`src/pdfRenderer.ts:144`) — defer until a real `--timeout` CLI flag exists, or collapse to the constant.
