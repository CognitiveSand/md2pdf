# Audit global projet - avancement, structure et problemes

Date: 2026-06-12

Objet: audit read-only de l'etat courant du code par rapport aux plans Stream A,
Stream B et v0.1.2.

Perimetre lu: `ARTIFACT_FRESHNESS_POLICY.md`, `docs/plan_stream_a.md`,
`docs/plan_stream_b.md`, `docs/implementation_plan_v0.1.2.md`,
`docs/implementation_plan_v0.1.2_P0.md`, `docs/project_requirements.md`,
`docs/user_stories.md`, `docs/architecture.md`, `docs/release-evidence/`,
`src/`, `tests/`, `package.json`, `artifacts.json`, `README.md`.

Agents utilises: code audit, architecture audit, documentation sync, test audit,
business requirement traceability, plus trois explorateurs specialises
(avancement plans/code, structure/architecture, tests/preuves).

Important: ce rapport liste les problemes seulement. Il ne contient pas de
solutions ni de plan de correction.

## Commandes executees

| Commande | Resultat observe | Probleme expose |
| --- | --- | --- |
| `npm.cmd run typecheck` | Echec | Le code courant ne compile pas. |
| `npm.cmd test` | Echec | 4 fichiers de tests echouent, 9 tests echouent, 3 skips. |
| `npm.cmd run test:contracts` | Echec | Le contrat C0 ne s'importe plus a cause d'un module manquant. |
| `npm.cmd run test:browser` | Echec | Les suites d'integration ne demarrent pas a cause d'un module manquant. |
| `npm.cmd run test:artifacts` | Succes partiel | La suite artifact unitaire passe, mais elle ne compense pas le gate global casse. |
| `npm.cmd run check:artifacts` | Echec | `assets/default.css` ne correspond plus a `artifacts.json`. |

## Etat d'avancement par rapport au projet

| Zone | Etat courant | Preuves | Problemes |
| --- | --- | --- | --- |
| P0 documentaire | Partiellement coherent | `docs/architecture.md` contient les contrats et la separation navigateur/artifacts; `docs/release-evidence/` existe. | Les preuves release ne representent plus l'etat courant: la checklist marque encore des gates en `pass` alors que les commandes echouent aujourd'hui. |
| C0 contrats | Regressif / non valide | `src/contracts.ts:21`, `src/converter.ts:7`, `src/converter.ts:21`; `npm.cmd run test:contracts` echoue. | Le contrat public depend d'un convertisseur qui importe des modules absents. Les gates C0 ne sont plus verts. |
| Stream A P1-P2 CLI, paths, overwrite, batch | Partiel | Tests Stream A existent sous `tests/unit/cli`, `tests/unit/paths`, `tests/unit/overwrite`, `tests/unit/pipeline`. | Les suites globales ne passent plus; la validation Stream A ne peut plus etre consideree courante. |
| Stream A P4 packaging/install | Regressif / preuve stale | `package.json:22-23`, `package.json:36-37`, `docs/release-evidence/release-checklist-v0.1.2.md:98-100`. | `dist/` et le tarball semblent issus d'un ancien build; le build courant ne peut pas regenerer `dist/`. |
| Stream B P1 Markdown vers HTML local | Partiel | `src/markdownRenderer.ts` implemente CommonMark, tables, footnotes, images locales, Mermaid inline. | La preuve globale est bloquee par les echecs compile/import; le rendu PDF final n'est pas prouve. |
| Stream B P2 navigateur, driver, fallback | Partiel / non valide | `src/browserLocator.ts`, `src/fallbackBrowserProvisioner.ts`, `src/artifactPolicy.ts`. | `browserLocator.ts` ne compile pas; aucun `chromedriver`, `geckodriver` ou fallback Chromium reel n'est declare comme artifact utilisable dans `artifacts.json`. |
| Stream B P3 converter atomique / WebDriver | Non valide | `src/converter.ts:7`, `src/converter.ts:18-23`; `npm.cmd run test:browser` echoue. | Le convertisseur cible WebDriver depend de fichiers absents; les preuves Mermaid/PDF reel ne demarrent pas. |
| Definition de fini v0.1.2 | Non atteinte | `docs/implementation_plan_v0.1.2.md` exige typecheck, tests, artifact gate, build, browser-backed PDF reel, Mermaid prouve, CI matrix. | Plusieurs gates sont rouges et plusieurs preuves release restent bloquees ou simulees. |

## Structure actuelle du code

Structure observee:

- `src/cli.ts`, `src/paths.ts`, `src/overwrite.ts`, `src/pipeline.ts`: surface CLI, resolution de jobs, overwrite, orchestration batch.
- `src/markdownRenderer.ts`: Markdown vers HTML local avec assets inline.
- `src/converter.ts`: orchestration recente vers WebDriver, mais depend de modules absents.
- `src/webDriverClient.ts`: client WebDriver Print.
- `src/browserLocator.ts`, `src/releaseCatalog.ts`, `src/artifactPolicy.ts`, `src/fallbackBrowserProvisioner.ts`: detection navigateur, catalogue, politique artifacts, fallback.
- `src/pdfRenderer.ts`: ancien chemin de rendu direct navigateur via `--print-to-pdf`.
- `dist/`: build genere actuellement present, mais non regenerable depuis `src/`.
- `tests/`: tests unitaires, integration browser, real-browser separe.
- `docs/release-evidence/`: preuves release et checklist.

Probleme structural majeur: deux architectures de rendu coexistent. Le code
source courant vise WebDriver (`src/converter.ts` + `src/webDriverClient.ts`),
mais `dist/converter.js` importe encore `dist/pdfRenderer.js`, et `src/pdfRenderer.ts`
reste present comme ancien chemin direct navigateur.

## Problemes critiques

### 1. Le depot courant ne compile pas

Severite: Critique

Preuves:

- `src/browserLocator.ts:4` importe `basename`, `delimiter`, `extname`, `join`, `resolve`, mais pas `isAbsolute`.
- `src/browserLocator.ts:481` appelle `isAbsolute(path)`.
- `src/browserLocator.ts:682-690` appelle `windowsRoots(...)` et `pathExecutablesFromEnv(...)`.
- `src/browserLocator.ts:701-724` definit `pathExecutablesForEnv(...)`, pas `pathExecutablesFromEnv(...)`.
- `src/converter.ts:7` importe `./browserTypes.js`, absent de `src/`.
- `src/converter.ts:18-23` importe et reexporte `./webDriverSession.js`, absent de `src/`.

Impact projet: tous les gates qui exigent `typecheck`, `build` ou un import de
`converter.ts` sont invalides. Cela bloque C0, Stream A global, Stream B et P4.

### 2. Les tests contractuels C0 ne s'executent plus

Severite: Critique

Preuves:

- `src/contracts.ts:21` reexporte `convertFile` depuis `src/converter.ts`.
- `src/converter.ts:18-23` importe `./webDriverSession.js`, absent.
- `npm.cmd run test:contracts` echoue avant execution des tests avec
  `ERR_MODULE_NOT_FOUND`.

Impact projet: le contrat commun C0 n'est plus une base stable. Une importation
du contrat public charge le convertisseur complet et ses dependances navigateur.

### 3. Les preuves release disent `pass` alors que l'etat courant est rouge

Severite: Critique

Preuves:

- `docs/release-evidence/release-checklist-v0.1.2.md:63` marque le typecheck en `pass`.
- `docs/release-evidence/release-checklist-v0.1.2.md:64` marque les tests unitaires en `pass`.
- `docs/release-evidence/release-checklist-v0.1.2.md:68` marque `check:artifacts` en `pass`.
- Les commandes executees le 2026-06-12 donnent l'inverse: `typecheck`, `npm test`,
  `test:contracts`, `test:browser` et `check:artifacts` echouent.

Impact projet: la checklist release n'est plus une source fiable pour juger
l'avancement actuel.

### 4. Le gate artifact freshness echoue

Severite: Critique

Preuves:

- `artifacts.json:7-15` declare `assets/default.css` avec sha256
  `543c34bd0835034e9e1a93afb507470fa53f9c604a47e7e0614080a4459efe0a` et taille
  `3200`.
- `npm.cmd run check:artifacts` echoue avec:
  - `artifact md2pdf default stylesheet size does not match assets/default.css`
  - `artifact md2pdf default stylesheet sha256 does not match assets/default.css`

Impact projet: la politique obligatoire d'artifact freshness bloque le depot
courant. Le succes isole de `test:artifacts` ne valide pas le manifeste reel.

### 5. `dist/` et le tarball ne representent plus le source courant

Severite: Critique

Preuves:

- `package.json:22-23` publie `md2pdf` via `./dist/cli.js`.
- `package.json:36-37` exige `tsc` et `check:artifacts` avant pack.
- `src/converter.ts:18-23` vise `webDriverSession`, absent.
- `dist/converter.js` importe encore `renderPdfFromHtml` depuis `./pdfRenderer.js`.
- `src/pdfRenderer.ts:20` expose l'ancien rendu direct `renderPdfFromHtml(...)`.

Impact projet: le package present dans `dist/` peut fonctionner selon une
architecture ancienne, mais il ne peut pas etre regenere depuis `src/` dans
l'etat courant. La preuve packlist n'est donc pas une preuve de fidelite au code.

## Problemes eleves

### 6. Deux architectures de rendu incompatibles coexistent

Severite: Elevee

Preuves:

- `docs/architecture.md` decrit WebDriver Print, drivers et fallback gouvernes par
  `ArtifactPolicy`.
- `src/webDriverClient.ts:141` expose `printPdfWithWebDriver(...)`.
- `src/converter.ts:127-134` appelle `printPdf` avec transport WebDriver.
- `src/pdfRenderer.ts:20-35` lance un rendu PDF direct via navigateur.
- `src/pdfRenderer.ts:266-274` gere encore une commande navigateur locale.

Impact projet: les garanties de l'architecture cible et celles de l'ancien
chemin runtime ne sont pas les memes. Cela brouille la responsabilite entre
WebDriver, fallback, provisioning et rendu direct.

### 7. Aucun driver ou fallback navigateur reel n'est declare comme artifact utilisable

Severite: Elevee

Preuves:

- `artifacts.json:5-30` ne declare que deux stylesheets.
- `artifacts.json` liste les drivers et le fallback seulement dans
  `plannedArtifactClasses`, pas comme releases avec chemin utilisable.
- `src/browserLocator.ts:333-362` cherche une release de `chromedriver` ou
  `geckodriver`, puis exige `release.path`.

Impact projet: le chemin navigateur reel ne peut pas satisfaire les exigences
Stream B P2/P3 avec le catalogue actuel.

### 8. Le runtime driver ne verifie pas le checksum du WebDriver local avant usage

Severite: Elevee

Preuves:

- `src/artifactPolicy.ts:92-98` verifie seulement que la release declare un
  sha256 et une taille.
- `src/browserLocator.ts:357-362` accepte le driver si le fichier existe et est
  executable.
- `src/fallbackBrowserProvisioner.ts:239-243` verifie explicitement le sha256 et
  la taille pour le fallback archive, ce qui n'a pas d'equivalent visible pour
  le driver local selectionne par `ArtifactPolicyDriverResolver`.

Impact projet: la frontiere supply-chain runtime n'applique pas visiblement le
meme niveau d'integrite selon le type d'artifact.

### 9. Le modele de waiver n'est pas partage entre le checker repo et le runtime

Severite: Elevee

Preuves:

- `ARTIFACT_FRESHNESS_POLICY.md` definit une waiver comme seule exception.
- `scripts/checkArtifactFreshness.mjs:258-320` implemente des controles de waiver
  pour le lock npm.
- `src/artifactPolicy.ts:31-53` selectionne uniquement parmi des releases
  eligibles par date, sans entree waiver.

Impact projet: le comportement repo et le comportement runtime peuvent diverger
sur une exception pourtant definie comme politique globale.

### 10. La preuve FR-20 est marquee `pass` mais reste une simulation

Severite: Elevee

Preuves:

- `docs/project_requirements.md` definit FR-20 comme disponibilite system-scope
  pour chaque compte utilisateur.
- `docs/release-evidence/fr-20-system-scope.md:39` note `n/a` pour le mecanisme
  d'elevation.
- `docs/release-evidence/fr-20-system-scope.md:55` indique qu'aucun vrai second
  compte Windows et aucune installation host-wide n'ont ete utilises.
- `docs/release-evidence/fr-20-system-scope.md:100` reconnait que la propagation
  host-wide ACL n'est pas prouvee.
- `docs/release-evidence/release-checklist-v0.1.2.md:88-91` marque pourtant FR-20
  en `pass`.

Impact projet: l'exigence system-scope n'est pas demontree par la preuve
existante.

### 11. Les tests navigateur reels peuvent etre skippes

Severite: Elevee

Preuves:

- `tests/integration/browserBackedConversion.test.ts:9-10` transforme
  `MD2PDF_SKIP_REAL_BROWSER_TESTS=1` en `it.skip`.
- `docs/release-evidence/release-checklist-v0.1.2.md:67` garde les tests
  browser-backed en `blocked`.
- `docs/release-evidence/release-checklist-v0.1.2.md:149` liste encore le vrai
  rendu navigateur/Mermaid comme item bloquant.

Impact projet: une execution locale peut donner une impression de progression
sans constituer une preuve release pour FR-24/NFR-02.

### 12. Le smoke Mermaid reel est trop faible pour prouver FR-24

Severite: Elevee

Preuves:

- `tests/integration/real-browser-mermaid.test.ts:42-44` verifie seulement que le
  PDF commence par `%PDF-` et depasse 1000 octets.
- Le plan Stream B demande absence du texte Mermaid brut dans le PDF et presence
  d'un objet image ou vectoriel.

Impact projet: ce smoke peut passer avec un PDF valide sans prouver que Mermaid
est rendu comme diagramme.

### 13. Les assertions PDF reposent sur du texte brut fragile

Severite: Elevee

Preuves:

- `tests/integration/browserBackedConversion.test.ts:71-74` convertit le PDF en
  `latin1` et cherche l'absence de snippets Mermaid bruts.
- `tests/integration/browserBackedConversion.test.ts:122-130` cherche du texte PDF
  directement dans les octets.
- `tests/integration/browserBackedConversion.test.ts:136-139` detecte les objets
  visuels par regex sur le flux PDF brut.

Impact projet: les preuves peuvent varier selon compression, navigateur, format
interne du PDF ou police, sans prouver de facon robuste le rendu attendu.

### 14. La frontiere provisioning/conversion NFR-02 est ambigue dans le code

Severite: Elevee

Preuves:

- Le plan Stream B demande que le provisioning se termine avant la conversion et
  que le provisioning ne lise jamais le Markdown.
- `src/converter.ts:84-87` lit le Markdown avant `browserLocatorFactory(...).locate()`.
- `src/converter.ts:175-186` construit le locator avec policy/catalog/fallback
  pouvant mener au provisioning.

Impact projet: l'ordre observe ne prouve pas clairement la separation
provisioning reseau / conversion local-only attendue.

### 15. Le script `test:all` ne couvre pas tous les gates de release

Severite: Elevee

Preuves:

- `package.json:44` definit `test:all` comme `vitest run --reporter=verbose &&
  vitest run --config vitest.browser.config.ts`.
- La definition de fini v0.1.2 exige aussi typecheck, `check:artifacts`, build,
  contrats, artifacts et preuves browser/CI.

Impact projet: le nom `test:all` donne une couverture plus large que celle qu'il
execute vraiment.

### 16. `prepack` ne bloque pas sur les tests

Severite: Elevee

Preuves:

- `package.json:37` execute seulement `npm run build && npm run check:artifacts`.
- Les plans P4 demandent explicitement build, tests, check artifacts et pack.

Impact projet: une regression test peut ne pas bloquer le packaging si build et
artifact gate passent.

## Problemes moyens

### 17. Les modules depassent fortement les limites documentees

Severite: Moyenne

Preuves:

- `docs/architecture.md` annonce des modules sous 300 lignes et des fonctions
  courtes.
- Mesure observee: `src/browserLocator.ts` environ 740 lignes,
  `src/fallbackBrowserProvisioner.ts` environ 611 lignes,
  `src/webDriverClient.ts` environ 488 lignes,
  `src/markdownRenderer.ts` environ 435 lignes,
  `src/pdfRenderer.ts` environ 321 lignes.

Impact projet: les responsabilites detection, probing, policy, transport,
cache, extraction, rendu Mermaid et nettoyage sont concentrees dans de gros
modules, contrairement a l'architecture documentee.

### 18. La resolution de jobs modifie deja le filesystem

Severite: Moyenne

Preuves:

- `src/paths.ts:19-30` expose `resolveConversionJobs(...)`.
- `src/paths.ts:28` appelle `createOutputParents(jobs)`.
- `src/paths.ts:197-200` cree les dossiers parents et teste l'ecriture.
- `src/pipeline.ts:38-41` appelle cette resolution avant la conversion.
- `src/pipeline.ts:63-68` decide ensuite seulement l'overwrite/skip.

Impact projet: une couche nommee resolution/preflight a des effets de bord sur
le disque avant certaines decisions de conversion.

### 19. La documentation de structure de tests ne correspond pas au depot

Severite: Moyenne

Preuves:

- `docs/architecture.md` annonce `tests/contract/`.
- Le depot contient `tests/unit/contracts`, `tests/unit/cli` et
  `tests/integration`, pas `tests/contract/`.

Impact projet: la matrice de validation documentee ne reflete pas exactement
l'organisation reelle.

### 20. Certaines decisions defensives restent `pending` dans la checklist alors que des tests existent

Severite: Moyenne

Preuves:

- `docs/release-evidence/release-checklist-v0.1.2.md:122` marque output parent
  non-writable en `pending`.
- `docs/release-evidence/release-checklist-v0.1.2.md:123` marque skipped outputs
  en `pending`.
- `tests/unit/paths/paths.test.ts` contient un test parent non-writable.
- `tests/unit/cli/cli.test.ts` contient un test de skip non-interactif dans le
  summary.

Impact projet: la checklist ne reflete pas la couverture test actuelle et perd
sa valeur de source d'etat.

### 21. Le checker artifact freshness est peu teste par rapport a ses chemins critiques

Severite: Moyenne

Preuves:

- `scripts/checkArtifactFreshness.mjs:258-320` contient la logique waiver.
- `scripts/checkArtifactFreshness.mjs:464-490` controle forme des releases.
- `scripts/checkArtifactFreshness.mjs:517-560` regenere le lock npm avec
  `--before`.
- `scripts/checkArtifactFreshness.mjs:563-582` controle les fichiers policy.
- `tests/unit/artifacts/artifactFreshness.test.ts` couvre surtout le filtre de
  chemins staged et deux cas waiver.

Impact projet: des chemins importants de la policy peuvent regresser sans
couverture unitaire directe.

### 22. Le contrat d'erreur C0 documente n'est plus complet dans le code

Severite: Moyenne

Preuves:

- Le plan v0.1.2 inclut `not-implemented` et `NotImplementedError` dans le
  contrat C0.
- `src/errors.ts:1-7` liste les kinds `usage`, `input`, `conversion`, `render`,
  `browser`, `artifact`, sans `not-implemented`.
- `src/errors.ts:37-70` definit les classes d'erreur sans `NotImplementedError`.

Impact projet: le contrat C0 documente et le contrat code divergent.

## Problemes de coherence documentation/preuves

### 23. README et checklist disent que Stream A strict est limite, mais le package expose une implementation globale

Severite: Moyenne

Preuves:

- `README.md:14-22` dit que Stream A strict couvre CLI/packaging et que le rendu
  browser/Mermaid reste a fermer par Stream B/global release.
- `package.json:22-23` expose pourtant `dist/cli.js` comme binaire package.
- `src/cli.ts` branche le runtime converter par defaut via `convertFile`.

Impact projet: la communication de statut et la surface executable publiee ne
sont pas clairement alignees.

### 24. La release est deja marquee avec tarball et shasum malgre les gates rouges

Severite: Moyenne

Preuves:

- `docs/release-evidence/release-checklist-v0.1.2.md:26` reference
  `md2pdf-0.1.2.tgz`, shasum et integrity.
- Le build courant echoue via `typecheck`.
- `check:artifacts` echoue sur `assets/default.css`.

Impact projet: les preuves pack/tarball peuvent etre interpretees comme un etat
release alors que le code source courant ne satisfait pas les gates.

## Synthese des blocages

Etat global observe: `NO-GO` pour v0.1.2 globale.

Blocages principaux:

1. Le code TypeScript courant ne compile pas.
2. Le contrat C0 ne s'importe plus.
3. Les tests unitaires globaux, contractuels et browser echouent.
4. Le gate artifact freshness echoue.
5. `dist/` est stale par rapport a `src/`.
6. Les preuves release sont partiellement obsoletes ou simulees.
7. Le vrai rendu navigateur/Mermaid et la matrice CI/browser restent non prouves.
8. La structure runtime contient deux chemins de rendu concurrents.

Ce rapport ne propose pas de remediation.
