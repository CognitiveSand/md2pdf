import { describe, expect, it } from "vitest";

import {
  ArtifactFreshnessError,
  BrowserNotFoundError,
  ConversionError,
  formatError,
  InputNotFoundError,
  Md2PdfError,
  NotImplementedError,
  RenderError,
  UsageError,
} from "../../../src/errors.js";
import {
  convertFile,
  type ConversionJob,
  type ConversionOutcome,
  type ConvertOptions,
} from "../../../src/contracts.js";
import {
  ArtifactPolicy,
  type ArtifactRelease,
  type ReleaseCatalog,
} from "../../../src/artifactPolicy.js";
import {
  provisionFallbackBrowser,
  type FallbackBrowserResult,
} from "../../../src/fallbackBrowserProvisioner.js";

describe("C0 shared contract exports", () => {
  it("imports the contractual runtime exports without a cycle", () => {
    expect(Md2PdfError).toBeTypeOf("function");
    expect(UsageError).toBeTypeOf("function");
    expect(InputNotFoundError).toBeTypeOf("function");
    expect(ConversionError).toBeTypeOf("function");
    expect(RenderError).toBeTypeOf("function");
    expect(BrowserNotFoundError).toBeTypeOf("function");
    expect(ArtifactFreshnessError).toBeTypeOf("function");
    expect(NotImplementedError).toBeTypeOf("function");
    expect(formatError).toBeTypeOf("function");
    expect(convertFile).toBeTypeOf("function");
    expect(ArtifactPolicy).toBeTypeOf("function");
    expect(provisionFallbackBrowser).toBeTypeOf("function");
  });

  it("instantiates conversion contracts with the expected fields", () => {
    const options: ConvertOptions = {
      browserPath: "/usr/bin/browser",
      renderTimeoutMs: 5000,
    };
    const job: ConversionJob = {
      sourcePath: "/docs/source.md",
      outputPath: "/docs/source.pdf",
      originEntry: "source.md",
    };
    const outcome: ConversionOutcome = {
      ...job,
      status: "failed",
      error: new ConversionError({ message: "render failed", ...job }),
    };

    expect(options.renderTimeoutMs).toBe(5000);
    expect(outcome.sourcePath).toBe(job.sourcePath);
    expect(outcome.outputPath).toBe(job.outputPath);
    expect(outcome.originEntry).toBe(job.originEntry);
    expect(outcome.error).toBeInstanceOf(Md2PdfError);
  });
});

describe("C0 shared errors", () => {
  it("formats kind, message, paths, artifact hints, and causes", () => {
    const error = new ArtifactFreshnessError({
      message: "artifact is too new",
      sourcePath: "/tmp/input.md",
      outputPath: "/tmp/output.pdf",
      artifactName: "chromium-for-testing",
      actionHint: "wait for quarantine",
      cause: new Error("published yesterday"),
    });

    expect(formatError(error)).toBe(
      [
        "[artifact] artifact is too new",
        "source: /tmp/input.md",
        "output: /tmp/output.pdf",
        "artifact: chromium-for-testing",
        "hint: wait for quarantine",
        "cause: published yesterday",
      ].join("\n"),
    );
  });

  it("serializes the stable error context", () => {
    const error = new UsageError({
      message: "missing entry",
      actionHint: "run md2pdf --help",
    });

    expect(error.toJSON()).toEqual({
      kind: "usage",
      message: "missing entry",
      actionHint: "run md2pdf --help",
    });
  });
});

describe("ArtifactPolicy.selectNewestEligible", () => {
  const now = new Date("2026-06-04T12:00:00.000Z");

  it("selects the newest release that completed quarantine", () => {
    const policy = new ArtifactPolicy();

    expect(
      policy.selectNewestEligible(
        [
          release("119.0.1", "2026-05-20T12:00:00.000Z"),
          release("119.0.2", "2026-05-28T12:00:00.000Z"),
          release("119.0.3", "2026-05-29T12:00:01.000Z"),
          release("119.0.4", "not-a-date"),
        ],
        { quarantineDays: 7, compatibleWith: "119" },
        now,
      ),
    ).toMatchObject({ version: "119.0.2" });
  });

  it("applies major-version compatibility when both versions start numerically", () => {
    const policy = new ArtifactPolicy();

    expect(
      policy.selectNewestEligible(
        [
          release("120.0.0", "2026-05-20T12:00:00.000Z"),
          release("119.9.0", "2026-05-19T12:00:00.000Z"),
        ],
        { quarantineDays: 7, compatibleWith: "119.1.2" },
        now,
      ),
    ).toMatchObject({ version: "119.9.0" });
  });

  it("uses exact compatibility when either version is not numeric", () => {
    const policy = new ArtifactPolicy();

    expect(
      policy.selectNewestEligible(
        [
          release("stable-120", "2026-05-20T12:00:00.000Z"),
          release("stable-119", "2026-05-19T12:00:00.000Z"),
        ],
        { quarantineDays: 7, compatibleWith: "stable-119" },
        now,
      ),
    ).toMatchObject({ version: "stable-119" });
  });

  it("selects the newest eligible artifact for the requested platform", () => {
    const policy = new ArtifactPolicy();

    expect(
      policy.selectNewestEligible(
        [
          { ...release("120.0.0", "2026-05-21T12:00:00.000Z"), platform: "linux-x64" },
          { ...release("119.0.0", "2026-05-20T12:00:00.000Z"), platform: "darwin-arm64" },
        ],
        { quarantineDays: 7, platform: "darwin-arm64" },
        now,
      ),
    ).toMatchObject({ version: "119.0.0", platform: "darwin-arm64" });
  });

  it("throws ArtifactFreshnessError when no release is eligible", () => {
    const policy = new ArtifactPolicy();

    expect(
      () => policy.selectNewestEligible(
        [release("119.0.3", "2026-06-01T12:00:00.000Z")],
        { quarantineDays: 7, compatibleWith: "119" },
        now,
      ),
    ).toThrow(ArtifactFreshnessError);
  });

  it("rejects caller-controlled quarantine values instead of allowing freshness bypasses", () => {
    const policy = new ArtifactPolicy();
    const releases = [release("119.0.3", "2026-06-04T12:00:00.000Z")];

    for (const quarantineDays of [0, 6, 14]) {
      expectArtifactPolicyError(
        () => policy.selectNewestEligible(
          releases,
          { quarantineDays },
          now,
        ),
        "invalid-quarantine-days",
      );
    }
  });

  it("rejects floating artifact versions instead of selecting latest-like tags", () => {
    const policy = new ArtifactPolicy();

    expectInvalidArtifact(
      () => policy.selectNewestEligible(
        [release("latest", "2026-05-20T12:00:00.000Z")],
        { quarantineDays: 7 },
        now,
      ),
      { artifactName: "latest" },
    );
  });

  it("rejects mutable or non-https artifact URLs", () => {
    const policy = new ArtifactPolicy();

    for (const url of [
      "http://downloads.example.invalid/120.zip",
      "https://downloads.example.invalid/120.zip?channel=stable",
      "https://downloads.example.invalid/120.zip#fragment",
    ]) {
      expectInvalidArtifact(() =>
        policy.selectNewestEligible(
          [{ ...release("120.0.0", "2026-05-20T12:00:00.000Z"), url }],
          { quarantineDays: 7 },
          now,
        ),
      );
    }
  });

  it("rejects artifact releases missing checksum, size, provenance, or exact version", () => {
    const policy = new ArtifactPolicy();
    const validRelease = release("120.0.0", "2026-05-20T12:00:00.000Z");

    for (const malformedRelease of [
      { ...validRelease, version: "" },
      { ...validRelease, sha256: "not-a-sha" },
      { ...validRelease, size: 0 },
      { ...validRelease, provenance: "" },
    ] as ArtifactRelease[]) {
      expectInvalidArtifact(() =>
        policy.selectNewestEligible(
          [malformedRelease],
          { quarantineDays: 7 },
          now,
        ),
      );
    }
  });
});

describe("C0 stubs", () => {
  it("provisionFallbackBrowser reports missing eligible fallback artifact", async () => {
    const policy = new ArtifactPolicy();
    const catalog: ReleaseCatalog = {
      async listReleases(): Promise<ArtifactRelease[]> {
        return [];
      },
    };

    await expect(provisionFallbackBrowser(policy, catalog)).rejects.toMatchObject({
      kind: "artifact",
      context: {
        artifactName: "chromium-for-testing",
      },
    });
  });

  it("defines the fallback provisioner result shape", () => {
    const result: FallbackBrowserResult = {
      browserPath: "/cache/browser",
      driverPath: "/cache/driver",
      release: release("120.0.0", "2026-05-20T12:00:00.000Z"),
    };

    expect(result.browserPath).toBe("/cache/browser");
    expect(result.driverPath).toBe("/cache/driver");
    expect(result.release.version).toBe("120.0.0");
  });
});

function expectInvalidArtifact(
  action: () => unknown,
  expectedContext: Partial<ArtifactFreshnessError["context"]> = {},
): void {
  expectArtifactPolicyError(action, "invalid-artifact-manifest", expectedContext);
}

function expectArtifactPolicyError(
  action: () => unknown,
  cause: unknown,
  expectedContext: Partial<ArtifactFreshnessError["context"]> = {},
): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ArtifactFreshnessError);
    expect(error).toMatchObject({
      kind: "artifact",
      context: {
        cause,
        ...expectedContext,
      },
    });
    return;
  }

  throw new Error("Expected ArtifactFreshnessError");
}

function release(version: string, publishedAt: string): ArtifactRelease {
  return {
    version,
    publishedAt,
    url: `https://downloads.example.invalid/${version}.zip`,
    sha256: "0".repeat(64),
    size: 42,
    provenance: "test catalog",
  };
}
