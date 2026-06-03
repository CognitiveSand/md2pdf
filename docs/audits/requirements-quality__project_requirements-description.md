# Requirements Quality Audit — `project_requirements.md` & `project_description.md`

**Audit type:** READ-ONLY forensic requirements-quality audit (INCOSE 14 characteristics + POLA/DRY/KISS/YAGNI/SRP/SoC).
**Documents audited:**
- `docs/project_requirements.md` (154 lines)
- `docs/project_description.md` (117 lines)

**Auditor stance:** No remediation. Findings only, each grounded in quoted text + line numbers.

---

## Executive Summary

The requirement set is, for an MVP-stage CLI tool, well above average. It uses
EARS patterns consistently, names a single active subject (`md2pdf`), carries a
verification method per row, supplies a binding glossary, and traces success
criteria to requirements. The authors clearly applied an INCOSE checklist
(§8). Most defects found are **MINOR**: residual ambiguity in a few terms,
DRY overlaps between constraints and NFRs, and one non-atomic requirement.

However, the document's own **self-assessment in §8 over-claims**: it asserts
C5 (singular), C11 (consistent), and C14 (validatable) hold without exception,
yet several requirements are non-atomic or contain an unverifiable verification
method, and at least one capability (LaTeX-backend selection mechanism) is
referenced but never defined. The self-certification is itself a quality risk
because it discourages reviewers from finding the gaps it papers over.

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| MAJOR (high) | 3 |
| MINOR (medium) | 7 |
| INFO (low) | 6 |
| **TOTAL** | **16** |

**Overall quality assessment: GOOD.**

### Top 3 systemic issues
1. **Verification method "Demonstration" is over-applied to requirements that
   demand inspection or test of rendered output quality** (FR-04, FR-06, FR-07
   family) — "Demonstration" cannot prove typographic/embedding correctness,
   undermining C7/C14 verifiability.
2. **DRY overlaps between Constraints and NFRs** — the no-network rule lives in
   both CON-02 and NFR-02; the no-LaTeX rule lives in both CON-03 and OOS-01;
   restated again in §8. One fact, multiple homes.
3. **Incomplete capability chains** — FR-22 depends on a backend-selection
   mechanism that no requirement defines; FR-13/FR-23/NFR-04 reference options
   (`--force-overwrite`, `--output-dir`, "the help option") with no requirement
   establishing the option syntax/grammar as a whole.

---

## Detailed Findings

### MAJOR (high)

---

#### [MAJOR] INCOSE-QUALITY (Verifiable): "Demonstration" cannot verify rendered-output-quality requirements

**Requirement ID:** FR-04, FR-06 (and the description criteria they trace to)
**Violated principle(s):** INCOSE C7 (Verifiable), INCOSE C14 (Validatable)
**Current text:**
- FR-04 (line 73): *"md2pdf shall render the supported Markdown dialect in the output PDF."* — Verification: **Demonstration**
- FR-06 (line 75): *"…md2pdf shall embed that image in the output PDF at the referencing location."* — Verification: **Demonstration**

**Issue:** "Demonstration" shows that the tool *runs and produces a PDF*, but
these requirements assert *correctness of rendered content* ("render the
supported dialect", "embed … at the referencing location"). Demonstrating a PDF
appears does not prove every dialect construct rendered, nor that the image
landed at the *referencing location*. The correct method is Inspection (visual)
or Test (pixel/PDF-structure assertion). FR-07 (heading orphan) is correctly
marked **Test** (line 76) — proving the inconsistency is internal, not a matter
of taste.

**Impact:** A passing "demonstration" can sign off a build whose tables or
footnotes silently fail to render, directly defeating success criterion #2
"share unedited" (`project_description.md` lines 100–101).

**Recommendation (identification only):** Re-examine the verification column for
every "render"/"embed"/"highlight" FR.

---

#### [MAJOR] INCOSE-QUALITY (Unambiguous/Verifiable): FR-04 outsources its entire scope to a glossary term that bundles a quality attribute

**Requirement ID:** FR-04
**Violated principle(s):** INCOSE C3 (Unambiguous), C4 (Complete), C5 (Singular)
**Current text:** FR-04 (line 73): *"md2pdf shall render the supported Markdown dialect in the output PDF."*
Glossary (line 23): *"**supported Markdown dialect** | CommonMark, plus these extensions: pipe tables, fenced code blocks **with syntax highlighting**, task-list checkboxes, and footnotes."*

**Issue:** "supported Markdown dialect" expands to a *list of distinct
capabilities* — CommonMark, tables, fenced code blocks, task lists, footnotes.
FR-04 therefore asserts five+ independent capabilities in one row, defeating C5
(Singular) by reference. Worse, the glossary embeds "**with syntax
highlighting**" inside the dialect definition, while FR-05 (line 74) *separately*
requires syntax highlighting. The same capability is thus mandated twice via two
different mechanisms, and at two different priorities — FR-04 is **Must**, FR-05
is **Should** — a latent **consistency conflict**: is highlighting Must (via
FR-04's definition) or Should (FR-05)?

**Impact:** Verification cannot determine the pass/fail boundary of FR-04, and
the priority of syntax highlighting is genuinely ambiguous. §8's C5/C11 claims
(lines 116, 128) are contradicted here.

**Evidence of conflict:** line 23 ("with syntax highlighting" inside dialect,
fed into FR-04 Must) vs line 74 (FR-05, syntax highlighting, Should).

---

#### [MAJOR] INCOSE-SET (Complete) / PRINCIPLE (YAGNI gap inverse): FR-22 references an undefined "backend selection" capability

**Requirement ID:** FR-22 (and FR-04 backend-neutrality)
**Violated principle(s):** INCOSE C4 (Complete), INCOSE C10 (set Complete), POLA
**Current text:** FR-22 (line 91): *"md2pdf shall produce the output PDF through a LaTeX rendering backend **when that backend is selected**."*

**Issue:** The clause "when that backend is selected" presupposes a
selection mechanism (a flag, config, or env var) that **no requirement
defines**. There is no FR establishing how a caller selects a rendering
backend, no option grammar, and no default-backend statement. The trigger
condition of FR-22 is therefore unsatisfiable from the requirement set alone —
the EARS precondition references a state the system has no defined way to enter.

**Impact:** FR-22 is unverifiable as written (you cannot construct the trigger).
Even as a Post-MVP/Could row it pollutes the set with a dangling dependency.
This also surfaces a missing MVP requirement: there is no FR defining the
**option/argument grammar** as a whole, yet FR-13, FR-23, NFR-04, and FR-12 all
reference specific options.

**Evidence:** line 91 ("when that backend is selected"); no corresponding
selection FR anywhere in §6.

---

### MINOR (medium)

---

#### [MINOR] PRINCIPLE (DRY) / INCOSE-SET (Non-redundant): No-network rule stated twice (CON-02 and NFR-02)

**Requirement ID:** CON-02, NFR-02
**Violated principle(s):** DRY, INCOSE C-non-redundant (set)
**Current text:**
- CON-02 (line 41): *"md2pdf shall perform every conversion using only local computation, with no transmission of Markdown source files or output PDFs to any external network service."*
- NFR-02 (line 109): *"md2pdf shall open no outbound network connection during conversion."*

**Issue:** Two requirements encode the same confidentiality fact ("no network
during conversion") with subtly different wording — "no transmission … to any
external network service" vs "open no outbound network connection". The
difference is not clearly intentional, so it reads as duplication, and the
subtle wording delta creates a *seam* (does an outbound connection that
transmits nothing violate CON-02? It violates NFR-02). One fact, two homes,
two slightly different tests.

**Impact:** Maintenance hazard (change one, forget the other) and a verifiable
ambiguity at the edge case (connection opened, no data sent).

**Evidence:** line 41 vs line 109; both re-traced in §8 C14 (line 134).

---

#### [MINOR] PRINCIPLE (DRY): No-LaTeX rule stated three times (CON-03, OOS-01, §8)

**Requirement ID:** CON-03, OOS-01, §8/§9
**Violated principle(s):** DRY
**Current text:**
- CON-03 (line 42): *"…without requiring a TeX or LaTeX distribution…"*
- OOS-01 (lines 58–59): *"Rendering via a TeX/LaTeX toolchain is deferred to Post-MVP; CON-03 governs the MVP."*
- §8 C11/C14 (lines 128–129, 134): restated again.

**Issue:** The same constraint appears as a constraint, an out-of-scope item,
and twice in the compliance checklist. OOS-01 is arguably necessary (it marks
the deferral), but CON-03 + OOS-01 + the C11/C14 restatements over-repeat one
decision.

**Impact:** Low correctness risk (the statements agree), but inflates the
document and multiplies edit sites.

---

#### [MINOR] INCOSE-QUALITY (Unambiguous): "report the count of succeeded and failed conversions" — format/placement underspecified, and overlaps a no-batch case

**Requirement ID:** FR-11
**Violated principle(s):** INCOSE C3 (Unambiguous), C4 (Complete)
**Current text:** FR-11 (line 80): *"When a batch invocation completes, md2pdf shall report the count of succeeded and failed conversions on standard output."*

**Issue:** Triggered only on "batch invocation" (defined line 28 as >1 entry or
a directory). A single-file invocation that fails therefore has **no** summary
requirement — the count reporting is silent for the most common case. Whether
that gap is intended is not stated. Verifiability is otherwise adequate (counts
on stdout), so this is a completeness/edge-case gap, not unverifiability.

**Impact:** Possible coverage gap for single-file outcome reporting; reviewer
cannot tell intent from text.

---

#### [MINOR] INCOSE-SET (Consistent): FR-08 vs FR-09 vs batch-invocation glossary — overlapping triggers

**Requirement ID:** FR-08, FR-09
**Violated principle(s):** INCOSE C11 (Consistent), POLA
**Current text:**
- Glossary "batch invocation" (line 28): *"…supplying more than one conversion entry, **or one directory entry**."*
- FR-08 (line 77): trigger *"invoked with more than one Markdown source file as conversion entries"*.
- FR-09 (line 78): trigger *"a conversion entry names a directory"*.

**Issue:** A single directory entry is, by glossary, a "batch invocation", but
FR-08's trigger is "more than one Markdown source file" — so a lone directory is
a batch but matches neither FR-08's count trigger. The interplay of FR-08/FR-09
with the glossary's two-pronged batch definition is consistent on careful
reading but invites misreading (POLA): the reader must reconcile "batch =
1 directory" against "FR-08 = >1 file". Edge case: a single directory entry
*containing one* `.md` file — is that a batch (so FR-10/FR-11 apply) or a
single conversion? Not resolved by the text.

**Impact:** Ambiguity over whether FR-10 (continuation) and FR-11 (reporting)
apply to a one-file directory.

---

#### [MINOR] INCOSE-QUALITY (Singular/SRP): FR-12 bundles two obligations (prompt AND preserve)

**Requirement ID:** FR-12
**Violated principle(s):** INCOSE C5 (Singular), SRP
**Current text:** FR-12 (line 81): *"…md2pdf shall prompt the caller to confirm overwriting **and shall preserve** the existing file if the caller does not confirm."*

**Issue:** Two verbs, two behaviours: (a) prompt, (b) preserve-on-decline. These
are separable capabilities with independent failure modes and independent tests.
The "and shall" construction is the canonical C5 (singular) smell that §8
line 116 claims was eliminated.

**Impact:** A single row's pass/fail conflates two behaviours; partial
compliance (prompts but doesn't preserve) has no clean verdict.

**Evidence:** line 81; contrast §8 C5 claim "Each row is a single capability"
(line 116).

---

#### [MINOR] INCOSE-QUALITY (Unambiguous): NFR-04 "the help option" is undefined

**Requirement ID:** NFR-04
**Violated principle(s):** INCOSE C3 (Unambiguous), C4 (Complete)
**Current text:** NFR-04 (line 111): *"When md2pdf is invoked with **the help option**, md2pdf shall display each supported option with a one-line description on standard output."*

**Issue:** "the help option" uses a definite article for a thing never defined
(no `--help`/`-h` glossary term or FR establishes it). Same gap class as the
missing option grammar noted under FR-22. Also: "each supported option" is
self-referential to a set of options the document never enumerates as a whole.

**Impact:** Verification cannot enumerate "each supported option" against a
defined master list; the help invocation token is unspecified.

---

#### [MINOR] INCOSE-QUALITY (Verifiable): NFR-05 verification "Test" against a 7-day-real-time quarantine is not testable as a unit/CI test

**Requirement ID:** NFR-05 (and eligible-artifact glossary line 33)
**Violated principle(s):** INCOSE C7 (Verifiable), C6 (Feasible to verify), KISS
**Current text:** NFR-05 (line 112): *"…md2pdf shall use the newest eligible artifact version available after a 7-day quarantine period, except where an approved quarantine waiver…; no other exception, override, bypass, emergency exemption, or force mode exists."* — Verification: **Test**
Glossary (line 33): *"…publication timestamp is at least 7 full days old at the time md2pdf selects…"*

**Issue:** The requirement mixes a *process/governance* obligation (use newest
eligible version, no exceptions) with a *temporal* predicate (≥7 days old). The
chosen method "Test" is questionable: "the newest eligible version available"
is time-dependent and external (registry state), so a deterministic test must
freeze inputs — making it an Inspection/Analysis of policy adherence rather than
a behavioural Test. The closing absolutist clause ("no other exception …
exists") is unverifiable by any finite test (you cannot test the *non-existence*
of an exception). This is a negative-universal, an INCOSE C7 anti-pattern.

**Impact:** Over-strong, partly untestable wording in a Must NFR; the
"no … exists" tail asserts something no test can demonstrate.

---

### INFO (low)

---

#### [INFO] INCOSE-QUALITY (Appropriate): "report … on standard output/standard error" couples requirements to an output channel

**Requirement ID:** FR-11, FR-14, FR-15, FR-16, NFR-04
**Violated principle(s):** INCOSE C13 (implementation-leakage / Appropriate), SoC
**Current text:** e.g. FR-14 (line 83) *"report the skipped path on **standard error**"*; FR-11 (line 80) *"on **standard output**"*.
**Issue:** Naming stdout/stderr is borderline solution-coupling for a *what*-level
document. It is defensible for a CLI (the channel *is* observable behaviour and
matters for scriptability), so this is INFO not a defect — flagged for awareness
that channel choice is being fixed at requirements level.
**Impact:** Minimal; noted for traceability.

---

#### [INFO] PRINCIPLE (DRY) / INCOSE-SET: §8 compliance checklist restates the requirement set

**Requirement ID:** Set-level (§8, lines 114–135)
**Violated principle(s):** DRY
**Current text:** §8 re-lists requirement groupings and re-traces success criteria
already encoded in the rows and in §10.
**Issue:** A self-assessment that re-enumerates content is a maintenance liability:
when a FR is added/renumbered, §8's hand-maintained lists (e.g. line 124
"FR-01–07, FR-23, FR-24") drift out of date. It is useful as a review artifact
but duplicates the traceable data.
**Impact:** Drift risk; low.

---

#### [INFO] INCOSE-QUALITY (Self-assessment over-claim): §8 asserts vague-term and singular compliance that this audit contradicts

**Requirement ID:** Set-level (§8)
**Violated principle(s):** INCOSE C5/C11 (claimed), audit integrity
**Current text:** line 116 *"Each row is a single capability (C5)"*; line 120
*"Vague terms (R7) and escape clauses (R8) have been removed"*.
**Issue:** FR-12 ("prompt … and shall preserve") and FR-04 (dialect bundle)
contradict the C5 single-capability claim. The over-claim is INFO-level because
it is a documentation accuracy issue, not a requirement defect itself — but it
weakens reviewer trust.
**Impact:** Reviewer-trust erosion; low.

---

#### [INFO] INCOSE-QUALITY (Unambiguous): "at the referencing location" (FR-06) is a soft spatial term

**Requirement ID:** FR-06
**Violated principle(s):** INCOSE C3 (Unambiguous)
**Current text:** FR-06 (line 75) *"…embed that image in the output PDF **at the referencing location**."*
**Issue:** "at the referencing location" means the image appears where the
Markdown reference sits in reading order. This is understandable but slightly
soft (exact placement after pagination is unstated). Low risk because intent is
clear; flagged for precision.
**Impact:** Minimal.

---

#### [INFO] INCOSE-QUALITY (Feasible/Appropriate): FR-24 explanatory note (lines 95–102) embeds architecture rationale in a requirements doc

**Requirement ID:** FR-24 note
**Violated principle(s):** SoC (requirements vs architecture separation), KISS
**Current text:** lines 95–102: *"…Rendering Mermaid diagrams offline requires a diagram-rendering dependency heavier than the rest of the conversion pipeline… the install-weight tradeoff is an architecture concern…"*
**Issue:** The note discusses dependency weight and architecture
accommodation — content the document's own §1 (line 10) says "belong[s] in the
architecture document." It is justified as a feasibility defense (C6), so INFO,
but it crosses the stated what/how boundary.
**Impact:** Minor SoC bleed; low.

---

#### [INFO] INCOSE-SET (Traceability): §10 claims "Each requirement ID is referenced exactly once" — unverifiable claim, and §8 violates it

**Requirement ID:** Set-level (§10 line 150)
**Violated principle(s):** INCOSE traceability claim accuracy
**Current text:** line 150 *"Each requirement ID is referenced exactly once in this document."*
**Issue:** Demonstrably false as a literal claim: FR-19 is referenced in its own
row (line 88) *and* in the FR-24 note (line 100 "user-scope installation
(FR-19)"); CON-03 appears in CON-03, OOS-01 (line 59), FR-24 note (line 98), and
§8 (lines 128, 134). The "exactly once" assertion is contradicted by the
document's own cross-references.
**Impact:** Documentation-accuracy defect; low, but it is a false set-level claim.

---

## Recommendations Summary (identification only — no fixes applied)

**Quick wins (wording / single-row):**
- FR-12: separable prompt vs preserve (singular).
- FR-04 / FR-05: resolve the syntax-highlighting Must-vs-Should conflict and the dialect-bundle non-atomicity.
- NFR-04, FR-22: define the option grammar / backend-selection these depend on.
- §10 "exactly once" claim and §8 C5 claim: correct the over-claims.

**Larger / structural:**
- Decide single home for no-network (CON-02 vs NFR-02) and no-LaTeX (CON-03 vs OOS-01).
- Re-derive the verification-method column for rendered-output FRs (Demonstration → Inspection/Test).
- Reconsider NFR-05's untestable "no … exception … exists" negative-universal and the time-dependent verification method.

---

## Positive Observations (worth preserving)

- **EARS discipline is consistently applied** — every FR uses When/Where/While/If
  with `md2pdf` as the named active subject (lines 70–93). Genuinely strong.
- **Binding glossary** (§2, lines 19–34) removes most lexical ambiguity and is
  referenced as authoritative.
- **Verification method per row** (rightmost column) — most rows carry it, and
  FR-07/FR-10/FR-16/FR-17/FR-18/NFR-02/NFR-03 correctly use **Test** where output
  behaviour is machine-checkable.
- **Explicit non-interactive guard (FR-14)** and **exit-status pair (FR-17/FR-18)**
  show good fail-loud / scriptability thinking aligned to description success
  criterion #5 (lines 106–108).
- **Out-of-scope split into Permanent vs Release-specific** (§5) is a clean,
  honest scoping pattern.
- **Description ↔ requirements traceability** (§8 C14, line 134) maps each success
  criterion to at least one requirement.

---

## Severity Tally (authoritative — matches index object)

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH (MAJOR) | 3 |
| MEDIUM (MINOR) | 7 |
| LOW (INFO) | 6 |
| **TOTAL** | **16** |
