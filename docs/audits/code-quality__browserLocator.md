# Code-Quality Forensic Audit — `src/browserLocator.ts`

- **Scope:** `file:src/browserLocator.ts`
- **Project:** md2pdf (TypeScript / Node)
- **Standard:** `/home/me/.claude/AGENTS.md` (function ≤ 40 lines, file ≤ 300 lines, fail-fast, no hardcoding, POLA/KISS/YAGNI/DRY/SRP/SoC)
- **Date:** 2026-06-03
- **Lines:** 310

---

## Detailed Analysis

The headline defect is a **lie about a path the code itself documents as unusable**.
`resolveSnapFirefox` (lines 161-175) carries a docstring (lines 156-160) that states in
plain English: the snap wrapper at `/snap/bin/firefox` "is not a real executable WebDriver
can launch." Then the body does exactly the thing the docstring forbids: when only the
wrapper exists and the real binary does not, line 169 selects `snapWrapper` and line 170-174
returns it as a usable `executablePath`. The function promises "I resolve the *real* Firefox
binary" and, on the precise edge case it was written to handle, hands back the wrapper it just
called unusable. Any caller — `locateBrowser` (line 216), then `locateBrowserAndDriver`
(line 307) — will proceed to drive WebDriver against a binary the author already knew would
fail. This is a `BROKEN_CONTRACT` / `LYING_NAME` honesty defect, P0.

After honesty, the file's most material design breach is a textbook **DRY violation**:
`getBrowserVersion` (lines 124-136) and `getDriverVersion` (lines 138-150) are byte-for-byte
identical — same `execFileSync` call, same `--version` arg, same 5000 ms timeout, same regex
`/\d+\.\d+(?:\.\d+)*/`, same `'0.0.0'` fallback. Two names, one body, zero divergence today —
and therefore two places to drift tomorrow. The only thing distinguishing them is the noun in
the name; nothing in the body cares whether it is parsing a browser or a driver.

The **security posture** is acceptable but not clean. Threat model: inputs are the host
filesystem, three environment variables (`MD2PDF_BROWSER`, Windows `PROGRAMFILES*`/`LOCALAPPDATA`),
and the OS platform string; sinks are `execFileSync` (lines 126, 140) and `execSync`
(line 238). `findBinaryInPath` (lines 235-246) builds a shell command string with template
interpolation — `which "${name}"` / `where "${name}"` — and runs it through `execSync`, which
spawns a shell. The interpolated `name` is an internal literal (`'chromedriver'` /
`'geckodriver'` from line 277-278), not user-controlled, so this is a defense-in-depth weakness
(`INJECTION`, P2, WARNING) rather than a live RCE: the file hands a shell a quoted string for no
reason when `execFileSync('which', [name])` would avoid the shell entirely. `MD2PDF_BROWSER`
(line 182) is existence-checked (line 185) and then executed with `--version` via `execFileSync`
(argument vector, no shell) — that boundary is validated and not exploitable.

Lesser design issues round out the picture. `resolveEnvOverride` infers browser family by
substring-matching `"firefox"` anywhere in the lowercased path (lines 192-193) — a `POLA`
violation: `MD2PDF_BROWSER=/home/firefox-fan/bin/chromium` is silently classified `firefox`.
The file is 310 lines, 10 lines over the project's 300-line module ceiling (`GOD_MODULE`, P2,
INFO-grade). Several hardcoded absolute paths (snap paths lines 164-165; candidate tables) are
defensible platform constants but are not surfaced as named, documented constants. None of these
rise to the level of the honesty defect, which alone caps `correctness` at 0.5.

---

## Findings

### 0001_BROKEN_CONTRACT_P0 — `resolveSnapFirefox` returns the path it documents as unusable

- **id:** `0001_BROKEN_CONTRACT_P0`
- **priority:** P0
- **anti_pattern_class:** BROKEN_CONTRACT (also LYING_NAME)
- **file:** `src/browserLocator.ts`
- **line:** 169
- **function_or_class:** `resolveSnapFirefox`
- **severity:** MAJOR
- **security_concern:** null
- **evidence_lines:** 156-174

```ts
/**
 * On Linux, `snap install firefox` places a wrapper at `/snap/bin/firefox` that
 * is not a real executable WebDriver can launch.  The actual binary lives under
 * the snap mount.
 */
function resolveSnapFirefox(): LocatedBrowser | null {
  ...
  const snapWrapper = '/snap/bin/firefox';
  const snapReal = '/snap/firefox/current/usr/lib/firefox/firefox';
  if (!existsSync(snapWrapper) && !existsSync(snapReal)) return null;
  const realPath = existsSync(snapReal) ? snapReal : snapWrapper;   // line 169
  return { kind: 'firefox', executablePath: realPath, version: getBrowserVersion(realPath) };
}
```

- **problem:** The docstring (lines 156-160) states the wrapper at `/snap/bin/firefox`
  "is not a real executable WebDriver can launch" — that is the entire reason the function
  exists. Yet line 169's ternary falls back to `snapWrapper` whenever `snapReal` is absent,
  and lines 170-174 return it as a launchable `executablePath`. The function's name and
  docstring promise resolution of the *real* binary; on the exact failure mode it was built
  for (wrapper present, real binary path different/missing), it returns the unusable wrapper.
  The variable is even named `realPath` while holding the path the code just called not-real —
  the name lies twice. Downstream, `locateBrowser` (line 216) returns this to
  `locateBrowserAndDriver` (line 307), which feeds it to WebDriver, producing a launch failure
  the author already anticipated and documented. Fail-fast (AGENTS.md §8) is violated: rather
  than returning `null` (no usable browser → fall through to other candidates / throw
  `BrowserNotFoundError`) the function returns a known-bad path as if it were good.
- **affected_axis:** correctness

---

### 0002_DRY_P1 — `getBrowserVersion` and `getDriverVersion` are byte-identical clones

- **id:** `0002_DRY_P1`
- **priority:** P1
- **anti_pattern_class:** DRY
- **file:** `src/browserLocator.ts`
- **line:** 124
- **function_or_class:** `getBrowserVersion` / `getDriverVersion`
- **severity:** WARNING
- **security_concern:** null
- **evidence_lines:** 124-150

```ts
function getBrowserVersion(executablePath: string): string {
  try {
    const output = execFileSync(executablePath, ['--version'], {
      encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'],
    });
    const match = output.match(/\d+\.\d+(?:\.\d+)*/);
    return match ? match[0] : '0.0.0';
  } catch { return '0.0.0'; }
}

function getDriverVersion(executablePath: string): string {   // line 138 — identical body
  try {
    const output = execFileSync(executablePath, ['--version'], {
      encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'],
    });
    const match = output.match(/\d+\.\d+(?:\.\d+)*/);
    return match ? match[0] : '0.0.0';
  } catch { return '0.0.0'; }
}
```

- **problem:** The two functions are character-for-character identical: same `--version`
  invocation, same `timeout: 5000`, same `stdio`, same regex, same `'0.0.0'` fallback. The
  only differentiator is the name's noun. There is a single piece of knowledge here — "run a
  binary with `--version` and extract the first dotted-number token" — duplicated across two
  homes (Hunt & Thomas: one authoritative representation). They are byte-identical *now*; the
  defect is the seeded drift risk — a future fix to one (e.g. bumping the timeout, hardening the
  regex) silently leaves the other behind. Marked WARNING because no drift exists yet, P1
  because the duplication is structural, not cosmetic.
- **affected_axis:** maintainability

---

### 0003_INJECTION_P2 — `findBinaryInPath` shells out via `execSync` with string interpolation

- **id:** `0003_INJECTION_P2`
- **priority:** P2
- **anti_pattern_class:** INJECTION
- **file:** `src/browserLocator.ts`
- **line:** 237
- **function_or_class:** `findBinaryInPath`
- **severity:** WARNING
- **security_concern:** command_injection
- **evidence_lines:** 235-246

```ts
function findBinaryInPath(name: string): string | null {
  try {
    const cmd = platform() === 'win32' ? `where "${name}"` : `which "${name}"`;
    const result = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return result.trim().split('\n')[0]?.trim() || null;
  } catch { return null; }
}
```

- **problem:** `execSync` spawns a shell and runs a command string built by interpolating
  `name` into `which "..."` / `where "..."` (line 237). The rest of the file uses the
  shell-free, argument-vector `execFileSync` (lines 126, 140); this is the lone call that drops
  to a shell. Threat model: the only call site passes the internal literal `kind` (`'chromedriver'`
  / `'geckodriver'`, lines 277-278, 283), so `name` is not attacker-controlled and the path is
  not currently exploitable — hence WARNING, not CRITICAL. But the construction is gratuitously
  unsafe: `execFileSync('which', [name], {...})` (POSIX) achieves the same result with no shell
  and no interpolation, removing the injection surface entirely. The quotes around `${name}`
  are a tell that the author was already worried about shell metacharacters — the correct fix
  is to not invoke a shell at all. Security finding → P2 by the deterministic banding rule.
- **affected_axis:** security

---

### 0004_POLA_P1 — `resolveEnvOverride` infers browser kind by substring, mis-classifies plausible paths

- **id:** `0004_POLA_P1`
- **priority:** P1
- **anti_pattern_class:** POLA
- **file:** `src/browserLocator.ts`
- **line:** 192
- **function_or_class:** `resolveEnvOverride`
- **severity:** WARNING
- **security_concern:** null
- **evidence_lines:** 191-198

```ts
// Infer kind from path string; default to chrome-family
const lower = override.toLowerCase();
const kind: BrowserKind = lower.includes('firefox') ? 'firefox' : 'chrome';
```

- **problem:** Browser family is decided by whether the substring `"firefox"` appears *anywhere*
  in the lowercased override path (line 193). A reasonable user setting
  `MD2PDF_BROWSER=/home/firefox-fan/bin/chromium` or `.../firefox-builds/chrome` is silently
  classified `firefox` and handed the wrong driver (`geckodriver` vs `chromedriver`, decided at
  line 277-278), producing a confusing downstream failure far from the cause. Symmetrically, a
  Chromium binary literally named `firefox`-something is mis-routed. The behavior surprises a
  caller who read the variable's purpose ("point me at my browser") and is a POLA violation:
  the classification heuristic is invisible and lossy. AGENTS.md §8 (validate at boundaries)
  argues for an explicit signal (e.g. probing `--version` output, which is already available
  via `getBrowserVersion`) rather than a path-substring guess.
- **affected_axis:** correctness

---

### 0005_GOD_MODULE_P2 — module exceeds the 300-line ceiling

- **id:** `0005_GOD_MODULE_P2`
- **priority:** P2
- **anti_pattern_class:** GOD_MODULE
- **file:** `src/browserLocator.ts`
- **line:** 1
- **function_or_class:** (module)
- **severity:** INFO
- **security_concern:** null
- **evidence_lines:** 1-310

- **problem:** The file is 310 lines, 10 over the project's explicit 300-line module ceiling
  (AGENTS.md §3). It also mixes three concerns in one file — browser candidate tables +
  detection (lines 28-229), driver location/provisioning glue (lines 231-297), and the combined
  convenience wrapper (lines 299-309) — a mild SoC smell. The overrun is small and the concerns
  are cohesive (all "locate the things needed to drive a browser"), so this is INFO-grade; it is
  reported because the standard sets a hard numeric limit and this file is over it. Collapsing
  the two identical version helpers (finding 0002) would by itself bring the file under 300.
- **affected_axis:** structure

---

## Aggregate Scores

| Axis | Score | Rationale |
|------|-------|-----------|
| correctness | 0.5 | Honesty defect (0001) caps correctness at 0.5; POLA mis-classification (0004) compounds. |
| structure | 0.75 | Over the 300-line ceiling and a mild SoC mix, but cohesive and shallow. |
| security | 0.75 | `execSync` shell interpolation (0003) at WARNING caps security at 0.75; not currently exploitable. |
| maintainability | 0.75 | Byte-identical DRY clones (0002) seed drift. |
| **code_score** | **0.5** | `min(correctness, structure, security, maintainability)` |

**Weakest axis:** correctness.

---

## Priority Summary

| Band | Critical | Major | Warning | Info | Total |
|------|----------|-------|---------|------|-------|
| P0 honesty + catastrophic | 0 | 1 | 0 | 0 | 1 |
| P1 design principles | 0 | 0 | 2 | 0 | 2 |
| P2 metrics + security | 0 | 0 | 1 | 1 | 2 |
| P3 style | 0 | 0 | 0 | 0 | 0 |
| **Total** | **0** | **1** | **3** | **1** | **5** |

---

## Verdict

**AUDIT_WEAK** — one P0 honesty finding at MAJOR severity (`resolveSnapFirefox` returns the
path it documents as unusable) forces at minimum AUDIT_WEAK. No CRITICAL findings, so the audit
does not FAIL; but code that hands back a binary its own docstring calls unlaunchable is not
"almost good". Fix the snap fallback to return `null` (fail-fast), collapse the two identical
version helpers, drop the shell in `findBinaryInPath`, and replace the path-substring kind guess
with an explicit probe.
