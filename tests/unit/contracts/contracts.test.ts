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

  it("returns null when no release is eligible", () => {
    const policy = new ArtifactPolicy();

    expect(
      policy.selectNewestEligible(
        [release("119.0.3", "2026-06-01T12:00:00.000Z")],
        { quarantineDays: 7, compatibleWith: "119" },
        now,
      ),
    ).toBeNull();
  });
});

describe("C0 stubs", () => {
  it("provisionFallbackBrowser throws NotImplementedError with artifact context", async () => {
    const policy = new ArtifactPolicy();
    const catalog: ReleaseCatalog = {
      async listReleases(): Promise<ArtifactRelease[]> {
        return [];
      },
    };

    await expect(provisionFallbackBrowser(policy, catalog)).rejects.toMatchObject({
      kind: "not-implemented",
      context: {
        artifactName: "chromium-for-testing",
      },
    });
  });

  it("defines the fallback provisioner result shape", () => {
    const result: FallbackBrowserResult = {
      browserPath: "/cache/browser",
      driverPath: "/cache/driver",
    };

    expect(result.browserPath).toBe("/cache/browser");
    expect(result.driverPath).toBe("/cache/driver");
  });
});

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
