# Audit Stream B P2 Etape 6 - fallbackBrowserProvisioner

Date: 2026-06-08  
Branche auditee: `share/streamB-restart-next`  
Scope: etat courant Stream B P2 etape 6, centre sur `src/fallbackBrowserProvisioner.ts`, avec dependances directes `ArtifactPolicy`, `ReleaseCatalog`, `artifacts.json`, `BrowserLocator` et tests artifacts.

## Resume De L'Audit

Verdict global: `AUDIT_FAIL` pour acceptation production complete de l'etape 6.  
Statut nuance: la gate P2/fake catalog est verte, mais il reste des ecarts confirmes sur disponibilite production, couverture du chemin reel d'extraction, diagnostic cache non writable et durcissement des permissions.

| Division | Statut | Synthese |
| --- | --- | --- |
| Metier | Avertissement | Le flux fake catalog couvre les criteres de base, mais le fallback Chromium-for-Testing n'est pas disponible via le catalogue reel. |
| Qualite | Avertissement | Tests verts, mais le `defaultExtractor` critique n'est pas exerce par les tests de succes. |
| Architecture | Avertissement | Le module reste isole de `browserLocator`, mais l'API expose encore une option de quarantaine inutile. |
| Cybersecurite Offensive | Avertissement | SHA-256, cache metadata et path containment sont presents; permissions d'extraction trop larges et diagnostics EACCES perfectibles. |

Totaux normalises: Critical 0 · High 0 · Medium 3 · Low 2

## Index Des Sous-Audits

| Sous-audit | Scope | Crit | High | Medium | Low | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Business Logic Auditor | Step 6 flow | 0 | 0 | 1 | 0 | AUDIT_FAIL |
| Requirements Compliance Auditor | Plan Stream B + policy | 0 | 0 | 1 | 0 | AUDIT_FAIL |
| Doc-Sync Auditor | Architecture/docs vs code | 0 | 0 | 0 | 1 | AUDIT_PASS_WITH_NOTES |
| A11y/UX Checker | Non-UI | 0 | 0 | 0 | 0 | N/A |
| Clean Code Auditor | Provisioner internals | 0 | 0 | 0 | 1 | AUDIT_PASS_WITH_NOTES |
| Fail-Loud Auditor | Error causes | 0 | 0 | 1 | 0 | AUDIT_FAIL |
| Test Quality Auditor | `test:artifacts` | 0 | 0 | 1 | 0 | AUDIT_FAIL |
| Mutation/Saboteur Auditor | Cache/extractor mutations | 0 | 0 | 1 | 0 | AUDIT_FAIL |
| Layer Enforcer | BrowserLocator/provisioner split | 0 | 0 | 0 | 0 | AUDIT_PASS |
| YAGNI Auditor | Public options | 0 | 0 | 0 | 1 | AUDIT_PASS_WITH_NOTES |
| SRE/Performance Auditor | Cache/tmp/cleanup | 0 | 0 | 0 | 0 | AUDIT_PASS |
| Architecture Consistency Auditor | Architecture + P2 stage | 0 | 0 | 1 | 0 | AUDIT_FAIL |
| Contextual Threat Analyst | Runtime artifact abuse | 0 | 0 | 0 | 1 | AUDIT_PASS_WITH_NOTES |
| SAST Scanner | Path traversal/network/archive | 0 | 0 | 0 | 1 | AUDIT_PASS_WITH_NOTES |
| Supply Chain & Artifact Auditor | SHA/freshness/catalog | 0 | 0 | 1 | 0 | AUDIT_FAIL |
| Privacy/Exfiltration Auditor | Markdown/privacy boundary | 0 | 0 | 0 | 0 | AUDIT_PASS |

## Matrice Courte Des Exigences

| Contrat/Req | Source | Implementation | Tests | Statut |
| --- | --- | --- | --- | --- |
| Selection `newest eligible` via `ArtifactPolicy` | `docs/plan_stream_b.md:82-84` | `src/fallbackBrowserProvisioner.ts:64`, `src/fallbackBrowserProvisioner.ts:88-91` | `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:33-44` | Conforme en fake catalog |
| Cache versionne artifact + version exacte | `docs/plan_stream_b.md:84` | `src/fallbackBrowserProvisioner.ts:65-66` | `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:93-109` | Conforme |
| Download vers `.tmp`, SHA-256, rename atomique | `docs/plan_stream_b.md:85-86` | `src/fallbackBrowserProvisioner.ts:118-128`, `src/fallbackBrowserProvisioner.ts:203-213` | `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:55-90` | Conforme |
| Cache verifie avant chaque utilisation | `docs/plan_stream_b.md:89` | `src/fallbackBrowserProvisioner.ts:180-199`, `src/fallbackBrowserProvisioner.ts:236-282` | `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:112-159` | Conforme |
| Cache partial/stale nettoye | `docs/plan_stream_b.md:90` | `src/fallbackBrowserProvisioner.ts:68-77`, `src/fallbackBrowserProvisioner.ts:161-177` | `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:93-109`, `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:161-184` | Conforme |
| Cache non writable avec cause explicite | `docs/plan_stream_b.md:87` | `src/fallbackBrowserProvisioner.ts:146-157`, mais generic wrap `src/fallbackBrowserProvisioner.ts:137-142` | `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:187-201` | Partiel |
| Gate P2 fallback | `docs/plan_stream_b.md:92-105` | `package.json:40` | `npm run test:artifacts` | Conforme |

## Top Findings

### F-B-P2-6-001 Medium - Le fallback production n'a aucun artifact Chromium-for-Testing declare
- Preuve: `src/fallbackBrowserProvisioner.ts:40`, `src/fallbackBrowserProvisioner.ts:58-64`, `artifacts.json:5-18`, `artifacts.json:46-55`, `src/releaseCatalog.ts:27-34`
- Type: Confirme
- Impact: avec le catalogue reel, `provisionFallbackBrowser()` cherche `chromium-for-testing`, mais `artifacts.json` ne contient qu'un stylesheet `highlight.js`; la classe Chromium-for-Testing est seulement dans `plannedArtifactClasses`. Le module peut donc passer les tests fake catalog tout en restant incapable de provisionner le fallback reel.
- Pourquoi c'est un probleme: l'etape 6 s'appelle "Chromium-for-Testing" et le runtime provisioning doit appliquer la politique aux artifacts reels. Anton Ego dirait que le plat est bien dresse, mais que l'assiette principale n'est pas servie.
- Correction attendue: soit declarer un artifact Chromium-for-Testing eligible, plateforme, version exacte, URL immuable, SHA-256, taille et provenance; soit documenter explicitement que P2 etape 6 valide seulement le moteur fake catalog et que l'ajout du catalogue reel est hors etape.

### F-B-P2-6-002 Medium - Le `defaultExtractor` critique n'est pas teste sur une vraie archive zip
- Preuve: `src/fallbackBrowserProvisioner.ts:352-364`, `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:30-31`, `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:61-62`, `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:85`, `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:254-263`
- Type: Confirme
- Impact: tous les tests de provisionnement qui atteignent l'extraction injectent `FixtureExtractor`, lequel ignore l'archive et ecrit directement `browser`/`driver`. Une regression dans `unzipSync`, `resolveInside` applique aux entrees zip, ou `chmod` du chemin reel ne serait pas detectee.
- Pourquoi c'est un probleme: Gordon Ramsay refuserait ce test: il goute la sauce du mock et annonce que la cuisine marche. Le chemin de production d'extraction est une surface supply-chain critique.
- Correction attendue: ajouter au moins un test avec le `defaultExtractor` et une archive zip minimale produite en test, plus un cas d'entree zip traversante (`../...`) attendu en `ArtifactFreshnessError`.

### F-B-P2-6-003 Medium - Les erreurs cache non writable ne sont explicites que pour la racine du cache
- Preuve: `src/fallbackBrowserProvisioner.ts:146-157`, `src/fallbackBrowserProvisioner.ts:121-142`, `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:187-201`
- Type: Confirme
- Impact: `ensureCacheRoot()` transforme bien l'impossibilite de creer/ecrire la racine en cause `cache-not-writable`. Mais si la racine est writable et que `chromium-for-testing/` ou le repertoire de version ne l'est pas, l'echec arrive dans `provisionIntoCache()` et est enveloppe dans "Fallback browser could not be provisioned" avec une cause OS brute, pas une cause stable `cache-not-writable`.
- Pourquoi c'est un probleme: le plan demande un cache non writable avec cause explicite. Le test ne couvre que le cas ou `cacheDir` est un fichier, pas un sous-arbre artifact non writable.
- Correction attendue: classifier les erreurs `EACCES`, `EPERM`, `EROFS` depuis `mkdir`, `rename`, `rm` et `writeFile` du chemin artifact/release en `ArtifactFreshnessError` cause `cache-not-writable`, et ajouter le test correspondant.

### F-B-P2-6-004 Low - L'option publique `quarantineDays` est une fausse commande
- Preuve: `src/fallbackBrowserProvisioner.ts:31-36`, `src/fallbackBrowserProvisioner.ts:60`, `src/fallbackBrowserProvisioner.ts:88-91`, `src/artifactPolicy.ts:101-110`
- Type: Confirme
- Impact: `FallbackBrowserProvisionerOptions` expose `quarantineDays`, mais la politique rejette toute valeur differente de 7. Ce n'est pas un bypass, plutot une option inutile qui invite les tests et futurs callers a croire que la quarantaine est parametrable.
- Correction attendue: retirer l'option du provisioner et passer une constante interne `7`, ou renommer/documenter comme hook de test impossible a utiliser pour contourner la policy.

### F-B-P2-6-005 Low - L'extracteur rend executables tous les fichiers de l'archive
- Preuve: `src/fallbackBrowserProvisioner.ts:360-363`
- Type: Confirme
- Impact: chaque entree extraite recoit `0o755`, y compris fichiers de donnees, configs ou assets. Ce n'est pas une execution directe, mais c'est un durcissement insuffisant pour un runtime artifact executable.
- Correction attendue: extraire les fichiers avec permissions restrictives, puis appliquer `0o755` uniquement aux chemins `browserPath` et `driverPath` declares et valides.

## Details Par Division

### Division Metier (Anton Ego)
- Findings: F-B-P2-6-001, F-B-P2-6-003.
- Points conformes: selection policy appelee avant download (`src/fallbackBrowserProvisioner.ts:64`), checksum avant extraction (`src/fallbackBrowserProvisioner.ts:123-125`), cache metadata pour verifier les binaires extraits (`src/fallbackBrowserProvisioner.ts:236-282`).

### Division Qualite (Gordon Ramsay)
- Findings: F-B-P2-6-002, F-B-P2-6-004.
- Points conformes: tests obligatoires presents pour checksum invalide, interruption, cache partiel, stale cache et cache root non writable (`tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:55-201`).

### Division Architecture (Steve Jobs)
- Findings: F-B-P2-6-001, F-B-P2-6-004.
- Points conformes: `fallbackBrowserProvisioner.ts` reste independant de `browserLocator.ts`; `BrowserLocator` depend d'une interface `FallbackBrowserResolver` sans importer le provisioner (`src/browserLocator.ts:16-23`, `src/browserLocator.ts:40-42`).

### Division Cybersecurite Offensive (Sherlock Holmes)
- Findings: F-B-P2-6-002, F-B-P2-6-005.
- Points conformes: Elementaire, et pourtant utile: le cache reutilise est reverifie par checksum archive, executabilite et hashes des binaires extraits (`src/fallbackBrowserProvisioner.ts:192-199`, `src/fallbackBrowserProvisioner.ts:267-280`). Les chemins declares sont confines au cache (`src/fallbackBrowserProvisioner.ts:389-402`).

## Details Par Sous-Audit

### Business Logic Auditor
- Verdict: AUDIT_FAIL
- Findings: F-B-P2-6-001, F-B-P2-6-003.
- Points conformes: le flux principal absent/cache corrompu -> tmp -> checksum -> extraction -> metadata -> rename est coherent.

### Requirements Compliance Auditor
- Verdict: AUDIT_FAIL
- Findings: F-B-P2-6-001, F-B-P2-6-003.
- Points conformes: tous les tests fake catalog obligatoires du plan sont representes et tags `@req NFR-05`.

### Doc-Sync Auditor
- Verdict: AUDIT_PASS_WITH_NOTES
- Findings: F-B-P2-6-001 est partiellement documente par `docs/architecture.md:286-294`, qui dit que l'absence d'artifact rend le fallback planifie mais non disponible.
- Points conformes: l'architecture annonce bien le fallback comme last resort declare et freshness-gated.

### A11y/UX Checker
- Verdict: N/A
- Findings: aucun; aucun frontend/UI touche.
- Points conformes: non applicable.

### Clean Code Auditor
- Verdict: AUDIT_PASS_WITH_NOTES
- Findings: F-B-P2-6-004.
- Points conformes: fonctions separees, erreurs typees, injection testable sans couplage au locator.

### Fail-Loud Auditor
- Verdict: AUDIT_FAIL
- Findings: F-B-P2-6-003.
- Points conformes: invalid checksum lance `integrity-mismatch`; invalid artifact policy n'est pas masque comme "no eligible" (`src/fallbackBrowserProvisioner.ts:93-108`).

### Test Quality Auditor
- Verdict: AUDIT_FAIL
- Findings: F-B-P2-6-002.
- Points conformes: bonne couverture de cache altere (`tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:112-135`) et non executable (`tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:137-159`).

### Mutation/Saboteur Auditor
- Verdict: AUDIT_FAIL
- Findings: F-B-P2-6-002.
- Points conformes: supprimer `assertCacheMetadata()` tuerait les tests de tampering; supprimer le `rm(tempDir)` tuerait les tests de nettoyage.

### Layer Enforcer
- Verdict: AUDIT_PASS
- Findings: aucun.
- Points conformes: module isole; `BrowserLocator` ne connait qu'un resolver abstrait.

### YAGNI Auditor
- Verdict: AUDIT_PASS_WITH_NOTES
- Findings: F-B-P2-6-004.
- Points conformes: les interfaces `ArtifactDownloader`/`ArtifactExtractor` servent directement aux tests de provisioning.

### SRE/Performance Auditor
- Verdict: AUDIT_PASS
- Findings: aucun significatif.
- Points conformes: timeout download 30s (`src/fallbackBrowserProvisioner.ts:344-347`), cache stale purge, tmp cleanup et rename atomique.

### Architecture Consistency Auditor
- Verdict: AUDIT_FAIL
- Findings: F-B-P2-6-001.
- Points conformes: la doc architecture reconnait l'absence actuelle d'artifact fallback, donc l'ecart est connu plutot que cache.

### Contextual Threat Analyst
- Verdict: AUDIT_PASS_WITH_NOTES
- Findings: F-B-P2-6-005.
- Points conformes: un cache modifie localement ne sera pas reutilise silencieusement grace au metadata hashing.

### SAST Scanner
- Verdict: AUDIT_PASS_WITH_NOTES
- Findings: F-B-P2-6-005.
- Points conformes: path traversal archive/release paths passe par `resolveInside()`, pas par concatenation naive.

### Supply Chain & Artifact Auditor
- Verdict: AUDIT_FAIL
- Findings: F-B-P2-6-001, F-B-P2-6-002, F-B-P2-6-005.
- Points conformes: SHA-256 et taille sont verifies avant extraction et avant reutilisation.

### Privacy/Exfiltration Auditor
- Verdict: AUDIT_PASS
- Findings: aucun.
- Points conformes: le provisioner lit seulement catalog/cache/artifact, pas le Markdown utilisateur; la frontiere privacy annoncee pour P3 n'est pas violee ici.

## Points Conformes

- La gate P2 specifique fallback existe: `package.json:40`.
- `npm run test:artifacts` passe avec 10 tests.
- `npm run typecheck`, `npm test`, `npm run check:artifacts` passent.
- Le cache altere ou non executable reprovisionne au lieu d'etre reutilise.
- Les erreurs `invalid-artifact-manifest` et `invalid-quarantine-days` restent preservees par `selectRelease()` au lieu d'etre converties en "no eligible".

## Limites De Verification Et Commandes Executees

Commandes executees:
- `npm run typecheck` -> PASS.
- `npm test` -> PASS, 12 fichiers de test, 108 tests.
- `npm run check:artifacts` -> PASS, "Artifact freshness policy passed."
- `npm run test:artifacts` -> PASS, 2 fichiers de test, 10 tests.
- Lectures statiques: `AGENTS.md`, `ARTIFACT_FRESHNESS_POLICY.md`, `docs/plan_stream_b.md`, `docs/architecture.md`, `src/fallbackBrowserProvisioner.ts`, `src/artifactPolicy.ts`, `src/releaseCatalog.ts`, `src/browserLocator.ts`, tests artifacts/contracts/releaseCatalog.

Limites:
- Aucun reseau externe utilise; je n'ai pas verifie quel Chromium-for-Testing serait le newest eligible au 2026-06-08.
- Aucun test browser reel lance; hors scope P2 etape 6 selon la gate actuelle.
- Je n'ai pas modifie le code audite.
