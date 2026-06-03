# YAGNI Audit — `src/driverProvisioner.ts` and `src/overwrite.ts`

**Scope:** Read-only forensic YAGNI audit of two files only.
**Method:** Each file read in full; every exported symbol and parameter cross-checked against the rest of the repository (`src/`, `tests/`) via grep before flagging.
**Date:** 2026-06-03

---

## Detailed analysis

### `src/driverProvisioner.ts`

Purpose: download + cache chromedriver/geckodriver binaries, applying the 7-day quarantine from `releaseCatalog.ts`.

Cross-check of exported symbols:

| Symbol | Exported | Used outside this module? |
|--------|----------|----------------------------|
| `provisionDriver` | yes | yes — `src/browserLocator.ts:5,275` and `tests/unit/driverProvisioner.test.ts` |
| `DriverRelease` (interface) | yes | yes — `tests/unit/driverProvisioner.test.ts:4,60,64` |
| `DriverReleaseFetcher` (type) | yes | yes — `tests/unit/driverProvisioner.test.ts:4,64,158` |
| `fetchChromedriverReleases` | yes | **NO** — only referenced internally by `defaultFetcher` (line 245) |
| `fetchGeckodriverReleases` | yes | **NO** — only referenced internally by `defaultFetcher` (line 244) |

Grep evidence that the two fetchers are unused outside the module:

```
$ grep -rn -E "\bfetchChromedriverReleases\b|\bfetchGeckodriverReleases\b" . | grep -v src/driverProvisioner.ts
exit: 1   (no matches)
```

The tests exercise the catalog logic through the injectable `fetcher` parameter of `provisionDriver` (the file's own docstring at lines 185-186 says "Pass a custom `fetcher` in tests to avoid real network calls"), and `defaultFetcher` itself is module-private and unexported. Therefore the network fetchers do not need to be part of the public surface.

The most significant finding is the dead-variable tangle inside `fetchGeckodriverReleases` (lines 152-156). Three locals attempt to compute the archive extension; two of them are dead and the live one is recomputed from scratch:

```ts
152  const isWindows = platform() === 'win32';
153  const ext = isWindows || platformId.startsWith('linux') && !platformId.includes('linux')
154    ? '.zip'
155    : platformId.startsWith('win') ? '.zip' : '.tar.gz';
156  const actualExt = platformId.startsWith('win') || platform() === 'win32' ? '.zip' : '.tar.gz';
```

Grep confirms `ext` is never read after assignment and `isWindows` is consumed only by the dead `ext` expression; only `actualExt` reaches the asset-name string on line 165:

```
152:  const isWindows = platform() === 'win32';
153:  const ext = isWindows || platformId.startsWith('linux') && !platformId.includes('linux')
156:  const actualExt = platformId.startsWith('win') || platform() === 'win32' ? '.zip' : '.tar.gz';
165:    const assetName = `geckodriver-v${version}-${platformId}${actualExt}`;
```

Beyond being dead, line 153's condition `platformId.startsWith('linux') && !platformId.includes('linux')` is a logical contradiction (a string starting with `'linux'` always includes `'linux'`), so that sub-expression is provably always `false` — a fossil of speculative platform-branching that never had an effect. It is left here as evidence of over-engineered extension logic, though under YAGNI it manifests primarily as the dead `ext`/`isWindows` pair.

The `DriverRelease` interface (lines 23-25) extends `Release` solely to add `downloadUrl`. Inside `provisionDriver` the value returned by `selectNewestEligible` (typed `Release`) is repeatedly cast back to `DriverRelease`/`Release & { downloadUrl: string }` (lines 204, 206, 214, 223). This is a noted design friction but `DriverRelease` is genuinely used by tests, so it is not a YAGNI violation — recorded here only to explain why it is NOT flagged.

The two `User-Agent` header strings (`'md2pdf-driver-provisioner'`, lines 64 and 73) and the timeout literals (`15_000`, `120_000`) are duplicated/inline; that is a DRY/hardcoding observation, out of scope for a YAGNI audit and not flagged.

### `src/overwrite.ts`

Purpose: decide whether to overwrite an existing output file, and prompt the user interactively.

Cross-check:

| Symbol | Used outside this module? |
|--------|----------------------------|
| `decideOverwrite` | yes — `src/pipeline.ts:13,62` |
| `confirmOverwrite` | yes — `src/pipeline.ts:13,74` |
| `OverwriteDecision` / `OverwriteInputs` / `ConfirmOverwriteOptions` | type contracts of the two used functions |

`OverwriteInputs` (lines 6-10) and `decideOverwrite` are fully consumed by `pipeline.ts` (the call at lines 62-66 passes all three fields). `confirmOverwrite` with its injectable `input`/`output` streams (lines 19-22) is used at `pipeline.ts:74-77` with real stdio, and the stream injection is legitimate test-boundary seam (I/O), which the audit rules explicitly exclude from YAGNI flags.

`overwrite.ts` is clean: small, single-responsibility, every export used, no speculative parameters, no dead branches. No YAGNI violations found in this file.

---

## List of issues / findings

### [YAGNI-Unused Code] Dead `ext` local variable in `fetchGeckodriverReleases`

**Location:** `src/driverProvisioner.ts:153-155`

**Code:**
```ts
const ext = isWindows || platformId.startsWith('linux') && !platformId.includes('linux')
  ? '.zip'
  : platformId.startsWith('win') ? '.zip' : '.tar.gz';
```

**Issue:** `ext` is assigned but never read anywhere in the function or file (grep shows no reference after line 153; the asset name on line 165 uses `actualExt`, not `ext`). It is a speculative duplicate of the extension calculation that was superseded by `actualExt` on line 156. Additionally its condition `platformId.startsWith('linux') && !platformId.includes('linux')` is a tautological-false (any string starting with `'linux'` necessarily includes `'linux'`), so even if it were read it would carry an always-dead branch.

**Recommendation:** Remove the `ext` declaration entirely.

**Confidence:** High
Direct grep evidence that `ext` has no reader; `actualExt` is the only extension value that reaches line 165.

---

### [YAGNI-Unused Code] Dead `isWindows` local variable in `fetchGeckodriverReleases`

**Location:** `src/driverProvisioner.ts:152`

**Code:**
```ts
const isWindows = platform() === 'win32';
```

**Issue:** `isWindows` is consumed only by the dead `ext` expression on line 153. The live extension value `actualExt` (line 156) recomputes the Windows check inline as `platform() === 'win32'` rather than using `isWindows`. Once `ext` is removed, `isWindows` has no reader; it is dead today by virtue of feeding only a dead variable.

**Recommendation:** Remove the `isWindows` declaration.

**Confidence:** High
`actualExt` does not reference `isWindows`; the only consumer is the unused `ext`.

---

### [YAGNI-Speculative Generality] `fetchChromedriverReleases` exported but never imported

**Location:** `src/driverProvisioner.ts:126-148`

**Code:**
```ts
export async function fetchChromedriverReleases(
  browserMajorVersion: number,
): Promise<DriverRelease[]> {
```

**Issue:** The `export` keyword broadens the public API for a function that is only ever reached through the module-private `defaultFetcher` (line 245). Grep across `src/` and `tests/` finds zero importers outside this file. Tests inject their own fetchers through `provisionDriver`'s `fetcher` parameter (file docstring lines 185-186; test usage `tests/unit/driverProvisioner.test.ts:64,158`), so the real network fetcher need not be exported.

**Recommendation:** Drop the `export` (make it module-private alongside `defaultFetcher`), unless a documented future requirement needs it on the public surface.

**Confidence:** Medium
Unambiguous that it is unused externally today; Medium because a published library may intentionally expose such helpers, which I cannot fully rule out from these two files alone.

---

### [YAGNI-Speculative Generality] `fetchGeckodriverReleases` exported but never imported

**Location:** `src/driverProvisioner.ts:150-175`

**Code:**
```ts
export async function fetchGeckodriverReleases(): Promise<DriverRelease[]> {
```

**Issue:** Same pattern as the chromedriver fetcher. Exported, but only referenced internally by `defaultFetcher` (line 244). Grep for the name outside this module returns no matches. The exported surface is wider than current callers require.

**Recommendation:** Drop the `export`; keep it module-private.

**Confidence:** Medium
Unused externally today; Medium for the same library-surface caveat as above.

---

## YAGNI Summary

**Total violations found:** 4
- Unused Code: 2
- Premature Abstraction: 0
- Speculative Generality: 2
- Over-Engineering: 0
- Defensive Coding Excess: 0
- Future-Proofing: 0

**Impact Assessment:**
Impact is localized and modest. The two dead locals (`ext`, `isWindows`) in `fetchGeckodriverReleases` are the clearest defect: they add noise, embed a provably-false platform branch, and duplicate logic that `actualExt` already owns — a future maintainer editing extension handling could easily "fix" the wrong (dead) variable and believe they changed behaviour. The two over-broad exports widen the public API surface without a consumer, mildly increasing the maintenance contract. `overwrite.ts` is clean and exhibits no YAGNI issues. None of the findings affect runtime correctness (the dead branch is `false` and the dead variables are never read), so all are maintainability-grade, not behavioural.

**Top Priority Removals:**
1. The dead `ext` local (`driverProvisioner.ts:153-155`), including its tautological-false platform sub-condition.
2. The dead `isWindows` local (`driverProvisioner.ts:152`), removable once `ext` is gone.
3. The unused `export` on `fetchChromedriverReleases` / `fetchGeckodriverReleases` (`driverProvisioner.ts:126,150`).
