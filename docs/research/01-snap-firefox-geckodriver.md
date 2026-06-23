# Research: Driving snap Firefox + geckodriver headlessly to render a local `file://`

> Captured 2026-06-18. Source: parallel research agent (facet 1 of 4).
> Companion docs: [03-snap-confinement-file-access.md](03-snap-confinement-file-access.md),
> [02-snap-chromium-chromedriver.md](02-snap-chromium-chromedriver.md),
> [04-headless-pdf-tools-on-snap.md](04-headless-pdf-tools-on-snap.md).
> Synthesis & decision: [../handling_the_browser_in_linux_KM.md](../handling_the_browser_in_linux_KM.md).

## Research question

What is the current (2024–2026) canonical way to drive snap-packaged Firefox on Ubuntu
with geckodriver via the W3C WebDriver protocol, headlessly, to render a local `file://`
HTML document — without forcing the user to change their browser install?

## Empirically proven on the target machine (before research)

- Creating a WebDriver session with `moz:firefoxOptions.binary` set to the snap wrapper
  path (`/snap/bin/firefox`) FAILS: `"binary is not a Firefox executable"`.
- Creating a session with NO binary specified (let geckodriver auto-detect) SUCCEEDS.
- In that working session, navigating to `file:///tmp/...html` returns an EMPTY body
  (snap Firefox cannot read host `/tmp`), but `file://$HOME/...html` IS readable.

## Executive summary

Everything observed is documented, intended behavior — not a tool bug. Snap Firefox runs
in a private mount namespace with its own private `/tmp`, so host `/tmp` files are invisible;
the snap `home` interface grants read/write only to **non-hidden files under `$HOME`**.
geckodriver 0.37.0 already auto-detects snap Firefox and launches the in-container launcher,
which is why omitting `moz:firefoxOptions.binary` succeeds and passing `/snap/bin/firefox` fails.

The robust, zero-system-change fix is two code-side rules:
1. **Do not set the `binary` capability — let geckodriver auto-detect.**
2. **Write the temp HTML AND the geckodriver profile root under a non-hidden `$HOME` directory**,
   not `/tmp` (and not a dot-dir like `~/.cache`, which the `home` interface also excludes).

No apt/.deb reinstall, no `snap` reconfiguration, no `snap connect` — the Firefox snap ships
with the `home` interface auto-connected by default.

## Detailed findings

### (a) Why host `/tmp` is invisible to snap Firefox — HIGH confidence

- Strictly-confined snaps run in a private mount namespace. Mozilla's Ubuntu desktop engineer
  (oSoMoN): *"`/tmp` is private to each strictly-confined snap, the system-wide `/tmp` isn't
  visible in the snap's sandbox."*
- snapd uses `systemd-tmpfiles` to create `/tmp/snap-private-tmp/` at boot, then bind-mounts a
  per-snap private tmp (`/tmp/snap-private-tmp/snap.firefox/tmp`) over `/tmp` inside the snap's
  namespace. The fixed-name design was a deliberate hardening change.
- Same root cause as the known "Firefox snap can't download to `/tmp`" complaints; Firefox stages
  downloads in `~/Downloads/firefox.tmp/`.

**What snap Firefox CAN read — the `home` interface:**
- *"Access to non-hidden files owned by the user in the user's home (`$HOME`) directory."*
- **Hidden files/directories (dot-prefixed) are excluded by default** — `~/.cache`, `~/.local`,
  etc. are NOT covered. A temp file under a hidden dir behaves like `/tmp` (empty body).
- `/tmp` and `XDG_RUNTIME_DIR` are not covered by `home`.
- On Ubuntu the Firefox snap has `home` **auto-connected by default** — no `snap connect` needed.

### (b) Recommended code-side fix (ZERO system changes) — HIGH confidence

**Rule 1 — Omit the binary capability; let geckodriver auto-detect.**
geckodriver deduces the default Firefox location when the binary is left undefined; under snap
confinement it resolves to the in-container launcher. geckodriver 0.37.0 changelog: *"On Linux
Snap installations, geckodriver now launches Firefox using the direct binary path, improving
compatibility with containerized environments."* Do NOT send `moz:firefoxOptions.binary` for a
snap install.

**Rule 2 — Stage the HTML and profile under a non-hidden `$HOME` directory.**
Mozilla guidance: *"Set the `--profile-root` command line option to write the profile to a
directory accessible to both Firefox and geckodriver, for example a non-hidden directory under
`$HOME`."* The same constraint applies to the temp HTML file. Use e.g.
`$HOME/md2pdf-tmp/<uuid>/doc.html` (no leading dot anywhere in the path), and pass geckodriver
`--profile-root` pointing at a non-hidden `$HOME` dir. Navigate to `file://$HOME/...`.

**Detecting "this Firefox is a snap" in Node — Medium-High confidence:**
- Resolve the located Firefox path (`fs.realpathSync`). A snap resolves under `/snap/firefox/<rev>/...`.
  Practical heuristic: located path is `/snap/bin/firefox`, or its realpath contains `/snap/firefox/`.
- `TMPDIR`/`XDG_*` env overrides do NOT help — they cannot punch through the mount namespace.
  `/var/tmp` is sometimes cited but is not covered by `home` and is unreliable; the only
  documented, reliable target is a non-hidden `$HOME` path.

### (c) File-location requirements

| Location | Snap Firefox can read? | Use for md2pdf? |
|---|---|---|
| `/tmp/...` (host) | No — private namespace | Never |
| `/var/tmp/...` | Not via `home`; undocumented | No (unreliable) |
| `$HOME/.cache/...`, any dot-dir | No — hidden, excluded | No |
| `$HOME/<non-hidden>/...` | **Yes** (home auto-connected) | **Yes** |
| `XDG_RUNTIME_DIR`, removable media | No (different interfaces) | No |

Requirement: temp HTML **and** geckodriver `--profile-root` both under a non-hidden `$HOME` dir.

### (d) Binary-path issue confirmed — HIGH confidence

- `/snap/bin/firefox` is a symlink to `/usr/bin/snap`; snapd refuses to exec arbitrary
  `/snap/bin/` symlinks as a browser binary → `"binary is not a Firefox executable"`. The
  snap-correct launch entry is `/snap/firefox/current/firefox.launcher`.
- geckodriver checks for snap confinement and substitutes the default binary path with
  `/snap/firefox/current/firefox.launcher`.
- **Recommendation: omit `moz:firefoxOptions.binary` for snap.** If ever forced, the only valid
  value is `/snap/firefox/current/firefox.launcher` — never `/snap/bin/firefox`.

### Version compatibility

- Snap auto-detection first shipped in geckodriver 0.32.0 / Firefox 106. 0.37.0 retains and
  refines it. No version blocker.
- **Use the snap geckodriver (`/snap/bin/geckodriver`) with the snap Firefox** — they share the
  same container filesystem. Mozilla docs: *"It is critical to use this `geckodriver` path from
  under `/snap/bin` otherwise your GeckoDriver instance will NOT run under the correct Snap
  environment."*
- Anything pre-0.32.0 launches `/usr/bin/firefox` against a host-`/tmp` profile and hangs.

## Recommendations (for md2pdf)

1. Detect snap: resolve the located Firefox path; if `/snap/bin/firefox` or realpath under
   `/snap/firefox/`, enter "snap mode."
2. In snap mode: do not set `moz:firefoxOptions.binary`.
3. In snap mode: stage the temp HTML in a non-hidden `$HOME` subdir, pass geckodriver
   `--profile-root` to a non-hidden `$HOME` dir, navigate to `file://$HOME/...`, then clean up.
4. Keep using `/snap/bin/geckodriver` paired with the snap Firefox.
5. Gate the `$HOME` staging behind snap detection so non-snap installs keep using `/tmp`.

## Sources

- Mozilla geckodriver Usage docs — https://firefox-source-docs.mozilla.org/testing/geckodriver/Usage.html
- geckodriver 0.37.0 release notes — https://github.com/mozilla/geckodriver/releases/tag/v0.37.0
- Bugzilla 1769991 (geckodriver cannot launch Firefox from within snap) — https://bugzilla.mozilla.org/show_bug.cgi?id=1769991
- geckodriver issue 2010 — https://github.com/mozilla/geckodriver/issues/2010
- Selenium issue 15556 ("binary is not a Firefox executable", snap) — https://github.com/SeleniumHQ/selenium/issues/15556
- Snap home interface — https://snapcraft.io/docs/reference/interfaces/home-interface/
- snapcraft forum: Firefox snap no access to /tmp — https://forum.snapcraft.io/t/firefox-snap-no-access-to-gvfs-and-tmp/27253
- snapcraft forum: Firefox snap can not download to /tmp — https://forum.snapcraft.io/t/firefox-snap-can-not-download-to-tmp/31403
- canonical/snapd commit 21ebc51 (/tmp/snap-private-tmp) — https://github.com/canonical/snapd/commit/21ebc51f00b8a1417888faa2e83a372fd29d0f5e
- snapd bug 1972762 — https://bugs.launchpad.net/bugs/1972762
