# YAGNI Audit — webDriverClient.ts, converter.ts, releaseCatalog.ts

**Scope:** Read-only forensic YAGNI audit of three files in the `md2pdf` project.
**Files audited:**
- `src/webDriverClient.ts`
- `src/converter.ts`
- `src/releaseCatalog.ts`

**Method:** Each file read in full. Every exported symbol, parameter, and configuration
field was cross-checked against the rest of the repository (`src/`, `tests/`) using
repo-wide `grep` to determine whether it is actually exercised by a real caller or only
by its own unit test / never at all.

---

## Detailed analysis

The three files are individually small and mostly lean. The YAGNI pressure is concentrated
in **speculative configurability that no caller ever populates**: an entire chain of
print-option plumbing (`ConvertOptions` → `RenderOptions.print` → `PrintOptions`) exists,
but every link is left at its default by every caller, so the configurable surface is dead
weight. A secondary cluster is **exported-but-internally-unused helpers** (`isEligible`) and
**parameters with no non-default call site** (`executeScript`'s `args`).

Cross-checking established the following caller facts (evidence cited per finding):

- `PrintOptions.print` is only ever read at `pdfRenderer.ts:183` as `printPage(port, sessionId, options.print)`, and `options.print` is **never set** anywhere — confirmed by `grep "print:"` returning zero assignments in `src/` and `tests/`.
- `ConvertOptions.renderTimeoutMs` and `ConvertOptions.provisioner` are never set by the CLI or by any test of `convertFile` — the integration tests call `convertFile(src, out)` with no third argument (`tests/integration/endToEnd.test.ts:122,143,164,183`).
- `isEligible` (releaseCatalog.ts:11) is exported and imported only by its own unit test (`tests/unit/releaseCatalog.test.ts:3`); production code in the same file re-implements the identical predicate inline (releaseCatalog.ts:27) instead of calling it.
- `executeScript`'s `args` parameter (webDriverClient.ts:81) is only ever invoked at `pdfRenderer.ts:131` with no `args` argument (default `[]`).

These are the substantive findings, ordered below by severity.

---

## Findings

### [YAGNI-Speculative-Generality] `PrintOptions` is fully configurable but no caller ever configures it

**Location:** `src/webDriverClient.ts:93-127` (with consumer `src/pdfRenderer.ts:142-147, 183`)

**Code:**
```ts
export interface PrintOptions {
  /** Page dimensions in cm. Defaults to A4. */
  page?: { width: number; height: number };
  /** Margins in cm. */
  margin?: { top: number; bottom: number; left: number; right: number };
  /** Include CSS backgrounds. */
  background?: boolean;
  shrinkToFit?: boolean;
}

const A4 = { width: 21.0, height: 29.7 };
const DEFAULT_MARGIN = { top: 2.0, bottom: 2.0, left: 2.5, right: 2.5 };

export async function printPage(
  port: number,
  sessionId: string,
  options: PrintOptions = {},
): Promise<Buffer> {
  const params = {
    page: options.page ?? A4,
    margin: options.margin ?? DEFAULT_MARGIN,
    background: options.background ?? true,
    shrinkToFit: options.shrinkToFit ?? true,
  };
  ...
```

**Issue:** Every field of `PrintOptions` (`page`, `margin`, `background`, `shrinkToFit`) is
optional and falls back to a hardcoded default. The only call to `printPage` is
`pdfRenderer.ts:183`: `await printPage(port, sessionId, options.print)`, and `options.print`
is **never assigned by any caller** in the repo. A repo-wide search for `print:` returns no
assignment in `src/` or `tests/`; the only matches setting `page:`/`margin:`/`background:`
are inside `webDriverClient.ts` itself (the default expressions) plus an unrelated CSS string
in `markdownRenderer.ts:160`. Consequently `printPage` always receives `{}` and the four
default branches always fire. The configurable surface is purely speculative ("we might want
to expose page size / margins one day") and is currently dead.

**Recommendation:** Defer — collapse `PrintOptions` to the constants actually used until a
real caller needs per-call print configuration.

**Confidence:** High — zero call site populates any `PrintOptions` field; verified by
exhaustive grep across `src/` and `tests/`.

---

### [YAGNI-Speculative-Generality] `RenderOptions.print` pass-through is never populated

**Location:** `src/pdfRenderer.ts:142-147, 183` (and consumed defaultward from `src/converter.ts:44-49`)

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

`converter.ts` builds `RenderOptions` and only ever sets `timeoutMs`:
```ts
const renderOpts: RenderOptions = {};
if (options.renderTimeoutMs !== undefined) {
  renderOpts.timeoutMs = options.renderTimeoutMs;
}
const pdfBytes = await renderToPdf(htmlPath, sourcePath, browser, driver, renderOpts);
```

**Issue:** `RenderOptions.print` exists solely to forward a `PrintOptions` no caller supplies.
`converter.ts:44-47` — the only place that constructs a `RenderOptions` for `renderToPdf` —
never touches `print`. This finding is the upstream half of the previous one: the entire
`ConvertOptions`-less → `RenderOptions.print` → `PrintOptions` plumbing carries no data.

**Confidence:** High — `converter.ts` is the sole production constructor of `RenderOptions`
and provably omits `print`. (Reported here because `converter.ts` is in scope; the `print?`
field declaration lives in the out-of-scope `pdfRenderer.ts`, noted for traceability.)

---

### [YAGNI-Unused-Code] `isEligible` is exported, never used in production, and duplicates inline logic

**Location:** `src/releaseCatalog.ts:10-13` vs `src/releaseCatalog.ts:25-38`

**Code:**
```ts
/** True when a release is old enough to have cleared the quarantine. */
export function isEligible(publishedAt: Date, now = new Date()): boolean {
  return publishedAt.getTime() <= quarantineCutoff(now).getTime();
}
...
export function selectNewestEligible(releases: Release[], now = new Date()): Release {
  const cutoff = quarantineCutoff(now);
  const eligible = releases.filter(r => r.publishedAt.getTime() <= cutoff.getTime());
  ...
```

**Issue:** `isEligible` is consumed only by its own unit test (`tests/unit/releaseCatalog.test.ts:3,21-42`),
never by any production code. The one production site that needs the eligibility predicate —
`selectNewestEligible` at line 27 — **re-implements it inline**
(`r.publishedAt.getTime() <= cutoff.getTime()`) instead of calling `isEligible`. So the
exported function is a YAGNI/DRY artifact: a public helper kept "in case someone needs to
check a single release", while the actual filter open-codes the same comparison. The export
exists for the test, not for a consumer.

**Recommendation:** Defer/remove — either have `selectNewestEligible` call `isEligible`
(removing the duplicated predicate), or drop the standalone export since nothing in production
calls it. Flagged as a defect, not remediated.

**Confidence:** High — grep shows `isEligible` imported only in its own test file; no
production import exists.

---

### [YAGNI-Unused-Code] `executeScript`'s `args` parameter and generic `<T>` flexibility are never exercised

**Location:** `src/webDriverClient.ts:77-87` (sole caller `src/pdfRenderer.ts:131`)

**Code:**
```ts
export async function executeScript<T>(
  port: number,
  sessionId: string,
  script: string,
  args: unknown[] = [],
): Promise<T> {
  return (await wd(port, 'POST', `/session/${sessionId}/execute/sync`, {
    script,
    args,
  })) as T;
}
```

**Issue:** The single call site is `pdfRenderer.ts:131`:
`await executeScript<boolean>(port, sessionId, MERMAID_DONE_SCRIPT)` — it passes no `args`,
so the `args` parameter is always its default `[]`. The parameter exists purely for a
hypothetical future script that needs WebDriver arguments. The generic `<T>` is mildly
justified (the one caller specializes it to `boolean`), but `args` is pure speculative
generality given a single zero-argument caller.

**Recommendation:** Defer — drop the unused `args` parameter (or keep `<T>` only) until a
caller actually passes script arguments.

**Confidence:** Medium — `args` is provably never populated by the only caller, but a thin
WebDriver client wrapper plausibly mirrors the W3C endpoint signature deliberately; that
mirroring is itself the YAGNI question.

---

### [YAGNI-Speculative-Generality] `ConvertOptions.renderTimeoutMs` is plumbed but never set by any caller

**Location:** `src/converter.ts:8-13, 44-47`; pass-through at `src/pipeline.ts:46, 150`

**Code:**
```ts
export interface ConvertOptions {
  /** Override the default render timeout. */
  renderTimeoutMs?: number;
  /** Injectable driver provisioner — used in tests to avoid real downloads. */
  provisioner?: DriverProvisioner;
}
...
const renderOpts: RenderOptions = {};
if (options.renderTimeoutMs !== undefined) {
  renderOpts.timeoutMs = options.renderTimeoutMs;
}
```

**Issue:** `renderTimeoutMs` is an override knob that no caller ever sets. The pipeline
forwards `options.convertOptions` to the converter (`pipeline.ts:150`), but the CLI
(`cli.ts`) never constructs a `convertOptions` with `renderTimeoutMs`, and no test of
`convertFile` supplies it (integration tests call `convertFile(src, out)` with two args:
`tests/integration/endToEnd.test.ts:122,143,164,183`). The guarded copy at lines 45-46 is
therefore an always-skipped branch in practice — speculative configurability for a timeout
override that nothing requests.

**Recommendation:** Defer — remove the override until a real surface (e.g. a CLI flag) needs it.

**Confidence:** Medium — provably unset in current code/tests, but timeout overrides are a
common near-term need and the plumbing is cheap; could be intended for an imminent CLI flag.

---

### [YAGNI-Speculative-Generality] `ConvertOptions.provisioner` injection point is unused at the `convertFile` layer

**Location:** `src/converter.ts:11-12, 42`

**Code:**
```ts
  /** Injectable driver provisioner — used in tests to avoid real downloads. */
  provisioner?: DriverProvisioner;
...
const { browser, driver } = await locateBrowserAndDriver(options.provisioner);
```

**Issue:** The doc comment claims `provisioner` is "used in tests to avoid real downloads",
but no test injects a provisioner through `convertFile`. The provisioner seam is actually
exercised one layer down, at `locateDriver`/`locateBrowserAndDriver`
(`tests/unit/browserLocator.test.ts:162-176`), which already accept a `provisioner` argument
directly. So `ConvertOptions.provisioner` re-exposes an injection point at a higher layer
that no test (and no production caller) uses — speculative test-seam duplication.

**Recommendation:** Defer / verify — the seam is plausibly intended for a future
`convertFile`-level integration test; today it has no consumer. Flagged, not remediated.

**Confidence:** Low — dependency-injection seams are explicitly carved out from YAGNI flagging
when they serve testing, and this one *is* the documented test seam (just exercised one layer
lower). Reported at low confidence because a `convertFile`-level test could legitimately
adopt it, and the audit rules protect DI-for-testing.

---

## Non-findings (verified clean)

- **`waitForDriverReady`, `newSession`, `deleteSession`, `navigateTo`, `printPage`** — all
  exported and genuinely consumed by `pdfRenderer.ts` (lines 176, 178, 189, 180, 183). Not YAGNI.
- **`quarantineCutoff`, `selectNewestEligible`, `QUARANTINE_DAYS`, `Release`** — used in
  production (`driverProvisioner.ts:17,206`) and/or internally; `QUARANTINE_DAYS` is a named
  constant per the no-magic-number rule, not speculative. Not YAGNI.
- **`converter.ts` atomic temp-file write + `finally` cleanup** (lines 51-62) — addresses a
  real, current requirement (no partial output on failure), evidenced by
  `tests/integration/endToEnd.test.ts:183-194`. Not over-engineering.
- **`wd()` content-type/body conditional** (webDriverClient.ts:25-26) — both branches are
  exercised (DELETE session has no body; POST endpoints do). Not dead.

---

## YAGNI Summary

**Total violations found:** 6
- Unused Code: 2 (`isEligible`, `executeScript` `args`)
- Premature Abstraction: 0
- Speculative Generality: 4 (`PrintOptions`, `RenderOptions.print`, `ConvertOptions.renderTimeoutMs`, `ConvertOptions.provisioner`)
- Over-Engineering: 0
- Defensive Coding Excess: 0
- Future-Proofing: 0

**Severity tally:**
- Critical: 0
- High: 3 (`PrintOptions` unconfigured; `RenderOptions.print` unpopulated; `isEligible` unused + duplicated)
- Medium: 2 (`executeScript` `args`; `ConvertOptions.renderTimeoutMs`)
- Low: 1 (`ConvertOptions.provisioner`)

**Impact Assessment:** The dominant problem is a multi-layer print-configuration channel
(`ConvertOptions` → `RenderOptions.print` → `PrintOptions`) that carries no data: four
optional fields, two module-level default constants, and three forwarding hops exist so that
hardcoded A4/margin/background/shrink defaults can always win. This inflates the public API
surface and the cognitive cost of reading the render path without delivering any current
capability. The `isEligible` export adds a DRY violation on top of being production-unused.
None of the findings threaten correctness; the cost is maintainability and API-surface bloat.

**Top Priority Removals:**
1. The `PrintOptions` configurable surface + its `RenderOptions.print` forwarding — never populated end to end (collapse to the constants actually used).
2. `isEligible` — production-unused export whose logic is already inlined in `selectNewestEligible` (either call it or drop it).
3. `ConvertOptions.renderTimeoutMs` — an override knob with no caller (defer until a CLI flag needs it).
