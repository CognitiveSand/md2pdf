# Research: Snap/AppArmor confinement and `file://` access for automation

> Captured 2026-06-18. Source: parallel research agent (facet 3 of 4).
> Companion docs: [01-snap-firefox-geckodriver.md](01-snap-firefox-geckodriver.md),
> [02-snap-chromium-chromedriver.md](02-snap-chromium-chromedriver.md),
> [04-headless-pdf-tools-on-snap.md](04-headless-pdf-tools-on-snap.md).
> Synthesis & decision: [../handling_the_browser_in_linux_KM.md](../handling_the_browser_in_linux_KM.md).

## Research question

How does snap (snapd/AppArmor) confinement govern a confined browser's ability to read local
`file://` files on Ubuntu (2024–2026), for headless automation that renders a locally-generated
temporary HTML file?

## Executive summary

For a strictly-confined snap browser (default Firefox/Chromium packaging on Ubuntu 22.04–25.10+),
the only host location an **external, non-snap process can write to AND the snap browser can then
read via `file://` with zero reconfiguration** is a **non-hidden subdirectory of the real `$HOME`**
(e.g. `~/md2pdf-tmp/` works; `~/.md2pdf-tmp/` does not — it's hidden). Granted by the `home`
interface, which is auto-connected on classic/desktop Ubuntu (no `snap connect`).

`/tmp` cannot be used: each strictly-confined snap runs in its own mount namespace where `/tmp` is
bind-mounted to a per-snap private directory (`/tmp/snap-private-tmp/snap.<name>/tmp`). A host
`/tmp` file is invisible inside the snap, and this is unchangeable from outside — `TMPDIR`/`XDG_*`
do not move the namespace mount. Long-standing, intentional, current (mechanism ~2019, hardened
late 2022).

## Detailed findings

### Q1 — Private `/tmp` namespace — HIGH confidence

- `snap-confine` creates a per-invocation private mount namespace and bind-mounts a per-snap
  directory onto `/tmp`. A host-written `/tmp` file is invisible inside the snap.
- snapd team (Miguel Pires): *"Snaps don't have full access to it by default, but they do have
  separate spaces under it (`/tmp/snap.<snap_name>/tmp/`)."*
- History: fixed path in PR #6614 (2019); relocated under a root-owned base dir in commit 21ebc51
  (late 2022). Current layout `/tmp/snap-private-tmp/snap.<instance>/tmp`.
- Still current and intentional — the related TMPDIR bug (1999109) was closed **Invalid**.

### Q2 — The `home` interface and dot-dir exclusion — HIGH confidence

- Grants **read/write to non-hidden files owned by the user in real `$HOME`**; **auto-connected on
  traditional/desktop distributions** (works on existing browser snaps, no user action).
- Docs verbatim: *"allows access to non-hidden files owned by the user in the user's home ($HOME)
  directory."*
- **Hidden files/dirs excluded by default**: `~/.config`, `~/.cache`, `~/.local`, any leading-dot
  component → NOT readable. jdstrand rationale: *"hidden folders are more likely to contain
  sensitive information."* The rule is about leading-dot components **anywhere in the path**.
- `personal-files`/`system-files` CAN reach hidden dirs but are NOT a solution: not auto-connected,
  super-privileged, must be declared by the snap publisher in `snapcraft.yaml` with an approved
  store declaration — an end user cannot grant them to a third-party browser snap.

### Q3 — Other readable host locations — HIGH confidence

| Location | Snap reads via `file://`? | External process can write? | Exchange dir? |
|---|---|---|---|
| Host `/tmp` | No (private ns) | Yes | **No** |
| Non-hidden `$HOME/<dir>/file.html` | **Yes** (home, auto) | **Yes** | **Yes — recommended** |
| `~/.cache`, `~/.config`, any dot-path | No (hidden) | Yes | No |
| `$SNAP_USER_COMMON` = `~/snap/<browser>/common` | Yes | Yes (user-owned) | Fragile (name-coupled) |
| `$SNAP_USER_DATA` = `~/snap/<browser>/<rev>` | Yes | Yes | Fragile (revision churn) |
| `$XDG_RUNTIME_DIR` | Remapped per-snap | Restricted | No |
| `/media`, `/mnt` | Via `removable-media` | Yes | **No** — not auto-connected |

### Q4 — THE canonical recommendation — HIGH confidence

**Write the temp HTML to a non-hidden subdirectory of the real `$HOME`.** snapd security team
(jdstrand) verbatim: the supported path is *"plugging the home interface and picking a
non-hidden-toplevel directory."* There is **no** way to make `/tmp` work without reconfig — the
private `/tmp` is a mount-namespace property; confirmed by-design (bug 1999109).

### Q5 — Does `TMPDIR`/`XDG_*` help? — HIGH confidence

No — irrelevant due to the namespace; the snap still resolves `/tmp` to its private mount
regardless of `TMPDIR`. Setting `TMPDIR` to a non-hidden `$HOME` subdir IS effective, but only
because that target is independently reachable through the `home` interface.

## Recommended code-only fix

1. On Linux, do not write temp HTML under `os.tmpdir()` (`/tmp`); write to a non-hidden dir under
   the real home, e.g. `path.join(os.homedir(), 'md2pdf-tmp', <uuid>.html)`. Guard against any
   dot-prefixed component.
2. Pass that non-hidden `$HOME` path as the `file://` URL; create/clean the dir yourself.
3. Keep `os.tmpdir()` for non-Linux (macOS/Windows have no snap confinement) — or use the `$HOME`
   path everywhere (KISS).
4. Optional: scope to snap browsers (path under `/snap/`, env `SNAP`), but `~/<non-hidden>/` is
   safe for non-snap browsers too, so unconditional on Linux is acceptable.
5. Avoid `$SNAP_USER_COMMON`/`$SNAP_USER_DATA` (couple to snap name/revision) and `removable-media`.

## Sources

- home interface — https://snapcraft.io/docs/reference/interfaces/home-interface/
- personal-files interface — https://snapcraft.io/docs/reference/interfaces/personal-files-interface/
- Launchpad 1972762 (snaps preventing apps opening local files) — https://bugs.launchpad.net/bugs/1972762
- Launchpad 1999109 (TMPDIR for confined snaps; Invalid/by-design) — https://bugs.launchpad.net/snapd/+bug/1999109
- forum: "Can browsers open local files?" — https://forum.snapcraft.io/t/can-browsers-open-local-files/3016
- snapd PR #6614 — https://github.com/snapcore/snapd/pull/6614 ; commit 21ebc51 — https://github.com/canonical/snapd/commit/21ebc51f00b8a1417888faa2e83a372fd29d0f5e
- Canonical blog "Hey snap, where's my data?" — https://ubuntu.com/blog/hey-snap-wheres-my-data
- marp-cli #201 (`--allow-local-files` fails on chromium snap) — https://github.com/marp-team/marp-cli/issues/201
