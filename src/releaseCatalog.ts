import { ArtifactFreshnessError } from './errors.js';

export const QUARANTINE_DAYS = 7;

/** Returns the oldest date that is still within the quarantine window. */
export function quarantineCutoff(now = new Date()): Date {
  return new Date(now.getTime() - QUARANTINE_DAYS * 24 * 60 * 60 * 1000);
}

/** True when a release is old enough to have cleared the quarantine. */
export function isEligible(publishedAt: Date, now = new Date()): boolean {
  return publishedAt.getTime() <= quarantineCutoff(now).getTime();
}

export interface Release {
  version: string;
  publishedAt: Date;
}

/**
 * From a list of releases, returns the one with the highest version that has
 * cleared the 7-day quarantine.  Throws {@link ArtifactFreshnessError} when
 * no eligible release exists.
 */
export function selectNewestEligible(releases: Release[], now = new Date()): Release {
  const cutoff = quarantineCutoff(now);
  const eligible = releases.filter(r => r.publishedAt.getTime() <= cutoff.getTime());

  if (eligible.length === 0) {
    throw new ArtifactFreshnessError(
      'No release has cleared the 7-day quarantine policy. ' +
        'Wait for a release that is at least 7 days old.',
    );
  }

  eligible.sort((a, b) => compareVersions(a.version, b.version));
  const newest = eligible[eligible.length - 1];
  if (!newest) {
    throw new ArtifactFreshnessError(
      'No release has cleared the 7-day quarantine policy. ' +
        'Wait for a release that is at least 7 days old.',
    );
  }
  return newest;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
