# Code-Quality Audit — webDriverClient.ts, converter.ts, releaseCatalog.ts

```json
{
  "project_version": "v0.1.1",
  "scope": "file:src/webDriverClient.ts, file:src/converter.ts, file:src/releaseCatalog.ts",
  "date": "2026-06-03",
  "files_analyzed": 3,
  "total_lines": 263,

  "detailed_analysis": "No function in these three files lies outright about what it does, so there is no P0-CRITICAL honesty defect — the worst finding here is a documented promise that the code does not fully keep. `convertFile` in converter.ts opens with a docstring (lines 16-19) that swears 'on any failure the output path is left untouched (no partial file)'. That clause is technically true for the *final* output path, but the function writes a sibling `.md2pdf-<ts>-<pid>.tmp` file (line 52-53) that is NOT registered for cleanup: the `finally` block (lines 55-62) only removes the HTML temp directory, never the PDF temp file. If `renameSync` throws after `writeFileSync` succeeds (cross-device rename, permission flip, disk-full mid-rename), the `.tmp` artifact is orphaned next to the user's output. The docstring's reassurance about 'no partial file' invites the reader to believe failure is leak-free; it is not. This is a HALF/BROKEN cleanup-contract defect, MAJOR. Compounding the dishonesty, the comment on line 51 calls this an 'Atomic-ish write' — 'atomic-ish' is an admission, in a comment, that the advertised atomicity is fiction; `writeFileSync` itself is not atomic and a crash mid-write leaves a truncated temp file (harmless to output, but the orphan persists).\n\nAfter honesty, the strongest defects are design-principle breaches in releaseCatalog.ts. `compareVersions` (lines 40-48) is a hand-rolled SemVer comparator that silently corrupts any version carrying a prerelease or build suffix: `'2.0.0-rc1'.split('.')` yields `['2','0','0-rc1']`, and `parseInt('0-rc1', 10) || 0` evaluates to `0`. So `2.0.0-rc1` compares EQUAL to `2.0.0`, and `selectNewestEligible` can return a prerelease as if it were the stable release — a silent wrong-result path on exactly the kind of input (rc/beta driver releases) a release catalog exists to discriminate. The `|| 0` swallows the parse failure instead of failing loud, violating the project's Fail-Fast standard (AGENTS.md §8) and KISS (reinventing semver comparison rather than using the parsing the rest of the toolchain already depends on). releaseCatalog.ts also carries a DRY seam: `isEligible` (lines 11-13) encodes the eligibility predicate `publishedAt <= cutoff`, but `selectNewestEligible` (line 27) re-implements the identical predicate inline rather than calling `isEligible`, so the two can drift.\n\nThe remaining findings are P2/P3 hygiene. webDriverClient.ts buries two unnamed magic numbers in `waitForDriverReady` (line 141 `500` status-probe timeout, line 147 `50` poll interval) while every other timing constant in the same file is a named constant (lines 9-10) — an internal inconsistency that violates the file's own established convention and AGENTS.md §9. The `wd` helper casts every response body to `{ value: unknown }` (line 30) on faith; a driver returning a non-`value`-shaped error body is handled only by luck. None of the three files breaches the size limits (all well under 300 lines; all functions under 40 lines).\n\nSecurity posture: threat model is local-only. webDriverClient.ts talks exclusively to `http://127.0.0.1:<port>` (line 13) — no remote egress, no untrusted network boundary. `executeScript` (lines 77-87) forwards an arbitrary `script` string to the WebDriver `/execute/sync` sink, but the script originates from md2pdf's own render pipeline, not from end-user document content, so it is not a user-controlled injection boundary at this layer. converter.ts reads a user-supplied `sourcePath` (line 29) and writes a temp file into `dirname(outputPath)` (line 52); both paths are operator-supplied CLI arguments, not network input — no traversal escalation beyond what the invoking user already controls. No hardcoded secrets, no shell execution, no untrusted deserialization. No security finding rises above INFO.",

  "dependency_graph_summary": {
    "total_modules": 3,
    "cyclic_dependencies": [],
    "highest_fan_in": {"module": "errors.ts (external to scope)", "imported_by": 2},
    "highest_fan_out": {"module": "converter.ts", "imports": 6}
  },

  "per_file_scores": [
    {
      "file": "src/converter.ts",
      "lines": 63,
      "function_count": 1,
      "class_count": 0,
      "correctness": 0.75,
      "structure": 1.0,
      "security": 1.0,
      "maintainability": 0.75,
      "code_score": 0.75,
      "weakest_axis": "correctness",
      "finding_count": 2
    },
    {
      "file": "src/releaseCatalog.ts",
      "lines": 49,
      "function_count": 4,
      "class_count": 0,
      "correctness": 0.5,
      "structure": 1.0,
      "security": 1.0,
      "maintainability": 0.75,
      "code_score": 0.5,
      "weakest_axis": "correctness",
      "finding_count": 3
    },
    {
      "file": "src/webDriverClient.ts",
      "lines": 151,
      "function_count": 8,
      "class_count": 0,
      "correctness": 0.75,
      "structure": 1.0,
      "security": 1.0,
      "maintainability": 0.75,
      "code_score": 0.75,
      "weakest_axis": "maintainability",
      "finding_count": 2
    }
  ],

  "findings": [
    {
      "id": "0001_BROKEN_CONTRACT_P0",
      "priority": "P0",
      "anti_pattern_class": "BROKEN_CONTRACT",
      "file": "src/converter.ts",
      "line": 51,
      "function_or_class": "convertFile",
      "severity": "MAJOR",
      "security_concern": null,
      "metrics": {"cleanup_paths_registered": 1, "temp_files_created": 2},
      "evidence": "/**\n * ... on any failure the output\n * path is left untouched (no partial file).\n */    (lines 16-19)\n...\n    // Stage 5: Atomic-ish write — write to a sibling temp file first, then rename\n    const tmpOut = join(dirname(outputPath), `.md2pdf-${Date.now()}-${process.pid}.tmp`);\n    writeFileSync(tmpOut, pdfBytes);\n    renameSync(tmpOut, outputPath);\n  } finally {\n    // Always clean up the temporary HTML directory\n    try {\n      rmSync(htmlTempDir, { recursive: true, force: true });",
      "evidence_lines": "16-62",
      "problem": "The docstring promises that failure leaves no partial file, and the inline comment brands the write 'Atomic-ish'. Both oversell. The `finally` block (lines 55-62) registers ONLY `htmlTempDir` for cleanup; the PDF temp file `tmpOut` (line 52) has no cleanup path. If `renameSync` (line 54) throws after `writeFileSync` (line 53) succeeds — cross-filesystem rename, a permission change between the two calls, or disk-full during the rename's metadata flush — a `.md2pdf-<ts>-<pid>.tmp` orphan is left sitting next to the user's output, contradicting the 'no partial file' guarantee in spirit. The word 'Atomic-ish' in a comment is itself an admission that the advertised atomicity is not real. BROKEN_CONTRACT: the documented post-failure invariant is not enforced by the code.",
      "affected_axis": "correctness"
    },
    {
      "id": "0002_KISS_P1",
      "priority": "P1",
      "anti_pattern_class": "KISS",
      "file": "src/releaseCatalog.ts",
      "line": 40,
      "function_or_class": "compareVersions",
      "severity": "MAJOR",
      "security_concern": null,
      "metrics": {"silent_coercions": 1, "prerelease_handling": "none"},
      "evidence": "function compareVersions(a: string, b: string): number {\n  const pa = a.split('.').map(n => parseInt(n, 10) || 0);\n  const pb = b.split('.').map(n => parseInt(n, 10) || 0);\n  ...\n    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);\n    if (diff !== 0) return diff;",
      "evidence_lines": "40-48",
      "problem": "Hand-rolled SemVer comparison that silently mishandles prerelease/build suffixes. `'2.0.0-rc1'.split('.')` -> `['2','0','0-rc1']`, and `parseInt('0-rc1', 10)` -> `0`, so the patch segment of any prerelease collapses to 0. Result: `compareVersions('2.0.0', '2.0.0-rc1')` returns 0 (EQUAL), and `selectNewestEligible` may hand back a prerelease driver as if it were the stable release. A release catalog's one job is to pick the right release; this comparator silently fails at exactly the prerelease inputs that distinction matters for. KISS: reinventing semver comparison instead of delegating to the parsing the toolchain already relies on; also a Fail-Fast (AGENTS.md §8) breach — the malformed segment is swallowed, not rejected.",
      "affected_axis": "correctness"
    },
    {
      "id": "0003_SILENT_SWALLOWING_P2",
      "priority": "P2",
      "anti_pattern_class": "SILENT_SWALLOWING",
      "file": "src/releaseCatalog.ts",
      "line": 41,
      "function_or_class": "compareVersions",
      "severity": "WARNING",
      "security_concern": null,
      "metrics": {"swallow_operator": "|| 0"},
      "evidence": "  const pa = a.split('.').map(n => parseInt(n, 10) || 0);\n  const pb = b.split('.').map(n => parseInt(n, 10) || 0);",
      "evidence_lines": "41-42",
      "problem": "`parseInt(n, 10) || 0` converts every unparseable version segment (and any legitimately-zero or NaN segment) to 0 with no signal. A version string like `'latest'`, `''`, or `'2.x'` is silently treated as `0.0.0` rather than rejected. Per AGENTS.md §8 (Fail Fast, Fail Loud) malformed input at this boundary should raise, not be coerced to a sentinel that produces a plausible-but-wrong ordering. This is the mechanism underlying finding 0002; flagged separately because the swallowing pattern is the reusable defect.",
      "affected_axis": "correctness"
    },
    {
      "id": "0004_DRY_P2",
      "priority": "P2",
      "anti_pattern_class": "DRY",
      "file": "src/releaseCatalog.ts",
      "line": 27,
      "function_or_class": "selectNewestEligible",
      "severity": "WARNING",
      "security_concern": null,
      "metrics": {"duplicate_predicate_sites": 2},
      "evidence": "export function isEligible(publishedAt: Date, now = new Date()): boolean {\n  return publishedAt.getTime() <= quarantineCutoff(now).getTime();   // line 12\n}\n...\n  const eligible = releases.filter(r => r.publishedAt.getTime() <= cutoff.getTime());   // line 27",
      "evidence_lines": "11-27",
      "problem": "The eligibility predicate `publishedAt <= cutoff` is defined once as the exported `isEligible` (lines 11-13) and then re-implemented inline inside `selectNewestEligible` (line 27) instead of calling `isEligible(r.publishedAt, now)`. Two authoritative copies of the same boundary rule (AGENTS.md DRY): a future change to eligibility — e.g. switching `<=` to `<`, or adding a grace component — must be made in both places or the public predicate and the selector silently disagree.",
      "affected_axis": "maintainability"
    },
    {
      "id": "0005_MAGIC_NUMBER_P3",
      "priority": "P3",
      "anti_pattern_class": "MAGIC_NUMBER",
      "file": "src/webDriverClient.ts",
      "line": 141,
      "function_or_class": "waitForDriverReady",
      "severity": "INFO",
      "security_concern": null,
      "metrics": {"unnamed_literals": 2, "named_constants_in_file": 4},
      "evidence": "      const res = await fetch(`${base(port)}/status`, {\n        signal: AbortSignal.timeout(500),\n      });\n      if (res.ok) return;\n    } catch {\n      // not ready yet — keep polling\n    }\n    await new Promise<void>(r => setTimeout(r, 50));",
      "evidence_lines": "140-147",
      "problem": "The status-probe timeout `500` (line 141) and the poll interval `50` (line 147) are bare inline literals, while every other timing value in this same file is a named constant (`FETCH_TIMEOUT_MS`, `PRINT_TIMEOUT_MS` lines 9-10). The file violates its own established convention and AGENTS.md §9 (name magic numbers with unit + intent, e.g. `STATUS_PROBE_TIMEOUT_MS`, `READINESS_POLL_INTERVAL_MS`). Their meaning is recoverable only by reading surrounding code.",
      "affected_axis": "maintainability"
    },
    {
      "id": "0006_PRIMITIVE_OBSESSION_P2",
      "priority": "P2",
      "anti_pattern_class": "PRIMITIVE_OBSESSION",
      "file": "src/webDriverClient.ts",
      "line": 30,
      "function_or_class": "wd",
      "severity": "INFO",
      "security_concern": "untrusted_input_parse",
      "metrics": {"unchecked_casts": 1},
      "evidence": "  const json = (await res.json()) as { value: unknown };\n\n  if (!res.ok) {\n    const msg =\n      typeof json.value === 'object' && json.value !== null && 'message' in json.value\n        ? String((json.value as { message: unknown }).message)\n        : `HTTP ${res.status}`;",
      "evidence_lines": "30-36",
      "problem": "The response body is force-cast to `{ value: unknown }` (line 30) with no runtime check that `value` exists. The W3C WebDriver protocol does guarantee the `value` envelope, so this is internal-only and low-impact, but a driver returning a malformed or non-JSON error body lands here: `res.json()` would throw on non-JSON (acceptable fail-loud), yet a JSON body lacking `value` passes the cast silently and yields `undefined`. The error path (lines 32-37) handles the missing-`message` case defensively but the happy path (line 40 `return json.value`) trusts the cast wholesale. INFO: a small unchecked-boundary smell, not a vulnerability — the peer is a localhost driver, not a network attacker.",
      "affected_axis": "maintainability"
    }
  ],

  "findings_sort_order": "By priority (P0 first), then severity (MAJOR > WARNING > INFO), then file path. 0001 is the worst defect.",

  "aggregate_scores": {
    "correctness": 0.5,
    "structure": 1.0,
    "security": 1.0,
    "maintainability": 0.75,
    "code_score": 0.5,
    "weakest_axis": "correctness"
  },

  "priority_summary": {
    "P0_honesty_and_catastrophic": {"critical": 0, "major": 1, "total": 1, "comment": "convertFile's documented 'no partial file on failure' guarantee leaks an unreferenced PDF temp file when renameSync fails. 'Atomic-ish' comment admits the overpromise."},
    "P1_design_principles": {"major": 1, "warning": 0, "total": 1, "comment": "Hand-rolled compareVersions silently collapses prerelease versions to equal — KISS + Fail-Fast breach with a silent wrong-result path."},
    "P2_metrics_and_security": {"warning": 2, "info": 1, "total": 3, "comment": "parseInt || 0 swallowing, isEligible duplicated inline in selectNewestEligible, unchecked response-envelope cast."},
    "P3_style_and_hygiene": {"info": 1, "total": 1, "comment": "Two unnamed timing literals in waitForDriverReady against the file's own named-constant convention."}
  },

  "summary_table": {
    "LYING_NAME": {"critical": 0, "major": 0, "total": 0},
    "HIDDEN_SIDE_EFFECTS": {"critical": 0, "major": 0, "total": 0},
    "BROKEN_CONTRACT": {"critical": 0, "major": 1, "total": 1},
    "ASYMMETRIC_ROUND_TRIP": {"critical": 0, "major": 0, "total": 0},
    "HALF_FINISHED_REFACTOR": {"critical": 0, "major": 0, "total": 0},
    "HARDCODED_SECRET": {"critical": 0, "total": 0},
    "INJECTION": {"critical": 0, "major": 0, "total": 0},
    "SILENT_SWALLOWING": {"critical": 0, "major": 0, "warning": 1, "total": 1},
    "MUTABLE_DEFAULT": {"critical": 0, "major": 0, "total": 0},
    "NO_OP_IMPLEMENTATION": {"critical": 0, "total": 0},
    "POLA": {"major": 0, "warning": 0, "total": 0},
    "KISS": {"major": 1, "warning": 0, "total": 1},
    "YAGNI": {"warning": 0, "total": 0},
    "DRY": {"major": 0, "warning": 1, "total": 1},
    "SRP": {"major": 0, "total": 0},
    "SOC": {"major": 0, "total": 0},
    "GOD_MODULE": {"major": 0, "total": 0},
    "GOD_CLASS": {"major": 0, "total": 0},
    "LONG_FUNCTION": {"major": 0, "total": 0},
    "FEATURE_ENVY": {"major": 0, "total": 0},
    "SHOTGUN_SURGERY": {"major": 0, "total": 0},
    "DEEP_NESTING": {"major": 0, "total": 0},
    "CYCLIC_DEPENDENCIES": {"major": 0, "total": 0},
    "GLOBAL_MUTABLE_STATE": {"major": 0, "total": 0},
    "DIVERGENT_CHANGE": {"major": 0, "total": 0},
    "COMPLEX_CONDITIONAL": {"warning": 0, "total": 0},
    "MESSAGE_CHAIN": {"warning": 0, "total": 0},
    "INAPPROPRIATE_INTIMACY": {"warning": 0, "total": 0},
    "DATA_CLUMPS": {"warning": 0, "total": 0},
    "IMPORT_SIDE_EFFECTS": {"warning": 0, "total": 0},
    "STAR_IMPORTS": {"warning": 0, "total": 0},
    "MIDDLE_MAN": {"warning": 0, "total": 0},
    "PRIMITIVE_OBSESSION": {"warning": 0, "info": 1, "total": 1},
    "MISSING_TYPES": {"info": 0, "total": 0},
    "DEAD_CODE": {"info": 0, "total": 0},
    "TOO_MANY_PARAMS": {"info": 0, "total": 0},
    "MAGIC_NUMBER": {"info": 1, "total": 1},
    "MAGIC_STRING": {"info": 0, "total": 0},
    "INCONSISTENT_NAMING": {"info": 0, "total": 0}
  },

  "verdict": "AUDIT_WEAK",
  "verdict_summary": "No lies and no security holes, but a documented 'no partial file on failure' guarantee that leaks an orphan temp file, plus a hand-rolled semver comparator that silently equates prereleases with stable releases — one P0-MAJOR and one P1-MAJOR drag correctness to 0.5."
}
```

## Severity mapping (catalog severity -> index buckets)

| Catalog severity | Index bucket |
|------------------|--------------|
| CRITICAL | critical |
| MAJOR | high |
| WARNING | medium |
| INFO | low |

- critical: 0
- high (MAJOR): 2  — 0001_BROKEN_CONTRACT, 0002_KISS
- medium (WARNING): 2 — 0003_SILENT_SWALLOWING, 0004_DRY
- low (INFO): 2 — 0005_MAGIC_NUMBER, 0006_PRIMITIVE_OBSESSION
- total: 6
