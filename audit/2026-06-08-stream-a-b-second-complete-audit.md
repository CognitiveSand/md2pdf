# Deuxieme audit complet Streams A/B v0.1.2 - 2026-06-08

Verdict global: **NO-GO release / NO-GO completion Streams A+B**.

Etat de progression a retenir:

- **Stream A**: P1/P2 sont largement couverts par code et tests unitaires; P3
  est **en cours**; P4 est **non implemente**.
- **Stream B**: seul **P1 est implemente**; P2/P3/P4 ne sont pas implementes.

Ce verdict ne dit pas que le travail en cours est mauvais; il dit que l'etat
actuel ne peut pas encore etre declare complet, packable ou releasable.

## Sources auditees

- `ARTIFACT_FRESHNESS_POLICY.md`
- `docs/implementation_plan_v0.1.2.md`
- `docs/plan_stream_a.md`
- `docs/plan_stream_b.md`
- `docs/project_requirements.md`
- `docs/release-evidence/release-checklist-v0.1.2.md`
- `docs/release-evidence/fr-20-system-scope.md`
- `README.md`
- `package.json`
- `artifacts.json`
- `.githooks/pre-commit`
- `src/**/*.ts`
- `tests/**/*.test.ts`
- `scripts/checkArtifactFreshness.mjs`
- audit precedent: `audit/2026-06-08-stream-a-b-progress-code-audit.md`

## Validations executees

| Commande | Resultat | Interpretation |
| --- | --- | --- |
| `npm.cmd run typecheck` | PASS | Le TypeScript compile en mode noEmit. |
| `npm.cmd test` | PASS, 80 tests | Les tests unitaires/contrats actuels passent. |
| `node scripts/checkArtifactFreshness.mjs` | FAIL | Gate release/artifacts rouge sur `assets/highlight.css`. |
| `npm.cmd run test:browser` | FAIL | Aucun fichier `tests/integration/**/*.test.ts`. |
| `npm.cmd run test:artifacts` | FAIL | Script absent dans `package.json`. |

Note: `npm pack` et `npm run build` n'ont pas ete lances dans cet audit pour
eviter de generer des artefacts; `prepack` lancerait de toute facon
`check:artifacts` et serait donc bloque tant que la gate artifacts reste rouge.

## Couverture d'avancement

| Zone | Statut audit | Evidence | Probleme |
| --- | --- | --- | --- |
| Stream A P1 | Couvert | `tests/unit/cli/cli.test.ts:41`, `tests/unit/paths/paths.test.ts:19`, `tests/unit/pipeline/pipeline.test.ts:37` | Pas de blocage P1 observe. |
| Stream A P2 | Couvert localement | `tests/unit/overwrite/overwrite.test.ts:38`; `npm.cmd test` PASS | P2 global reste conditionne par `check:artifacts`, qui est rouge. |
| Stream A P3 | En cours, non accepte | `docs/plan_stream_a.md:106`, `docs/plan_stream_a.md:117`, `src/contracts.ts:8`, `src/contracts.ts:16` | Le converter public reste un stub; aucun test browser/PDF ne passe. |
| Stream A P4 | Non implemente | `docs/plan_stream_a.md:126`, `docs/plan_stream_a.md:138`, `docs/release-evidence/release-checklist-v0.1.2.md:99`, `:100` | Installation, pack, README final, FR-19/20/21 non prouves. |
| Stream B P1 | Implemente | `docs/plan_stream_b.md:29`, `src/markdownRenderer.ts:56`, `src/releaseCatalog.ts`, `npm.cmd test` PASS | P1 HTML local est la limite actuelle du stream. |
| Stream B P2 | Non implemente | `docs/plan_stream_b.md:56`, `:58`, `:78`, `:106`, `src/fallbackBrowserProvisioner.ts:9`, `:16` | Browser locator, WebDriver client, PDF renderer et provisioner reel absents/stub. |
| Stream B P3 | Non implemente | `docs/plan_stream_b.md:118`, `:122`, `vitest.browser.config.ts:5` | Aucun converter atomique complet ni test PDF/browser. |
| Gates release | Non conforme | `package.json:37`, `package.json:43`; commande `checkArtifactFreshness` FAIL | La release est bloquee par artifact freshness. |

## Findings

### 1. Gate release artifacts rouge sur `highlight.css`

Severity: **Critical**

Evidence:

- `artifacts.json:7`, `:14`, `:15` declare `highlight.css` avec SHA-256
  `c3c4ac...` et taille `1419`.
- `node scripts/checkArtifactFreshness.mjs` echoue avec:
  - `artifact highlight.js GitHub Light theme stylesheet size does not match assets/highlight.css`
  - `artifact highlight.js GitHub Light theme stylesheet sha256 does not match assets/highlight.css`
- `package.json:37` fait passer `prepack` par `npm run check:artifacts`.
- `package.json:43` definit `check:artifacts` comme gate officielle.

Problem:

Le depot ne satisfait pas la policy d'artefacts en verification complete. Le
mode pre-commit staged peut laisser passer un audit-only commit, mais la gate de
release reste rouge.

Risk:

Impossible de declarer P2 global, P4 ou release candidate conforme. Tout `npm
pack` reel est attendu bloque par `prepack`.

Suggested fix:

Choisir la source correcte: soit restaurer `assets/highlight.css` au contenu
declare, soit verifier le contenu actuel comme newest eligible puis mettre a
jour `artifacts.json` avec hash/taille/provenance exacts.

Test needed:

`node scripts/checkArtifactFreshness.mjs` et `npm.cmd run check:artifacts`
doivent passer en verification complete.

### 2. P3 Stream A est en cours mais le chemin utilisateur reel ne convertit pas

Severity: **High**

Evidence:

- `docs/plan_stream_a.md:106` ouvre P3 Integration verticale.
- `docs/plan_stream_a.md:110` demande de remplacer le faux converter par le vrai
  `convertFile` pour les tests d'integration.
- `src/cli.ts:166` construit `ConversionPipeline` avec `defaultConvertFile`
  quand aucun fake n'est injecte.
- `src/contracts.ts:8` exporte `convertFile`, mais `src/contracts.ts:16` lance
  encore `NotImplementedError`.
- `npm.cmd run test:browser` echoue car aucun test d'integration n'existe.

Problem:

Les tests Stream A prouvent l'orchestration avec des converters injectes. Ils ne
prouvent pas que `md2pdf ENTRY` produit un PDF dans le chemin utilisateur reel.

Risk:

Fausse impression de completion: la CLI peut resoudre les jobs et formater les
erreurs, mais le produit MVP attendu reste absent tant que P3 n'est pas branchee
au rendu reel.

Suggested fix:

Finir P3 en branchant le vrai converter, puis ajouter un test integration CLI ->
PDF reel.

Test needed:

`npm.cmd run test:browser` doit contenir au moins un cas CLI ou converter reel
qui produit un PDF, avec une erreur riche en cas d'echec.

### 3. Stream B est limite a P1; le moteur PDF local n'existe pas encore

Severity: **High**

Evidence:

- `docs/plan_stream_b.md:14` a `:18` listent `markdownRenderer.ts` et
  `releaseCatalog.ts` en P1, puis `browserLocator.ts`, `webDriverClient.ts`,
  `pdfRenderer.ts` et `fallbackBrowserProvisioner.ts` pour P2/P3.
- `docs/plan_stream_b.md:58`, `:78`, `:106` decrivent les modules P2 attendus.
- `src/fallbackBrowserProvisioner.ts:9` expose le provisioner mais
  `src/fallbackBrowserProvisioner.ts:16` lance `NotImplementedError`.
- `rg --files` ne trouve pas `src/browserLocator.ts`, `src/webDriverClient.ts`,
  `src/pdfRenderer.ts` ni `src/converter.ts`.

Problem:

Stream B a bien livre le socle HTML local, mais pas le navigateur, le WebDriver,
le renderer PDF, le cache/provisioning ni l'assemblage `convertFile`.

Risk:

Les fonctions les plus risquees du produit - PDF reel, Mermaid execute dans le
navigateur, timeout, cache, compatibilite OS/browser - restent non testees.

Suggested fix:

Continuer Stream B dans l'ordre du plan: browser locator, fallback provisioner,
WebDriver client, PDF renderer, puis converter atomique P3.

Test needed:

Tests fake catalog/cache pour P2, puis `test:browser` pour PDF/Mermaid/offline.

### 4. Le script `test:artifacts` requis par Stream B n'existe pas

Severity: **High**

Evidence:

- `docs/plan_stream_b.md:95` exige `npm run test:artifacts` comme gate P2
  specifique fallback.
- `docs/plan_stream_b.md:178` inclut `npm run test:artifacts` dans la gate P2.
- `package.json:37` a `:44` liste les scripts, mais aucun `test:artifacts`.
- `npm.cmd run test:artifacts` echoue avec `Missing script: "test:artifacts"`.

Problem:

La validation prevue pour cache/provisioning/artifact runtime n'est pas
executable.

Risk:

Quand P2 Stream B commencera, il sera possible d'ajouter du provisioning sans
gate dediee sur checksum, cache partiel, cache non writable et newest eligible.

Suggested fix:

Ajouter le script `test:artifacts` et les tests associes avant de pretendre
accepter Stream B P2.

Test needed:

Cas rouge/vert sur checksum invalide, cache partiel, cache non writable,
aucune release eligible, artifact non declare.

### 5. `test:browser` existe mais ne teste rien

Severity: **High**

Evidence:

- `package.json:41` definit `test:browser`.
- `vitest.browser.config.ts:5` inclut `tests/integration/**/*.test.ts`.
- `npm.cmd run test:browser` echoue avec `No test files found`.
- `docs/plan_stream_a.md:117` a `:121` et `docs/plan_stream_b.md:177` a `:179`
  font de `test:browser` une gate P3.

Problem:

Le script browser est present mais vide de couverture. Il ne peut pas jouer son
role de gate P3.

Risk:

P3 pourrait avancer avec des tests unitaires verts mais sans preuve PDF,
Mermaid rendu comme diagramme, WebDriver, timeout ou offline strict.

Suggested fix:

Ajouter des tests d'integration sous `tests/integration/**/*.test.ts` des que le
converter et le renderer PDF existent.

Test needed:

Au minimum: PDF cree, Mermaid non raw, image relative embarquee, remote image
refusee, timeout propre.

### 6. Le checker complet ne prouve toujours pas `newest eligible` pour les artefacts non-npm

Severity: **High**

Evidence:

- `ARTIFACT_FRESHNESS_POLICY.md` impose le newest eligible apres quarantaine.
- `scripts/checkArtifactFreshness.mjs:351` verifie la declaration d'un artifact
  et son contenu local.
- `scripts/checkArtifactFreshness.mjs:443` regenere le lock npm pour les
  dependances npm.
- Le chemin non-npm ne consulte pas de catalogue externe de releases pour
  prouver que la version declaree est la plus recente eligible.

Problem:

Pour un asset non-npm ou un runtime provisionne, un hash local coherent ne
suffit pas a prouver "newest eligible". Le checker peut verifier l'integrite
locale sans prouver la fraicheur relative.

Risk:

Un artifact ancien mais coherent peut passer la gate, ce qui viole NFR-05 et la
policy centrale.

Suggested fix:

Brancher le checker sur `ReleaseCatalog` ou sur une source de releases
verifiable par type d'artifact non-npm.

Test needed:

Tests negatifs: version non newest mais eligible, version en quarantaine sans
waiver, absence de release compatible, waiver invalide.

### 7. La protection pre-commit est active, mais son scope staged ne protege pas les changements du checker lui-meme

Severity: **Medium**

Evidence:

- `git config --get core.hooksPath` retourne `.githooks`.
- `.githooks/pre-commit:3` lance `node scripts/checkArtifactFreshness.mjs`.
- `scripts/checkArtifactFreshness.mjs:69` a `:117` ajoute un filtre staged.
- `tests/unit/artifacts/artifactFreshness.test.ts:24` a `:48` teste que les
  audits seuls sont ignores et que les chemins dependency/artifact/runtime sont
  gardes.

Problem:

Le comportement demande est atteint pour les commits audit/doc. En revanche, un
changement du checker ou du hook lui-meme n'est pas traite comme chemin
artifact-relevant par le filtre actuel.

Risk:

Une modification future de `scripts/checkArtifactFreshness.mjs` ou du hook
pourrait affaiblir la gate sans que le pre-commit staged force une validation
plus stricte.

Suggested fix:

Garder le skip audit-only, mais traiter `.githooks/pre-commit` et
`scripts/checkArtifactFreshness.mjs` comme enforcement paths: ils doivent au
minimum lancer les tests du checker ou le check complet si ces fichiers sont
staged.

Test needed:

Test staged-path pour `scripts/checkArtifactFreshness.mjs` et `.githooks/pre-commit`.

### 8. La documentation utilisateur annonce une capacite browser-backed non disponible

Severity: **Medium**

Evidence:

- `README.md:16` annonce que browser-backed conversion et artifact checks
  restent des travaux de la piste v0.1.2.
- `README.md:109` dit que les fences Mermaid utilisent le browser path pour
  rendre des diagrammes.
- `README.md:130` et `:131` disent que `npm run test:browser` execute les tests
  d'integration browser-backed.
- `npm.cmd run test:browser` echoue faute de fichiers.

Problem:

Le README melange etat cible et etat executable. Le lecteur peut croire que le
pipeline browser-backed est testable alors que Stream B n'a que P1.

Risk:

Mauvaise communication projet et acceptance prematuree de P3.

Suggested fix:

Marquer explicitement dans README que le rendu PDF/browser et `test:browser`
sont en cours/non disponibles tant que P3 n'est pas acceptee.

Test needed:

Audit doc-sync apres P3 pour aligner README, scripts et preuves.

### 9. La checklist release reste stale face aux tests reels

Severity: **Medium**

Evidence:

- `docs/release-evidence/release-checklist-v0.1.2.md:67` et `:68` laissent
  browser tests et artifact gate en `pending`.
- `docs/release-evidence/release-checklist-v0.1.2.md:122` et `:123` laissent
  certains points Stream A en `pending` alors que des tests unitaires existent.
- `docs/release-evidence/release-checklist-v0.1.2.md:99`, `:100`, `:108`,
  `:129` laissent FR-19/FR-20/FR-21 et preuves manuelles en `pending`.

Problem:

La checklist n'est plus une photographie fiable: elle a raison de bloquer la
release, mais elle ne distingue pas assez les points Stream A deja prouves des
preuves P4 non encore executees.

Risk:

Les audits futurs perdront du temps a re-decouvrir ce qui est deja couvert et ce
qui reste vraiment bloquant.

Suggested fix:

Mettre a jour la checklist avec trois statuts separes: couvert par tests
unitaires, bloque par P3/P4, et preuve release manuelle attendue.

Test needed:

Re-audit documentaire apres mise a jour des preuves.

### 10. P4 installation/packaging n'est pas implemente ni prouve

Severity: **Medium**

Evidence:

- `docs/plan_stream_a.md:126` ouvre P4 Installation, packaging, README.
- `docs/plan_stream_a.md:138` demande la preuve FR-20.
- `docs/release-evidence/release-checklist-v0.1.2.md:99` et `:100` gardent
  FR-19 et FR-21 en `pending`.
- `docs/release-evidence/fr-20-system-scope.md` reste un template de preuve
  manuel.

Problem:

P4 est correctement declare non implemente, mais aucune preuve ne permet encore
de valider installation user-scope, system-scope, reinstall idempotent,
packlist, ou bin `dist/cli.js`.

Risk:

Le produit peut rester utilisable en dev mais echouer dans son parcours
d'installation MVP.

Suggested fix:

Ne commencer l'acceptance P4 qu'apres P3 vertical; ensuite executer pack,
install user-scope, reinstall, et preuve FR-20.

Test needed:

`npm pack`, install dans prefixe temporaire, `md2pdf --help`, deuxieme install,
preuve system-scope versionnee.

## Architecture audit

Le decoupage Stream A / Stream B reste utile, mais l'architecture executable est
encore asymetrique:

- Stream A orchestre correctement des conversions abstraites.
- Stream B sait produire du HTML local, mais ne fournit pas encore le backend
  PDF attendu par le contrat public.
- Le contrat `convertFile` est le point de jonction critique; tant qu'il reste
  dans `src/contracts.ts` comme stub, l'architecture reste une architecture de
  pre-integration.

Correction architecturale recommandee: garder le boundary `convertFile`, mais
deplacer son implementation concrete hors `contracts.ts` vers un module
converter Stream B/P3, puis faire importer ce converter par la CLI runtime.

## Test audit

Ce qui est bien prouve:

- CLI parsing, usage errors, output resolution, overwrite, batch summaries.
- Markdown -> HTML local, CSS local, Mermaid HTML pending, images relatives en
  data URI, refus des images remote/absolues.
- C0 contracts et stubs.
- Filtre staged du checker pour audit-only vs chemins artifact-relevant.

Ce qui n'est pas prouve:

- PDF reel.
- Execution Mermaid dans un navigateur.
- WebDriver print.
- Browser locator/provisioning/cache.
- `test:artifacts`.
- `npm pack` et installation P4.
- FR-19/FR-20/FR-21.

## Business logic audit

Le besoin utilisateur central est "convertir Markdown en PDF localement". Dans
l'etat actuel, ce besoin n'est pas encore satisfait de bout en bout:

- La CLI existe et sait orchestrer.
- Le rendu HTML local existe.
- Le PDF local n'existe pas encore.
- L'installation release n'est pas prouvee.

La prochaine acceptance utile n'est donc pas un nouvel audit P1/P2: c'est une
preuve verticale P3 minimale produisant un PDF.

## Documentation sync audit

Les docs de plan sont globalement coherentes avec l'etat declare: Stream A P3
en cours, P4 non implemente, Stream B limite a P1. Les docs utilisateur et
release evidence doivent encore etre resserrees pour eviter d'annoncer des
capacites browser-backed non executables.

## Priorites recommandees

1. Corriger `assets/highlight.css` / `artifacts.json` pour retrouver une gate
   artifacts complete verte.
2. Continuer Stream A P3 jusqu'a brancher un vrai `convertFile` observable par
   la CLI.
3. Implementer Stream B P2: `browserLocator`, `fallbackBrowserProvisioner`,
   `webDriverClient`, `pdfRenderer`.
4. Ajouter `test:artifacts` avant d'accepter le provisioning/cache.
5. Ajouter les tests `tests/integration/**/*.test.ts` pour `test:browser`.
6. Mettre a jour README et release checklist avec l'etat reel.
7. Quand P3 est vert, demarrer P4 et produire FR-19/FR-20/FR-21.

## Conclusion

Second audit complet: **Stream A est bien en cours sur P3, Stream A P4 n'est pas
implemente, Stream B n'a que P1 implemente**.

Les risques bloquants restent nets: artifact gate rouge, converter public stub,
absence du backend browser/PDF Stream B, absence de `test:artifacts`, absence de
tests browser, et P4 non prouve. Le projet peut continuer, mais ne doit pas etre
presente comme complete ou releasable dans cet etat.
