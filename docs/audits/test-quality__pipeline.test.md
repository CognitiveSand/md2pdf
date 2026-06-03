# Test Quality Audit — `tests/unit/pipeline.test.ts`

```json
{
  "project_version": "0.1.1",
  "scope": "file:tests/unit/pipeline.test.ts",
  "date": "2026-06-03",
  "test_files_analyzed": 1,
  "test_functions_analyzed": 7,

  "detailed_analysis": "tests/unit/pipeline.test.ts is a behavior-driven integration-style suite for runConversionPipeline (src/pipeline.ts). Its core design is sound and notably free of the worst anti-patterns. The single dependency that is substituted — `converter` (type ConvertFn) — is a LEGITIMATE project boundary: in production the default is `convertFile` from src/converter.ts, which drives a headless browser (WebDriver/Puppeteer) to render PDFs. That is exactly the kind of external, slow, hardware/browser boundary the project standard permits faking. `fakeConverter` is an in-process fake (it writes a real file), not a mock object that reads its own return value back, so there is NO P3 internal-collaborator mocking violation here. All other collaborators of the pipeline — resolveEntrySources, outputExists, decideOverwrite, defaultOutputPath, outputPathInDirectory, mkdirSync, and the real filesystem (via mkdtempSync temp dirs) — are exercised for real. Stdout/stderr are substituted with MemoryWritable, a genuine in-process Writable fake, which is acceptable (stdio boundary). Assertions trace to production-produced values: exitCode, succeeded/failed/skipped counts, summary string, stderr content, and on-disk file existence/content all originate from production code, not from the test body. There are no self-validating (P1), missing-assertion (P13), existence-only (P2), source-grepping (P5), or dead-test (P11) defects.\n\nThe real defects are smell-level. (1) P9 Assertion Roulette: five of the seven tests carry 5-8 message-less expect() calls covering distinct invariants (exit code, three counts, multiple file-existence checks, summary text, stderr text); a failure forces the reader to the line number to learn which invariant broke. vitest's expect has no per-assertion message argument, so this is mitigated by per-call matcher output, but the smell — multiple independent concerns bundled with no semantic label — still applies and lands at WARNING. (2) P7/Eager-Test borderline: the same five tests assert across multiple concerns (process result object, filesystem side effects, and stream text) in one function; this is characteristic of integration tests and is not flagged as a full P7 MAJOR because each test still centers on ONE pipeline scenario, but it compounds the roulette problem. (3) P8 Conditional Test Logic (shared-helper variant): fakeConverter (lines 26-33) contains an if-branch (`if (sourcePath.endsWith(failingBasename ?? '<never>'))`) that decides whether to throw. This branching lives in test-support code, not a test body, and the '<never>' sentinel makes the no-arg path deterministic, so it does not silently skip assertions — recorded at INFO, not MAJOR. (4) Test pollution risk (P6): every test creates a temp dir under the OS tmpdir and removes it in finally — correct cleanup — but the suite relies on mkdtempSync + manual rmSync rather than a fixture, so a thrown error inside MemoryWritable construction (before the try) would leak a dir; low risk, INFO. No slow-test (P14) concern: no sleeps, no real browser, no real subprocess; the fake converter keeps wall time trivial, so no @pytest.mark.slow-equivalent is needed.\n\nVerdict: the suite genuinely protects against regressions in the pipeline's orchestration logic (counting, skip handling, error capture, output routing, exit codes) and would fail if that production code were deleted or broken. Weaknesses are clarity/diagnosability smells, not correctness or isolation failures. test_score is gated to 0.75 by the WARNING-tier P9 finding.",

  "per_file_scores": [
    {
      "file": "tests/unit/pipeline.test.ts",
      "test_count": 7,
      "challenge": 0.75,
      "correctness": 0.75,
      "isolation": 1.0,
      "coverage_depth": 1.0,
      "test_score": 0.75,
      "weakest_axis": "challenge/correctness",
      "finding_count": 4
    }
  ],

  "findings": [
    {
      "id": "TQ-01",
      "test_function": "continues after one file fails and exits 1",
      "file": "tests/unit/pipeline.test.ts",
      "line": 149,
      "anti_pattern": "P9",
      "variant": "Assertion Roulette (message-less multi-assert)",
      "severity": "WARNING",
      "evidence": "8 message-less expect() calls in one test spanning exit code, two counts, three file-existence checks, summary text, and stderr text.",
      "evidence_lines": "expect(result.exitCode).toBe(1);\nexpect(result.succeeded).toBe(2);\nexpect(result.failed).toBe(1);\nexpect(existsSync(join(dir, 'good.pdf'))).toBe(true);\nexpect(existsSync(join(dir, 'broken.pdf'))).toBe(false);\nexpect(existsSync(join(dir, 'later.pdf'))).toBe(true);\nexpect(stdout.text()).toContain('Summary: 2 succeeded, 1 failed, 0 skipped.');\nexpect(stderr.text()).toContain('broken.md');",
      "problem": "Eight independent invariants are asserted with no distinguishing label. A failure reports only a line number; the reader cannot tell from the test name or assertion which of (exit code / success count / failure count / per-file output / summary text / error reporting) regressed without opening the file. Same pattern recurs in 'converts several named Markdown files' (line 59, 7 asserts), 'converts only top-level Markdown files' (line 91, 5 asserts), 'records a missing entry failure' (line 179, 5 asserts), and 'skips existing outputs' (line 207, 6 asserts).",
      "production_code": "src/pipeline.ts:runConversionPipeline"
    },
    {
      "id": "TQ-02",
      "test_function": "(multiple) — challenge/diagnosability across the suite",
      "file": "tests/unit/pipeline.test.ts",
      "line": 41,
      "anti_pattern": "P7",
      "variant": "Eager Test (borderline — multi-concern within one scenario)",
      "severity": "WARNING",
      "evidence": "Each large test verifies the result object, on-disk side effects, AND stream text in one function.",
      "evidence_lines": "expect(result.exitCode).toBe(0);\nexpect(result.succeeded).toBe(2);\nexpect(existsSync(join(dir, 'a.pdf'))).toBe(true);\nexpect(stdout.text()).toContain('Summary: 2 succeeded, 0 failed, 0 skipped.');\nexpect(stderr.text()).toBe('');",
      "problem": "Three distinct concerns (return-value accounting, filesystem effects, and user-facing stream output) are bundled per test. Not a full P7 MAJOR because each test still centers on a single pipeline scenario and the bundling is inherent to an integration test, but it amplifies the P9 roulette: splitting result-accounting from output-text assertions would localise failures. Recorded at WARNING; does not independently lower the cap beyond P9.",
      "production_code": "src/pipeline.ts:runConversionPipeline"
    },
    {
      "id": "TQ-03",
      "test_function": "fakeConverter (shared test helper)",
      "file": "tests/unit/pipeline.test.ts",
      "line": 26,
      "anti_pattern": "P8",
      "variant": "Conditional logic in test-support code",
      "severity": "INFO",
      "evidence": "Helper branches on sourcePath to decide whether to throw.",
      "evidence_lines": "function fakeConverter(failingBasename?: string): ConvertFn {\n  return async (sourcePath, outputPath) => {\n    if (sourcePath.endsWith(failingBasename ?? '<never>')) {\n      throw new ConversionError(`Render failed for ${sourcePath}`, sourcePath);\n    }\n    writeFileSync(outputPath, `pdf:${sourcePath}`, 'utf8');\n  };\n}",
      "problem": "Branching inside a test double normally risks silently skipping the intended path, but here the '<never>' sentinel makes the default (no-arg) call deterministically take the write branch, and the 'broken.md' case deterministically takes the throw branch. No assertion is conditionally skipped. Flagged at INFO for awareness only; not a MAJOR P8 because the branch is in support code with a deterministic, test-controlled discriminator rather than in a test body.",
      "production_code": "n/a (test fixture)"
    },
    {
      "id": "TQ-04",
      "test_function": "(all tests) — temp-dir lifecycle",
      "file": "tests/unit/pipeline.test.ts",
      "line": 42,
      "anti_pattern": "P6",
      "variant": "Filesystem cleanup outside a fixture",
      "severity": "INFO",
      "evidence": "Each test calls makeTempDir() before the try block; cleanup is manual in finally.",
      "evidence_lines": "const dir = makeTempDir();\nconst stdout = new MemoryWritable();\nconst stderr = new MemoryWritable();\ntry {\n  ...\n} finally {\n  rmSync(dir, { recursive: true, force: true });\n}",
      "problem": "Temp dirs are created under the OS tmpdir (not an in-repo tmp/) and cleaned in finally, which is correct for the happy and error paths. However, the dir is created before the try; if MemoryWritable construction or makeTempDir itself partially succeeded and then threw, a directory could leak. Low blast radius, INFO. A beforeEach/afterEach fixture or vitest's onTestFinished would make cleanup leak-proof and remove the repeated boilerplate.",
      "production_code": "n/a (test infrastructure)"
    }
  ],

  "aggregate_scores": {
    "challenge": 0.75,
    "correctness": 0.75,
    "isolation": 1.0,
    "coverage_depth": 1.0,
    "test_score": 0.75,
    "weakest_axis": "challenge/correctness"
  },

  "summary_table": {
    "P1_self_validating": {"critical": 0, "total": 0},
    "P2_existence_only": {"major": 0, "total": 0},
    "P3_excessive_mocking": {"major": 0, "total": 0},
    "P4_weak_assertions": {"warning": 0, "total": 0},
    "P5_source_grepping": {"warning": 0, "total": 0},
    "P6_test_pollution": {"info": 1, "total": 1},
    "P7_eager_test": {"warning": 1, "total": 1},
    "P8_conditional_logic": {"info": 1, "total": 1},
    "P9_assertion_roulette": {"warning": 1, "total": 1},
    "P10_sensitive_equality": {"warning": 0, "total": 0},
    "P11_dead_test": {"info": 0, "total": 0},
    "P12_mystery_guest": {"warning": 0, "total": 0},
    "P13_missing_assertion": {"critical": 0, "total": 0},
    "P14_slow_test": {"major": 0, "warning": 0, "total": 0}
  },

  "verdict": "AUDIT_PASS",
  "verdict_summary": "Solid regression-protecting pipeline suite with no critical/major defects; the only fakery is at the legitimate browser-render boundary (ConvertFn), but five tests are assertion-roulette-prone (5-8 message-less asserts), capping clarity axes at 0.75."
}
```

## Severity mapping (report-tier -> index-tier)

The index object uses critical/high/medium/low. Mapping applied:
- CRITICAL -> critical: 0
- MAJOR -> high: 0
- WARNING -> medium: 2 (TQ-01 P9, TQ-02 P7-borderline)
- INFO -> low: 2 (TQ-03 P8, TQ-04 P6)
- total: 4
