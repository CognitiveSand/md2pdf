# Requirements-Quality Audit — `docs/user_stories.md`

**Audit type:** Read-only forensic quality audit against INCOSE requirement-quality attributes and engineering principles (POLA, DRY, KISS, YAGNI, SRP, SoC).
**Document audited:** `/home/me/github/md2pdf/docs/user_stories.md` (402 lines).
**Cross-referenced (read-only, for grounding only):** `/home/me/github/md2pdf/docs/project_requirements.md`.
**Date:** 2026-06-03.

---

## Executive Summary

The story set is, on the whole, of **good** quality: it uses a consistent Given/When/Then structure, every story carries a Story + Rationale, every acceptance criterion (AC) carries a `@req` tag, and a traceability table closes the loop. Sampled `@req` tags resolve to real requirements in `project_requirements.md` (FR-01…FR-24, NFR-01…NFR-04, CON-03, OOS-02), so traceability is materially sound.

The defects are concentrated in a few recurring patterns: a handful of **unverifiable / subjective** Then-clauses ("renders correctly", "Python syntax highlighting", "the described diagram"), one **conflict between the document's own stated scope rule and its content** (the "observable behaviour only / mechanisms belong in the architecture document" promise vs. concrete mechanism leakage — Node.js, stdout/stderr, exit codes), several **non-atomic ACs** (two distinct assertions fused with And into one scenario), and **split/duplicated `@req` coverage** (FR-04 and FR-13 each asserted by multiple scenarios without a single authoritative home).

**Findings by severity**

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 3 |
| Medium | 6 |
| Low | 7 |
| **Total** | **16** |

**Overall quality assessment:** Good.

**Top 3 systemic issues**
1. **Subjective / unfalsifiable Then-clauses** (verifiability). "render correctly", "renders correctly", "with Python syntax highlighting", "renders the described diagram" cannot be turned into a deterministic pass/fail check as written. (H-1, H-2, M-1.)
2. **Stated-scope vs. content conflict** (consistency / SoC). The preamble promises "Stories describe observable behaviour only; mechanisms … belong in the architecture document," yet stories pin Node.js 20+, exit codes, stdout/stderr, and CLI flag spellings. Either the rule or the content is wrong; right now they contradict. (H-3, plus M-2.)
3. **Split / duplicated requirement coverage without a single home** (DRY / traceability). FR-04 is asserted by three scenarios across US-01 and US-02; FR-13 by two near-identical scenarios in US-05. The traceability table also disagrees with the body in one place. (M-3, M-4, L-1.)

---

## Detailed Findings

### HIGH

---

#### H-1 [HIGH] [INCOSE-QUALITY: Verifiable / Unambiguous] — "renders correctly" is unfalsifiable

**Requirement ID:** US-02 (Story statement) and supporting AC.
**Violated principle(s):** INCOSE-Verifiable, INCOSE-Unambiguous.
**Location:** lines 65–66 (story), reinforced by Scenario at lines 77–80.
**Current text:**
> "I want tables, code blocks, images, and footnotes to render **correctly**, so that the PDF I send needs no manual fix-ups." (lines 65–66)

**Issue:** "Correctly" defines no observable, checkable outcome. A test cannot decide pass/fail against "correctly." The supporting scenario (lines 77–80) is better — "renders the table, the task-list checkboxes, and the footnote" — but the story headline sets an unverifiable bar and the phrase "needs no manual fix-ups" is equally subjective (whose standard of "needs"?).

**Impact:** Reviewers and implementers will disagree on when US-02 is "done." Acceptance becomes a matter of opinion, defeating the purpose of an AC.

**Evidence:** lines 65–66.

---

#### H-2 [HIGH] [INCOSE-QUALITY: Verifiable] — "Python syntax highlighting" and "monospace font" are not deterministically checkable as phrased

**Requirement ID:** US-02, Scenario "Fenced code is highlighted by language" (`@req FR-05`).
**Violated principle(s):** INCOSE-Verifiable, INCOSE-Unambiguous.
**Location:** lines 83–86.
**Current text:**
> "Then the output PDF renders that code block in a monospace font with **Python syntax highlighting**" (line 86)

**Issue:** "Python syntax highlighting" has no objective acceptance threshold in the story. What must be true for the check to pass — that at least one token is coloured? that keywords specifically are coloured? that the colour scheme matches a named theme? The underlying requirement FR-05 (`project_requirements.md` line 74) is itself only "render that block with syntax highlighting for the declared language," so the story inherits the vagueness rather than resolving it. Likewise "monospace font" is observable in principle but the AC gives no way to assert it from a PDF (font-family inspection vs. visual).

**Impact:** "Highlighting present/absent" is the only thing this can verify in practice, yet the wording implies a stronger, language-correct guarantee. Tests will under-verify or be flaky against a subjective target.

**Evidence:** line 86; cf. `project_requirements.md` line 74.

---

#### H-3 [HIGH] [INCOSE-SET: Consistent / PRINCIPLE: SoC] — Document's own scope rule contradicts its content (mechanism leakage)

**Requirement ID:** Set-level; preamble vs. multiple stories.
**Violated principle(s):** INCOSE-Consistent (set), SoC, POLA.
**Location:** preamble lines 5–7 vs. lines 57–58, 180, 230, 271–280, 304, 342.
**Current text (the rule):**
> "Stories describe observable behaviour only; mechanisms (libraries, modules, rendering engine) belong in the architecture document." (lines 5–7)

**Current text (the violations):**
> "verified on Linux, macOS, and Windows under **Node.js 20+**." (line 58)
> "reports … on **standard output**." (line 180); "reported on **standard error**." (line 230)
> "terminates with a **non-zero exit status**" / "**zero exit status**" (lines 274, 280)
> "a host with **Node.js 20 or later**" (line 304)
> "on **standard output**." (line 342)

**Issue:** The preamble asserts mechanism-free, observable-behaviour-only stories, then the body repeatedly pins runtime (Node.js 20+), stream identity (stdout/stderr), exit-status numerics, and elsewhere exact CLI flag spellings (`--force-overwrite`, `--output-dir`, line 136, 214). These are defensible as observable contract for a CLI tool — but then the stated rule is false. The document contradicts its own governing constraint. Pick one: either these are legitimately part of the observable CLI contract (and the rule should not claim "mechanisms only in architecture"), or they are mechanism and should move out. As written, the set is internally inconsistent.

**Impact:** A reader cannot trust the preamble as a filter for what belongs in a story; future stories will be reviewed against a rule the existing stories break, producing inconsistent enforcement.

**Evidence:** lines 5–7 vs. 58, 180, 230, 274, 280, 304, 342.

---

### MEDIUM

---

#### M-1 [MEDIUM] [INCOSE-QUALITY: Verifiable] — "renders the described diagram as an image" is subjective

**Requirement ID:** US-02, Scenario "A Mermaid diagram renders as an image" (`@req FR-24`).
**Violated principle(s):** INCOSE-Verifiable, INCOSE-Unambiguous.
**Location:** lines 102–105.
**Current text:**
> "Then the output PDF renders **the described diagram** as an image rather than as raw code text" (line 105)

**Issue:** Two assertions are bundled and one is subjective. "Rendered as an image rather than raw code text" is checkable (image object present, source text absent). "The **described** diagram" — i.e. that the image is a faithful rendering of the Mermaid source — is not objectively verifiable from a story-level AC without a reference image or structural oracle. As phrased, the criterion implies semantic fidelity it cannot test.

**Impact:** Either the test silently weakens to "an image exists," diverging from the written AC, or it attempts fidelity checking with no defined oracle and becomes flaky.

**Evidence:** line 105.

---

#### M-2 [MEDIUM] [INCOSE-QUALITY: Unambiguous] — "render correctly" in the supported-dialect framing relies on an undefined "supported Markdown dialect"

**Requirement ID:** US-02, Rule line 74; US-01 Scenario line 37–40.
**Violated principle(s):** INCOSE-Unambiguous, INCOSE-Complete.
**Location:** lines 74, 37–40.
**Current text:**
> "Rule: The **supported Markdown dialect** renders in the output PDF" (line 74)

**Issue:** "Supported Markdown dialect" is a load-bearing term with no enumeration anywhere in this document. US-01 line 38 lists "headings, paragraphs, and nested lists"; US-02 adds tables, task lists, footnotes, fenced code, images, Mermaid. But the boundary (what is *not* in the dialect) is undefined here, so "the supported dialect renders" cannot be completely verified — you cannot test coverage of a set you have not enumerated. The phrase is a forward reference to FR-04 without the dialect actually being defined in either the story or (per the rows sampled) the requirement line FR-04 (line 73), which also just says "the supported Markdown dialect."

**Impact:** Completeness of dialect coverage is unverifiable; gaps (e.g., block quotes, horizontal rules, autolinks) are neither in nor out of scope by any written statement.

**Evidence:** lines 73–74; `project_requirements.md` line 73.

---

#### M-3 [MEDIUM] [PRINCIPLE: DRY / TRACEABILITY] — FR-04 coverage is split across three scenarios with no single authoritative home

**Requirement ID:** FR-04, asserted by US-01 (line 36) and US-02 (line 76).
**Violated principle(s):** DRY, INCOSE-Organized (set), traceability clarity.
**Location:** line 36 (`@req FR-04`, headings/paragraphs/lists), line 76 (`@req FR-04`, tables/task lists/footnotes), and the story-level prose at line 40.
**Current text:**
> US-01: "@req FR-04 — Prose, headings, and lists render" (lines 36–40)
> US-02: "@req FR-04 — Tables, task lists, and footnotes render" (lines 76–80)

**Issue:** A single requirement (FR-04 "render the supported Markdown dialect") is verified by partial scenarios in two different stories. Nothing is wrong with covering a broad requirement from several angles, but there is no statement anywhere that the *union* of these scenarios constitutes FR-04's verification, and no single owner. This is the user-story analogue of a DRY violation: the same requirement's acceptance is restated in two places, and a future edit to one (e.g., dropping footnotes from US-02) silently changes FR-04's effective definition without any cross-reference flagging it.

**Impact:** Risk of drift: FR-04's real acceptance bar is the implicit sum of scattered scenarios. Coverage gaps (block quotes, links) hide between the two stories.

**Evidence:** lines 36, 76; traceability table rows for US-01 (line 387) and US-02 (line 388) both list FR-04.

---

#### M-4 [MEDIUM] [PRINCIPLE: DRY / KISS] — FR-13 asserted by two near-duplicate scenarios

**Requirement ID:** US-05, `@req FR-13` appears twice (lines 211, 217).
**Violated principle(s):** DRY, KISS.
**Location:** lines 211–215 and 217–222.
**Current text:**
> Scenario "Forced overwrite skips the prompt" (lines 212–215)
> Scenario "Forced overwrite is honored without a terminal" (lines 218–222)

**Issue:** Both scenarios assert the same Then ("notes.pdf is replaced with the newly converted output PDF") for the same `--force-overwrite` option; the only difference is the terminal-vs-no-terminal Given. The underlying FR-13 (`project_requirements.md` line 82) already states the behaviour holds "regardless of whether an interactive terminal session is active" — so the two scenarios are a Scenario-Outline that has been copy-pasted rather than parameterised. This is duplication of intent and the kind of copy-paste pattern that signals poor factoring.

**Impact:** Two maintenance points for one rule; a change to forced-overwrite behaviour must be edited in two places or they drift. Mild reader confusion about why FR-13 needs two scenarios.

**Evidence:** lines 211–222; `project_requirements.md` line 82.

---

#### M-5 [MEDIUM] [INCOSE-QUALITY: Singular] — Non-atomic AC: US-01 fuses two independent assertions

**Requirement ID:** US-01, Scenario "Convert a plain Markdown file" (`@req FR-01 @req FR-02 @req NFR-01`).
**Violated principle(s):** INCOSE-Singular, SRP.
**Location:** lines 30–34.
**Current text:**
> "Then a file "notes.pdf" is created in the same directory
> And the conversion completes without requiring any configuration file or setup step" (lines 33–34)

**Issue:** One scenario tags three requirements (FR-01 output creation, FR-02 default path, NFR-01 zero-config) and asserts two logically independent outcomes joined by And: (a) the PDF exists at the default path, and (b) no configuration/setup was required. These have different reasons to fail and different verification methods (file existence vs. environment/config inspection). When this scenario fails, you cannot tell from the scenario which requirement broke.

**Impact:** Failure diagnosis is ambiguous; partial regressions (zero-config broken but output fine, or vice-versa) collapse into one red test. Tagging three requirements on one fused scenario weakens per-requirement traceability.

**Evidence:** lines 29–34.

---

#### M-6 [MEDIUM] [INCOSE-QUALITY: Complete / Unambiguous] — US-09 "the LaTeX backend selected" never defines selection

**Requirement ID:** US-09, Scenario "Convert via the LaTeX backend" (`@req FR-22`).
**Violated principle(s):** INCOSE-Complete, INCOSE-Unambiguous.
**Location:** lines 368–373; note lines 376–379.
**Current text:**
> "When the user runs md2pdf with "paper.md" and **the LaTeX backend selected**" (line 372)

**Issue:** The scenario's When-step depends on an action — selecting the LaTeX backend — that is never given an observable form (no flag, no option name, no environment toggle). Every other story that introduces a CLI control names it concretely (`--output-dir`, line 136; `--force-overwrite`, line 214; `--help`, line 347). US-09 alone leaves the trigger abstract, and the Notes (lines 377–379) explicitly punt "backend selection mechanics" to the architecture document. The result is an AC whose precondition cannot be exercised as written. (This is Post-MVP, which lowers urgency but not the defect.)

**Impact:** The scenario is not executable; a tester cannot perform "the LaTeX backend selected" without inventing the interface, which then is unverifiable against the AC.

**Evidence:** lines 372, 377–379; contrast lines 136, 214, 347.

---

### LOW

---

#### L-1 [LOW] [TRACEABILITY] — Traceability table omits FR-10/FR-11 nuance and is built by hand (drift risk)

**Requirement ID:** Set-level traceability table.
**Violated principle(s):** INCOSE-Organized, traceability maintainability.
**Location:** lines 385–396; US-04 body lines 174–181.
**Current text:**
> "| US-04 | FR-08, FR-09, FR-10, FR-11 |" (line 390)

**Issue:** The table is consistent with US-04's tags here (FR-10 and FR-11 are tagged together at line 174). The defect is structural: the table is a hand-maintained restatement of the `@req` tags scattered in the body, with no generation or check tying them together. The body already disagrees with the table elsewhere implicitly (see L-2). A hand-kept matrix is a DRY duplication of the tag data and will drift.

**Impact:** Low now (matrix matches sampled tags), but it is an un-checked second source of truth that can silently fall out of sync.

**Evidence:** lines 385–396 vs. inline `@req` tags (e.g., lines 29, 36, 76, 101, 174).

---

#### L-2 [LOW] [TRACEABILITY] — Cross-cutting NFR-03 handled by prose note, not by an AC

**Requirement ID:** NFR-03 (portability), "verified within US-01."
**Violated principle(s):** INCOSE-Verifiable, INCOSE-Organized.
**Location:** lines 57–58 (note), line 396 (table).
**Current text:**
> "Portability (NFR-03) applies across every story: the conversion in this story is verified on Linux, macOS, and Windows under Node.js 20+." (lines 57–58)
> "| Cross-cutting | NFR-03 (portability) — verified within US-01 |" (line 396)

**Issue:** NFR-03 is the only requirement with no Given/When/Then scenario; it is asserted in a free-text Note. Unlike every other requirement, there is no `@req NFR-03` tag on any scenario, so the "every acceptance criterion traces to a requirement with a `@req` tag" promise (lines 4–5) does not run in the other direction (not every requirement has a tagged AC). Portability is thus verified only by prose intent.

**Impact:** NFR-03's acceptance lives outside the AC structure; CI/test mapping cannot pick it up from a `@req` tag.

**Evidence:** lines 4–5, 57–58, 396.

---

#### L-3 [LOW] [INCOSE-QUALITY: Singular] — US-02 Mermaid + heading-orphan scenarios mix concerns under one Rule

**Requirement ID:** US-02 Rule (line 74) spanning FR-04, FR-05, FR-06, FR-07, FR-24.
**Violated principle(s):** SoC, INCOSE-Organized.
**Location:** lines 74–106.
**Current text:** Rule "The supported Markdown dialect renders in the output PDF" (line 74) covers content rendering (FR-04/05/06/24) **and** page-layout integrity (FR-07, "No heading is orphaned at a page bottom," lines 96–99).

**Issue:** Heading/page-break integrity (FR-07) is a layout concern, not a "dialect renders" concern, yet it sits under the dialect Rule. The Rule's title does not describe FR-07's scenario, so the grouping conflates two concerns (content fidelity vs. pagination).

**Impact:** Minor mis-organisation; a reader scanning "dialect renders" would not expect pagination rules there.

**Evidence:** lines 74, 96–99.

---

#### L-4 [LOW] [INCOSE-QUALITY: Singular] — US-04 batch-continuation scenario fuses two assertions

**Requirement ID:** US-04, Scenario "One failing file does not abort the batch" (`@req FR-10 @req FR-11`).
**Violated principle(s):** INCOSE-Singular, SRP.
**Location:** lines 174–181.
**Current text:**
> "Then "good.pdf" is created
> And md2pdf reports one succeeded conversion and one failed conversion on standard output" (lines 179–180)

**Issue:** One scenario tags two requirements (FR-10 continuation, FR-11 outcome reporting) and asserts two independent outcomes via And. As with M-5, a failure does not isolate which requirement broke.

**Impact:** Reduced failure-diagnosis precision; acceptable given the scenario tells one coherent story, hence Low.

**Evidence:** lines 174–181.

---

#### L-5 [LOW] [INCOSE-QUALITY: Verifiable] — "No partial PDF is written" is a negative existence claim that is hard to bound

**Requirement ID:** US-06, Scenario "A source file cannot be rendered" (`@req FR-16`); also US-02 note interaction.
**Violated principle(s):** INCOSE-Verifiable.
**Location:** lines 264–268.
**Current text:**
> "Then md2pdf reports "broken.md" on standard error
> And no partial "broken.pdf" is written" (lines 267–268)

**Issue:** "No partial … is written" is verifiable as "the file `broken.pdf` does not exist after the run," which is fine — but the word "partial" implies an additional guarantee (nothing half-written even transiently). If interpreted literally (no transient partial file ever touched disk), it is hard to verify without instrumentation. The intended check (final absence) should be stated as such; "partial" adds an unverifiable nuance.

**Impact:** Minor wording ambiguity between "final absence" (testable) and "never transiently written" (not testable at story level).

**Evidence:** line 268.

---

#### L-6 [LOW] [INCOSE-QUALITY: Unambiguous / POLA] — "declines the overwrite prompt" assumes an interaction not fully specified

**Requirement ID:** US-05, Scenario "Prompt before overwriting in a terminal" (`@req FR-12`).
**Violated principle(s):** INCOSE-Complete, POLA.
**Location:** lines 205–209; example lines 235–238.
**Current text:**
> "When the user runs md2pdf with "notes.md" and **declines the overwrite prompt**" (line 208)

**Issue:** The scenario folds a multi-step interaction (run → prompt appears → user answers "no") into a single When. The prompt's default (the example shows `[y/N]`, line 236, implying default = No) is shown only in the Example, not asserted in any AC. The behaviour on empty input (just pressing Enter) — a common, POLA-relevant case — is unverified.

**Impact:** The default-answer behaviour, which is exactly the POLA safeguard this story exists for, is illustrated but not pinned by an AC.

**Evidence:** lines 208, 236.

---

#### L-7 [LOW] [INCOSE-QUALITY: Unambiguous] — US-07 "idempotent" / "left at the target version" leans on undefined version semantics

**Requirement ID:** US-07, Scenario "Re-running the installer is idempotent" (`@req FR-21`).
**Violated principle(s):** INCOSE-Unambiguous, INCOSE-Complete.
**Location:** lines 314–319.
**Current text:**
> "When the installation procedure is executed again **for the target version**
> Then md2pdf is left at **the target version**" (lines 317–318)

**Issue:** "Idempotent" (Rule title, line 299) and "left at the target version" are correct in spirit, but "the target version" is introduced without definition — is it the version the installer ships, a version argument, or "latest"? The scenario does not establish what selects the target, so "left at the target version" is verifiable only once that is pinned. The companion claim "the procedure terminates with a zero exit status" (line 319) is cleanly verifiable.

**Impact:** Minor; the version-selection precondition is implicit.

**Evidence:** lines 314–319.

---

## Recommendations Summary (identification only — no remediation performed)

**Quick wins (wording-level, low effort):**
- Replace subjective Then-clauses with observable checks or named oracles: "renders correctly" (H-1), "Python syntax highlighting" (H-2), "the described diagram" (M-1), "no partial" (L-5).
- Define "supported Markdown dialect" once and reference it (M-2).
- Name the LaTeX-backend selection trigger or mark the AC explicitly deferred-pending-interface (M-6).

**Structural (larger, touch the set):**
- Reconcile the preamble's "observable behaviour only / mechanisms in architecture" rule with the pervasive Node.js / stdout-stderr / exit-code / flag-spelling content (H-3) — decide whether these are CLI contract or mechanism, and make the rule match.
- Consolidate split/duplicate requirement coverage: FR-04 across US-01/US-02 (M-3), FR-13 duplicate scenarios in US-05 (M-4); give each requirement a single authoritative verification home or an explicit "union of scenarios" statement.
- Split fused ACs into singular scenarios where failure-isolation matters (M-5, L-4).
- Consider auto-deriving the traceability table from `@req` tags rather than hand-maintaining it (L-1), and give NFR-03 a tagged AC (L-2).

---

## Positive Observations (patterns worth preserving)

- **Consistent template.** Every story carries Story + Rationale + Gherkin AC, and most carry an Example — strong, uniform structure.
- **Tag-level traceability.** Every scenario carries an explicit `@req` tag, and sampled tags resolve to real requirements in `project_requirements.md` (FR-01…FR-24, NFR-01…NFR-04). The closing traceability table (lines 385–396) is consistent with the sampled inline tags.
- **Scope discipline on deferrals.** Out-of-scope and Post-MVP items are explicitly bounded and traced (US-04 non-recursive → OOS-02, lines 184–185; US-09 LaTeX → CON-03, lines 360–362), rather than left implicit.
- **Error-handling and exit-status stories (US-06)** are crisp and largely verifiable (lines 256–281); FR-17/FR-18 exit-status scenarios are exemplary singular ACs.
- **Rationale-driven POLA framing** in US-05 (lines 195–198) clearly ties the overwrite-guard behaviour to a least-surprise objective.

---

## Severity Tally (authoritative — matches index object)

| Severity | Count | Findings |
|---|---|---|
| Critical | 0 | — |
| High | 3 | H-1, H-2, H-3 |
| Medium | 6 | M-1, M-2, M-3, M-4, M-5, M-6 |
| Low | 7 | L-1, L-2, L-3, L-4, L-5, L-6, L-7 |
| **Total** | **16** | |
