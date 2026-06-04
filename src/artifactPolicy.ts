export interface ArtifactRelease {
  version: string;
  publishedAt: string;
  url: string;
  sha256: string;
  size: number;
  provenance: string;
}

export interface ArtifactConstraints {
  quarantineDays: number;
  compatibleWith?: string;
}

export interface ReleaseCatalog {
  listReleases(artifactName: string): Promise<ArtifactRelease[]>;
}

export class ArtifactPolicy {
  selectNewestEligible(
    releases: ArtifactRelease[],
    constraints: ArtifactConstraints,
    now: Date,
  ): ArtifactRelease | null {
    const cutoff = now.getTime() - constraints.quarantineDays * 24 * 60 * 60 * 1000;
    const eligible = releases
      .filter((release) => this.isEligible(release, constraints, cutoff))
      .sort((left, right) => publishedTime(right) - publishedTime(left));

    return eligible[0] ?? null;
  }

  private isEligible(
    release: ArtifactRelease,
    constraints: ArtifactConstraints,
    cutoff: number,
  ): boolean {
    const publishedAt = publishedTime(release);
    if (!Number.isFinite(publishedAt) || publishedAt > cutoff) {
      return false;
    }

    if (constraints.compatibleWith === undefined) {
      return true;
    }

    return isCompatibleVersion(release.version, constraints.compatibleWith);
  }
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
