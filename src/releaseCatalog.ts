import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ArtifactRelease, ReleaseCatalog } from "./artifactPolicy.js";
import { ArtifactFreshnessError } from "./errors.js";

const defaultManifestPath = resolve(dirname(fileURLToPath(import.meta.url)), "../artifacts.json");

export interface JsonReleaseCatalogOptions {
  manifestPath?: string;
}

interface ArtifactManifest {
  artifacts?: unknown;
}

type ArtifactRecord = Record<string, unknown>;

export class JsonReleaseCatalog implements ReleaseCatalog {
  private readonly manifestPath: string;

  constructor(options: JsonReleaseCatalogOptions = {}) {
    this.manifestPath = resolve(options.manifestPath ?? defaultManifestPath);
  }

  async listReleases(artifactName: string): Promise<ArtifactRelease[]> {
    const manifest = await this.readManifest();
    const artifacts = asArtifactArray(manifest.artifacts, this.manifestPath);
    const releases = artifacts
      .filter((artifact) => matchesArtifactName(artifact, artifactName))
      .flatMap((artifact) => releasesForArtifact(artifact, this.manifestPath));

    return releases.map((release) => ({ ...release }));
  }

  private async readManifest(): Promise<ArtifactManifest> {
    try {
      const manifest = JSON.parse(await readFile(this.manifestPath, "utf8")) as unknown;
      if (manifest !== null && typeof manifest === "object" && !Array.isArray(manifest)) {
        return manifest as ArtifactManifest;
      }

      throw new Error("artifacts.json root must be an object");
    } catch (cause) {
      throw new ArtifactFreshnessError({
        message: "Artifact release catalog could not be read",
        artifactName: this.manifestPath,
        actionHint: "Check that artifacts.json exists and contains valid JSON.",
        cause,
      });
    }
  }
}

export class InMemoryReleaseCatalog implements ReleaseCatalog {
  private readonly releases = new Map<string, ArtifactRelease[]>();

  constructor(initialReleases: Record<string, ArtifactRelease[]> = {}) {
    for (const [artifactName, releases] of Object.entries(initialReleases)) {
      this.setReleases(artifactName, releases);
    }
  }

  setReleases(artifactName: string, releases: ArtifactRelease[]): void {
    this.releases.set(
      artifactName,
      releases.map((release) => ({ ...release })),
    );
  }

  async listReleases(artifactName: string): Promise<ArtifactRelease[]> {
    return (this.releases.get(artifactName) ?? []).map((release) => ({ ...release }));
  }
}

function asArtifactArray(artifacts: unknown, manifestPath: string): ArtifactRecord[] {
  if (!Array.isArray(artifacts)) {
    throw new ArtifactFreshnessError({
      message: "Artifact release catalog must declare an artifacts array",
      artifactName: manifestPath,
      actionHint: "Add an artifacts array to artifacts.json.",
    });
  }

  return artifacts.map((artifact, index) => asArtifactRecord(artifact, manifestPath, index));
}

function asArtifactRecord(artifact: unknown, manifestPath: string, index: number): ArtifactRecord {
  if (artifact === null || typeof artifact !== "object" || Array.isArray(artifact)) {
    throw new ArtifactFreshnessError({
      message: "Artifact release catalog entries must be JSON objects",
      artifactName: manifestPath,
      actionHint: `Fix artifacts.json entry at index ${index}.`,
    });
  }

  return artifact as ArtifactRecord;
}

function matchesArtifactName(artifact: ArtifactRecord, artifactName: string): boolean {
  return artifact.name === artifactName || artifact.source === artifactName;
}

function releasesForArtifact(artifact: ArtifactRecord, manifestPath: string): ArtifactRelease[] {
  if (Array.isArray(artifact.releases)) {
    return artifact.releases.map((release, index) =>
      parseRelease(asArtifactRecord(release, manifestPath, index), artifact, manifestPath),
    );
  }

  if (artifact.version !== undefined) {
    return [parseRelease(artifact, artifact, manifestPath)];
  }

  return [];
}

function parseRelease(
  release: ArtifactRecord,
  artifact: ArtifactRecord,
  manifestPath: string,
): ArtifactRelease {
  const version = requiredString(release.version, "version", artifact, manifestPath);
  const publishedAt = requiredPublishedAt(release.publishedAt, artifact, manifestPath);
  const url = requiredString(release.url, "url", artifact, manifestPath);
  const sha256 = requiredString(release.sha256, "sha256", artifact, manifestPath);
  const size = requiredNumber(release.size, "size", artifact, manifestPath);
  const provenance = requiredString(
    release.provenance ?? artifact.provenance,
    "provenance",
    artifact,
    manifestPath,
  );
  const source = optionalString(release.source ?? artifact.source);
  const kind = optionalString(release.kind ?? artifact.kind);
  const path = optionalString(release.path ?? artifact.path);
  const platform = optionalString(release.platform ?? artifact.platform);
  const compatibleWith = optionalString(release.compatibleWith ?? artifact.compatibleWith);
  const browserPath = optionalString(release.browserPath ?? artifact.browserPath);
  const driverPath = optionalString(release.driverPath ?? artifact.driverPath);

  return {
    version,
    publishedAt,
    url,
    sha256,
    size,
    provenance,
    ...(source === undefined ? {} : { source }),
    ...(kind === undefined ? {} : { kind }),
    ...(path === undefined ? {} : { path }),
    ...(platform === undefined ? {} : { platform }),
    ...(compatibleWith === undefined ? {} : { compatibleWith }),
    ...(browserPath === undefined ? {} : { browserPath }),
    ...(driverPath === undefined ? {} : { driverPath }),
  };
}

function requiredString(
  value: unknown,
  fieldName: string,
  artifact: ArtifactRecord,
  manifestPath: string,
): string {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }

  throw malformedRelease(fieldName, artifact, manifestPath);
}

function requiredPublishedAt(
  value: unknown,
  artifact: ArtifactRecord,
  manifestPath: string,
): string {
  const publishedAt = requiredString(value, "publishedAt", artifact, manifestPath);
  if (Number.isFinite(new Date(publishedAt).getTime())) {
    return publishedAt;
  }

  throw malformedRelease("publishedAt", artifact, manifestPath);
}

function requiredNumber(
  value: unknown,
  fieldName: string,
  artifact: ArtifactRecord,
  manifestPath: string,
): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  throw malformedRelease(fieldName, artifact, manifestPath);
}

function optionalString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }

  return undefined;
}

function malformedRelease(
  fieldName: string,
  artifact: ArtifactRecord,
  manifestPath: string,
): ArtifactFreshnessError {
  return new ArtifactFreshnessError({
    message: `Artifact release catalog entry is missing a valid ${fieldName}`,
    artifactName: artifactNameForError(artifact, manifestPath),
    actionHint: `Declare ${fieldName} for every release in artifacts.json.`,
  });
}

function artifactNameForError(artifact: ArtifactRecord, manifestPath: string): string {
  if (typeof artifact.name === "string" && artifact.name !== "") {
    return artifact.name;
  }

  if (typeof artifact.source === "string" && artifact.source !== "") {
    return artifact.source;
  }

  return manifestPath;
}
