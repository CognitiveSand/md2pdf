# Requirements Compliance Findings

**Audit date:** 2026-06-03
**Audit type:** Read-only forensic requirements-compliance audit (no remediation proposed)
**Files audited:**
- `src/webDriverClient.ts`
- `src/converter.ts`
- `src/releaseCatalog.ts`

**Governing documents:** `docs/project_requirements.md`, `docs/architecture.md`, `docs/user_stories.md`, `ARTIFACT_FRESHNESS_POLICY.md`

---

## Executive summary

The three audited modules are broadly aligned with the architecture's component
responsibilities, but the audit surfaces one **high-severity requirements gap**
in `releaseCatalog.ts`: the NFR-05 / `ARTIFACT_FRESHNESS_POLICY.md` *quarantine
waiver* exception — the single permitted way to use an in-quarantine artifact —
is **not implementable** through `selectNewestEligible`, the function the runtime
driver-provisioning path actually calls. The function has no waiver input and
unconditionally rejects in-quarantine versions, so the requirement's mandated
exception is untraceable to this code path.

A cluster of **medium** findings concerns FR-07 (heading page-break integrity)
and CON-02 / NFR-02 (local-only). `webDriverClient.ts` is the layer that issues
the WebDriver `print` command and constructs browser sessions, yet (a) the Print
parameters it sends omit any paged-media control that would let the browser honor
the FR-07 orphan-avoidance CSS being relied on by the architecture, and the
audited code carries no requirement reference for FR-07; and (b) `webDriverClient.ts`
itself opens outbound-shaped HTTP sockets and contains **no enforcement** that the
loaded document is local — the local-only guarantee is entirely delegated to
capabilities built in `pdfRenderer.ts`, with no defensive check in this module.

A set of **low** findings concerns traceability hygiene: none of the three files
carries any `@req` tag (the project's own traceability convention, `docs/project_requirements.md`
§10), and two of the three modules (`webDriverClient.ts`, `releaseCatalog.ts`) are
**not named in the architecture component view** (`docs/architecture.md` §5 / §12),
so their requirement ownership is implicit rather than documented.

**Severity counts:** Critical 0 · High 1 · Medium 4 · Low 4 · **Total 9**

---

## Requirement coverage matrix (audited files only)

| Requirement | Owning audited file | Status | Finding |
|---|---|---|---|
| NFR-05 — Artifact freshness w/ waiver exception | `releaseCatalog.ts` | **Partially met** | F-1 (High), F-7 (Low) |
| FR-07 — Heading page-break integrity | `webDriverClient.ts` (Print params) | **Partially met / untraceable** | F-2 (Medium) |
| CON-02 / NFR-02 — Local-only, no network | `webDriverClient.ts` | **Partially met** | F-3 (Medium), F-4 (Medium) |
| FR-15 — Missing-input reporting | `converter.ts` | **Partially met** | F-5 (Medium) |
| FR-01 / FR-16 — Single-file conversion, no partial output | `converter.ts` | **Met** | (evidence noted) |
| Traceability tagging (req §10) | all three | **Unmet** | F-6 (Low) |
| Architecture component coverage (§5) | `webDriverClient.ts`, `releaseCatalog.ts` | **Unmet** | F-8, F-9 (Low) |

---

## Detailed findings

### F-1 — HIGH — `releaseCatalog.ts` cannot express the NFR-05 quarantine-waiver exception; the runtime path silently has no waiver support

**Requirement.** NFR-05 (`docs/project_requirements.md:112`):

> "...md2pdf shall use the newest eligible artifact version available after a
> 7-day quarantine period, **except where an approved quarantine waiver
> authorises a specific in-quarantine version**; no other exception, override,
> bypass, emergency exemption, or force mode exists."

The glossary defines *eligible artifact version* (`docs/project_requirements.md:33`)
as a release "...whose publication timestamp is at least 7 full days old ... **or
one authorised early by an approved quarantine waiver.**" `ARTIFACT_FRESHNESS_POLICY.md`
Binding Rule 6 states "Runtime provisioning code must apply the same rule as
repository checks," and Rule 3 makes the waiver the *only* exception.

**Evidence.** `selectNewestEligible` (`src/releaseCatalog.ts:25-38`) takes only
`(releases, now)` and unconditionally discards every in-quarantine release:

```ts
export function selectNewestEligible(releases: Release[], now = new Date()): Release {
  const cutoff = quarantineCutoff(now);
  const eligible = releases.filter(r => r.publishedAt.getTime() <= cutoff.getTime());

  if (eligible.length === 0) {
    throw new ArtifactFreshnessError(
      'No release has cleared the 7-day quarantine policy. ' +
        'Wait for a release that is at least 7 days old.',
    );
  }
  ...
}
```

There is **no parameter, branch, or hook** by which an approved, recorded
waiver for a specific in-quarantine version could make that version selectable.
`isEligible` (`src/releaseCatalog.ts:11-13`) is likewise waiver-blind. The
*runtime* provisioning path consumes exactly this function:
`src/driverProvisioner.ts:206` — `best = selectNewestEligible(releases) as DriverRelease;`
— with no waiver argument, so the runtime can never honor an owner-approved
waiver for a driver (`chromedriver`/`geckodriver`) build, which is precisely an
"artifact ... provisioned by md2pdf" under NFR-05.

**Impact.** The requirement's *single permitted exception* is untraceable to the
runtime artifact-selection code. If a waiver were ever granted (e.g. a security
fix in an in-quarantine `chromedriver`), the runtime would still throw
`ArtifactFreshnessError` and refuse to provision, contradicting the requirement.
The waiver mechanism that *does* exist (`tests/unit/checkArtifactFreshness.test.ts:80`
exercises a repo-side lockfile check) is a *separate* enforcement surface; the
runtime selection function audited here is not consistent with it, violating
ARTIFACT_FRESHNESS_POLICY Binding Rule 6 ("same rule as repository checks").

**Classification:** Partially met (the 7-day-quarantine half is correct and
well-tested; the mandated waiver-exception half is absent from this module and
its runtime caller).

---

### F-2 — MEDIUM — `webDriverClient.ts` Print command omits any paged-media control for FR-07, and the file carries no FR-07 reference

**Requirement.** FR-07 (`docs/project_requirements.md:76`): "md2pdf shall render
the output PDF such that no heading is the last rendered line on a page."
Architecture §10 (`docs/architecture.md:184-191`) states FR-07 is "expressed in
CSS" via `break-after: avoid-page` and that "Both Chromium and Firefox honor CSS
paged-media break rules **in their print engines**." Architecture §5
(`docs/architecture.md:107`) assigns FR-07 to `pdfRenderer.ts`
(`WebDriverPdfRenderer`), whose Print step is implemented through this audited
module.

**Evidence.** `printPage` (`src/webDriverClient.ts:106-127`) sends only
`page`, `margin`, `background`, and `shrinkToFit`:

```ts
const params = {
  page: options.page ?? A4,
  margin: options.margin ?? DEFAULT_MARGIN,
  background: options.background ?? true,
  shrinkToFit: options.shrinkToFit ?? true,
};
```

`shrinkToFit` defaults to `true` (`src/webDriverClient.ts:115`). Under the W3C
WebDriver Print spec, `shrinkToFit` scales content to fit the page; combined with
the absence of any explicit assertion or option preserving CSS page-break
fidelity, FR-07's "no orphaned heading" guarantee rests entirely on browser CSS
honoring that this module does not exercise or verify. The FR-07 verification
method is **Test** (`docs/project_requirements.md:76`), but no requirement tag or
comment in this file links the Print parameters to FR-07, leaving the link
untraceable from the code that actually issues the print.

**Impact.** FR-07 compliance is delegated implicitly to browser behavior with no
in-code anchor; a future change to `shrinkToFit`/`margin` defaults here could
silently regress FR-07 with nothing in this file flagging the requirement
dependency.

**Classification:** Partially met / untraceable.

---

### F-3 — MEDIUM — `webDriverClient.ts` performs no local-only enforcement; CON-02/NFR-02 are wholly delegated with no defensive guard in this module

**Requirement.** CON-02 (`docs/project_requirements.md:41`) and NFR-02
(`docs/project_requirements.md:109`): no outbound network connection during
conversion. Architecture §9 (`docs/architecture.md:170-178`) calls the guarantee
"structural ... by construction," and §5 (`docs/architecture.md:107`) attaches
NFR-02 to `pdfRenderer.ts`.

**Evidence.** This module is the layer that drives navigation and the browser
session. `navigateTo` (`src/webDriverClient.ts:65-71`) forwards **any** `url`
string to the browser with no scheme check:

```ts
export async function navigateTo(port, sessionId, url): Promise<void> {
  await wd(port, 'POST', `/session/${sessionId}/url`, { url });
}
```

Nothing in `webDriverClient.ts` asserts the navigated URL is a `file:` URL, and
the offline/no-proxy enforcement lives entirely in capabilities built elsewhere
(`src/pdfRenderer.ts:67-98`, e.g. `--no-proxy-server`, `network.proxy.type: 0`).
The audited module — the one named "WebDriver client" and most directly
responsible for what the browser is told to load — has **no defensive check** for
the local-only invariant the project treats as a hard guarantee. Architecture §9
itself admits "WebDriver does not offer Playwright-style request interception,"
so the only structural guard is asset-inlining + capabilities, neither of which
this module enforces or re-validates at its boundary.

**Impact.** A caller passing an `http://`/`https://` URL to `navigateTo` would
silently violate CON-02/NFR-02; the guarantee depends entirely on upstream
discipline with no fail-loud boundary check here (cf. AGENTS §8 "validate at
boundaries"). The requirement is met in the assembled system but is not traceable
to, nor enforced by, this module.

**Classification:** Partially met.

---

### F-4 — MEDIUM — `webDriverClient.ts` opens TCP sockets to a localhost port with no assertion it is a locally-spawned driver

**Requirement.** CON-02 / NFR-02 (as F-3). Architecture §4 stage 4
(`docs/architecture.md:88-91`) describes driving a *locally launched* driver.

**Evidence.** Every request targets `http://127.0.0.1:${port}` (`src/webDriverClient.ts:12-14`)
and `waitForDriverReady` polls `${base(port)}/status` (`src/webDriverClient.ts:140-143`).
The `port` is supplied by the caller (`pdfRenderer.ts` derives it from a free-port
probe and spawns the driver). While loopback-only is correct in intent, the
module trusts the `port` argument blindly and issues real `fetch` network calls
(`src/webDriverClient.ts:23-28`, `:140-142`). A test asserting "no external URL"
(architecture §9 / R-3, `docs/architecture.md:313-316`) covers the *assembled
HTML*, not this client's socket activity; NFR-02's verification is **Test**
(`docs/project_requirements.md:109`) but the audited module exposes network I/O
that the stated NFR-02 test surface does not cover.

**Impact.** Minor in practice (loopback), but the module's network surface is
unverified against NFR-02, and a non-loopback `base(port)` change would not be
caught by the existing NFR-02 test described in the architecture.

**Classification:** Partially met.

---

### F-5 — MEDIUM — `converter.ts` conflates FR-15 (missing/unreadable input) with FR-16 (un-renderable content) under a single `ConversionError`

**Requirement.** FR-15 (`docs/project_requirements.md:84`): an input path that
"does not exist or cannot be read" shall be reported on stderr and excluded.
FR-16 (`docs/project_requirements.md:85`): un-renderable *content* shall be
reported "rather than write a partial output PDF." Architecture §8
(`docs/architecture.md:156-159`) specifies **distinct** error types:
"missing/unreadable input → `InputNotFoundError`; un-renderable content →
`RenderError`."

**Evidence.** On a read failure `convertFile` throws a generic `ConversionError`
(`src/converter.ts:30-35`):

```ts
} catch (err) {
  throw new ConversionError(
    `Cannot read source file: ${(err as Error).message}`,
    sourcePath,
  );
}
```

The architecture-mandated `InputNotFoundError` type **does not exist** in
`src/errors.ts` (the hierarchy defines `ConversionError`, `BrowserNotFoundError`,
`DriverNotFoundError`, `RenderError`, `ArtifactFreshnessError` — no
`InputNotFoundError`; confirmed `src/errors.ts:1-87`). This is a code-vs-architecture
contradiction: architecture §8 names a type the code never defines, and
`converter.ts` collapses the FR-15 missing-input case into the same generic
class used for every other single-file failure, removing the FR-15/FR-16
distinction the architecture relies on for stderr classification.

Note in mitigation: missing-*entry* reporting (FR-15) is largely handled earlier
in `paths.ts`/`pipeline.ts` (`src/paths.ts:35`, `src/pipeline.ts:108-118`), so
the user-visible FR-15 behavior for a non-existent path is met. The finding is
the loss of the typed distinction inside `converter.ts` and the missing
`InputNotFoundError` type the architecture promises.

**Classification:** Partially met (behavior satisfied upstream; typed-error
contract from architecture §8 not satisfied in this module).

---

### F-6 — LOW — None of the three audited files carries a `@req` traceability tag, contrary to project_requirements §10

**Requirement.** `docs/project_requirements.md:148-153` (Traceability notes):
"Downward traceability to verification evidence is to be maintained by tagging
each test with its requirement ID (for example `@req FR-08`) so the traceability
matrix can be generated from the test suite." User stories reinforce per-AC
`@req` tagging (`docs/user_stories.md:5-7`).

**Evidence.** `grep` for requirement references across the three files returns
**zero** `@req`/`FR-`/`NFR-` tags in source comments:
- `src/webDriverClient.ts` — header comment (`:1-7`) cites no requirement.
- `src/converter.ts` — doc comment (`:15-20`) cites no requirement, though it
  implements FR-01/FR-16 ("written only after a successful render").
- `src/releaseCatalog.ts` — doc comments (`:5,:10,:20-24`) describe the 7-day
  rule but never cite NFR-05.

While §10 names *tests* as the tag carrier, the absence of any requirement
anchor in these source modules (combined with F-8/F-9 below) leaves NFR-05,
FR-01, FR-07, FR-16 ownership entirely implicit at the code layer.

**Classification:** Unmet (convention adherence), low severity.

---

### F-7 — LOW — `releaseCatalog.ts` documents only the 7-day rule and omits any mention of the waiver exception, reinforcing F-1

**Requirement.** NFR-05 (`docs/project_requirements.md:112`); waiver glossary
(`:33-34`).

**Evidence.** The module's own doc comments state the policy as a flat 7-day
quarantine with no exception: `src/releaseCatalog.ts:10` ("True when a release is
old enough to have cleared the quarantine"), `:20-24` ("returns the one with the
highest version that has cleared the 7-day quarantine. Throws ... when no eligible
release exists"), and the thrown message `:31-32` ("Wait for a release that is at
least 7 days old"). Nowhere is the owner-approved waiver acknowledged. This
documentation-level omission corroborates the behavioral gap in F-1 and would
mislead a maintainer into believing the 7-day rule is absolute, which NFR-05
explicitly says it is not.

**Classification:** Unmet (documentation/comment consistency with NFR-05), low.

---

### F-8 — LOW — `webDriverClient.ts` is absent from the architecture component view, so its requirement ownership is undocumented

**Requirement / governance.** Architecture §5 component table
(`docs/architecture.md:100-111`) and §12 project structure
(`docs/architecture.md:218-250`) are declared "authoritative on internal
structure" (`docs/architecture.md:11-13`).

**Evidence.** Neither §5 nor the §12 `src/` listing
(`docs/architecture.md:231-240`) mentions `webDriverClient.ts`; the §12 tree
lists `pdfRenderer.ts` but stops there. The file exists (`ls src` confirms
`webDriverClient.ts`) and is a core dependency of `pdfRenderer.ts`
(`src/pdfRenderer.ts:7-15`). Because architecture §5 is the document mapping
modules to requirements (FR-07, FR-24, NFR-02 are pinned to `pdfRenderer.ts`),
the audited file's contribution to FR-07/NFR-02 (see F-2/F-3) has **no documented
home**, making those requirement linkages untraceable per architecture's own
structure rules.

**Classification:** Unmet (architecture/code traceability), low.

---

### F-9 — LOW — `releaseCatalog.ts` is absent from the architecture component view despite owning NFR-05 logic

**Requirement / governance.** As F-8; NFR-05 (`docs/project_requirements.md:112`).

**Evidence.** Architecture §5 (`docs/architecture.md:100-111`) attaches NFR-05 to
`assets/`/dependency hygiene narratively (§14 R-4, `docs/architecture.md:317-319`)
but lists **no module** implementing artifact-version selection; `releaseCatalog.ts`
and `driverProvisioner.ts` appear in neither §5 nor the §12 tree
(`docs/architecture.md:231-240`). `releaseCatalog.ts` is the actual NFR-05
decision module (`src/releaseCatalog.ts:25`) and is referenced only in the
implementation plan (`docs/implementation_plan_v0.1.md:115`), not the authoritative
architecture. NFR-05's runtime ownership is therefore untraceable from the
governing architecture document.

**Classification:** Unmet (architecture/code traceability), low.

---

## Items explicitly assessed as MET (for fairness)

- **FR-01 / FR-16 no-partial-output guarantee** — `converter.ts` renders fully,
  writes to a sibling temp file, then renames into place
  (`src/converter.ts:51-54`): `writeFileSync(tmpOut, pdfBytes); renameSync(tmpOut, outputPath);`.
  The PDF is produced only after `renderToPdf` resolves (`:49`), satisfying FR-16's
  "rather than write a partial output PDF" and architecture §4 stage 5
  (`docs/architecture.md:92-93`). The temp HTML dir is always cleaned in `finally`
  (`:55-62`).
- **NFR-05 7-day quarantine arithmetic** — `quarantineCutoff`/`isEligible`
  (`src/releaseCatalog.ts:6-13`) correctly implement the 7-full-days boundary
  (`<=` cutoff), with boundary tests confirming inclusivity
  (`tests/unit/releaseCatalog.test.ts:28,:33,:42`). This is the compliant half of
  NFR-05; the non-compliant half is the waiver exception (F-1/F-7).
- **CON-01 (Node 20+) / no third-party dep in client** — `webDriverClient.ts`
  uses built-in `fetch`/`AbortSignal.timeout`/`Buffer` only
  (`src/webDriverClient.ts:1-7,:23-28`), consistent with CON-01
  (`docs/project_requirements.md:40`) and architecture ADR-04.
- **FR-24 Mermaid timing** — the Print path is gated on Mermaid completion in
  `pdfRenderer.ts` (`src/pdfRenderer.ts:181`), and `printPage` returns the PDF
  bytes only after that await chain; `webDriverClient.ts` itself imposes a 60 s
  print timeout (`src/webDriverClient.ts:10,:123`) consistent with FR-24's
  rendering need.

---

## Contradictions register

| # | Contradiction | Evidence |
|---|---|---|
| C-1 | NFR-05/policy mandate a waiver exception; `selectNewestEligible` (the runtime selector) cannot honor one. | `docs/project_requirements.md:112,:33-34`; `ARTIFACT_FRESHNESS_POLICY.md` Rules 3 & 6 vs `src/releaseCatalog.ts:25-38`, `src/driverProvisioner.ts:206` |
| C-2 | Architecture §8 names `InputNotFoundError` for missing input; the type does not exist and `converter.ts` throws generic `ConversionError`. | `docs/architecture.md:156-157` vs `src/errors.ts:1-87`, `src/converter.ts:30-35` |
| C-3 | Architecture §5/§12 are "authoritative on internal structure" yet omit two audited modules. | `docs/architecture.md:11-13,:100-111,:231-240` vs `ls src` (`webDriverClient.ts`, `releaseCatalog.ts` present) |

---

## Severity summary

| Severity | Count | Findings |
|---|---|---|
| Critical | 0 | — |
| High | 1 | F-1 |
| Medium | 4 | F-2, F-3, F-4, F-5 |
| Low | 4 | F-6, F-7, F-8, F-9 |
| **Total** | **9** | |

**One-line summary:** `releaseCatalog.ts`'s `selectNewestEligible` — the runtime
artifact selector — cannot express NFR-05's mandatory owner-approved quarantine
waiver, so the requirement's only permitted exception is unimplementable on the
runtime provisioning path.
