# Research: Driving snap Chromium via chromedriver to render a local `file://`

> Captured 2026-06-18. Source: parallel research agent (facet 2 of 4).
> Companion docs: [01-snap-firefox-geckodriver.md](01-snap-firefox-geckodriver.md),
> [03-snap-confinement-file-access.md](03-snap-confinement-file-access.md),
> [04-headless-pdf-tools-on-snap.md](04-headless-pdf-tools-on-snap.md).
> Synthesis & decision: [../handling_the_browser_in_linux_KM.md](../handling_the_browser_in_linux_KM.md).

## Research question

Current (2024–2026) canonical way to drive snap-packaged Chromium on Ubuntu with chromedriver
via W3C WebDriver, headlessly, to render a local `file://` HTML and print to PDF — without
changing the user's install.

## Executive summary

The Ubuntu Chromium snap (the only Chromium on modern Ubuntu — the apt package is a transitional
shim to the `canonical` snap) **ships its own matched chromedriver** at
`/snap/bin/chromium.chromedriver`. That bundled driver runs **inside the same snap confinement
and private mount namespace** as the browser, so driver and browser share one filesystem view.
An external (e.g. Chrome-for-Testing) chromedriver does NOT enter that namespace and is the wrong
tool — paths and the private `/tmp` would not line up, and versions would drift.

Writing the temp HTML and the `--user-data-dir` profile to host `/tmp` **cannot work** with the
snap (private `/tmp`, the host `/tmp` is invisible). The snap's only host-filesystem window is the
`home` interface — non-hidden files/dirs under `$HOME` (plus `/media`, `/mnt`). Hidden paths
(`.cache`, `.config`, `.local`) are excluded; `/tmp` is not covered.

Zero-system-change fix (all code-side): (1) use `/snap/bin/chromium.chromedriver` (never an
external driver); (2) work around the symlink-canonicalization bug; (3) relocate temp HTML +
`--user-data-dir` from `/tmp` to a non-hidden `$HOME` dir; (4) pass robust headless flags.

## Detailed findings

### 1. Snap ships its own chromedriver — HIGH confidence

- Bundled at `/snap/bin/chromium.chromedriver`; Canonical states it was "patched so that existing
  selenium scripts should keep working without modifications."
- It runs through the snap launcher → same `snap.chromium` confinement and namespace as the
  browser → identical filesystem view (same private `/tmp`, same `home` window). Community guidance:
  *"use the `/snap/bin/chromium.chromedriver` binary and not download it from elsewhere, since the
  snap sandboxing mechanism won't work when just downloading that binary."*
- **Version-matching is automatic** because the driver ships with the snap revision.

### 2. Snap Chromium cannot read host `file:///tmp/...` — HIGH confidence

- Host `/tmp` is invisible (private namespace → `/tmp/snap-private-tmp/snap.chromium/tmp`, mode 700).
- `home` interface = non-hidden files under real `$HOME`. Maintainer Olivier Tilloy: *"the app
  isn't allowed to see files on the host system, except for non-hidden files and folders under
  `$HOME` and `/mnt` and `/media`."*
- Hidden-dir exclusion is real: `~/.cache/...`, `~/.config/...`, any dot-component → AppArmor-denied.
- `--user-data-dir` must live in a non-hidden `$HOME` dir (or `~/snap/chromium/common/...`); `/tmp`
  fails (private, mode 700); dot-dirs fail (hidden).

### 3. Recommended robust approach — ZERO user-system changes — HIGH confidence

1. **Use the snap's own binaries**: driver `/snap/bin/chromium.chromedriver`, browser `/snap/bin/chromium`.
2. **Defeat symlink canonicalization** (see §4): if the WebDriver binding resolves the driver
   symlink to `/usr/bin/snap`, it invokes `snap` with chromedriver flags → `unknown flag 'port'`.
   Use the literal path / a tiny non-symlink wrapper that `exec`s the snap driver.
3. **Relocate temp HTML + profile** to a non-hidden dir under real `$HOME` (no leading dot anywhere).
4. **Launch flags**: `--headless=new`, `--no-sandbox`, `--disable-dev-shm-usage`,
   `--user-data-dir=<non-hidden $HOME dir>`. Render via the W3C "Print Page" command or CDP
   `Page.printToPDF`. Do not manually set `--remote-debugging-port`.

### 4. Known pitfalls — HIGH confidence

- **Symlink → `/usr/bin/snap` → `unknown flag 'port'`** (Selenium #10969, #7788): the #1 failure mode.
- **Version mismatch** with an external chromedriver → "only supports Chrome version N"; bundled
  driver is version-locked → problem vanishes.
- **`--remote-debugging-port`/`--pipe`**: let chromedriver own the transport. Chrome/Chromium ≥136
  ignore these against the default profile — they "must now be accompanied by the `--user-data-dir`
  switch to point to a non-standard directory." (You already pass `--user-data-dir`, so this is covered.)
- **`chrome_crashpad_handler` permission/AppArmor denial**: usually non-fatal noise; when it crashes
  it is almost always a symptom of an unwritable profile/`/tmp` — fixing the path placement resolves it.
  Can silence with `--disable-crash-reporter` / `--no-crashpad`.

## Recommendations (for md2pdf)

1. Replace `os.tmpdir()` with a non-hidden dir under `os.homedir()` for both the HTML file and the
   profile dir; guard against any dot-prefixed component; clean up after.
2. Detect snap: if `/snap/bin/chromium` exists and no host `chromedriver` is on PATH, use
   `/snap/bin/chromium.chromedriver` + `/snap/bin/chromium`.
3. Prevent symlink canonicalization of the driver path (or ship a project-local non-symlink wrapper).
4. Pass `--headless=new --no-sandbox --disable-dev-shm-usage --user-data-dir=<non-hidden $HOME dir>`;
   do not manually set `--remote-debugging-port`.
5. Add an integration test: when `/snap/bin/chromium` is present, render a `file://` fixture under
   `$HOME` to PDF and assert a non-empty PDF.

> Note for md2pdf specifically: md2pdf's verified-artifact architecture downloads its OWN
> chromedriver. That downloaded driver **cannot** drive snap Chromium (namespace mismatch). So
> "prefer snap Chromium" is not viable with md2pdf's current driver model — see the KM doc decision.

## Sources

- Chromium in Ubuntu – deb to snap transition (Canonical) — https://canonical.com/blog/chromium-in-ubuntu-deb-to-snap-transition
- The home interface — https://snapcraft.io/docs/home-interface (forum mirror https://forum.snapcraft.io/t/the-home-interface/7838)
- Launchpad 1851250 (chromium snap cannot upload files outside $HOME) — https://bugs.launchpad.net/bugs/1851250
- Launchpad 1881040 (chromedriver does not download where configured) — https://bugs.launchpad.net/bugs/1881040
- Launchpad 1888674 (chromium doesn't launch with --user-data-dir) — https://bugs.launchpad.net/bugs/1888674
- snapcraft forum: Ubuntu Chromium where is my /tmp — https://forum.snapcraft.io/t/ubuntu-chromium-where-is-my-tmp-directory/14862
- Selenium #10969 ("unknown flag port") — https://github.com/SeleniumHQ/selenium/issues/10969
- Selenium #7788 (Chromium snap not working with chromedriver) — https://github.com/SeleniumHQ/selenium/issues/7788
- Chrome for Developers: remote debugging switches (Chrome 136) — https://developer.chrome.com/blog/remote-debugging-port
- titusfortner/webdrivers #217 / #230 — https://github.com/titusfortner/webdrivers/issues/217
