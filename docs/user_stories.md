# md2pdf — User Stories

These stories are the conversation placeholders for the capabilities specified
in [`project_requirements.md`](project_requirements.md). Each acceptance
criterion traces to a requirement with a `@req` tag. Stories describe observable
behaviour only; mechanisms (libraries, modules, rendering engine) belong in the
architecture document.

Acceptance criteria use Given / When / Then. "The user runs md2pdf with …"
denotes a single command-line invocation.

---

## US-01: Convert a Markdown file to a PDF

### Story
As a developer with a Markdown README, I want to turn it into a PDF with one
command, so that I can share a finished document without any setup.

### Rationale
The walking skeleton of the product and the core promise of the project: one
file in, one shareable PDF out, no configuration. Ladders up to every other
story.

### Acceptance Criteria
```gherkin
Rule: A single Markdown file converts to a PDF beside it with no configuration

  @req FR-01 @req FR-02 @req NFR-01
  Scenario: Convert a plain Markdown file
    Given a Markdown source file "notes.md" exists in the current directory
    When the user runs md2pdf with "notes.md"
    Then a file "notes.pdf" is created in the same directory
    And the conversion completes without requiring any configuration file or setup step

  @req FR-04
  Scenario: Prose, headings, and lists render
    Given a Markdown source file containing headings, paragraphs, and nested lists
    When the user runs md2pdf with that file
    Then the output PDF renders the headings, paragraphs, and list nesting

  @req NFR-02
  Scenario: Conversion stays local
    Given a Markdown source file "notes.md"
    When the user runs md2pdf with "notes.md"
    Then no outbound network connection is opened during the conversion
```

### Example
```bash
$ md2pdf notes.md
$ ls
notes.md  notes.pdf
```

### Notes
Portability (NFR-03) applies across every story: the conversion in this story
is verified on Linux, macOS, and Windows under Node.js 20+.

---

## US-02: Render rich Markdown content faithfully

### Story
As a technical writer documenting code, I want tables, code blocks, images, and
footnotes to render correctly, so that the PDF I send needs no manual fix-ups.

### Rationale
"Proper PDF" means the common rich elements of technical writing survive the
conversion. Extends US-01 from plain prose to the full supported dialect.

### Acceptance Criteria
```gherkin
Rule: The supported Markdown dialect renders in the output PDF

  @req FR-04
  Scenario: Tables, task lists, and footnotes render
    Given a Markdown source file containing a pipe table, a task list, and a footnote
    When the user runs md2pdf with that file
    Then the output PDF renders the table, the task-list checkboxes, and the footnote

  @req FR-05
  Scenario: Fenced code is highlighted by language
    Given a Markdown source file with a fenced code block declaring language "python"
    When the user runs md2pdf with that file
    Then the output PDF renders that code block in a monospace font with Python syntax highlighting

  @req FR-06
  Scenario: A relatively referenced image is embedded
    Given a Markdown source file referencing "diagram.png" by relative path
    And "diagram.png" exists relative to the source file's directory
    When the user runs md2pdf with that file
    Then the output PDF embeds "diagram.png" at the referencing location

  @req FR-07
  Scenario: No heading is orphaned at a page bottom
    Given a Markdown source file whose content spans more than one PDF page
    When the user runs md2pdf with that file
    Then no heading is the last rendered line on any page of the output PDF

  @req FR-24
  Scenario: A Mermaid diagram renders as an image
    Given a Markdown source file containing a fenced code block declaring language "mermaid"
    When the user runs md2pdf with that file
    Then the output PDF renders the described diagram as an image rather than as raw code text
```

### Notes
Image references that cannot be resolved are an error case owned by US-06.

---

## US-03: Choose where the PDF is written

### Story
As a writer organising my output, I want to control the output path or folder,
so that generated PDFs land where I expect rather than always beside the source.

### Rationale
Default-beside-source (US-01) covers the common case; this story adds explicit
control for users who keep sources and outputs apart.

### Acceptance Criteria
```gherkin
Rule: The caller can redirect the output location

  @req FR-03
  Scenario: Explicit output path for a single file
    Given a Markdown source file "notes.md"
    When the user runs md2pdf with "notes.md" and an explicit output path "out/report.pdf"
    Then the output PDF is written to "out/report.pdf"

  @req FR-23
  Scenario: Output directory for one or more files
    Given Markdown source files "a.md" and "b.md"
    When the user runs md2pdf with "a.md", "b.md", and the option "--output-dir build"
    Then "build/a.pdf" and "build/b.pdf" are created
```

### Example
```bash
$ md2pdf notes.md -o out/report.pdf
$ md2pdf a.md b.md --output-dir build
```

---

## US-04: Convert many files or a whole folder at once

### Story
As a researcher with a folder of Markdown notes, I want to convert them all in
one command, so that I do not invoke the tool once per file.

### Rationale
Batch conversion is a declared need and the difference between a toy and a
usable tool for anyone with more than one document.

### Acceptance Criteria
```gherkin
Rule: A single invocation converts every named file and every Markdown file in a named folder

  @req FR-08
  Scenario: Convert several named files
    Given Markdown source files "a.md", "b.md", and "c.md"
    When the user runs md2pdf with "a.md", "b.md", and "c.md"
    Then "a.pdf", "b.pdf", and "c.pdf" are created

  @req FR-09
  Scenario: Convert every Markdown file in a folder
    Given a folder "notes" containing "x.md" and "y.md" at its top level
    When the user runs md2pdf with "notes"
    Then "notes/x.pdf" and "notes/y.pdf" are created

  @req FR-10 @req FR-11
  Scenario: One failing file does not abort the batch
    Given Markdown source files "good.md" and "broken.md"
    And "broken.md" cannot be rendered
    When the user runs md2pdf with "good.md" and "broken.md"
    Then "good.pdf" is created
    And md2pdf reports one succeeded conversion and one failed conversion on standard output
```

### Notes
Folder conversion is non-recursive for the MVP (sub-folders are not descended
into); recursion is deferred per OOS-02.

---

## US-05: Never overwrite my files by accident

### Story
As a user re-running a conversion, I want to be asked before an existing PDF is
overwritten, so that I do not silently lose a file I meant to keep.

### Rationale
Re-running conversions is routine; clobbering an output without warning is a
data-loss surprise. POLA. The `-f` flag is the explicit opt-out for users who
want overwrite to be the default.

### Acceptance Criteria
```gherkin
Rule: An existing output PDF is preserved unless the caller chooses to overwrite

  @req FR-12
  Scenario: Prompt before overwriting in a terminal
    Given "notes.pdf" already exists
    And md2pdf is run in an interactive terminal session
    When the user runs md2pdf with "notes.md" and declines the overwrite prompt
    Then "notes.pdf" is left unchanged

  @req FR-13
  Scenario: Forced overwrite skips the prompt
    Given "notes.pdf" already exists
    When the user runs md2pdf with "notes.md" and the option "--force-overwrite"
    Then "notes.pdf" is replaced with the newly converted output PDF

  @req FR-13
  Scenario: Forced overwrite is honored without a terminal
    Given "notes.pdf" already exists
    And md2pdf is run with no interactive terminal session
    When the user runs md2pdf with "notes.md" and the option "--force-overwrite"
    Then "notes.pdf" is replaced with the newly converted output PDF

  @req FR-14
  Scenario: No prompt is possible and no force option is given
    Given "notes.pdf" already exists
    And md2pdf is run with no interactive terminal session
    When the user runs md2pdf with "notes.md" and no force option
    Then "notes.pdf" is left unchanged
    And the skipped path is reported on standard error
```

### Example
```bash
$ md2pdf notes.md
notes.pdf exists. Overwrite? [y/N]
$ md2pdf notes.md -f          # overwrite without asking
```

---

## US-06: Tell me clearly when something fails

### Story
As a developer running md2pdf in a script, I want clear errors and reliable exit
codes, so that my pipeline can detect a failed conversion and report the cause.

### Rationale
Fail-loud is a stated success criterion, and exit codes make the tool usable
inside CI and shell scripts.

### Acceptance Criteria
```gherkin
Rule: Failures are reported clearly and reflected in the exit status

  @req FR-15
  Scenario: Input path does not exist
    Given no file named "missing.md" exists
    When the user runs md2pdf with "missing.md"
    Then md2pdf reports "missing.md" on standard error
    And no output PDF is created for that path

  @req FR-16
  Scenario: A source file cannot be rendered
    Given a Markdown source file "broken.md" containing content md2pdf cannot render
    When the user runs md2pdf with "broken.md"
    Then md2pdf reports "broken.md" on standard error
    And no partial "broken.pdf" is written

  @req FR-17
  Scenario: Non-zero exit status on any failure
    Given a conversion in the invocation fails
    When the invocation completes
    Then md2pdf terminates with a non-zero exit status

  @req FR-18
  Scenario: Zero exit status when all succeed
    Given every conversion in the invocation succeeds
    When the invocation completes
    Then md2pdf terminates with a zero exit status
```

---

## US-07: Install without admin rights

### Story
As a developer without administrator access, I want to install md2pdf for my own
account and re-run the installer safely, so that I can use the command without
asking IT and without a TeX toolchain.

### Rationale
The install experience is part of "as simple as possible". A no-sudo install,
an optional system-wide install, and a safe-to-repeat installer remove the
friction that keeps people on browser print-to-PDF.

### Acceptance Criteria
```gherkin
Rule: md2pdf installs per-user without elevation and the installer is repeatable

  @req FR-19
  Scenario: User-scope installation needs no elevation
    Given a host with Node.js 20 or later and no administrator privileges
    When the user installs md2pdf to a user-scope installation
    Then the "md2pdf" command is invocable from the user's shell
    And no TeX or LaTeX distribution was required

  @req FR-20
  Scenario: System-scope installation serves every account
    Given md2pdf installed as a system-scope installation
    When any user account on the host invokes "md2pdf"
    Then the "md2pdf" command runs for that account

  @req FR-21
  Scenario: Re-running the installer is idempotent
    Given md2pdf is already installed on the host
    When the installation procedure is executed again for the target version
    Then md2pdf is left at the target version
    And the procedure terminates with a zero exit status
```

---

## US-08: Discover how to use the tool

### Story
As a first-time user, I want a help listing of the options, so that I can learn
how to run md2pdf without leaving the terminal.

### Rationale
Self-description is the cheapest usability win and supports the zero-onboarding
goal.

### Acceptance Criteria
```gherkin
Rule: Help lists every supported option

  @req NFR-04
  Scenario: Display help
    Given md2pdf is installed
    When the user runs md2pdf with the help option
    Then each supported option is listed with a one-line description on standard output
```

### Example
```bash
$ md2pdf --help
```

---

## US-09 (Post-MVP): Render through a LaTeX backend

### Story
As a user who wants LaTeX-grade typesetting, I want to select a LaTeX rendering
backend, so that I can produce a PDF with LaTeX's typographic quality when I am
willing to install the toolchain.

### Rationale
A roadmap capability for users who explicitly want LaTeX output. Deferred
because requiring LaTeX conflicts with the MVP's zero-setup constraint (CON-03);
this story makes LaTeX an opt-in alternative, not the default path.

### Acceptance Criteria
```gherkin
Rule: A LaTeX backend produces the output PDF when selected

  @req FR-22
  Scenario: Convert via the LaTeX backend
    Given a host with the LaTeX backend's toolchain available
    And a Markdown source file "paper.md"
    When the user runs md2pdf with "paper.md" and the LaTeX backend selected
    Then "paper.pdf" is produced through the LaTeX backend
```

### Notes
This is a Post-MVP enabler-flavoured story; the default rendering path remains
the no-LaTeX MVP path. Backend selection mechanics belong in the architecture
document.

---

## Traceability summary

| Story | Requirements covered |
|---|---|
| US-01 | FR-01, FR-02, FR-04, NFR-01, NFR-02 |
| US-02 | FR-04, FR-05, FR-06, FR-07, FR-24 |
| US-03 | FR-03, FR-23 |
| US-04 | FR-08, FR-09, FR-10, FR-11 |
| US-05 | FR-12, FR-13, FR-14 |
| US-06 | FR-15, FR-16, FR-17, FR-18 |
| US-07 | FR-19, FR-20, FR-21 |
| US-08 | NFR-04 |
| US-09 (Post-MVP) | FR-22 |
| Cross-cutting | NFR-03 (portability) — verified within US-01 |

Every functional and non-functional requirement is covered by at least one
story. The Definition of Done (test coverage, `mypy --strict`, `ruff check`,
README currency) applies to every story and is tracked separately from these
acceptance criteria.
