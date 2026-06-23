import { describe, expect, it } from "vitest";

import {
  artifactFreshnessRelevantChangedPaths,
  freshnessFailures,
  undeclaredTrackedArtifactFailures,
} from "../../../scripts/checkArtifactFreshness.mjs";

const manifest = {
  artifacts: [
    {
      path: "assets/highlight.css",
    },
  ],
  trackedLocations: [
    {
      path: "assets/",
      kind: "bundled-assets",
    },
    {
      path: "src/browserLocator.ts",
      kind: "runtime-provisioning",
    },
    {
      path: "src/releaseCatalog.ts",
      kind: "runtime-provisioning",
    },
  ],
};

describe("artifact freshness staged path filter", () => {
  it("ignores audit-only changes for pre-commit gating", () => {
    expect(
      artifactFreshnessRelevantChangedPaths(
        ["audit/2026-06-08-stream-a-b-progress-code-audit.md"],
        manifest,
      ),
    ).toEqual([]);
  });

  it("keeps dependency, artifact, bundled asset, runtime provisioning, and enforcement changes", () => {
    expect(
      artifactFreshnessRelevantChangedPaths(
        [
          ".githooks/pre-commit",
          "package-lock.json",
          "artifacts.json",
          "assets/highlight.css",
          "scripts/checkArtifactFreshness.mjs",
          "src/browserLocator.ts",
          "src/releaseCatalog.ts",
        ],
        manifest,
      ),
    ).toEqual([
      ".githooks/pre-commit",
      "package-lock.json",
      "artifacts.json",
      "assets/highlight.css",
      "scripts/checkArtifactFreshness.mjs",
      "src/browserLocator.ts",
      "src/releaseCatalog.ts",
    ]);
  });

  it("keeps the release catalog in the staged artifact gate", () => {
    expect(artifactFreshnessRelevantChangedPaths(["src/releaseCatalog.ts"], manifest)).toEqual([
      "src/releaseCatalog.ts",
    ]);
  });

  it("reports bundled assets that are tracked but not declared", () => {
    expect(undeclaredTrackedArtifactFailures(["assets/new-theme.css"], manifest)).toEqual([
      "staged bundled asset is not declared in artifacts.json: assets/new-theme.css",
    ]);
    expect(undeclaredTrackedArtifactFailures(["assets/highlight.css"], manifest)).toEqual([]);
  });
});

describe("artifact freshness quarantine waivers", () => {
  it("rejects incomplete waivers before comparing lockfiles", () => {
    expect(
      freshnessFailures(
        lockWith("left-pad", "1.0.0"),
        lockWith("left-pad", "1.0.0"),
        [
          {
            package: "left-pad",
            version: "1.0.0",
            auditReport: "security/audits/left-pad@1.0.0.md",
            approvedBy: "owner",
          },
        ],
        () => true,
      ),
    ).toEqual([
      "quarantine waiver left-pad@1.0.0 is missing a required field (package, version, auditReport, approvedBy, approvedOn)",
    ]);
  });

  it("rejects waivers whose audit report is not the exact security audit path", () => {
    expect(
      freshnessFailures(
        lockWith("left-pad", "1.0.0"),
        lockWith("left-pad", "1.0.0"),
        [
          {
            package: "left-pad",
            version: "1.0.0",
            auditReport: "README.md",
            approvedBy: "owner",
            approvedOn: "2026-06-08",
          },
        ],
        () => true,
      ),
    ).toEqual([
      "quarantine waiver left-pad@1.0.0 auditReport must be security/audits/left-pad@1.0.0.md",
    ]);
  });

  it("rejects waivers whose approvedOn is not a real calendar date", () => {
    expect(
      freshnessFailures(
        lockWith("left-pad", "1.0.0"),
        lockWith("left-pad", "1.0.0"),
        [
          {
            package: "left-pad",
            version: "1.0.0",
            auditReport: "security/audits/left-pad@1.0.0.md",
            approvedBy: "owner",
            approvedOn: "2026-99-99",
          },
        ],
        () => true,
      ),
    ).toEqual([
      "quarantine waiver left-pad@1.0.0 approvedOn must be an ISO date (YYYY-MM-DD)",
    ]);
  });

  it("rejects waivers whose audit report is missing", () => {
    expect(
      freshnessFailures(
        lockWith("left-pad", "1.0.0"),
        lockWith("left-pad", "1.0.0"),
        [
          {
            package: "left-pad",
            version: "1.0.0",
            auditReport: "security/audits/left-pad@1.0.0.md",
            approvedBy: "owner",
            approvedOn: "2026-06-08",
          },
        ],
        () => false,
      ),
    ).toEqual([
      "quarantine waiver left-pad@1.0.0 references a missing audit report: security/audits/left-pad@1.0.0.md",
    ]);
  });

  it("rejects lockfiles that diverge from the newest eligible regeneration", () => {
    expect(
      freshnessFailures(
        lockWith("left-pad", "1.0.0"),
        lockWith("left-pad", "1.0.1"),
        [],
        () => true,
      ),
    ).toEqual([
      "package-lock.json is not the newest eligible lockfile after the 7-day quarantine",
    ]);
  });
});

function lockWith(packageName: string, version: string): unknown {
  return {
    packages: {
      [`node_modules/${packageName}`]: {
        version,
        resolved: `https://registry.npmjs.org/${packageName}/-/${packageName}-${version}.tgz`,
        integrity: "sha512-test",
      },
    },
  };
}
