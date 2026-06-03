# YAGNI Audit — `src/markdownRenderer.ts` and `src/paths.ts`

**Scope:** Read-only forensic YAGNI audit of two files only.
**Method:** Each exported symbol and each parameter was cross-checked against the whole repo (`src/`, `tests/`) before being flagged. Findings are grounded in quoted code and line numbers.

---

## Detailed Analysis

### `src/paths.ts`

`paths.ts` exports nine symbols. Cross-referencing against the codebase shows a clear split between symbols that are live and a cluster that is dead/superseded:

**Live (used outside paths.ts):**
- `defaultOutputPath`, `outputPathInDirectory`, `resolveEntrySources`, `outputExists`, `ConversionWorkItem` — all imported and used by `src/pipeline.ts`.

**Dead / superseded (exported but used by nothing outside the file, and not in tests):**
- `resolveWorkList` — defined at lines 66–90. Searched across the whole repo: no caller. `pipeline.ts` (lines 95–137) re-implements the same algorithm inline rather than calling it.
- `resolveConversionSources` — defined at lines 62–64. Only caller is `resolveWorkList` (line 77), which is itself dead. No external caller. `pipeline.ts` builds the equivalent `sources` array inline (lines 102–109 via `resolveEntrySources`).
- `WorkListOptions` — interface at lines 10–13. Only referenced by the dead `resolveWorkList` (line 68). `pipeline.ts` carries its own options shape.
- `isMarkdownPath` — exported at line 15, but only ever consumed inside `paths.ts` (lines 20, 44, 55). No external consumer. The `export` is speculative surface.

There is no `tests/unit/paths.test.ts`; `resolveWorkList` / `resolveConversionSources` have zero test coverage, confirming they are not part of any verified requirement path.

The most consequential observation is a DRY/YAGNI pairing: `resolveWorkList` was evidently built as the public "compute the work list" API, but `pipeline.ts` instead inlines the identical validation (`At least one Markdown file…`, `--output and --output-dir are mutually exclusive`, single-file `--output` guard) and the identical `sources.map(...)` output-path computation. The library function is the speculative-generality leftover; the live path forked from it.

### `src/markdownRenderer.ts`

`markdownRenderer.ts` is comparatively lean. Both public exports (`renderToHtml`, `renderToTempHtml`) and the `RenderOptions` interface are used by `converter.ts`, `pipeline`-adjacent code, and tests. The `RenderOptions.sourceFilePath` field is genuinely consumed (line 69). The internal helpers (`readAsset`, `getMermaidBundle`, `imageToDataUri`, `escapeHtml`, `assembleHtml`) are each called.

The residual YAGNI here is minor and lower-confidence:

- `MIME_BY_EXT` (lines 23–31) enumerates seven image extensions with hardcoded MIME types, plus an `?? 'application/octet-stream'` fallback (line 35). The fallback branch can only be reached for an image whose extension is none of the seven AND that nonetheless `existsSync` confirms (line 107) — a defensive path for a case the surrounding image-inlining rule never narrows to a real requirement. This is borderline defensive-coding; flagged Low.
- The `highlight` callback's final line (line 87) re-runs `hljs.highlight(..., { language: 'plaintext' })` as a catch-all for both the "no/unknown language" case and the `catch` fallthrough (lines 83–85). The `try/catch` around `hljs.highlight` with `ignoreIllegals: true` (line 80) guards against an exception that, with `ignoreIllegals` set, is largely defensive. Low confidence — highlight.js can still throw on truly malformed grammars, so this may be justified.

No premature interfaces, factories, strategy patterns, feature flags, or version-shims were found in this file.

---

## Findings

### [YAGNI-Unused Code] `resolveWorkList` is exported but called by nothing

**Location:** `src/paths.ts:66-90`

**Code:**
```ts
export function resolveWorkList(
  entries: string[],
  options: WorkListOptions = {},
): ConversionWorkItem[] {
  if (entries.length === 0) {
    throw new UsageError('At least one Markdown file or directory is required.');
  }
  if (options.outputPath !== undefined && options.outputDir !== undefined) {
    throw new UsageError('--output and --output-dir are mutually exclusive.');
  }
  const sources = resolveConversionSources(entries);
  ...
```

**Issue:** A repo-wide search finds no caller of `resolveWorkList`. The live code path, `src/pipeline.ts` (lines 95–137), re-implements the identical validation and output-path mapping inline rather than calling this function. It is dead, exported, and untested (no `paths.test.ts`).

**Recommendation:** Remove `resolveWorkList`, or make `pipeline.ts` call it and delete the inline duplicate. (Forensic note only — no change made.)

**Confidence:** High
Repo-wide grep returns zero callers; pipeline.ts demonstrably duplicates the logic.

---

### [YAGNI-Unused Code] `resolveConversionSources` is reachable only from the dead `resolveWorkList`

**Location:** `src/paths.ts:62-64`

**Code:**
```ts
export function resolveConversionSources(entries: string[]): string[] {
  return entries.flatMap(resolveEntrySources);
}
```

**Issue:** Its only caller is `resolveWorkList` (line 77), which is itself unused. No external code references it. `pipeline.ts` instead loops over `resolveEntrySources` directly (lines 105–106). It is a thin wrapper that exists for an API surface nobody consumes.

**Confidence:** High
Only internal caller is dead; no external caller exists.

---

### [YAGNI-Speculative Generality] `WorkListOptions` interface used only by dead code

**Location:** `src/paths.ts:10-13`

**Code:**
```ts
export interface WorkListOptions {
  outputPath?: string;
  outputDir?: string;
}
```

**Issue:** This interface is referenced only by the dead `resolveWorkList` parameter (line 68). `pipeline.ts` defines and uses its own options shape and never imports `WorkListOptions`. The exported type is speculative API surface with no live consumer.

**Confidence:** High
Single reference, to dead code.

---

### [YAGNI-Speculative Generality] `isMarkdownPath` exported but only used internally

**Location:** `src/paths.ts:15-17`

**Code:**
```ts
export function isMarkdownPath(path: string): boolean {
  return extname(path).toLowerCase() === '.md';
}
```

**Issue:** `isMarkdownPath` is consumed only inside `paths.ts` (lines 20, 44, 55). No file outside `paths.ts` imports it. The `export` keyword widens the public surface for a need that does not exist.

**Recommendation:** Forensic note only — the export could be dropped to a module-private function without affecting any caller.

**Confidence:** Medium
Function is live and correct; only the `export` is speculative. Lower severity than the fully-dead trio.

---

### [YAGNI-Defensive Coding Excess] MIME fallback branch in `imageToDataUri` is unreachable in practice

**Location:** `src/markdownRenderer.ts:33-38` (fallback at line 35)

**Code:**
```ts
const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';
```

**Issue:** The image-inlining rule (lines 95–115) only reaches `imageToDataUri` for a local file that `existsSync` confirms. The `?? 'application/octet-stream'` branch fires only for an existing file whose extension is not one of the seven enumerated image types — a case the surrounding Markdown-image flow does not produce a requirement for. It is defensive code for an input the current sources do not generate.

**Confidence:** Low
The branch is cheap and arguably safe-by-default; it may be deliberate robustness. Flagged for completeness, not as a clear violation.

---

### [YAGNI-Defensive Coding Excess] Redundant try/catch around `hljs.highlight` with `ignoreIllegals`

**Location:** `src/markdownRenderer.ts:75-88`

**Code:**
```ts
try {
  const highlighted = hljs.highlight(code, {
    language: lang,
    ignoreIllegals: true,
  }).value;
  ...
} catch {
  // fall through to default
}
return `<pre class="hljs"><code>${hljs.highlight(code, { language: 'plaintext' }).value}</code></pre>`;
```

**Issue:** With `ignoreIllegals: true` already set, the inner `hljs.highlight` call is unlikely to throw for ordinary content, so the `try/catch` + plaintext fallthrough is defensive for an error the configuration largely suppresses. The `lang && hljs.getLanguage(lang)` guard (line 76) also already filters to registered languages.

**Confidence:** Low
highlight.js can still throw on malformed grammar internals; the guard may be justified. Flagged only for completeness.

---

## YAGNI Summary

**Total violations found:** 6
- Unused Code: 2
- Premature Abstraction: 0
- Speculative Generality: 2
- Over-Engineering: 0
- Defensive Coding Excess: 2
- Future-Proofing: 0

**Impact Assessment:**
`paths.ts` carries a dead public cluster — `resolveWorkList`, `resolveConversionSources`, and `WorkListOptions` — that duplicates logic the live `pipeline.ts` re-implements inline. This is the material problem: it is untested code that looks like the canonical "build the work list" API but is bypassed, so any future maintainer risks editing the wrong copy (a latent DRY hazard). `isMarkdownPath`'s needless export is cosmetic surface bloat. `markdownRenderer.ts` is essentially clean; its two flagged items are low-confidence defensive branches that may be intentional robustness and have negligible footprint.

**Top Priority Removals:**
1. `resolveWorkList` (`src/paths.ts:66-90`) — fully dead, duplicates pipeline.ts, untested.
2. `resolveConversionSources` (`src/paths.ts:62-64`) — reachable only from the dead `resolveWorkList`.
3. `WorkListOptions` (`src/paths.ts:10-13`) — type used only by the dead code above.

**Severity mapping used for the index:**
- High: `resolveWorkList`, `resolveConversionSources` (2)
- Medium: `WorkListOptions`, `isMarkdownPath` export (2)
- Low: MIME fallback, hljs try/catch (2)
- Critical: 0
