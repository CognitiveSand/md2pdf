import { type ArtifactPolicy, type ReleaseCatalog } from "./artifactPolicy.js";
import { NotImplementedError } from "./errors.js";

export interface FallbackBrowserResult {
  browserPath: string;
  driverPath: string;
}

export async function provisionFallbackBrowser(
  policy: ArtifactPolicy,
  catalog: ReleaseCatalog,
): Promise<FallbackBrowserResult> {
  void policy;
  void catalog;

  throw new NotImplementedError({
    message: "Fallback browser provisioning is not implemented yet",
    artifactName: "chromium-for-testing",
    actionHint: "Implement fallback provisioning through ReleaseCatalog and ArtifactPolicy",
  });
}
