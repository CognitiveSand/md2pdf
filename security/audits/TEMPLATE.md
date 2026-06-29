# Security Audit — &lt;package&gt;@&lt;version&gt;

> This directory holds the upstream security audits that back quarantine waivers,
> per `ARTIFACT_FRESHNESS_POLICY.md` ("Quarantine Waiver"). Write one report per
> audited in-quarantine version, named `<package>@<version>.md`, and reference it
> from the matching entry in the `waivers` array of `artifacts.json`. Copy this
> template; do not edit `TEMPLATE.md` in place.

- **Package:** &lt;npm package name&gt;
- **Version:** &lt;exact version under audit&gt;
- **Upstream source:** &lt;repository URL + reviewed git tag or commit&gt;
- **Auditor:** &lt;name&gt;
- **Audit date:** &lt;YYYY-MM-DD&gt;

## Why early adoption is needed

&lt;What this in-quarantine version is needed for, and why waiting out the
remaining quarantine days is not acceptable.&gt;

## Scope reviewed

&lt;Commit or diff range reviewed, files inspected, build and publish provenance,
and dependency changes since the last eligible version.&gt;

## Findings

&lt;Vulnerabilities, suspicious changes, maintainer or account-takeover signals,
and supply-chain risks. "None found" is a valid finding when justified.&gt;

## Conclusion

&lt;Explicit statement that this version is safe to adopt early, with any residual
risks noted.&gt;

---

Approval is recorded in `artifacts.json` (`waivers[].approvedBy` and
`approvedOn`), not in this file.
