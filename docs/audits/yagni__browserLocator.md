# YAGNI Audit — `src/browserLocator.ts`

Read-only forensic audit. Scope: `src/browserLocator.ts` only. Usage of every
exported symbol and field was cross-checked against `src/` and `tests/` before
flagging.

## Cross-reference evidence (usage map)

Commands run and results:

- `locateBrowser` — used by `tests/unit/browserLocator.test.ts`. (No non-test src caller.)
- `locateDriver` — used by `tests/unit/browserLocator.test.ts`.
- `locateBrowserAndDriver` — used by `src/converter.ts:42`, `tests/integration/endToEnd.test.ts:28`.
- `driverCacheDir` — used by `tests/unit/browserLocator.test.ts:154,172`.
- `DriverProvisioner` (type) — used by `src/converter.ts:3,12`, tests.
- `BrowserAndDriver`, `LocatedBrowser`, `LocatedDriver`, `DriverKind` (types) — used by `src/converter.ts`, `src/pdfRenderer.ts`, `src/driverProvisioner.ts`, tests.
- `BrowserKind` (type) — **no usage outside the file** (`grep "BrowserKind"` returns only `src/browserLocator.ts`).
- `LocatedDriver.version` field — **never read** anywhere. The only `.version` reads in consumers are `releaseCatalog.ts` (unrelated) and `tests/unit/browserLocator.test.ts:107` which reads `browser.version`. `src/pdfRenderer.ts` reads only `driver.executablePath` (line 174) and `browser.executablePath`/`browser.kind` (capabilities). `src/converter.ts` destructures `{ browser, driver }` and forwards them but never reads `.version` on either.

---

## Findings

### [YAGNI-Over-Engineering] Driver version is computed and stored but never consumed

**Location:** `src/browserLocator.ts:17-21` (field), `:138-150` (`getDriverVersion`), `:285,291,296` (call sites)

**Code:**
```ts
export interface LocatedDriver {
  kind: DriverKind;
  executablePath: string;
  version: string;          // line 20 — never read by any consumer
}
```
```ts
function getDriverVersion(executablePath: string): string {   // lines 138-150
  try {
    const output = execFileSync(executablePath, ['--version'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const match = output.match(/\d+\.\d+(?:\.\d+)*/);
    return match ? match[0] : '0.0.0';
  } catch {
    return '0.0.0';
  }
}
```
```ts
return { kind, executablePath: pathBin, version: getDriverVersion(pathBin) };  // line 285
...
return { kind, executablePath: cacheBin, version: getDriverVersion(cacheBin) }; // line 291
...
return { kind, executablePath: provisionedPath, version: getDriverVersion(provisionedPath) }; // line 296
```

**Issue:** `LocatedDriver.version` is written at all three `locateDriver` return
sites but is never read anywhere in the codebase. `src/pdfRenderer.ts` uses only
`driver.executablePath` (line 174); `src/converter.ts` forwards the `driver`
object without reading `.version`; no test asserts on `driver.version`. The
entire `getDriverVersion` function (lines 138-150) exists only to populate this
dead field. Each of the three calls additionally spawns a child process
(`execFileSync` with a 5 s timeout) per `locateDriver`, so this is unused work
that also has a runtime cost on the hot path.

**Recommendation:** Drop the `version` field from `LocatedDriver` and delete
`getDriverVersion`; the driver is launched by path, not by reported version.

**Confidence:** High
Field and function are exhaustively traceable; no read site exists in src or tests.

---

### [YAGNI-Speculative-Generality] `getDriverVersion` duplicates `getBrowserVersion` byte-for-byte

**Location:** `src/browserLocator.ts:124-136` and `:138-150`

**Code:**
```ts
function getBrowserVersion(executablePath: string): string {   // 124-136
  try {
    const output = execFileSync(executablePath, ['--version'], {
      encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'],
    });
    const match = output.match(/\d+\.\d+(?:\.\d+)*/);
    return match ? match[0] : '0.0.0';
  } catch { return '0.0.0'; }
}

function getDriverVersion(executablePath: string): string {    // 138-150 — identical body
  try {
    const output = execFileSync(executablePath, ['--version'], {
      encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'],
    });
    const match = output.match(/\d+\.\d+(?:\.\d+)*/);
    return match ? match[0] : '0.0.0';
  } catch { return '0.0.0'; }
}
```

**Issue:** The two functions are identical line-for-line (same args, same regex,
same fallback). Two separate named functions imply a future divergence
(driver-specific vs browser-specific version parsing) that does not exist.
This is speculative generality / a DRY violation; one function suffices. (If the
prior finding is acted on, `getDriverVersion` disappears entirely and this
duplication is moot.)

**Confidence:** High
Bodies are verifiably identical.

---

### [YAGNI-Unused-Code] Exported type `BrowserKind` has no external consumer

**Location:** `src/browserLocator.ts:8`

**Code:**
```ts
export type BrowserKind = 'chrome' | 'chromium' | 'firefox';
```

**Issue:** `BrowserKind` is `export`ed but `grep "BrowserKind"` across the repo
returns matches only inside `src/browserLocator.ts` itself. It is used
internally (in `LocatedBrowser`, `BrowserCandidate`, `resolveEnvOverride`), so
the *type* is needed — but the `export` keyword is speculative API surface: no
other module imports it, unlike its sibling `DriverKind` (imported by
`driverProvisioner.ts:15`). Exporting a symbol no consumer needs widens the
public contract for a hypothetical future caller.

**Recommendation:** Drop `export` from `BrowserKind` until an external consumer
exists; keep it as a module-local type.

**Confidence:** Medium
Internally required, so not dead; the speculative element is solely the `export`
visibility. Lower confidence because a published library may intend the kind
union as part of its public type surface even without a current importer.

---

### [YAGNI-Speculative-Generality] `'chromium'` variant of `BrowserKind` collapses to `'chrome'` at every decision point

**Location:** `src/browserLocator.ts:8`, `:193`, `:277-278`; and `src/pdfRenderer.ts:100-103`

**Code:**
```ts
export type BrowserKind = 'chrome' | 'chromium' | 'firefox';   // line 8
...
const kind: BrowserKind = lower.includes('firefox') ? 'firefox' : 'chrome';  // line 193 — never yields 'chromium'
...
const kind: DriverKind =
  browser.kind === 'firefox' ? 'geckodriver' : 'chromedriver';  // lines 277-278 — 'chromium' treated as chrome
```
```ts
// src/pdfRenderer.ts:100-103
return browser.kind === 'firefox'
  ? firefoxCapabilities(browser)
  : chromeCapabilities(browser);          // 'chromium' falls through to chrome
```

**Issue:** `'chromium'` is a distinct member of the `BrowserKind` union, and the
platform candidate tables do tag some paths `kind: 'chromium'` (lines 47, 54-55).
But every *behavioural* branch in the codebase is binary: `firefox` vs.
everything-else-treated-as-chrome. `'chromium'` and `'chrome'` are never
distinguished — same driver (`chromedriver`), same capabilities, same
`'--version'` parsing. `resolveEnvOverride` (line 193) cannot even produce
`'chromium'`. The third union member therefore adds a value that carries no
behavioural meaning, i.e. speculative discrimination that no code acts on.

**Recommendation:** Either collapse `'chromium'` into `'chrome'` (the
chrome-family kind) and retag the candidate entries, or — if the label is kept
purely for diagnostics — document that it is non-behavioural. As written it
implies a chromium-specific path that does not exist.

**Confidence:** Medium
The non-discrimination is verifiable; lower confidence because the distinct label
may be intentionally retained for human-readable diagnostics/error messages even
though no logic branches on it.

---

## YAGNI Summary

**Total violations found:** 4
- Unused Code: 1 (exported `BrowserKind` with no importer)
- Premature Abstraction: 0
- Speculative Generality: 2 (duplicate `getDriverVersion`; non-behavioural `'chromium'` variant)
- Over-Engineering: 1 (driver `version` computed/stored but never read)
- Defensive Coding Excess: 0
- Future-Proofing: 0

**Impact Assessment:**
The file is otherwise lean and purpose-driven (platform candidate tables,
env override, snap-firefox handling, three-tier driver resolution all map to real
needs). The violations are localized to version-tracking: a whole field
(`LocatedDriver.version`) plus a dedicated function (`getDriverVersion`, 13 lines)
exist solely to compute a value nothing consumes — and that computation spawns an
extra child process on every `locateDriver` call. Removing them shrinks the public
type contract, deletes the duplicate function, and avoids three unnecessary process
launches. The `'chromium'` union member is low-cost but misleading: it suggests a
chromium-specific code path that no consumer implements.

**Top Priority Removals:**
1. `LocatedDriver.version` field + `getDriverVersion` function (dead write, plus per-call process spawn cost) — `:20`, `:138-150`, `:285/291/296`.
2. Collapse the duplicate `getDriverVersion` into `getBrowserVersion` if the field is somehow retained — `:138-150`.
3. Reconcile the unused `'chromium'` `BrowserKind` member with the binary firefox-vs-chrome logic — `:8`.
