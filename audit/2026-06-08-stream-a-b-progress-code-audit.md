# Audit d'avancement Streams A/B v0.1.2 - 2026-06-08

Verdict global: **NO-GO pour declarer les Streams A et B complets**.

Stream A est fonctionnellement arrive a **P2 point 7 accepte**, mais **P2 global
reste non valide** tant que la gate `check:artifacts` echoue. Stream B est au
mieux **P1 point 3 accepte**; P2/P3 ne sont pas encore implementes ni
validables. Les tests TypeScript/unitaires rapportes par les agents passent,
mais la gate artifacts est rouge et les preuves release sont stale.

## Perimetre et sources

Sources principales:

- `ARTIFACT_FRESHNESS_POLICY.md`
- `docs/implementation_plan_v0.1.2.md`
- `docs/implementation_plan_v0.1.2_P0.md`
- `docs/plan_stream_a.md`
- `docs/plan_stream_b.md`
- `docs/release-evidence/release-checklist-v0.1.2.md`
- `docs/release-evidence/fr-20-system-scope.md`
- audits Stream A du 2026-06-05 dans `audit/`
- audits Stream B `audit/audit-streamB#*.md`
- code et tests actuels sous `src/`, `tests/`, `scripts/`

Agents utilises:

- Audit Stream A: avancement CLI/orchestration vs plan et audits.
- Audit Stream B: avancement moteur local vs plan et audits.
- Audit transverse: P0, release evidence, artifact policy, scripts et gates.

Note d'execution: les agents ont rapporte les validations courantes suivantes:
`npm.cmd run typecheck` PASS, `npm.cmd run test:contracts` PASS, `npm.cmd test`
PASS avec 78 tests, `npm.cmd run check:artifacts` FAIL. `npm.cmd run
test:artifacts` est absent et `npm.cmd run test:browser` echoue faute de
fichiers `tests/integration/**/*.test.ts`.

## Etat d'avancement

| Zone | Etat actuel | Verdict | Preuves |
| --- | --- | --- | --- |
| Stream A P1 | Accepte | OK | `audit/2026-06-05-stream-a-p1-point1-cli-audit.md:19`, `audit/2026-06-05-stream-a-p1-point2-paths-audit.md:19`, `audit/2026-06-05-stream-a-p1-point3-pipeline-audit.md:19` |
| Stream A P2 points 4-7 | Fonctionnellement accepte | OK local, gate globale KO | `audit/2026-06-05-stream-a-p2-point4-overwrite-reaudit.md:3`, `audit/2026-06-05-stream-a-p2-point5-batch-audit.md:3`, `audit/2026-06-05-stream-a-p2-point6-edge-cases-audit.md:3`, `audit/2026-06-05-stream-a-p2-point7-permissions-reaudit.md:3` |
| Stream A P2 global | Non valide | NO-GO | `docs/plan_stream_a.md:165` exige `typecheck && npm test && check:artifacts`; `check:artifacts` echoue |
| Stream A P3 | Non atteint / non validable | NO-GO | P3 exige le vrai converter dans `docs/implementation_plan_v0.1.2.md:500-505`; `src/contracts.ts:15-16` reste un stub `NotImplementedError` |
| Stream A P4/release | Non prouve | NO-GO | FR-19/FR-20/FR-21 restent pending dans `docs/release-evidence/release-checklist-v0.1.2.md:88`, `:99`, `:100` et `docs/release-evidence/fr-20-system-scope.md:6`, `:16-21` |
| Stream B P1 points 1-3 | Accepte | OK | `src/markdownRenderer.ts:56`, `src/markdownRenderer.ts:63`, `src/releaseCatalog.ts:20`, `src/releaseCatalog.ts:56`, tests unitaires associes |
| Stream B P2 | Non implemente | NO-GO | `docs/plan_stream_b.md:58`, `:78`, `:95`, `:106`; modules `browserLocator.ts`, `webDriverClient.ts`, `pdfRenderer.ts` absents; `src/fallbackBrowserProvisioner.ts:19` lance `NotImplementedError` |
| Stream B P3 | Non validable | NO-GO | `docs/plan_stream_b.md:120`, `:179`; `vitest.browser.config.ts:5` cible des tests d'integration absents |
| P0/release evidence | Stale et incoherent avec le code courant | NO-GO documentaire | `docs/release-evidence/release-checklist-v0.1.2.md:40`, `:48`, `:67`, `:68`, `:122-123` |

## Findings

### 1. Gate `check:artifacts` rouge sur `assets/highlight.css`

Severity: **Critical**

Evidence:

- `artifacts.json:9`, `:14`, `:15` declare `assets/highlight.css` avec une
  taille et un hash qui ne correspondent plus au fichier reel.
- `scripts/checkArtifactFreshness.mjs:211-218` applique les controles de taille
  et SHA-256.
- Resultat rapporte: fichier reel `1516` octets, SHA-256
  `E46B10D782D71354859AA7C9C342699B5C8238B50A275A913BB9EBDB6E1D4985`; le
  manifeste attend `1419` octets et un hash different.

Problem:

La gate artifacts echoue aujourd'hui. Elle bloque la validation P2 globale de
Stream A, bloque Stream B P2/release, et contredit les anciens audits qui
consideraient la gate verte.

Risk:

Une release v0.1.2 pourrait etre declaree conforme alors que la politique de
fraicheur des artefacts, source obligatoire du depot, refuse l'etat courant.

Suggested fix:

Verifier si le fichier distribue est bien le newest eligible apres quarantaine,
puis aligner `artifacts.json` ou restaurer le fichier attendu. Relancer
`npm.cmd run check:artifacts` avant tout nouveau GO.

Test needed:

Regression explicite sur hash/taille du CSS distribue et evidence release mise
a jour avec le resultat observe.

### 2. Le hook pre-commit obligatoire de la policy n'est pas installe

Severity: **High**

Evidence:

- `ARTIFACT_FRESHNESS_POLICY.md:12` et `:97` exigent une enforcement locale par
  hook pre-commit.
- Observation agent: pas de `.git/hooks/pre-commit`, seulement les samples.

Problem:

La conformite artifact freshness repose encore sur l'execution volontaire des
checks. La policy dit explicitement que la conformite doit etre enforcee par le
depot local, pas par la confiance accordee au modificateur.

Risk:

Des modifications peuvent etre commitees sans gate artifacts, puis les audits
deviennent rapidement faux ou stale.

Suggested fix:

Installer un hook pre-commit versionne/provisionne par le projet qui lance le
checker requis, et documenter sa verification dans la checklist release.

Test needed:

Preuve d'installation du hook et test negatif: un artifact incoherent doit
bloquer le commit local.

### 3. Stream A ne peut pas passer P2 global malgre les sous-points acceptes

Severity: **High**

Evidence:

- `audit/2026-06-05-stream-a-p2-point7-permissions-reaudit.md:99` accepte P2
  point 7.
- `docs/plan_stream_a.md:165` exige la gate globale incluant
  `check:artifacts`.
- `check:artifacts` echoue dans l'etat courant.

Problem:

Les audits point par point de Stream A sont corrects localement, mais le verdict
global ne peut pas etre "P2 complete" si une gate obligatoire est rouge.

Risk:

Le projet peut avancer vers P3 avec une base de release non conforme, puis
melanger des defauts d'orchestration avec des defauts supply-chain.

Suggested fix:

Corriger la gate artifacts avant de declarer P2 globalement terminee, puis
emettre un re-audit court de Stream A P2 global.

Test needed:

`npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run check:artifacts` dans le
meme run de preuve.

### 4. Le vrai `convertFile` n'existe pas encore, donc P3 Stream A est bloquee

Severity: **High**

Evidence:

- `docs/implementation_plan_v0.1.2.md:500-505` exige l'integration verticale
  avec le vrai converter.
- `src/cli.ts:166` appelle le converter injecte/default.
- `src/contracts.ts:15-16` conserve un default stub `NotImplementedError`.

Problem:

La CLI est testable avec injection, mais le chemin utilisateur reel
`md2pdf ENTRY` ne peut pas encore produire un PDF complet hors doubles de test.

Risk:

Les tests Stream A peuvent rester verts alors que l'experience utilisateur MVP
reste absente.

Suggested fix:

Attendre Stream B P2/P3, puis brancher le vrai converter dans le default
runtime avant de relancer l'audit P3.

Test needed:

Test d'integration CLI -> converter reel -> PDF, avec au moins un cas succes et
un cas erreur riche.

### 5. Stream B P2/P3 n'est pas implemente

Severity: **High**

Evidence:

- `docs/plan_stream_b.md:58`, `:78`, `:106` attendent browser locator,
  WebDriver client, PDF renderer et provisioning.
- `src/fallbackBrowserProvisioner.ts:13-20` ignore encore `policy/catalog` puis
  lance `NotImplementedError`.
- Les modules `src/browserLocator.ts`, `src/webDriverClient.ts`,
  `src/pdfRenderer.ts` sont absents selon l'audit agent.
- `docs/plan_stream_b.md:120`, `:179` attendent la validation browser/PDF.

Problem:

Stream B a livre la base HTML locale et le catalogue, mais pas le rendu PDF
browser-backed ni le provisioning runtime qui font le coeur du moteur local.

Risk:

La progression peut etre surestimee: le rendu Markdown HTML fonctionne, mais le
produit attendu est un PDF local fiable.

Suggested fix:

Implementer P2 dans l'ordre du plan: locator, WebDriver, renderer PDF,
provisioner, puis P3 integration.

Test needed:

Tests unitaires fake catalog/cache, puis tests integration browser/PDF avec
Mermaid, images locales, CSS print et offline strict.

### 6. Les gates et scripts de test Stream B ne correspondent pas au plan

Severity: **High**

Evidence:

- `docs/plan_stream_b.md:95` et `:178` demandent `test:artifacts`.
- `package.json:35-44` ne definit pas `test:artifacts`.
- `vitest.browser.config.ts:5` cherche `tests/integration/**/*.test.ts`, mais
  aucun test integration/browser n'existe.
- `npm.cmd run test:browser` echoue faute de fichiers.

Problem:

La strategie de validation annoncee par le plan n'est pas executable. Meme une
implementation Stream B future ne pourrait pas etre acceptee proprement avec
les scripts actuels.

Risk:

Fausse confiance: `npm test` peut passer alors que les scenarios browser/PDF,
provisioning et artifact runtime ne sont pas testes.

Suggested fix:

Ajouter les scripts et tests requis avant de declarer P2/P3 Stream B acceptables.

Test needed:

`npm.cmd run test:artifacts` et `npm.cmd run test:browser` doivent exister et
echouer rouge avant implementation, puis passer vert apres correction.

### 7. Le checker ne prouve pas encore "newest eligible" pour les artefacts non-npm

Severity: **High**

Evidence:

- `ARTIFACT_FRESHNESS_POLICY.md:42` et `:47-51` imposent le newest eligible
  apres quarantaine.
- Observation agent: `scripts/checkArtifactFreshness.mjs:180-219` valide forme,
  existence, taille et hash; `:249-250` valide surtout que `publishedAt` est une
  date, sans preuve de comparaison au catalogue externe.

Problem:

Le checker peut detecter une incoherence locale hash/taille, mais il ne prouve
pas encore pleinement que la version choisie est la plus recente eligible.

Risk:

Un artifact ancien mais coherent localement pourrait passer, ce qui viole la
regle centrale de la policy.

Suggested fix:

Connecter le checker au catalogue de releases attendu ou documenter/implementer
une source verifiable de newest eligible pour chaque artifact non-npm.

Test needed:

Tests negatifs: artifact eligible mais pas newest, artifact en quarantaine sans
waiver, waiver malforme, waiver valide.

### 8. Les preuves release sont stale et contredisent l'etat courant

Severity: **Medium**

Evidence:

- `docs/release-evidence/release-checklist-v0.1.2.md:40` affirme encore un etat
  C0 sans `src/**/*.ts`/tests.
- `docs/release-evidence/release-checklist-v0.1.2.md:48` garde typecheck comme
  bloque alors que les agents rapportent PASS.
- `docs/release-evidence/release-checklist-v0.1.2.md:67-68` reste pending sur
  preuves Stream B.
- `docs/release-evidence/release-checklist-v0.1.2.md:122-123` garde des items
  Stream A pending alors que des tests existent selon les agents.

Problem:

La checklist ne peut plus servir de preuve fiable d'avancement. Elle sous-estime
certains points deja couverts et surestime potentiellement les anciens GO
artifacts.

Risk:

Les decisions de phase peuvent etre prises sur une documentation devenue moins
fiable que le code et les gates courantes.

Suggested fix:

Mettre a jour la checklist apres correction des gates, avec une trace explicite
des commandes et resultats du 2026-06-08 ou du run de revalidation.

Test needed:

Audit doc-sync court comparant checklist, code, tests et sorties de commandes.

### 9. FR-19/FR-20/FR-21 restent non prouves pour P4/release

Severity: **Medium**

Evidence:

- `docs/implementation_plan_v0.1.2.md:287-295` et `:300-302` exigent les aspects
  installation/reinstallation/system scope.
- `docs/release-evidence/release-checklist-v0.1.2.md:88`, `:99`, `:100` restent
  pending.
- `docs/release-evidence/fr-20-system-scope.md:6`, `:16-21` restent pending.

Problem:

Le projet n'a pas encore de preuve versionnee que le package installe et se
reinstalle proprement, notamment en scenario system-scope.

Risk:

Un MVP fonctionnel en local dev peut echouer dans le parcours d'installation qui
fait partie des exigences utilisateur.

Suggested fix:

Executer les preuves P4 dans un environnement propre, capturer logs et resultats
attendus, puis mettre a jour la release evidence.

Test needed:

Smoke `npm pack`, installation user-scope, reinstall idempotent, verification
FR-20 system-scope documentee.

### 10. Les controles overwrite/permissions devront etre reenforces au moment de l'ecriture reelle

Severity: **Medium**

Evidence:

- `audit/2026-06-05-stream-a-p2-point7-permissions-reaudit.md:60-71` signale que
  les controles restent preflight/advisory.
- Stream A n'ecrit pas encore via le vrai converter.

Problem:

Les checks preflight sont utiles mais ne suffisent pas quand le rendu reel
arrivera: le fichier peut changer, le repertoire devenir non writable, ou le
converter peut tenter une ecriture differente.

Risk:

Regression de data-loss ou erreur pauvre au moment exact ou P3 branchera le vrai
rendu PDF.

Suggested fix:

Rejouer les controles overwrite/permissions au point d'ecriture finale et
propager des erreurs riches compatibles Stream A.

Test needed:

Tests integration avec destination existante, parent non writable, output file
devenu non writable entre preflight et write.

## Synthese par stream

### Stream A

Avancement reel: **P2 point 7 accepte, P2 global bloque par gate artifacts**.

Ce qui est solide:

- CLI/help/usage, path resolution, pipeline/preflight.
- Overwrite, batch, summary, exit codes, edge cases et permissions ont des
  audits d'acceptation jusqu'au point 7.

Ce qui bloque:

- `check:artifacts` rouge.
- Pas de vrai converter branche pour P3.
- FR-19/FR-20/FR-21 et P4 non prouves.

### Stream B

Avancement reel: **P1 point 3 accepte, P2/P3 non implementes**.

Ce qui est solide:

- Markdown -> HTML local.
- Highlight CSS local inline.
- Mermaid HTML sans CDN, images relatives en data URI, remote/absolute rejetes.
- Harness HTML temporaire avec file URL et cleanup.
- ReleaseCatalog reel + fake memoire.

Ce qui bloque:

- Browser locator, WebDriver client, PDF renderer et provisioning absents/stub.
- `test:artifacts` absent.
- Pas de tests integration/browser/PDF.
- Artifact gate rouge sur `highlight.css`.

## Priorites recommandees

1. Corriger `assets/highlight.css` / `artifacts.json` selon la policy, puis
   relancer `npm.cmd run check:artifacts`.
2. Installer/provisionner le hook pre-commit exige par
   `ARTIFACT_FRESHNESS_POLICY.md`.
3. Mettre a jour la release checklist apres revalidation, sans masquer les
   gates encore rouges.
4. Finaliser Stream B P2: locator, WebDriver, PDF renderer, provisioner,
   scripts `test:artifacts` et tests associes.
5. Brancher Stream A P3 sur le vrai converter seulement apres Stream B P2/P3.
6. Rejouer un audit P3 vertical avec ecriture reelle, overwrite, permissions,
   Mermaid/PDF et offline strict.
7. Produire les preuves P4 FR-19/FR-20/FR-21.

## Conclusion

Le projet a une base Stream A P1/P2 locale beaucoup plus avancee que la
checklist release ne le montre, et Stream B a livre une P1 utile. Mais le statut
release actuel est **non conforme**: la gate artifact freshness echoue, le hook
pre-commit obligatoire manque, Stream B n'a pas encore le moteur PDF local, et
les preuves P4 restent ouvertes.

Decision d'audit: **ne pas poursuivre vers une declaration de completion
Streams A/B**. Corriger d'abord les gates transverses, puis continuer Stream B
P2/P3 avant de brancher Stream A P3.
