# Test Quality Audit — `tests/integration/endToEnd.test.ts`

```json
{
  "project_version": "0.1.1",
  "scope": "file:tests/integration/endToEnd.test.ts",
  "date": "2026-06-03",
  "test_files_analyzed": 1,
  "test_functions_analyzed": 5,

  "detailed_analysis": "This is a browser-backed integration suite (vitest) for the M5 WebDriver PDF-rendering path. Its core design strength: it performs ZERO mocking. It exercises the real `convertFile` pipeline end-to-end against a real browser, real filesystem, and real PDF bytes. No internal collaborator is mocked, so the project boundary rule (mock only I/O / external APIs / time / hardware) is respected — there are no P3 (excessive mocking) findings and no internal-module mocks. Isolation, when the tests actually run, is excellent.\n\nThe dominant and disqualifying defect is the self-skipping mechanism. Every one of the five tests opens with `if (!browserAvailable) return;` (lines 115, 137, 159, 177, 196). `browserAvailable` is set in `beforeAll` (lines 26-35) by a try/catch around `locateBrowserAndDriver()`; on any failure it stays `false` and the warning is logged. When false, EACH test body returns before reaching a single `expect(...)`. vitest does not treat an early `return` as a skip — the test is reported GREEN with zero assertions executed. This is P13 (Missing Assertion) / P1 (Zero-assertions variant) conditioned on environment: in any browser-less environment (which the file header at lines 8-9 explicitly anticipates: \"skips itself gracefully ... so the suite can still exit 0 in browser-less CI environments\"), all five tests pass while verifying nothing. The production code under test (`src/converter.ts:convertFile`) could be deleted or replaced with `return undefined` and the suite would still report all-green in CI. That is the textbook negative-value test: false confidence. Because the early-return is wrapped in a per-test `if` it is also P8 (Conditional Test Logic) — an execution path where all assertions are silently skipped.\n\nSecondary issues: (1) `skipIfNoBrowser()` (lines 37-42) is dead code — defined, never called, and its body just `return`s, doing nothing even if called; its own comment at line 39 admits 'vitest's skip is not in scope here'. The correct vitest idioms (`it.skipIf(...)`, `ctx.skip()`, or `describe.skipIf`) would produce real SKIPPED status rather than a false PASS, but the suite uses neither. (2) `BrowserNotFoundError` (line 18) is imported but never referenced — dead import. (3) The error-path test at lines 174-188 asserts on `ConversionError` but is itself gated behind `if (!browserAvailable) return;` (line 177) even though the not-found path never needs a browser — so the one test with a genuine negative case is needlessly disabled in browser-less CI too. (4) The 'local-only guarantee' test (lines 191-208) is mis-scoped: its own comment (lines 192-195) claims it 'exercises the full convertFile pipeline end-to-end', but the body never calls `convertFile` — it calls `renderToHtml` directly (line 202) and asserts on that HTML string. The comment is false; the test is a unit test of the renderer, duplicating `markdownRenderer.test.ts` per its own admission (line 193). It also creates a temp dir (lines 200, 206) and writes a fixture (line 201) that is never read — pointless filesystem work. (5) Slow-test posture: `vitest.browser.config.ts` sets `testTimeout: 60_000`; these are real-browser, real-PDF renders well over the 2s bar. The project's mitigation is structural — the whole file runs only under the separate `test:browser` config, excluded from the fast `npm test`. That is an acceptable equivalent of the slow-marker convention, so this is noted at WARNING/INFO rather than MAJOR, but it is recorded for completeness.\n\nAssertion strength on the happy paths is mostly adequate (PDF magic-byte check `%PDF`, byte-length floors). The rich-Markdown test (lines 156-172) is weaker: it asserts only the `%PDF` prefix and never checks that task lists, footnotes, or blockquotes — the very features its name advertises — actually rendered. That is P4 (no verification of the named behaviour) and overlaps P2 (existence-only: file exists + is-a-PDF, content uncT verified). Net: when the browser is present these tests have real value; the fatal problem is that their value evaporates silently in the exact CI environments the project ships to.",

  "findings": [
    {
      "id": "TQ-01",
      "test_function": "all five tests (converts plain / mermaid / rich, does-not-write, local-only)",
      "file": "tests/integration/endToEnd.test.ts",
      "line": "115, 137, 159, 177, 196",
      "anti_pattern": "P13",
      "variant": "Missing Assertion (environment-conditional) / P1 Zero-assertions",
      "severity": "CRITICAL",
      "evidence": "if (!browserAvailable) return;  // first statement in every test body",
      "evidence_lines": "it('converts plain Markdown ...', async () => {\\n  if (!browserAvailable) return;\\n  ... // all expect(...) calls follow, never reached when false",
      "problem": "vitest does NOT treat an early `return` as a skip. In any browser-less environment — which the file header (lines 8-9) explicitly targets ('exit 0 in browser-less CI environments') — every test returns before any expect() runs and is reported GREEN with zero assertions. The production function convertFile (src/converter.ts) could be deleted and the suite would still pass all-green in CI. This is the defining negative-value test: false confidence, zero regression protection in the shipping CI configuration.",
      "production_code": "src/converter.ts:convertFile"
    },
    {
      "id": "TQ-02",
      "test_function": "all five tests",
      "file": "tests/integration/endToEnd.test.ts",
      "line": "115, 137, 159, 177, 196",
      "anti_pattern": "P8",
      "variant": "Conditional Test Logic (branch with no assertion)",
      "severity": "MAJOR",
      "evidence": "if (!browserAvailable) return;",
      "evidence_lines": "if (!browserAvailable) return;",
      "problem": "Each test contains an `if` branch whose taken path executes zero assertions. Per Bavota et al. and the catalog, any in-test branch lacking an assert is a defect. The correct vitest idiom (it.skipIf / ctx.skip) would surface a real SKIPPED status instead of a false PASS; the suite instead hides the absence of verification behind control flow.",
      "production_code": "src/converter.ts:convertFile"
    },
    {
      "id": "TQ-03",
      "test_function": "skipIfNoBrowser (helper)",
      "file": "tests/integration/endToEnd.test.ts",
      "line": "37-42",
      "anti_pattern": "P6",
      "variant": "Dead code / ineffective skip helper",
      "severity": "INFO",
      "evidence": "function skipIfNoBrowser(): void { if (!browserAvailable) { /* vitest's skip is not in scope here; use a runtime check */ return; } }",
      "evidence_lines": "function skipIfNoBrowser(): void {\\n  if (!browserAvailable) {\\n    // vitest's `skip` is not in scope here; use a runtime check\\n    return;\\n  }\\n}",
      "problem": "Defined but never called anywhere in the file. Even if called, its body only returns and does nothing — it cannot skip a test. The comment admits the author knew vitest's skip was unavailable in this form. Dead, misleading scaffolding that documents the root cause of TQ-01.",
      "production_code": "n/a"
    },
    {
      "id": "TQ-04",
      "test_function": "module import",
      "file": "tests/integration/endToEnd.test.ts",
      "line": "18",
      "anti_pattern": "P6",
      "variant": "Unused import (dead code)",
      "severity": "INFO",
      "evidence": "import { BrowserNotFoundError } from '../../src/errors.js';",
      "evidence_lines": "import { BrowserNotFoundError } from '../../src/errors.js';",
      "problem": "`BrowserNotFoundError` is imported but never referenced in the file. Dead import — noise, and a hint that an intended negative-path assertion (e.g. asserting the browser-locate failure type) was never written.",
      "production_code": "src/errors.ts:BrowserNotFoundError"
    },
    {
      "id": "TQ-05",
      "test_function": "assembled HTML contains no external URLs (local-only guarantee)",
      "file": "tests/integration/endToEnd.test.ts",
      "line": "191-208",
      "anti_pattern": "P5",
      "variant": "Mis-scoped / mislabeled test — comment claims end-to-end pipeline, body unit-tests the renderer",
      "severity": "WARNING",
      "evidence": "// exercises the full convertFile pipeline to confirm the guarantee holds end-to-end.  ... const html = renderToHtml(PLAIN_MD, { sourceFilePath: src });",
      "evidence_lines": "// ... exercises the full convertFile pipeline to confirm the guarantee holds\\n// end-to-end.\\n...\\nconst html = renderToHtml(PLAIN_MD, { sourceFilePath: src });\\nconst withoutScripts = html.replace(/<script[\\\\s\\\\S]*?<\\\\/script>/gi, '');\\nexpect(withoutScripts).not.toMatch(/https?:\\\\/\\\\//);",
      "problem": "The comment (lines 192-195) asserts the test 'exercises the full convertFile pipeline ... end-to-end', but the body never calls convertFile — it calls renderToHtml directly (line 202). It is a unit test of the renderer, duplicating markdownRenderer.test.ts by its own admission (line 193). The false comment misrepresents coverage. The assertion itself (regex for http(s):// after stripping scripts) is also coarse: an external resource referenced via a non-http scheme or attribute would pass.",
      "production_code": "src/markdownRenderer.ts:renderToHtml"
    },
    {
      "id": "TQ-06",
      "test_function": "assembled HTML contains no external URLs (local-only guarantee)",
      "file": "tests/integration/endToEnd.test.ts",
      "line": "199-206",
      "anti_pattern": "P12",
      "variant": "Pointless fixture / unused filesystem setup",
      "severity": "INFO",
      "evidence": "const src = writeFixture(dir, 'local.md', PLAIN_MD); const html = renderToHtml(PLAIN_MD, ...)",
      "evidence_lines": "const src = writeFixture(dir, 'local.md', PLAIN_MD);\\nconst html = renderToHtml(PLAIN_MD, { sourceFilePath: src });",
      "problem": "The test creates a temp dir (line 200) and writes a fixture file (line 201) that renderToHtml never reads (it is passed only PLAIN_MD as a string and src as a path label). The filesystem setup/teardown is dead weight, adding I/O and a mystery-guest dependency for no assertion value.",
      "production_code": "src/markdownRenderer.ts:renderToHtml"
    },
    {
      "id": "TQ-07",
      "test_function": "converts rich Markdown (task lists, footnotes, blockquotes) to PDF",
      "file": "tests/integration/endToEnd.test.ts",
      "line": "156-172",
      "anti_pattern": "P2",
      "variant": "Existence-only — asserts file is a PDF, never verifies the named features",
      "severity": "WARNING",
      "evidence": "expect(readFileSync(out).slice(0, 4).toString()).toBe('%PDF');",
      "evidence_lines": "expect(existsSync(out)).toBe(true);\\nexpect(readFileSync(out).slice(0, 4).toString()).toBe('%PDF');",
      "problem": "The test name promises verification of task lists, footnotes, and blockquotes, but the only assertions are that the output exists and begins with %PDF magic bytes. None of the three advertised features are checked (no byte-length floor, no rendered-content probe). Any PDF — including one that silently dropped all rich features — passes. Weaker than the sibling plain/mermaid tests which at least assert byte-length floors (lines 127, 150).",
      "production_code": "src/converter.ts:convertFile"
    },
    {
      "id": "TQ-08",
      "test_function": "does not write a PDF when the source file does not exist",
      "file": "tests/integration/endToEnd.test.ts",
      "line": "174-188",
      "anti_pattern": "P8",
      "variant": "Negative-path test needlessly gated behind browser availability",
      "severity": "WARNING",
      "evidence": "if (!browserAvailable) return;  // line 177, inside the missing-source test",
      "evidence_lines": "it('does not write a PDF when the source file does not exist', async () => {\\n  if (!browserAvailable) return;\\n  ...\\n  await expect(convertFile(src, out)).rejects.toThrowError(ConversionError);",
      "problem": "This is the suite's only genuine negative-case test (ConversionError on missing source). The missing-source failure occurs at readFileSync (src/converter.ts:28-34) BEFORE any browser is located, so the test needs no browser. Gating it behind `if (!browserAvailable) return;` disables the one robust regression check in browser-less CI — exactly where it would be cheapest and most useful to run. Compounds TQ-01 for the highest-value test in the file.",
      "production_code": "src/converter.ts:convertFile (ConversionError path)"
    },
    {
      "id": "TQ-09",
      "test_function": "whole file (browser-backed renders)",
      "file": "tests/integration/endToEnd.test.ts",
      "line": "1-209",
      "anti_pattern": "P14",
      "variant": "Slow test — real-browser PDF render (mitigated by separate config)",
      "severity": "INFO",
      "evidence": "vitest.browser.config.ts: testTimeout: 60_000; tests spawn a real browser + WebDriver and render PDFs.",
      "evidence_lines": "testTimeout: 60_000,\\nhookTimeout: 30_000,",
      "problem": "Each passing render is a real-browser, real-PDF operation far exceeding the ~2s fast-path bar. Per project §7.1 such tests must be excluded from the fast iteration path. The mitigation IS present and structural: the file runs only under the separate `test:browser` / vitest.browser.config.ts config and is excluded from `npm test`. Recorded at INFO because the slow path is correctly segregated; no MAJOR cap applied. Confirm actual wall time with a duration reporter if iteration speed regresses.",
      "production_code": "src/converter.ts:convertFile; src/pdfRenderer.ts:renderToPdf"
    }
  ],

  "aggregate_scores": {
    "challenge": 0.5,
    "correctness": 0.0,
    "isolation": 0.0,
    "coverage_depth": 0.0,
    "test_score": 0.0,
    "weakest_axis": "correctness / isolation / coverage_depth (all 0.0 — CRITICAL cap from TQ-01)"
  },

  "summary_table": {
    "P1_self_validating": {"critical": 0, "total": 0},
    "P2_existence_only": {"warning": 1, "total": 1},
    "P3_excessive_mocking": {"major": 0, "total": 0},
    "P4_weak_assertions": {"warning": 0, "total": 0},
    "P5_source_grepping": {"warning": 1, "total": 1},
    "P6_test_pollution": {"info": 2, "total": 2},
    "P7_eager_test": {"major": 0, "total": 0},
    "P8_conditional_logic": {"major": 1, "warning": 1, "total": 2},
    "P9_assertion_roulette": {"warning": 0, "total": 0},
    "P10_sensitive_equality": {"warning": 0, "total": 0},
    "P11_dead_test": {"info": 0, "total": 0},
    "P12_mystery_guest": {"info": 1, "total": 1},
    "P13_missing_assertion": {"critical": 1, "total": 1},
    "P14_slow_test": {"major": 0, "warning": 0, "info": 1, "total": 1}
  },

  "verdict": "AUDIT_FAIL",
  "verdict_summary": "Mock-free and well-isolated WHEN it runs, but every test guards on `if (!browserAvailable) return;` — in the browser-less CI the project explicitly targets, all five tests report GREEN with zero assertions executed, providing false confidence (CRITICAL P13)."
}
```

## Severity mapping note

Severity vocabulary maps to the index counts as: CRITICAL→critical, MAJOR→high,
WARNING→medium, INFO→low.

- critical (CRITICAL): TQ-01 → 1
- high (MAJOR): TQ-02 → 1
- medium (WARNING): TQ-05, TQ-07, TQ-08 → 3
- low (INFO): TQ-03, TQ-04, TQ-06, TQ-09 → 4
- total: 9
