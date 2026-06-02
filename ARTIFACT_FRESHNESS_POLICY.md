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

There is no exception, override, bypass, emergency exemption, or force mode.

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
  Versions inside this period are ineligible.

## Binding Rules

1. md2pdf must never use `latest` directly when selecting an artifact version.
2. md2pdf must select `newest eligible`, not merely any version older than 7
   days.
3. A version that has not completed quarantine is ineligible regardless of
   urgency, release type, caller intent, or author.
4. Every non-npm artifact must be declared in `artifacts.json`.
5. Every dependency lockfile, vendored asset, runtime provisioning path, and
   release package must pass the artifact freshness check before commit or
   release.
6. Runtime provisioning code must apply the same rule as repository checks.

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
