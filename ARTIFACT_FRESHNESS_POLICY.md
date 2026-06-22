# Artifact Freshness Policy

Every artifact in md2pdf must be the newest eligible version available after a
7-day quarantine period.

This policy applies to every artifact that is used, embedded, locked,
distributed, referenced, vendored, generated from a third-party source, or
provisioned by the project.

The policy is actor-independent. It applies equally to humans, LLMs,
automation, dependency bots, scripts, local Git hooks, and runtime provisioning
code. Compliance is enforced by local repository checks, not by trusting the
modifier.

There is no emergency exemption and no force mode. The single permitted
exception is a **quarantine waiver** (see "Quarantine Waiver" below): a
deliberate, audited, owner-approved decision to select one specific
in-quarantine version. There is no other override or bypass.

## Definitions

- **Artifact**: Any third-party package, transitive dependency, binary, driver,
  runtime helper, browser build, bundled engine, stylesheet, font, template,
  generated vendor file, or external asset that is part of md2pdf's codebase,
  distribution, installation, or runtime provisioning path.
- **Eligible version**: A released version whose publication timestamp is at
  least 7 full days old at the time it is selected.
- **Newest eligible version**: The eligible version with the most recent
  publication timestamp, after applying compatibility constraints such as a
  required browser major version.
- **Quarantine period**: The first 7 full days after a version is published.
  Versions inside this period are ineligible unless covered by a quarantine
  waiver.
- **Quarantine waiver**: A recorded, project-owner-approved exception, granted
  only after a full security audit committed in-repo, that makes one specific
  in-quarantine artifact version eligible early. Defined under "Quarantine
  Waiver" below.
- **System-bundled WebDriver**: A WebDriver shipped as an inseparable part of a
  user-installed browser and version-matched to it by that browser's publisher
  (for example, the geckodriver the Firefox snap supplies). md2pdf does not
  download, version, lock, or provision it; like the installed browser itself,
  it is part of the user's environment, not an md2pdf artifact. Defined under
  "System-Bundled WebDriver" below.

## Binding Rules

1. md2pdf must never use `latest` directly when selecting an artifact version.
2. md2pdf must select `newest eligible`, not merely any version older than 7
   days.
3. A version that has not completed quarantine is ineligible regardless of
   urgency, release type, caller intent, or author, unless it is covered by an
   approved quarantine waiver (see "Quarantine Waiver").
4. Every non-npm artifact must be declared in `artifacts.json`. A system-bundled
   WebDriver (see Definitions and "System-Bundled WebDriver") is an environment
   input, not an md2pdf artifact, and is exempt from this requirement.
5. Every dependency lockfile, vendored asset, runtime provisioning path, and
   release package must pass the artifact freshness check before commit or
   release.
6. Runtime provisioning code must apply the same rule as repository checks.

## Quarantine Waiver

A quarantine waiver is the only way to select a version that is still inside its
7-day quarantine. It is an audited, owner-approved exception — never an
emergency bypass or force mode. Granting one requires all of the following:

1. **Full security audit.** A full security audit of the specific version's
   upstream source repository is performed and written up.
2. **Audit committed in-repo.** The audit report is committed under
   `security/audits/<package>@<version>.md`, so the rationale is versioned and
   reviewable alongside the code that relies on it.
3. **Owner approval.** The project owner reviews the audit and approves the
   waiver; the approval is recorded in the waiver entry (`approvedBy`,
   `approvedOn`).

The waiver is recorded as an entry in the `waivers` array of `artifacts.json`:

```json
{
  "package": "<npm package name>",
  "version": "<exact waived version>",
  "auditReport": "security/audits/<package>@<version>.md",
  "approvedBy": "<approver>",
  "approvedOn": "<YYYY-MM-DD>"
}
```

The artifact freshness check enforces every waiver. It exempts the waived
package from the newest-eligible comparison only when the package is locked at
exactly the waived version and the referenced audit report exists in the
repository. A waiver that is malformed, points at a missing audit report, or
disagrees with the locked version fails the check. A waiver applies to exactly
one package version; it is not a standing exemption and does not extend to that
package's transitive dependencies, each of which must itself be eligible or
separately waived.

## System-Bundled WebDriver

This policy governs artifacts md2pdf selects, provisions, embeds, locks, or
distributes. A system-bundled WebDriver is none of these: it is supplied with,
and version-matched to, a browser the user installed, and is inseparable from
it. Like the user's browser, it is an environment input — outside the
newest-eligible and `artifacts.json`-declaration requirements — and may be used
only under all of the following:

1. **Matched pair only.** Used solely to drive the co-installed browser it ships
   with; never as a general driver for other browsers, and never selected as an
   arbitrary environment driver independent of its browser.
2. **No provisioned alternative.** Used only when a provisioned, catalog-governed
   driver cannot drive that browser — for example, when sandbox confinement
   prevents an externally-provisioned driver from controlling it.
3. **Compatibility-validated.** Accepted only after a compatibility check
   confirms it can drive the installed browser; if that check fails, md2pdf
   falls back to a fully policy-governed provisioned browser and driver.
4. **No effect on provisioned artifacts.** Every browser or driver md2pdf itself
   provisions remains fully subject to newest-eligible, quarantine, and
   `artifacts.json` declaration. This carve-out narrows nothing else.

Rationale: a publisher-bundled driver is version-matched to its browser and so
is compatible by construction — often more reliable than an externally-provisioned
substitute, which for a confined browser is also unusable. This exception covers
only the user's environment; it grants no general permission to select drivers
from `PATH`.

## Implementation Requirements

- npm dependencies are checked through `package-lock.json` and registry release
  timestamps.
- Non-npm artifacts are checked through `artifacts.json` and the release catalog
  implementation for their source.
- Runtime provisioning code must call the shared artifact policy module before
  downloading or using a provisioned artifact.
- The local pre-commit hook must run the artifact freshness check as a required
  gate for local changes.
- Renovate or any other dependency automation must wait for the 7-day
  quarantine before proposing or applying updates.
