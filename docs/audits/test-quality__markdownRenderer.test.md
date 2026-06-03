# Test-Quality Forensic Audit — `tests/unit/markdownRenderer.test.ts`

- **Project:** md2pdf `v0.1.1`
- **Scope:** `file:tests/unit/markdownRenderer.test.ts`
- **Date:** 2026-06-03
- **Test framework:** vitest (TypeScript). Project standard mapped from `~/.claude/AGENTS.md §7` (mocking only at boundaries) and §7.1 (slow-test discipline).
- **Production code under test:** `src/markdownRenderer.ts` (`renderToHtml`, `renderToTempHtml`)
- **Test functions analyzed:** 24 (`it` blocks)

---

## Detailed analysis

This is a **healthy, boundary-respecting suite**. Its defining strength is that it
performs **zero mocking** — every `it` block calls the real `renderToHtml` /
`renderToTempHtml` and asserts against genuinely-produced output. There are **no
P1 self-validating tests** (every asserted value passes through production code),
**no P3 excessive-mocking / internal-collaborator-mocking** violations, **no P5
source-grepping**, and **no P13 missing-assertion** tests. `coverage_depth` is
strong: tests exercise the markdown-it pipeline, the custom image rule, the custom
mermaid fence rule, the highlight.js integration, and the temp-file writer
end-to-end through real logic.

The defects that exist are concentrated in two areas:

1. **Weak / echo-back assertions (P4).** Several tests assert on substrings that
   are also present in the *input* the test supplies, so the assertion does not
   actually prove the production transformation occurred. The clearest cases are
   the footnote test (`toContain('fn')` / `toContain('The footnote.')` — both
   echo the raw input) and the mermaid-bundle-inlining test
   (`toContain('mermaid')` — the word also appears in the static initializer
   script `mermaid.initialize(...)`, so the assertion passes even if the
   multi-megabyte bundle is **not** inlined at all). The task-list test is
   similarly weak (asserts bare `'Done'` / `'Todo'` substrings that come straight
   from the input).

2. **Test pollution via filesystem leak (P6).** The relative-image test at
   lines 178–192 writes `pixel.png` into the **shared** `tests/fixtures/`
   directory (not a temp dir) and never cleans it up. The leaked file is
   confirmed present on disk in `tests/fixtures/pixel.png`. This couples test
   runs, can mask a regression where the file-not-found branch should be taken,
   and pollutes the working tree / git status.

Secondary smells: a borderline slow-path concern (P14) because every one of the
~30 render invocations re-reads and re-embeds the full multi-megabyte
`mermaid/dist/mermaid.min.js` bundle (`getMermaidBundle()` in
`src/markdownRenderer.ts:18`); and a Mystery-Guest / Sensitive-format coupling on
the "no external URLs" test which strips `<script>` blocks with a regex before
asserting (the assertion is contingent on that pre-processing being correct, not
on production output alone).

None of these rise to CRITICAL. The dominant cap is the cluster of **P4 weak
assertions (WARNING → caps affected axes at 0.75)**; `correctness` is the weakest
axis because multiple assertions cannot distinguish correct production output from
echoed input.

**Verdict: AUDIT_PASS** — `test_score = 0.75 > 0.5` and zero CRITICAL findings.
The suite provides real regression protection; the findings are quality
improvements, not safety gaps.

---

## Per-file scores

| Axis | Score | Rationale |
|------|-------|-----------|
| `challenge` | 0.75 | Good breadth — happy path, unknown-language, no-language, HTML-escaping, absolute-vs-relative URL boundaries all covered. Unclean: a few multi-assert blocks and missing negative cases (e.g. no test that a *non-existent* relative image is left untouched). |
| `correctness` | 0.75 | Most assertions verify real output, but several (footnote, mermaid-bundle, task-list) assert input-echo substrings that can pass without the production transform. No failure messages on any assertion. Capped at 0.75 by P4. |
| `isolation` | 0.75 | Zero mocking — excellent boundary discipline. Downgraded from 1.0 only by the P6 filesystem leak into shared `tests/fixtures/` (lines 178–192) creating cross-run shared state. |
| `coverage_depth` | 1.0 | Tests drive the real markdown-it pipeline and both custom renderer rules end-to-end through production logic. No self-validation. |

**`test_score = min(0.75, 0.75, 0.75, 1.0) = 0.75`**
**Weakest axis: `correctness` (tie with challenge/isolation at 0.75).**

---

## Findings

### TQ-01 — P4 Weak assertions (WARNING) — mermaid bundle inlining not actually verified
- **Test:** `inlines mermaid bundle script`
- **File:** `tests/unit/markdownRenderer.test.ts:170`
- **Evidence (lines 170–174):**
  ```ts
  it('inlines mermaid bundle script', () => {
    const html = render('# doc');
    // mermaid bundle contains its own module-level code
    expect(html).toContain('mermaid');
  });
  ```
- **Problem:** The test claims to verify that the multi-megabyte
  `mermaid/dist/mermaid.min.js` bundle is inlined, but only asserts the substring
  `'mermaid'`. That substring is unconditionally present in the static
  initializer emitted by `assembleHtml` (`src/markdownRenderer.ts:176`:
  `mermaid.initialize({ startOnLoad: true, theme: 'default' });`). If
  `getMermaidBundle()` returned an empty string, this test would still pass. It
  provides essentially zero regression protection on the bundle-inlining path.
- **Production code:** `src/markdownRenderer.ts:18` (`getMermaidBundle`), `:135`, `:168`

### TQ-02 — P4 Weak assertions / borderline P1 (WARNING) — footnote assertions echo the input
- **Test:** `renders a footnote reference and definition`
- **File:** `tests/unit/markdownRenderer.test.ts:97`
- **Evidence (lines 97–102):**
  ```ts
  const md = 'Text[^fn]\n\n[^fn]: The footnote.';
  const html = render(md);
  expect(html).toContain('fn');
  expect(html).toContain('The footnote.');
  ```
- **Problem:** Both asserted substrings (`'fn'` and `'The footnote.'`) are present
  in the raw input `md`. Even if the `markdown-it-footnote` plugin were removed and
  the text were rendered as a literal paragraph, `'fn'` and `'The footnote.'` would
  still appear in the output. The assertion does not prove a footnote *reference*
  (`<sup>`/`<a>`) or *definition section* was produced — it cannot distinguish the
  footnote transform from plain passthrough. Borderline self-validating.
- **Production code:** `src/markdownRenderer.ts:91` (`.use(footnote)`)

### TQ-03 — P4 Weak assertions (WARNING) — task-list test asserts input-echo substrings
- **Test:** `renders checked and unchecked task items`
- **File:** `tests/unit/markdownRenderer.test.ts:87`
- **Evidence (lines 88–92):**
  ```ts
  const md = '- [x] Done\n- [ ] Todo';
  const html = render(md);
  expect(html).toContain('checked');
  expect(html).toContain('Done');
  expect(html).toContain('Todo');
  ```
- **Problem:** `'Done'` and `'Todo'` are echoed straight from the input and prove
  nothing about task-list rendering. Only `toContain('checked')` is load-bearing,
  and even that is a loose substring (it does not assert a `<input type="checkbox" checked>`
  on the *first* item nor that the *second* item is *un*checked). The test cannot
  catch a regression where checkboxes are dropped but text survives, nor where
  checked/unchecked state is inverted (no negative-state assertion).
- **Production code:** `src/markdownRenderer.ts:90` (`.use(taskLists, ...)`)

### TQ-04 — P6 Test Pollution (INFO) — filesystem leak into shared fixtures dir, no cleanup
- **Test:** `replaces a relative image src with a base64 data URI`
- **File:** `tests/unit/markdownRenderer.test.ts:178`
- **Evidence (lines 180–192):**
  ```ts
  const pngPath = join(fixturesDir, 'pixel.png');
  const pngBytes = Buffer.from('89504e47...ae426082', 'hex');
  writeFileSync(pngPath, pngBytes);
  const md = '![alt](pixel.png)';
  const html = render(md, pngPath.replace('pixel.png', 'sample.md'));
  expect(html).toContain('data:image/png;base64,');
  ```
- **Problem:** The test writes `pixel.png` into the **shared** `tests/fixtures/`
  directory (`fixturesDir` = `tests/fixtures`), not into a temp dir, and never
  deletes it. The leaked artifact is confirmed on disk: `tests/fixtures/pixel.png`
  exists in the working tree. Consequences: (a) the file persists across runs and
  pollutes git status; (b) a future test that relies on `pixel.png` being *absent*
  (to exercise the `existsSync(imgPath)` false branch at
  `src/markdownRenderer.ts:107`) would silently fail to test that branch; (c)
  ordering coupling — the first run creates state the suite then depends on.
  Should write to an OS temp dir (as `renderToTempHtml` already does) or clean up
  in an `afterEach`/`afterAll`.
- **Production code:** `src/markdownRenderer.ts:107` (`existsSync(imgPath)`), `:33` (`imageToDataUri`)

### TQ-05 — P12 Mystery Guest / contingent pre-processing (WARNING) — "no external URLs" assertion depends on regex strip
- **Test:** `contains no external http/https URLs`
- **File:** `tests/unit/markdownRenderer.test.ts:27`
- **Evidence (lines 27–34):**
  ```ts
  const markdown = readFileSync(sampleMd, 'utf8');
  const html = render(markdown);
  // Strip inline script content ...
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  expect(withoutScripts).not.toMatch(/https?:\/\//);
  ```
- **Problem:** The security-relevant invariant ("self-contained HTML, no external
  fetches") is asserted only *after* the test strips all `<script>...</script>`
  blocks. The assertion's validity is therefore contingent on the test's own regex
  being correct and on the threat surface being limited to non-script content; any
  external URL hidden inside a script (e.g. a CDN import in the mermaid bundle, or
  a future inline analytics snippet) is invisible to this test. The test also
  depends on the external fixture `sample.md` (Mystery Guest) whose content the
  reader must open another file to understand. The invariant is real and valuable,
  but the assertion under-covers it.
- **Production code:** `src/markdownRenderer.ts:137` / `:140` (`assembleHtml`)

### TQ-06 — P14 Slow test (WARNING / borderline) — full mermaid bundle re-read and re-embedded on every render
- **Tests:** entire file — 25 `render(...)` calls + 5 `renderToTempHtml(...)` calls (~30 invocations)
- **File:** `tests/unit/markdownRenderer.test.ts` (all `it` blocks)
- **Evidence:** Each `render()` ultimately calls `getMermaidBundle()`
  (`src/markdownRenderer.ts:18–21`), which does
  `readFileSync(_require.resolve('mermaid/dist/mermaid.min.js'), 'utf8')` and
  embeds the full multi-megabyte minified bundle into the output string on **every
  call**. With ~30 invocations per run, the suite repeatedly performs large-file
  I/O plus large-string concatenation.
- **Problem:** This is avoidable per-test heavy I/O. There is no caching of the
  bundle and no module/suite-level fixture; the cost scales linearly with test
  count. Whether the aggregate crosses the project's ~2 s fast-path bar
  (`AGENTS.md §7.1`) cannot be confirmed by static inspection alone.
- **Severity:** WARNING (borderline). **Confirm with `vitest --reporter=verbose`
  timing or `pytest --durations`-equivalent** before escalating to MAJOR. If the
  file or suite exceeds ~2 s, the module needs the project's slow-marker
  equivalent and/or the bundle should be cached.
- **Production code:** `src/markdownRenderer.ts:18` (`getMermaidBundle`), `:135`

### TQ-07 — P4 Weak assertion / no negative case (WARNING) — relative-image happy path only
- **Test:** `replaces a relative image src with a base64 data URI` and
  `leaves absolute URLs unchanged`
- **File:** `tests/unit/markdownRenderer.test.ts:178`, `:194`
- **Evidence (line 191, line 198):**
  ```ts
  expect(html).toContain('data:image/png;base64,');   // happy path
  ...
  expect(html).toContain('https://example.com/img.png'); // absolute survives
  ```
- **Problem:** The image rule (`src/markdownRenderer.ts:95–115`) has a third,
  untested branch: a **relative** src whose file does **not** exist
  (`existsSync(imgPath)` false at `:107`) must be left unchanged. Neither test
  covers it, so a regression that, e.g., throws on a missing file, or that emits a
  broken `data:` URI for a non-existent path, would pass undetected. The
  data-URI assertion is also a loose substring (`'data:image/png;base64,'`) that
  does not verify the encoded payload corresponds to the input PNG bytes.
- **Production code:** `src/markdownRenderer.ts:100–110`

---

## Summary table (P-code counts)

| Anti-pattern | critical | major | warning | info | total |
|--------------|---------:|------:|--------:|-----:|------:|
| P1 self-validating | 0 | – | – | – | 0 |
| P2 existence-only | – | 0 | – | – | 0 |
| P3 excessive mocking | – | 0 | – | – | 0 |
| P4 weak assertions | – | – | 4 | – | 4 (TQ-01, TQ-02, TQ-03, TQ-07) |
| P5 source-grepping | – | – | 0 | – | 0 |
| P6 test pollution | – | – | – | 1 | 1 (TQ-04) |
| P7 eager test | – | 0 | – | – | 0 |
| P8 conditional logic | – | 0 | – | – | 0 |
| P9 assertion roulette | – | – | 0 | – | 0 |
| P10 sensitive equality | – | – | 0 | – | 0 |
| P11 dead/ignored test | – | – | – | 0 | 0 |
| P12 mystery guest | – | – | 1 | – | 1 (TQ-05) |
| P13 missing assertion | 0 | – | – | – | 0 |
| P14 slow test | – | 0 | 1 | – | 1 (TQ-06) |

**Total findings: 7** — 0 critical, 0 major, 6 warning, 1 info.

(Note: TQ-02 is logged under P4 as its primary classification; it is a borderline
P1 but does pass an input substring through the real renderer, so it is not a true
self-validating test and stays a WARNING.)

---

## Aggregate scores

| Axis | Score |
|------|------:|
| challenge | 0.75 |
| correctness | 0.75 |
| isolation | 0.75 |
| coverage_depth | 1.0 |
| **test_score** | **0.75** |
| weakest axis | correctness |

## Verdict

**AUDIT_PASS** — `test_score = 0.75 (> 0.5)` and zero CRITICAL findings. The suite
mocks nothing and exercises real production code end-to-end, giving genuine
regression protection. Remaining defects are weak/echo-back assertions (P4 ×4), a
filesystem leak into shared fixtures (P6), a contingent-strip security assertion
(P12), and a borderline slow-path concern from re-embedding the mermaid bundle on
every render (P14) — all quality improvements, none safety-critical.

## Severity mapping (for index)

The structured index uses critical/high/medium/low. Mapping applied:
- critical → critical: 0
- high → major: 0
- medium → warning: 6
- low → info: 1
- **total: 7**
