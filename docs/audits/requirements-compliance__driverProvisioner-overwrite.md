# Requirements Compliance Findings: driverProvisioner.ts + overwrite.ts

**Audit Date:** 2026-06-03
**Files Audited:**
- `/home/me/github/md2pdf/src/driverProvisioner.ts`
- `/home/me/github/md2pdf/src/overwrite.ts`
**Reference governance:**
- `/home/me/github/md2pdf/docs/project_requirements.md`
- `/home/me/github/md2pdf/ARTIFACT_FRESHNESS_POLICY.md`
- `/home/me/github/md2pdf/docs/architecture.md`
**Supporting source consulted (not audited):** `src/releaseCatalog.ts`, `src/pipeline.ts`, `src/browserLocator.ts`
**Auditor:** Requirements Compliance Auditor Agent
**Mode:** READ-ONLY forensic audit (no remediation proposed)

---

## Executive Summary

`overwrite.ts` correctly and completely implements the overwrite decision logic
behind FR-12, FR-13, and FR-14, and its wiring in `pipeline.ts` preserves the
required fail-loud / preserve-existing-file behaviour. `driverProvisioner.ts` is
a runtime artifact-provisioning path and is therefore governed by NFR-05 (and the
binding rules of `ARTIFACT_FRESHNESS_POLICY.md`). It applies the 7-day quarantine
via `selectNewestEligible`, but it does **not** support the quarantine-waiver
escape that NFR-05 and the glossary definition of *eligible artifact version*
explicitly mandate, and it derives chromedriver release dates from npm
publish timestamps that it itself documents as differing from the true artifact
publication date by 1–2 days — which can let an artifact clear the 7-day gate
early. Neither audited file carries any requirement-traceability reference.

- **Requirements in scope for these files:** NFR-05 (driverProvisioner); FR-12, FR-13, FR-14 (overwrite); CON-02 / NFR-02 (boundary)
- **Fully implemented:** FR-12, FR-13, FR-14
- **Partially implemented:** NFR-05
- **Untraceable references:** all (no `@req` / requirement tags present)
- **Compliance score (in-scope requirements fully met):** 3 of 4 testable functional/NFR rows ≈ **75%**

---

## Requirement Coverage Matrix

| Requirement | Title | Owning file | Referenced | Implemented | Status |
|---|---|---|---|---|---|
| NFR-05 | Artifact freshness policy | driverProvisioner.ts (+ releaseCatalog.ts) | No tag | Partial (no waiver path; npm-date proxy) | Partial |
| FR-12 | Overwrite prompt | overwrite.ts (+ pipeline.ts) | No tag | Full | Compliant |
| FR-13 | Forced overwrite | overwrite.ts (+ pipeline.ts) | No tag | Full | Compliant |
| FR-14 | Non-interactive overwrite guard | overwrite.ts (+ pipeline.ts) | No tag | Full | Compliant |
| CON-02 / NFR-02 | Local-only / no outbound network during conversion | driverProvisioner.ts | No tag | N/A in scope but boundary-ambiguous | Advisory |

---

## Detailed Findings

### Compliant Requirements

#### FR-12: Overwrite prompt — Compliant
**Requirement (project_requirements.md:81):** "While an interactive terminal
session is active, when the output PDF path already exists and the force-overwrite
option is absent, md2pdf shall prompt the caller to confirm overwriting and shall
preserve the existing file if the caller does not confirm."

**Evidence:** `src/overwrite.ts:12-17` returns `'prompt'` exactly when the output
exists, force is absent, and the session is interactive:
```ts
if (!inputs.outputExists) return 'write';
if (inputs.forceOverwrite) return 'write';
if (inputs.interactive) return 'prompt';
return 'skip';
```
`confirmOverwrite` (`src/overwrite.ts:24-35`) prompts `Overwrite? [y/N]` and only
returns `true` on `y`/`yes`. `src/pipeline.ts:74-81` honours a negative answer by
returning `false` (file preserved) and reporting the skipped path. Default-No
semantics preserve the existing file on empty input. Status: Compliant.

#### FR-13: Forced overwrite — Compliant
**Requirement (project_requirements.md:82):** overwrite without prompting when
`--force-overwrite`/`-f` is supplied, regardless of interactivity.

**Evidence:** `src/overwrite.ts:14` — `if (inputs.forceOverwrite) return 'write';`
is evaluated before the `interactive` check, so force short-circuits the prompt in
both interactive and non-interactive sessions. Status: Compliant.

#### FR-14: Non-interactive overwrite guard — Compliant
**Requirement (project_requirements.md:83):** when not interactive, output exists,
and force absent, leave the existing file unchanged and report the skipped path on
standard error.

**Evidence:** `src/overwrite.ts:16` returns `'skip'` for the non-interactive,
output-exists, no-force case. `src/pipeline.ts:69-72` maps `'skip'` to a
`writeLine(options.stderr, "Skipped existing output: ...")` and `return false`, so
the file is untouched and the skip is reported on stderr. Status: Compliant.

---

### Partial Compliance

#### NFR-05: Artifact freshness policy — Partially Compliant
**Requirement (project_requirements.md:112):** "When any artifact is added,
updated, embedded, locked, referenced, distributed, vendored, generated from a
third-party source, or **provisioned** by md2pdf, md2pdf shall use the newest
eligible artifact version available after a 7-day quarantine period, **except where
an approved quarantine waiver authorises a specific in-quarantine version**; no
other exception, override, bypass, emergency exemption, or force mode exists."

`driverProvisioner.ts` is squarely an artifact "provisioning" path (it downloads
chromedriver/geckodriver binaries — both "driver"/"binary" artifacts per the
glossary definition, project_requirements.md:32), so NFR-05 binds it. Binding Rule
6 of the policy is explicit: "Runtime provisioning code must apply the same rule as
repository checks" (`ARTIFACT_FRESHNESS_POLICY.md:51`), and Implementation
Requirement: "Runtime provisioning code must call the shared artifact policy module
before downloading or using a provisioned artifact" (`ARTIFACT_FRESHNESS_POLICY.md:95-96`).

Two distinct defects prevent full compliance.

##### Defect NFR-05.A (HIGH): No quarantine-waiver path in the runtime provisioning route
**Evidence:** `provisionDriver` selects via `selectNewestEligible`
(`src/driverProvisioner.ts:206`), which is implemented in
`src/releaseCatalog.ts:25-38`:
```ts
export function selectNewestEligible(releases: Release[], now = new Date()): Release {
  const cutoff = quarantineCutoff(now);
  const eligible = releases.filter(r => r.publishedAt.getTime() <= cutoff.getTime());
  if (eligible.length === 0) {
    throw new ArtifactFreshnessError(
      'No release has cleared the 7-day quarantine policy. ...');
  }
  ...
}
```
The filter admits a release **only** when `publishedAt <= cutoff` (i.e. ≥7 days
old). There is no parameter, lookup, or branch that can admit an in-quarantine
version authorised by an approved quarantine waiver.

But NFR-05 and the glossary make the waiver a first-class part of *eligibility*:
*eligible artifact version* = "...at least 7 full days old ... **or one authorised
early by an approved quarantine waiver**" (project_requirements.md:33); *quarantine
waiver* is defined (project_requirements.md:34) and is "the only way to select a
version that is still inside its 7-day quarantine" (`ARTIFACT_FRESHNESS_POLICY.md:55`).

Consequence: the runtime provisioning path's notion of "eligible" is **narrower**
than the requirement's. A driver version that the project owner has lawfully waived
(audit committed, owner-approved, recorded in `artifacts.json`) would still be
rejected by `provisionDriver` with `ArtifactFreshnessError`. This is a partial
implementation of NFR-05: the 7-day arm is honoured, the waiver arm is absent.
`provisionDriver` also never reads `artifacts.json` or any waiver source, so the
"shared artifact policy module" mandated by `ARTIFACT_FRESHNESS_POLICY.md:95-96`
is not consulted for waivers at all. Severity: HIGH (a mandated exception channel
is unreachable from the runtime path the requirement names explicitly).

##### Defect NFR-05.B (MEDIUM): chromedriver eligibility dated from npm publish time, a self-documented 1–2 day proxy
**Evidence:** Header comment, `src/driverProvisioner.ts:5-8`:
```
 *   - chromedriver — dates come from the npm registry (the `chromedriver`
 *     package mirrors official releases within 1-2 days, well within the
 *     quarantine margin).
```
`fetchChromedriverReleases` sets `publishedAt: new Date(dateStr)` where `dateStr`
comes from the npm registry `time` map (`src/driverProvisioner.ts:130-144`), and
that `publishedAt` is what `selectNewestEligible` compares against the 7-day cutoff
(`releaseCatalog.ts:27`). The download itself, however, is the binary from
`storage.googleapis.com/chrome-for-testing-public/...` (`driverProvisioner.ts:143`),
whose true publication timestamp is the Chrome-for-Testing release time, not the
npm mirror time.

NFR-05 / glossary anchor eligibility on "publication timestamp ... at least 7 full
days old at the time md2pdf ... provisions it" (project_requirements.md:33). Using
the npm mirror timestamp as a proxy means the measured age can differ from the true
artifact age by the 1–2 days the comment itself admits. Because the npm package is
published *after* the upstream release in the stated direction (mirrors "within
1-2 days"), the npm timestamp is **later** than the true publication; comparing
against it makes the artifact appear *younger* than it is, which is conservative for
the lower bound — but the code provides no guarantee of the direction and no
tolerance margin, and the requirement demands the artifact's own publication
timestamp, not a third-party mirror's. The "well within the quarantine margin"
claim in the comment is an unverified assertion, not an enforced invariant.
Severity: MEDIUM (eligibility computed from a proxy timestamp the requirement does
not sanction; magnitude bounded to ~1–2 days but unenforced).

##### Note NFR-05.C (informational): geckodriver dating is correct
`fetchGeckodriverReleases` uses `rel.published_at` straight from the GitHub
Releases API (`src/driverProvisioner.ts:170`), which is the artifact's own
publication time. This arm is consistent with NFR-05's timestamp basis. No defect.

---

### Boundary / Advisory

#### CON-02 / NFR-02: Local-only processing — boundary ambiguity (Advisory)
**Requirements:** CON-02 (project_requirements.md:41) forbids transmission of
Markdown sources/PDFs to external services; NFR-02 (project_requirements.md:109)
requires "no outbound network connection **during conversion**."

`provisionDriver` opens outbound connections: `fetchJson` to
`registry.npmjs.org` / `api.github.com` (`driverProvisioner.ts:62-69`, 130, 158)
and `fetchBinary` to `storage.googleapis.com` (`driverProvisioner.ts:71-78`, 214).
These transmit no Markdown content (only a static `User-Agent`,
`driverProvisioner.ts:64,73`), so CON-02's confidentiality clause is not violated.

NFR-02 scopes its prohibition to "during conversion." Driver provisioning is a
setup/install-time activity, so it is arguably outside NFR-02's window. The
**defect is the absence of any enforced boundary**: nothing in `driverProvisioner.ts`
or its caller (`browserLocator.ts:275`) marks these network calls as non-conversion
or guards them from running inside the conversion path. The requirement set offers
no requirement asserting that provisioning is excluded from "conversion," so whether
a provisioning download triggered lazily during a convert run violates NFR-02 is
**untraceable** from the documents. Flagged as an advisory contradiction-risk
between the runtime network behaviour here and NFR-02/CON-02, not a confirmed
violation. Severity: LOW.

---

## Traceability Findings

#### TRACE-01 (LOW): No requirement references in either audited file
Neither `src/driverProvisioner.ts` nor `src/overwrite.ts` contains any `@req`,
requirement ID, or pointer to NFR-05 / FR-12 / FR-13 / FR-14. A repository-wide
`grep -rn "@req" src/` returns nothing. project_requirements.md:148-153 directs
that traceability be maintained by tagging (the example given is test-level
`@req FR-08`), and the audited overwrite logic and provisioning logic are the
sole implementations of FR-12/13/14 and the runtime arm of NFR-05 respectively.
The absence of any in-code requirement anchor means the link from these
must-have requirements to their implementation is untraceable from the source.
Severity: LOW (process/traceability, not behaviour).

---

## Correctness Findings Affecting Requirement Reliability

These are not direct requirement violations but degrade the reliability of the
FR-coverage the file is responsible for (driver provisioning underpins the
PDF-rendering pipeline via Playwright/driver download).

#### CORR-01 (MEDIUM): Dead / self-contradicting archive-extension logic for geckodriver
**Evidence:** `src/driverProvisioner.ts:153-156`:
```ts
const ext = isWindows || platformId.startsWith('linux') && !platformId.includes('linux')
  ? '.zip'
  : platformId.startsWith('win') ? '.zip' : '.tar.gz';
const actualExt = platformId.startsWith('win') || platform() === 'win32' ? '.zip' : '.tar.gz';
```
`platformId.startsWith('linux') && !platformId.includes('linux')` is a tautological
contradiction — it is always `false` (a string starting with `'linux'` always
contains `'linux'`). The whole `ext` binding is then never read again; only
`actualExt` is used at `driverProvisioner.ts:165`. The presence of a dead,
nonsensical variable next to the one actually in use indicates the extension
selection was reworked without removing the abandoned attempt, raising the risk
that the live `actualExt` (which also redundantly checks Windows two ways) was not
validated across all geckodriver platform IDs (e.g. `macos-aarch64`, `linux-aarch64`).
A wrong extension yields the wrong `assetName` (`driverProvisioner.ts:165`), no
matching asset, and a spurious `DriverNotFoundError`. Severity: MEDIUM (latent
provisioning-failure risk; undermines the driver download that the rendering
pipeline depends on).

#### CORR-02 (LOW): Redundant permission setting on the written binary
**Evidence:** `src/driverProvisioner.ts:232-235`: `writeFileSync(destPath,
binaryData, { mode: 0o755 })` is immediately followed by `chmodSync(destPath,
0o755)` on non-Windows. The `writeFileSync` `mode` only applies to newly-created
files and is also masked by the process umask, while the subsequent `chmodSync`
forces `0o755` unconditionally — so the `mode` option on `writeFileSync` is
redundant (the chmod is the effective one) and the two together obscure intent.
No requirement violated. Severity: LOW.

---

## Recommendations Summary (identification only — no remediation performed)

1. **High:** NFR-05.A — the runtime provisioning path (`provisionDriver` →
   `selectNewestEligible`) cannot honour an approved quarantine waiver, contradicting
   NFR-05 (project_requirements.md:112), the glossary (project_requirements.md:33),
   and `ARTIFACT_FRESHNESS_POLICY.md:51,95-96`.
2. **Medium:** NFR-05.B — chromedriver eligibility computed from npm mirror
   timestamps, a self-documented ~1–2 day proxy, not the artifact's own publication
   timestamp as NFR-05 requires.
3. **Medium:** CORR-01 — dead, tautologically-false `ext` logic alongside the live
   `actualExt`, signalling unvalidated geckodriver extension selection.
4. **Low:** CON-02/NFR-02 boundary ambiguity for provisioning network calls;
   TRACE-01 missing requirement references; CORR-02 redundant chmod.

---

## Severity Tally

| Severity | Count | Findings |
|---|---|---|
| Critical | 0 | — |
| High | 1 | NFR-05.A |
| Medium | 2 | NFR-05.B, CORR-01 |
| Low | 3 | CON-02/NFR-02 boundary, TRACE-01, CORR-02 |
| **Total** | **6** | |

(NFR-05.C is an informational note confirming compliance and is not counted.)

---

## Appendix: Requirements in scope and disposition

| Requirement | Disposition |
|---|---|
| FR-12 Overwrite prompt | Met (overwrite.ts:15 + pipeline.ts:74-81) |
| FR-13 Forced overwrite | Met (overwrite.ts:14) |
| FR-14 Non-interactive guard | Met (overwrite.ts:16 + pipeline.ts:69-72) |
| NFR-05 Artifact freshness | Partially met (7-day arm yes; waiver arm no; npm-date proxy) |
| CON-02 / NFR-02 | Not violated by content; boundary untraceable |
| Out of scope for these files | FR-01–11, FR-15–24, NFR-01/03/04, CON-01/03 |
