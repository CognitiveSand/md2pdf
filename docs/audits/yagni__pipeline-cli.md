# YAGNI Audit — `src/pipeline.ts` and `src/cli.ts`

**Scope:** Read-only forensic audit of `src/pipeline.ts` and `src/cli.ts` only.
**Method:** Each file read in full. Every exported symbol and optional parameter was cross-checked
against the rest of the repository (`src/**`, `tests/**`, `README.md`, `docs/`) for actual usage
before being flagged.
**Date:** 2026-06-03

---

## Detailed Analysis

The two files form the orchestration + CLI-entry layer of md2pdf. `cli.ts` parses arguments and
delegates to `runConversionPipeline` in `pipeline.ts`, which resolves entries, decides overwrites,
and invokes `convertFile`. Both files are dependency-injection-friendly (injectable `converter`,
`runner`, `stdin/stdout/stderr`), and that injection is genuinely exercised by the test suite, so it
is **not** flagged.

The YAGNI problems are concentrated in **speculative data that is produced but never consumed** and
**one injection seam that is wired through the pipeline but dead at the only production call site**:

- `PipelineOptions.convertOptions` is plumbed from `runConversionPipeline` into `convertFile`
  (pipeline.ts:46, pipeline.ts:150) but is **never set by the CLI** (cli.ts:68–76 omits it) and is
  **never supplied by any test** (`grep convertOptions` across `tests/**` returns nothing). It exists
  purely so a caller *could* one day pass `renderTimeoutMs`/`provisioner` — a textbook
  "just-in-case" pass-through. The pipeline's own tests inject a `converter` fake whose signature
  ignores the third argument, so the channel is verified by nothing.

- `PipelineResult.outcomes` (pipeline.ts:23) and `ConversionOutcome.error` (pipeline.ts:19) are
  fully populated on every code path but **read by no one**. No test asserts on `.outcomes` or
  `outcome.error` (confirmed by grep over `tests/**`), and the CLI consumes only `result.exitCode`
  (cli.ts:78). The numeric roll-up fields `succeeded/failed/skipped` ARE asserted by pipeline tests,
  so they are justified; the per-item `outcomes` array and its `error` payload are the speculative
  surplus — a richly-structured audit trail built for a consumer that does not exist.

- The empty-string sentinel `outputPath: ''` (pipeline.ts:114) exists only to satisfy the shape of
  the unused `outcomes` array when entry resolution fails before an output path is known. It is a
  meaningless placeholder value that survives solely because of the speculative structure above; if
  `outcomes`/`error` were trimmed to current needs, this sentinel would not need to exist.

None of the above is mandated by README/docs (no references found) or by a public API contract, and
none is required for testing (the tests that drive these files never touch the flagged members).

### Justified — explicitly NOT flagged

- **Injectable `converter` / `runner` / `stdin`/`stdout`/`stderr`** (pipeline.ts:42–45, cli.ts:23–26):
  used by `tests/unit/pipeline.test.ts` (`converter: fakeConverter(...)`, 6 sites) and
  `tests/unit/cli.test.ts` (`runner:` overrides, stream capture). Legitimate test seams at a
  project boundary.
- **`isDirectInvocation`** (cli.ts:102): exported and directly tested
  (`tests/unit/cli.test.ts:124,131`). Justified.
- **`PipelineResult.succeeded/failed/skipped`** (pipeline.ts:24–26): asserted by pipeline tests
  (lines 60,61,92,150,151,180,181,208,209,210). Justified.
- **Defensive `instanceof` error wrapping** (pipeline.ts:153–155, cli.ts:84–98): handles real
  heterogeneous throw sources (`parseArgs` ERR_PARSE_ARGS codes, non-Error throws). Justified.

---

## List of Issues

### [YAGNI-Speculative Generality] `PipelineOptions.convertOptions` pass-through is never wired by any caller

**Location:** `src/pipeline.ts:46` (declaration), `src/pipeline.ts:150` (use)

**Code:**
```ts
// line 46
  convertOptions?: ConvertOptions;
...
// line 150
      await converter(item.sourcePath, item.outputPath, options.convertOptions);
```

**Issue:** `convertOptions` is an injection channel for `ConvertOptions` (`renderTimeoutMs`,
`provisioner`). The only production caller, `cli.ts` `main`, never sets it (cli.ts:68–76 builds the
runner payload without `convertOptions`), and **no test passes it** — a full-repo grep of
`convertOptions` returns only the two lines in `pipeline.ts` itself. The CLI exposes no `--timeout`
flag or any other surface that would populate it. It is plumbing built for a hypothetical future
caller. (`provisioner` injection that tests *do* use is wired separately, through `browserLocator`
tests, not through this field.)

**Recommendation:** Remove `convertOptions` from `PipelineOptions` and pass nothing as the third
arg to `converter`, until a real caller (e.g. a `--timeout` flag) needs it.

**Confidence:** High — zero callers in src, tests, or docs.

---

### [YAGNI-Unused Code] `ConversionOutcome.error` is populated everywhere but read nowhere

**Location:** `src/pipeline.ts:19` (declaration), `src/pipeline.ts:115,156` (populated)

**Code:**
```ts
// line 15-20
export interface ConversionOutcome {
  sourcePath: string;
  outputPath: string;
  status: 'success' | 'failed' | 'skipped';
  error?: Error;
}
...
// line 111-116 (resolve failure)
      outcomes.push({
        sourcePath: conversionError.sourcePath ?? entry,
        outputPath: '',
        status: 'failed',
        error: conversionError,
      });
...
// line 156 (convert failure)
      outcomes.push({ ...item, status: 'failed', error: wrapped });
```

**Issue:** The `error` field is attached to every failed outcome, but no consumer ever reads it. The
CLI uses only `result.exitCode` (cli.ts:78); no test in `tests/**` references `outcome.error` or any
`.error` on a pipeline result (grep confirms). The user-facing error text is already emitted via
`writeLine(stderr, ...)` at the point of failure (pipeline.ts:117,157), so the stored `Error` is a
duplicate, unconsumed payload kept "in case" some caller wants structured failures.

**Recommendation:** Drop the `error` field (and the assignments at 115 and 156) until a consumer
needs structured error access; stderr already carries the messages.

**Confidence:** High — no reader in src, tests, or docs.

---

### [YAGNI-Unused Code] `PipelineResult.outcomes` array is assembled but consumed by no one

**Location:** `src/pipeline.ts:23` (declaration), `src/pipeline.ts:94,111,145,151,156,167` (built/returned)

**Code:**
```ts
// line 22-28
export interface PipelineResult {
  outcomes: ConversionOutcome[];
  succeeded: number;
  failed: number;
  skipped: number;
  exitCode: 0 | 1;
}
```

**Issue:** The full per-item `outcomes` list is built across the pipeline and returned, but the only
production consumer (`cli.ts`) reads just `exitCode`, and **no test asserts on `.outcomes`** (grep of
`tests/**` for `.outcomes` / `outcome.` returns nothing; the only test reference is constructing an
empty `outcomes: []` stub in `tests/unit/cli.test.ts:25`). The aggregate counts
`succeeded/failed/skipped` already satisfy every current need and *are* asserted. The detailed
`outcomes` array is a speculative audit trail with no current reader.

**Recommendation:** Remove `outcomes` from `PipelineResult` (and stop accumulating the
`outcomes.push(...)` items beyond what the counters need), or reduce the pipeline to maintaining only
the three counters, until a caller requires the per-file breakdown.

**Confidence:** Medium — it is plausibly intended as a stable library return shape, but nothing in
the repo (code, tests, README, docs) consumes or documents it, so on current evidence it is dead
surplus.

---

### [YAGNI-Speculative Generality] `outputPath: ''` sentinel exists only to feed the unused `outcomes` array

**Location:** `src/pipeline.ts:114`

**Code:**
```ts
      outcomes.push({
        sourcePath: conversionError.sourcePath ?? entry,
        outputPath: '',
        status: 'failed',
        error: conversionError,
      });
```

**Issue:** When entry resolution fails (before any output path is computed), the code fabricates an
empty-string `outputPath` purely to satisfy the `ConversionOutcome` shape. An empty path is not a
real output path — it is a placeholder that only exists because the speculative `outcomes`/`error`
structure (flagged above) demands one. No consumer ever reads this value. It is a meaningless
"just-in-case" sentinel.

**Recommendation:** This disappears naturally if `outcomes`/`error` are trimmed to current needs;
otherwise it should at minimum not invent a fake path for a record nobody reads.

**Confidence:** Medium — depends on the resolution of the `outcomes` finding above; on its own it is a
small but real placeholder-value smell.

---

## YAGNI Summary

**Total violations found:** 4
- Unused Code: 2
- Premature Abstraction: 0
- Speculative Generality: 2
- Over-Engineering: 0
- Defensive Coding Excess: 0
- Future-Proofing: 0

**Impact Assessment:**
The violations are low-blast-radius but real: a richly-typed result object (`outcomes` + per-item
`error`) and an `ConvertOptions` pass-through channel are carried through the pipeline for consumers
that do not exist anywhere in the codebase, tests, or docs. They inflate the public surface of
`PipelineResult`/`PipelineOptions`, add unread assignments on every code path, and force a fake
empty-string sentinel. None breaks behaviour, but each is maintenance weight and a future-proofing
hedge with no current customer. The genuinely useful seams (injectable `converter`/`runner`/streams,
the numeric counters, `isDirectInvocation`) are all backed by tests and correctly out of scope.

**Top Priority Removals:**
1. `PipelineOptions.convertOptions` pass-through (pipeline.ts:46,150) — wired end-to-end yet set by
   no caller in src or tests.
2. `ConversionOutcome.error` field (pipeline.ts:19,115,156) — populated everywhere, read nowhere;
   duplicates stderr output.
3. `PipelineResult.outcomes` array (pipeline.ts:23 + accumulation sites) — and with it the
   `outputPath: ''` sentinel at pipeline.ts:114.
