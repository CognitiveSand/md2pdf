# Requirements Compliance Findings: pipeline.ts + cli.ts

**Audit Date:** 2026-06-03
**Files Audited:**
- `/home/me/github/md2pdf/src/pipeline.ts`
- `/home/me/github/md2pdf/src/cli.ts`

**Reference docs:** `docs/project_requirements.md`, `docs/architecture.md`
**Auditor:** Requirements Compliance Auditor Agent
**Scope:** READ-ONLY forensic audit. No remediation proposed; defects only, each grounded in file + line evidence.

---

## Executive Summary

`cli.ts` and `pipeline.ts` implement the command-line front end and batch orchestration assigned to them by `architecture.md` §5 (cli.ts → FR-13/17/18/NFR-04; pipeline.ts → FR-08/09/10/11). Core batch behaviour (continue-on-error, summary, exit status) is largely met. However the audit found one **high-severity** behavioural gap (FR-14 / FR-17 non-interactive skip is not surfaced as a failure and produces exit 0, contradicting the "prevents silent data loss in scripts" rationale and the fail-loud intent), one **high-severity** correctness/consistency defect (the `--output` guard is duplicated across both files with *different* predicates and *different* user-facing messages), plus several medium gaps around FR-16 path reporting, FR-11 stream destination edge cases, and missing requirement-ID traceability tags mandated by `project_requirements.md` §10.

- **Requirements assessed (relevant to these files):** 16
- **Fully met:** 7
- **Partially met:** 5
- **Unmet / contradicted:** 2
- **Untraceable from these files:** 2

---

## Requirement Coverage Matrix

| Req ID | Title | In-scope here | Status | Evidence |
|---|---|---|---|---|
| FR-02 | Default output path | Yes (pipeline) | Met | pipeline.ts:132 `defaultOutputPath(sourcePath)` |
| FR-03 | Explicit output path | Yes (cli+pipeline) | Met | cli.ts:69 / pipeline.ts:129 |
| FR-08 | Multiple-file batch | Yes (pipeline) | Met | pipeline.ts:104, 135 loops all entries/work items |
| FR-09 | Directory batch | Partial (pipeline) | Partial | pipeline.ts:106 delegates to `resolveEntrySources`; see I-06 |
| FR-10 | Batch continuation | Yes (pipeline) | Met | pipeline.ts:152-158 catch-and-continue |
| FR-11 | Batch outcome reporting | Yes (pipeline) | Partial | pipeline.ts:164 summary on stdout; see I-05 |
| FR-12 | Overwrite prompt | Yes (pipeline) | Met | pipeline.ts:74-81 |
| FR-13 | Forced overwrite | Yes (cli+pipeline) | Met | cli.ts:72 / pipeline.ts:92 |
| FR-14 | Non-interactive overwrite guard | Yes (pipeline) | Partial / contradicted | pipeline.ts:69-71, 145; see I-01 |
| FR-15 | Missing-input reporting | Yes (pipeline) | Met | pipeline.ts:107-118 |
| FR-16 | Render-failure reporting | Yes (pipeline) | Partial | pipeline.ts:152-158; see I-03 |
| FR-17 | Failure exit status | Yes (cli+pipeline) | Partial / contradicted | pipeline.ts:171; see I-01 |
| FR-18 | Success exit status | Yes (cli+pipeline) | Met | pipeline.ts:171 / cli.ts:78 |
| FR-23 | Output-dir option | Yes (cli+pipeline) | Met | cli.ts:71 / pipeline.ts:125,131 |
| NFR-04 | Self-describing usage | Yes (cli) | Met | cli.ts:13-20, 53-56 |
| §10 | Requirement-ID traceability tags | Both | Unmet | no `@req` references anywhere; see I-04 |
| NFR-02 / CON-02 | Local-only processing | No (converter/renderer) | Untraceable here | not implemented in these files |

---

## Detailed Findings

### I-01 (HIGH) — FR-14 / FR-17: non-interactive overwrite skip is silently non-fatal (exit 0)

**Requirements.**
- FR-14: "While no interactive terminal session is active, when the output PDF path already exists and the force-overwrite option is absent, md2pdf shall leave the existing file unchanged and report the skipped path on standard error." Rationale column: *"Fail-loud; prevents silent data loss in scripts."*
- FR-17: "When at least one conversion in an invocation fails, md2pdf shall terminate with a non-zero exit status."

**Evidence.** A non-interactive skip is recorded as status `skipped`, not `failed`:

```
69    if (decision === 'skip') {
70      writeLine(options.stderr, `Skipped existing output: ${item.outputPath}`);
71      return false;
```
```
144      if (!canWrite) {
145        outcomes.push({ ...item, status: 'skipped' });
146        continue;
```

The exit code counts only `failed`:

```
161    const succeeded = outcomes.filter(outcome => outcome.status === 'success').length;
162    const failed = outcomes.filter(outcome => outcome.status === 'failed').length;
...
171    exitCode: failed > 0 ? 1 : 0,
```

**Defect.** In a non-interactive script, a run whose only outcome is a refused overwrite produces exit code **0** while no PDF was (re)written. The intended output was *not* produced, yet the process reports success. This defeats FR-14's stated rationale ("prevents silent data loss in scripts") at the only place a script can observe it — the exit status — and is in tension with FR-17 (a conversion that did not complete is, for scripting purposes, not a success). `architecture.md` §8 lists exit `1` only for "at least one conversion failed" and never classifies a non-interactive skip, so the requirement intent is under-specified in the architecture too, but the code resolves the ambiguity in the silent-success direction, which is the opposite of the fail-loud requirement rationale. The skip *message* on stderr is present (satisfies the reporting half of FR-14), but the exit-status half is not surfaced.

**Severity:** High — observable silent-success in exactly the scripted scenario FR-14 exists to protect.

---

### I-02 (HIGH) — FR-03 / usage guard: `--output` validation duplicated with divergent predicate and message

**Requirement context.** FR-03 (explicit output path for a *single-file* conversion). The mutual-exclusion / single-target guards are usage errors per `architecture.md` §6, §8.

**Evidence — cli.ts guards on positional-entry count:**
```
64    if (parsed.values.output !== undefined && parsed.positionals.length > 1) {
65      throw new UsageError('--output can only be used with one conversion entry.');
66    }
```
**Evidence — pipeline.ts guards on expanded-source count:**
```
121    if (options.outputPath !== undefined && sources.length > 1) {
122      throw new UsageError('--output can only be used when exactly one Markdown file is produced.');
123    }
```

**Defect.** Two independent checks enforce overlapping but **non-equivalent** predicates:
- cli.ts rejects when there is more than one *entry* (`positionals.length > 1`).
- pipeline.ts rejects when there is more than one *resolved source file* (`sources.length > 1`).

These disagree for a single **directory** entry that expands to multiple `.md` files: it passes the cli.ts check (one positional) and is then rejected by pipeline.ts with a *different* message. The two user-facing strings differ ("with one conversion entry" vs "when exactly one Markdown file is produced"), so the message the user sees depends on which layer fires — a POLA violation. Note also `paths.ts:79` carries yet a third variant (`sources.length !== 1`) of the same rule, confirming the logic is triplicated and drifting. Duplicated validation with divergent semantics is a latent correctness defect: a future change to one site will not be reflected in the others.

**Severity:** High — divergent enforcement of the same requirement across layers; inconsistent error reporting for the directory-entry case.

---

### I-03 (MEDIUM) — FR-16: render-failure stderr report does not guarantee the offending *path*

**Requirement.** FR-16: "If a Markdown source file contains content md2pdf cannot render, then md2pdf shall report the **offending source file path** on standard error rather than write a partial output PDF."

**Evidence.**
```
152    } catch (err) {
153      const wrapped = err instanceof Md2PdfError || err instanceof Error
154        ? err
155        : new ConversionError(String(err), item.sourcePath);
156      outcomes.push({ ...item, status: 'failed', error: wrapped });
157      writeLine(stderr, errorMessage(wrapped));
158    }
```

**Defect.** Only `errorMessage(wrapped)` (the error's `.message`) is written to stderr. Whether that message contains the source path depends entirely on the thrown error:
- A `RenderError` does embed the path (`errors.ts:73` `Render failed for ${sourcePath}: ...`) — compliant.
- A **generic `Error`** (any `instanceof Error` that is not a `ConversionError`/`RenderError`, e.g. a `TypeError` from a dependency, or a bare `new Error('parse failed')`) is forwarded verbatim at line 153-154 with **no path appended**. `item.sourcePath` is in scope at line 157 but is not included in the stderr line.

So FR-16's "report the offending source file path" is met only for the project's own typed errors and is *not* guaranteed for arbitrary render failures. The "rather than write a partial output PDF" half is satisfied (the PDF write happens inside `converter(...)` at line 150 and the catch records `failed` without writing further), but the path-reporting guarantee is conditional, not structural.

**Severity:** Medium — partial coverage of a Must requirement; path omission occurs precisely for unexpected (un-typed) render failures.

---

### I-04 (MEDIUM) — §10 Traceability: no requirement-ID tags in source

**Requirement.** `project_requirements.md` §10: "Downward traceability to verification evidence is to be maintained by tagging each test with its requirement ID (for example `@req FR-08`) so the traceability matrix can be generated." `architecture.md` §5 explicitly maps cli.ts → FR-13/17/18/NFR-04 and pipeline.ts → FR-08/09/10/11.

**Evidence.** Neither file contains any `@req`, `FR-`, or other requirement-ID reference. cli.ts (1-118) and pipeline.ts (1-173) have no traceability comments at module, function, or inline level. The mapping exists only in `architecture.md`, external to the code.

**Defect.** The requirement scopes the tagging obligation to *tests*, so this is not strictly a violation of the source-file files themselves; however, the audited modules implement Must requirements (FR-13/17/18) with no in-code linkage, making the traceability matrix dependent solely on the architecture table. The audit records this as an advisory/traceability gap rather than a behavioural failure.

**Severity:** Medium — traceability obligation is on tests; source carries no requirement linkage, weakening downward traceability for the orchestration logic.

---

### I-05 (MEDIUM) — FR-11: summary always printed, including when there is nothing to report / only failures resolving

**Requirement.** FR-11: "When a batch invocation completes, md2pdf shall report the count of succeeded and failed conversions on standard output."

**Evidence.**
```
164    writeLine(stdout, `Summary: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped.`);
```

**Assessment.** The line reports succeeded and failed counts on stdout — the literal FR-11 obligation is met, and additionally reports `skipped` (not required, not forbidden). Two edge observations:
1. FR-11 is scoped to a "batch invocation" (glossary: "more than one conversion entry, or one directory entry"). This summary is printed unconditionally, including for a **single-file** invocation (one file entry). That is a superset of FR-11 and harmless, but note FR-01/FR-02 single-file flows now emit an extra stdout line not mandated by any requirement — a minor POLA consideration for scripts that parse stdout.
2. When every entry fails to resolve (FR-15 path), `succeeded=0, failed=N`; the summary still prints on stdout while errors went to stderr — consistent with FR-11.

**Severity:** Medium (lean low) — requirement met literally; unconditional summary on non-batch single-file runs is an unrequested behaviour worth flagging.

---

### I-06 (MEDIUM) — FR-09 / FR-15: a directory entry that resolves to zero Markdown files is silent

**Requirements.** FR-09 (convert each top-level Markdown source file in a directory). FR-15 (report unreadable/non-existent entries on stderr).

**Evidence.** `resolveEntrySources` (paths.ts:41-53) returns an **empty array** for a directory containing no `.md` files, and pipeline.ts spreads it with no diagnostic:
```
105      try {
106        sources.push(...resolveEntrySources(entry));
107      } catch (err) {
```
A directory entry with no Markdown files throws nothing, contributes zero sources, produces zero outcomes, and the run prints `Summary: 0 succeeded, 0 failed, 0 skipped.` (pipeline.ts:164) and exits `0` (line 171).

**Defect.** A user who points md2pdf at a directory expecting conversions gets a success exit and an all-zero summary with no indication that the directory yielded nothing. This is neither an FR-15 error (the entry existed and was readable) nor an FR-09 conversion, so it falls into an unhandled gap: a no-op invocation reported as success. Not a hard requirement violation, but a POLA/fail-loud weakness in the FR-09 path orchestrated here.

**Severity:** Medium — silent no-op success for an empty-directory batch.

---

### I-07 (LOW) — FR-12 / FR-14: `interactive` is computed in the pipeline, never wired from the CLI

**Requirement context.** FR-12 (interactive prompt) vs FR-14 (non-interactive guard) branch entirely on interactivity. `architecture.md` §7 defines interactive as "both stdin and stdout are TTYs."

**Evidence.** cli.ts never sets `interactive` on the runner call:
```
68    const result = await runner({
69      entries: parsed.positionals,
70      outputPath: parsed.values.output,
71      outputDir: parsed.values['output-dir'],
72      forceOverwrite: parsed.values['force-overwrite'] ?? false,
73      stdin: options.stdin,
74      stdout,
75      stderr,
76    });
```
pipeline.ts derives it from the *real* process streams:
```
90    const interactive = options.interactive
91      ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
```

**Defect.** The TTY decision reads `process.stdin`/`process.stdout` globals directly even though `options.stdout` (and potentially `options.stdin`) may have been injected by the caller (cli.ts passes a possibly-redirected `stdout`). The interactivity used for the FR-12/FR-14 branch can therefore disagree with the stream the prompt is actually written to: `confirmOverwrite` writes the prompt to `options.stdout` (pipeline.ts:75-77) while interactivity was decided from `process.stdout.isTTY`. In normal CLI use these coincide, but the coupling to process globals inside a function that otherwise accepts injected streams is a correctness/testability defect and a latent FR-12/FR-14 misclassification when streams are redirected.

**Severity:** Low — only manifests under stream injection/redirection; normal terminal use unaffected.

---

### I-08 (LOW) — FR-14 / FR-12: identical stderr message for two distinct skip causes

**Evidence.** Both the non-interactive guard (FR-14) and the declined-prompt branch (FR-12) emit the same string:
```
70      writeLine(options.stderr, `Skipped existing output: ${item.outputPath}`);
...
78    if (!confirmed) {
79      writeLine(options.stderr, `Skipped existing output: ${item.outputPath}`);
```

**Assessment.** FR-14 requires reporting the skipped path on stderr (met). FR-12 requires preserving the file when the caller declines (met) and does not forbid a stderr note. Using an identical message for "skipped because non-interactive" and "skipped because user said no" loses the distinction; not a requirement violation but a minor diagnostic-clarity weakness.

**Severity:** Low.

---

### I-09 (LOW) — NFR-04: `--help` omits the documented `MD2PDF_BROWSER` control

**Requirement.** NFR-04: "md2pdf shall display each supported option with a one-line description."

**Evidence.** HELP (cli.ts:13-20) lists `-o/--output`, `--output-dir`, `-f/--force-overwrite`, `-h/--help`. `architecture.md` §6 documents `MD2PDF_BROWSER` as a user-facing control ("may pin an explicit browser binary, overriding detection").

**Assessment.** NFR-04 is scoped to "each supported **option**"; an environment variable is arguably not a CLI option, so strict compliance holds. Flagged as advisory: a documented user-facing control is absent from self-describing usage. The four CLI options are each present with a one-line description, so NFR-04 itself is met.

**Severity:** Low.

---

## Coding / Convention Observations (non-requirement, contextual)

- **Exit-code typing is consistent** with `architecture.md` §8: pipeline returns `0 | 1` (pipeline.ts:27,171); cli returns `0 | 1 | 2` (cli.ts:36) with `2` reserved for `UsageError`/`ERR_PARSE_ARGS` (cli.ts:80-92). No defect.
- **Fail-loud at boundaries** is honoured for empty entries and mutually exclusive options (cli.ts:58-63, pipeline.ts:96-101), though duplicated across layers (see I-02).

---

## Untraceable From These Files

- **NFR-02 / CON-02 (local-only, no network):** enforced in `converter.ts` / `pdfRenderer.ts` / asset inlining (architecture §9), not in the audited files. Cannot be confirmed or refuted here.
- **FR-01, FR-04–FR-07, FR-24 (rendering fidelity, Mermaid, pagination):** delegated through `converter(...)` (pipeline.ts:150); not implemented in scope.

---

## Severity Summary

| Severity | Count | Findings |
|---|---|---|
| Critical | 0 | — |
| High | 2 | I-01, I-02 |
| Medium | 4 | I-03, I-04, I-05, I-06 |
| Low | 3 | I-07, I-08, I-09 |
| **Total** | **9** | |
