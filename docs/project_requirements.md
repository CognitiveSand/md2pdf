# md2pdf — Requirements

## 1. Overview

This document specifies the requirements for `md2pdf`, the Markdown-to-PDF
converter whose intent and scope are defined in
[`project_description.md`](project_description.md). The governing objective is
to convert Markdown files to readable, shareable PDFs with the simplest
possible user experience. Requirements here describe **what** md2pdf must do
and how well; implementation mechanisms belong in the architecture document.

The requirement set covers the MVP unless a row's **Release** column says
`Post-MVP`.

## 2. Glossary

Terms below are binding for the whole document.

| Term | Definition |
|---|---|
| **md2pdf** | The converter described by this document; the responsible subject of every requirement. |
| **Markdown source file** | A UTF-8 text file with a `.md` extension supplied as conversion input. |
| **supported Markdown dialect** | CommonMark, plus these extensions: pipe tables, fenced code blocks with syntax highlighting, task-list checkboxes, and footnotes. |
| **Mermaid diagram** | A diagram declared in a fenced code block whose language identifier is `mermaid`, written in Mermaid diagram syntax. |
| **output PDF** | The PDF file produced from one Markdown source file. |
| **default output path** | The Markdown source file path with its `.md` extension replaced by `.pdf`, in the same directory. |
| **conversion entry** | A single command-line argument naming either one Markdown source file or one directory. |
| **batch invocation** | A single command-line invocation supplying more than one conversion entry, or one directory entry. |
| **interactive terminal session** | An invocation whose standard input and standard output are both attached to a terminal (TTY). |
| **user-scope installation** | An installation that places md2pdf on the invoking user's executable path without elevated privileges. |
| **system-scope installation** | An installation, performed with elevated privileges, that places md2pdf on the executable path of every user account on the host. |
| **OS default browser** | The browser registered by the invoking user's operating-system account as the default handler for `http`/`https` URLs. |
| **artifact** | Any third-party package, transitive dependency, binary, driver, runtime helper, browser build, bundled engine, stylesheet, font, template, generated vendor file, or external asset that is part of md2pdf's codebase, distribution, installation, or runtime provisioning path. |
| **eligible artifact version** | A released artifact version whose publication timestamp is at least 7 full days old at the time md2pdf selects, locks, embeds, distributes, references, vendors, or provisions it. |

## 3. Constraints

| ID | Constraint | Rationale |
|---|---|---|
| CON-01 | md2pdf shall run on Node.js version 20 or later. | Declared platform floor; the Mermaid, Playwright, and Markdown rendering stack is JavaScript-native (see architecture ADR-04). |
| CON-02 | md2pdf shall perform every conversion using only local computation, with no transmission of Markdown source files or output PDFs to any external network service. | Confidentiality success criterion in the project description. |
| CON-03 | md2pdf shall produce an output PDF without requiring a TeX or LaTeX distribution to be installed on the host. | "No heavyweight toolchain" success criterion; protects the zero-setup promise for the MVP. |

## 4. Assumptions

- The caller supplies file-system paths the invoking OS user is permitted to read and write.
- Each Markdown source file is UTF-8 encoded.
- Images referenced by relative path exist relative to the Markdown source file's directory at conversion time.

## 5. Out of scope

**Permanent (per project description):** graphical or web interface; live
preview; round-tripping PDF back to Markdown; merging many sources into one
PDF.

**Release-specific (deferred, not rejected):**

- **OOS-01 — LaTeX rendering backend.** Rendering via a TeX/LaTeX toolchain
  is deferred to Post-MVP; CON-03 governs the MVP.
- **OOS-02 — Recursive directory traversal.** MVP directory conversion
  covers top-level Markdown source files only; descent into subdirectories is
  deferred.
- **OOS-03 — Interchangeable visual themes.** A single built-in default style
  serves the MVP.

## 6. Functional requirements

| ID | Title | Requirement | Source | Priority | Release | Verification |
|---|---|---|---|---|---|---|
| FR-01 | Single-file conversion | When md2pdf is invoked with one Markdown source file as the conversion entry, md2pdf shall write one output PDF rendering that file's content. | Description objective | Must | MVP | Demonstration |
| FR-02 | Default output path | Where the caller supplies no explicit output path, md2pdf shall write the output PDF to the default output path. | Simplicity objective | Must | MVP | Demonstration |
| FR-03 | Explicit output path | Where the caller supplies an explicit output path for a single-file conversion, md2pdf shall write the output PDF to that path. | Usability | Should | MVP | Demonstration |
| FR-04 | Dialect rendering | md2pdf shall render the supported Markdown dialect in the output PDF. | "Proper PDF" objective | Must | MVP | Demonstration |
| FR-05 | Code syntax highlighting | When a fenced code block declares a language identifier, md2pdf shall render that block with syntax highlighting for the declared language in the output PDF. | "Proper PDF" objective | Should | MVP | Demonstration |
| FR-06 | Relative image embedding | When a Markdown source file references an image by relative path, md2pdf shall embed that image in the output PDF at the referencing location. | "Proper PDF" objective | Must | MVP | Demonstration |
| FR-07 | Heading page-break integrity | md2pdf shall render the output PDF such that no heading is the last rendered line on a page. | "Proper PDF" objective | Should | MVP | Test |
| FR-08 | Multiple-file batch | When md2pdf is invoked with more than one Markdown source file as conversion entries, md2pdf shall convert each named Markdown source file to its output PDF. | User-declared batch need | Must | MVP | Demonstration |
| FR-09 | Directory batch | When a conversion entry names a directory, md2pdf shall convert each top-level Markdown source file in that directory to its output PDF. | User-declared folder need | Must | MVP | Demonstration |
| FR-10 | Batch continuation | While a batch invocation is in progress, if conversion of one Markdown source file fails, then md2pdf shall continue converting the remaining conversion entries. | Fail-loud without aborting the batch | Should | MVP | Test |
| FR-11 | Batch outcome reporting | When a batch invocation completes, md2pdf shall report the count of succeeded and failed conversions on standard output. | Transparency | Should | MVP | Demonstration |
| FR-12 | Overwrite prompt | While an interactive terminal session is active, when the output PDF path already exists and the force-overwrite option is absent, md2pdf shall prompt the caller to confirm overwriting and shall preserve the existing file if the caller does not confirm. | User-declared overwrite-prompt need; POLA | Must | MVP | Demonstration |
| FR-13 | Forced overwrite | Where the `--force-overwrite` (`-f`) option is supplied, md2pdf shall overwrite an existing output PDF without prompting, regardless of whether an interactive terminal session is active. | User-declared force option | Must | MVP | Demonstration |
| FR-14 | Non-interactive overwrite guard | While no interactive terminal session is active, when the output PDF path already exists and the force-overwrite option is absent, md2pdf shall leave the existing file unchanged and report the skipped path on standard error. | Fail-loud; prevents silent data loss in scripts | Must | MVP | Test |
| FR-15 | Missing-input reporting | If a conversion entry names a path that does not exist or cannot be read, then md2pdf shall report the offending path on standard error and exclude it from conversion. | Clear-error success criterion | Must | MVP | Demonstration |
| FR-16 | Render-failure reporting | If a Markdown source file contains content md2pdf cannot render, then md2pdf shall report the offending source file path on standard error rather than write a partial output PDF. | Clear-error success criterion | Must | MVP | Test |
| FR-17 | Failure exit status | When at least one conversion in an invocation fails, md2pdf shall terminate with a non-zero exit status. | Scriptability; fail-loud | Must | MVP | Test |
| FR-18 | Success exit status | When every conversion in an invocation succeeds, md2pdf shall terminate with a zero exit status. | Scriptability | Must | MVP | Test |
| FR-19 | User-scope installation | md2pdf shall be installable to a user-scope installation without elevated privileges. | User-declared install need | Must | MVP | Demonstration |
| FR-20 | System-scope availability | When md2pdf is installed as a system-scope installation, md2pdf shall be invocable by each user account on the host. | User-declared install need | Should | MVP | Demonstration |
| FR-21 | Idempotent install and upgrade | When the installation procedure is executed against a host where md2pdf is already present, the procedure shall leave md2pdf at the target version and shall terminate with a zero exit status. | User-declared idempotency need | Must | MVP | Test |
| FR-22 | LaTeX rendering backend | md2pdf shall produce the output PDF through a LaTeX rendering backend when that backend is selected. | Roadmap | Could | Post-MVP | Test |
| FR-23 | Output-directory option | Where the `--output-dir` option supplies a directory path, md2pdf shall write each output PDF into that directory using the source file's base name with a `.pdf` extension. | User-declared output-dir need | Should | MVP | Demonstration |
| FR-24 | Mermaid diagram rendering | When a fenced code block declares the `mermaid` language identifier, md2pdf shall render the described Mermaid diagram as an image in the output PDF rather than as the block's raw text. | User-declared diagram need (high priority) | Must | MVP | Demonstration |
| FR-25 | Default-browser rendering | When md2pdf performs browser-backed rendering, md2pdf shall launch the OS default browser and shall not select a different installed browser. | User-declared browser-selection need | Must | MVP | Test |

**Note on FR-24 (C6 Feasible).** Mermaid diagram rendering is a confirmed
high-priority MVP capability and shall not be deferred. Rendering Mermaid
diagrams offline requires a diagram-rendering dependency heavier than the rest
of the conversion pipeline. This satisfies CON-02 (no network) and does not
violate CON-03 (it is not a TeX toolchain). The architecture document shall
accommodate that dependency while keeping the user-scope installation (FR-19)
free of elevated privileges; the install-weight tradeoff is an architecture
concern, not grounds for dropping the requirement.

## 7. Non-functional requirements

| ID | Title | Requirement | Category | Priority | Release | Verification |
|---|---|---|---|---|---|---|
| NFR-01 | Zero-configuration first run | When md2pdf is invoked with one Markdown source file and no other options on a host with md2pdf installed, md2pdf shall produce the output PDF without requiring any configuration file or prior setup step. | Quality Attribute | Must | MVP | Demonstration |
| NFR-02 | Local-only processing | md2pdf shall open no outbound network connection during conversion. | Quality Attribute | Must | MVP | Test |
| NFR-03 | Platform portability | md2pdf shall perform single-file conversion on Linux, macOS, and Windows hosts running Node.js 20 or later. | Quality Attribute | Should | MVP | Test |
| NFR-04 | Self-describing usage | When md2pdf is invoked with the help option, md2pdf shall display each supported option with a one-line description on standard output. | Quality Attribute | Should | MVP | Demonstration |
| NFR-05 | Artifact freshness policy | When any artifact is added, updated, embedded, locked, referenced, distributed, vendored, generated from a third-party source, or provisioned by md2pdf, md2pdf shall use the newest eligible artifact version available after a 7-day quarantine period, with no exception, override, bypass, emergency exemption, or force mode. | Quality Attribute | Must | MVP | Test |

## 8. Compliance checklist (C1–C14 self-assessment)

**Per-requirement (C1–C9):** Each row is a single capability (C5), uses an
EARS pattern with md2pdf as the named active subject (C2, R2), is solution-free
(R31), and carries a verification method (C7). Vague terms (R7) and escape
clauses (R8) have been removed; "as simple as possible" appears only in the
description, never as a requirement.

**Set-level (C10–C14):**

- **C10 Complete** — covers conversion (FR-01–07, FR-23, FR-24), browser selection (FR-25), batch (FR-08–11),
  overwrite (FR-12–14), error handling and exit status (FR-15–18),
  installation (FR-19–21), artifact freshness (NFR-05), and the deferred backend
  (FR-22).
- **C11 Consistent** — one vocabulary (§2); CON-03 and FR-22/OOS-01 agree that
  LaTeX is Post-MVP.
- **C12 Feasible together** — no row contradicts CON-01–03.
- **C13 Comprehensible** — glossary plus tables stand alone.
- **C14 Validatable** — every success criterion in the description maps to at
  least one requirement (one-command → NFR-01; shareable output → FR-04–07;
  no LaTeX → CON-03; local-only → CON-02/NFR-02; artifact freshness → NFR-05;
  clear errors → FR-15/16).

## 9. Resolved decisions

No open questions remain. Decisions taken during review:

1. **No performance requirement for the MVP** — a conversion-latency bound is
   intentionally omitted; speed targets may be added in a later release.
2. **Output location** — each output PDF lands beside its source by default
   (FR-02); the `--output-dir` option (FR-23) redirects output when supplied.
3. **Non-recursive directory conversion** — confirmed for the MVP (OOS-02);
   recursion into subdirectories is deferred.

## 10. Traceability notes

Each requirement ID is referenced exactly once in this document. Downward
traceability to verification evidence is to be maintained by tagging each test
with its requirement ID (for example `@req FR-08`) so the traceability matrix
can be generated from the test suite.
