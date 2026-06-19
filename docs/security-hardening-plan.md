# Security Hardening Plan - Hostile Markdown

## 1. Objective

Make hostile Markdown harmless during conversion without breaking normal usage:

- local PNG/JPEG/WebP images;
- local code highlighting;
- Mermaid rendering;
- clickable external links in the generated PDF.

This plan hardens conversion-time input handling only. It does not change the
artifact freshness policy and does not introduce new third-party artifacts.

## 2. Security model

The generated HTML must remain a passive, local render target:

- no remote images;
- no remote scripts;
- no remote stylesheets;
- no local file links created from Markdown links;
- no browser network fetch caused by document content;
- PDF links may remain clickable only when they are safe passive links.

Every rejection must use `RenderError` with a clear message and an action hint.

## 3. Implementation order

1. Reject SVG and introduce an image format allowlist.
2. Replace syntactic image path checks with realpath-based containment checks.
3. Add Markdown, line, image count, Mermaid, and code block limits.
4. Validate image file size, total image size, magic signature, and dimensions.
5. Allow safe clickable external links while blocking active or local schemes.
6. Harden WebDriver/browser launch settings and preserve local-only rendering.
7. Add hostile-input tests covering every policy boundary.

## 4. SVG policy

Decision: reject all `.svg` images referenced from Markdown.

User-facing error:

> SVG images are not supported for security reasons; use PNG/JPEG/WebP.

Required behavior:

- simple SVG is rejected;
- SVG containing `http:`, `https:`, `file:`, `<script>`, or `<foreignObject>` is
  rejected;
- PNG, JPEG, and WebP remain accepted when they pass the other image checks.

Implementation notes:

- remove the current exception that accepts SVG unless it contains an external
  URL;
- do not parse or sanitize SVG; the policy is deny-by-format;
- keep Mermaid support separate, because Mermaid diagrams are rendered from
  escaped fenced code blocks under the inlined Mermaid engine.

## 5. Image path containment

Replace purely syntactic path validation with validation over resolved real
paths.

Required behavior:

- resolve `baseDir` with `realpath`;
- resolve the candidate image path with `realpath`;
- allow the image only when the real image path stays under the real base
  directory;
- reject absolute image paths and URI-based image sources before filesystem
  resolution;
- reject missing images with the existing clear missing-file error style.

Required tests:

- `../outside.png` is rejected;
- a local symlink pointing outside the base directory is rejected;
- a normal image in the source directory is accepted;
- an image in a subdirectory is accepted;
- an image under an explicit `baseDir` is accepted.

## 6. Input size limits

Introduce internal constants first. They can become configurable options later
only if a real user need appears.

Initial limits:

| Item | Limit |
| --- | ---: |
| Markdown document | 10 MB |
| Individual line | 1 MB |
| Image count | 100 |
| Mermaid block count | 50 |
| Mermaid block content | 256 KB |
| Code block submitted to highlighting | 1 MB |

Required behavior:

- Markdown over 10 MB fails before parsing;
- a line over 1 MB fails before parsing;
- more than 100 Markdown images fails before embedding;
- more than 50 Mermaid blocks fails before browser rendering;
- a Mermaid block over 256 KB fails before browser rendering;
- a code block over 1 MB either fails with `RenderError` or is rendered escaped
  without syntax highlighting. Prefer fail-loud unless compatibility evidence
  argues for fallback rendering.

All limit errors must advise the user to simplify the document.

Required tests:

- oversized Markdown is rejected;
- oversized line is rejected;
- oversized code block is rejected or rendered without highlighting according
  to the chosen behavior;
- oversized Mermaid block is rejected cleanly;
- too many images or Mermaid blocks are rejected cleanly.

## 7. Image file validation

Allow only known raster image formats:

- `.png`
- `.jpg`
- `.jpeg`
- `.webp`

Do not allow initially:

- `.gif`
- `.svg`
- files with no recognized extension;
- `application/octet-stream`;
- files whose extension disagrees with their content.

Initial limits:

| Item | Limit |
| --- | ---: |
| Single image file size | 20 MB |
| Total embedded image bytes | 100 MB |
| Single image pixels | 25 MP |

Dimension examples inside 25 MP include `10000 x 2500` and `5000 x 5000`.

Implementation notes:

- check extension first for clear errors;
- check magic signature before embedding;
- parse dimensions minimally for PNG, JPEG, and WebP without adding a heavy
  dependency;
- compare detected format to the extension allowlist;
- track cumulative embedded image bytes per render.

Required tests:

- `.png` with non-PNG content is rejected;
- `.jpg`/`.jpeg` with non-JPEG content is rejected;
- `.webp` with non-WebP content is rejected;
- an oversized single image is rejected;
- an image over the pixel limit is rejected;
- total image bytes over 100 MB is rejected;
- valid PNG/JPEG/WebP fixtures are accepted.

## 8. Link policy

Change the current policy so safe external links stay clickable in the PDF.

Allowed:

- `https://...`

Blocked:

- `http://...` unless explicitly accepted in a later product decision;
- `javascript:`;
- `data:`;
- `file:`;
- `blob:`;
- `ftp:`;
- unknown schemes;
- local absolute or root-relative links such as `/etc/passwd`.

Required behavior:

- `[site](https://example.com)` keeps its `href`;
- `[bad](javascript:alert(1))` loses its `href`;
- `[local](/etc/passwd)` loses its `href`;
- external links are passive only: they may be present as anchors, but no remote
  resource may be loaded while rendering;
- remote images remain rejected even though `https://` links are clickable.

Required tests:

- safe HTTPS anchors remain in generated HTML;
- blocked schemes remove `href` and mark the anchor as blocked;
- generated HTML contains no active network resource:
  - no `<img src="https://...">`;
  - no `<script src="https://...">`;
  - no `<link href="https://...">`.

## 9. Browser and WebDriver hardening

Keep the isolated temporary browser profile. Add conservative launch flags where
supported by the browser family.

Required behavior:

- WebDriver stays bound to `127.0.0.1`;
- browser profile is per-run and temporary;
- extensions are disabled where supported;
- sync is disabled where supported;
- background networking is disabled where supported;
- permission prompts and unnecessary browser services are disabled where
  supported;
- direct/no-proxy behavior remains enabled;
- PDF links are not disabled, because clickable links are different from active
  network resource loading during render.

Required tests:

- Chrome/Chromium/Edge capabilities include the hardened flags;
- Firefox capabilities include headless/offline settings and any supported
  hardening preferences;
- WebDriver transport rejects non-local endpoints;
- WebDriver request paths cannot escape the local endpoint.

## 10. Verification matrix

| Area | Test coverage |
| --- | --- |
| SVG deny policy | simple SVG and hostile SVG variants rejected |
| Format allowlist | PNG/JPEG/WebP accepted, unknown/GIF/SVG rejected |
| Magic signatures | extension/content mismatch rejected |
| Dimensions | over-25 MP image rejected |
| Image bytes | single 20 MB and total 100 MB limits enforced |
| Realpath containment | traversal and symlink escape rejected |
| Markdown limits | 10 MB document and 1 MB line limits enforced |
| Code/Mermaid limits | huge code and Mermaid inputs handled cleanly |
| Link policy | HTTPS anchor preserved; dangerous/local schemes stripped |
| Local-only HTML | no active network resource appears in generated HTML |
| WebDriver hardening | local bind, isolated profile, conservative flags |

## 11. Acceptance criteria

The hardening is complete when:

- hostile Markdown cannot cause local file exfiltration through image paths,
  symlinks, SVG, or dangerous links;
- generated HTML contains no active network resources;
- HTTPS links remain clickable in the PDF;
- valid local PNG/JPEG/WebP images still render;
- code highlighting and Mermaid still work within documented limits;
- all new hostile-input tests pass;
- no third-party artifact has been added or changed without satisfying
  `ARTIFACT_FRESHNESS_POLICY.md`.
