# Audit global d'avancement projet - 2026-06-11

Verdict global: **avance solide, mais release globale NO-GO**.

Le projet a depasse le simple cadrage: les contrats, la CLI, le pipeline batch, l'overwrite, le rendu Markdown local, l'integration PDF deterministe, la politique d'artefacts et une grande partie du socle browser/provisioning existent et sont testes. En revanche, l'objectif release MVP complet reste bloque par la preuve navigateur reel + Mermaid, la preuve CI multi-OS et une preuve system-scope FR-20 qui reste une simulation.

## Sources auditees

- Plans: `docs/implementation_plan_v0.1.2_P0.md`, `docs/plan_c0.md`, `docs/plan_stream_a.md`, `docs/stream-a-implementation-plan-2026-06-08.md`, `docs/stream-a-strict-finalization-plan.md`, `docs/plan_stream_b.md`.
- Architecture: `docs/architecture.md`.
- Requirements et stories: `docs/project_requirements.md`, `docs/user_stories.md`.
- Preuves release: `docs/release-evidence/README.md`, `docs/release-evidence/release-checklist-v0.1.2.md`, `docs/release-evidence/fr-20-system-scope.md`.
- Audits recents: `audit/2026-06-11-stream-a-strict-final-audit.md`, `audit/2026-06-11-stream-a-implementation-completeness-audit.md`, `audit/audit-streamB#7correction.md`, `audit/auditB_P2_6_3emecorrection.md`.
- Code et tests: `src/`, `tests/`, `package.json`, `artifacts.json`, `scripts/checkArtifactFreshness.mjs`.

## Gates rejoues le 2026-06-11

| Commande | Resultat observe | Commentaire |
| --- | --- | --- |
| `npm.cmd run typecheck` | **Pass** | `tsc --noEmit` termine avec exit `0`. |
| `npm.cmd test` | **Pass** | 13 fichiers de tests, 139 tests passes, 3 skips OS-dependants. |
| `npm.cmd run test:contracts` | **Pass** | 1 fichier, 15 tests passes. Les preuves historiques mentionnent 10 tests; elles sont donc legerement stale. |
| `npm.cmd run check:artifacts` | **Pass** | `Artifact freshness policy passed.` |
| `npm.cmd run test:browser` | **Pass** | 1 fichier d'integration, 13 tests passes. Lance hors sandbox apres erreur Windows `spawn setup refresh`. |
| `npm.cmd run test:real-browser` | **Fail** | Le smoke Mermaid avec vrai navigateur echoue: `Timed out waiting for browser-rendered HTML`, remonte depuis `src/pdfRenderer.ts:173` et `src/pdfRenderer.ts:314`. |

## Avancement par lot

| Lot | Statut | Evidence | Reste / risque |
| --- | --- | --- | --- |
| P0 cadrage et preuves | **Termine** | Checklist P0 `pass` dans `docs/release-evidence/release-checklist-v0.1.2.md:5`; architecture alignee via `docs/architecture.md:446`. | Aucun blocage P0 actuel. |
| C0 contrats | **Termine** | Contrats exportes dans `src/contracts.ts:8`, `src/contracts.ts:14`, `src/contracts.ts:16`; tests contrats verts. | Les compteurs de preuves doivent etre mis a jour: la suite contrats a 15 tests aujourd'hui, pas 10. |
| Stream A P1/P2 CLI, paths, overwrite, batch | **Termine / accepte** | CLI `main` et parser dans `src/cli.ts:50`, `src/cli.ts:71`; pipeline dans `src/pipeline.ts:38`; jobs dans `src/paths.ts:19`; overwrite dans `src/overwrite.ts:37`. Tests unitaires et `npm test` passent. | Les preuves permission restent en partie simulees, acceptables pour Stream A strict mais faibles pour release terrain. |
| Stream A P3 integration deterministe | **Partiel mais vert dans son perimetre strict** | `npm.cmd run test:browser` passe; tests `tests/integration/cli-pdf.test.ts:36`, `:119`, `:159`, `:185`, `:203`, `:220`, `:238`. | Le test utilise un faux navigateur, pas un navigateur installe reel. |
| Stream A P4 packaging / README / invocabilite | **Accepte pour Stream A strict** | `package.json:22` declare le binaire; README help/options dans `README.md:76`, `README.md:82`, `README.md:94`; checklist `docs/release-evidence/release-checklist-v0.1.2.md:107`. | FR-20 est marque `pass`, mais seulement via simulation documentee. |
| Stream B P1 Markdown local | **Avance / couvert unitairement** | `renderToHtml` dans `src/markdownRenderer.ts:56`; Mermaid inlined/runner dans `src/markdownRenderer.ts:298`, `src/markdownRenderer.ts:332`; tests `tests/unit/markdownRenderer/markdownRenderer.test.ts:12`, `:37`, `:49`, `:69`, `:129`. | Le rendu Mermaid final depend toujours du navigateur reel. |
| Stream B P2 browser, WebDriver, artifact policy, fallback | **Avance fortement, pas release-prouve** | `BrowserLocator` dans `src/browserLocator.ts:128`; WebDriver print dans `src/webDriverClient.ts:141`; politique plateforme/fraicheur dans `src/artifactPolicy.ts:32`, `src/artifactPolicy.ts:67`; fallback dans `src/fallbackBrowserProvisioner.ts:56`, `:67`, `:91`, `:132`, `:242`. Audits Stream B recents indiquent gate P2 passant avec reserves. | Il manque encore une preuve de bout en bout avec vrai navigateur, driver/fallback et matrice compatibilite. |
| Release globale v0.1.2 | **Bloquee / NO-GO** | Checklist `blocked` dans `docs/release-evidence/release-checklist-v0.1.2.md:3`; decision `GO Stream A strict`, `NO-GO global release` dans `:146`; blockers dans `:149`. | Browser reel + Mermaid, fallback/provisioning terrain, CI matrix Linux/macOS/Windows, FR-20 reel multi-compte. |

## Conformite exigences

| Exigence | Statut d'avancement | Evidence | Probleme residuel |
| --- | --- | --- | --- |
| FR-01 a FR-03 conversion simple et chemins de sortie | **Couverte en CLI/integration deterministe** | `src/cli.ts:164`, `src/paths.ts:19`, tests `tests/integration/cli-pdf.test.ts:37`, `:50`, `:62`. | La fidelite finale du PDF depend du moteur navigateur reel. |
| FR-04 a FR-06 Markdown, highlighting, images relatives | **Couverte unitairement** | `tests/unit/markdownRenderer/markdownRenderer.test.ts:12`, `:37`, `:69`, `:85`. | La validation PDF visuelle complete reste non prouvee en navigateur reel. |
| FR-07 PDF / page-break / browser print | **Partielle** | `src/pdfRenderer.ts:20`, `src/webDriverClient.ts:141`, tests unitaires WebDriver `tests/unit/webDriverClient/webDriverClient.test.ts:14`, `:99`. | Pas de preuve robuste de rendu page/PDF avec navigateur reel dans la matrice. |
| FR-08 a FR-11 batch et reporting | **Couverte** | `src/pipeline.ts:38`, `src/cli.ts:198`, tests `tests/unit/cli/cli.test.ts:316`, `:340`. | Aucun blocage fonctionnel observe. |
| FR-12 a FR-14 overwrite / skip | **Couverte** | `src/overwrite.ts:83`, `tests/unit/overwrite/overwrite.test.ts:73`, `tests/unit/cli/cli.test.ts:346`. | Les courses tardives sont testees via fake browser, pas par scenarios OS reels complets. |
| FR-15 a FR-18 erreurs et exit codes | **Couverte** | `src/errors.ts:80`, `src/cli.ts:224`, tests `tests/unit/cli/cli.test.ts:58`, `:71`, `:316`. | Aucun blocage actuel. |
| FR-19 user-scope install | **Localement couvert** | Packaging dans `package.json:22`, preuves FR-20 install prefix dans `docs/release-evidence/fr-20-system-scope.md:38`. | Rejouer sur release candidate propre avant publication. |
| FR-20 system-scope availability | **Simulation seulement** | `docs/release-evidence/fr-20-system-scope.md:45`, `:54`, `:55`, `:100`; checklist `docs/release-evidence/release-checklist-v0.1.2.md:88`. | Ne prouve pas un vrai install system-wide visible par un second compte Windows. |
| FR-21 idempotent install / upgrade | **Preuve locale, pas matrice** | Checklist packaging section `docs/release-evidence/release-checklist-v0.1.2.md:93`. | A rejouer sur environnement propre et dans CI/matrice. |
| FR-23 output-dir | **Couverte** | `src/cli.ts:45`, `src/paths.ts:47`, tests `tests/integration/cli-pdf.test.ts:62`. | Aucun blocage actuel. |
| FR-24 Mermaid diagram rendering | **Non ferme / bloquant release** | Architecture promet Mermaid via navigateur reel `docs/architecture.md:27`, `:92`; test reel `tests/integration/real-browser-mermaid.test.ts:20`. | `npm.cmd run test:real-browser` echoue par timeout d'attente HTML rendu. |
| NFR-02 local-only | **Couverte unitairement / architecturellement** | Architecture `docs/architecture.md:233`; tests WebDriver et Markdown `tests/unit/webDriverClient/webDriverClient.test.ts:171`, `:377`; `tests/unit/markdownRenderer/markdownRenderer.test.ts:129`, `:149`. | WebDriver n'offre pas interception complete; la preuve release doit conserver un test navigateur reel offline. |
| NFR-03 portabilite | **Partielle** | Tests Windows locaux passent; checklist CI matrix `blocked` dans `docs/release-evidence/release-checklist-v0.1.2.md:69`. | Pas de preuve Linux/macOS/Windows Node 20+ versionnee. |
| NFR-05 artifact freshness | **Couverte actuellement** | Politique `ARTIFACT_FRESHNESS_POLICY.md:41`, `:91`; script `scripts/checkArtifactFreshness.mjs`; gate rejoue vert. | Continuer a rejouer avant tout commit/release qui touche dependencies, assets, lockfiles ou provisioning. |

## Findings principaux

### 1. La release globale est encore bloquee par le test vrai navigateur/Mermaid

Severity: **High**

Evidence: l'architecture fait du navigateur reel et de Mermaid un driver majeur (`docs/architecture.md:16`, `:27`, `:92`, `:434`). Le test dedie existe (`tests/integration/real-browser-mermaid.test.ts:20`) mais `npm.cmd run test:real-browser` echoue aujourd'hui avec `Timed out waiting for browser-rendered HTML`, via `src/pdfRenderer.ts:173` et `src/pdfRenderer.ts:314`.

Impact: tant que ce test ou une preuve equivalente ne passe pas, FR-24 et une lecture complete de P3/browser-backed restent non fermes. Le produit peut avoir une CLI solide tout en echouant sur le cas prioritaire "Mermaid en vrai PDF".

Correction attendue: stabiliser l'attente navigateur/Mermaid, clarifier le contrat entre `pdfRenderer.ts` et `webDriverClient.ts`, puis versionner une preuve real-browser avec environnement, navigateur, driver et sortie PDF.

### 2. La checklist est globalement juste, mais certains compteurs de preuves sont deja stale

Severity: **Low**

Evidence: la checklist indique encore 11 fichiers / 85 tests unitaires et 10 tests contrats ou integration dans `docs/release-evidence/release-checklist-v0.1.2.md:64`, `:65`, `:66`. Le rejeu actuel observe 13 fichiers / 139 tests pour `npm test`, 15 tests contrats et 13 tests `test:browser`.

Impact: ce n'est pas un bug produit, mais cela degrade la valeur forensic des preuves release. Un lecteur peut croire que la release a ete validee sur une surface plus petite ou differente.

Correction attendue: mettre a jour les compteurs et distinguer "dernier rejeu local" de "preuve release candidate finale".

### 3. FR-20 est acceptable pour Stream A strict, pas pour une preuve system-scope reelle

Severity: **Medium**

Evidence: `docs/release-evidence/fr-20-system-scope.md:54` dit que la simulation est utilisee; `:55` precise qu'aucun vrai compte secondaire ni install machine-level n'a ete utilise; `:100` dit explicitement que la preuve ne couvre pas la propagation ACL a chaque compte.

Impact: le statut `pass` dans la checklist est comprehensible pour Stream A strict, mais dangereux s'il est relu comme preuve release globale FR-20.

Correction attendue: garder le `pass` qualifie "Stream A strict simulation", et ajouter un item separe `blocked` ou `pending` pour FR-20 system-scope reel avant release globale.

### 4. Stream B P2 est avance, mais la preuve terrain navigateur/fallback manque encore

Severity: **Medium**

Evidence: le fallback applique maintenant une contrainte plateforme (`src/fallbackBrowserProvisioner.ts:63`, `src/artifactPolicy.ts:67`) et couvre checksum/cache/extraction (`src/fallbackBrowserProvisioner.ts:132`, `:242`, `:310`). Les tests unitaires couvrent la selection plateforme (`tests/unit/artifacts/fallbackBrowserProvisioner.test.ts:166`) et les erreurs cache (`:331`, `:348`). Mais la checklist garde browser-backed, fallback/provisioning et compatibilite comme blockers (`docs/release-evidence/release-checklist-v0.1.2.md:67`, `:149`).

Impact: le socle technique est probablement pret pour poursuivre, mais il ne prouve pas encore le scenario utilisateur complet "pas de navigateur/driver compatible -> fallback eligible -> PDF Mermaid".

Correction attendue: ajouter une preuve de bout en bout pour navigateur installe, puis une preuve fallback controlee avec artefact declare eligible ou une decision explicite de reporter le fallback hors release.

### 5. La frontiere Stream A strict / Stream B reste fragile autour du rendu PDF final

Severity: **Medium**

Evidence: le plan Stream A strict exclut le moteur navigateur/Mermaid/fallback, tandis que `src/pdfRenderer.ts` et `tests/integration/cli-pdf.test.ts` portent deja une partie de la logique d'attente DOM, validation PDF et Mermaid (`src/pdfRenderer.ts:125`, `:173`, `:247`, `:308`; `tests/integration/cli-pdf.test.ts:132`, `:159`, `:185`).

Impact: les audits peuvent conclure differemment selon qu'ils lisent `pdfRenderer.ts` comme "colle Stream A" ou "responsabilite Stream B". Cela ralentit la fermeture des blockers et dilue la responsabilite du test real-browser qui echoue.

Correction attendue: inscrire explicitement dans `docs/architecture.md` ou dans un plan final qui possede `pdfRenderer.ts` jusqu'a release: Stream B moteur final, ou Stream A integration temporaire acceptee avec dette nommee.

## Synthese d'avancement

| Axe | Avancement estime | Lecture |
| --- | --- | --- |
| Cadrage / P0 / architecture documentaire | 95-100% | Aligne et exploitable. |
| Contrats C0 | 100% | Vert au typecheck et contrats. |
| Stream A strict | 90-95% | GO strict: CLI, orchestration, packaging, README/help, simulation FR-20. |
| Stream B technique P1/P2 | 75-85% | Beaucoup de code et tests unitaires presents; reserves surtout integration terrain. |
| P3 browser-backed reel | 40-60% | Integration fake-browser verte, vrai navigateur Mermaid rouge. |
| Release globale v0.1.2 | 60-70% | Bloquee par real-browser/Mermaid, CI matrix, fallback/provisioning evidence, FR-20 reel. |

## Prochaine sequence recommandee

1. Fermer `npm.cmd run test:real-browser`: diagnostiquer l'attente DOM/Mermaid dans `pdfRenderer.ts`, puis faire passer le smoke Mermaid avec un navigateur installe reel.
2. Mettre a jour `docs/release-evidence/release-checklist-v0.1.2.md` avec les compteurs observes aujourd'hui et un statut separe pour FR-20 simulation versus FR-20 reel.
3. Decider l'ownership final de `pdfRenderer.ts` et des tests Mermaid: Stream B moteur final ou Stream A glue temporaire explicitement acceptee.
4. Ajouter une preuve fallback/provisioning de bout en bout, ou sortir explicitement le fallback de la release globale.
5. Produire une preuve CI Linux/macOS/Windows Node 20+ avant toute decision `GO release`.

Conclusion: **GO Stream A strict maintenu; NO-GO release globale maintenu.** Le projet est en bon etat de progression structurelle, mais le verrou qui compte le plus pour l'utilisateur final reste le rendu navigateur reel, en particulier Mermaid.
