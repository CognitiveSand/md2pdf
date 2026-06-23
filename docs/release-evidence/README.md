# md2pdf - Release Evidence

This directory stores the versioned evidence required to validate an md2pdf
release. Evidence kept here must be readable from the repository alone: a
reviewer should not need a fragile PR comment, local terminal history, or an
untracked generated file to understand what was checked.

## Purpose

Release evidence records the automatic and manual checks that prove a release
candidate satisfies the requirements, installation expectations, artifact
policy, and documented architecture decisions for md2pdf.

P0 creates the evidence structure before C0 starts. Some entries are expected to
remain `pending` until C0, P4, or the release candidate exists, but no required
evidence should be left blank or implied.

## Evidence Status

Use one of these statuses for every checklist item or evidence field that cannot
yet contain a final result:

| Status | Meaning |
| --- | --- |
| `pending` | Required evidence exists as a placeholder, but the check cannot be completed yet. |
| `pass` | The check was run and the observed result matched the expected result. |
| `fail` | The check was run and the observed result did not match the expected result. |
| `blocked` | The check could not run because a required environment, artifact, or prior phase is missing. |
| `n/a` | The check is explicitly not applicable, with a documented reason. |

Blank statuses are not valid release evidence.

## Automatic Evidence

Automatic evidence should capture the command, environment, expected result, and
observed result for these checks:

- `npm run typecheck`;
- unit tests;
- contract tests;
- integration tests;
- browser-backed tests, when required by the release gate;
- `npm run check:artifacts` or the equivalent artifact freshness gate;
- npm packlist verification;
- CI matrix results for Linux, macOS, and Windows;
- regeneration of `dist/` from `src/`.

When a command is impossible during P0 because `src/` does not exist yet, record
the status as `pending` or `blocked` in the release checklist instead of treating
the missing command result as success.

## Manual Evidence

Manual evidence is required when the behavior cannot be fully proven by the
automated test suite. It includes:

- FR-20 system-scope availability;
- review of CLI options exposed by `md2pdf --help`;
- review that README usage and CLI options stay synchronized;
- review of defensive decisions and their linked test or documentation proof;
- logs, terminal output, screenshots, or notes needed to support a release
  claim.

Manual evidence must be committed in this directory. PR comments or local notes
can supplement the evidence, but they do not replace the versioned record.

## Required Metadata

Every evidence file must include:

- md2pdf version tested;
- date;
- OS and exact version, when environment-specific;
- Node.js and npm versions, when command execution is involved;
- command or manual procedure used;
- expected result;
- observed result;
- status;
- author of the evidence.

Release-candidate evidence should also include the commit SHA and, when a
package artifact exists, the npm tarball name or pack output used for the check.

## Versioning Rules

- All manual release evidence must be versioned in Git.
- Evidence must not depend on untracked generated files.
- Evidence must not use `dist/` as a source of truth; `dist/` is valid evidence
  only when regenerated from `src/` and tied to a command result.
- Evidence for artifact freshness must reference `ARTIFACT_FRESHNESS_POLICY.md`
  and `artifacts.json`.
- Evidence should stay concise but complete enough to be reviewed without
  external context.

## Expected Files

P0 creates the release evidence structure with:

- `fr-20-system-scope.md`: fillable FR-20 manual proof template;
- `release-checklist-v0.1.2.md`: release checklist for gates, manual evidence,
  packlist, C0 red/green trace, defensive decisions, and architecture alignment.
