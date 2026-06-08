import { describe, expect, it } from "vitest";

import { artifactFreshnessRelevantChangedPaths } from "../../../scripts/checkArtifactFreshness.mjs";

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
    ]);
  });
});
