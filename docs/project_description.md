# md2pdf — Project Description

## What it does

`md2pdf` converts Markdown files into well-formatted PDF documents. It is
built around a single promise: **the simplest possible path from a `.md`
file to a clean, readable PDF.** A user with a Markdown file and no prior
setup should be one command away from a finished PDF.

```bash
md2pdf report.md
# → report.pdf
```

That single invocation, producing a sensible result with zero configuration,
is the product.

## The problem

Markdown is the default format for notes, READMEs, documentation, and
technical writing. PDF is the default format for *sharing* a finished
document — it is portable, paginated, and renders identically everywhere.

The bridge between the two is unreasonably painful today:

- **Browser "print to PDF"** loses control over margins, page breaks, and
  headers, and requires manual clicking.
- **Pandoc + a LaTeX distribution** is powerful but heavy: a multi-gigabyte
  TeX install, a template language to learn, and cryptic errors when a
  package is missing.
- **Online converters** require uploading documents — a privacy and
  confidentiality problem for anything sensitive.

Each existing route forces the user to choose between *simplicity* and
*control over the output*. The common case — "I just want a nice PDF of this
file" — is not served well by any of them.

## Objective

Deliver a tool that converts Markdown to a **proper PDF** — typographically
clean, correctly paginated, faithful to standard Markdown — while being **as
simple to use as possible**.

"Proper PDF" means the output is something a user would willingly send to a
colleague or attach to an email without editing it further:

- Readable body typography with sensible margins and line spacing.
- Headings, lists, tables, blockquotes, and fenced code blocks rendered
  correctly.
- Inline and block code in a monospace font, with syntax highlighting.
- Working page breaks (no heading orphaned at the bottom of a page).
- Embedded and linked images rendered in place.

"As simple as possible" means the default experience requires **no
configuration, no template authoring, and no manual layout work**. The tool
makes good decisions on the user's behalf, and only asks for input when the
user wants to override a default.

## Who it is for

- **Writers and engineers** turning notes, specs, or READMEs into shareable
  documents.
- **Students and researchers** producing readable PDFs from Markdown drafts.
- **Anyone** who wants a Markdown file as a PDF and does not want to install
  a LaTeX toolchain or learn a templating system to get there.

The unifying trait is that these users value their time more than they value
fine-grained typographic control. The tool is designed for the person who
wants the result, not the configuration.

## Scope

### In scope

- Converting a single Markdown file to a single PDF.
- Standard Markdown plus the commonly expected extensions: tables, fenced
  code blocks with syntax highlighting, task lists, and footnotes.
- Sensible, attractive default styling that works without any user input.
- Resolving and embedding images referenced by relative paths.
- A command-line interface as the primary entry point.

### Out of scope (for now)

- A graphical or web interface.
- Real-time preview or editing of Markdown.
- Authoring or maintaining a library of interchangeable visual themes.
- Slide decks, multi-file books, or merging many documents into one PDF.
- Round-tripping (PDF back to Markdown).

Out-of-scope items are deliberately excluded to protect the core promise.
They are not rejected forever; they are simply not part of meeting the
objective, and adding them before the core is excellent would dilute it.

## What success looks like

The project has met its objective when:

1. A new user can install the tool and convert their first file in **one
   command**, with no configuration step in between.
2. The default output is good enough to **share unedited** for the common
   case (prose with headings, lists, code, and a table or two).
3. Conversion **does not require a LaTeX/TeX installation** or any other
   heavyweight external toolchain the user must manage by hand.
4. Conversion happens **entirely on the user's machine** — no document is
   uploaded anywhere.
5. When something cannot be rendered, the tool **says so clearly** and points
   at the offending input, rather than failing silently or producing a
   broken PDF.

## Guiding principle

Every design decision is judged against one question: **does this make the
common case simpler?** Features that add capability at the cost of the
zero-config experience are weighed against that promise and, by default,
declined. Simplicity here is not a lack of features — it is the discipline of
making the right thing happen without being asked.
