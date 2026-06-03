# YAGNI Audit — `scripts/checkArtifactFreshness.mjs`

**Scope:** Read-only forensic YAGNI audit of `scripts/checkArtifactFreshness.mjs` only.
**Date:** 2026-06-03
**Auditor view:** Lean-code / YAGNI specialist.

## Detailed Analysis

`scripts/checkArtifactFreshness.mjs` is a 254-line Node build script invoked via the
`check:artifacts` npm script (`package.json:42`). It enforces the documented
`ARTIFACT_FRESHNESS_POLICY.md` policy: it (a) validates the presence/shape of policy
files (`checkPolicyFiles`), (b) validates the `artifacts.json` manifest
(`checkArtifactManifest`), and (c) regenerates the npm lockfile under a 7-day `--before`
cutoff and compares version-identity, honouring quarantine waivers
(`checkNpmLockFreshness` → `freshnessFailures` → `lockVersionSignature`).

**Cross-checks performed before flagging:**

- Both exported functions are genuinely used:
  - `freshnessFailures` is called at `scripts/checkArtifactFreshness.mjs:197` and tested in
    `tests/unit/checkArtifactFreshness.test.ts` (6 cases).
  - `lockVersionSignature` is called at lines 112–113 and tested
    (`tests/unit/checkArtifactFreshness.test.ts:44,51`).
- The `exemptPaths = new Set()` default parameter on `lockVersionSignature` (line 39) **is**
  exercised: the test at `tests/unit/checkArtifactFreshness.test.ts:44` calls it with a
  single argument. Not a YAGNI violation.
- All four parameters of `freshnessFailures` (`committedLock`, `regeneratedLock`, `waivers`,
  `auditExists`) are read and exercised by tests. Not unused.
- The waiver machinery (`auditReport`, `approvedBy`, `approvedOn`, `auditExists`) maps
  directly to the "Quarantine Waiver" section of `ARTIFACT_FRESHNESS_POLICY.md` — it
  implements a documented requirement, so it is explicitly **not** flagged as speculative
  even though `artifacts.json` currently ships an empty `waivers: []`.

The script is, on the whole, disciplined and policy-backed. The findings below are the
narrow set of items that validate or branch on data the script itself never consumes, or
guard conditions that cannot currently differ. None are severe.

---

## Findings

### [YAGNI-Speculative Generality] `manifest.artifacts` is validated as an array but its contents are never inspected

**Location:** `scripts/checkArtifactFreshness.mjs:146`

**Code:**
```js
assert(Array.isArray(manifest.artifacts), "artifacts.json artifacts must be an array");
```

**Issue:** The script validates that `manifest.artifacts` is an array, but — unlike
`trackedLocations`, whose entries are iterated and shape-checked at lines 152–155 — the
`artifacts` array is never read, iterated, or used in any freshness decision. In the
checked-in `artifacts.json` it is always empty (`"artifacts": []`). The validation asserts
the existence of a container the script has no behaviour for. This is a placeholder for a
future per-artifact freshness mechanism that does not yet exist; the actual freshness logic
operates entirely on `package-lock.json` (`checkNpmLockFreshness`) and on `trackedLocations`
shape, not on `artifacts`.

**Recommendation:** Defer. Until the script actually consumes `manifest.artifacts` (e.g.
iterates entries to check non-npm artifact versions), the array and its assertion can be
removed; or, if the manifest field is retained as a contract, the assertion is dead weight
that gives false assurance of validation. (Read-only audit — no change made.)

**Confidence:** Medium
The assertion's target is provably never consumed within this file. Lower than High only
because `artifacts.json` is a shared manifest and a sibling consumer outside the audited
file could read `artifacts`; a repo grep (`scripts/`, `src/`) found no other reader, only
this script's two references at lines 137 and 146.

---

### [YAGNI-Future-Proofing] `schemaVersion === 1` check is a versioning guard for data that has exactly one version

**Location:** `scripts/checkArtifactFreshness.mjs:137`

**Code:**
```js
assert(manifest.schemaVersion === 1, "artifacts.json must use schemaVersion 1");
```

**Issue:** The script hard-asserts `schemaVersion === 1` and there is no version-2 branch,
no migration path, and no alternate handling anywhere — the only accepted value is `1`, and
`artifacts.json` ships `"schemaVersion": 1`. A schema-version discriminator earns its keep
when the reader must dispatch on more than one version; here it can only ever pass with `1`
or fail. It is backward/forward-compatibility scaffolding for schema revisions that do not
exist yet.

**Recommendation:** Defer the versioning ceremony until a second schema version actually
exists. The check is low-cost, so this is the weakest of the findings; it is noted for
completeness as future-proofing rather than a current need. (Read-only audit — no change
made.)

**Confidence:** Low
The check is cheap and arguably documents an invariant ("this reader understands schema 1");
it borders on acceptable defensive validation. Flagged as Low because there is no second
schema version and no dispatch logic, which is the textbook shape of premature versioning.

---

### [YAGNI-Defensive Coding Excess] `manifest.trackedLocations ?? []` nullish guard cannot fire after the immediately-preceding array assertion

**Location:** `scripts/checkArtifactFreshness.mjs:147-152`

**Code:**
```js
assert(
  Array.isArray(manifest.trackedLocations),
  "artifacts.json trackedLocations must be an array",
);
// ...
for (const location of manifest.trackedLocations ?? []) {
```

**Issue:** Line 148 asserts `manifest.trackedLocations` is an array; line 152 then iterates
`manifest.trackedLocations ?? []`. The `?? []` fallback only matters when
`trackedLocations` is `null`/`undefined` — exactly the case the preceding assertion is meant
to catch. Note that `assert` here is non-throwing (it merely pushes to `failures`, lines
123–127), so the `?? []` is not strictly dead: if `trackedLocations` were `undefined` the
loop would still run with `[]`. But that scenario already produced a failure on line 148, so
the extra guard is duplicate defensiveness for an input the boundary check already rejected.
The same redundant pattern recurs at line 152 only; the `waivers` handling
(lines 157–162, and lines 193–194 in `checkNpmLockFreshness`) is comparable.

**Recommendation:** Treat as minor defensive excess: the iteration guard duplicates the
intent of the array assertion two lines above. Given `assert` is non-throwing, a single
clear policy (either trust the assertion or branch on it explicitly) would remove the
duplication. (Read-only audit — no change made.)

**Confidence:** Low
Because `assert` does not throw, the `?? []` is technically reachable; this is a
defensive-coding-excess / duplicated-validation observation rather than strictly dead code,
hence Low.

---

## YAGNI Summary

**Total violations found:** 3
- Unused Code: 0
- Premature Abstraction: 0
- Speculative Generality: 1  (`manifest.artifacts` validated but never consumed — line 146)
- Over-Engineering: 0
- Defensive Coding Excess: 1  (redundant `?? []` guard after array assertion — line 152)
- Future-Proofing: 1  (`schemaVersion === 1` single-version guard — line 137)

**Impact Assessment:**
Low overall. This script is lean and tightly coupled to a written policy
(`ARTIFACT_FRESHNESS_POLICY.md`); the bulk of its surface (waiver handling, lockfile
version-signature comparison, policy/renovate validation) implements documented
requirements and is covered by tests, so it is correctly **not** flagged. The three findings
are small: one validated-but-unused manifest field, one single-version schema guard, and one
redundant nullish fallback. They modestly inflate the manifest contract and the validation
surface with assurances the script does not actually act on, but they do not meaningfully
harm readability or correctness.

**Top Priority Removals:**
1. The `manifest.artifacts` array assertion (line 146) — it validates a field the script
   never reads, giving a false impression that per-artifact freshness is enforced here.
2. The `schemaVersion === 1` versioning guard (line 137) — premature schema versioning with
   no second version and no dispatch.
3. The redundant `manifest.trackedLocations ?? []` fallback (line 152) — duplicates the
   array assertion two lines above.

**Items explicitly NOT flagged (and why):**
- `lockVersionSignature` `exemptPaths = new Set()` default param — exercised by tests
  (`tests/unit/checkArtifactFreshness.test.ts:44`).
- All `freshnessFailures` parameters — used and tested.
- Quarantine waiver machinery — implements the documented "Quarantine Waiver" policy section;
  empty `waivers: []` today does not make it speculative.
- The `import.meta.url === pathToFileURL(...)` main-guard (line 251) — standard, lets the
  module be both executable and importable for tests; required by the test import.
