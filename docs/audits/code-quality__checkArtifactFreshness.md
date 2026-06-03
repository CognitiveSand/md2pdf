# Code-Quality Audit — `scripts/checkArtifactFreshness.mjs`

```json
{
  "project_version": "0.1.1",
  "scope": "file:scripts/checkArtifactFreshness.mjs",
  "date": "2026-06-03",
  "files_analyzed": 1,
  "total_lines": 254,

  "detailed_analysis": "The headline defect is a lie: `assert(condition, message)` at lines 123-127 is named `assert` — the single most loaded name in the JS/Node vocabulary, where it universally means 'throw if false' (`node:assert`, `console.assert`, every test framework). This `assert` throws nothing. It silently appends `message` to a module-global `failures` array and returns. Every reader who skims `assert(await exists(manifestPath), \"Missing artifacts.json\")` at line 131 reads it as fail-fast; it is the opposite — fail-deferred, fail-quiet-until-the-end. Worse, because it does not short-circuit, the very next line (132) has to RE-evaluate `await exists(manifestPath)` to guard the `readJson` that would otherwise blow up — the author had to write a manual guard precisely because their `assert` does not assert. That double `exists()` call (lines 131 + 132) is the smoking gun proving the name misled even its own author. This is a P0 LYING_NAME, and it pairs with a fail-fast-policy violation: the project's own AGENTS.md mandates fail-fast, and this helper is engineered to fail slow.\n\nThe second structural defect is GLOBAL_MUTABLE_STATE. `failures = []` (line 11) is a module-level mutable array that `assert` (123), `freshnessFailures`-consumers (197-204), `checkNpmLockFreshness` (203, 206), and `main` (239-243) all read and mutate by side effect. The module exports `lockVersionSignature` and `freshnessFailures` (the latter correctly takes its OWN local `failures` and returns it — lines 69, 120 — which is the right shape), but the imperative check functions (`checkArtifactManifest`, `checkNpmLockFreshness`, `checkPolicyFiles`) all communicate exclusively through the hidden module global. Two contradictory error-collection idioms coexist in one 254-line file: the pure `freshnessFailures` that returns a list, and the global-mutating `assert` that swallows into a shared array. This is a HALF_FINISHED_REFACTOR pattern — the pure style was clearly introduced for the testable export and never propagated to the rest of the file.\n\nSecurity posture: threat model is a local/CI build-gate script invoked via `npm run check:artifacts`, reading repo-local JSON and shelling out to `npm`. `execFileSync(\"npm\", [...])` (line 178) uses the array form with no shell, so the interpolated `cutoff.toISOString()` (line 185) is NOT a command-injection vector — argv is passed directly to execve. `npm` is resolved from `$PATH` rather than a pinned path, which is a minor supply-chain/PATH-hijack consideration but standard for repo tooling and not exploitable by external input. No untrusted network input, no secrets, no deserialization of attacker data (the JSON read is repo-controlled). No CRITICAL or MAJOR security findings. The one swallow-and-flatten of all exceptions at line 205-206 is discussed below as a separate honesty/error-handling defect, not a security hole.\n\nRemaining findings are P1 design-principle and P2/P3 hygiene: `freshnessFailures` exceeds the 40-line function limit (54 lines), `artifacts.json` is read twice (lines 136 and 193) with no shared parse, `exists` (async stat) and `existsSync` (line 195) are two different existence idioms in one file, the broad `catch` at line 205 collapses every distinct npm/IO failure into one opaque string, and the `24 * 60 * 60 * 1000` literal at line 10 is an un-named magic number despite the file's own discipline of naming `QUARANTINE_DAYS`.",

  "dependency_graph_summary": {
    "total_modules": 1,
    "cyclic_dependencies": [],
    "highest_fan_in": {"module": "scripts/checkArtifactFreshness.mjs", "imported_by": 0},
    "highest_fan_out": {"module": "scripts/checkArtifactFreshness.mjs", "imports": 6}
  },

  "per_file_scores": [
    {
      "file": "scripts/checkArtifactFreshness.mjs",
      "lines": 254,
      "function_count": 9,
      "class_count": 0,
      "correctness": 0.5,
      "structure": 0.5,
      "security": 1.0,
      "maintainability": 0.5,
      "code_score": 0.5,
      "weakest_axis": "correctness",
      "finding_count": 8
    }
  ],

  "findings": [
    {
      "id": "0001_LYING_NAME_P0",
      "priority": "P0",
      "anti_pattern_class": "LYING_NAME",
      "file": "scripts/checkArtifactFreshness.mjs",
      "line": 123,
      "function_or_class": "assert",
      "severity": "CRITICAL",
      "security_concern": null,
      "metrics": {"throws": false, "name_implies_throw": true, "callers": 17},
      "evidence": "function assert(condition, message) {\n  if (!condition) {\n    failures.push(message);\n  }\n}\n...\nassert(await exists(manifestPath), \"Missing artifacts.json\");\nif (!(await exists(manifestPath))) {   // manual re-guard, because assert did NOT halt\n  return;\n}",
      "evidence_lines": "123-127, 131-134",
      "problem": "`assert` is the most overloaded fail-fast verb in JavaScript: `node:assert`, `console.assert`, and every test runner define `assert(false)` as 'raise / halt now'. This `assert` throws nothing and halts nothing — it appends `message` to the module-global `failures` array (line 125) and returns, letting execution continue past a failed invariant. Every one of its ~17 call sites (lines 131, 137-150, 152-155, 158-162, 217-219, 223-230) reads as fail-fast and is in fact fail-deferred. The proof the name misleads is in the author's own code: line 132 must re-evaluate `await exists(manifestPath)` to manually `return` early, precisely because the preceding `assert(... )` on line 131 did not stop execution before the `readJson(manifestPath)` on line 136. The name lies, and it forces defensive double-checks. This also breaches the project's explicit fail-fast / fail-loud standard (AGENTS.md §8): the helper is built to fail slow and quiet.",
      "affected_axis": "correctness"
    },
    {
      "id": "0002_GLOBAL_MUTABLE_STATE_P1",
      "priority": "P1",
      "anti_pattern_class": "GLOBAL_MUTABLE_STATE",
      "file": "scripts/checkArtifactFreshness.mjs",
      "line": 11,
      "function_or_class": "module-level failures[]",
      "severity": "MAJOR",
      "security_concern": null,
      "metrics": {"mutating_sites": 5, "reading_sites": 2},
      "evidence": "const failures = [];   // line 11\n...\nfailures.push(message);            // assert, line 125\nfailures.push(failure);            // checkNpmLockFreshness, line 203\nfailures.push(`npm freshness check failed: ${error.message}`);  // line 206\nif (failures.length > 0) { ... }   // main, line 239",
      "evidence_lines": "11, 125, 203, 206, 239-243",
      "problem": "A module-level mutable array is the sole communication channel between `assert`, `checkArtifactManifest`, `checkNpmLockFreshness`, `checkPolicyFiles`, and `main`. None of these functions take or return the accumulator; they reach into the shared global by side effect. This creates hidden coupling (any caller mutates the same array), defeats reuse (you cannot run two checks independently — they pollute one another's results), and makes the file non-idempotent if `main` is ever invoked twice in one process. The file already demonstrates the correct shape one function below: `freshnessFailures` (line 68) builds and returns its OWN local `failures` (lines 69, 120). The contrast within the same file shows the global is a deliberate-but-wrong idiom, not a constraint.",
      "affected_axis": "structure"
    },
    {
      "id": "0003_SILENT_SWALLOWING_P2",
      "priority": "P2",
      "anti_pattern_class": "SILENT_SWALLOWING",
      "file": "scripts/checkArtifactFreshness.mjs",
      "line": 205,
      "function_or_class": "checkNpmLockFreshness",
      "severity": "MAJOR",
      "security_concern": "error_masking",
      "metrics": {"distinct_failure_modes_collapsed": 4},
      "evidence": "} catch (error) {\n  failures.push(`npm freshness check failed: ${error.message}`);\n} finally {\n  rmSync(temp, { recursive: true, force: true });\n}",
      "evidence_lines": "205-209",
      "problem": "A single broad `catch (error)` wraps the entire freshness path: the `npm install --before` subprocess (178), both `readJson` calls (190-191), the `readJson(join(root, \"artifacts.json\"))` at line 193, and `freshnessFailures` (197). Four structurally different failures — npm not on PATH, network-blocked registry, malformed/missing `artifacts.json`, and a genuine staleness mismatch — all collapse into one opaque `npm freshness check failed: <message>` string. A real freshness violation (the gate's actual purpose) is indistinguishable from a CI environment that lacks npm or network. error.stack is discarded. This masks the difference between 'the gate caught stale artifacts' and 'the gate could not run', which for a policy-enforcement script is a correctness-grade defect: a non-runnable gate that reports a generic failure invites being treated as flaky and ignored.",
      "affected_axis": "correctness"
    },
    {
      "id": "0004_LONG_FUNCTION_P2",
      "priority": "P2",
      "anti_pattern_class": "LONG_FUNCTION",
      "file": "scripts/checkArtifactFreshness.mjs",
      "line": 68,
      "function_or_class": "freshnessFailures",
      "severity": "MAJOR",
      "security_concern": null,
      "metrics": {"lines": 54, "limit": 40, "responsibilities": 2},
      "evidence": "export function freshnessFailures(committedLock, regeneratedLock, waivers, auditExists) {\n  const failures = [];\n  const exemptPaths = new Set();\n  for (const waiver of waivers) { ... 5 distinct validation branches ... }\n  if (lockVersionSignature(...) !== lockVersionSignature(...)) { ... }\n  return failures;\n}",
      "evidence_lines": "68-121",
      "problem": "54 lines (lines 68-121), exceeding the project's explicit 40-line function limit (AGENTS.md §3). The body does two separable things: (1) waiver validation — iterating waivers, checking five required-field/locked-version/audit-existence conditions, and accumulating both failures and exempt paths (lines 72-109); and (2) the signature comparison that produces the staleness verdict (lines 111-118). The waiver-validation loop is an extractable `validateWaiver(waiver, committedLock, auditExists)` returning {failure?, exemptPath?}. As written, the function carries two reasons to change (waiver schema rules vs. comparison policy), an SRP smell layered on the size violation.",
      "affected_axis": "structure"
    },
    {
      "id": "0005_DRY_P1",
      "priority": "P1",
      "anti_pattern_class": "DRY",
      "file": "scripts/checkArtifactFreshness.mjs",
      "line": 193,
      "function_or_class": "checkNpmLockFreshness / checkArtifactManifest",
      "severity": "WARNING",
      "security_concern": null,
      "metrics": {"reads_of_artifacts_json": 2},
      "evidence": "// checkArtifactManifest, line 136\nconst manifest = readJson(manifestPath);   // manifestPath = join(root, \"artifacts.json\")\n// checkNpmLockFreshness, line 193\nconst manifest = readJson(join(root, \"artifacts.json\"));",
      "evidence_lines": "130, 136, 193",
      "problem": "`artifacts.json` is parsed twice from disk into two independent `manifest` bindings — once in `checkArtifactManifest` (line 136) and again in `checkNpmLockFreshness` (line 193) — with no shared parse. The path string `join(root, \"artifacts.json\")` is itself duplicated (line 130 builds `manifestPath`; line 193 re-builds the same join inline). Beyond the redundant I/O, the second read (line 193) sits inside the broad try/catch and is NOT existence-guarded, so a missing `artifacts.json` throws here and is mislabelled as `npm freshness check failed` (see 0003) rather than the accurate 'Missing artifacts.json' that `checkArtifactManifest` would emit. The two reads can also observe different file contents if the manifest changes mid-run. Knowledge of where/how the manifest is loaded is split across two functions.",
      "affected_axis": "maintainability"
    },
    {
      "id": "0006_DRY_P3",
      "priority": "P3",
      "anti_pattern_class": "DRY",
      "file": "scripts/checkArtifactFreshness.mjs",
      "line": 17,
      "function_or_class": "exists / existsSync usage",
      "severity": "INFO",
      "security_concern": null,
      "metrics": {"existence_idioms": 2},
      "evidence": "async function exists(path) { try { await stat(path); return true; } catch { return false; } }  // lines 17-24\n...\nconst auditExists = (reportPath) => existsSync(join(root, reportPath));  // line 195",
      "evidence_lines": "17-24, 195",
      "problem": "Two different file-existence idioms coexist: a hand-rolled async `exists` wrapping `stat` (lines 17-24, used by every check function) and the synchronous `existsSync` import (line 2) used only at line 195 for `auditExists`. The hand-rolled `exists` also swallows the stat error category (a permission error is reported identically to not-found), where `existsSync` would be the simpler stdlib equivalent. Two ways to ask the same question in a 254-line file is a low-grade consistency smell that taxes the reader deciding which to trust.",
      "affected_axis": "maintainability"
    },
    {
      "id": "0007_IMPORT_SIDE_EFFECTS_P2",
      "priority": "P2",
      "anti_pattern_class": "IMPORT_SIDE_EFFECTS",
      "file": "scripts/checkArtifactFreshness.mjs",
      "line": 10,
      "function_or_class": "module top-level cutoff",
      "severity": "WARNING",
      "security_concern": null,
      "metrics": {"nondeterministic_top_level_reads": 1},
      "evidence": "const cutoff = new Date(Date.now() - QUARANTINE_DAYS * 24 * 60 * 60 * 1000);",
      "evidence_lines": "9-11",
      "problem": "`cutoff` is computed at module-evaluation time by reading the wall clock (`Date.now()`). Because the module exports testable functions (`lockVersionSignature`, `freshnessFailures`), importing this file for a unit test silently captures the import-time clock into a frozen `cutoff`. The freshness window is therefore bound to whenever the module was first imported, not to when the check actually runs — a non-idempotent, time-dependent import side effect. `root` (line 9) similarly resolves a filesystem path at import. The clock read should live inside `checkNpmLockFreshness` so the cutoff reflects run time, not import time.",
      "affected_axis": "correctness"
    },
    {
      "id": "0008_MAGIC_NUMBER_P3",
      "priority": "P3",
      "anti_pattern_class": "MAGIC_NUMBER",
      "file": "scripts/checkArtifactFreshness.mjs",
      "line": 10,
      "function_or_class": "module top-level",
      "severity": "INFO",
      "security_concern": null,
      "metrics": {"unnamed_literals": 1},
      "evidence": "const cutoff = new Date(Date.now() - QUARANTINE_DAYS * 24 * 60 * 60 * 1000);",
      "evidence_lines": "10",
      "problem": "`24 * 60 * 60 * 1000` (milliseconds-per-day) is an un-named compound literal embedded in the cutoff arithmetic. The file otherwise observes its own no-hardcoding discipline by naming `QUARANTINE_DAYS = 7` (line 8), which makes this inline day-in-ms factor an inconsistency. A named `MS_PER_DAY = 24 * 60 * 60 * 1000` (with its unit in the name, per AGENTS.md §9) would state the intent. Minor, cosmetic — but it is exactly the class of literal the project standard asks to name.",
      "affected_axis": "maintainability"
    }
  ],

  "findings_sort_order": "By priority (P0 first), then severity (CRITICAL > MAJOR > WARNING > INFO), then file path. 0001 is the worst (LYING_NAME assert). Sequence numbers are pure-increasing.",

  "aggregate_scores": {
    "correctness": 0.5,
    "structure": 0.5,
    "security": 1.0,
    "maintainability": 0.5,
    "code_score": 0.5,
    "weakest_axis": "correctness"
  },

  "priority_summary": {
    "P0_honesty_and_catastrophic": {"critical": 1, "major": 0, "total": 1, "comment": "`assert` lies — it never asserts; it defers and swallows into a global. Read first."},
    "P1_design_principles": {"major": 1, "warning": 1, "total": 2, "comment": "Global mutable state as the sole error channel; artifacts.json knowledge split across two functions."},
    "P2_metrics_and_security": {"major": 2, "warning": 1, "total": 3, "comment": "freshnessFailures over 40 lines; broad catch masks 4 distinct failures; time-dependent import side effect. No exploitable security finding (execFileSync uses argv, no shell)."},
    "P3_style_and_hygiene": {"info": 2, "total": 2, "comment": "Two existence idioms; un-named ms-per-day literal."}
  },

  "summary_table": {
    "LYING_NAME": {"critical": 1, "major": 0, "total": 1},
    "HIDDEN_SIDE_EFFECTS": {"critical": 0, "major": 0, "total": 0},
    "BROKEN_CONTRACT": {"critical": 0, "major": 0, "total": 0},
    "ASYMMETRIC_ROUND_TRIP": {"critical": 0, "major": 0, "total": 0},
    "HALF_FINISHED_REFACTOR": {"critical": 0, "major": 0, "total": 0},
    "HARDCODED_SECRET": {"critical": 0, "total": 0},
    "INJECTION": {"critical": 0, "major": 0, "total": 0},
    "SILENT_SWALLOWING": {"critical": 0, "major": 1, "total": 1},
    "MUTABLE_DEFAULT": {"critical": 0, "major": 0, "total": 0},
    "NO_OP_IMPLEMENTATION": {"critical": 0, "total": 0},
    "POLA": {"major": 0, "warning": 0, "total": 0},
    "KISS": {"major": 0, "warning": 0, "total": 0},
    "YAGNI": {"warning": 0, "total": 0},
    "DRY": {"major": 0, "warning": 1, "info": 1, "total": 2},
    "SRP": {"major": 0, "total": 0},
    "SOC": {"major": 0, "total": 0},
    "GOD_MODULE": {"major": 0, "total": 0},
    "GOD_CLASS": {"major": 0, "total": 0},
    "LONG_FUNCTION": {"major": 1, "total": 1},
    "FEATURE_ENVY": {"major": 0, "total": 0},
    "SHOTGUN_SURGERY": {"major": 0, "total": 0},
    "DEEP_NESTING": {"major": 0, "total": 0},
    "CYCLIC_DEPENDENCIES": {"major": 0, "total": 0},
    "GLOBAL_MUTABLE_STATE": {"major": 1, "total": 1},
    "DIVERGENT_CHANGE": {"major": 0, "total": 0},
    "COMPLEX_CONDITIONAL": {"warning": 0, "total": 0},
    "MESSAGE_CHAIN": {"warning": 0, "total": 0},
    "INAPPROPRIATE_INTIMACY": {"warning": 0, "total": 0},
    "DATA_CLUMPS": {"warning": 0, "total": 0},
    "IMPORT_SIDE_EFFECTS": {"warning": 1, "total": 1},
    "STAR_IMPORTS": {"warning": 0, "total": 0},
    "MIDDLE_MAN": {"warning": 0, "total": 0},
    "PRIMITIVE_OBSESSION": {"warning": 0, "total": 0},
    "MISSING_TYPES": {"info": 0, "total": 0},
    "DEAD_CODE": {"info": 0, "total": 0},
    "TOO_MANY_PARAMS": {"info": 0, "total": 0},
    "MAGIC_NUMBER": {"info": 1, "total": 1},
    "MAGIC_STRING": {"info": 0, "total": 0},
    "INCONSISTENT_NAMING": {"info": 0, "total": 0}
  },

  "verdict": "AUDIT_FAIL",
  "verdict_summary": "One P0-CRITICAL honesty defect: `assert` never asserts — it defers failures into a module global, directly contradicting the project's fail-fast standard and forcing the author's own manual re-guard. A single P0-CRITICAL is sufficient to FAIL."
}
```

## Severity mapping (for index)

The structured index uses critical/high/medium/low. Mapping from severity:
- critical (CRITICAL) = 1  → 0001
- high (MAJOR) = 4         → 0002, 0003, 0004 ... wait, recount below
- medium (WARNING) = 2     → 0005, 0007
- low (INFO) = 2           → 0006, 0008

Recount by severity field:
- CRITICAL: 0001 → 1
- MAJOR: 0002, 0003, 0004 → 3
- WARNING: 0005, 0007 → 2
- INFO: 0006, 0008 → 2

Index counts: critical=1, high=3, medium=2, low=2, total=8.
