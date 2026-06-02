import { describe, it, expect } from 'vitest';
// The freshness checker is a build script (.mjs); vitest transpiles the .ts
// test without type-checking, and tsconfig excludes tests/, so importing the
// untyped module here does not affect `npm run typecheck`.
import {
  lockVersionSignature,
  freshnessFailures,
} from '../../scripts/checkArtifactFreshness.mjs';

/** Build a minimal lockfile object with the given package entries. */
function lock(packages: Record<string, unknown>): unknown {
  return { packages };
}

const validWaiver = {
  package: 'left-pad',
  version: '2.0.0',
  auditReport: 'security/audits/left-pad@2.0.0.md',
  approvedBy: 'jmirodg',
  approvedOn: '2026-06-02',
};

const auditPresent = () => true;
const auditMissing = () => false;

describe('lockVersionSignature', () => {
  it('ignores npm-version-variant metadata (libc) for equal versions', () => {
    const withLibc = lock({
      'node_modules/lightningcss-linux-x64-gnu': {
        version: '1.30.2',
        resolved: 'https://registry.npmjs.org/x/-/x-1.30.2.tgz',
        integrity: 'sha512-AAA',
        libc: ['glibc'],
      },
    });
    const withoutLibc = lock({
      'node_modules/lightningcss-linux-x64-gnu': {
        version: '1.30.2',
        resolved: 'https://registry.npmjs.org/x/-/x-1.30.2.tgz',
        integrity: 'sha512-AAA',
      },
    });

    expect(lockVersionSignature(withLibc)).toBe(lockVersionSignature(withoutLibc));
  });

  it('skips exempt paths', () => {
    const l = lock({
      'node_modules/foo': { version: '1.0.0', resolved: 'r', integrity: 'i' },
    });
    expect(lockVersionSignature(l, new Set(['node_modules/foo']))).toBe('{}');
  });
});

describe('freshnessFailures', () => {
  it('passes when committed and regenerated lockfiles agree and there are no waivers', () => {
    const committed = lock({
      'node_modules/foo': { version: '1.0.0', resolved: 'r1', integrity: 'i1' },
    });
    const regenerated = lock({
      'node_modules/foo': { version: '1.0.0', resolved: 'r1', integrity: 'i1' },
    });

    expect(freshnessFailures(committed, regenerated, [], auditPresent)).toEqual([]);
  });

  it('fails when a non-waived package version differs from newest-eligible', () => {
    const committed = lock({
      'node_modules/foo': { version: '2.0.0', resolved: 'r2', integrity: 'i2' },
    });
    const regenerated = lock({
      'node_modules/foo': { version: '1.0.0', resolved: 'r1', integrity: 'i1' },
    });

    const failures = freshnessFailures(committed, regenerated, [], auditPresent);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('newest eligible');
  });

  it('lets an audited, approved in-quarantine version through via a valid waiver', () => {
    const committed = lock({
      'node_modules/left-pad': { version: '2.0.0', resolved: 'r2', integrity: 'i2' },
    });
    // newest-eligible (older) version npm would pick under the quarantine cutoff
    const regenerated = lock({
      'node_modules/left-pad': { version: '1.0.0', resolved: 'r1', integrity: 'i1' },
    });

    expect(
      freshnessFailures(committed, regenerated, [validWaiver], auditPresent),
    ).toEqual([]);
  });

  it('rejects a waiver whose audit report is missing from the repo', () => {
    const committed = lock({
      'node_modules/left-pad': { version: '2.0.0', resolved: 'r2', integrity: 'i2' },
    });
    const regenerated = lock({
      'node_modules/left-pad': { version: '1.0.0', resolved: 'r1', integrity: 'i1' },
    });

    const failures = freshnessFailures(committed, regenerated, [validWaiver], auditMissing);
    expect(failures.some((f) => f.includes('missing audit report'))).toBe(true);
  });

  it('rejects a waiver whose version does not match the locked version', () => {
    const committed = lock({
      'node_modules/left-pad': { version: '3.0.0', resolved: 'r3', integrity: 'i3' },
    });
    const regenerated = lock({
      'node_modules/left-pad': { version: '1.0.0', resolved: 'r1', integrity: 'i1' },
    });

    const failures = freshnessFailures(committed, regenerated, [validWaiver], auditPresent);
    expect(failures.some((f) => f.includes('does not match the locked version'))).toBe(true);
  });

  it('rejects a waiver missing required fields', () => {
    const committed = lock({
      'node_modules/left-pad': { version: '2.0.0', resolved: 'r2', integrity: 'i2' },
    });
    const regenerated = committed;
    const incomplete = { package: 'left-pad', version: '2.0.0' };

    const failures = freshnessFailures(committed, regenerated, [incomplete], auditPresent);
    expect(failures.some((f) => f.includes('missing a required field'))).toBe(true);
  });
});
