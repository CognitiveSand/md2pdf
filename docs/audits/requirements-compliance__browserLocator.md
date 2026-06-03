# Requirements Compliance Findings: browserLocator.ts

**Audit Date:** 2026-06-03
**File(s) Audited:** `/home/me/github/md2pdf/src/browserLocator.ts`
**Supporting docs reviewed:** `docs/project_requirements.md`, `docs/architecture.md` (§5 component table, §3, §11, §14), `src/driverProvisioner.ts`, `src/errors.ts`, `tests/unit/browserLocator.test.ts`
**Auditor:** Requirements Compliance Auditor Agent
**Scope:** READ-ONLY forensic audit. No remediation performed; findings are evidenced, not fixed.

## Executive Summary

`browserLocator.ts` implements the `BrowserLocator` component that architecture.md §5 binds to **FR-19** (user-scope, no-sudo install) and **NFR-03** (platform portability). It detects an installed Chromium-family or Firefox browser across darwin/win32/linux, resolves the snap-Firefox wrapper case (architecture R-1), and resolves/provisions the matching WebDriver. Core detection logic is sound and well-tested at the unit level.

The principal compliance defects are: (1) the module supports a **narrower browser set than the architecture promises** — architecture §3 and §11 advertise Chrome/Edge/Brave/Chromium, but the code only ever detects Chrome, Chromium, and Firefox, with **no Edge or Brave candidate paths and no `'edge'`/`'brave'` `BrowserKind`** (untraceable/contradiction); (2) **zero requirement traceability tags** exist anywhere in the source or tests, directly violating the traceability discipline mandated by project_requirements.md §10 and architecture.md §15; (3) the **NFR-03 Linux portability path is incomplete** — Linux candidate paths omit common real-world locations (`/snap/bin/chromium`, flatpak, `/usr/bin/microsoft-edge`, `/usr/bin/brave-browser`), and the architecture's own "Chromium-for-Testing last-resort" browser provisioning (ADR-05, §11) is **entirely absent** from `locateBrowser`. These are gaps against stated capability, not crashes.

- **Requirements relevant to this file:** FR-19, NFR-03, NFR-02, NFR-05 (boundary), plus CON-01/CON-03 (platform floor)
- **Requirements fully met:** 1 (CON-03)
- **Requirements partially met:** 3 (FR-19, NFR-03, NFR-02)
- **Requirements untraceable / contradicted by code:** Edge/Brave support claim (architecture §3/§11), ADR-05 last-resort browser provisioning
- **Missing requirement references (tags):** 100% — no `@req`/FR/NFR tag in the file or its tests
- **Compliance posture:** Partial. No critical functional break for the documented common case; multiple medium gaps against advertised capability and a high-severity traceability gap.

## Requirement Coverage Matrix

| Requirement ID | Description | Referenced (tag) | Implemented | Status |
|----------------|-------------|------------------|-------------|--------|
| FR-19 | User-scope install without elevation | No | Partial — per-user driver cache (`~/.cache`), no-sudo; but PATH `which`/`where` + provision flow is the install-time runtime path | Partial |
| NFR-03 | Single-file conversion on Linux/macOS/Windows, Node 20+ | No | Partial — three platform candidate tables present; Linux set incomplete; Windows env-var fallbacks present | Partial |
| NFR-02 | No outbound network during conversion | No | Partial — `locateDriver` step 3 triggers a network download (`provisionDriver`) which is a provisioning, not conversion, action; boundary is ambiguous and untagged | Partial |
| NFR-05 | Newest eligible artifact after 7-day quarantine | No | Delegated — quarantine enforced in `driverProvisioner.ts`/`releaseCatalog.ts`, not here; comment line 294 asserts it but no tag | Delegated/Untagged |
| CON-01 | Node.js 20+ | No | Met — uses Node-20 built-ins (`node:child_process`, `node:os`); no incompatible API | Met (implicit) |
| CON-03 | No TeX/LaTeX required | n/a | Met — file has no LaTeX dependency | Met |
| Architecture §3/§11 | Support Chrome / Edge / Brave / Chromium | No | NOT implemented — no Edge/Brave kind or path | Contradiction |
| Architecture ADR-05/§11 | Provision Chromium-for-Testing browser as last resort | No | NOT implemented in this module | Missing |

## Detailed Findings

### ✅ Compliant / Acceptable

#### CON-01 / CON-03: Platform floor and no-LaTeX
- **Status:** Met (implicit).
- **Evidence:** Imports are all Node built-ins (`node:child_process`, `node:fs`, `node:os`, `node:path`, lines 1-4) plus internal modules; nothing requires a TeX toolchain. `process.env['PROGRAMFILES(X86)']`, `AbortSignal`-free here, and the use of `??` (lines 64-104) are all Node 20-safe.
- **Note:** Compliance is incidental, not asserted by any tag.

#### FR-19 (no-sudo, per-user cache) — partial credit
- **Status:** Met for the cache location.
- **Evidence:** `driverCacheDir()` (lines 249-251) returns `join(homedir(), '.cache', 'md2pdf', 'drivers')` — a per-user, unprivileged path, consistent with architecture §11 "per-user cache, no sudo." No write to a system path occurs in this module.

#### Snap-Firefox resolution (architecture R-1)
- **Status:** Implemented as the architecture's §5 / R-1 mitigation demands.
- **Evidence:** `resolveSnapFirefox()` (lines 161-175) resolves the real binary `/snap/firefox/current/usr/lib/firefox/firefox` (line 165) ahead of the `/snap/bin/firefox` wrapper, matching R-1's stated requirement (architecture lines 304-308). This is a genuine compliance strength.

### ⚠️ Partial Compliance

#### NFR-03: Platform portability — Linux candidate set is incomplete
- **Status:** Partially Compliant.
- **Issue:** NFR-03 requires conversion on "Linux, macOS, and Windows hosts." The Linux table omits widely-deployed install locations, so a host with only a snap Chromium, a flatpak browser, Edge, or Brave will fail detection and fall through to `BrowserNotFoundError` even though a usable browser exists.
- **Location:** `CANDIDATES_LINUX`, lines 51-58:
  ```ts
  const CANDIDATES_LINUX: BrowserCandidate[] = [
    { kind: 'chrome', path: '/usr/bin/google-chrome' },
    { kind: 'chrome', path: '/usr/bin/google-chrome-stable' },
    { kind: 'chromium', path: '/usr/bin/chromium-browser' },
    { kind: 'chromium', path: '/usr/bin/chromium' },
    { kind: 'firefox', path: '/usr/bin/firefox' },
    // Snap paths are handled separately below
  ];
  ```
  Missing: `/snap/bin/chromium`, flatpak paths (`/var/lib/flatpak/exports/bin/...`), `/usr/bin/microsoft-edge`, `/usr/bin/brave-browser`. Note the inline comment "Snap paths are handled separately below" (line 57) is only true for **Firefox** (`resolveSnapFirefox`, lines 161-175); snap **Chromium** is not handled anywhere, making the comment misleading.
- **Impact:** Reduced portability surface against an explicitly-stated NFR.

#### NFR-03: macOS/Windows browser-kind coverage narrower than the conversion contract
- **Status:** Partially Compliant.
- **Issue:** The `MD2PDF_BROWSER` override infers kind purely from a substring of the path (lines 192-193):
  ```ts
  const lower = override.toLowerCase();
  const kind: BrowserKind = lower.includes('firefox') ? 'firefox' : 'chrome';
  ```
  Any non-firefox path is labeled `'chrome'`. A user who points `MD2PDF_BROWSER` at a real `chromium`, `edge`, or `brave` binary will have it driven as `kind: 'chrome'` → `chromedriver` (via `locateDriver`, lines 277-278). For Chromium-family that happens to work, but the kind label is factually wrong and would mis-route any future driver logic. This is a fail-soft that silently misclassifies — counter to the "fail loud" guidance the architecture invokes (§8).

#### NFR-02 / NFR-05: network-touching provisioning embedded in `locateDriver`, untagged and unbounded by an offline guard
- **Status:** Partially Compliant / Ambiguous boundary.
- **Issue:** `locateDriver` step 3 calls `await provisioner(kind, browser.version, cacheDir)` (line 295), which (default `provisionDriver`) performs live HTTP fetches. NFR-02 forbids outbound connections "during conversion." Provisioning is arguably a first-run setup step, not conversion — but **nothing in this module distinguishes the two**, and there is no offline/air-gapped guard or opt-out. A first conversion on a host without a cached driver will open the network. The architecture (§9, R-3) treats local-only as a structural guarantee; this module is a hole in that structure with no tag pointing back to NFR-02 to flag the deliberate exception.
- **Location:** lines 294-296. Comment "quarantine enforced inside" (line 294) is the only nod to NFR-05 and is an unverifiable in-code assertion, not a traceable tag.

#### FR-19: PATH search uses a shell command string, narrowing portability of the install/runtime path
- **Status:** Partially Compliant (robustness concern, not a hard break).
- **Issue:** `findBinaryInPath` (lines 235-246) shells out via `execSync` with an interpolated command string:
  ```ts
  const cmd = platform() === 'win32' ? `where "${name}"` : `which "${name}"`;
  ```
  `which` is not guaranteed present on every POSIX host (minimal containers omit it); `where` behaves differently across Windows shells. `name` is an internal constant (`'chromedriver'`/`'geckodriver'`) so this is not an injection risk today, but using `execSync` with a string command (vs `execFileSync` with an arg array, as the rest of the file correctly does at lines 126 and 140) is the weaker, less-portable choice against NFR-03's three-OS promise.

### ❌ Non-Compliant / Missing / Contradiction

#### CONTRADICTION: architecture advertises Edge and Brave; code supports neither
- **Status:** Contradiction between governing architecture doc and implementation.
- **Expected:** architecture.md §3 (line 41): "Both browser families are supported: Chromium-family (**Chrome / Edge / Brave / Chromium**) via `chromedriver`, and Firefox via `geckodriver`." Reinforced by the §8 `BrowserNotFoundError` guidance and §11.
- **Actual:** `BrowserKind` (line 8) is `'chrome' | 'chromium' | 'firefox'` — **no `'edge'`, no `'brave'`.** No candidate path in `CANDIDATES_DARWIN` (37-49), `CANDIDATES_LINUX` (51-58), or `CANDIDATES_WIN32` (60-107) targets Edge or Brave (no `msedge.exe`, no `Microsoft\Edge`, no `BraveSoftware`, no `brave-browser`). The `BrowserNotFoundError` message (`errors.ts` lines 34-46) likewise lists only Chrome/Chromium/Firefox, confirming the code's narrower intent — but it directly contradicts architecture §3's claim. A user with only Edge or Brave installed gets `BrowserNotFoundError` despite the architecture promising support.
- **Severity rationale:** High — a named-and-bolded architecture capability is not delivered, and the requirement-governing doc (architecture wins over impl per its own §1) makes the code the defect.

#### MISSING: ADR-05 last-resort browser provisioning absent from this module
- **Status:** Not Implemented (in the component the architecture assigns it to).
- **Expected:** architecture ADR-05 (lines 289-297) and §11 (lines 208-210): "If no browser is found, md2pdf reports clearly and, as a last resort, can provision a Chromium-for-Testing build plus its chromedriver into the per-user cache." §5 binds browser detection to `browserLocator.ts`.
- **Actual:** `locateBrowser()` (lines 210-229) throws `BrowserNotFoundError` immediately when no candidate exists (line 228), with no last-resort browser-provisioning branch. `driverProvisioner.ts` provisions **drivers** only, not browsers. The advertised fallback exists nowhere in the code path this module owns. R-1's mitigation "last-resort Chromium-for-Testing download" is therefore unfulfilled.
- **Severity rationale:** Medium — it is a documented fallback, not the common case; but it is a stated mitigation for the real "host has no browser" risk (R-1) and is wholly missing.

#### MISSING TRACEABILITY: no requirement tags in the module or its tests
- **Status:** Non-Compliant with the project's own traceability mandate.
- **Expected:** project_requirements.md §10 (lines 148-153): "Downward traceability to verification evidence is to be maintained by tagging each test with its requirement ID (for example `@req FR-08`)." architecture.md §15 (line 343): "Each test is tagged with its requirement ID so the traceability matrix is generated from the suite."
- **Actual:** A repo-wide search (`grep -rn "@req\|FR-\|NFR-\|CON-" src/`) returns **zero matches** in `src/`. `tests/unit/browserLocator.test.ts` contains **no `@req` tag** on any of its 11 `it(...)` cases (lines 51-182), despite directly exercising FR-19 (cache dir, line 154-159) and NFR-03 (per-platform detection, lines 98-108). The traceability matrix the docs promise to generate from the suite cannot be generated.
- **Severity rationale:** High — it is a blanket failure of an explicit, document-level requirement (§10, §15) and undermines verifiability of every other finding's "is this tested?" question.

#### Md2pdfError vs Md2PdfError naming divergence (cross-file, surfaces via this module's error import)
- **Status:** Minor contradiction (informational; root cause outside the audited file).
- **Evidence:** `browserLocator.ts` line 6 imports `BrowserNotFoundError` from `./errors.js`; `errors.ts` defines the root as `Md2PdfError` (capital P, line 1), whereas architecture §5/§8 (lines 110, 152) name it `Md2pdfError` (lowercase p). The audited file is correct against the actual code, but the doc-vs-code casing mismatch is noted for completeness as it touches this module's dependency.

## Coding Convention / Quality Observations (non-requirement, for context)

- **Duplicated version helper.** `getBrowserVersion` (124-136) and `getDriverVersion` (138-150) are byte-identical except their names. DRY violation; both swallow all errors into `'0.0.0'` (lines 133-135, 147-149), a fail-soft that hides a genuinely broken/incompatible binary — at odds with the architecture's "fail loud" stance (§8). Not a requirement breach, but it can mask the version-lockstep risk R-1 is meant to surface.
- **Silent `'0.0.0'` version on failure feeds `locateDriver`.** A `'0.0.0'` browser version (line 132/146 fallback) flows into `provisionDriver(kind, browser.version, ...)` (line 295) → `parseInt('0',10)` major 0 → no matching driver release. The failure mode is opaque, not loud.
- **Dead/unsupported breadth in `BrowserKind` vs paths** already covered under the Edge/Brave contradiction.

## Findings Index (severity)

| # | Finding | Severity |
|---|---------|----------|
| 1 | Edge/Brave advertised by architecture §3/§11 but unsupported in code (`BrowserKind` + candidate tables) | High |
| 2 | No requirement traceability tags in module or its tests; violates project_requirements §10 and architecture §15 | High |
| 3 | NFR-03 Linux candidate set incomplete (snap Chromium, flatpak, Edge, Brave); misleading "handled separately" comment | Medium |
| 4 | ADR-05/§11 last-resort Chromium-for-Testing browser provisioning entirely missing from `locateBrowser` | Medium |
| 5 | NFR-02 boundary ambiguity: `locateDriver` step 3 triggers network provisioning during a first conversion with no offline guard and no tag | Medium |
| 6 | `MD2PDF_BROWSER` kind inference misclassifies chromium/edge/brave as `'chrome'` (silent fail-soft) | Low |
| 7 | `findBinaryInPath` uses `execSync` string command (`which`/`where`); weaker portability than the `execFileSync` pattern used elsewhere | Low |
| 8 | Duplicated `getBrowserVersion`/`getDriverVersion`; both swallow errors to `'0.0.0'`, masking R-1 version-lockstep failures | Low |

**Totals:** Critical 0 · High 2 · Medium 3 · Low 3 · **Total 8**

## Appendix: Evidence Anchors

- `BrowserKind` definition lacking edge/brave: `src/browserLocator.ts:8`
- Candidate tables: darwin `:37-49`, linux `:51-58` (misleading comment `:57`), win32 `:60-107`
- `MD2PDF_BROWSER` kind inference: `:192-193`
- `locateBrowser` immediate throw, no last-resort browser provision: `:228`
- `locateDriver` network provision step: `:294-296`
- `driverCacheDir` per-user path: `:249-251`
- `findBinaryInPath` shelled `which`/`where`: `:237-238`
- Duplicated version helpers / error swallow: `:124-136`, `:138-150`
- Architecture Edge/Brave claim: `docs/architecture.md:41`, `:208-210`
- Architecture ADR-05 last-resort browser: `docs/architecture.md:289-297`
- Traceability mandate: `docs/project_requirements.md:148-153`, `docs/architecture.md:343`
- No `@req` tags anywhere in `src/` (grep, zero matches)
