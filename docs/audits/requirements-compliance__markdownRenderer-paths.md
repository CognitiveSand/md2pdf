# Requirements Compliance Findings: markdownRenderer.ts, paths.ts

**Audit Date:** 2026-06-03
**Files Audited:**
- `/home/me/github/md2pdf/src/markdownRenderer.ts`
- `/home/me/github/md2pdf/src/paths.ts`
**Reference docs:** `docs/project_requirements.md`, `docs/architecture.md`, `src/errors.ts`
**Auditor:** Requirements Compliance Auditor Agent
**Mode:** READ-ONLY forensic audit (no remediation performed)

---

## Executive Summary

The two audited modules implement the Node-side stages of the conversion pipeline. `markdownRenderer.ts` (architecture component `MarkdownToHtmlRenderer`, serving FR-04, FR-05, FR-06, FR-24, NFR-02) and `paths.ts` (component `OutputPathResolver` / `ConversionEntryResolver`, serving FR-02, FR-03, FR-09, FR-23) cover the bulk of their assigned requirements at the implementation level. However, the audit found multiple defects: a verifiable architecture/code contradiction in the Mermaid emission (`<div>` vs the architecture's `<pre>`), a non-recursive-traversal requirement (OOS-02) that is correctly honoured but a directory-batch ordering and error-handling gap, an FR-09 silent-skip behaviour that conflicts with the fail-loud FR-15 reporting intent, and a complete absence of any test file or `@req` traceability tags for `paths.ts` — which directly violates the requirements document's own traceability mandate (§10) and architecture §15.

- **Requirements traced to these files (per architecture §5):** 8 distinct (FR-02, FR-03, FR-04, FR-05, FR-06, FR-09, FR-23, FR-24) + cross-cutting NFR-02
- **Fully implemented & traceable:** 4
- **Partially implemented / with defects:** 4
- **Untraceable (no test / no `@req` tag):** all 8 (no requirement reference appears in either source file; `paths.ts` has zero test coverage)
- **Architecture/code contradictions:** 1 (Mermaid `<div>` vs `<pre>`)

Severity counts: **Critical 0 · High 3 · Medium 5 · Low 4 · Total 12**

---

## Requirement Coverage Matrix

| Req ID | Title | File | Referenced (`@req`) | Implemented | Status |
|---|---|---|---|---|---|
| FR-02 | Default output path | paths.ts | No | Full | Untraceable (no test) |
| FR-03 | Explicit output path | paths.ts | No | Partial | Defect (see F-07) |
| FR-04 | Dialect rendering | markdownRenderer.ts | No | Partial | Defect (see F-04) |
| FR-05 | Code syntax highlighting | markdownRenderer.ts | No | Full | Untraceable |
| FR-06 | Relative image embedding | markdownRenderer.ts | No | Partial | Defect (see F-05) |
| FR-09 | Directory batch (top-level only) | paths.ts | No | Partial | Defect (see F-06, F-08) |
| FR-23 | Output-directory option | paths.ts | No | Full | Untraceable |
| FR-24 | Mermaid diagram rendering | markdownRenderer.ts | No | Partial | Contradiction (see F-01) |
| NFR-02 | Local-only processing | markdownRenderer.ts | No | Full (by construction) | Advisory (see F-12) |
| OOS-02 | Non-recursive traversal | paths.ts | No | Full | Compliant |

---

## Detailed Findings

### F-01 — Mermaid emission contradicts the architecture (`<div>` vs `<pre>`) — HIGH

**Requirement:** FR-24 (Mermaid diagram rendering), governed by architecture §4 stage 1 and ADR-01.

**Evidence — architecture says `<pre>`:**
`docs/architecture.md:79`:
> "Fenced code tagged `mermaid` is emitted as a diagram placeholder (`<pre class="mermaid">`), left for the browser to render."

**Evidence — code emits `<div>`:**
`src/markdownRenderer.ts:124`:
```ts
return `<div class="mermaid">\n${escapeHtml(token.content.trim())}\n</div>\n`;
```

The architecture document is authoritative on internal structure (architecture.md:11–13) and explicitly states `<pre class="mermaid">`. The code emits `<div class="mermaid">`. This is a concrete, citable contradiction between the authoritative mechanism description and the implementation. While `<div class="mermaid">` is the conventional Mermaid selector and is likely the *correct* element, the divergence means one of the two governance/code artifacts is a defect of record. Per the doc's own rule (architecture.md:11–13) the requirement wins and "this document is the defect," but the contradiction is unresolved in-repo and must be flagged. The audit does not propose which side to change.

**Status:** FR-24 partially compliant — implemented but contradicts its authoritative mechanism spec.

---

### F-02 — No `@req` traceability tags in either source file — HIGH

**Requirement:** project_requirements.md §10 (Traceability notes) and architecture.md §15.

**Evidence:** `project_requirements.md:148-153`:
> "Downward traceability to verification evidence is to be maintained by tagging each test with its requirement ID (for example `@req FR-08`) so the traceability matrix can be generated from the test suite."

`grep -n "@req"` across `src/markdownRenderer.ts` and `src/paths.ts` returns zero matches. `grep -n "@req" tests/unit/markdownRenderer.test.ts` also returns zero matches. The functions that materially implement FR-02/03/04/05/06/09/23/24 carry no requirement reference of any kind, and the one existing test (`tests/unit/markdownRenderer.test.ts`) is untagged. The traceability matrix described in §10 / §15 cannot be generated from the suite for these modules.

**Status:** Traceability mandate unmet for both files.

---

### F-03 — `paths.ts` has no test file; FR-02/FR-03/FR-09/FR-23 unverified — HIGH

**Requirement:** architecture.md §15 maps FR-03/FR-23 to a contract test and FR-01/FR-02 to integration tests; AGENTS.md §7 mandates ≥1 test per requirement.

**Evidence:** Directory listing of `tests/unit`:
```
browserLocator.test.ts  checkArtifactFreshness.test.ts  cli.test.ts
driverProvisioner.test.ts  markdownRenderer.test.ts  pipeline.test.ts
releaseCatalog.test.ts
```
There is no `paths.test.ts`. `grep -rln "defaultOutputPath\|resolveWorkList\|outputPathInDirectory\|resolveEntrySources"` across `tests/` returns no test importing the `paths.ts` public surface (the lone `tests/unit/checkArtifactFreshness.test.ts` "paths" hit is an unrelated string `'skips exempt paths'`). All four requirements assigned to `paths.ts` in architecture §5 (FR-02, FR-03, FR-09, FR-23) plus the mutual-exclusion / single-output usage guards (paths.ts:73-81) are unverified by any automated test.

**Status:** FR-02, FR-03, FR-09, FR-23 untraceable — no verification evidence exists for the module that owns them.

---

### F-04 — `html: false` may drop raw-HTML constructs claimed by the dialect — MEDIUM

**Requirement:** FR-04 (render the supported Markdown dialect); glossary defines the dialect as "CommonMark, plus … pipe tables, fenced code blocks …, task-list checkboxes, and footnotes" (project_requirements.md:23).

**Evidence:** `src/markdownRenderer.ts:71-72`:
```ts
const md = new MarkdownIt({
    html: false,
```
With `html: false`, markdown-it escapes inline and block raw HTML rather than passing it through. CommonMark *includes* raw HTML blocks and inline HTML as part of the spec. The glossary defines the dialect as "CommonMark plus …" extensions, so a strict reading of FR-04 requires CommonMark raw-HTML handling. The current setting silently renders raw HTML as escaped text. This may be an intentional safety choice, but it is undocumented in the architecture and is a partial divergence from the literal dialect definition. No `@req` note or comment justifies the deviation.

**Status:** FR-04 partial — the extension set (tables via default, task lists, footnotes, fenced code) is wired (markdownRenderer.ts:90-91), but CommonMark raw-HTML is suppressed without traceable justification.

---

### F-05 — Relative-image embedding silently skips missing images, conflicting with fail-loud FR-16 — MEDIUM

**Requirement:** FR-06 (embed referenced relative image), and the fail-loud intent of FR-15/FR-16 and AGENTS.md §8.

**Evidence:** `src/markdownRenderer.ts:106-110`:
```ts
const imgPath = resolve(sourceDir, src);
if (existsSync(imgPath)) {
    token.attrs[srcIdx][1] = imageToDataUri(imgPath);
}
```
When a relative image path does not exist on disk, the `if (existsSync(...))` guard is false and the original `src` is left untouched — the token then renders an `<img src="relative/path">` that, loaded over a `file:` URL from a temp directory (renderToTempHtml, markdownRenderer.ts:60-66), will resolve against the temp dir and produce a broken image with no error, warning, or stderr report. FR-06 says md2pdf "shall embed that image"; the assumption in project_requirements.md:48 ("Images referenced by relative path exist … at conversion time") covers the happy path, but the silent broken-image outcome on a missing image contradicts the clear-error / fail-loud posture (FR-15, FR-16; AGENTS.md §8 "Avoid returning null as a stealth error signal"). No `RenderError` is raised.

A secondary concern: `imageToDataUri` (markdownRenderer.ts:33-38) calls `readFileSync(imgPath)` with no try/catch; a path that passes `existsSync` but is unreadable (permissions, race) throws a raw `Error`, not the typed `RenderError`/`ConversionError` the architecture §8 / errors.ts hierarchy mandates for per-document failures.

**Status:** FR-06 partial; fail-loud defect.

---

### F-06 — Directory traversal silently swallows stat failures, masking unreadable entries (FR-15 tension) — MEDIUM

**Requirement:** FR-09 (convert each top-level Markdown file) and FR-15 (report unreadable paths on stderr).

**Evidence:** `src/paths.ts:41-53`:
```ts
if (stats.isDirectory()) {
    return readdirSync(entryPath)
      .filter(isMarkdownPath)
      .sort((a, b) => a.localeCompare(b))
      .map(name => join(entryPath, name))
      .filter(path => {
        try {
          return statSync(path).isFile();
        } catch {
          return false;
        }
      });
}
```
Inside directory expansion, a `.md` entry whose `statSync` throws (e.g. dangling symlink, permission error) is silently dropped via the empty `catch { return false; }`. FR-15 requires md2pdf to "report the offending path on standard error and exclude it from conversion" — exclusion happens, but the mandated stderr report does not. This is a fail-loud gap: an unreadable in-directory `.md` file vanishes from the work-list with no diagnostic. Contrast with the top-level entry path (paths.ts:34-39) which does throw `ConversionError` with the offending path.

**Status:** FR-09 partial; FR-15 not honoured for in-directory unreadable entries.

---

### F-07 — `defaultOutputPath` produces a non-`.md` fallback that the glossary's "default output path" does not define — MEDIUM

**Requirement:** FR-02 + glossary "default output path" = "the Markdown source file path with its `.md` extension replaced by `.pdf`" (project_requirements.md:26).

**Evidence:** `src/paths.ts:19-24`:
```ts
export function defaultOutputPath(sourcePath: string): string {
  if (!isMarkdownPath(sourcePath)) {
    return `${sourcePath}.pdf`;
  }
  return join(dirname(sourcePath), `${basename(sourcePath, extname(sourcePath))}.pdf`);
}
```
The glossary's "default output path" is defined *only* for a Markdown source file (one whose extension is `.md`). The `!isMarkdownPath` branch (line 20-21) appends `.pdf` to a non-`.md` path, yielding e.g. `report.txt.pdf`. This is behaviour the requirements do not specify and arguably should be unreachable: `resolveEntrySources` (paths.ts:55-57) rejects non-Markdown files with a `ConversionError`, so a non-`.md` path should never reach `defaultOutputPath` through the normal flow. The branch is therefore either dead defensive code (untested, F-03) or a latent contradiction if any caller bypasses `resolveEntrySources`. It is solution territory the spec is silent on.

**Status:** FR-02 partial — happy path correct; undefined fallback branch is untested and out of spec.

---

### F-08 — Directory batch ordering is locale-dependent, which can make FR-08/FR-09 output order non-deterministic across hosts — MEDIUM

**Requirement:** FR-09 (directory batch) and NFR-03 (platform portability across Linux/macOS/Windows).

**Evidence:** `src/paths.ts:44`:
```ts
.sort((a, b) => a.localeCompare(b))
```
`String.prototype.localeCompare` with no explicit locale/options uses the host's default locale collation, which differs across OSes and locale configurations. Two hosts (NFR-03 names Linux, macOS, Windows) can order the same directory's files differently, making batch processing order — and thus the FR-11 success/fail report ordering and any first-failure-driven behaviour — non-deterministic across the supported platforms. The requirements do not mandate a specific order, but NFR-03 portability intent and reproducibility (AGENTS.md) favour a stable, locale-independent sort.

**Status:** FR-09 functionally met; portability/determinism advisory defect.

---

### F-09 — Mermaid language detection diverges from the FR-24 glossary definition (extra tokens) — LOW

**Requirement:** FR-24 + glossary "Mermaid diagram" = "a fenced code block whose language identifier is `mermaid`" (project_requirements.md:24).

**Evidence:** `src/markdownRenderer.ts:121-122`:
```ts
const lang = token.info.trim().split(/\s+/)[0];
if (lang === 'mermaid') {
```
The detection takes the first whitespace-delimited token of the fence info string. A fence opened as ```` ```mermaid {init: ...} ```` is treated as Mermaid (first token `mermaid`), which is reasonable, but a fence like ```` ```Mermaid ```` (capitalised) is **not** matched because the comparison is case-sensitive, whereas the highlight path at markdownRenderer.ts:76 uses `hljs.getLanguage(lang)` which is case-insensitive. This inconsistency means `Mermaid` falls through to the code-highlight branch and renders as raw text — exactly the outcome FR-24 forbids ("rather than as the block's raw text"). The glossary specifies the identifier `mermaid`; case handling is unspecified, so this is a low-severity edge defect rather than a hard violation.

**Status:** FR-24 edge defect.

---

### F-10 — `getMermaidBundle()` resolves and inlines an artifact with no freshness/version guard at this layer (NFR-05 surface) — LOW

**Requirement:** NFR-05 (artifact freshness policy) — the inlined Mermaid engine is an "artifact" per the glossary (project_requirements.md:32, "bundled engine").

**Evidence:** `src/markdownRenderer.ts:18-21`:
```ts
function getMermaidBundle(): string {
  const mermaidPath = _require.resolve('mermaid/dist/mermaid.min.js');
  return readFileSync(mermaidPath, 'utf8');
}
```
This reads and inlines the Mermaid engine directly from `node_modules` at runtime. NFR-05 governs the *version selection* of this artifact, which is properly a `package.json`/lockfile + freshness-check concern (handled elsewhere per `checkArtifactFreshness.test.ts`), so this module is not the owner. This is recorded as advisory: the inlining point is the runtime manifestation of the freshness-governed Mermaid engine (ADR-02, R-4), and it carries no `@req NFR-05` cross-reference linking it to the policy that governs the bytes it embeds.

**Status:** NFR-05 not owned here; advisory traceability note.

---

### F-11 — `escapeHtml` is incomplete relative to its stated purpose, a latent correctness risk for Mermaid content — LOW

**Requirement:** FR-24 correctness (Mermaid content must reach the browser intact).

**Evidence:** `src/markdownRenderer.ts:40-45` and its use at `:124`:
```ts
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
```
The comment at markdownRenderer.ts:123 states "Escape content so HTML stays valid; Mermaid reads `.textContent` which decodes entities." The function escapes `&`, `<`, `>` but not quotes. Inside the text content of a `<div>` this is sufficient for well-formedness, so it is not a correctness bug in the current placement — but the function is named generically `escapeHtml` (a §4 naming concern: it does not escape all HTML-significant characters) while being a partial escaper. If reused in an attribute context it would be unsafe. Low severity given current single use.

**Status:** Advisory; correct in current use, mis-named and partial as a general utility.

---

### F-12 — Local-only (NFR-02) is met by construction here, but the module performs no assertion of the no-external-URL invariant — LOW / Advisory

**Requirement:** NFR-02 / CON-02 (no outbound connection; no external URL in assembled HTML), architecture §9 / R-3.

**Evidence:** `markdownRenderer.ts:140-179` (`assembleHtml`) inlines `defaultCss`, `highlightCss`, and `mermaidBundle` directly and references no `http:`/`https:` URL — the only external-looking strings are the protocol-prefix *guards* at markdownRenderer.ts:102-104 that deliberately skip remote images. So the module satisfies NFR-02 by construction. However, architecture §9 / R-3 states the local-only guarantee is *structural* and relies on a test asserting "the assembled HTML contains no external URL." That assertion is an integration-test concern; this module embeds no self-check or invariant assertion (AGENTS.md §8 "use assertions to encode invariants"). Recorded as advisory: NFR-02 met, but the structural guarantee has no enforcement point inside the assembling code.

Note: remote image references (markdownRenderer.ts:100-105) are passed through verbatim as `http(s)` `<img src>`; under the offline-launched browser (architecture §9) these simply fail to load. That is consistent with NFR-02 but means an `http://` image silently renders broken — a minor extension of the F-05 silent-broken-image concern.

**Status:** NFR-02 compliant; advisory on missing in-module invariant.

---

## Compliant Requirements (acknowledged)

- **FR-05 (Code syntax highlighting):** `markdownRenderer.ts:75-88` wires `highlight.js`, emits `<pre class="hljs"><code class="language-...">` for recognised languages, and falls back to plaintext highlighting otherwise. Matches ADR-03. (Untraceable per F-02, but functionally complete.)
- **FR-23 (Output-directory option):** `paths.ts:26-28` + `:83-89` correctly compose `outputDir + basename(source).pdf`, and `:73-74` enforces mutual exclusivity with `--output`. Matches FR-23 wording. (Untested per F-03.)
- **FR-03 single-output guard:** `paths.ts:79-81` rejects `--output` when more than one source is produced — matches architecture §6 ("`--output` is rejected when more than one document would be produced").
- **OOS-02 (Non-recursive traversal):** `paths.ts:42-52` uses `readdirSync` (one level) with an `isFile()` filter and never recurses into subdirectories — correctly honours the MVP non-recursive scope.

---

## Coding Convention / Fail-Loud Findings (AGENTS.md)

- **Fail-loud (§8):** Two stealth-failure sites — silent missing-image skip (F-05, markdownRenderer.ts:107) and silent in-directory stat-failure drop (F-06, paths.ts:48-50 empty `catch`). Both swallow conditions the requirements want reported (FR-06/FR-15).
- **Typed errors:** `paths.ts` correctly throws `ConversionError`/`UsageError` from the errors.ts hierarchy (paths.ts:35-38, 56, 71, 74, 80). `markdownRenderer.ts` throws no typed error and lets raw `readFileSync` errors (markdownRenderer.ts:15, 20, 36) propagate untyped, diverging from architecture §8's "every thrown error is a subclass carrying its context."
- **Naming (§4):** `escapeHtml` (F-11) is a partial escaper under a total-sounding name. `_require`/`_dirname` (markdownRenderer.ts:11-12) are single-token underscored names; acceptable for module-local createRequire idioms but borderline against the two-word rule.
- **Magic values / hardcoding (§9):** print margins `2cm 2.5cm` (markdownRenderer.ts:160) and orphans/widows `3` (markdownRenderer.ts:161) are inlined literals embedded in a template string rather than named constants; FR-07 (orphans/widows) lives here as un-named magic numbers. The MIME map (markdownRenderer.ts:23-31) is appropriately named.
- **Function/module size (§3):** Both files are within the 300-line module / 40-line function limits.

---

## Recommendations Summary (identification only — no remediation performed)

1. **High:** Resolve the FR-24 Mermaid `<div>` vs `<pre>` contradiction between code (markdownRenderer.ts:124) and architecture (architecture.md:79) — one is a defect of record.
2. **High:** Add `@req` traceability tags and at minimum a `tests/unit/paths.test.ts` so FR-02/03/09/23 gain the verification evidence §10 / §15 require.
3. **Medium:** Close the two fail-loud gaps (missing image, swallowed in-directory stat error) so FR-06/FR-15 reporting holds.
4. **Medium:** Decide and document the `html: false` stance against the CommonMark-inclusive FR-04 dialect definition.
5. **Low:** Case-insensitive `mermaid` detection; locale-independent directory sort; named constants for FR-07 print rules.

---

## Appendix: Severity tally

| Severity | Findings |
|---|---|
| Critical | (none) |
| High | F-01, F-02, F-03 |
| Medium | F-04, F-05, F-06, F-07, F-08 |
| Low | F-09, F-10, F-11, F-12 |
| **Total** | **12** |
