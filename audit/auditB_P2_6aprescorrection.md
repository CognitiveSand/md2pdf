# Audit Stream B P2 Etape 6 Apres Correction - fallbackBrowserProvisioner

Date: 2026-06-08  
Branche auditee: `share/streamB-restart-next`  
Scope: Stream B P2 etape 6 apres corrections de `audit/auditB_P2_6.md`. Audit centre sur `src/fallbackBrowserProvisioner.ts`, `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts`, `ArtifactPolicy`, `ReleaseCatalog`, `artifacts.json`, `docs/plan_stream_b.md` et `docs/architecture.md`.

## Resume De L'Audit

Verdict global: `AUDIT_FAIL` limite. Les corrections precedentes ont ferme les defauts cache/extraction/tests, mais il reste un ecart confirme sur la selection plateforme du fallback Chromium-for-Testing.

| Division | Statut | Synthese |
| --- | --- | --- |
| Metier | Avertissement | Le moteur respecte les criteres fake catalog, mais ne peut pas encore garantir l'artifact de la plateforme hote annonce par la doc. |
| Qualite | OK | Les tests couvrent maintenant zip reel, traversal, cache altere, non executable et cache non writable. |
| Architecture | Avertissement | Le contrat architecture parle de fallback compatible plateforme; la couche de selection ne porte pas cette contrainte. |
| Cybersecurite Offensive | Avertissement | Integrite/cache durcis; risque supply-chain restant sur selection cross-platform. |

Totaux normalises: Critical 0 · High 0 · Medium 1 · Low 0

## Index Des Sous-Audits

| Sous-audit | Scope | Crit | High | Medium | Low | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Business Logic Auditor | Flux P2 etape 6 | 0 | 0 | 1 | 0 | AUDIT_FAIL |
| Requirements Compliance Auditor | Plan + architecture | 0 | 0 | 1 | 0 | AUDIT_FAIL |
| Doc-Sync Auditor | Docs vs code | 0 | 0 | 1 | 0 | AUDIT_FAIL |
| A11y/UX Checker | Non-UI | 0 | 0 | 0 | 0 | N/A |
| Clean Code Auditor | Provisioner | 0 | 0 | 0 | 0 | AUDIT_PASS |
| Fail-Loud Auditor | Erreurs cache/artifact | 0 | 0 | 0 | 0 | AUDIT_PASS |
| Test Quality Auditor | Tests artifacts | 0 | 0 | 0 | 0 | AUDIT_PASS |
| Mutation/Saboteur Auditor | Cache/extracteur/checksum | 0 | 0 | 0 | 0 | AUDIT_PASS |
| Layer Enforcer | BrowserLocator/provisioner | 0 | 0 | 0 | 0 | AUDIT_PASS |
| YAGNI Auditor | API options | 0 | 0 | 0 | 0 | AUDIT_PASS |
| SRE/Performance Auditor | tmp/cache/timeouts | 0 | 0 | 0 | 0 | AUDIT_PASS |
| Architecture Consistency Auditor | Fallback plateforme | 0 | 0 | 1 | 0 | AUDIT_FAIL |
| Contextual Threat Analyst | Runtime artifact abuse | 0 | 0 | 1 | 0 | AUDIT_FAIL |
| SAST Scanner | Paths, archive, network | 0 | 0 | 0 | 0 | AUDIT_PASS |
| Supply Chain & Artifact Auditor | Freshness/integrity/platform | 0 | 0 | 1 | 0 | AUDIT_FAIL |
| Privacy/Exfiltration Auditor | Markdown/privacy boundary | 0 | 0 | 0 | 0 | AUDIT_PASS |

## Matrice Courte Des Exigences

| Contrat/Req | Source | Implementation | Tests | Statut |
| --- | --- | --- | --- | --- |
| Selection `newest eligible` via policy | `docs/plan_stream_b.md:82-89` | `src/fallbackBrowserProvisioner.ts:63`, `src/fallbackBrowserProvisioner.ts:86-89` | `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:29-54` | Conforme |
| Cache versionne par artifact + version exacte | `docs/plan_stream_b.md:85` | `src/fallbackBrowserProvisioner.ts:64-65` | `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:94-110` | Conforme |
| `.tmp`, checksum, extraction, rename atomique | `docs/plan_stream_b.md:86-87` | `src/fallbackBrowserProvisioner.ts:116-129`, `src/fallbackBrowserProvisioner.ts:234-244` | `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:56-91` | Conforme |
| Cache verifie avant chaque usage | `docs/plan_stream_b.md:89` | `src/fallbackBrowserProvisioner.ts:211-230`, `src/fallbackBrowserProvisioner.ts:309-334` | `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:179-226` | Conforme |
| Cache partial/stale nettoye | `docs/plan_stream_b.md:90` | `src/fallbackBrowserProvisioner.ts:67-75`, `src/fallbackBrowserProvisioner.ts:168-209` | `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:94-110`, `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:228-251` | Conforme |
| Cache non writable explicite | `docs/plan_stream_b.md:88` | `src/fallbackBrowserProvisioner.ts:136-137`, `src/fallbackBrowserProvisioner.ts:158-165`, `src/fallbackBrowserProvisioner.ts:465-471` | `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:254-291` | Conforme |
| Extracteur zip reel et traversal | Audit precedent F-B-P2-6-002 | `src/fallbackBrowserProvisioner.ts:405-417`, `src/fallbackBrowserProvisioner.ts:441-453` | `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:113-177` | Conforme |
| Artifact Chromium-for-Testing plateforme | `docs/plan_stream_b.md:91-96`, `docs/architecture.md:286-296` | `src/fallbackBrowserProvisioner.ts:86-89`, `src/releaseCatalog.ts:30-34`, `src/artifactPolicy.ts:19-22` | Aucun test plateforme | Non conforme |

## Top Findings

### F-B-P2-6-POST-001 Medium - La selection fallback ne filtre pas l'artifact par plateforme hote
- Preuve: `docs/architecture.md:286-296`, `docs/plan_stream_b.md:91-96`, `src/fallbackBrowserProvisioner.ts:86-89`, `src/releaseCatalog.ts:30-34`, `src/artifactPolicy.ts:19-22`, `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:113-177`
- Type: Confirme
- Impact: la documentation exige qu'un futur fallback Chromium-for-Testing soit platform-specific. Pourtant, le provisioner appelle `selectNewestEligible()` sans contrainte de plateforme, le catalogue retourne toutes les releases qui matchent seulement le nom/source, et `ArtifactConstraints` ne porte pas de champ `platform`. Si `artifacts.json` declare demain `linux-x64`, `darwin-arm64` et `win32-x64` sous `chromium-for-testing`, le code selectionnera simplement la release eligible la plus recente, pas forcement celle de l'hote.
- Pourquoi c'est un probleme: cote metier, un utilisateur macOS pourrait recevoir un zip Linux; cote supply-chain, le cache validerait parfaitement le mauvais binaire par SHA-256, parce que l'erreur est dans la selection, pas dans l'integrite. Anton Ego n'appellerait pas cela un repas rate, mais une carte qui promet le bon plat a la mauvaise table.
- Correction attendue: ajouter une contrainte plateforme explicite au chemin fallback (`platform` derivee de `process.platform`/`process.arch`, option injectable en test), filtrer les releases sur `release.platform` avant ou pendant `ArtifactPolicy.selectNewestEligible`, et ajouter un test ou la release la plus recente eligible est d'une autre plateforme mais doit etre ignoree.

## Details Par Division

### Division Metier (Anton Ego)
- Medium: F-B-P2-6-POST-001. Le contrat "newest eligible platform-specific fallback" n'est pas entierement honore.
- Points conformes: le moteur fake catalog respecte les criteres de l'etape 6: selection policy, cache, checksum, temp, rename, nettoyage et erreurs explicites.

### Division Qualite (Gordon Ramsay)
- Aucun finding confirme.
- Points conformes: les tests couvrent maintenant le vrai `defaultExtractor` (`tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:113-145`), le traversal zip (`tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:147-177`) et les erreurs cache subtree (`tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:271-291`). Cette fois, on a enfin goute le plat qui sort de la cuisine, pas seulement le mock en plastique.

### Division Architecture (Steve Jobs)
- Medium: F-B-P2-6-POST-001. La surface publique est propre, mais il manque une dimension de selection: plateforme.
- Points conformes: `FallbackBrowserProvisioner` reste isole de `BrowserLocator`; `BrowserLocator` ne connait qu'une interface `FallbackBrowserResolver` (`src/browserLocator.ts:16-23`, `src/browserLocator.ts:40-42`).

### Division Cybersecurite Offensive (Sherlock Holmes)
- Medium: F-B-P2-6-POST-001. Elementaire, et pourtant: verifier parfaitement le mauvais artifact reste mauvais.
- Points conformes: path traversal bloque par `resolveInside()` (`src/fallbackBrowserProvisioner.ts:441-453`), fichiers extraits non executables par defaut (`src/fallbackBrowserProvisioner.ts:413-415`), chmod limite aux chemins declares (`src/fallbackBrowserProvisioner.ts:261-276`), metadata cache comparee avant reutilisation (`src/fallbackBrowserProvisioner.ts:309-334`).

## Details Par Sous-Audit

### Business Logic Auditor
- Verdict: AUDIT_FAIL
- Findings: F-B-P2-6-POST-001.
- Points conformes: les criteres de cache et de checksum sont respectes.

### Requirements Compliance Auditor
- Verdict: AUDIT_FAIL
- Findings: F-B-P2-6-POST-001.
- Points conformes: les tests fake catalog obligatoires de `docs/plan_stream_b.md:104-110` sont presents.

### Doc-Sync Auditor
- Verdict: AUDIT_FAIL
- Findings: F-B-P2-6-POST-001.
- Points conformes: la doc ne pretend plus qu'un artifact reel existe deja; elle cadre correctement l'absence actuelle dans `artifacts.json`.

### A11y/UX Checker
- Verdict: N/A
- Findings: aucun.
- Points conformes: aucun frontend/UI touche.

### Clean Code Auditor
- Verdict: AUDIT_PASS
- Findings: aucun confirme.
- Points conformes: `quarantineDays` n'est plus une option publique du provisioner (`src/fallbackBrowserProvisioner.ts:31-37`).

### Fail-Loud Auditor
- Verdict: AUDIT_PASS
- Findings: aucun confirme.
- Points conformes: causes stables `integrity-mismatch`, `invalid-artifact-path`, `cache-not-writable`, `missing-executable`.

### Test Quality Auditor
- Verdict: AUDIT_PASS
- Findings: aucun confirme.
- Points conformes: 13 tests artifacts passent; les nouveaux tests tuent les mutations sur extraction zip, traversal, chmod trop large, cache altere et permission error.

### Mutation/Saboteur Auditor
- Verdict: AUDIT_PASS
- Findings: aucun confirme.
- Points conformes: supprimer `assertCacheMetadata`, `resolveInside`, `chmod` cible ou `cacheNotWritableError` ferait echouer les tests existants.

### Layer Enforcer
- Verdict: AUDIT_PASS
- Findings: aucun.
- Points conformes: dependance directionnelle correcte: le locator recoit un resolver abstrait, le provisioner n'importe pas le locator.

### YAGNI Auditor
- Verdict: AUDIT_PASS
- Findings: aucun confirme.
- Points conformes: les injections `downloader`/`extractor` servent aux tests sans exposer de contournement freshness.

### SRE/Performance Auditor
- Verdict: AUDIT_PASS
- Findings: aucun confirme.
- Points conformes: timeout download 30s (`src/fallbackBrowserProvisioner.ts:397-400`), cache stale purge, cleanup tmp, rename atomique.

### Architecture Consistency Auditor
- Verdict: AUDIT_FAIL
- Findings: F-B-P2-6-POST-001.
- Points conformes: le scope "artifact reel hors etape 6" est maintenant explicite.

### Contextual Threat Analyst
- Verdict: AUDIT_FAIL
- Findings: F-B-P2-6-POST-001.
- Points conformes: un cache local modifie ne sera pas reutilise silencieusement.

### SAST Scanner
- Verdict: AUDIT_PASS
- Findings: aucun confirme.
- Points conformes: pas de shell execution, pas de path concat naive, URL de download issue du release catalog et controlee par `ArtifactPolicy`.

### Supply Chain & Artifact Auditor
- Verdict: AUDIT_FAIL
- Findings: F-B-P2-6-POST-001.
- Points conformes: freshness 7 jours non parametrable dans le provisioner (`src/fallbackBrowserProvisioner.ts:42`, `src/fallbackBrowserProvisioner.ts:86-89`) et enforcement policy passe.

### Privacy/Exfiltration Auditor
- Verdict: AUDIT_PASS
- Findings: aucun.
- Points conformes: le provisioner ne lit pas le Markdown utilisateur et ne telemetrise rien.

## Points Conformes

- Findings precedents corriges: pas d'option `quarantineDays` publique, default extractor teste avec zip reel, traversal zip teste, permissions d'extraction durcies, cache subtree non writable classe explicitement.
- `npm run typecheck` passe.
- `npm run test:artifacts` passe: 2 fichiers, 13 tests.
- `npm test` passe: 12 fichiers, 111 tests.
- `npm run check:artifacts` passe.
- `git diff --check` passe.

## Limites De Verification Et Commandes Executees

Commandes executees:
- `npm run typecheck` -> PASS.
- `npm run test:artifacts` -> PASS, 13 tests.
- `npm run check:artifacts` -> PASS, "Artifact freshness policy passed."
- `git diff --check` -> PASS.
- `npm test` -> PASS, 111 tests.

Limites:
- Aucun reseau externe utilise; je n'ai pas verifie le newest eligible Chromium-for-Testing reel au 2026-06-08.
- Aucun test browser reel lance; hors gate P2 etape 6.
- Je n'ai pas modifie le code audite; seul ce rapport d'audit a ete ajoute.
