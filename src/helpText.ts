export function buildHelpText(): string {
  return [
    "Usage: md2pdf [options] <entry...>",
    "",
    "Convert Markdown files into clean PDFs locally.",
    "",
    "Arguments:",
    "  entry                      Markdown file, files, or one top-level directory",
    "",
    "Options:",
    "  -o, --output <path>        Write one converted file to the given PDF path",
    "      --output-dir <dir>     Write converted PDFs into the given directory",
    "  -f, --force-overwrite      Replace existing PDFs without prompting",
    "  -h, --help                 Show this help message",
    "",
    "Examples:",
    "  md2pdf notes.md",
    "  md2pdf notes.md -o out/report.pdf",
    "  md2pdf a.md b.md --output-dir build",
  ].join("\n");
}
