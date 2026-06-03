# Forensic Audit — docs/implementation_plan_v0.1.md

Subject: `docs/implementation_plan_v0.1.md`
Mode: read-only forensic audit. Codebase (`src/`, `scripts/`, `package.json`) consulted only to verify coherence.
Date: 2026-06-03

---

## Detailed Analysis

This is a competent, mostly honest plan — and that is exactly why its lies stand out. The skeleton-first strategy is sound, the milestone decomposition is real, and the traceability table at §9 actually maps every story to a milestone. Good. Now let me tell you where the plaster is hiding rot.

The plan was written to describe a project that does not exist in the form it claims. It names a module — `src/artifactPolicy.ts` (line 114) — that is simply not on disk. `ls src/` returns `releaseCatalog.ts`, `driverProvisioner.ts`, `webDriverClient.ts`, and friends, but no `artifactPolicy.ts`. A plan that lists a primary module which was never built is not a plan, it's a wish list with a confident font.

The Release smoke tests at §5 (line 411) invoke `npm run test:integration`. Open `package.json`. The scripts are `build`, `prepack`, `test`, `test:watch`, `test:browser`, `test:all`, `check:artifacts`, `typecheck`. There is no `test:integration` script. The acceptance gate's own ritual references a command that will error out. You cannot pass a release gate that calls a script that doesn't exist.

Then there's the freshness theatre. The plan promises Renovate configured with "a 7-day minimum release age **and strict internal checks**" (line 104, M0.5). The actual `renovate.json` has `"minimumReleaseAge": "7 days"` and `"internalChecksFilter": "strict"`. Fine — that one holds. But M0.5's "Done when" says "**The local Git hook blocks artifact freshness violations** before commit" (line 137) and the Risks table (line 460) leans entirely on "make the local pre-commit hook run `npm run check:artifacts`". There IS a `.githooks/` directory, but the plan never tells you the hook is opt-in (Git does not auto-wire `.githooks/` unless `core.hooksPath` is set), and it states the blocking as accomplished fact. That is a guarantee with no verified mechanism in the artifact under audit.

The most insidious defect is the silent image failure. US-02's Notes (user_stories.md) say plainly: "Image references that cannot be resolved are an error case owned by US-06." US-06 is the fail-loud story: missing inputs reported on stderr, non-zero exit. The plan's M3 (lines 218–219) says only "Relative images resolved from the source file directory" and lists a happy-path test "relative image embedding/resolution" (line 241). There is NO error path for an unresolvable image anywhere in the plan. And the code proves the consequence: `markdownRenderer.ts:107` does `if (existsSync(imgPath))` and, when false, **does nothing** — leaves the broken `src` in the HTML and renders a PDF with a broken image, silently, exit 0. The plan declined to specify the error mechanism that the user stories demanded, and the implementation took the plan at its word. That is a happy-path-only defect that propagated straight into shipped behaviour.

Exit code 2 is claimed for the wrong owner. The plan's scope (line 28) promises "exit codes `0`, `1`, and `2`" and M1 "Done when: CLI usage errors exit `2`" (line 173) — correct, `cli.ts` returns 2 for `UsageError`. But M6's "Done when" (line 352) says "exit `0` means all conversions succeeded; exit `1` means at least one failed" and the pipeline's `PipelineResult.exitCode` is typed `0 | 1` (`pipeline.ts:27`). Fine individually. The problem is §5/§6 never reconcile the THREE-code story with the TWO-code pipeline; exit 2 lives only in the CLI usage layer and the plan never says so. A reader chasing "exit 2" through the milestones will not find where it is produced. Loose end.

The `npm test` story is incoherent with the project's own fast/slow discipline. M0 "Done when" (line 90) says "`npm test` runs a placeholder suite" and §5 splits "Fast tests" from "Browser-backed tests". But `package.json` defines `"test": "vitest run --reporter=verbose"` — that runs EVERYTHING vitest discovers, fast and slow, and the browser suite is gated behind a SEPARATE config (`test:browser`). The plan's §3 (lines 58–60) promises "fast tests available before the browser-backed work" and the Risks table (line 461) promises browser tests "isolated behind a dedicated command." The plan never states which command is the fast path; a reader is left to guess whether `npm test` is fast or full. The global engineering rules demand a `-m "not slow"` style fast path; the plan gestures at the concept and never names the command. Under-specified.

The M4 deferral clause (lines 258–260) is a TODO wearing a tuxedo: "Last-resort Chromium-for-Testing provisioning path can be deferred behind a clear error **only if** browser-less-host support is explicitly tracked for a follow-up patch before v0.1 release." It introduces a conditional obligation ("explicitly tracked") with no tracker, no issue id, no owner, and no statement of whether the condition was met. It is a self-referential escape hatch that resolves nothing.

Architectural-approach compliance: the plan respects Architecture B (functional, WebDriver Print) — `cli.ts`/`pipeline.ts`/`pdfRenderer.ts`/`webDriverClient.ts` all exist and are functional. The plan's prose ("pure or mostly pure components", "OverwritePolicy pure decision table") matches `overwrite.ts`'s pure `decideOverwrite`. No architecture-style violation found there. The logical component names the plan implies (DocumentConverter, ConversionPipeline) are the architecture doc's conceptual labels, and that's internally consistent. Credit where due.

Net verdict: the strategy is fine, the bones are real, but the plan ships at least one phantom module, one phantom npm script, one unspecified error path that the user stories explicitly demanded, a freshness-gate guarantee stated as fact without a wired mechanism, and a fast/slow test story that never names its own commands. It reads finished. It is not.

Files read: `docs/implementation_plan_v0.1.md` (subject), `docs/user_stories.md`, `package.json`, `renovate.json`, `src/cli.ts`, `src/pipeline.ts`, `src/converter.ts`, `src/markdownRenderer.ts`, `src/pdfRenderer.ts`, `src/overwrite.ts`, `src/browserLocator.ts`, `src/errors.ts`, `src/releaseCatalog.ts`, and the `src/` / `scripts/` / `tests/` listings.

---

## Issues

### Issue 1 — Phantom module `src/artifactPolicy.ts` listed as a primary deliverable
- **Category:** incoherence
- **Severity:** MAJOR (criticality 6, confidence 5)
- **Evidence:** Plan M0.5 "Primary modules/files:" lists `- src/artifactPolicy.ts` || `ls src/` yields: `browserLocator.ts cli.ts converter.ts driverProvisioner.ts errors.ts markdownRenderer.ts overwrite.ts paths.ts pdfRenderer.ts pipeline.ts releaseCatalog.ts webDriverClient.ts` — no `artifactPolicy.ts`.
- **Location:** docs/implementation_plan_v0.1.md:114
- **Detail:** The plan names `src/artifactPolicy.ts` as a primary module of M0.5, but the file does not exist on disk. The freshness logic actually lives in `releaseCatalog.ts` and `scripts/checkArtifactFreshness.mjs`. A plan that lists a deliverable that was never built — or was renamed without the plan being updated — fails fidelity between document and implementation.
- **Affected milestone:** M0.5

### Issue 2 — Unresolvable images have no error path; plan contradicts US-02/US-06 and code fails silently
- **Category:** happy_path_only
- **Severity:** MAJOR (criticality 7, confidence 5)
- **Evidence:** Plan M3: "Relative images resolved from the source file directory." and test "Unit or integration test for relative image embedding/resolution." (no error case) || user_stories.md US-02 Notes: "Image references that cannot be resolved are an error case owned by US-06." || markdownRenderer.ts:107 `if (existsSync(imgPath)) { token.attrs[srcIdx][1] = imageToDataUri(imgPath); }` — else branch absent, broken src left in place, no error raised.
- **Location:** docs/implementation_plan_v0.1.md:218-219, docs/implementation_plan_v0.1.md:241
- **Detail:** The user stories explicitly assign unresolvable images to US-06 (the fail-loud / non-zero-exit story). The plan's M3 specifies only the happy path — resolution — and a happy-path test, with no failure mechanism, no error type, and no test for a missing image. The implementation faithfully reflects this omission: a missing image is silently dropped and the conversion still exits 0, violating US-06. The plan's silence is the root cause.
- **Affected US:** US-02, US-06
- **Affected milestone:** M3

### Issue 3 — Release smoke test invokes non-existent `npm run test:integration`
- **Category:** incoherence
- **Severity:** MAJOR (criticality 6, confidence 5)
- **Evidence:** Plan §5 Release smoke tests: "- `npm run test:integration`" || package.json scripts: `build`, `prepack`, `test`, `test:watch`, `test:browser`, `test:all`, `check:artifacts`, `typecheck` — no `test:integration`.
- **Location:** docs/implementation_plan_v0.1.md:411
- **Detail:** The release smoke-test list, which feeds the §6 acceptance gate, calls `npm run test:integration`. No such script exists in `package.json`. Running the documented gate as written would error on a missing npm script. The plan references a command the project never defines.

### Issue 4 — Pre-commit freshness "block" stated as accomplished with no wired mechanism
- **Category:** missing_mechanism
- **Severity:** MAJOR (criticality 5, confidence 4)
- **Evidence:** Plan M0.5 "Done when: ... The local Git hook blocks artifact freshness violations before commit." || Risks table: "make the local pre-commit hook run `npm run check:artifacts` or `node scripts/checkArtifactFreshness.mjs`." || A `.githooks/` directory exists but the plan never states that Git ignores `.githooks/` unless `core.hooksPath` is configured, and no such configuration step is named anywhere in the plan.
- **Location:** docs/implementation_plan_v0.1.md:137, docs/implementation_plan_v0.1.md:460
- **Detail:** The plan declares the blocking pre-commit hook as a completed acceptance condition, but never specifies the mechanism that makes a repo-tracked `.githooks/` directory actually run (Git requires `core.hooksPath=.githooks` or a symlink, which the plan never mentions). A stated guarantee — "blocks ... before commit" — with no specified enabling step is an unverifiable claim.
- **Affected milestone:** M0.5

### Issue 5 — Exit code 2 promised in scope but never assigned an owner in milestones/test plan
- **Category:** loose_end
- **Severity:** MINOR (criticality 4, confidence 4)
- **Evidence:** Plan §2 scope: "exit codes `0`, `1`, and `2`." || M6 "Done when: ... exit `0` means all conversions succeeded; exit `1` means at least one failed." (no mention of 2) || pipeline.ts:27 `exitCode: 0 | 1;` — the pipeline can only ever produce 0 or 1; code 2 is produced solely in cli.ts for UsageError, which the plan never states.
- **Location:** docs/implementation_plan_v0.1.md:28, docs/implementation_plan_v0.1.md:352
- **Detail:** The plan promises a three-value exit-code contract but the milestone "Done when" clauses describe only the two-value pipeline result. Exit 2 (usage error) is owned by the CLI layer, yet no milestone, test bullet, or acceptance line states where exit 2 originates. A reader tracing the third code through the plan finds no home for it.

### Issue 6 — Fast vs full test split gestured at but the commands are never named
- **Category:** untestable
- **Severity:** MINOR (criticality 4, confidence 4)
- **Evidence:** Plan §3: "This order keeps fast tests available before the browser-backed work" || §5 splits "Fast tests:" and "Browser-backed tests:" || Risks: "isolate browser tests behind a dedicated command." || M0 "Done when: `npm test` runs a placeholder suite." || package.json: `"test": "vitest run --reporter=verbose"` (runs all non-browser-config tests) and `"test:browser": "..."` — the plan never states which command is the fast path vs the full path.
- **Location:** docs/implementation_plan_v0.1.md:58-60, docs/implementation_plan_v0.1.md:389-404
- **Detail:** The plan repeatedly distinguishes fast tests from browser-backed tests and promises a "dedicated command" for the slow ones, but never names the actual npm scripts that realize the split. A developer cannot convert "run the fast path" into a concrete command from the plan alone; the binding between the conceptual split and `npm test` / `npm run test:browser` is left implicit.

### Issue 7 — M4 Chromium-for-Testing deferral is a conditional TODO with no tracker, owner, or resolution
- **Category:** loose_end
- **Severity:** MINOR (criticality 4, confidence 5)
- **Evidence:** Plan M4: "Last-resort Chromium-for-Testing provisioning path can be deferred behind a clear error only if browser-less-host support is explicitly tracked for a follow-up patch before v0.1 release."
- **Location:** docs/implementation_plan_v0.1.md:258-260
- **Detail:** This clause introduces a conditional obligation ("only if ... explicitly tracked for a follow-up patch") but provides no tracker reference, no issue id, no owner, and no statement of whether the condition was satisfied. It is an open question disguised as a decision: the reader cannot tell whether browser-less-host support is in or out of v0.1, nor where the "tracking" lives.
- **Affected US:** US-07
- **Affected milestone:** M4

### Issue 8 — `npm test` described as "placeholder suite" in M0 but runs the real suite in shipped package.json
- **Category:** terminology_drift
- **Severity:** SMELL (criticality 2, confidence 3)
- **Evidence:** Plan M0 "Done when: `npm test` runs a placeholder suite." || package.json `"test": "vitest run --reporter=verbose"` — the released project's `npm test` runs the full unit/contract suite, not a placeholder.
- **Location:** docs/implementation_plan_v0.1.md:90
- **Detail:** M0's done-condition frames `npm test` as a placeholder bootstrap step, but the same command name later carries the project's real test suite (§5, §6). The plan never marks the transition from placeholder to real suite, so the meaning of "`npm test`" drifts between M0 and the acceptance gate without an announced switch.
- **Affected milestone:** M0
