import { describe, it, expect } from 'vitest';
import {
  isEligible,
  quarantineCutoff,
  selectNewestEligible,
  QUARANTINE_DAYS,
} from '../../src/releaseCatalog.js';
import { ArtifactFreshnessError } from '../../src/errors.js';

const NOW = new Date('2026-06-02T12:00:00Z');
const CUTOFF = new Date('2026-05-26T12:00:00Z'); // NOW - 7 days

describe('quarantineCutoff', () => {
  it('returns a date exactly QUARANTINE_DAYS before now', () => {
    const cutoff = quarantineCutoff(NOW);
    const diffDays = (NOW.getTime() - cutoff.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(QUARANTINE_DAYS, 5);
  });
});

describe('isEligible', () => {
  it('returns true for releases older than 7 days', () => {
    const old = new Date('2026-05-01T00:00:00Z');
    expect(isEligible(old, NOW)).toBe(true);
  });

  it('returns true for a release published exactly on the cutoff', () => {
    expect(isEligible(CUTOFF, NOW)).toBe(true);
  });

  it('returns false for a release one second inside quarantine', () => {
    const oneSecondAfterCutoff = new Date(CUTOFF.getTime() + 1000);
    expect(isEligible(oneSecondAfterCutoff, NOW)).toBe(false);
  });

  it('returns false for a release published yesterday', () => {
    const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    expect(isEligible(yesterday, NOW)).toBe(false);
  });

  it('returns false for a release published today', () => {
    expect(isEligible(NOW, NOW)).toBe(false);
  });
});

describe('selectNewestEligible', () => {
  it('returns the newest eligible release', () => {
    const releases = [
      { version: '1.0.0', publishedAt: new Date('2026-05-01T00:00:00Z') },
      { version: '1.1.0', publishedAt: new Date('2026-05-10T00:00:00Z') },
      { version: '1.2.0', publishedAt: new Date('2026-05-20T00:00:00Z') }, // eligible (before cutoff)
      { version: '1.3.0', publishedAt: new Date('2026-05-28T00:00:00Z') }, // in quarantine
    ];
    const result = selectNewestEligible(releases, NOW);
    expect(result.version).toBe('1.2.0');
  });

  it('throws ArtifactFreshnessError when all releases are in quarantine', () => {
    const releases = [
      { version: '2.0.0', publishedAt: new Date('2026-05-30T00:00:00Z') },
      { version: '2.1.0', publishedAt: new Date('2026-06-01T00:00:00Z') },
    ];
    expect(() => selectNewestEligible(releases, NOW)).toThrowError(ArtifactFreshnessError);
  });

  it('throws ArtifactFreshnessError for an empty release list', () => {
    expect(() => selectNewestEligible([], NOW)).toThrowError(ArtifactFreshnessError);
  });

  it('picks correctly among semantically close versions', () => {
    const releases = [
      { version: '1.10.0', publishedAt: new Date('2026-05-01T00:00:00Z') },
      { version: '1.9.0', publishedAt: new Date('2026-05-02T00:00:00Z') },
      { version: '1.10.1', publishedAt: new Date('2026-05-03T00:00:00Z') },
    ];
    const result = selectNewestEligible(releases, NOW);
    expect(result.version).toBe('1.10.1');
  });

  it('does not select versions inside the quarantine window', () => {
    const releases = [
      { version: '3.0.0', publishedAt: new Date('2026-05-01T00:00:00Z') },
      { version: '4.0.0', publishedAt: new Date('2026-05-30T00:00:00Z') }, // in quarantine
    ];
    const result = selectNewestEligible(releases, NOW);
    expect(result.version).toBe('3.0.0');
  });

  it('has no bypass or force mode — quarantine cannot be disabled', () => {
    // The function signature has no parameter to skip quarantine
    const releases = [
      { version: '1.0.0', publishedAt: new Date('2026-06-01T00:00:00Z') }, // in quarantine
    ];
    // Only way to get a result is if there's an eligible release
    expect(() => selectNewestEligible(releases, NOW)).toThrowError(ArtifactFreshnessError);
  });
});
