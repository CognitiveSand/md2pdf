# Test Quality Audit — `tests/unit/browserLocator.test.ts`

- **Project:** md2pdf
- **Project version:** 0.1.1
- **Scope:** `file:tests/unit/browserLocator.test.ts`
- **Date:** 2026-06-03
- **Test framework:** vitest 4.1.7
- **Production module under test:** `src/browserLocator.ts`
- **Test functions analyzed:** 11

---

## Detailed analysis

This is a **fundamentally sound** unit suite. The data flow is correct: every
assertion reads a value produced by real production code in `src/browserLocator.ts`
(`locateBrowser`, `locateDriver`, `driverCacheDir`), not a value the test fabricated
and read back. Deleting or breaking the production functions would fail these tests,
so the suite is **not self-validating** (no P1) and **every test asserts** (no P13).

**Mocking is correctly scoped to project boundaries.** The three `vi.mock` calls
target only Node built-ins:

- `node:fs` → `existsSync` (filesystem I/O — boundary)
- `node:child_process` → `execFileSync`, `execSync` (subprocess / external CLI — boundary)
- `node:os` → `platform` (hardware/OS detection — boundary)

All three use `importOriginal` and spread `...actual`, mocking only the specific
boundary functions while leaving everything else real. The internal collaborator
`provisionDriver` (`src/driverProvisioner.ts`) is **not mocked** — it is supplied via
dependency injection through the `DriverProvisioner` parameter of `locateDriver`
(see `src/browserLocator.ts:273-276`), and the tests pass a hand-written
`failingProvisioner` / `vi.fn()` stub. This is the textbook-correct alternative to
mocking an internal module. **No P3 (excessive mocking) violation, no internal-module
mock.** This is exactly what the project standard requires.

The defects found are at the **WARNING tier** and concern assertion strength and
assertion roulette, not regression protection:

1. One test (`returns the first existing candidate in priority order`) carries a name
   that promises more than it tests — it sets up exactly one existing candidate, so it
   never exercises priority ordering among multiple candidates. Its version assertion
   is also a loose `toMatch` regex (P4 weak assertion). The DARWIN priority list in
   `src/browserLocator.ts:37-49` has five entries; if the loop order regressed, this
   test would not catch it because only one path is made to exist.

2. The `BrowserNotFoundError message …` test packs five message-less assertions with
   no per-assertion failure messages (P9 assertion roulette at the >=5 threshold);
   a failure forces the reader to the line number to learn which substring was missing.

No CRITICAL or MAJOR findings. No slow-test (P14) signals: there are no `sleep` calls,
no heavy function-scoped fixtures, no real external-service calls, no per-test
subprocess spawns (subprocess is mocked), and no oversized loops. No conditional test
logic (P8) — the only `try/catch` (lines 87-88) is the standard
catch-and-assert-instance pattern, which has a real assertion on the caught value at
line 90, so it is not a silently-skipped branch. No source-grepping (P5), no mystery
guest (P12 — the injected `LocatedBrowser` fixtures at lines 115-125 are defined
inline, adjacent to the tests). No dead/skipped tests (P11), no test pollution beyond
the properly-cleaned-up `afterEach` which resets mocks and deletes the env var
(lines 41-44).

**Verdict: AUDIT_PASS.** The suite protects against regressions; the two WARNING
findings cap the affected axes at 0.75 but do not threaten the score floor.

---

## Per-file scores

| File | test_count | challenge | correctness | isolation | coverage_depth | test_score | weakest_axis | findings |
|------|-----------|-----------|-------------|-----------|----------------|------------|--------------|----------|
| tests/unit/browserLocator.test.ts | 11 | 0.75 | 0.75 | 1.0 | 1.0 | 0.75 | challenge / correctness | 2 |

- **challenge = 0.75** — happy path, error path, and boundary (missing file, no candidate, PATH→cache→provision fallback chain) are all covered, but the "priority order" test does not actually exercise ordering, leaving a coverage claim unmet.
- **correctness = 0.75** — assertions verify the right values, but lack failure messages and one uses an over-loose `toMatch` regex.
- **isolation = 1.0** — mocks only at boundaries; internal `provisionDriver` injected, not mocked; clean `afterEach` teardown.
- **coverage_depth = 1.0** — tests drive real production logic end-to-end (resolution order, env override, version parsing all flow through `src/browserLocator.ts`).

`test_score = min(0.75, 0.75, 1.0, 1.0) = 0.75`

---

## Findings

### TQ-01 — P9 Assertion Roulette (WARNING)

- **Test function:** `BrowserNotFoundError message mentions Chrome, Chromium, Firefox and MD2PDF_BROWSER`
- **File:** `tests/unit/browserLocator.test.ts`
- **Lines:** 84-96
- **Anti-pattern:** P9 (Assertion Roulette)
- **Severity:** WARNING
- **Evidence (lines 90-95):**
  ```ts
  expect(caught).toBeInstanceOf(BrowserNotFoundError);
  const msg = (caught as BrowserNotFoundError).message;
  expect(msg).toContain('Chrome');
  expect(msg).toContain('Chromium');
  expect(msg).toContain('Firefox');
  expect(msg).toContain('MD2PDF_BROWSER');
  ```
- **Problem:** Five message-less assertions in one test body, four of them substring
  checks against the same `msg` string. Per van Deursen et al. (2001) / Spadini et al.
  (2018), at the >=5 message-less-assertion threshold a failure gives no clue which
  invariant broke without opening the traceback to read the line number. The four
  `toContain` checks each represent a distinct invariant (each required keyword) and
  would benefit from per-assertion identification.
- **Production code:** `src/browserLocator.ts:228` (`throw new BrowserNotFoundError()`),
  message defined in `src/errors.ts`.

### TQ-02 — P4 Weak Assertion + unmet challenge claim (WARNING)

- **Test function:** `returns the first existing candidate in priority order`
- **File:** `tests/unit/browserLocator.test.ts`
- **Lines:** 98-108
- **Anti-pattern:** P4 (Weak Assertions — length/loose-matcher variant); also a
  challenge gap (test name overstates what is exercised).
- **Severity:** WARNING
- **Evidence (lines 99-107):**
  ```ts
  mockPlatform.mockReturnValue('darwin');
  const chromePath =
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  mockExistsSync.mockImplementation((p: string) => p === chromePath);
  mockExecFileSync.mockReturnValue('Google Chrome 124.0.0.0\n');

  const browser = locateBrowser();
  expect(browser.executablePath).toBe(chromePath);
  expect(browser.version).toMatch(/\d+\.\d+/);
  ```
- **Problem:** Two distinct weaknesses.
  (a) **Does not test priority order.** Only one candidate path
  (`/Applications/Google Chrome.app/...`) is made to exist; the other four entries in
  `CANDIDATES_DARWIN` (`src/browserLocator.ts:37-49`) all return `false` from
  `existsSync`. The test therefore proves only "the one existing path is returned," not
  "the *first* of several existing paths wins." If the production loop order regressed
  (e.g. iterated the list backwards), this test would still pass. The test name claims
  coverage it does not deliver.
  (b) **Loose version matcher.** The mock supplies the exact string `124.0.0.0`, yet the
  assertion is `toMatch(/\d+\.\d+/)`, which passes for `1.2`, `0.0`, or the production
  fallback `'0.0.0'` (`src/browserLocator.ts:132`). A regression in `getBrowserVersion`
  that lost the patch component, or that silently returned the `'0.0.0'` catch-fallback,
  would not be caught. An exact `toBe('124.0.0.0')` would assert the value actually
  parsed from production code.
- **Production code:** `src/browserLocator.ts:109-118` (`candidatesForPlatform`),
  `src/browserLocator.ts:218-226` (priority loop), `src/browserLocator.ts:124-136`
  (`getBrowserVersion`).

---

## Summary table

| Anti-pattern | critical | major | warning | info | total |
|---|---|---|---|---|---|
| P1 self_validating | 0 | – | – | – | 0 |
| P2 existence_only | – | 0 | – | – | 0 |
| P3 excessive_mocking | – | 0 | – | – | 0 |
| P4 weak_assertions | – | – | 1 | – | 1 |
| P5 source_grepping | – | – | 0 | – | 0 |
| P6 test_pollution | – | – | – | 0 | 0 |
| P7 eager_test | – | 0 | – | – | 0 |
| P8 conditional_logic | – | 0 | – | – | 0 |
| P9 assertion_roulette | – | – | 1 | – | 1 |
| P10 sensitive_equality | – | – | 0 | – | 0 |
| P11 dead_test | – | – | – | 0 | 0 |
| P12 mystery_guest | – | – | 0 | – | 0 |
| P13 missing_assertion | 0 | – | – | – | 0 |
| P14 slow_test | – | 0 | 0 | – | 0 |

---

## Aggregate scores

| Axis | Score |
|---|---|
| challenge | 0.75 |
| correctness | 0.75 |
| isolation | 1.0 |
| coverage_depth | 1.0 |
| **test_score** | **0.75** |
| weakest_axis | challenge / correctness |

## Verdict

**AUDIT_PASS** — `test_score = 0.75 > 0.5` and zero CRITICAL findings.

The suite mocks only at legitimate project boundaries (filesystem, subprocess, OS
platform), injects the internal `provisionDriver` collaborator rather than mocking it,
and drives real production logic end-to-end. Two WARNING-tier findings (one assertion
roulette, one weak-assertion-plus-unmet-challenge) cap the challenge and correctness
axes at 0.75 but leave the suite regression-protective.

## Severity tally (caller schema)

- critical: 0
- high (MAJOR): 0
- medium (WARNING): 2
- low (INFO): 0
- **total: 2**
