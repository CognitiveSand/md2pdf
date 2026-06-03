# md2pdf Audit Consolidation Index

**Scope:** 31 forensic audit instances across 6 auditors (architecture, code-quality, yagni, test-quality, requirements-quality, requirements-compliance), each ≤300 lines, covering the md2pdf v0.1.1 source, tests, and governance docs. Read-only consolidation — no remediation performed or proposed.

**Severity normalization:** Each report uses its own vocabulary; all are mapped to Critical / High / Medium / Low as follows — `CRITICAL`/blocker → **Critical**; `MAJOR`/`HIGH` → **High**; `MINOR`/`WARNING`/`MEDIUM` → **Medium**; `INFO`/`SMELL`/`nit`/`LOW` → **Low**. Code-quality JSON reports also carry a P0–P3 priority band orthogonal to severity; severity (not priority) drives the mapping. YAGNI reports give no explicit severity scale, so confidence is used as a proxy (High confidence → High, Medium → Medium, Low → Low), except `yagni__markdownRenderer-paths` and `yagni__webDriverClient-converter-releaseCatalog`, which supply their own High/Medium/Low mapping.

---

## 1. Severity totals

**Total findings across all 31 reports: 229**

| Severity | Count |
|---|---:|
| Critical | 4 |
| High | 61 |
| Medium | 89 |
| Low | 75 |
| **Total** | **229** |

### By auditor

| Auditor | Reports | Crit | High | Med | Low | Total |
|---|---:|---:|---:|---:|---:|---:|
| architecture | 2 | 2 | 9 | 7 | 3 | 21 |
| code-quality | 7 | 1 | 20 | 18 | 16 | 55 |
| requirements-compliance | 7 | 0 | 12 | 22 | 23 | 57 |
| requirements-quality | 2 | 0 | 6 | 13 | 13 | 32 |
| test-quality | 6 | 1 | 2 | 16 | 15 | 34 |
| yagni | 7 | 0 | 12 | 13 | 5 | 30 |
| **Total** | **31** | **4** | **61** | **89** | **75** | **229** |

The 4 Critical findings come from three reports: `architecture__architecture` (2 — phantom browser provisioning, false "fonts are bundled"), `code-quality__checkArtifactFreshness` (1 — `assert` that never asserts), and `test-quality__endToEnd.test` (1 — every integration test passes with zero assertions in browser-less CI).

---

## 2. Per-instance table

Sorted by Critical desc, then High desc, then Total desc.

| Report file | Auditor | Target file(s) | Crit | High | Med | Low | Total | Headline finding |
|---|---|---|---:|---:|---:|---:|---:|---|
| architecture__architecture.md | architecture | docs/architecture.md | 2 | 5 | 4 | 2 | 13 | Doc promises a last-resort browser-download path and bundled fonts that the code does not implement, and omits two whole modules plus the freshness subsystem. |
| code-quality__checkArtifactFreshness.md | code-quality | scripts/checkArtifactFreshness.mjs | 1 | 3 | 2 | 2 | 8 | `assert()` never throws — it defers failures into a module global, defeating the fail-fast freshness gate. |
| test-quality__endToEnd.test.md | test-quality | tests/integration/endToEnd.test.ts | 1 | 1 | 3 | 4 | 9 | Every test guards on `if (!browserAvailable) return;`, so all five report GREEN with zero assertions in the browser-less CI the project ships to. |
| code-quality__driverProvisioner-overwrite.md | code-quality | src/driverProvisioner.ts, src/overwrite.ts | 0 | 5 | 2 | 3 | 10 | Downloaded driver written executable (0o755) with no integrity verification, plus a dead self-contradicting platform branch and a 52-line multi-responsibility `provisionDriver`. |
| architecture__implementation_plan_v0.1.md | architecture | docs/implementation_plan_v0.1.md | 0 | 4 | 3 | 1 | 8 | Plan lists a phantom module (`artifactPolicy.ts`), a non-existent npm script, and no error path for unresolvable images that the code then drops silently. |
| code-quality__pipeline-cli.md | code-quality | src/pipeline.ts, src/cli.ts | 0 | 4 | 2 | 3 | 9 | `--output` usage validation is duplicated across cli.ts and pipeline.ts with divergent predicate and message; `runConversionPipeline` is a 90-line God function. |
| code-quality__markdownRenderer-paths.md | code-quality | src/markdownRenderer.ts, src/paths.ts | 0 | 3 | 3 | 3 | 9 | Path-traversal sink in image inlining lets `![](../../etc/passwd)` be base64-embedded into the output PDF. |
| requirements-compliance__markdownRenderer-paths.md | requirements-compliance | src/markdownRenderer.ts, src/paths.ts | 0 | 3 | 5 | 4 | 12 | Mermaid emits `<div>` vs architecture's `<pre>`, no `@req` tags, and `paths.ts` has zero test coverage for FR-02/03/09/23. |
| requirements-quality__project_requirements-description.md | requirements-quality | docs/project_requirements.md, docs/project_description.md | 0 | 3 | 7 | 6 | 16 | "Demonstration" verification can't prove rendered-output FRs; FR-04 bundles 5+ capabilities; FR-22 references an undefined backend-selection mechanism. |
| requirements-quality__user_stories.md | requirements-quality | docs/user_stories.md | 0 | 3 | 6 | 7 | 16 | Unfalsifiable Then-clauses ("renders correctly") and a preamble "observable-behaviour-only" rule the stories themselves break (Node 20+, exit codes, stdout/stderr). |
| code-quality__pdfRenderer-errors.md | code-quality | src/pdfRenderer.ts, src/errors.ts | 0 | 2 | 4 | 2 | 8 | `renderToPdf` collapses every error to `RenderError(message)`, discarding stack/cause, and re-wraps already-typed errors into a double-prefixed message. |
| code-quality__webDriverClient-converter-releaseCatalog.md | code-quality | src/webDriverClient.ts, src/converter.ts, src/releaseCatalog.ts | 0 | 2 | 2 | 2 | 6 | Documented "no partial file on failure" leaks an orphan `.tmp`, and hand-rolled `compareVersions` silently equates `2.0.0-rc1` with `2.0.0`. |
| requirements-compliance__browserLocator.md | requirements-compliance | src/browserLocator.ts | 0 | 2 | 3 | 3 | 8 | Architecture advertises Edge/Brave support the code does not implement; zero `@req` traceability tags. |
| requirements-compliance__checkArtifactFreshness.md | requirements-compliance | scripts/checkArtifactFreshness.mjs | 0 | 2 | 2 | 3 | 7 | The gate never freshness-checks non-npm artifact classes or the runtime-provisioning path the policy explicitly covers. |
| requirements-compliance__pipeline-cli.md | requirements-compliance | src/pipeline.ts, src/cli.ts | 0 | 2 | 4 | 3 | 9 | A non-interactive overwrite skip exits 0, defeating FR-14's "prevents silent data loss in scripts" rationale; `--output` guard triplicated and drifting. |
| yagni__browserLocator.md | yagni | src/browserLocator.ts | 0 | 2 | 2 | 0 | 4 | `LocatedDriver.version` is computed (spawning a child process per call) and stored but read by nothing. |
| yagni__driverProvisioner-overwrite.md | yagni | src/driverProvisioner.ts, src/overwrite.ts | 0 | 2 | 2 | 0 | 4 | Dead `ext`/`isWindows` locals (one with a tautologically-false branch) in `fetchGeckodriverReleases`, plus two over-broad exports. |
| yagni__markdownRenderer-paths.md | yagni | src/markdownRenderer.ts, src/paths.ts | 0 | 2 | 2 | 2 | 6 | A dead public cluster (`resolveWorkList`/`resolveConversionSources`/`WorkListOptions`) duplicates logic that pipeline.ts re-implements inline. |
| yagni__pipeline-cli.md | yagni | src/pipeline.ts, src/cli.ts | 0 | 2 | 2 | 0 | 4 | `PipelineResult.outcomes` + `ConversionOutcome.error` + `convertOptions` pass-through are built/plumbed everywhere but consumed by nobody. |
| yagni__webDriverClient-converter-releaseCatalog.md | yagni | src/webDriverClient.ts, src/converter.ts, src/releaseCatalog.ts | 0 | 3 | 2 | 1 | 6 | A multi-layer print-config channel (`ConvertOptions`→`RenderOptions.print`→`PrintOptions`) carries no data; `isEligible` exported, unused, and duplicated inline. |
| requirements-compliance__driverProvisioner-overwrite.md | requirements-compliance | src/driverProvisioner.ts, src/overwrite.ts | 0 | 1 | 2 | 3 | 6 | The runtime provisioning path cannot honour the NFR-05 quarantine waiver; chromedriver dated from a self-documented 1–2 day npm-mirror proxy. |
| requirements-compliance__pdfRenderer-errors.md | requirements-compliance | src/pdfRenderer.ts, src/errors.ts | 0 | 1 | 2 | 3 | 6 | Architecture's promised offline browser launch is absent — only proxy-bypass flags are set (`network.proxy.type:0` = DIRECT). |
| requirements-compliance__webDriverClient-converter-releaseCatalog.md | requirements-compliance | src/webDriverClient.ts, src/converter.ts, src/releaseCatalog.ts | 0 | 1 | 4 | 4 | 9 | `selectNewestEligible` (the runtime selector) cannot express NFR-05's mandatory owner-approved quarantine waiver. |
| test-quality__driverProvisioner-releaseCatalog.test.md | test-quality | tests/unit/driverProvisioner.test.ts, tests/unit/releaseCatalog.test.ts | 0 | 1 | 3 | 3 | 7 | Time-bomb: absolute calendar dates judged against the real clock will fail after 2026-06-08 with no code change. |
| yagni__pdfRenderer-errors.md | yagni | src/pdfRenderer.ts, src/errors.ts | 0 | 1 | 2 | 0 | 3 | `RenderOptions.print`/`timeoutMs` are plumbed end-to-end but populated by no real caller or test. |
| code-quality__browserLocator.md | code-quality | src/browserLocator.ts | 0 | 1 | 3 | 1 | 5 | `resolveSnapFirefox` returns the snap-wrapper path its own docstring calls unusable for WebDriver. |
| test-quality__browserLocator.test.md | test-quality | tests/unit/browserLocator.test.ts | 0 | 0 | 2 | 0 | 2 | Assertion roulette and a "priority order" test that exercises only one candidate; suite otherwise sound. |
| test-quality__markdownRenderer.test.md | test-quality | tests/unit/markdownRenderer.test.ts | 0 | 0 | 6 | 1 | 7 | Echo-back assertions (footnote/task-list/mermaid-bundle) that pass even if the production transform never ran. |
| test-quality__pipeline.test.md | test-quality | tests/unit/pipeline.test.ts | 0 | 0 | 2 | 2 | 4 | Five tests carry 5–8 message-less assertions (assertion roulette); otherwise solid, boundary-clean. |
| test-quality__cli-checkArtifactFreshness.test.md | test-quality | tests/unit/cli.test.ts, tests/unit/checkArtifactFreshness.test.ts | 0 | 0 | 0 | 5 | 5 | Five low-severity substring/exit-code-only weak assertions; both files exercise real production code. |
| yagni__checkArtifactFreshness.md | yagni | scripts/checkArtifactFreshness.mjs | 0 | 0 | 1 | 2 | 3 | `manifest.artifacts` is validated as an array but never iterated; `schemaVersion === 1` guards a single-version schema. |

---

## 3. Top issues

The most severe and systemically important findings across all reports. Cross-auditor corroboration is noted where two or more auditors independently flagged the same underlying defect — a strong signal.

- **[Critical] `scripts/checkArtifactFreshness.mjs:123-127` — `assert()` never asserts.** The freshness gate's `assert(condition, message)` pushes to a module-global `failures` array and returns rather than throwing; the author's own code re-guards with a duplicate `exists()` at line 132 because the assert does not halt. Directly defeats the fail-fast policy the script exists to enforce. (`code-quality__checkArtifactFreshness`)

- **[Critical] `tests/integration/endToEnd.test.ts:115,137,159,177,196` — zero-assertion tests in shipping CI.** Every test opens with `if (!browserAvailable) return;`; in the browser-less CI the project explicitly targets, all five return before any `expect()` and are reported green. `convertFile` could be deleted and the suite would still pass. (`test-quality__endToEnd.test`)

- **[Critical] `docs/architecture.md:161-162,208-210,294-296,308` vs `src/browserLocator.ts:228` — phantom last-resort browser provisioning.** Four sections promise a Chromium-for-Testing browser download when no browser is found; `locateBrowser()` simply throws `BrowserNotFoundError`. **Corroborated** by `requirements-compliance__browserLocator` (ADR-05 provisioning "entirely missing", Medium) and `requirements-compliance__driverProvisioner-overwrite`. (`architecture__architecture`)

- **[Critical] `docs/architecture.md:111,192-193,241-244` vs `assets/default.css:16` — "fonts are bundled" is false.** The doc claims bundled fonts thrice "so output is consistent regardless of host fonts"; there is no `assets/fonts/` dir and `default.css` uses host system font stacks — the opposite of the stated guarantee. (`architecture__architecture`)

- **[High] `src/driverProvisioner.ts:214,230-235` — downloaded driver executed without integrity verification.** The archive is fetched over HTTPS, extracted, and written with `mode 0o755` (then chmod'd) with no checksum, signature, or size cap, then later spawned — arbitrary local code execution under CDN-tamper/MITM. The module whose entire purpose is the freshness *safety* policy trusts the payload absolutely. (`code-quality__driverProvisioner-overwrite`)

- **[High] `src/markdownRenderer.ts:106` (sink at :36) — path traversal in image inlining.** `resolve(sourceDir, src)` follows `../` out of the source dir with no containment check; `![](../../../../etc/passwd)` is read and base64-embedded into the output PDF. Local arbitrary-file disclosure from an untrusted `.md`. (`code-quality__markdownRenderer-paths`)

- **[High] `src/releaseCatalog.ts:25-38` — runtime quarantine waiver is unimplementable.** `selectNewestEligible` (the function `driverProvisioner.ts:206` actually calls) has no waiver parameter and unconditionally rejects in-quarantine versions, so NFR-05's single permitted exception cannot be honoured at runtime. **Corroborated across three reports**: `requirements-compliance__webDriverClient-converter-releaseCatalog` (F-1, High), `requirements-compliance__driverProvisioner-overwrite` (NFR-05.A, High), and partially `code-quality__webDriverClient...`. A strong, independently-confirmed signal.

- **[High] `src/releaseCatalog.ts:40-48` — hand-rolled `compareVersions` silently equates prereleases.** `'2.0.0-rc1'.split('.')` → `parseInt('0-rc1')||0` = 0, so `2.0.0-rc1` compares EQUAL to `2.0.0`; `selectNewestEligible` can return a prerelease as stable. (`code-quality__webDriverClient-converter-releaseCatalog`)

- **[High] `src/converter.ts:51-54` — "no partial file on failure" guarantee leaks an orphan temp file.** The docstring promises failure leaves no partial output and the comment brands the write "Atomic-ish"; the `finally` cleans only the HTML temp dir, so a failing `renameSync` orphans the `.md2pdf-*.tmp` PDF next to the user's output. (`code-quality__webDriverClient-converter-releaseCatalog`)

- **[High] `src/cli.ts:64-66` vs `src/pipeline.ts:121-123` — `--output` usage guard duplicated with divergent semantics.** cli.ts gates on `positionals.length > 1` (entry count), pipeline.ts on `sources.length > 1` (resolved-file count), with different messages; a single directory expanding to many `.md` files passes one and is rejected by the other. **Corroborated** by `requirements-compliance__pipeline-cli` (I-02, High), which notes `paths.ts:79` carries a third variant — triplicated and drifting. (`code-quality__pipeline-cli`)

- **[High] `src/pdfRenderer.ts:75,93` — promised offline browser launch does not exist.** Architecture §9/ADR-02 claim the browser is "launched offline so it cannot reach the network"; the code sets only proxy-bypass — Firefox `network.proxy.type:0` means DIRECT connection, permitting direct network access. NFR-02/CON-02 then rest entirely on upstream asset-inlining. (`requirements-compliance__pdfRenderer-errors`)

- **[High] `src/pipeline.ts:69-71,161-171` — non-interactive overwrite skip exits 0.** A refused overwrite is recorded `skipped`, exit code counts only `failed`, so a scripted run that wrote no PDF reports success — the opposite of FR-14's "prevents silent data loss in scripts" rationale. (`requirements-compliance__pipeline-cli`)

- **[High] `src/pdfRenderer.ts:185-186` — error stack and cause discarded on wrap.** `throw new RenderError((err as Error).message, sourcePath)` flattens every WebDriver/port/spawn failure to a single message, drops the stack and `cause`, and the broad catch re-wraps already-typed errors into a double-prefixed `Render failed for x: Render failed for x:` message. (`code-quality__pdfRenderer-errors`)

- **[High] `src/browserLocator.ts:169` — `resolveSnapFirefox` returns the path its own docstring calls unusable.** When the real snap binary is absent it falls back to `/snap/bin/firefox` — the wrapper the docstring says "is not a real executable WebDriver can launch" — and labels it `realPath`. Should return `null` and fall through. (`code-quality__browserLocator`)

- **[High] `tests/unit/driverProvisioner.test.ts:57-58,94-129` — time-bomb tests.** Production `provisionDriver` calls `selectNewestEligible` without a `now` arg, so eligibility uses the real clock; the absolute `QUARANTINED_DATE = 2026-06-01` clears the 7-day window on 2026-06-08, after which the rejection tests fail with no code change. The unused `NOW` constant (line 56) shows the freeze-the-clock seam was known and not used. (`test-quality__driverProvisioner-releaseCatalog.test`)

- **[High, cross-cutting] Zero `@req` traceability tags anywhere in `src/`.** A repo-wide grep returns no requirement tags despite `project_requirements.md §10` and `architecture.md §15` mandating them. Flagged independently by **every requirements-compliance report** (browserLocator, checkArtifactFreshness, driverProvisioner-overwrite, markdownRenderer-paths, pdfRenderer-errors, pipeline-cli, webDriverClient-converter-releaseCatalog) — the most broadly corroborated finding in the set.

---

## 4. Cross-cutting themes

**Documentation describes a system that does not exist as written.** The architecture doc and implementation plan repeatedly promise capabilities the code never built: last-resort browser provisioning (4 sites), bundled fonts, an offline browser launch, an `InputNotFoundError` type, a `contract/` test suite, a phantom `artifactPolicy.ts` module, and a non-existent `npm run test:integration` script. Conversely, two real modules (`webDriverClient.ts`, `releaseCatalog.ts`) and the entire freshness/quarantine subsystem are absent from the "authoritative" architecture §5/§12. Evidenced by `architecture__architecture`, `architecture__implementation_plan_v0.1`, `requirements-compliance__pdfRenderer-errors`, `requirements-compliance__webDriverClient-converter-releaseCatalog` (contradiction register C-1/C-2/C-3), and `requirements-compliance__markdownRenderer-paths`.

**Fail-fast is inverted into fail-quiet at multiple boundaries.** The project's own AGENTS.md §8 mandates fail-loud, yet the codebase repeatedly swallows: `assert()` defers instead of throwing (`code-quality__checkArtifactFreshness`), `compareVersions`'s `parseInt||0` and `getBrowser/DriverVersion`'s `'0.0.0'` fallback hide malformed input (`code-quality__webDriverClient...`, `requirements-compliance__browserLocator`), `paths.ts` silently drops directory entries whose `statSync` throws (`code-quality__markdownRenderer-paths` F-04 + `requirements-compliance__markdownRenderer-paths` F-06), missing images are silently dropped into broken `<img>` tags (`architecture__implementation_plan_v0.1`, `requirements-compliance__markdownRenderer-paths` F-05), and `renderToPdf` discards error stacks (`code-quality__pdfRenderer-errors`). The non-interactive-skip-exits-0 defect (`requirements-compliance__pipeline-cli`) is the user-visible end of the same pattern.

**The NFR-05 artifact-freshness policy is the most-corroborated functional gap.** Three independent reports converge on the same root cause — the runtime selector cannot express the owner-approved quarantine waiver (`requirements-compliance__webDriverClient...` F-1, `requirements-compliance__driverProvisioner-overwrite` NFR-05.A, supported by `code-quality__webDriverClient...`) — while `requirements-compliance__checkArtifactFreshness` shows the local gate never checks the non-npm artifact classes (drivers, fonts, Mermaid engine) the policy explicitly covers. The waiver mechanism exists only on the repo-side lockfile check, not the runtime path the requirement names.

**Duplicated logic that has already drifted, plus speculative surface that carries no data.** DRY violations recur with observable divergence: the `--output` guard exists in three places with two predicates (`code-quality__pipeline-cli`, `requirements-compliance__pipeline-cli`), `getBrowserVersion`/`getDriverVersion` are byte-identical (`code-quality__browserLocator`, `yagni__browserLocator`), `isEligible` is re-implemented inline (`code-quality__webDriverClient...`, `yagni__webDriverClient...`), and `writeLine`/error-boilerplate are cloned. In parallel, the YAGNI reports find an entire multi-layer print-config channel (`ConvertOptions`→`RenderOptions.print`→`PrintOptions`), a `convertOptions`/`renderTimeoutMs` chain, a `PipelineResult.outcomes`/`error` audit trail, and a dead `resolveWorkList` cluster — all plumbed end-to-end but populated and read by nobody (`yagni__pdfRenderer-errors`, `yagni__pipeline-cli`, `yagni__webDriverClient...`, `yagni__markdownRenderer-paths`).

**Tests are mock-clean but under-challenged, and one is actively misleading.** Across the test-quality suite the standout strength is boundary-correct mocking (no internal collaborators mocked anywhere). The recurring weakness is assertion strength: echo-back assertions that pass without the production transform (`test-quality__markdownRenderer.test`), assertion roulette with 5–8 message-less expects (`test-quality__pipeline.test`, `test-quality__browserLocator.test`), substring-only checks (`test-quality__cli-checkArtifactFreshness.test`), and a "selects newest eligible" test whose assertion matches either version (`test-quality__driverProvisioner-releaseCatalog.test`). Two cross the line into negative value: the time-bomb provisioner tests and the integration suite that verifies nothing in browser-less CI.

**Requirements-quality issues seed the compliance defects downstream.** The requirements documents over-apply "Demonstration" to output-quality FRs, bundle multiple capabilities into single rows (FR-04, FR-12), reference undefined mechanisms (FR-22 backend selection, NFR-04 "the help option"), and self-certify singular/consistent compliance the audit contradicts (`requirements-quality__project_requirements-description`). The user stories add unfalsifiable Then-clauses and a preamble "observable-behaviour-only" rule the stories themselves break (`requirements-quality__user_stories`). These ambiguities trace directly to the implementation gaps the compliance auditors then found — e.g. the undefined LaTeX backend-selection mechanism (FR-22) and the silently-dropped image error path that US-02/US-06 demanded but the plan never specified.
