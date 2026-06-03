# Code Quality Audit — `src/pdfRenderer.ts` + `src/errors.ts`

- **Project:** md2pdf (v0.1.1)
- **Scope:** `file:src/pdfRenderer.ts`, `file:src/errors.ts`
- **Date:** 2026-06-03
- **Standard:** `/home/me/.claude/AGENTS.md` (function ≤40 lines, file ≤300 lines, fail-fast, no hardcoding, POLA/KISS/YAGNI/DRY/SRP/SOC)
- **Mode:** READ-ONLY forensic audit. No remediation proposed.

---

## detailed_analysis

No function in either file lies about its name in the strict catalog sense — `findFreePort`, `startDriverProcess`, `waitForMermaid`, and `renderToPdf` all do what their names promise. There are **no P0 honesty defects and no hardcoded secrets**. The most consequential defect is instead a **fail-fast / error-fidelity violation** (AGENTS.md §8): `renderToPdf` collapses every caught error into `new RenderError((err as Error).message, sourcePath)` at line 186, discarding the original error's stack trace and `cause`. When a low-level WebDriver, port, or process-spawn failure occurs, the diagnostic chain is severed — the operator sees only a flattened message and cannot reproduce the failure, which directly contradicts the standard's "log at the point of failure with enough context to reproduce it." This is the finding to read first.

The second-order concern is a **double-prefix POLA risk** in the same path. `RenderError`'s constructor (errors.ts line 72-73) unconditionally prepends `Render failed for ${sourcePath}: `. Because `renderToPdf` catches *any* error — including a `RenderError` or other `ConversionError` that may already carry that prefix from a nested call — re-wrapping produces messages like `Render failed for x: Render failed for x: ...`. The catch is too broad: it treats already-typed domain errors identically to raw `Error` objects.

A cluster of smaller issues follows: the `port!` non-null assertion at line 189 is *currently* safe only by a subtle control-flow invariant (the `deleteSession` branch is gated on `sessionId !== undefined`, which can only be set after `port` is assigned) — but that safety is implicit and astonishing to a maintainer reading the `finally` block in isolation (POLA). The `MERMAID_DONE_SCRIPT` is a hand-rolled JS string injected via `executeScript` (KISS / browser-context coupling), and `waitForMermaid` throws a bare `Error` rather than a domain error, inconsistent with the project's typed error hierarchy in errors.ts. The three timeout/poll constants are well-named (good), but the browser CLI flag arrays and capability dictionaries are inline magic data.

In `errors.ts`, the dominant smell is **DRY**: the `this.name = '...'; Object.setPrototypeOf(this, new.target.prototype);` pair is repeated verbatim in all 7 constructors. It is correct (and the prototype-restore is genuinely needed for `instanceof` across compile targets), but it is mechanical copy-paste across 7 classes — any future change to the base-construction protocol is shotgun surgery. `ConversionError.sourcePath` is declared optional (`sourcePath?: string`) yet `RenderError` always supplies it and embeds it in the message — a mild contract looseness. `ArtifactFreshnessError` extends `Md2PdfError` directly (not `ConversionError`), which is defensible but means its exit-code mapping is implicit and undocumented at the type level.

**Security posture.** Threat model: inputs are an HTML file path and a Markdown source path, both already produced upstream in the conversion pipeline (not raw external/network input at this boundary). `pathToFileURL(htmlPath)` (line 166) correctly produces a `file://` URL rather than string-concatenating a path, avoiding URL injection. The driver is spawned with an **array argv** (`spawn(driverPath, [\`--port=${port}\`], …)`, line 49) — no `shell: true`, so there is no command-injection sink even though `port` is interpolated (and `port` is an integer from `findFreePort`, not attacker-controlled). `stdio: 'ignore'` means driver stderr is discarded, which is a *diagnostics* weakness, not a security one. No secrets, no unsafe deserialization, no SSRF beyond the intended `file://` navigation. The `MERMAID_DONE_SCRIPT` executes in the headless browser against locally-generated content; if upstream Markdown can embed arbitrary HTML/JS into the assembled page, that is an upstream-boundary concern, not a defect of these two files. **No exploitable boundary observed in the audited scope.**

**Verdict:** AUDIT_WEAK. No CRITICAL, no P0. One MAJOR fail-fast/error-fidelity defect, one MAJOR POLA double-wrap risk, plus design-principle (DRY, KISS) and hygiene findings.

---

## findings

### 0001_SILENT_SWALLOWING_P2 — error stack/cause discarded on wrap
- **priority:** P2
- **anti_pattern_class:** SILENT_SWALLOWING
- **file:** `src/pdfRenderer.ts`
- **line:** 185-186
- **function_or_class:** `renderToPdf`
- **severity:** MAJOR
- **security_concern:** null
- **metrics:** { "original_stack_preserved": false, "cause_chained": false }
- **evidence:**
```ts
} catch (err) {
  throw new RenderError((err as Error).message, sourcePath);
}
```
- **problem:** Every error from `findFreePort`, `startDriverProcess`, `waitForDriverReady`, `newSession`, `navigateTo`, `waitForMermaid`, or `printPage` is reduced to its `.message` string. The original `Error` object — its stack trace, its concrete subtype, and any `cause` — is thrown away; `RenderError` is constructed without `{ cause: err }`. This violates AGENTS.md §8 ("log at the point of failure with enough context to reproduce it"). A maintainer debugging a render failure gets a single flattened sentence and no stack into the WebDriver layer. The `(err as Error)` cast is also unsound: a thrown non-Error (string, undefined) would yield `undefined` for `.message`.
- **affected_axis:** correctness

### 0002_POLA_P1 — broad catch re-wraps already-typed errors, double-prefixing the message
- **priority:** P1
- **anti_pattern_class:** POLA
- **file:** `src/pdfRenderer.ts`
- **line:** 185-186 (sink); `src/errors.ts` line 72-73 (prefix source)
- **function_or_class:** `renderToPdf` / `RenderError.constructor`
- **severity:** MAJOR
- **security_concern:** null
- **metrics:** { "catch_breadth": "any", "prefix_idempotent": false }
- **evidence:**
```ts
// pdfRenderer.ts:185
} catch (err) {
  throw new RenderError((err as Error).message, sourcePath);
// errors.ts:72
constructor(message: string, sourcePath: string) {
  super(`Render failed for ${sourcePath}: ${message}`, sourcePath);
```
- **problem:** The `catch (err)` is unconditional — it catches raw `Error`s *and* any `ConversionError`/`RenderError` already raised by a nested helper. `RenderError` always prepends `Render failed for ${sourcePath}: `, and the prefix is not idempotent. If any callee throws a `RenderError` (or another already-prefixed domain error), re-wrapping yields `Render failed for x: Render failed for x: <message>`. A reader of the signature expects one clean domain error per failure, not a stacked prefix; this is a least-astonishment violation in the public render path.
- **affected_axis:** correctness

### 0003_DRY_P1 — name + setPrototypeOf boilerplate repeated across all 7 error constructors
- **priority:** P1
- **anti_pattern_class:** DRY
- **file:** `src/errors.ts`
- **line:** 3-6, 13-15, 26-27, 48-49, 65-66, 74-75, 82-84
- **function_or_class:** all error classes
- **severity:** WARNING
- **security_concern:** null
- **metrics:** { "duplicated_blocks": 7, "lines_per_block": 2 }
- **evidence:**
```ts
this.name = 'UsageError';
Object.setPrototypeOf(this, new.target.prototype);
// ...identical pair repeated verbatim in 7 constructors
```
- **problem:** The two-line `this.name = '<ClassName>'; Object.setPrototypeOf(this, new.target.prototype);` block is copy-pasted into every one of the 7 constructors. The prototype-restore is genuinely required (the comment at line 5 is correct), but the duplication makes any change to the base-construction protocol shotgun surgery across 7 sites, and a copy-paste slip in `this.name` would go unnoticed. One logical concern (subclass identity bootstrap) has no single authoritative representation.
- **affected_axis:** maintainability

### 0004_POLA_P1 — `port!` non-null assertion relies on an implicit cross-statement invariant
- **priority:** P1
- **anti_pattern_class:** POLA
- **file:** `src/pdfRenderer.ts`
- **line:** 168-189
- **function_or_class:** `renderToPdf` (finally block)
- **severity:** WARNING
- **security_concern:** null
- **metrics:** { "non_null_assertions": 1, "invariant_explicit": false }
- **evidence:**
```ts
let port: number;            // line 168 — declared, not initialized
...
if (sessionId !== undefined) {
  try { await deleteSession(port!, sessionId); } catch { /* ignore */ }
}
```
- **problem:** `port` is a `let port: number;` with no initializer. The `finally` block reads it via `port!`, suppressing the compiler's definite-assignment concern. It is *currently* safe only because the guard `sessionId !== undefined` can be true only after `port = await findFreePort()` succeeded — but that coupling between two distant statements is invisible at the assertion site. A future edit that sets `sessionId` earlier, or reorders the try body, silently reintroduces a use of an unassigned `port`. The `!` operator suppresses exactly the check that would catch it (fail-fast erosion, AGENTS.md §8).
- **affected_axis:** correctness

### 0005_SOC_P1 — domain error hierarchy bypassed; `waitForMermaid` throws bare `Error`
- **priority:** P1
- **anti_pattern_class:** SOC
- **file:** `src/pdfRenderer.ts`
- **line:** 37, 135
- **function_or_class:** `findFreePort`, `waitForMermaid`
- **severity:** WARNING
- **security_concern:** null
- **metrics:** { "bare_error_throws": 2, "domain_error_available": true }
- **evidence:**
```ts
// line 135
throw new Error('Mermaid diagrams did not finish rendering within the timeout');
// line 37
else reject(new Error('Could not obtain a free port'));
```
- **problem:** The project maintains a typed error hierarchy (`errors.ts`) precisely so failures carry classification and exit-code semantics. Yet two internal failure modes here raise generic `Error`. These are caught and re-wrapped by `renderToPdf`'s catch into `RenderError`, so the type is eventually normalized — but until then the codebase mixes a typed-error concern with bare-throw, and any caller of `waitForMermaid`/`findFreePort` outside `renderToPdf` would receive an untyped error. The error-classification concern leaks across the boundary.
- **affected_axis:** maintainability

### 0006_KISS_P2 — hand-rolled injected JS string for Mermaid completion
- **priority:** P2
- **anti_pattern_class:** KISS
- **file:** `src/pdfRenderer.ts`
- **line:** 115-122
- **function_or_class:** `MERMAID_DONE_SCRIPT`
- **severity:** WARNING
- **security_concern:** null
- **metrics:** { "inline_js_lines": 8, "executed_via": "executeScript string body" }
- **evidence:**
```ts
const MERMAID_DONE_SCRIPT = `
  var elems = Array.from(document.querySelectorAll('.mermaid'));
  if (elems.length === 0) return true;
  return elems.every(function(el) { ... });
`;
```
- **problem:** A multi-line JavaScript program is carried as an untyped template string and shipped to the browser via `executeScript`. It is necessary glue, but it is unlinted, untype-checked, and uses ES5 `var`/`function` to satisfy the WebDriver string-body execution contract — a cognitive context-switch embedded mid-module. The polling-with-string-script approach is the kind of thing AGENTS.md §3 flags: confirm no driver-native "wait for condition" primitive removes the need. Banded P2 (mechanical/complexity), WARNING severity (no observed defect).
- **affected_axis:** structure

### 0007_MAGIC_STRING_P3 — inline browser flag arrays and capability dictionaries
- **priority:** P3
- **anti_pattern_class:** MAGIC_STRING
- **file:** `src/pdfRenderer.ts`
- **line:** 73-79, 92-95
- **function_or_class:** `chromeCapabilities`, `firefoxCapabilities`
- **severity:** INFO
- **security_concern:** null
- **metrics:** { "inline_flag_literals": 5, "inline_pref_literals": 1 }
- **evidence:**
```ts
args: ['--headless=new','--no-proxy-server','--disable-gpu',
       '--disable-extensions','--window-size=1920,1080'],
...
prefs: { 'network.proxy.type': 0 },
```
- **problem:** Browser launch flags and the `--window-size=1920,1080` viewport are inlined as bare string literals with no named constant for the load-bearing values (viewport dimensions, headless mode). AGENTS.md §9 asks that magic values be named with unit/intent. Cosmetic — these are co-located and reasonably readable — hence INFO, but the `1920,1080` viewport in particular is a tuning knob with no name.
- **affected_axis:** maintainability

### 0008_YAGNI_P3 — `ConversionError.sourcePath` optional but always supplied by `RenderError`
- **priority:** P3
- **anti_pattern_class:** YAGNI
- **file:** `src/errors.ts`
- **line:** 22-24, 72-73
- **function_or_class:** `ConversionError` / `RenderError`
- **severity:** INFO
- **security_concern:** null
- **metrics:** { "param_optional": true, "always_passed_by_subclass": true }
- **evidence:**
```ts
// ConversionError
public readonly sourcePath?: string,
// RenderError forwards a *required* sourcePath into the optional slot
super(`Render failed for ${sourcePath}: ${message}`, sourcePath);
```
- **problem:** `ConversionError.sourcePath` is declared optional. `RenderError` takes a *required* `sourcePath` and always passes it through, and `BrowserNotFoundError`/`DriverNotFoundError` never pass one. The optionality is a real contract loosening: a consumer cannot rely on `ConversionError.sourcePath` being present, so it must null-check even for `RenderError` instances where it is guaranteed. Minor contract slack; INFO.
- **affected_axis:** maintainability

---

## aggregate_scores
- correctness: 0.5 (capped by 0001/0002 MAJOR on the render error path)
- structure: 0.75
- security: 1.0 (no exploitable boundary in scope; array argv, `pathToFileURL`)
- maintainability: 0.75
- **code_score: 0.5**
- weakest_axis: correctness

## priority_summary
- P0: 0
- P1: 3 (0002 MAJOR, 0003 WARNING, 0004 WARNING, 0005 WARNING) — note 0002 is the lone P1 MAJOR
- P2: 2 (0001 MAJOR, 0006 WARNING)
- P3: 2 (INFO)

## severity_counts
- critical: 0
- high (MAJOR): 2  (0001, 0002)
- medium (WARNING): 4  (0003, 0004, 0005, 0006)
- low (INFO): 2  (0007, 0008)
- total: 8

## verdict
**AUDIT_WEAK** — No P0 and no CRITICAL findings, but two MAJOR defects on the render error path (stack/cause discarded; non-idempotent re-wrap) degrade `correctness` to 0.5 and trip the AUDIT_WEAK threshold (≥1 MAJOR finding).
