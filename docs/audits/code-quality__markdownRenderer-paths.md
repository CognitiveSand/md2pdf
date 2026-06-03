# Code-Quality Forensic Audit — `src/markdownRenderer.ts`, `src/paths.ts`

- **Project:** md2pdf (v0.1.1)
- **Scope:** `file:src/markdownRenderer.ts`, `file:src/paths.ts`
- **Date:** 2026-06-03
- **Files analyzed:** 2
- **Total lines:** 274 (markdownRenderer.ts 180, paths.ts 94)
- **Standard applied:** `/home/me/.claude/AGENTS.md` (function ≤ 40 lines, file ≤ 300 lines, fail-fast at boundaries, no hardcoding, two-word naming).

---

## detailed_analysis

There is no outright code lie here — no `validate_*` that mutates, no `is_*` that
does I/O. The strongest defect is a **path-traversal sink** in
`markdownRenderer.ts`: `imageToDataUri` (line 33) is fed `resolve(sourceDir, src)`
(line 106) where `src` is an attacker-controllable relative image path lifted
straight out of the Markdown document. A document containing
`![x](../../../../etc/passwd)` resolves outside the source directory, `existsSync`
passes, and `readFileSync(imgPath)` (line 36) embeds the file's bytes as a base64
data URI into the generated HTML/PDF. There is no `resolve()`-then-prefix-check
against `sourceDir`, so any file the process can read can be exfiltrated into the
output artifact. The threat model: a user converts an untrusted `.md` (downloaded,
received, or generated) → arbitrary local-file read → contents baked into a
shareable PDF. This is the one finding that is concretely exploitable; it lands at
P2 per the deterministic security-band rule, MAJOR severity (local read, not RCE,
single-machine blast radius).

After that, the file is structurally a single oversized function. `renderToHtml`
(lines 68–138) is **71 lines** — nearly double the 40-line ceiling — and braids at
least four concerns into one body: MarkdownIt construction with a highlight
callback (SoC: presentation policy), an image-inlining renderer override
(filesystem I/O), a mermaid fence override (HTML emission), and asset loading +
final assembly. That is an SRP/SoC violation and a `LONG_FUNCTION` at once.

A second-order honesty smell: `escapeHtml` (lines 40–45) is named as a general
HTML escaper but only handles `&`, `<`, `>` — it does **not** escape `"` or `'`.
It happens to be safe at its single call site (text node content of a `<div>`,
line 124), but the generic name over-promises relative to the body; a future
caller who reuses it for an attribute value inherits an XSS hole. POLA / partial
implementation.

`markdownRenderer.ts` also performs **module-load-time work with side effects**:
`createRequire`/`fileURLToPath` at lines 11–12 are cheap, but `getMermaidBundle`
(line 18) and `readAsset` (line 14) do synchronous `readFileSync` of multi-hundred-KB
assets on every `renderToHtml` call rather than once — minor efficiency, noted as
INFO. Mermaid is initialized client-side with `startOnLoad: true` and **no explicit
`securityLevel`** (line 176), relying on the bundled default; that is a
defense-in-depth gap given the input is untrusted Markdown.

`paths.ts` is the cleaner of the two. Its principal defect is a **silent
error-swallowing pattern** at lines 47–51: inside the directory branch a
`statSync(path)` that throws is caught and mapped to `false`, dropping the entry
with no diagnostic — a freshly-deleted or permission-denied file simply vanishes
from the work list with no signal, violating fail-fast (§8). The `catch (err)` at
line 34 binds `err` and never uses it, discarding the underlying OS error cause
when re-throwing `ConversionError`. There is also a mild DRY smell: the
`basename(sourcePath, extname(sourcePath))` + `.pdf` construction is duplicated in
`defaultOutputPath` (line 23) and `outputPathInDirectory` (line 27). Both functions
have honest names and correct bodies, so these are P1/P3, not P0.

### Security posture

Threat model: **user-controlled Markdown file content → local filesystem reads under
the process UID → bytes embedded into the output HTML/PDF; no network egress
observed in these two files.** Input boundaries: the Markdown body and its image
`src` attributes are *unvalidated* — `renderToHtml` resolves and reads any path the
image rule yields (lines 100–109), with no containment check against `sourceDir`.
This boundary is currently exploitable for arbitrary local-file disclosure into the
artifact (path traversal). The code-fence `lang` interpolated into a class
attribute (line 82) is gated by `hljs.getLanguage(lang)` (line 76), which only
returns truthy for registered, identifier-shaped language names, so that path is
**not** a practical injection (defense-in-depth note only). Mermaid renders
untrusted diagram source client-side with the default security level. No hardcoded
secrets. `paths.ts` exposes no network or shell sinks; its `statSync`/`readdirSync`
operate on caller-supplied paths but only stat/list, not execute.

---

## findings

### 0001_INJECTION_P2 — Path traversal in image inlining (arbitrary local-file read into artifact)
- **priority:** P2
- **anti_pattern_class:** INJECTION
- **file:** src/markdownRenderer.ts
- **line:** 106 (sink at 36; gate at 107)
- **function_or_class:** renderToHtml (image renderer override) → imageToDataUri
- **severity:** MAJOR
- **security_concern:** path_traversal
- **evidence (lines 99–109):**
  ```ts
  const src = token.attrs[srcIdx][1];
  if ( src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:') ) {
    const imgPath = resolve(sourceDir, src);
    if (existsSync(imgPath)) {
      token.attrs[srcIdx][1] = imageToDataUri(imgPath);
    }
  }
  ```
  and (lines 33–37):
  ```ts
  function imageToDataUri(imgPath: string): string {
    ...
    const data = readFileSync(imgPath);
    return `data:${mime};base64,${data.toString('base64')}`;
  }
  ```
- **problem:** `src` is read directly from the Markdown image token (attacker-controlled
  document content). `resolve(sourceDir, src)` follows `../` segments out of the source
  directory; there is no `resolve()`-and-prefix-check confirming `imgPath` stays under
  `sourceDir`. Any file readable by the process — `![](../../../../etc/passwd)`,
  `![](~/.ssh/id_rsa)` via absolute path, etc. — is read and base64-embedded into the
  output HTML/PDF. Threat: convert an untrusted `.md` → local-file exfiltration into a
  shareable artifact. MAJOR (local read, not remote/RCE); P2 per the deterministic rule
  for non-secret security findings; caps the `security` axis at 0.5.
- **affected_axis:** security

### 0002_LONG_FUNCTION_P2 — `renderToHtml` is 71 lines with 4 concerns
- **priority:** P2
- **anti_pattern_class:** LONG_FUNCTION
- **file:** src/markdownRenderer.ts
- **line:** 68
- **function_or_class:** renderToHtml
- **severity:** MAJOR
- **security_concern:** null
- **metrics:** { lines: 71, ceiling: 40, concerns: 4 }
- **evidence:** Function spans lines 68–138. It (a) builds a `MarkdownIt` instance with an
  inline `highlight` callback (lines 71–89), (b) overrides the `image` renderer rule with
  filesystem I/O (lines 94–115), (c) overrides the `fence` renderer rule for mermaid
  (lines 118–129), and (d) loads three assets and calls `assembleHtml` (lines 131–137).
- **problem:** Exceeds the project's hard 40-line function ceiling (§3) by 31 lines and
  mixes four responsibilities — syntax-highlighting policy, image I/O, fence transformation,
  and document assembly — in one scope (SRP/SoC). Each override is independently testable
  and reusable but is trapped inside this closure over `sourceDir`/`md`.
- **affected_axis:** structure

### 0003_SRP_P1 — Renderer braids presentation, filesystem I/O, and assembly
- **priority:** P1
- **anti_pattern_class:** SRP
- **file:** src/markdownRenderer.ts
- **line:** 68
- **function_or_class:** renderToHtml
- **severity:** MAJOR
- **security_concern:** null
- **evidence:** Within one function: `hljs.highlight(...)` (lines 78–87, presentation),
  `existsSync` + `imageToDataUri` → `readFileSync` (lines 106–108, filesystem I/O),
  `escapeHtml(token.content...)` (line 124, HTML emission), `readAsset(...)` ×2 and
  `getMermaidBundle()` (lines 133–135, asset I/O).
- **problem:** More than one reason to change: a change to image-resolution policy, to
  highlight markup, to mermaid handling, or to asset packaging all force edits to the same
  function. The filesystem-read concern (the security-sensitive one) is interleaved with
  pure rendering, making the traversal sink (0001) easy to miss in review. Same instance as
  0002 viewed through the responsibility lens; reported separately because the design fix
  (extract the I/O boundary) differs from the size fix.
- **affected_axis:** structure

### 0004_SILENT_SWALLOWING_P2 — Directory entries silently dropped on stat failure
- **priority:** P2
- **anti_pattern_class:** SILENT_SWALLOWING
- **file:** src/paths.ts
- **line:** 49
- **function_or_class:** resolveEntrySources
- **severity:** WARNING
- **security_concern:** null
- **evidence (lines 46–52):**
  ```ts
  .filter(path => {
    try {
      return statSync(path).isFile();
    } catch {
      return false;
    }
  });
  ```
- **problem:** A `statSync` that throws (permission denied, race-deleted entry, broken
  symlink) is swallowed with a bare `catch` and mapped to `false`, silently excluding the
  file from the work list with no log or diagnostic. Violates fail-fast (§8: "never silently
  swallow exceptions"). A user pointing md2pdf at a directory whose file became unreadable
  gets a successful run that quietly skipped it — a correctness gap that looks like success.
- **affected_axis:** correctness

### 0005_POLA_P1 — `escapeHtml` under-escapes relative to its general name
- **priority:** P1
- **anti_pattern_class:** POLA
- **file:** src/markdownRenderer.ts
- **line:** 40
- **function_or_class:** escapeHtml
- **severity:** WARNING
- **security_concern:** missing_input_validation
- **evidence (lines 40–45):**
  ```ts
  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  ```
- **problem:** The name promises general HTML escaping but the body omits `"` (`&quot;`)
  and `'` (`&#39;`). It is safe at its only call site (text-node content of a `<div>`,
  line 124, where quotes are inert), but the generic name invites reuse in an HTML
  *attribute* context, where the missing quote-escaping is a stored-XSS hole. A name that
  over-promises its body is a least-astonishment trap for the next maintainer. (Borderline
  `LYING_NAME`; filed as POLA because the current single call site is correct.)
- **affected_axis:** maintainability

### 0006_POLA_P1 — Mermaid initialized without explicit `securityLevel` on untrusted input
- **priority:** P1
- **anti_pattern_class:** POLA
- **file:** src/markdownRenderer.ts
- **line:** 176
- **function_or_class:** assembleHtml (mermaid bootstrap)
- **severity:** WARNING
- **security_concern:** missing_input_validation
- **evidence (line 176):**
  ```ts
  mermaid.initialize({ startOnLoad: true, theme: 'default' });
  ```
- **problem:** Mermaid diagram source comes straight from untrusted Markdown fences
  (lines 122–124) and is rendered client-side. `securityLevel` is not set explicitly, so
  the output silently depends on the bundled mermaid version's default. For a tool whose
  input is by assumption untrusted, the safe posture (`securityLevel: 'strict'`) should be
  asserted rather than inherited — a hardcoding/POLA gap where the security-relevant knob is
  left implicit (§8 "validate at boundaries", §9 "no relying on implicit defaults for
  security"). Defense-in-depth.
- **affected_axis:** security

### 0007_DRY_P3 — Duplicated `basename(... extname ...) + '.pdf'` construction
- **priority:** P3
- **anti_pattern_class:** DRY
- **file:** src/paths.ts
- **line:** 23 (and 27)
- **function_or_class:** defaultOutputPath / outputPathInDirectory
- **severity:** INFO
- **security_concern:** null
- **evidence:**
  ```ts
  // line 23
  return join(dirname(sourcePath), `${basename(sourcePath, extname(sourcePath))}.pdf`);
  // line 27
  return join(outputDir, `${basename(sourcePath, extname(sourcePath))}.pdf`);
  ```
- **problem:** The "strip extension, append `.pdf`" rule is encoded twice. Currently
  byte-identical, so no drift yet, but the output-filename convention has two homes; a change
  to the suffix (e.g. `.pdf` → configurable) must touch both. Low blast radius (one file,
  two sites). P3.
- **affected_axis:** maintainability

### 0008_KISS_P3 — Underlying OS error discarded when re-throwing `ConversionError`
- **priority:** P3
- **anti_pattern_class:** KISS
- **file:** src/paths.ts
- **line:** 34
- **function_or_class:** resolveEntrySources
- **severity:** INFO
- **security_concern:** null
- **evidence (lines 32–39):**
  ```ts
  try {
    stats = statSync(entryPath);
  } catch (err) {
    throw new ConversionError(
      `Input not found or unreadable: ${entryPath}`,
      entryPath,
    );
  }
  ```
- **problem:** `err` is bound but never used; the original errno/cause (ENOENT vs EACCES vs
  ELOOP) is dropped, so "not found or unreadable" cannot tell the user which. Fail-loud (§8)
  wants the cause preserved (e.g. via `cause`). Minor — the boundary does fail (it throws),
  it just throws with less context than it has. INFO.
- **affected_axis:** maintainability

### 0009_IMPORT_SIDE_EFFECTS_P3 — Assets re-read from disk on every render call
- **priority:** P3
- **anti_pattern_class:** IMPORT_SIDE_EFFECTS
- **file:** src/markdownRenderer.ts
- **line:** 133
- **function_or_class:** renderToHtml (readAsset / getMermaidBundle)
- **severity:** INFO
- **security_concern:** null
- **evidence (lines 133–135):**
  ```ts
  const defaultCss = readAsset('default.css');
  const highlightCss = readAsset('highlight.css');
  const mermaidBundle = getMermaidBundle();
  ```
- **problem:** Three synchronous `readFileSync` calls — including the multi-hundred-KB
  mermaid bundle via `getMermaidBundle` (lines 18–20) — execute on *every* `renderToHtml`
  invocation. In batch directory conversion (`resolveConversionSources`, paths.ts line 62),
  these immutable assets are re-read once per document. Not a correctness defect; an
  efficiency smell (goal #3) that a module-level read-once would eliminate. INFO. (Filed as
  IMPORT_SIDE_EFFECTS by proximity to the asset-loading concern; strictly a per-call I/O
  repetition, not an import-time effect.)
- **affected_axis:** maintainability

---

## priority_summary

- **P0 (honesty + catastrophic):** 0
- **P1 (design principles):** 3 — SRP ×1 (MAJOR), POLA ×2 (WARNING)
- **P2 (structural metrics + security):** 3 — INJECTION ×1 (MAJOR), LONG_FUNCTION ×1 (MAJOR), SILENT_SWALLOWING ×1 (WARNING)
- **P3 (style/hygiene):** 3 — DRY ×1, KISS ×1, IMPORT_SIDE_EFFECTS ×1 (all INFO)

## summary_table

| Class | critical | major | warning | info | total |
|---|---|---|---|---|---|
| INJECTION | 0 | 1 | 0 | 0 | 1 |
| LONG_FUNCTION | 0 | 1 | 0 | 0 | 1 |
| SRP | 0 | 1 | 0 | 0 | 1 |
| SILENT_SWALLOWING | 0 | 0 | 1 | 0 | 1 |
| POLA | 0 | 0 | 2 | 0 | 2 |
| DRY | 0 | 0 | 0 | 1 | 1 |
| KISS | 0 | 0 | 0 | 1 | 1 |
| IMPORT_SIDE_EFFECTS | 0 | 0 | 0 | 1 | 1 |
| **Total** | **0** | **3** | **3** | **3** | **9** |

## Severity roll-up (report-level)

- critical: 0
- high (MAJOR): 3
- medium (WARNING): 3
- low (INFO): 3
- **total: 9**

## aggregate_scores

- correctness: 0.75 (silent entry-dropping; happy path correct)
- structure: 0.5 (71-line multi-concern renderer; SRP/SoC)
- security: 0.5 (exploitable path traversal, MAJOR → cap 0.5)
- maintainability: 0.75
- **code_score: 0.5** (min)
- weakest_axis: security / structure

## verdict

**AUDIT_WEAK** — No P0 honesty defect and no CRITICAL, so not a FAIL. But three MAJOR
findings (a real path-traversal sink, a 71-line four-concern renderer, and the SRP
braid) drive `code_score` to 0.5. The traversal sink (0001) and the silent
entry-dropping (0004) should be closed before this is trusted with untrusted Markdown.
