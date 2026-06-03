# Test Quality Audit — driverProvisioner.test.ts & releaseCatalog.test.ts

```json
{
  "project_version": "v0.1.1",
  "scope": "file:tests/unit/driverProvisioner.test.ts, file:tests/unit/releaseCatalog.test.ts",
  "date": "2026-06-03",
  "test_files_analyzed": 2,
  "test_functions_analyzed": 23,

  "detailed_analysis": "Two unit test files were audited against the van Deursen/Meszaros test-smell taxonomy and the project standard that mocking is permitted only at project boundaries.\n\nMOCKING BOUNDARIES — CLEAN. driverProvisioner.test.ts mocks exactly three things: 'node:fs' (filesystem I/O), 'fflate' (a third-party archive library), and global 'fetch' (network). All three are legitimate project boundaries. No internal collaborator is mocked: releaseCatalog.selectNewestEligible, the extractFromZip/extractFromTarGz extractors, binaryName, and the quarantine logic all run as REAL production code. The DriverReleaseFetcher is injected as a plain async stub via the production-supported `fetcher` parameter (a dependency seam, not a mock of an internal module). releaseCatalog.test.ts mocks nothing — it tests pure functions with an injected `now`. So the project's 'no mocking internal collaborators' rule is RESPECTED in both files. This is the single strongest property of the suite.\n\nThe dominant real defect is TIME COUPLING in driverProvisioner.test.ts. Production `provisionDriver` calls `selectNewestEligible(releases)` (src/driverProvisioner.ts:206) WITHOUT a `now` argument, so eligibility is judged against the REAL system clock (`new Date()`). The tests encode ABSOLUTE calendar dates — ELIGIBLE_DATE = 2026-05-01 and QUARANTINED_DATE = 2026-06-01 (lines 57-58) — and several tests assert that QUARANTINED_DATE is rejected. The 7-day quarantine window slides with wall-clock time, so QUARANTINED_DATE (2026-06-01) is only ~2 days old at the audit date (2026-06-03) but will CLEAR the 7-day window on 2026-06-08. From that date forward, the tests at lines 94-102 and 121-129 — which assert ArtifactFreshnessError is thrown for QUARANTINED_DATE — will FAIL even though no production code changed. No `vi.useFakeTimers()` / `vi.setSystemTime()` is used anywhere (grep confirmed zero hits), and the `NOW` constant declared at line 56 is never read. This is a Meszaros 'Fragile Test' / time-bomb: the test outcome depends on the date it is run, not on the code under test. The sibling releaseCatalog.test.ts does this CORRECTLY — it injects a frozen `now = NOW` into every call — which proves the seam exists and is simply not used in the provisioner tests.\n\nSECONDARY defects: a weak assertion on the headline 'selects the newest eligible release' test (asserts only that the returned path matches /geckodriver/, never that version 0.34.0 was actually chosen over 0.33.0 — both inputs share an identical date so the version-comparison logic the test name advertises is never verified); two near-duplicate 'has no bypass or force mode' tests whose names assert a property of the API surface the body cannot observe (they merely re-run the existing 'throws when quarantined' assertion); and minor dead code (an unused makeFakeZip helper at lines 18-21 and the unused NOW constant at line 56).\n\nThe releaseCatalog.test.ts file is in good shape: deterministic, boundary-clean, with focused single-concept tests covering the cutoff boundary (on-cutoff, one-second-inside, yesterday, today), version comparison among semantically close versions, the empty-list case, and the all-quarantined case. Its only notable smell is a mild tautology risk in quarantineCutoff's test (it re-derives the same day arithmetic) and a duplicate 'no bypass mode' test mirroring the provisioner file.\n\nVERDICT: AUDIT_WEAK. No CRITICAL self-validating or missing-assertion defects — every assertion in both files routes through real production code, so coverage_depth is genuine. But the time-coupled tests in driverProvisioner.test.ts are a MAJOR fragility/isolation defect (tests that will spontaneously fail on a future date and that fail to actually freeze the clock the way the design allows), capping isolation at 0.5. driverProvisioner.test.ts is the weaker file; releaseCatalog.test.ts is close to clean.",

  "per_file_scores": [
    {
      "file": "tests/unit/driverProvisioner.test.ts",
      "test_count": 9,
      "challenge": 0.75,
      "correctness": 0.75,
      "isolation": 0.5,
      "coverage_depth": 0.75,
      "test_score": 0.5,
      "weakest_axis": "isolation",
      "finding_count": 5
    },
    {
      "file": "tests/unit/releaseCatalog.test.ts",
      "test_count": 14,
      "challenge": 1.0,
      "correctness": 0.75,
      "isolation": 1.0,
      "coverage_depth": 1.0,
      "test_score": 0.75,
      "weakest_axis": "correctness",
      "finding_count": 2
    }
  ],

  "findings": [
    {
      "id": "TQ-01",
      "test_function": "throws ArtifactFreshnessError when all releases are in quarantine / does not provision a release published yesterday|today / has no bypass or force mode",
      "file": "tests/unit/driverProvisioner.test.ts",
      "line": 94,
      "anti_pattern": "P14 / Fragile Test (Meszaros)",
      "variant": "Time-coupled test judged against the real system clock (sliding quarantine window with absolute calendar dates)",
      "severity": "MAJOR",
      "evidence": "Production provisionDriver calls selectNewestEligible(releases) with NO `now` arg (src/driverProvisioner.ts:206), so eligibility uses real new Date(). Tests encode absolute dates and assert rejection of QUARANTINED_DATE.",
      "evidence_lines": "const QUARANTINED_DATE = new Date('2026-06-01T00:00:00Z'); // within 7-day window\n...\nit('throws ArtifactFreshnessError when all releases are in quarantine', async () => {\n  const fetcher = makeFetcher([ makeRelease('0.35.0', QUARANTINED_DATE) ]);\n  await expect(provisionDriver('geckodriver', '126.0', '/tmp/cache', fetcher)).rejects.toThrowError(ArtifactFreshnessError);",
      "problem": "The 7-day quarantine window slides with wall-clock time. QUARANTINED_DATE (2026-06-01) is ~2 days old at the audit date (2026-06-03) but clears the window on 2026-06-08; from then on these tests fail with no code change. No vi.useFakeTimers()/setSystemTime() is used (grep confirmed zero hits) even though the sibling releaseCatalog tests prove the `now`-injection seam exists. The declared NOW constant (line 56) is never read. This is a time-bomb / Fragile Test: outcome depends on the date the suite runs, not on the code under test.",
      "production_code": "src/driverProvisioner.ts:provisionDriver (line 206 selectNewestEligible call), src/releaseCatalog.ts:quarantineCutoff"
    },
    {
      "id": "TQ-02",
      "test_function": "selects the newest eligible release",
      "file": "tests/unit/driverProvisioner.test.ts",
      "line": 80,
      "anti_pattern": "P4",
      "variant": "Weak assertion — assertion does not verify the behavior the test name advertises",
      "severity": "WARNING",
      "evidence": "Two releases 0.33.0 and 0.34.0 share an IDENTICAL ELIGIBLE_DATE; the only assertion is resolves.toMatch(/geckodriver/) on the returned path.",
      "evidence_lines": "const fetcher = makeFetcher([\n  makeRelease('0.33.0', ELIGIBLE_DATE, '...geckodriver.tar.gz'),\n  makeRelease('0.34.0', ELIGIBLE_DATE, '...geckodriver.tar.gz'),\n]);\nawait expect(provisionDriver('geckodriver','126.0','/tmp/cache',fetcher)).resolves.toMatch(/geckodriver/);",
      "problem": "The test claims to verify that the NEWEST eligible release is selected, but the returned path is join('/tmp/cache','geckodriver') = '/tmp/cache/geckodriver' for EITHER version — the assertion /geckodriver/ matches regardless of whether 0.33.0 or 0.34.0 was chosen. The version-comparison selection logic the test name advertises is never asserted. The test would pass even if selectNewestEligible picked the wrong (older) version.",
      "production_code": "src/releaseCatalog.ts:selectNewestEligible / compareVersions"
    },
    {
      "id": "TQ-03",
      "test_function": "has no bypass or force mode — quarantine is unconditional",
      "file": "tests/unit/driverProvisioner.test.ts",
      "line": 121,
      "anti_pattern": "P4 / Duplicate test (van Deursen)",
      "variant": "Test name asserts an unobservable API property; body duplicates the existing all-quarantined assertion",
      "severity": "WARNING",
      "evidence": "Body is identical in intent to the line-94 test (same QUARANTINED_DATE fetcher, same rejects-with-ArtifactFreshnessError assertion); the comment admits the name describes a signature property the body cannot test.",
      "evidence_lines": "it('has no bypass or force mode — quarantine is unconditional', async () => {\n  // provisionDriver signature has no flag to skip quarantine\n  const fetcher = makeFetcher([makeRelease('0.35.0', QUARANTINED_DATE)]);\n  await expect(provisionDriver('geckodriver','126.0','/tmp/cache',fetcher)).rejects.toBeInstanceOf(ArtifactFreshnessError);",
      "problem": "The name claims to verify the absence of a bypass/force parameter, but a runtime test cannot observe the absence of a parameter — only the type system can. The body merely re-runs the same all-quarantined path as the test at line 94, providing no additional regression signal, and inherits the same time-coupling defect (TQ-01).",
      "production_code": "src/driverProvisioner.ts:provisionDriver"
    },
    {
      "id": "TQ-04",
      "test_function": "(module-level helper)",
      "file": "tests/unit/driverProvisioner.test.ts",
      "line": 18,
      "anti_pattern": "Dead test code",
      "variant": "Unused helper / unused constant",
      "severity": "INFO",
      "evidence": "makeFakeZip is defined but never referenced; its own comment says the fflate mock is used instead. The NOW constant at line 56 is also never read.",
      "evidence_lines": "function makeFakeZip(binaryName: string, content: Buffer): Buffer {\n  // We'll mock the fflate unzipSync instead to keep the test simple\n  return Buffer.from('fake-zip');\n}\n...\nconst NOW = new Date('2026-06-02T12:00:00Z');",
      "problem": "makeFakeZip (lines 18-21) is dead code and misleads a reader into thinking real ZIP construction is exercised. The NOW constant (line 56) is declared but never passed to anything — its presence implies the tests freeze time, which they do not (see TQ-01). Both reduce clarity and should be removed (read-only finding: not remediated here).",
      "production_code": "n/a"
    },
    {
      "id": "TQ-05",
      "test_function": "writes the extracted binary to the destination directory",
      "file": "tests/unit/driverProvisioner.test.ts",
      "line": 168,
      "anti_pattern": "P4",
      "variant": "Weak assertion — content of written buffer not verified",
      "severity": "WARNING",
      "evidence": "Asserts writeFileSync was called with a path containing 'chromedriver', any Buffer, and mode 0o755 — but never that the buffer equals the extracted binary bytes.",
      "evidence_lines": "expect(writeFileSync).toHaveBeenCalledWith(\n  expect.stringContaining('chromedriver'),\n  expect.any(Buffer),\n  expect.objectContaining({ mode: 0o755 }),\n);",
      "problem": "expect.any(Buffer) accepts ANY buffer, including an empty or wrong-content one. The fflate.unzipSync mock returns a known 'fake-binary' payload (line 26), so the test could and should assert the written bytes equal that payload to confirm extractFromZip actually piped the correct entry through. As written, a regression that wrote the wrong buffer (e.g. the raw archive instead of the extracted entry) would still pass. Mitigating: the path and mode assertions are meaningful, so this is WARNING not MAJOR.",
      "production_code": "src/driverProvisioner.ts:extractFromZip / writeFileSync call (line 232)"
    },
    {
      "id": "TQ-06",
      "test_function": "returns a date exactly QUARANTINE_DAYS before now",
      "file": "tests/unit/releaseCatalog.test.ts",
      "line": 14,
      "anti_pattern": "P1 (tautology risk, mild)",
      "variant": "Assertion re-derives the production formula rather than checking an independent expected value",
      "severity": "INFO",
      "evidence": "Test recomputes diffDays from the production output and asserts it ~equals QUARANTINE_DAYS, the same constant the production uses.",
      "evidence_lines": "const cutoff = quarantineCutoff(NOW);\nconst diffDays = (NOW.getTime() - cutoff.getTime()) / (24 * 60 * 60 * 1000);\nexpect(diffDays).toBeCloseTo(QUARANTINE_DAYS, 5);",
      "problem": "Because both the production function and the test use QUARANTINE_DAYS and the same 24*60*60*1000 arithmetic, the test largely mirrors the implementation. It would still catch a sign error or a unit error (it checks now-cutoff is POSITIVE 7 days), so it is not fully tautological — hence INFO. A stronger form would assert against a hardcoded expected literal date (e.g. expect(cutoff.toISOString()).toBe('2026-05-26T12:00:00.000Z')), which the CUTOFF constant at line 11 already encodes but does not use here.",
      "production_code": "src/releaseCatalog.ts:quarantineCutoff"
    },
    {
      "id": "TQ-07",
      "test_function": "has no bypass or force mode — quarantine cannot be disabled",
      "file": "tests/unit/releaseCatalog.test.ts",
      "line": 89,
      "anti_pattern": "Duplicate test (van Deursen)",
      "variant": "Test name asserts an unobservable API property; body duplicates the all-quarantined assertion",
      "severity": "INFO",
      "evidence": "Body re-runs the same throws-on-quarantine assertion already covered by the 'throws ... when all releases are in quarantine' test (line 58) and the 'does not select versions inside the quarantine window' test (line 80).",
      "evidence_lines": "it('has no bypass or force mode — quarantine cannot be disabled', () => {\n  // The function signature has no parameter to skip quarantine\n  const releases = [{ version: '1.0.0', publishedAt: new Date('2026-06-01T00:00:00Z') }];\n  expect(() => selectNewestEligible(releases, NOW)).toThrowError(ArtifactFreshnessError);",
      "problem": "A runtime test cannot observe the absence of a bypass parameter; only the type signature can. The body adds no path not already covered by line 58. Unlike its driverProvisioner sibling (TQ-03) it correctly injects NOW so it is not time-coupled — hence INFO rather than WARNING. Redundant coverage only.",
      "production_code": "src/releaseCatalog.ts:selectNewestEligible"
    }
  ],

  "aggregate_scores": {
    "challenge": 0.75,
    "correctness": 0.75,
    "isolation": 0.5,
    "coverage_depth": 0.75,
    "test_score": 0.5,
    "weakest_axis": "isolation"
  },

  "summary_table": {
    "P1_self_validating": {"info": 1, "total": 1},
    "P2_existence_only": {"total": 0},
    "P3_excessive_mocking": {"total": 0},
    "P4_weak_assertions": {"warning": 3, "total": 3},
    "P5_source_grepping": {"total": 0},
    "P6_test_pollution": {"total": 0},
    "P7_eager_test": {"total": 0},
    "P8_conditional_logic": {"total": 0},
    "P9_assertion_roulette": {"total": 0},
    "P10_sensitive_equality": {"total": 0},
    "P11_dead_test": {"info": 1, "total": 1},
    "P12_mystery_guest": {"total": 0},
    "P13_missing_assertion": {"total": 0},
    "P14_slow_test": {"major": 1, "total": 1},
    "duplicate_test": {"info": 1, "total": 1}
  },

  "verdict": "AUDIT_WEAK",
  "verdict_summary": "Mocking is boundary-clean (no internal collaborators mocked) and all assertions route through real production code, but driverProvisioner.test.ts is time-coupled to the real system clock with absolute dates that will spontaneously fail after 2026-06-08, plus several weak/duplicate assertions — isolation capped at 0.5."
}
```

## Severity mapping note

The MAJOR finding TQ-01 (time-coupled tests, classified under P14 / Meszaros Fragile Test) caps the `isolation` axis at 0.5, yielding test_score = min(0.75, 0.75, 0.5, 0.75) = 0.5 and verdict AUDIT_WEAK. No CRITICAL findings: every assertion in both files passes through real production code (releaseCatalog pure functions and the real extract/select/write path), so there are no self-validating (P1-critical) or missing-assertion (P13) defects.

## Severity counts (report-canonical)

- critical: 0
- high (MAJOR): 1  — TQ-01
- medium (WARNING): 3 — TQ-02, TQ-03, TQ-05
- low (INFO): 3 — TQ-04, TQ-06, TQ-07
- total: 7
