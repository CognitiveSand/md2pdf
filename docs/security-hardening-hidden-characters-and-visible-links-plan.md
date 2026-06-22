# Security Hardening Plan - Hidden Characters And Visible Links

## 1. Objective

Add a focused hardening layer for Markdown text that can visually deceive a
reader or produce misleading clickable PDF links.

This plan covers two protections:

- block hidden, control, or bidirectional Unicode characters that can disguise
  text;
- allow clickable HTTPS links only when the visible link text is the same URL as
  the `href`.

No new third-party artifact is required.

## 2. Hidden And Dangerous Characters

Add a prevalidation step at the start of `renderToHtml`, before Markdown parsing.

Reject control characters except ordinary Markdown whitespace:

- allow `\n`;
- allow `\r`;
- allow `\t`;
- reject other C0/C1 control characters.

Reject invisible or visual-order-changing Unicode characters:

- zero-width characters: `U+200B`, `U+200C`, `U+200D`;
- soft hyphen: `U+00AD`;
- byte order mark inside content: `U+FEFF`;
- bidirectional overrides/embeddings: `U+202A` to `U+202E`;
- bidirectional isolates: `U+2066` to `U+2069`;
- word joiner and invisible separator: `U+2060`, `U+2063`.

Return a `RenderError` with:

- a clear message;
- `sourcePath`;
- an action hint asking the user to remove hidden formatting characters;
- if practical, a line and column in the cause/context.

## 3. Visible HTTPS Link Policy

Keep the existing rule: only `https://...` links may keep an `href`.

Add a stricter rule: a clickable link is allowed only when the visible text is
the exact URL being linked.

Allowed:

```md
[https://example.com/page](https://example.com/page)
```

Blocked:

```md
[click here](https://example.com)
[https://paypal.com](https://evil.example)
[example.com](https://example.com)
```

When blocked, remove `href` and add:

```html
data-md2pdf-blocked-href="true"
```

## 4. URL Clarity Rules

For links that would otherwise be clickable, also reject:

- URLs with username or password components, such as
  `https://user@example.com`;
- URLs containing hidden or dangerous characters;
- empty hosts;
- malformed HTTPS URLs.

First implementation should prefer conservative behavior. If a URL is ambiguous,
render it as non-clickable text.

## 5. Comparison Rules

Extract the visible link text from Markdown inline tokens.

Normalize only minimal presentation noise:

- trim leading and trailing whitespace;
- compare the resulting visible text directly to the `href`.

Do not accept a different display label, even if it looks helpful. The PDF user
must see the exact destination before deciding to click.

## 6. Tests To Add

Unit tests in `tests/unit/markdownRenderer/markdownRenderer.test.ts`:

- Markdown containing a zero-width character is rejected.
- Markdown containing a bidi override is rejected.
- Markdown containing an unexpected control character is rejected.
- `[text](https://example.com)` loses `href`.
- `[https://evil.example](https://example.com)` loses `href`.
- `[https://example.com](https://example.com)` keeps `href`.
- `https://user@example.com` is blocked as a clickable link.
- a URL containing an invisible character is rejected or blocked.

Integration test in `tests/integration/converter.test.ts`:

- generated HTML keeps only clear visible HTTPS URLs clickable and marks
  deceptive HTTPS links as blocked.

## 7. Implementation Order

1. Add a helper that detects hidden/dangerous characters.
2. Call it from the Markdown prevalidation path before parsing.
3. Add a helper such as `isClearVisibleHttpsLink(href, visibleText)`.
4. Update `renderLinkOpen` so it can compare `href` with visible link text.
5. Add focused unit tests.
6. Add one integration test for generated local HTML.
7. Run:

```bash
npm run typecheck
npm test -- tests/unit/markdownRenderer/markdownRenderer.test.ts
npm test -- tests/integration/converter.test.ts
npm test
```

## 8. Definition Of Done

- Hidden and visual-order-changing characters are rejected before Markdown
  parsing.
- Dangerous control characters are rejected.
- A clickable PDF link always displays the exact destination URL.
- Deceptive HTTPS links are preserved as visible text but lose `href`.
- Existing allowed Markdown rendering still works.
- No new artifact is introduced.
