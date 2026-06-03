# Test Quality Audit — cli.test.ts & checkArtifactFreshness.test.ts

```json
{
  "project_version": "v0.1.1",
  "scope": "file:tests/unit/cli.test.ts, file:tests/unit/checkArtifactFreshness.test.ts",
  "date": "2026-06-03",
  "test_files_analyzed": 2,
  "test_functions_analyzed": 13,

  "detailed_analysis": "Both audited files are healthy. Every test exercises real production code: cli.test.ts imports and calls the real `main` and `isDirectInvocation` from src/cli.ts; checkArtifactFreshness.test.ts imports and calls the real `lockVersionSignature` and `freshnessFailures` from scripts/checkArtifactFreshness.mjs. No internal collaborator is mocked. The two substitution points that look like mocks are in fact legitimate dependency-injection seams that production itself exposes: (1) cli.test.ts passes a `runner` async function — production `CliMainOptions.runner` (src/cli.ts:26, defaulting to the real `runConversionPipeline` at line 39) is an explicit injection point, so supplying a fake runner tests the CLI's parse/dispatch/exit-code logic in isolation rather than mocking the function under test; (2) checkArtifactFreshness.test.ts passes `auditPresent`/`auditMissing` predicate fakes — production `freshnessFailures(..., auditExists)` (scripts/checkArtifactFreshness.mjs:68) takes the audit-existence predicate as a parameter, injected from the real `existsSync`-backed closure at line 195. Both substitutions stand in for a project boundary (pipeline subprocess / filesystem stat), which is exactly where the project standard permits fakes; neither mocks an internal collaborator, so no P3 finding. Assertions trace through real logic in every test, so there is no P1 self-validating or P13 missing-assertion exposure. The only defects are mild assertion-strength smells (P4): several error-path tests assert on substrings of the failure message rather than the whole message. These substrings ('newest eligible', 'missing audit report', 'does not match the locked version', 'missing a required field', 'Unknown option', 'At least one Markdown file or directory is required.') each uniquely identify the production branch they target, so the regression-protection loss is small — but a production change that reworded a message while keeping the substring, or that returned the right substring from the wrong branch, could pass. One test asserts only an exit code with no message-content check (cli.test.ts:99-110), which is the weakest assertion in the set though it does verify the exact exit-code-propagation contract. No slow-test (P14) constructs: no sleeps, no real external services in the test bodies, no heavy fixtures, no oversized loops; the npm-subprocess and the real `cp`/`execFileSync` work all lives in the untested `checkNpmLockFreshness` orchestrator, not in any audited test. Filesystem use in the isDirectInvocation tests is real tmp-dir I/O with try/finally cleanup via rmSync, so no test pollution. Verdict: AUDIT_PASS on both files.",

  "findings": [
    {
      "id": "TQ-01",
      "test_function": "returns exit 1 when the pipeline reports a failed conversion",
      "file": "tests/unit/cli.test.ts",
      "line": 99,
      "anti_pattern": "P4",
      "variant": "Boolean/exit-code-only — no message or state assertion",
      "severity": "LOW",
      "evidence": "Test injects a runner returning result(1) and asserts only `expect(code).toBe(1)`; nothing verifies stderr, the outcome, or that the failure path (not some other branch) produced the code.",
      "evidence_lines": "const code = await main(['broken.md'], {\n  stdout,\n  stderr,\n  runner: async () => result(1),\n});\n\nexpect(code).toBe(1);",
      "problem": "The assertion is the weakest in the suite: it confirms exit-code propagation but would also pass if main returned 1 for an unrelated reason. Acceptable as a focused exit-code-propagation contract, but it does not distinguish the pipeline-failure path from the generic error path (src/cli.ts:93-96 also returns 1). No stderr/empty-stderr check accompanies it.",
      "production_code": "src/cli.ts:main (line 78 return result.exitCode)"
    },
    {
      "id": "TQ-02",
      "test_function": "fails when a non-waived package version differs from newest-eligible",
      "file": "tests/unit/checkArtifactFreshness.test.ts",
      "line": 67,
      "anti_pattern": "P4",
      "variant": "Substring-only assertion",
      "severity": "LOW",
      "evidence": "After asserting length 1, the message is checked with `expect(failures[0]).toContain('newest eligible')` rather than the full message.",
      "evidence_lines": "const failures = freshnessFailures(committed, regenerated, [], auditPresent);\nexpect(failures).toHaveLength(1);\nexpect(failures[0]).toContain('newest eligible');",
      "problem": "Substring matching tolerates message rewording that keeps the fragment and does not bind the assertion to the specific production string (scripts/checkArtifactFreshness.mjs:116). Low blast radius because the length check plus this substring still uniquely pin the lockfile-mismatch branch.",
      "production_code": "scripts/checkArtifactFreshness.mjs:freshnessFailures (line 116)"
    },
    {
      "id": "TQ-03",
      "test_function": "rejects a waiver whose audit report is missing from the repo",
      "file": "tests/unit/checkArtifactFreshness.test.ts",
      "line": 94,
      "anti_pattern": "P4",
      "variant": "Substring-only assertion via .some(...includes)",
      "severity": "LOW",
      "evidence": "`expect(failures.some((f) => f.includes('missing audit report'))).toBe(true)` asserts only that some failure contains the fragment, without pinning the count or the rest of the message.",
      "evidence_lines": "const failures = freshnessFailures(committed, regenerated, [validWaiver], auditMissing);\nexpect(failures.some((f) => f.includes('missing audit report'))).toBe(true);",
      "problem": "`.some(...includes)` does not assert the absence of additional unexpected failures and matches a substring of the production message (scripts/checkArtifactFreshness.mjs:103). Uniquely identifies the missing-audit branch, so low severity, but a stricter `toEqual` on the full failures array would catch more regressions.",
      "production_code": "scripts/checkArtifactFreshness.mjs:freshnessFailures (line 103)"
    },
    {
      "id": "TQ-04",
      "test_function": "rejects a waiver whose version does not match the locked version",
      "file": "tests/unit/checkArtifactFreshness.test.ts",
      "line": 106,
      "anti_pattern": "P4",
      "variant": "Substring-only assertion via .some(...includes)",
      "severity": "LOW",
      "evidence": "`expect(failures.some((f) => f.includes('does not match the locked version'))).toBe(true)` — substring match, no count/full-message binding.",
      "evidence_lines": "const failures = freshnessFailures(committed, regenerated, [validWaiver], auditPresent);\nexpect(failures.some((f) => f.includes('does not match the locked version'))).toBe(true);",
      "problem": "Same substring/`.some` weakness as TQ-03 against scripts/checkArtifactFreshness.mjs:97. Does not assert the failures array has exactly one entry, so a spurious extra failure would go unnoticed.",
      "production_code": "scripts/checkArtifactFreshness.mjs:freshnessFailures (line 97)"
    },
    {
      "id": "TQ-05",
      "test_function": "rejects a waiver missing required fields",
      "file": "tests/unit/checkArtifactFreshness.test.ts",
      "line": 118,
      "anti_pattern": "P4",
      "variant": "Substring-only assertion via .some(...includes)",
      "severity": "LOW",
      "evidence": "`expect(failures.some((f) => f.includes('missing a required field'))).toBe(true)` — substring match only.",
      "evidence_lines": "const incomplete = { package: 'left-pad', version: '2.0.0' };\nconst failures = freshnessFailures(committed, regenerated, [incomplete], auditPresent);\nexpect(failures.some((f) => f.includes('missing a required field'))).toBe(true);",
      "problem": "Substring match against scripts/checkArtifactFreshness.mjs:82 without count binding. The incomplete waiver omits three required fields; the test does not assert exactly one failure, so it would not catch a regression that also leaked an unrelated failure. Low blast radius.",
      "production_code": "scripts/checkArtifactFreshness.mjs:freshnessFailures (line 82)"
    }
  ],

  "non_findings_reviewed": [
    "cli.test.ts `runner` injection (lines 87, 106): NOT P3. Production exposes CliMainOptions.runner (src/cli.ts:26) defaulting to the real runConversionPipeline (line 39). The pipeline is a project boundary (drives the conversion subprocess); substituting it is seam injection to isolate CLI parse/dispatch logic, not mocking the function under test.",
    "checkArtifactFreshness.test.ts `auditPresent`/`auditMissing` (lines 23-24): NOT P3. Production freshnessFailures takes auditExists as a parameter (scripts/checkArtifactFreshness.mjs:68), injected from a real existsSync closure (line 195). The predicate stands in for filesystem existence — a boundary — and is passed, not patched.",
    "cli.test.ts MemoryWritable / result() helpers (lines 10-31): test doubles for the stdout/stderr boundary and a typed PipelineResult builder; the asserted values (exit codes, captured text) all originate from production main(), so no P1 self-validation.",
    "lock()/validWaiver fixtures (checkArtifactFreshness.test.ts lines 11-21): input builders; every assertion is on the output of real freshnessFailures/lockVersionSignature, not on the fixtures themselves — no P1.",
    "isDirectInvocation tests (cli.test.ts 113-133): real tmp-dir symlink I/O with try/finally rmSync cleanup — no P6 pollution; asserts the real production comparison result.",
    "No P14 slow-test constructs in either file: no sleeps, no real external service calls, no heavy function-scoped fixtures, no >=10000 loops. The npm subprocess and real cp/execFileSync live in checkNpmLockFreshness, which is NOT under test in these files.",
    "No try/except/if/for in any test body -> no P8 conditional test logic.",
    "No test exceeds ~3 distinct SUT calls with unrelated concerns -> no P7 eager test."
  ],

  "per_file_scores": [
    {
      "file": "tests/unit/cli.test.ts",
      "test_count": 7,
      "challenge": 1.0,
      "correctness": 0.75,
      "isolation": 1.0,
      "coverage_depth": 1.0,
      "test_score": 0.75,
      "weakest_axis": "correctness",
      "finding_count": 1
    },
    {
      "file": "tests/unit/checkArtifactFreshness.test.ts",
      "test_count": 6,
      "challenge": 1.0,
      "correctness": 0.75,
      "isolation": 1.0,
      "coverage_depth": 1.0,
      "test_score": 0.75,
      "weakest_axis": "correctness",
      "finding_count": 4
    }
  ],

  "aggregate_scores": {
    "challenge": 1.0,
    "correctness": 0.75,
    "isolation": 1.0,
    "coverage_depth": 1.0,
    "test_score": 0.75,
    "weakest_axis": "correctness"
  },

  "summary_table": {
    "P1_self_validating": {"critical": 0, "total": 0},
    "P2_existence_only": {"major": 0, "total": 0},
    "P3_excessive_mocking": {"major": 0, "total": 0},
    "P4_weak_assertions": {"warning": 0, "low": 5, "total": 5},
    "P5_source_grepping": {"warning": 0, "total": 0},
    "P6_test_pollution": {"info": 0, "total": 0},
    "P7_eager_test": {"major": 0, "total": 0},
    "P8_conditional_logic": {"major": 0, "total": 0},
    "P9_assertion_roulette": {"warning": 0, "total": 0},
    "P10_sensitive_equality": {"warning": 0, "total": 0},
    "P11_dead_test": {"info": 0, "total": 0},
    "P12_mystery_guest": {"warning": 0, "total": 0},
    "P13_missing_assertion": {"critical": 0, "total": 0},
    "P14_slow_test": {"major": 0, "warning": 0, "total": 0}
  },

  "verdict": "AUDIT_PASS",
  "verdict_summary": "Both files exercise real production code with no internal-collaborator mocking and no self-validating or missing-assertion defects; only five low-severity P4 substring/exit-code-only assertion smells remain."
}
```

## Severity mapping note

The structured index uses critical/high/medium/low buckets. All five findings
are mild P4 weak-assertion smells with very low blast radius (each substring
uniquely identifies its production branch); they cap the `correctness` axis at
0.75 (WARNING tier in the auditor scale) but do not threaten regression
protection. They are reported as **low** in the index. No critical, high, or
medium findings.
