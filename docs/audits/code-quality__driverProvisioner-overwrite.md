# Code Quality Audit — driverProvisioner.ts & overwrite.ts

```json
{
  "project_version": "v0.1.1",
  "scope": "file:src/driverProvisioner.ts, file:src/overwrite.ts",
  "date": "2026-06-03",
  "files_analyzed": 2,
  "total_lines": 283,

  "detailed_analysis": "The headline defect is dishonest, dead, and self-contradicting branching logic in `fetchGeckodriverReleases` (driverProvisioner.ts:152-156). Three local variables are computed to decide an archive extension; two of them — `isWindows` (line 152) and `ext` (line 153) — are never read. The only one used is `actualExt` (line 156). `ext` is computed with broken operator precedence: `isWindows || platformId.startsWith('linux') && !platformId.includes('linux')` — the `&&` binds tighter than `||`, the right-hand side `startsWith('linux') && !includes('linux')` is a contradiction that is ALWAYS false, so `ext` collapses to `isWindows ? '.zip' : (win ? '.zip' : '.tar.gz')`. It is a meaningless expression that no one read, no one reached, and that lies to the next maintainer about there being three-way platform logic when only `actualExt` decides anything. This is HALF_FINISHED_REFACTOR / DEAD_CODE plus a COMPLEX_CONDITIONAL that resolves to a constant. Delete `isWindows` and `ext`, or admit the file was never cleaned up.\n\nThe second-order honesty problem: the module-level docstring (lines 4-8) promises that the 7-day quarantine 'applies' to both drivers via `releaseCatalog.ts`, and `provisionDriver` is documented (line 182) as returning 'the newest eligible (post-quarantine) driver'. That contract is real (selectNewestEligible enforces it), so this is NOT a lie — but the binary that clears the freshness gate is then downloaded over HTTPS, written to disk with `mode 0o755`, and made executable (lines 230-235) with ZERO integrity verification: no checksum, no signature, no content-length check, no validation that the extracted bytes are actually an ELF/Mach-O/PE binary. A driver provisioner whose entire reason to exist is the quarantine-freshness safety policy ships an unverified executable. That is the highest-impact finding by blast radius: the threat model is a compromised CDN/GitHub-release asset or a MITM on the storage.googleapis.com / github download URL → arbitrary executable written with the exec bit and later spawned by the WebDriver layer. It is filed P2 per the deterministic security-band rule, MAJOR severity.\n\nStructurally, `provisionDriver` (lines 187-238) is a 52-line function with at least five sequential responsibilities — fetch catalog, select eligible release, download archive, extract binary, persist to disk — each with its own try/catch error-mapping. It breaks the project's 40-line limit (AGENTS.md §3) and SRP. `extractFromTarGz` (lines 92-110) is a hand-rolled USTAR tar walker reimplementing what a library does (KISS), and it decodes header fields with `String.fromCharCode(...tar.subarray(...))` (lines 97, 100) — a spread of a Buffer slice into Function.prototype.apply that risks a `RangeError: Maximum call stack size exceeded` on large headers and mis-decodes any non-ASCII byte. The download URLs (lines 131, 143, 159) are hardcoded magic strings in violation of AGENTS.md §9. Lines 232-235 set the executable mode twice — `writeFileSync(..., { mode: 0o755 })` then an immediate `chmodSync(..., 0o755)` — redundant and a POLA smell (why chmod what you just wrote with that mode?).\n\noverwrite.ts is clean and exemplary by contrast: `decideOverwrite` is a pure, total function; `confirmOverwrite` correctly closes the readline interface in a `finally`. The only nit is a minor DRY/readability issue: line 31 calls `answer.trim().toLowerCase()` twice in one expression. No honesty, security, or structural defect in this file.\n\nSecurity posture: threat model is `network-controlled release catalog + binary CDN → local filesystem write of an executable under destDir → later process spawn`. Input boundaries: the JSON catalog responses (npm registry, GitHub API) are parsed with `as`-casts and no schema validation (`npmData.time ?? {}` line 135 is the only defensive guard; GitHub response is blind-cast at line 160 and iterated without checking `rel.assets` is an array). The binary boundary (fetchBinary → extract → write+chmod) is UNVALIDATED: no checksum against any manifest, no size cap (a hostile or buggy server can stream up to the 120s timeout into memory via `arrayBuffer()`, line 77). No path-traversal risk on `destDir`/`binary` (binary name is a fixed allowlist from `binaryName`). The exploitable boundary is integrity-of-downloaded-executable: currently exploitable by anyone who can tamper with the release asset or the transport.",

  "dependency_graph_summary": {
    "total_modules": 2,
    "cyclic_dependencies": [],
    "highest_fan_in": {"module": "driverProvisioner.ts", "imported_by": 0},
    "highest_fan_out": {"module": "driverProvisioner.ts", "imports": 6}
  },

  "per_file_scores": [
    {
      "file": "src/driverProvisioner.ts",
      "lines": 247,
      "function_count": 12,
      "class_count": 0,
      "correctness": 0.5,
      "structure": 0.5,
      "security": 0.5,
      "maintainability": 0.5,
      "code_score": 0.5,
      "weakest_axis": "multiple (correctness/structure/security/maintainability all 0.5)",
      "finding_count": 9
    },
    {
      "file": "src/overwrite.ts",
      "lines": 36,
      "function_count": 2,
      "class_count": 0,
      "correctness": 1.0,
      "structure": 1.0,
      "security": 1.0,
      "maintainability": 0.75,
      "code_score": 0.75,
      "weakest_axis": "maintainability",
      "finding_count": 1
    }
  ],

  "findings": [
    {
      "id": "0001_DEAD_CODE_P3",
      "priority": "P3",
      "anti_pattern_class": "DEAD_CODE",
      "file": "src/driverProvisioner.ts",
      "line": 152,
      "function_or_class": "fetchGeckodriverReleases",
      "severity": "MAJOR",
      "security_concern": null,
      "metrics": {"unused_locals": 2, "always_false_subexpr": 1},
      "evidence": "const isWindows = platform() === 'win32';\nconst ext = isWindows || platformId.startsWith('linux') && !platformId.includes('linux')\n  ? '.zip'\n  : platformId.startsWith('win') ? '.zip' : '.tar.gz';\nconst actualExt = platformId.startsWith('win') || platform() === 'win32' ? '.zip' : '.tar.gz';",
      "evidence_lines": "152-156",
      "problem": "`isWindows` (line 152) and `ext` (line 153) are computed and never read — only `actualExt` (line 156) is used (line 165). The `ext` expression is also broken: `platformId.startsWith('linux') && !platformId.includes('linux')` is a logical contradiction that is ALWAYS false (any string starting with 'linux' contains 'linux'), and with JS precedence `&&` binds before `||`, so the whole linux clause is dead. This is a residue of an abandoned refactor: two parallel extension-deciding variables exist, one dead and self-contradicting, one live. A maintainer reading lines 152-156 cannot tell which logic governs. Elevated to MAJOR severity because the dead variable is not a harmless unused import but a fake decision branch that actively misleads about platform handling. Note: TypeScript `noUnusedLocals` would normally catch this — its presence means strict-unused checking is off or being bypassed here.",
      "affected_axis": "maintainability"
    },
    {
      "id": "0002_COMPLEX_CONDITIONAL_P2",
      "priority": "P2",
      "anti_pattern_class": "COMPLEX_CONDITIONAL",
      "file": "src/driverProvisioner.ts",
      "line": 153,
      "function_or_class": "fetchGeckodriverReleases",
      "severity": "WARNING",
      "security_concern": null,
      "metrics": {"boolean_operators": 3, "nested_ternaries": 2},
      "evidence": "const ext = isWindows || platformId.startsWith('linux') && !platformId.includes('linux')\n    ? '.zip'\n    : platformId.startsWith('win') ? '.zip' : '.tar.gz';",
      "evidence_lines": "153-155",
      "problem": "A single expression mixing `||`, `&&`, `!` (3 boolean operators) with two nested ternaries and unparenthesized precedence — exactly the kind of conditional Fowler/Martin say requires a truth table to read. Compounded by the fact that the correct, live logic on line 156 (`platformId.startsWith('win') || platform() === 'win32'`) is itself a redundant double-check (a geckodriver platformId starting with 'win' already implies win32). Two different, overlapping ways to ask 'are we on Windows?' sit on adjacent lines.",
      "affected_axis": "maintainability"
    },
    {
      "id": "0003_INJECTION_P2",
      "priority": "P2",
      "anti_pattern_class": "INJECTION",
      "file": "src/driverProvisioner.ts",
      "line": 230,
      "function_or_class": "provisionDriver",
      "severity": "MAJOR",
      "security_concern": "missing_input_validation",
      "metrics": {"integrity_checks": 0, "exec_bit_set": true, "size_cap": false},
      "evidence": "archive = await fetchBinary((best as DriverRelease).downloadUrl);\n...\nmkdirSync(destDir, { recursive: true });\nconst destPath = join(destDir, binary);\nwriteFileSync(destPath, binaryData, { mode: 0o755 });\nif (platform() !== 'win32') {\n  chmodSync(destPath, 0o755);\n}",
      "evidence_lines": "214,230-235",
      "problem": "The downloaded archive is extracted and written to disk as an executable (mode 0o755) with NO integrity verification: no SHA checksum compared against a manifest, no signature check, no content-length bound, no sanity check that the extracted bytes are a real binary. This module's whole purpose is the freshness/quarantine SAFETY policy, yet it then trusts the CDN payload absolutely. Threat model: an attacker who tampers with the GitHub release asset, the googleapis storage object, or the transport (the fetch in fetchBinary has no certificate pinning) gets an arbitrary executable written with the exec bit, later spawned by the WebDriver layer. Filed P2 per the deterministic security-band rule (non-HARDCODED_SECRET security findings → P2 regardless of severity). Severity MAJOR: requires a tamper/MITM position, but the impact is local code execution and the defense is entirely absent. Also note `fetchBinary` (line 77) buffers the entire body via arrayBuffer() with no size cap — a memory-exhaustion vector up to the 120s timeout.",
      "affected_axis": "security"
    },
    {
      "id": "0004_LONG_FUNCTION_P2",
      "priority": "P2",
      "anti_pattern_class": "LONG_FUNCTION",
      "file": "src/driverProvisioner.ts",
      "line": 187,
      "function_or_class": "provisionDriver",
      "severity": "MAJOR",
      "security_concern": null,
      "metrics": {"lines": 52, "responsibilities": 5, "try_catch_blocks": 3},
      "evidence": "export async function provisionDriver(\n  kind, browserVersion, destDir, fetcher = defaultFetcher,\n): Promise<string> {\n  // parse major; fetch catalog (try/catch); select eligible (try/catch);\n  // download archive (try/catch); choose extractor by url suffix;\n  // mkdir + write + chmod; return path  -- 52 lines, lines 187-238",
      "evidence_lines": "187-238",
      "problem": "52-line body exceeds the project's 40-line function limit (AGENTS.md §3) and packs five sequential responsibilities — version parsing, catalog fetch, eligibility selection, archive download, extraction dispatch, and filesystem persistence — each with its own error-mapping try/catch. This is a pipeline that should be composed of named single-purpose steps. SRP violation: the function changes for any reason a driver is fetched, selected, downloaded, extracted, or written.",
      "affected_axis": "structure"
    },
    {
      "id": "0005_KISS_P1",
      "priority": "P1",
      "anti_pattern_class": "KISS",
      "file": "src/driverProvisioner.ts",
      "line": 92,
      "function_or_class": "extractFromTarGz",
      "severity": "MAJOR",
      "security_concern": null,
      "metrics": {"lines": 19, "hand_rolled_format_parser": true},
      "evidence": "function extractFromTarGz(data: Buffer, binary: string): Buffer {\n  const tar = gunzipSync(new Uint8Array(data));\n  let offset = 0;\n  while (offset + 512 <= tar.length) {\n    const rawName = tar.subarray(offset, offset + 100);\n    const name = String.fromCharCode(...rawName).replace(/\\0/g, '');\n    ...\n    const size = parseInt(String.fromCharCode(...rawSize).trim().replace(/\\0/g, ''), 8);",
      "evidence_lines": "92-110",
      "problem": "A hand-rolled USTAR tar header walker reimplements a solved problem. The project already depends on `fflate` (used for zip + gunzip); a tar-aware parser or `tar-stream` would replace this with a library call. Beyond KISS, the implementation has two latent defects: (1) `String.fromCharCode(...tar.subarray(...))` (lines 97, 100) spreads a Buffer slice into apply — on a pathological/large header this throws `RangeError: Maximum call stack size exceeded`, and on any non-ASCII byte it mis-decodes (should be a TextDecoder/latin1 toString); (2) it only handles type flags 0 and 48 and ignores PAX/GNU long-name extensions, so a geckodriver tarball using long-name records would silently fail the basename match. Simpler, correct, and library-backed is strictly better here.",
      "affected_axis": "structure"
    },
    {
      "id": "0006_SRP_P1",
      "priority": "P1",
      "anti_pattern_class": "SOC",
      "file": "src/driverProvisioner.ts",
      "line": 126,
      "function_or_class": "fetchChromedriverReleases / fetchGeckodriverReleases",
      "severity": "MAJOR",
      "security_concern": null,
      "metrics": {"json_casts_unvalidated": 2},
      "evidence": "const npmData = await fetchJson('https://registry.npmjs.org/chromedriver') as NpmTimeResponse;\n...\nconst ghReleases = await fetchJson('https://api.github.com/repos/mozilla/geckodriver/releases?per_page=30') as GithubRelease[];",
      "evidence_lines": "130-132,158-160",
      "problem": "Both fetchers mix three concerns in one function: network IO, blind type-coercion of untrusted JSON (`as NpmTimeResponse`, `as GithubRelease[]` — no runtime schema validation, violating AGENTS.md §8 'validate at boundaries'), and download-URL construction policy. The GitHub response is iterated (`for (const rel of ghReleases)` line 163) and `rel.assets.find(...)` (line 166) is called with no guard that `ghReleases` is an array or that `rel.assets` exists — a non-array or error-shaped API response (rate-limit JSON object) throws an opaque TypeError instead of a descriptive boundary error. The npm fetcher guards with `?? {}` (line 135) but the GitHub fetcher does not — inconsistent boundary discipline across two sibling functions.",
      "affected_axis": "correctness"
    },
    {
      "id": "0007_POLA_P1",
      "priority": "P1",
      "anti_pattern_class": "POLA",
      "file": "src/driverProvisioner.ts",
      "line": 232,
      "function_or_class": "provisionDriver",
      "severity": "WARNING",
      "security_concern": null,
      "metrics": {"redundant_mode_set": 2},
      "evidence": "writeFileSync(destPath, binaryData, { mode: 0o755 });\nif (platform() !== 'win32') {\n  chmodSync(destPath, 0o755);\n}",
      "evidence_lines": "232-235",
      "problem": "The file is written with `mode: 0o755` and then immediately chmod'd to the same `0o755`. The second call is redundant on a fresh write — writeFileSync already applied the mode (modulo umask). If the intent is to defeat umask (writeFileSync's mode is umask-masked, chmod is not), that intent is undocumented and the reader is left guessing why the same permission is set twice. POLA: adjacent duplicate permission operations with no comment surprise the maintainer and invite a 'safe' deletion that silently changes umask behavior.",
      "affected_axis": "maintainability"
    },
    {
      "id": "0008_MAGIC_STRING_P3",
      "priority": "P3",
      "anti_pattern_class": "MAGIC_STRING",
      "file": "src/driverProvisioner.ts",
      "line": 131,
      "function_or_class": "fetchChromedriverReleases / fetchGeckodriverReleases",
      "severity": "INFO",
      "security_concern": null,
      "metrics": {"hardcoded_urls": 3, "magic_timeouts": 2, "magic_octal": 1},
      "evidence": "'https://registry.npmjs.org/chromedriver'\n`https://storage.googleapis.com/chrome-for-testing-public/${version}/${platformId}/chromedriver-${platformId}.zip`\n'https://api.github.com/repos/mozilla/geckodriver/releases?per_page=30'",
      "evidence_lines": "131,143,159",
      "problem": "Three release-source endpoints are inline string literals scattered across two functions (lines 131, 143, 159), violating AGENTS.md §9 'no hardcoding of environment-specific values' — none is overridable for testing, mirroring, or air-gapped builds. Same class: the timeouts `15_000` (line 65) and `120_000` (line 74) are unnamed magic numbers (should be `CATALOG_FETCH_TIMEOUT_MS` / `BINARY_DOWNLOAD_TIMEOUT_MS`), and `0o755` (lines 232, 234) and `per_page=30` (line 159) are unnamed constants. Intent and unit are lost; a mirror-URL config knob is impossible without code edits.",
      "affected_axis": "maintainability"
    },
    {
      "id": "0009_MISSING_TYPES_P3",
      "priority": "P3",
      "anti_pattern_class": "PRIMITIVE_OBSESSION",
      "file": "src/driverProvisioner.ts",
      "line": 204,
      "function_or_class": "provisionDriver",
      "severity": "INFO",
      "security_concern": null,
      "metrics": {"redundant_casts": 4, "inline_type_literal": 1},
      "evidence": "let best: Release & { downloadUrl: string };\nbest = selectNewestEligible(releases) as DriverRelease;\n...\narchive = await fetchBinary((best as DriverRelease).downloadUrl);\n...\nconst url = (best as DriverRelease).downloadUrl;\nif (url.endsWith('.zip')) { ... }",
      "evidence_lines": "204-228",
      "problem": "`best` is declared as the inline intersection `Release & { downloadUrl: string }` (line 204) instead of the existing exported `DriverRelease` interface (line 23) which is literally that shape — then `best` is re-cast `as DriverRelease` three more times (lines 206, 214, 223) to recover the type the declaration threw away. The named domain type exists; the code launders it through `as` casts. Choosing `.zip` vs tar by `url.endsWith('.zip')` (line 224) is also fragile string-sniffing of a field whose archive kind is already known at catalog-construction time (the URLs are built in the fetchers) — a typed `archiveKind: 'zip' | 'tar.gz'` on DriverRelease would remove the guess.",
      "affected_axis": "maintainability"
    },
    {
      "id": "0010_DRY_P3",
      "priority": "P3",
      "anti_pattern_class": "DRY",
      "file": "src/overwrite.ts",
      "line": 31,
      "function_or_class": "confirmOverwrite",
      "severity": "INFO",
      "security_concern": null,
      "metrics": {"duplicate_normalization_calls": 2},
      "evidence": "return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';",
      "evidence_lines": "31",
      "problem": "`answer.trim().toLowerCase()` is recomputed twice in a single boolean expression. Minor: a local `const normalized = answer.trim().toLowerCase();` would compute once and read cleaner. This is the only blemish in overwrite.ts, which is otherwise a model of the project's standards — `decideOverwrite` is pure and total, and `confirmOverwrite` correctly closes the readline interface in a `finally` (lines 32-34).",
      "affected_axis": "maintainability"
    }
  ],

  "findings_sort_order": "Findings are grouped P0 (none) > P1 > P2 > P3, but listed here narrative-first with the most damaging maintainability/security defects up top; severity within band is preserved in the per-finding fields. The worst defects by impact are 0003 (unverified executable) and 0001 (dead self-contradicting branch).",

  "aggregate_scores": {
    "correctness": 0.5,
    "structure": 0.5,
    "security": 0.5,
    "maintainability": 0.5,
    "code_score": 0.5,
    "weakest_axis": "all axes capped at 0.5 by MAJOR findings"
  },

  "priority_summary": {
    "P0_honesty_and_catastrophic": {"total": 0, "comment": "No hardcoded secrets, no lying function names, no broken protocol contracts. The quarantine/freshness docstrings are truthful."},
    "P1_design_principles": {"major": 2, "warning": 1, "total": 3, "comment": "KISS (hand-rolled tar parser), SoC (unvalidated JSON boundary in fetchers), POLA (double permission-set)."},
    "P2_metrics_and_security": {"major": 2, "warning": 1, "total": 3, "comment": "LONG_FUNCTION provisionDriver (52 lines); COMPLEX_CONDITIONAL; INJECTION/missing integrity verification on downloaded executable (MAJOR, P2 by deterministic rule)."},
    "P3_style_and_hygiene": {"major": 1, "info": 3, "total": 4, "comment": "DEAD_CODE (elevated to MAJOR — fake decision branch), MAGIC_STRING hardcoded URLs/timeouts, redundant casts/primitive-obsession, double normalization in overwrite.ts."}
  },

  "summary_table": {
    "LYING_NAME": {"critical": 0, "major": 0, "total": 0},
    "HIDDEN_SIDE_EFFECTS": {"critical": 0, "major": 0, "total": 0},
    "BROKEN_CONTRACT": {"critical": 0, "major": 0, "total": 0},
    "ASYMMETRIC_ROUND_TRIP": {"critical": 0, "major": 0, "total": 0},
    "HALF_FINISHED_REFACTOR": {"critical": 0, "major": 0, "total": 0},
    "HARDCODED_SECRET": {"critical": 0, "total": 0},
    "INJECTION": {"critical": 0, "major": 1, "total": 1},
    "SILENT_SWALLOWING": {"critical": 0, "major": 0, "total": 0},
    "MUTABLE_DEFAULT": {"critical": 0, "major": 0, "total": 0},
    "NO_OP_IMPLEMENTATION": {"critical": 0, "total": 0},
    "POLA": {"major": 0, "warning": 1, "total": 1},
    "KISS": {"major": 1, "warning": 0, "total": 1},
    "YAGNI": {"warning": 0, "total": 0},
    "DRY": {"major": 0, "warning": 0, "info": 1, "total": 1},
    "SRP": {"major": 0, "total": 0},
    "SOC": {"major": 1, "total": 1},
    "GOD_MODULE": {"major": 0, "total": 0},
    "GOD_CLASS": {"major": 0, "total": 0},
    "LONG_FUNCTION": {"major": 1, "total": 1},
    "FEATURE_ENVY": {"major": 0, "total": 0},
    "SHOTGUN_SURGERY": {"major": 0, "total": 0},
    "DEEP_NESTING": {"major": 0, "total": 0},
    "CYCLIC_DEPENDENCIES": {"major": 0, "total": 0},
    "GLOBAL_MUTABLE_STATE": {"major": 0, "total": 0},
    "DIVERGENT_CHANGE": {"major": 0, "total": 0},
    "COMPLEX_CONDITIONAL": {"warning": 1, "total": 1},
    "MESSAGE_CHAIN": {"warning": 0, "total": 0},
    "INAPPROPRIATE_INTIMACY": {"warning": 0, "total": 0},
    "DATA_CLUMPS": {"warning": 0, "total": 0},
    "IMPORT_SIDE_EFFECTS": {"warning": 0, "total": 0},
    "STAR_IMPORTS": {"warning": 0, "total": 0},
    "MIDDLE_MAN": {"warning": 0, "total": 0},
    "PRIMITIVE_OBSESSION": {"warning": 0, "info": 1, "total": 1},
    "MISSING_TYPES": {"info": 0, "total": 0},
    "DEAD_CODE": {"major": 1, "total": 1},
    "TOO_MANY_PARAMS": {"info": 0, "total": 0},
    "MAGIC_NUMBER": {"info": 0, "total": 0},
    "MAGIC_STRING": {"info": 1, "total": 1},
    "INCONSISTENT_NAMING": {"info": 0, "total": 0}
  },

  "verdict": "AUDIT_WEAK",
  "verdict_summary": "No P0 honesty/secret defects, but multiple MAJOR findings (dead self-contradicting branch, 52-line multi-responsibility provisionDriver, hand-rolled tar parser, and an unverified executable written with the exec bit) cap every axis at 0.5. overwrite.ts is clean; driverProvisioner.ts needs the dead branch removed, integrity verification added, and the provision pipeline decomposed."
}
```

## Severity mapping (report → index)

The index uses critical/high/medium/low. Mapping from the audit severity scale:
- critical → critical: 0
- MAJOR → high: 5 (0001 DEAD_CODE-MAJOR, 0003 INJECTION-MAJOR, 0004 LONG_FUNCTION-MAJOR, 0005 KISS-MAJOR, 0006 SOC-MAJOR)
- WARNING → medium: 2 (0002 COMPLEX_CONDITIONAL, 0007 POLA)
- INFO → low: 3 (0008 MAGIC_STRING, 0009 PRIMITIVE_OBSESSION, 0010 DRY)
- total: 10
