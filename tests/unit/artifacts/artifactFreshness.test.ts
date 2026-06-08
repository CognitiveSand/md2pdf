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

  it("keeps dependency, artifact, bundled asset, and runtime provisioning changes", () => {
    expect(
      artifactFreshnessRelevantChangedPaths(
        [
          "package-lock.json",
          "artifacts.json",
          "assets/highlight.css",
          "src/browserLocator.ts",
        ],
        manifest,
      ),
    ).toEqual([
      "package-lock.json",
      "artifacts.json",
      "assets/highlight.css",
      "src/browserLocator.ts",
    ]);
  });
});
