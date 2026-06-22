# Research: Best practice for headless HTML→PDF tools on snap systems

> Captured 2026-06-18. Source: parallel research agent (facet 4 of 4).
> Companion docs: [01-snap-firefox-geckodriver.md](01-snap-firefox-geckodriver.md),
> [02-snap-chromium-chromedriver.md](02-snap-chromium-chromedriver.md),
> [03-snap-confinement-file-access.md](03-snap-confinement-file-access.md).
> Synthesis & decision: [../handling_the_browser_in_linux_KM.md](../handling_the_browser_in_linux_KM.md).

## Research question

Best practices (2024–2026) for "render local HTML → PDF using a headless browser" Node tools on
Linux where the installed browsers are snap-packaged, via W3C WebDriver / CDP — and how mature
tools branch to keep macOS/Windows correct.

## What mature tools do

- **Playwright** — maintainer (JoelEinbinder, microsoft/playwright #6485), verbatim: *"this is a
  wontfix from us. We don't test against Chromium Snap, so I can't recommend using it for
  Playwright."* The same issue traces `/tmp/snap.chromium/tmp` (downloads to `$HOME` succeed, to
  `/tmp` fail). Playwright's `channel:'chrome'`/`'msedge'` install branded browsers via Playwright's
  own installer (never snap); `channel:'firefox'` is **not** a documented option — Firefox is only
  ever the bundled patched build, so a system/snap Firefox is categorically unsupported by design.
- **Puppeteer** — no verbatim "no snap" quote exists; its anti-snap stance rests on docs + design +
  an unanswered snap-error issue (#8232, users +1 2022→2025, zero maintainer replies). It downloads
  its own browser by default.
- **Chrome for Testing** — rationale verbatim (Mathias Bynens, 2023-06-12): Chromium snapshot
  binaries are "not reliably available across all platforms"; "Google intentionally doesn't make
  versioned Chrome downloads available"; CfT is "a versioned binary that's as close to regular
  Chrome as possible" without auto-update. This is the shared reproducibility rationale and it
  validates the *pattern* of downloading a pinned browser for automation.

## The snap `/tmp` mechanism — triangulated three independent ways

Playwright #6485 traces it precisely: Playwright writes to `/tmp/playwright_testcase/`; snap
Chromium writes into `/tmp/snap.chromium/tmp/...` (root-only); downloads to `$HOME` succeed, to
`/tmp` fail. Maintainer: *"your snap/chromium does not have permissions to access `/tmp/`."* Same
mechanism as snapd #1972762 and the geckodriver `/tmp` profile bug → a tool's `/tmp` temp default
is the load-bearing problem.

## Honesty caveats (carry into any decision)

- The strongest explicit Playwright anti-snap quote is from 2021 (uncontradicted since, but not
  restated in 2024–2026).
- Some commonly-cited "snap failures" are misattributions: Playwright "Unable to open X display" is
  a headed-in-CI issue (not snap); Puppeteer #9197 white-screen is a CDP version mismatch from a
  non-matching *system* Chrome (the exact failure CfT pinning prevents), not snap.
- The Ubuntu 23.10+/24.04 AppArmor-userns "No usable sandbox!" failure (Puppeteer #12818, #13595)
  hits the *downloaded* browser too — it is snap-independent. Mitigation: `--no-sandbox`
  (documented headless-PDF tradeoff for trusted local HTML) or a host AppArmor profile.
- Edge case if the tool is itself launched from inside a snap (e.g. a snap-packaged editor's
  terminal): Firefox detects `SNAP_*` env vars and overrides profile prefs → headless hang
  (Playwright #20555, fixed 1.31; workaround: unset `SNAP_*` before spawning geckodriver).

## Net conclusion (as delivered by the research)

The agent's recommendation was that a general automation tool should NOT prefer the user's snap
Firefox and should keep a downloaded, pinned, checksum-verified browser as the cross-platform
default — the Puppeteer/Playwright/CfT pattern.

> **Project decision (md2pdf):** md2pdf is NOT advanced automation like Playwright/Puppeteer — it
> renders one local HTML to PDF. We therefore deliberately diverge from the "download your own
> browser" default and PREFER the user's already-installed browser via the proven snap-compatible
> recipe, so we don't force a ~280 MB browser download on the user. Chrome-for-Testing remains a
> last-resort fallback. See [../handling_the_browser_in_linux_KM.md](../handling_the_browser_in_linux_KM.md).

## Cross-platform safety (the load-bearing constraint)

Every snap/Linux change must be gated to `process.platform === 'linux'` (and a `/snap/` browser
path). macOS (`.app`) and Windows (`.exe`) keep `os.tmpdir()` and current driver args byte-for-byte.

## Sources

- microsoft/playwright #6485 (maintainer "can't recommend snap"; `/tmp/snap.chromium/tmp`) — https://github.com/microsoft/playwright/issues/6485
- microsoft/playwright #20555 (snap `SNAP_*` Firefox pref override; fixed 1.31) — https://github.com/microsoft/playwright/issues/20555
- microsoft/playwright #20533 (`channel:'chrome'` via Playwright installer, not snap) — https://github.com/microsoft/playwright/issues/20533
- Chrome for Testing announcement (Bynens, 2023-06-12) — https://developer.chrome.com/blog/chrome-for-testing
- Puppeteer #12818 (Ubuntu 24.04 no-usable-sandbox) — https://github.com/puppeteer/puppeteer/issues/12818
- Puppeteer #9197 (CDP version mismatch, not snap) — https://github.com/puppeteer/puppeteer/issues/9197
- Launchpad 1881040 / 1851250 / 1849371 — https://bugs.launchpad.net/bugs/1881040
