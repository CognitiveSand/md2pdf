import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { cp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const QUARANTINE_DAYS = 7;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cutoff = new Date(Date.now() - QUARANTINE_DAYS * 24 * 60 * 60 * 1000);
const failures = [];

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

function normalizeLock(lock) {
  return JSON.stringify(lock, null, 2);
}

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

async function checkArtifactManifest() {
  const manifestPath = join(root, ".policy", "artifacts.json");
  assert(await exists(manifestPath), "Missing .policy/artifacts.json");
  if (!(await exists(manifestPath))) {
    return;
  }

  const manifest = readJson(manifestPath);
  assert(manifest.schemaVersion === 1, ".policy/artifacts.json must use schemaVersion 1");
  assert(
    manifest.quarantineDays === QUARANTINE_DAYS,
    `.policy/artifacts.json quarantineDays must be ${QUARANTINE_DAYS}`,
  );
  assert(
    manifest.policy === ".policy/ARTIFACT_FRESHNESS_POLICY.md",
    ".policy/artifacts.json must point to .policy/ARTIFACT_FRESHNESS_POLICY.md",
  );
  assert(Array.isArray(manifest.artifacts), ".policy/artifacts.json artifacts must be an array");
  assert(
    Array.isArray(manifest.trackedLocations),
    ".policy/artifacts.json trackedLocations must be an array",
  );

  for (const location of manifest.trackedLocations ?? []) {
    assert(typeof location.path === "string", "trackedLocations entries need a path");
    assert(typeof location.kind === "string", "trackedLocations entries need a kind");
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

    execFileSync(
      "npm",
      [
        "install",
        "--package-lock-only",
        "--ignore-scripts",
        "--before",
        cutoff.toISOString(),
      ],
      { cwd: temp, stdio: "pipe" },
    );

    const original = normalizeLock(readJson(lockPath));
    const regenerated = normalizeLock(readJson(join(temp, "package-lock.json")));

    if (original !== regenerated) {
      failures.push(
        "package-lock.json is not the newest eligible lockfile after the 7-day quarantine",
      );
    }
  } catch (error) {
    failures.push(`npm freshness check failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

async function checkPolicyFiles() {
  const policyPath = join(root, ".policy", "ARTIFACT_FRESHNESS_POLICY.md");
  const agentsPath = join(root, "AGENTS.md");
  const renovatePath = join(root, ".policy", "renovate.json");

  assert(await exists(policyPath), "Missing .policy/ARTIFACT_FRESHNESS_POLICY.md");
  assert(await exists(agentsPath), "Missing AGENTS.md");
  assert(await exists(renovatePath), "Missing .policy/renovate.json");

  if (await exists(renovatePath)) {
    const renovate = readJson(renovatePath);
    assert(
      renovate.minimumReleaseAge === "7 days",
      '.policy/renovate.json minimumReleaseAge must be "7 days"',
    );
    assert(
      renovate.internalChecksFilter === "strict",
      '.policy/renovate.json internalChecksFilter must be "strict"',
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

await main();
