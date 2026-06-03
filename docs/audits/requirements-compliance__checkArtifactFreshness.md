# Requirements Compliance Findings: scripts/checkArtifactFreshness.mjs

**Audit Date:** 2026-06-03
**File(s) Audited:** `/home/me/github/md2pdf/scripts/checkArtifactFreshness.mjs`
**Auditor:** Requirements Compliance Auditor Agent
**Mode:** READ-ONLY forensic audit (no remediation proposed; defects identified and evidenced only)

## Executive Summary

`scripts/checkArtifactFreshness.mjs` is the local enforcement gate for **NFR-05
(Artifact freshness policy)** and the binding rules of `ARTIFACT_FRESHNESS_POLICY.md`.
It correctly enforces the npm-lockfile dimension of the policy (newest-eligible
comparison via an npm `--before` regeneration, with quarantine-waiver exemptions), but
it does **not** enforce the policy over the non-npm artifact classes that NFR-05 and the
policy explicitly cover (browser builds, `chromedriver`/`geckodriver`, fonts, the Mermaid
engine, the highlight.js stylesheet, and the `runtime-provisioning` path). Several
silent-pass paths and a waiver-location enforcement gap further weaken the gate against
its "no exception, override, bypass" mandate.

- **Requirements/Policy rules in scope for this file:** NFR-05; Policy Binding Rules 2,
  4, 5, 6; Policy Implementation Requirements; Quarantine-Waiver enforcement clause.
- **Fully met:** newest-eligible npm comparison + waiver gating (Binding Rules 2, partial 5).
- **Partially met:** Binding Rule 5 (lockfile only), waiver enforcement.
- **Unmet:** Binding Rules 4 & 6 (non-npm artifacts, runtime provisioning), Implementation
  Requirement "Non-npm artifacts are checked through `artifacts.json` and the release
  catalog".
- **Compliance Score (policy rules this gate is responsible for):** ~50%.

## Requirement / Policy Coverage Matrix

| Requirement / Rule | Description | Referenced in code | Implemented | Status |
|---|---|---|---|---|
| NFR-05 | Use newest eligible artifact version after 7-day quarantine; waiver is sole exception | No `@req`/`NFR-05` tag anywhere in file | npm only | ⚠️ Partial |
| Policy Rule 2 | Select *newest eligible*, not merely >7-day-old | Implicit (regeneration comparison) | Full (npm) | ✅ (npm scope) |
| Policy Rule 4 | Every non-npm artifact declared in `artifacts.json` | Schema-validated only | None (existence of declared artifacts/freshness not checked) | ❌ |
| Policy Rule 5 | Every lockfile, vendored asset, runtime-provisioning path, release package passes the check | Lockfile only | Partial | ⚠️ Partial |
| Policy Rule 6 | Runtime provisioning code must apply the same rule | `src/browserLocator.ts` tracked but unchecked | None | ❌ |
| Policy Quarantine Waiver | Audit at `security/audits/<package>@<version>.md`, owner-approved, exact-version lock | Fields + existence checked | Partial (path convention not enforced) | ⚠️ Partial |
| NFR-05 "no other exception/bypass/force mode" | Single waiver exception only | Honoured for npm | Partial (non-npm classes are de facto unenforced, i.e. an unintended bypass) | ⚠️ Partial |

## Detailed Findings

### ✅ Compliant Aspects

#### Policy Rule 2 — newest-eligible npm selection
- **Status:** Compliant within npm scope.
- **Evidence:** Lines 178-188 regenerate the lockfile with
  `npm install --package-lock-only --ignore-scripts --before <cutoff>`, and lines 111-118
  fail when the committed lockfile's version signature differs from the regenerated
  newest-eligible signature. This enforces "newest eligible", not merely "older than 7
  days", satisfying Binding Rule 2 for npm dependencies.
- The version-signature projection (lines 39-54) correctly reduces comparison to
  `version`/`resolved`/`integrity`, avoiding false failures on npm CLI cosmetic drift
  (the documented `libc` field case, lines 26-37). This is sound and policy-faithful
  (policy is "defined over versions and publication timestamps").

#### Quarantine-waiver field and binding validation
- **Status:** Compliant for the checks it performs.
- **Evidence:** Lines 72-109 reject a waiver that is missing any required field
  (`package`, `version`, `auditReport`, `approvedBy`, `approvedOn`), does not match a
  locked package, disagrees with the locked version, or references a missing audit report.
  This matches the policy clause "A waiver that is malformed, points at a missing audit
  report, or disagrees with the locked version fails the check" (`ARTIFACT_FRESHNESS_POLICY.md:83-84`).

### ❌ Non-Compliant / Missing

#### F1 (HIGH) — Non-npm artifact classes are never freshness-checked (Policy Rules 4 & 6; NFR-05)
- **Status:** Unmet.
- **Evidence:** The only freshness comparison in the file is over `package-lock.json`
  (`checkNpmLockFreshness`, lines 165-210). `checkArtifactManifest` (lines 129-163) only
  validates the *shape* of `artifacts.json` (schemaVersion, quarantineDays, policy string,
  array types); it performs **no freshness or existence check** on any declared artifact.
  The `manifest.artifacts` array is read for type only (`assert(Array.isArray(manifest.artifacts), ...)`,
  line 146) and never iterated.
- **Why this is a requirements defect:** NFR-05 binds the freshness rule to "**any**
  artifact ... embedded, locked, referenced, distributed, vendored, generated from a
  third-party source, or provisioned." `artifacts.json` itself (lines 25-34) enumerates
  the in-scope non-npm classes: `bundled Mermaid engine`, `bundled highlight.js
  stylesheet`, `bundled fonts`, `chromedriver`, `geckodriver`, `Chromium-for-Testing
  fallback build`. The policy's Implementation Requirements state: "Non-npm artifacts are
  checked through `artifacts.json` and the release catalog implementation for their
  source" (`ARTIFACT_FRESHNESS_POLICY.md:93-94`). No such check exists in this file. These
  classes are de facto exempt from the gate — an unintended bypass that NFR-05 forbids
  ("no other exception, override, bypass, emergency exemption, or force mode exists").

#### F2 (HIGH) — Runtime-provisioning path is tracked but unchecked (Policy Rule 6; Implementation Requirement)
- **Status:** Unmet.
- **Evidence:** `artifacts.json` declares `trackedLocations` entries `assets/`
  (`bundled-assets`) and `src/browserLocator.ts` (`runtime-provisioning`)
  (`artifacts.json:16-23`). In the script, `trackedLocations` is only validated for
  per-entry `path`/`kind` being strings (lines 152-155); the script never checks that
  these paths exist, nor that the runtime-provisioning code applies the freshness rule.
  Policy Binding Rule 6 ("Runtime provisioning code must apply the same rule as repository
  checks") and Implementation Requirement ("Runtime provisioning code must call the shared
  artifact policy module before downloading or using a provisioned artifact",
  `ARTIFACT_FRESHNESS_POLICY.md:95-96`) are therefore unenforced by the only local gate.

#### F3 (MEDIUM) — `checkNpmLockFreshness` silently passes when lockfile/manifest absent (Policy Rule 5)
- **Status:** Unmet for the missing-input case.
- **Evidence:** Lines 169-171:
  ```js
  if (!(await exists(packageJsonPath)) || !(await exists(lockPath))) {
    return;
  }
  ```
  If `package.json` or `package-lock.json` is missing, the function returns with **no
  failure recorded**, so `main()` can still print "Artifact freshness policy passed."
  (line 248). Binding Rule 5 requires "Every dependency lockfile ... must pass the artifact
  freshness check before commit or release"; a missing lockfile in a Node project should
  not silently pass the gate. Contrast with `checkArtifactManifest` (line 131), which
  *does* fail on a missing `artifacts.json`. The two checks treat absent required inputs
  inconsistently.

#### F4 (MEDIUM) — Waiver `auditReport` location convention not enforced (Quarantine Waiver clause)
- **Status:** Partially met.
- **Evidence:** The policy mandates the audit be committed at a fixed location:
  "The audit report is committed under `security/audits/<package>@<version>.md`"
  (`ARTIFACT_FRESHNESS_POLICY.md:61-63`), and the JSON template fixes
  `"auditReport": "security/audits/<package>@<version>.md"` (lines 73-77). The script
  (lines 101-105) only checks that the file at the waiver-supplied `auditReport` path
  exists via `auditExists` (line 195, `existsSync(join(root, reportPath))`). A waiver could
  point `auditReport` at any arbitrary existing file (e.g. `README.md`) and pass. The
  path-convention and `<package>@<version>` correspondence are not validated, weakening the
  "audited, owner-approved" guarantee that NFR-05 relies on as the sole exception.

#### F5 (LOW) — `--before` cutoff does not implement "at least 7 *full* days old"
- **Status:** Partially met (boundary semantics).
- **Evidence:** `cutoff = new Date(Date.now() - QUARANTINE_DAYS * 24 * 60 * 60 * 1000)`
  (line 10) is exactly "now minus 7×24h". npm `--before` selects versions published before
  that instant. The policy defines eligible as "publication timestamp is at least 7 **full**
  days old" and quarantine as "the first 7 **full** days after a version is published"
  (`project_requirements.md:33`, `ARTIFACT_FRESHNESS_POLICY.md:27,31`). A version published
  exactly 7 days ago minus epsilon sits at the boundary; "full days" implies calendar-day
  flooring, which a raw millisecond subtraction does not implement. Low severity (sub-day
  boundary), but the implementation does not literally encode the "full days" definition.

#### F6 (LOW) — No requirement reference tag (Traceability §10)
- **Status:** Untraceable.
- **Evidence:** The file contains no `@req NFR-05` (or equivalent) tag anywhere; the only
  references are prose pointers to `ARTIFACT_FRESHNESS_POLICY.md` (lines 36, 58, 143). The
  requirements doc's traceability convention is "tagging each test with its requirement ID
  (for example `@req FR-08`)" (`project_requirements.md:151-153`). This enforcement script
  is the primary implementation of NFR-05 yet carries no machine-traceable requirement tag,
  so it will not appear in a generated traceability matrix.

#### F7 (LOW) — npm-failure handler conflates "tool failed" with "policy failed" (Fail-loud clarity)
- **Status:** Advisory.
- **Evidence:** Lines 205-206 catch any error from the npm regeneration (including a
  network outage reaching the registry, an `npm` binary not on PATH, or registry
  unavailability) and record it as `npm freshness check failed: <message>`, which lands in
  the same `failures` list that signals a *policy violation* (exit 1, line 244). An
  environmental/tooling failure and an actual freshness violation are reported through the
  same channel, so a transient infrastructure failure is indistinguishable from a real
  policy breach in the gate's output. This does not violate NFR-05 directly but undermines
  the fail-loud diagnosability the policy's enforcement relies on.

## Coding Convention / Robustness Observations (context, not requirement violations)

- The npm regeneration shells out to the registry (lines 178-188). This is the *check
  tool*, not the conversion path, so it does **not** violate CON-02 / NFR-02 ("no outbound
  network connection during conversion"). Noted to pre-empt a false positive.
- `readJson(join(root, "artifacts.json"))` is re-read inside `checkNpmLockFreshness`
  (line 193) without an existence guard; if `artifacts.json` is absent this throws and is
  swallowed into the generic `npm freshness check failed` message (line 206), masking the
  real cause. Relates to F3/F7 (silent/ambiguous failure handling).

## Recommendations Summary (identification only — no remediation performed)

1. **Critical/High:** F1, F2 — the gate does not enforce NFR-05 over the non-npm artifact
   classes and runtime-provisioning path the policy explicitly covers; these are
   effectively unenforced exceptions the policy forbids.
2. **Important:** F3 (silent pass on missing lockfile), F4 (waiver audit-path convention
   unenforced).
3. **Advisory:** F5 ("full days" boundary), F6 (missing `@req` tag), F7 (tool-vs-policy
   failure conflation).

## Appendix: Severity Counts

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 2 (F1, F2) |
| Medium | 2 (F3, F4) |
| Low | 3 (F5, F6, F7) |
| **Total** | **7** |
