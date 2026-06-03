# Code-Quality Forensic Audit — `src/pipeline.ts` + `src/cli.ts`

```json
{
  "project_version": "v0.1.1",
  "scope": "file:src/pipeline.ts, file:src/cli.ts",
  "date": "2026-06-03",
  "files_analyzed": 2,
  "total_lines": 291,

  "detailed_analysis": "No function in these two files lies about what it does in the P0 honesty sense — names match bodies, there is no hidden mutation behind a query verb, no hardcoded secret, no injection sink, no swallowed-then-claimed-success path. `decideOverwrite` is pure, `shouldConvert` honestly does I/O and prompting, and the one `catch {}` in `cli.ts:106` legitimately maps an unparseable realpath to `false`. So the report does NOT lead with a lie. It leads with the real defect: a HALF-FINISHED / DRY validation split. The three usage-validation rules (empty entries, --output XOR --output-dir, --output with multiple targets) are implemented TWICE — once in `cli.ts` (lines 58-66) and once in `pipeline.ts` (lines 96-123) — and the two copies have already DRIFTED. The messages differ ('--output can only be used with one conversion entry.' at cli.ts:65 vs '--output can only be used when exactly one Markdown file is produced.' at pipeline.ts:122) and, worse, the CONDITIONS differ: cli.ts gates on `positionals.length > 1` (entry count, pre-resolution) while pipeline.ts gates on `sources.length > 1` (resolved file count, post-directory-expansion). These are not the same check. A single directory entry that expands to 5 Markdown files passes the CLI guard (`positionals.length === 1`) and is then rejected by the pipeline guard with a *different* message and a *different* exit code path. This is the canonical DRY failure mode: one rule, two homes, observable divergence, and every future edit to the validation policy must touch both or rot further. It violates AGENTS.md §3 (DRY/SRP) and §4 (one concept, one representation) head-on. Second tier: `runConversionPipeline` (pipeline.ts:84-173, 90 lines) is a God Function that owns six concerns — default resolution, two usage-validation rules, entry-source resolution + error capture, output-path computation, the convert loop with overwrite/mkdir/convert/error-wrap, and summary aggregation + exit-code derivation. It is 2.25x the AGENTS.md §3 40-line ceiling and mixes validation (a fail-fast boundary concern) with execution and presentation (SoC). Third tier: `writeLine` is copy-pasted byte-identically in both files (pipeline.ts:49-51, cli.ts:29-31) and again in overwrite.ts's neighbours — a trivial-but-real DRY clone. The remainder are P2/P3 hygiene items: a primitive `string[] entries` clump threaded through a 10-field options bag, and the `?? false` belt-and-suspenders on `force-overwrite` (cli.ts:48 sets default:false, then cli.ts:72 re-defaults, then pipeline.ts:92 re-defaults a third time — three defaults for one boolean). Security posture below.",

  "security_posture": "Threat model: user-controlled CLI argv → filesystem reads (entry resolution) and writes (mkdirSync + PDF output) under user-chosen paths → no network egress in these two files (the WebDriver/browser network surface lives in other modules out of scope). Boundaries: argv is parsed by Node's stdlib `parseArgs` (cli.ts:42), which validates flag shapes; positionals flow unvalidated into `resolveEntrySources` and into path computation. Output paths derive from source paths via `paths.ts` helpers (not reviewed here) and reach `mkdirSync(dirname(...), {recursive:true})` (pipeline.ts:149) and the converter. There is NO path-traversal guard in these two files — but the tool's contract is 'convert the files the invoking user names', so writing under a user-supplied `--output-dir` is the intended behavior, not a privilege boundary being crossed (the attacker and the victim are the same shell user). No injection sink (no shell, no SQL, no eval). No hardcoded secret. No untrusted deserialization. The one `catch {}` (cli.ts:106) is scoped to a realpath comparison and returns a safe default. Net: no exploitable boundary within scope; security axis is clean.",

  "dependency_graph_summary": {
    "total_modules": 2,
    "cyclic_dependencies": [],
    "highest_fan_in": {"module": "pipeline.ts", "imported_by": 1, "note": "cli.ts imports runConversionPipeline + types from pipeline.ts"},
    "highest_fan_out": {"module": "pipeline.ts", "imports": 6, "note": "converter, errors, paths, overwrite, node:fs, node:path"}
  },

  "per_file_scores": [
    {
      "file": "src/pipeline.ts",
      "lines": 173,
      "function_count": 5,
      "class_count": 0,
      "correctness": 0.75,
      "structure": 0.5,
      "security": 1.0,
      "maintainability": 0.5,
      "code_score": 0.5,
      "weakest_axis": "structure",
      "finding_count": 5
    },
    {
      "file": "src/cli.ts",
      "lines": 118,
      "function_count": 3,
      "class_count": 0,
      "correctness": 0.75,
      "structure": 0.75,
      "security": 1.0,
      "maintainability": 0.5,
      "code_score": 0.5,
      "weakest_axis": "maintainability",
      "finding_count": 4
    }
  ],

  "findings": [
    {
      "id": "0001_DRY_P1",
      "priority": "P1",
      "anti_pattern_class": "DRY",
      "file": "src/pipeline.ts",
      "line": 121,
      "function_or_class": "runConversionPipeline / main",
      "severity": "MAJOR",
      "security_concern": null,
      "metrics": {"duplicate_locations": 2, "drifted": true, "rules_duplicated": 3},
      "evidence": "cli.ts:58-66:\n  if (parsed.positionals.length === 0) {\n    throw new UsageError('At least one Markdown file or directory is required.');\n  }\n  if (parsed.values.output !== undefined && parsed.values['output-dir'] !== undefined) {\n    throw new UsageError('--output and --output-dir are mutually exclusive.');\n  }\n  if (parsed.values.output !== undefined && parsed.positionals.length > 1) {\n    throw new UsageError('--output can only be used with one conversion entry.');\n  }\n\npipeline.ts:96-123:\n  if (options.entries.length === 0) {\n    throw new UsageError('At least one Markdown file or directory is required.');\n  }\n  if (options.outputPath !== undefined && options.outputDir !== undefined) {\n    throw new UsageError('--output and --output-dir are mutually exclusive.');\n  }\n  ...\n  if (options.outputPath !== undefined && sources.length > 1) {\n    throw new UsageError('--output can only be used when exactly one Markdown file is produced.');\n  }",
      "evidence_lines": "cli.ts:58-66 ; pipeline.ts:96-123",
      "problem": "The same three usage-validation rules live in BOTH files and have already drifted. (1) The empty-entries and mutual-exclusion messages are byte-duplicated — change one and the other silently diverges. (2) The --output-cardinality rule has drifted in BOTH message AND semantics: cli.ts gates on `positionals.length > 1` (raw entry count), pipeline.ts gates on `sources.length > 1` (resolved file count after directory expansion). They are NOT the same predicate. A single directory entry expanding to multiple .md files passes the CLI guard and is rejected only by the pipeline guard, with a different message. One validation policy must have one home (AGENTS.md §3 DRY, §4 one-concept-one-representation). This is the worst defect in scope.",
      "affected_axis": "maintainability"
    },
    {
      "id": "0002_POLA_P1",
      "priority": "P1",
      "anti_pattern_class": "POLA",
      "file": "src/cli.ts",
      "line": 64,
      "function_or_class": "main / runConversionPipeline",
      "severity": "MAJOR",
      "security_concern": null,
      "metrics": {"divergent_predicates": 2, "divergent_exit_codes": true},
      "evidence": "cli.ts:64-66 (entry-count guard, throws UsageError -> exit 2):\n  if (parsed.values.output !== undefined && parsed.positionals.length > 1) {\n    throw new UsageError('--output can only be used with one conversion entry.');\n  }\npipeline.ts:121-123 (resolved-file-count guard, throws UsageError -> exit 2 via cli catch, but runs AFTER directory expansion + after possible mkdir at 125):\n  if (options.outputPath !== undefined && sources.length > 1) {\n    throw new UsageError('--output can only be used when exactly one Markdown file is produced.');\n  }",
      "evidence_lines": "cli.ts:64-66 ; pipeline.ts:121-125",
      "problem": "A reasonable caller reading cli.ts concludes '--output works as long as I pass one ENTRY'. But pipeline.ts re-checks against the count of RESOLVED files: `md2pdf -o out.pdf ./docs/` (one entry, a directory containing 3 .md files) passes the CLI guard and is then rejected by the pipeline with a message that talks about a different unit ('Markdown file is produced'). The two guards answer the same question with two different definitions and two different error strings — astonishing for both the user and the next maintainer. Note also pipeline.ts:125 `mkdirSync(options.outputDir,...)` would not fire here (output, not output-dir), but the ordering means the pipeline guard runs only after the full entry-resolution loop has executed and printed per-entry errors to stderr.",
      "affected_axis": "correctness"
    },
    {
      "id": "0003_LONG_FUNCTION_P2",
      "priority": "P2",
      "anti_pattern_class": "LONG_FUNCTION",
      "file": "src/pipeline.ts",
      "line": 84,
      "function_or_class": "runConversionPipeline",
      "severity": "MAJOR",
      "security_concern": null,
      "metrics": {"lines": 90, "limit": 40, "cyclomatic_complexity": 12, "responsibility_clusters": 6},
      "evidence": "export async function runConversionPipeline(\n  options: PipelineOptions,\n): Promise<PipelineResult> {\n  // lines 84-173: defaults (87-94), validation (96-101 & 121-123),\n  // entry resolution + error capture loop (103-119), output-path mapping (127-133),\n  // convert loop w/ overwrite+mkdir+convert+error-wrap (135-159),\n  // summary aggregation + exit-code (161-172)\n}",
      "evidence_lines": "84-173",
      "problem": "90 lines, 2.25x the AGENTS.md §3 ceiling of 40. Estimated cyclomatic complexity ~12 (>10 threshold) from the two try/catch blocks, the resolution loop, the convert loop, the nested overwrite branch, and the ?? default chains. Six distinct responsibilities the reader must hold simultaneously. This is the most defect-prone shape per Zhang (2023). It cannot be unit-tested in pieces because every concern is inlined.",
      "affected_axis": "structure"
    },
    {
      "id": "0004_SRP_P1",
      "priority": "P1",
      "anti_pattern_class": "SRP",
      "file": "src/pipeline.ts",
      "line": 84,
      "function_or_class": "runConversionPipeline",
      "severity": "MAJOR",
      "security_concern": null,
      "metrics": {"reasons_to_change": 6},
      "evidence": "Same body as 0003. Mixes a fail-fast VALIDATION boundary (96-123), entry RESOLUTION I/O (103-119), output-path COMPUTATION (127-133), conversion EXECUTION (135-159), and result PRESENTATION (164 writeLine summary + 171 exit-code).",
      "evidence_lines": "84-173",
      "problem": "More than one reason to change: a change to the usage-validation policy, a change to how directories expand, a change to default output naming, a change to the overwrite/convert sequence, or a change to summary formatting all force edits to this one function. AGENTS.md §3: 'Each module and function does exactly one thing.' Validation in particular is a boundary concern (§8 fail-fast) and should not be interleaved with execution and the human-readable summary (SoC). Co-occurs with 0003 (size) but is filed separately as the responsibility-boundary framing.",
      "affected_axis": "structure"
    },
    {
      "id": "0005_DRY_P3",
      "priority": "P3",
      "anti_pattern_class": "DRY",
      "file": "src/pipeline.ts",
      "line": 49,
      "function_or_class": "writeLine",
      "severity": "INFO",
      "security_concern": null,
      "metrics": {"duplicate_locations": 2, "drifted": false},
      "evidence": "pipeline.ts:49-51:\n  function writeLine(stream: Writable, message: string): void {\n    stream.write(`${message}\\n`);\n  }\ncli.ts:29-31:\n  function writeLine(stream: Writable, message: string): void {\n    stream.write(`${message}\\n`);\n  }",
      "evidence_lines": "pipeline.ts:49-51 ; cli.ts:29-31",
      "problem": "`writeLine` is copy-pasted byte-identically across both files. Still byte-identical today (so demoted to P3), but it is a one-line shared utility with no home; the structural seed of drift is planted. Belongs in a single small io/stream helper.",
      "affected_axis": "maintainability"
    },
    {
      "id": "0006_YAGNI_P3",
      "priority": "P3",
      "anti_pattern_class": "YAGNI",
      "file": "src/cli.ts",
      "line": 48,
      "function_or_class": "main / runConversionPipeline",
      "severity": "INFO",
      "security_concern": null,
      "metrics": {"redundant_defaults_for_one_value": 3},
      "evidence": "cli.ts:48:  'force-overwrite': { type: 'boolean', short: 'f', default: false },\ncli.ts:72:  forceOverwrite: parsed.values['force-overwrite'] ?? false,\npipeline.ts:92:  const forceOverwrite = options.forceOverwrite ?? false;",
      "evidence_lines": "cli.ts:48 ; cli.ts:72 ; pipeline.ts:92",
      "problem": "One boolean defaulted three times. parseArgs already guarantees `force-overwrite` is `false` when absent (default:false at line 48), so the `?? false` at cli.ts:72 is dead defensiveness. The pipeline.ts:92 default is legitimate (pipeline is independently callable), but the cli-side double-default is belt-and-suspenders that obscures which layer owns the default. POLA/KISS: a value should have one authoritative default.",
      "affected_axis": "maintainability"
    },
    {
      "id": "0007_PRIMITIVE_OBSESSION_P2",
      "priority": "P2",
      "anti_pattern_class": "PRIMITIVE_OBSESSION",
      "file": "src/pipeline.ts",
      "line": 36,
      "function_or_class": "PipelineOptions",
      "severity": "WARNING",
      "security_concern": null,
      "metrics": {"options_fields": 12, "implicit_invariants": 2},
      "evidence": "export interface PipelineOptions {\n  entries: string[];\n  outputPath?: string;\n  outputDir?: string;\n  forceOverwrite?: boolean;\n  interactive?: boolean;\n  stdin?: Readable;\n  stdout?: Writable;\n  stderr?: Writable;\n  converter?: ConvertFn;\n  convertOptions?: ConvertOptions;\n}",
      "evidence_lines": "36-47",
      "problem": "A 10-field options bag where `outputPath` and `outputDir` carry an implicit mutual-exclusion invariant (enforced only at runtime, twice — see 0001) and `entries: string[]` is a raw primitive carrying an implicit 'non-empty' invariant. The type system permits illegal states (both outputPath and outputDir set; empty entries) that are then rejected by hand-written guards. A discriminated union for the output target (`{kind:'single',path} | {kind:'dir',dir} | {kind:'default'}`) would make the mutual-exclusion rule unrepresentable rather than re-validated in two places. Drives the duplication in 0001.",
      "affected_axis": "maintainability"
    },
    {
      "id": "0008_TOO_MANY_PARAMS_P3",
      "priority": "P3",
      "anti_pattern_class": "DATA_CLUMPS",
      "file": "src/pipeline.ts",
      "line": 58,
      "function_or_class": "shouldConvert",
      "severity": "INFO",
      "security_concern": null,
      "metrics": {"clumped_fields": 5},
      "evidence": "async function shouldConvert(\n  item: ConversionWorkItem,\n  options: Required<Pick<PipelineOptions, 'forceOverwrite' | 'interactive' | 'stdin' | 'stdout' | 'stderr'>>,\n): Promise<boolean>\n\n// call site pipeline.ts:137-143 re-assembles the same 5 fields:\n  const canWrite = await shouldConvert(item, {\n    forceOverwrite, interactive, stdin, stdout, stderr,\n  });",
      "evidence_lines": "58-61 ; 137-143",
      "problem": "The {forceOverwrite, interactive, stdin, stdout, stderr} quintet is a data clump: destructured from options at lines 87-93, re-bundled into an object literal at 137-143, then re-typed via Required<Pick<...>> at 60. The same five fields travel together through three hops. Minor (the Pick keeps it honest), filed INFO, but it signals the options bag wants to be a small context object passed once.",
      "affected_axis": "maintainability"
    },
    {
      "id": "0009_COMPLEX_CONDITIONAL_P2",
      "priority": "P2",
      "anti_pattern_class": "COMPLEX_CONDITIONAL",
      "file": "src/cli.ts",
      "line": 84,
      "function_or_class": "main",
      "severity": "WARNING",
      "security_concern": null,
      "metrics": {"boolean_operators": 3, "magic_string": "ERR_PARSE_ARGS"},
      "evidence": "if (\n  err instanceof Error\n  && 'code' in err\n  && typeof err.code === 'string'\n  && err.code.startsWith('ERR_PARSE_ARGS')\n) {",
      "evidence_lines": "84-92",
      "problem": "A four-clause type-narrowing conditional ending in the bare magic string 'ERR_PARSE_ARGS' (AGENTS.md §9 no-hardcoding: this protocol code should be a named constant with intent). The whole block exists to map a stdlib parse error to exit code 2; combined with the UsageError branch above it (80-83) and the two generic-Error branches below (93-98), the catch is a 4-way error-classification ladder reaching toward nesting/branch limits. Borderline; filed WARNING for the magic string + clause count.",
      "affected_axis": "maintainability"
    }
  ],

  "findings_sort_order": "By priority (P0 first; none here), then severity (MAJOR > WARNING > INFO), then file path. 0001-0002 are the drifted-validation pair (highest blast radius), 0003-0004 the God-function pair, then P3/P2 hygiene.",

  "aggregate_scores": {
    "correctness": 0.75,
    "structure": 0.5,
    "security": 1.0,
    "maintainability": 0.5,
    "code_score": 0.5,
    "weakest_axis": "structure"
  },

  "priority_summary": {
    "P0_honesty_and_catastrophic": {"total": 0, "comment": "No lying names, no hidden side effects, no hardcoded secret, no injection, no swallowed-then-claimed-success. The files are honest."},
    "P1_design_principles": {"major": 3, "total": 3, "comment": "DRY (drifted dual validation), POLA (divergent --output predicate/message/exit timing), SRP (God function). These are the real damage."},
    "P2_metrics_and_security": {"major": 1, "warning": 2, "total": 3, "comment": "LONG_FUNCTION (90 lines), PRIMITIVE_OBSESSION (illegal states representable), COMPLEX_CONDITIONAL (parse-error ladder + magic string). Security clean."},
    "P3_style_and_hygiene": {"info": 3, "total": 3, "comment": "Duplicated writeLine, triple-default boolean, shouldConvert data clump."}
  },

  "summary_table": {
    "DRY": {"major": 1, "info": 1, "total": 2},
    "POLA": {"major": 1, "total": 1},
    "SRP": {"major": 1, "total": 1},
    "LONG_FUNCTION": {"major": 1, "total": 1},
    "PRIMITIVE_OBSESSION": {"warning": 1, "total": 1},
    "COMPLEX_CONDITIONAL": {"warning": 1, "total": 1},
    "DATA_CLUMPS": {"info": 1, "total": 1},
    "YAGNI": {"info": 1, "total": 1}
  },

  "verdict": "AUDIT_WEAK",
  "verdict_summary": "Honest, secure, and correct on the happy path — but the same usage-validation policy lives in two files (cli.ts + pipeline.ts) and has already drifted in both wording and predicate (entry-count vs resolved-file-count), and runConversionPipeline is a 90-line six-responsibility God function. Three P1-MAJOR design breaches → AUDIT_WEAK."
}
```

## Severity mapping (CRITICAL/MAJOR → high, WARNING → medium, INFO → low)

- critical: 0
- high (MAJOR): 4  — 0001 DRY, 0002 POLA, 0003 LONG_FUNCTION, 0004 SRP
- medium (WARNING): 2 — 0007 PRIMITIVE_OBSESSION, 0009 COMPLEX_CONDITIONAL
- low (INFO): 3 — 0005 DRY clone, 0006 YAGNI, 0008 DATA_CLUMPS
- total: 9
