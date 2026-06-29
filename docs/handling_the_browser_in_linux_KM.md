# Handling the Browser on Linux — Knowledge Memo (KM)

> Status: knowledge memo + decision record. Captured 2026-06-18.
> Backing research: [`research/01-snap-firefox-geckodriver.md`](research/01-snap-firefox-geckodriver.md),
> [`research/02-snap-chromium-chromedriver.md`](research/02-snap-chromium-chromedriver.md),
> [`research/03-snap-confinement-file-access.md`](research/03-snap-confinement-file-access.md),
> [`research/04-headless-pdf-tools-on-snap.md`](research/04-headless-pdf-tools-on-snap.md).

## 1. Why this memo exists

On a default Ubuntu desktop, `md2pdf README.md` fails with:

```
[render] Timed out while using temporary HTML
hint: Increase the render timeout above 30000ms or simplify the document.
```

The hint is misleading: the document is fine and more time does not help. There are **two
independent root causes**, plus a selection architecture that routes around the user's installed
browsers. This memo records what we learned so the next person does not re-derive it.

## 2. How md2pdf chooses a browser + driver (as built)

- `BrowserLocator` (`src/browserLocator.ts`) scans a fixed candidate list
  (`google-chrome → chromium → brave → firefox …`), and for each installed browser asks the
  `ArtifactPolicyDriverResolver` for a **verified, catalog-listed, on-disk** driver.
- It deliberately does **not** use drivers from `PATH` (README: *"md2pdf does not select arbitrary
  drivers from PATH"*). The driver must be a verified artifact in `artifacts.json` AND already
  present on disk and executable.
- If no installed browser has a ready verified driver, it falls back to the
  **`fallbackBrowserProvisioner`**, which downloads a pinned, checksum-verified
  **Chrome-for-Testing + chromedriver** bundle into `~/.cache/md2pdf/…`.

On a default Ubuntu box this means: chromium/brave need `chromedriver` (absent) and Firefox's
`geckodriver` is in the catalog but never provisioned → every installed browser resolves to
"no driver" → md2pdf downloads Chrome-for-Testing.

## 3. Root cause A — the provisioned Chrome crashes (executable-bit bug)

The fallback provisioner unzips Chrome-for-Testing with `fflate` (which does not preserve Unix
executable bits) and then restores `+x` on **only** the main `chrome` and `chromedriver`. Its
helper-bit restorer, `chmodAppBundleContents` in `src/fallbackBrowserProvisioner.ts`, is
**macOS-only**:

```js
const match = /^(.+\.app)\//u.exec(browserPath);
if (match === null) return;          // Linux path .../chrome-linux64/chrome → returns, chmods nothing
```

So on Linux, helper binaries (notably `chrome_crashpad_handler`) stay non-executable. On headless
launch Chrome does `posix_spawn chrome_crashpad_handler` → `Permission denied (13)` → **SIGABRT**.
chromedriver waits for a session that never comes → the 30 s render budget expires.

**Verified fix:** restoring `+x` on the helper binaries makes `md2pdf README.md` succeed and emit a
PDF. The code fix generalizes `chmodAppBundleContents` so it restores `+x` on the whole extracted
bundle on Linux (and Windows is a no-op — no exec bit). This is needed regardless of the browser
decision, because Chrome-for-Testing is the fallback.

## 4. Root cause B — snap confinement and the temp HTML in `/tmp`

On modern Ubuntu, the installed browsers (Firefox, Chromium, Brave) are **snaps**, even when
reached via `/usr/bin/firefox` (a shim). Snap strict confinement means:

- **Private `/tmp`.** Each snap gets its own `/tmp` (bind-mounted to
  `/tmp/snap-private-tmp/snap.<name>/tmp`). A file md2pdf writes to host `/tmp` is **invisible** to
  the snap browser. `TMPDIR`/`XDG_*` cannot change this — it is below the env layer.
- **`home` interface.** A confined browser can read only **non-hidden files under the real `$HOME`**
  (auto-connected on desktop Ubuntu, no `snap connect` needed). Dot-dirs (`~/.cache`, `~/.config`,
  `~/.local`) are **excluded** — same as `/tmp`.

md2pdf writes the temp HTML to `os.tmpdir()` (→ `/tmp`). A snap browser navigates to
`file:///tmp/...`, sees an empty page, and the render hangs. **Empirically proven** here: snap
Firefox read a `$HOME` file but not a `/tmp` file.

Note Chrome-for-Testing is **not** a snap, so it reads `/tmp` fine — which is why fixing root cause
A alone makes the Chrome path work without touching the temp location.

## 5. Proven recipes (what actually works on snap)

### Firefox (the viable system-browser path)
- **Omit `moz:firefoxOptions.binary`.** geckodriver 0.37.0 auto-detects snap Firefox and launches
  `/snap/firefox/current/firefox.launcher`. Passing `/snap/bin/firefox` (a symlink to
  `/usr/bin/snap`) fails with `"binary is not a Firefox executable"`.
- **Stage temp HTML AND geckodriver `--profile-root` under a non-hidden `$HOME` dir** (e.g.
  `~/md2pdf-tmp/<uuid>/`). No leading-dot component anywhere.
- **Use `/snap/bin/geckodriver`** (shares the snap namespace with snap Firefox).
- Verified here: with auto-detect + a `$HOME` file, snap Firefox renders; with a `/tmp` file it does not.

### Chromium (NOT viable with md2pdf's model)
- Snap Chromium can only be driven by its **own** bundled `/snap/bin/chromium.chromedriver`
  (same namespace). md2pdf's **downloaded** chromedriver cannot drive snap Chromium (namespace
  mismatch + version drift), and the snap driver is a symlink to `/usr/bin/snap` that breaks
  naive WebDriver bindings (`unknown flag 'port'`). So Chromium is not a system-browser option for
  md2pdf — fall through to Chrome-for-Testing.

## 6. Ecosystem context (and where we diverge)

Mature automation frameworks **avoid** system snap browsers and download their own pinned browser
(Playwright explicitly "won't fix" snap and does not support a system Firefox; Puppeteer downloads
its own; Chrome-for-Testing exists for pinned, reproducible automation). md2pdf's
download-Chrome-for-Testing fallback follows that pattern.

**Project decision:** md2pdf is **not** advanced automation like Playwright/Puppeteer — it renders
one local HTML file to PDF. The simple use case does not justify forcing a ~280 MB browser
download on a user who already has a working browser. We therefore **prefer the user's installed
browser** (Firefox, via geckodriver) using the proven snap-compatible recipe, and keep
Chrome-for-Testing as a **last-resort fallback** for when no usable system browser+driver exists or
the system browser is broken.

Tradeoff acknowledged: the research rates "prefer the system snap browser" as less reliable than a
pinned download for *general* automation. We accept that for md2pdf's narrow use case, mitigated by
(a) the Chrome-for-Testing fallback and (b) gating all snap behavior to Linux only.

## 7. Implementation plan (chosen direction)

All changes are code-side in md2pdf — **nothing is installed or changed on the user's system**, and
**macOS/Windows behavior is unchanged** (every snap/Linux branch is gated on
`process.platform === 'linux'` + a `/snap/` browser path; mac/Win keep `os.tmpdir()` and current
driver args).

1. **Fix the chmod bug** — `fallbackBrowserProvisioner.ts`: restore `+x` on the whole extracted
   bundle on Linux, not just macOS `.app`. (Needed for the Chrome fallback; standalone, low-risk.)
2. **Prefer Firefox** — `browserLocator.ts`: order Firefox ahead of Chromium/Brave so the user's
   installed Firefox is chosen first.
3. **Provision geckodriver** — make the catalog's verified geckodriver available on disk so
   `resolveDriver(firefox)` succeeds (small ~MB driver download, not a 280 MB browser).
4. **Snap-aware Firefox launch** — `webDriverClient.ts`/`webDriverSession.ts`: when the located
   Firefox is a snap, omit `moz:firefoxOptions.binary` and pass `--profile-root` under a non-hidden
   `$HOME` dir.
5. **Snap-aware temp location** — `markdownRenderer.ts`/`converter.ts` (`tempDir` is already
   injectable): on Linux with a snap browser, write temp HTML to a non-hidden `$HOME` dir.
6. **Fallback to Chrome if Firefox is absent or broken** — `converter.ts`: if Firefox selection or
   render fails, provision+use the (chmod-fixed) Chrome-for-Testing.
7. **Tests** — snap-detection unit tests; an integration test that renders a `file://` fixture under
   `$HOME` to a non-empty PDF when a snap browser is present.

## 8. Snap detection signal

Resolve the located browser path; treat it as a snap when the path is `/snap/bin/<browser>` or its
`realpath` is under `/snap/<name>/`. Equivalent: the `SNAP` env var (only when md2pdf itself runs
inside a snap — in that case also unset `SNAP_*` before spawning geckodriver, per Playwright
#20555).

## 9. Quick reference

| Symptom | Cause | Fix |
|---|---|---|
| `Timed out while using temporary HTML`, Chrome-for-Testing engine | helper binaries not `+x` (Linux chmod gap) → Chrome SIGABRT | generalize `chmodAppBundleContents` to Linux |
| Same timeout, snap Firefox engine | snap can't read `/tmp` temp HTML | write temp HTML + `--profile-root` under non-hidden `$HOME` |
| `binary is not a Firefox executable` | passed `/snap/bin/firefox` to geckodriver | omit `binary`; let geckodriver auto-detect |
| `unknown flag 'port'` | snap `chromium.chromedriver` symlinks to `/usr/bin/snap` | don't drive snap Chromium with md2pdf's model; use Firefox or Chrome-for-Testing |
| Empty body when reading `~/.cache/...` | dot-dir excluded by snap `home` interface | use a non-hidden `$HOME` subdir |
