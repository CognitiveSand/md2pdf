import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { cp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const QUARANTINE_DAYS = 7;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cutoff = new Date(Date.now() - QUARANTINE_DAYS * 24 * 60 * 60 * 1000);
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const failures = [];

function runNpm(args, options) {
  if (process.platform === "win32") {
    execFileSync("cmd.exe", ["/d", "/s", "/c", npmExecutable, ...args], options);
    return;
  }

  execFileSync(npmExecutable, args, options);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Project a lockfile down to the fields that determine version eligibility:
 * each package's resolved version, source URL, and integrity hash.
 *
 * Everything else npm records per package (cpu / os / libc discriminators,
 * license, bin, dependency ranges, ...) is manifest-derived metadata whose
 * mere *presence* in the lockfile varies by npm CLI version — for example npm
 * 11+ writes a `libc` field that npm 10 omits. Comparing the whole serialized
 * lockfile therefore fails the freshness gate on cosmetic format drift between
 * npm versions, not on an actual change of selected version. The policy
 * (ARTIFACT_FRESHNESS_POLICY.md) is defined over versions and publication
 * timestamps, so the comparison must be too.
 */
export function lockVersionSignature(lock, exemptPaths = new Set()) {
  const packages = lock.packages ?? {};
  const signature = {};
  for (const path of Object.keys(packages).sort()) {
    if (exemptPaths.has(path)) {
      continue;
    }
    const entry = packages[path];
    signature[path] = {
      version: entry.version ?? null,
      resolved: entry.resolved ?? null,
      integrity: entry.integrity ?? null,
    };
  }
  return JSON.stringify(signature);
}

/**
 * Decide which freshness failures a lockfile pair produces, honouring approved
 * quarantine waivers (ARTIFACT_FRESHNESS_POLICY.md, "Quarantine Waiver").
 *
 * `committedLock` is the lockfile in the repo; `regeneratedLock` is the
 * newest-eligible lockfile npm produces under the 7-day `--before` cutoff. A
 * valid waiver — one whose package is locked at exactly the waived version and
 * whose in-repo audit report exists — exempts that package's lockfile entry
 * from the version-match comparison, letting the audited in-quarantine version
 * through. `auditExists(reportPath)` reports whether a waiver's audit report
 * file is present in the repository.
 */
export function freshnessFailures(committedLock, regeneratedLock, waivers, auditExists) {
  const failures = [];
  const exemptPaths = new Set();

  for (const waiver of waivers) {
    const label = `${waiver?.package ?? "?"}@${waiver?.version ?? "?"}`;
    if (
      !waiver?.package ||
      !waiver?.version ||
      !waiver?.auditReport ||
      !waiver?.approvedBy ||
      !waiver?.approvedOn
    ) {
      failures.push(
        `quarantine waiver ${label} is missing a required field (package, version, auditReport, approvedBy, approvedOn)`,
      );
      continue;
    }

    const path = `node_modules/${waiver.package}`;
    const locked = committedLock.packages?.[path];
    if (!locked) {
      failures.push(
        `quarantine waiver ${label} does not match any package in package-lock.json`,
      );
      continue;
    }
    if (locked.version !== waiver.version) {
      failures.push(
        `quarantine waiver ${label} does not match the locked version ${locked.version}`,
      );
      continue;
    }
    if (!auditExists(waiver.auditReport)) {
      failures.push(
        `quarantine waiver ${label} references a missing audit report: ${waiver.auditReport}`,
      );
      continue;
    }

    exemptPaths.add(path);
  }

  if (
    lockVersionSignature(committedLock, exemptPaths) !==
    lockVersionSignature(regeneratedLock, exemptPaths)
  ) {
    failures.push(
      "package-lock.json is not the newest eligible lockfile after the 7-day quarantine",
    );
  }

  return failures;
}

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

async function checkArtifactManifest() {
  const manifestPath = join(root, "artifacts.json");
  assert(await exists(manifestPath), "Missing artifacts.json");
  if (!(await exists(manifestPath))) {
    return;
  }

  const manifest = readJson(manifestPath);
  assert(manifest.schemaVersion === 1, "artifacts.json must use schemaVersion 1");
  assert(
    manifest.quarantineDays === QUARANTINE_DAYS,
    `artifacts.json quarantineDays must be ${QUARANTINE_DAYS}`,
  );
  assert(
    manifest.policy === "ARTIFACT_FRESHNESS_POLICY.md",
    "artifacts.json must point to ARTIFACT_FRESHNESS_POLICY.md",
  );
  assert(Array.isArray(manifest.artifacts), "artifacts.json artifacts must be an array");
  assert(
    Array.isArray(manifest.trackedLocations),
    "artifacts.json trackedLocations must be an array",
  );

  for (const location of manifest.trackedLocations ?? []) {
    assert(typeof location.path === "string", "trackedLocations entries need a path");
    assert(typeof location.kind === "string", "trackedLocations entries need a kind");
  }

  if (manifest.waivers !== undefined) {
    assert(
      Array.isArray(manifest.waivers),
      "artifacts.json waivers must be an array when present",
    );
  }
}

async function checkNpmLockFreshness() {
  const packageJsonPath = join(root, "package.json");
  const lockPath = join(root, "package-lock.json");

  if (!(await exists(packageJsonPath)) || !(await exists(lockPath))) {
    return;
  }

  const temp = mkdtempSync(join(tmpdir(), "md2pdf-artifacts-"));
  try {
    await cp(packageJsonPath, join(temp, "package.json"));
    await cp(lockPath, join(temp, "package-lock.json"));

    runNpm(
      [
        "install",
        "--package-lock-only",
        "--ignore-scripts",
        "--before",
        cutoff.toISOString(),
      ],
      { cwd: temp, stdio: "pipe" },
    );

    const committedLock = readJson(lockPath);
    const regeneratedLock = readJson(join(temp, "package-lock.json"));

    const manifest = readJson(join(root, "artifacts.json"));
    const waivers = Array.isArray(manifest.waivers) ? manifest.waivers : [];
    const auditExists = (reportPath) => existsSync(join(root, reportPath));

    for (const failure of freshnessFailures(
      committedLock,
      regeneratedLock,
      waivers,
      auditExists,
    )) {
      failures.push(failure);
    }
  } catch (error) {
    failures.push(`npm freshness check failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

async function checkPolicyFiles() {
  const policyPath = join(root, "ARTIFACT_FRESHNESS_POLICY.md");
  const agentsPath = join(root, "AGENTS.md");
  const renovatePath = join(root, "renovate.json");

  assert(await exists(policyPath), "Missing ARTIFACT_FRESHNESS_POLICY.md");
  assert(await exists(agentsPath), "Missing AGENTS.md");
  assert(await exists(renovatePath), "Missing renovate.json");

  if (await exists(renovatePath)) {
    const renovate = readJson(renovatePath);
    assert(
      renovate.minimumReleaseAge === "7 days",
      'renovate.json minimumReleaseAge must be "7 days"',
    );
    assert(
      renovate.internalChecksFilter === "strict",
      'renovate.json internalChecksFilter must be "strict"',
    );
  }
}

async function main() {
  await checkPolicyFiles();
  await checkArtifactManifest();
  await checkNpmLockFreshness();

  if (failures.length > 0) {
    console.error("Artifact freshness policy failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Artifact freshness policy passed.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
