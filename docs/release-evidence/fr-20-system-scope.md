# FR-20 System-Scope Availability Evidence

Requirement: FR-20 - When md2pdf is installed as a system-scope installation,
md2pdf shall be invocable by each user account on the host.

Status: `pending`

This evidence file is created during P0. It must be completed for the release
candidate that claims FR-20. Until the system-scope installation check is run,
leave executable-result fields as `pending`; do not leave required fields blank.

## Evidence Metadata

| Field | Value |
| --- | --- |
| md2pdf version tested | `pending` |
| Commit SHA | `pending` |
| npm tarball or package source | `pending` |
| Date | `pending` |
| Author | `pending` |
| Status | `pending` |

## Environment

| Field | Value |
| --- | --- |
| OS and exact version | `pending` |
| CPU architecture | `pending` |
| Node.js version | `pending` |
| npm version | `pending` |
| Shell used | `pending` |

## System-Scope Installation

| Field | Value |
| --- | --- |
| Installation command used | `pending` |
| Elevated privilege mechanism | `pending` |
| Installation target path | `pending` |
| Installed binary path invoked | `pending` |

## Account Coverage

Use a real secondary user account whenever possible. A simulation is acceptable
only when it documents why a real secondary account was unavailable and proves
the same observable contract: the system-scope binary is on the invoked account's
PATH and `md2pdf --help` runs from that account context.

| Field | Value |
| --- | --- |
| Primary/installing account | `pending` |
| Secondary account tested | `pending` |
| Simulation used instead of secondary account | `pending` |
| Simulation justification, if used | `pending` |
| Command used to switch or simulate account | `pending` |

## Command Under Test

```bash
pending
```

Expected command shape:

```bash
md2pdf --help
```

If the binary is invoked by absolute path, record that path in "Installed binary
path invoked" and show the exact command here.

## `md2pdf --help` Output

```text
pending
```

## Expected Result

- The command is invocable from the tested account context.
- The command exits with status `0`.
- The help output lists the supported md2pdf CLI options.
- No TeX or LaTeX installation is required for command availability.

## Observed Result

| Field | Value |
| --- | --- |
| Command exit status | `pending` |
| Was `md2pdf` invocable from the tested account? | `pending` |
| Did help output render successfully? | `pending` |
| Was TeX/LaTeX required? | `pending` |
| Deviations from expected result | `pending` |

## Reviewer Notes

```text
pending
```
