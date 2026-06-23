# Stream A Phase 1 Point 1 Artifact Freshness Audit - 2026-06-08

Verdict: **GO for Phase 1 point 1.2**.

No blocking issue was found after the artifact freshness correction.

## Scope

- Requirement: `docs/stream-a-implementation-plan-2026-06-08.md`, Phase 1,
  point 1.1, "Corriger le blocage artifact freshness".
- Policy: `ARTIFACT_FRESHNESS_POLICY.md`.
- Files inspected:
  - `.gitattributes`
  - `assets/highlight.css`
  - `artifacts.json`
  - `scripts/checkArtifactFreshness.mjs`

## Requirement and User Story Compliance

| Requirement | Status | Evidence | Problem |
| --- | --- | --- | --- |
| Restore artifact freshness gate without bypassing policy | Respected | `npm.cmd run check:artifacts` passed after correction. | None blocking. |
| Determine normative source for `assets/highlight.css` | Respected | `artifacts.json:9-16` declares the artifact path, version, SHA-256 and size; the corrected working-tree file now matches `1419` bytes and SHA-256 `c3c4ac152532aa6d9cfdeb8fd9562c13c432e5685ac58bf02d5a72e58760be1e`. | None blocking. |
| Do not introduce a new third-party artifact without newest-eligible verification | Respected | No new third-party artifact was added; the existing declared artifact content was restored to the declared LF byte representation. | None blocking. |
| Keep artifact checkout stable on Windows | Respected | `.gitattributes:1` forces `assets/highlight.css text eol=lf`. | None blocking. |

## Negative Findings

No blocking findings.

### Residual Risk 1

Severity: Low

File: `.gitattributes`

Line: 1

Problem: The fix depends on the new EOL rule being kept with the artifact. If
`.gitattributes` is omitted from the final change set, Windows checkout can
convert the CSS back to CRLF and reproduce the failed hash/size check.

Risk: The artifact gate can become platform-dependent again.

Evidence: Before correction, the Git blob size was `1419`, but the Windows
working-tree file was `1516`; after adding `.gitattributes:1` and restoring LF,
the working-tree file matches `artifacts.json:14-15`.

Suggested fix: Keep `.gitattributes` in the final change set.

Test needed: `npm.cmd run check:artifacts` on Windows and on a LF-native
checkout.

## Validation

Command:

```text
npm.cmd run check:artifacts
```

Result:

```text
Artifact freshness policy passed.
```

Manual hash/size check:

```text
assets/highlight.css
size: 1419
sha256: c3c4ac152532aa6d9cfdeb8fd9562c13c432e5685ac58bf02d5a72e58760be1e
```

## Summary

The original blocker was an EOL mismatch: the declared artifact matched the LF
Git blob, while the Windows working tree had CRLF bytes. The correction restores
the declared artifact bytes and adds an EOL rule so the freshness gate is stable.
Stream A may continue to Phase 1 point 1.2.
