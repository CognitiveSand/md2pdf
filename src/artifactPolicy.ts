import { ArtifactFreshnessError } from "./errors.js";

export interface ArtifactRelease {
  version: string;
  publishedAt: string;
  url: string;
  sha256: string;
  size: number;
  provenance: string;
  source?: string;
  kind?: string;
  path?: string;
  platform?: string;
  compatibleWith?: string;
  browserPath?: string;
  driverPath?: string;
}

export interface ArtifactConstraints {
  quarantineDays: number;
  compatibleWith?: string;
  platform?: string;
}

export interface ReleaseCatalog {
  listReleases(artifactName: string): Promise<ArtifactRelease[]>;
}

const requiredQuarantineDays = 7;

export class ArtifactPolicy {
  selectNewestEligible(
    releases: ArtifactRelease[],
    constraints: ArtifactConstraints,
    now: Date,
  ): ArtifactRelease {
    assertRequiredQuarantineDays(constraints.quarantineDays);
    const cutoff = now.getTime() - constraints.quarantineDays * 24 * 60 * 60 * 1000;
    const eligible = releases
      .filter((release) => this.isEligible(release, constraints, cutoff))
      .sort((left, right) => publishedTime(right) - publishedTime(left));

    const selected = eligible[0];
    if (selected === undefined) {
      throw new ArtifactFreshnessError({
        message: "No compatible artifact release has completed quarantine",
        actionHint: "Declare the newest eligible immutable release in artifacts.json or wait for the quarantine period.",
        cause: "no-eligible-release",
      });
    }

    return selected;
  }

  private isEligible(
    release: ArtifactRelease,
    constraints: ArtifactConstraints,
    cutoff: number,
  ): boolean {
    this.assertReleaseShape(release);

    const publishedAt = publishedTime(release);
    if (!Number.isFinite(publishedAt) || publishedAt > cutoff) {
      return false;
    }

    if (constraints.platform !== undefined && release.platform !== constraints.platform) {
      return false;
    }

    if (constraints.compatibleWith === undefined) {
      return true;
    }

    return isCompatibleVersion(release.compatibleWith ?? release.version, constraints.compatibleWith);
  }

  private assertReleaseShape(release: ArtifactRelease): void {
    const label = releaseLabel(release);
    if (typeof release.version !== "string" || release.version.trim() === "") {
      throw malformedArtifact(label, "Artifact releases must declare an exact version");
    }

    if (isFloatingVersion(release.version)) {
      throw malformedArtifact(label, "Artifact releases must use an exact version, not a floating tag");
    }

    if (!isImmutableHttpsUrl(release.url)) {
      throw malformedArtifact(label, "Artifact releases must declare an immutable https URL without query or fragment");
    }

    if (!/^[a-f0-9]{64}$/iu.test(release.sha256)) {
      throw malformedArtifact(label, "Artifact releases must declare a SHA-256 checksum");
    }

    if (!Number.isFinite(release.size) || release.size <= 0) {
      throw malformedArtifact(label, "Artifact releases must declare a positive byte size");
    }

    if (typeof release.provenance !== "string" || release.provenance.trim() === "") {
      throw malformedArtifact(label, "Artifact releases must declare provenance");
    }
  }
}

function assertRequiredQuarantineDays(quarantineDays: number): void {
  if (quarantineDays === requiredQuarantineDays) {
    return;
  }

  throw new ArtifactFreshnessError({
    message: "Artifact quarantine must be exactly 7 days",
    actionHint: "Runtime artifact policy cannot shorten or lengthen the repository quarantine rule.",
    cause: "invalid-quarantine-days",
  });
}

function publishedTime(release: ArtifactRelease): number {
  return new Date(release.publishedAt).getTime();
}

function isCompatibleVersion(version: string, compatibleWith: string): boolean {
  const releaseMajor = majorVersion(version);
  const compatibleMajor = majorVersion(compatibleWith);

  if (releaseMajor !== null && compatibleMajor !== null) {
    return releaseMajor === compatibleMajor;
  }

  return version === compatibleWith;
}

function majorVersion(version: string): number | null {
  const match = /^(\d+)(?:[.-]|$)/u.exec(version);
  if (match === null) {
    return null;
  }

  return Number(match[1]);
}

function isFloatingVersion(version: string): boolean {
  return /^(latest|stable|beta|canary|dev|nightly)$/iu.test(version.trim());
}

function isImmutableHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.search === "" && url.hash === "";
  } catch {
    return false;
  }
}

function malformedArtifact(label: string, message: string): ArtifactFreshnessError {
  return new ArtifactFreshnessError({
    message,
    artifactName: label,
    actionHint: "Fix artifacts.json so every runtime artifact is exact, immutable, checksummed, sized, and provenance-backed.",
    cause: "invalid-artifact-manifest",
  });
}

function releaseLabel(release: ArtifactRelease): string {
  if (typeof release.version === "string" && release.version.trim() !== "") {
    return release.version;
  }

  if (typeof release.url === "string" && release.url.trim() !== "") {
    return release.url;
  }

  return "artifact";
}
