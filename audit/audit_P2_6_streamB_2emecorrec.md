**Audit Relancé - Stream B P2.6**
Verdict global: `AUDIT_FAIL` ciblé. Le moteur P2.6 est meilleur que l’audit précédent: le défaut de sélection plateforme est corrigé. Mais l’état actuel reste non acceptable pour clôturer proprement P2.6/NFR-05, à cause de trous confirmés dans le gate artifact, le cache fallback, et quelques promesses WebDriver/driver encore trop faibles.

Totaux normalisés: Critical 0 · High 3 · Medium 5 · Low 1

**Index Sous-Audits**
| Sous-audit | Verdict | Sévérité max |
| --- | --- | --- |
| Business Logic / Requirements | `FAIL` | Medium |
| Requirements Compliance | `FAIL` | High |
| Doc-Sync | `FAIL` | High |
| Clean Code / Fail-Loud | `WARN` | Medium |
| Test Quality / Mutation | `FAIL` | High |
| Architecture / SRE | `FAIL` | High |
| Security / Supply Chain | `FAIL` | High |

**Matrice Courte**
| Contrat | Statut |
| --- | --- |
| Fallback sélectionne `newest eligible` via policy | Conforme: [fallbackBrowserProvisioner.ts](/Users/samirtamboura/Desktop/md2pdf/src/fallbackBrowserProvisioner.ts:65) |
| Plateforme hôte filtrée | Conforme: [fallbackBrowserProvisioner.ts](/Users/samirtamboura/Desktop/md2pdf/src/fallbackBrowserProvisioner.ts:61), [artifactPolicy.ts](/Users/samirtamboura/Desktop/md2pdf/src/artifactPolicy.ts:67) |
| Cache versionné + checksum avant usage | Conforme: [fallbackBrowserProvisioner.ts](/Users/samirtamboura/Desktop/md2pdf/src/fallbackBrowserProvisioner.ts:226) |
| Cache partiel/stale nettoyé | Partiel: F4 |
| Gate artifact local | Non conforme: F1 |
| Driver compatible/provisionné | Non conforme: F2 |
| WebDriver timeout + cleanup | Partiel: F5 |

**Top Findings**
### F1 High - `releaseCatalog.ts` échappe au gate artifact staged
- Preuve: `ReleaseCatalog` est composant NFR-05 dans l’architecture [architecture.md](/Users/samirtamboura/Desktop/md2pdf/docs/architecture.md:167). Pourtant `trackedLocations` ne liste pas `src/releaseCatalog.ts` [artifacts.json](/Users/samirtamboura/Desktop/md2pdf/artifacts.json:20).
- Preuve: le filtre pre-commit dépend de ces chemins [checkArtifactFreshness.mjs](/Users/samirtamboura/Desktop/md2pdf/scripts/checkArtifactFreshness.mjs:65).
- Vérification: `artifactFreshnessRelevantChangedPaths(["src/releaseCatalog.ts"], manifest)` retourne `[]`.
- Impact: une modification du catalogue runtime peut passer sans contrôle artifact local.
- Correction attendue: ajouter `src/releaseCatalog.ts` à `trackedLocations` et tester ce cas.

### F2 High - Compatibilité browser/chromedriver non appliquée
- Preuve: `BrowserCandidate` ne porte pas de version [browserLocator.ts](/Users/samirtamboura/Desktop/md2pdf/src/browserLocator.ts:44), le probe jette la version après validation [browserLocator.ts](/Users/samirtamboura/Desktop/md2pdf/src/browserLocator.ts:324), et `selectNewestEligible` est appelé sans `compatibleWith` [browserLocator.ts](/Users/samirtamboura/Desktop/md2pdf/src/browserLocator.ts:263).
- Contrat: l’architecture exige le lockstep major `chromedriver`/Chrome [architecture.md](/Users/samirtamboura/Desktop/md2pdf/docs/architecture.md:396).
- Impact: sélection possible d’un driver éligible mais incompatible.
- Correction attendue: parser la version navigateur, la porter dans `BrowserCandidate`, passer `compatibleWith`, tester Chrome 119 vs chromedriver 120/119.

### F3 High - Le check non-npm ne prouve pas “newest eligible available”
- Preuve: la policy exige le plus récent éligible disponible [ARTIFACT_FRESHNESS_POLICY.md](/Users/samirtamboura/Desktop/md2pdf/ARTIFACT_FRESHNESS_POLICY.md:41). Le check valide surtout le manifeste déclaré [checkArtifactFreshness.mjs](/Users/samirtamboura/Desktop/md2pdf/scripts/checkArtifactFreshness.mjs:347), tandis que `ReleaseCatalog` ne liste que les releases présentes dans `artifacts.json` [releaseCatalog.ts](/Users/samirtamboura/Desktop/md2pdf/src/releaseCatalog.ts:27).
- Impact: un futur driver/fallback pourrait être “newest” seulement parce que le manifeste omet une release upstream plus récente.
- Correction attendue: source autoritative ou evidence upstream versionnée pour les artifacts non-npm réels.

### F4 Medium - Cache partiel racine non nettoyé
- Preuve: P2.6 exige le nettoyage du cache partiel/stale [plan_stream_b.md](/Users/samirtamboura/Desktop/md2pdf/docs/plan_stream_b.md:89). Si `cacheRoot/chromium-for-testing` existe mais n’est pas un dossier, `purgeStaleCaches` retourne sans nettoyer [fallbackBrowserProvisioner.ts](/Users/samirtamboura/Desktop/md2pdf/src/fallbackBrowserProvisioner.ts:177).
- Impact: un fichier à la place de la racine artifact bloque le reprovisioning.
- Correction attendue: traiter cette racine comme cache corrompu, supprimer/recréer ou lever une cause stable; ajouter le test.

### F5 Medium - Timeout WebDriver incomplet et cleanup avalé
- Preuve: `renderTimeoutMs` ne borne que Mermaid [webDriverClient.ts](/Users/samirtamboura/Desktop/md2pdf/src/webDriverClient.ts:142), pas `/session`, navigation, print, delete session ni `driverProcess.stop()` [webDriverClient.ts](/Users/samirtamboura/Desktop/md2pdf/src/webDriverClient.ts:57).
- Preuve: cleanup errors avalées [webDriverClient.ts](/Users/samirtamboura/Desktop/md2pdf/src/webDriverClient.ts:207).
- Impact: blocage possible ou succès retourné malgré process/session mal fermés.
- Correction attendue: timeout/AbortSignal par requête, cleanup borné, erreur stable si cleanup échoue sans erreur primaire.

### F6 Medium - Extraction fallback trop gourmande
- Preuve: checksum lit toute l’archive [fallbackBrowserProvisioner.ts](/Users/samirtamboura/Desktop/md2pdf/src/fallbackBrowserProvisioner.ts:237), puis extraction `unzipSync(await readFile(...))` [fallbackBrowserProvisioner.ts](/Users/samirtamboura/Desktop/md2pdf/src/fallbackBrowserProvisioner.ts:410).
- Impact: archive Chromium réelle ou hostile peut provoquer pic mémoire/DoS local.
- Correction attendue: hash streaming, limite `release.size`, extraction bornée.

### F7 Medium - `file://host/...` accepté comme local
- Preuve: `assertFileUrl` accepte tout protocole `file:` sans vérifier `host` [webDriverClient.ts](/Users/samirtamboura/Desktop/md2pdf/src/webDriverClient.ts:190).
- Impact: sur Windows/UNC, un `file://server/share/...` peut déclencher accès réseau, contraire à NFR-02.
- Correction attendue: refuser les `file:` avec host non vide/non-local et tester ce cas.

**Points Conformes**
- La sélection plateforme fallback est maintenant couverte par code et test [fallbackBrowserProvisioner.test.ts](/Users/samirtamboura/Desktop/md2pdf/tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:148).
- Zip traversal rejeté via `resolveInside` [fallbackBrowserProvisioner.ts](/Users/samirtamboura/Desktop/md2pdf/src/fallbackBrowserProvisioner.ts:444).
- La quarantaine runtime est forcée à 7 jours [artifactPolicy.ts](/Users/samirtamboura/Desktop/md2pdf/src/artifactPolicy.ts:106).
- Les tests P2.6 obligatoires existent: checksum, download interrompu, cache partiel, stale cache, cache non writable.

**Commandes Exécutées**
- `npm run typecheck`: PASS
- `npm test`: PASS, 113 tests
- `npm run check:artifacts`: PASS
- `npm run test:artifacts`: PASS, 14 tests
- `npm run test:browser`: FAIL, aucun fichier `tests/integration/**/*.test.ts`

**Limites**
Audit lecture seule, aucun fichier modifié. Le workspace était déjà dirty. Pas de vérification upstream internet des versions réelles; les constats supply-chain portent sur le mécanisme local actuel.