# Audit Phase 8 - Packaging, dist et installation

Date: 2026-06-15

Perimetre: implementation courante de la Phase 8 du plan
`docs/post-audit-remediation-plan-2026-06-12.md`, section "Phase 8 -
Packaging, dist et installation".

Verdict global: **FAIL Phase 8**.

La preuve de packaging n'est pas reproductible depuis l'etat courant du depot:
`npm.cmd pack --dry-run --json --cache .tmp/npm-cache` rejoue `prepack`, passe
les gates qu'il lance, mais produit une packlist de 66 entrees incluant
`dist/pdfRenderer.*`. La checklist Phase 8 annonce un tarball de 62 fichiers et
affirme que `dist/pdfRenderer.*` n'est pas regenere. Ces deux affirmations ne
tiennent pas face au pack dry-run courant.

## Sources et methode

- Source d'exigence: `docs/post-audit-remediation-plan-2026-06-12.md:377` a
  `docs/post-audit-remediation-plan-2026-06-12.md:412`.
- Graphe: `graphify-out/graph.json` consulte en fallback direct, car la
  commande `graphify query` n'etait pas disponible dans le PATH PowerShell.
- Agents utilises: trois agents de revue read-only sur packaging, preuves
  documentaires et strategie de tests.
- Commandes executees:
  - `npm.cmd run typecheck`: PASS.
  - `npm.cmd run check:artifacts`: PASS.
  - `npm.cmd test -- --run tests/unit/cli/cli.test.ts`: PASS, 22 passed,
    1 skipped.
  - `npm.cmd pack --dry-run --json --ignore-scripts --cache .tmp/npm-cache`:
    PASS, 66 entrees, `dist/pdfRenderer.*` present.
  - `npm.cmd pack --dry-run --json --cache .tmp/npm-cache`: PASS, `prepack`
    rejoue `build`, `npm test`, `check:artifacts`; resultat 66 entrees,
    `dist/pdfRenderer.*` present.
  - `tar -tf md2pdf-0.1.2.tgz`: tarball existant a 62 entrees et n'inclut pas
    `dist/pdfRenderer.*`.

## Couverture des exigences Phase 8

| Exigence Phase 8 | Statut | Evidence | Probleme |
| --- | --- | --- | --- |
| `dist/` doit venir d'un build courant | FAIL | `package.json:36`, `tsconfig.json:6`, dry-run pack avec scripts | `tsc` ecrit dans `dist/` mais ne nettoie pas les sorties orphelines; `dist/pdfRenderer.*` reste publiable. |
| Aucune decision ne doit etre derivee de l'ancien `dist/` | FAIL | `dist/pdfRenderer.js` present; dry-run pack inclut `dist/pdfRenderer.d.ts`, `.map`, `.js`, `.js.map` | Le package rejoue depuis le repertoire courant derive encore sa packlist d'un ancien artefact `dist`. |
| `prepack` ne doit pas permettre un package avec tests essentiels rouges | PARTIAL | `package.json:37`, `vitest.config.ts:5`-`6`, `package.json:42`-`44` | `prepack` lance build, unit tests et artifact gate, mais omet les gates browser/real-browser que `test:all` promet. La notion de tests essentiels n'est pas documentee. |
| `test:all` ne doit pas promettre plus que ce qu'il execute | PASS script / PARTIAL Phase 8 | `package.json:44` | Le script execute bien ce qu'il annonce, mais il ne couvre pas packlist, temp install, installed-bin smoke, ni reinstall. |
| Rejouer build/tests/artifact gate/packlist/install/reinstall | FAIL preuve | `docs/release-evidence/release-checklist-v0.1.2.md:156`-`159` | La checklist pointe un tarball 62 fichiers, mais le pack courant rejoue a 66 fichiers; install/reinstall prouvent donc un artefact different de celui qui serait regenere maintenant. |
| `bin.md2pdf` pointe vers le build courant | PARTIAL | `package.json:22`-`23`, `src/cli.ts:253`-`269`, `dist/cli.js:180`-`194` apres dry-run | Le mapping existe, mais la preuve versionnee ne capture pas le shim/symlink installe ni le packlist complet. |
| Limite Windows PowerShell vs `.cmd` documentee | PASS doc / PARTIAL test | `README.md:66`-`81`; tentative `npm pack` via `npm` bloquee par `npm.ps1` | La limitation est documentee, mais aucun test Windows ne verifie `md2pdf.cmd --help` ou le comportement PowerShell. |

## Findings

### P1 - Le pack courant embarque encore l'ancien `dist/pdfRenderer.*`

Severity: High

Fichiers:

- `docs/post-audit-remediation-plan-2026-06-12.md:383`-`385`
- `docs/post-audit-remediation-plan-2026-06-12.md:403`
- `package.json:25`-`27`
- `package.json:36`
- `tsconfig.json:6`-`17`

Probleme:

La Phase 8 exige que `dist/` vienne d'un build courant et que le tarball
provienne du source courant. Le script `build` est seulement `tsc`. Avec
`outDir: "dist"`, TypeScript regenere les sorties des fichiers source courants,
mais ne supprime pas les fichiers correspondant a des sources retirees.

Preuve:

- `src/pdfRenderer.ts` n'existe pas dans `src/`.
- `dist/pdfRenderer.js`, `dist/pdfRenderer.d.ts`, `dist/pdfRenderer.js.map` et
  `dist/pdfRenderer.d.ts.map` existent toujours.
- `dist/pdfRenderer.js.map:1` reference encore `../src/pdfRenderer.ts`.
- `npm.cmd pack --dry-run --json --cache .tmp/npm-cache` rejoue `prepack` puis
  annonce `entryCount: 66` avec les quatre fichiers `dist/pdfRenderer.*`.
- Le plan classe explicitement `dist/` stale et `dist/pdfRenderer.js` comme
  dette a traiter en Phase 2/8 (`docs/post-audit-remediation-plan-2026-06-12.md:144`,
  `docs/post-audit-remediation-plan-2026-06-12.md:521`).

Risque:

Un nouveau package genere depuis le depot courant republie un ancien chemin de
rendu direct supprime du source. Cela casse l'objectif de Phase 8: le package ne
correspond plus strictement au source courant.

Correctif suggere:

Faire du build de packaging un build propre: supprimer `dist/` avant `tsc`, ou
ajouter un script dedie `clean`/`build:clean`, puis faire echouer `prepack` si
des fichiers `dist/*.js` n'ont pas de source `src/*.ts` correspondante.

Test/preuve necessaire:

Un test ou script de release doit lancer le build propre, puis verifier que la
packlist ne contient aucun fichier orphelin comme `dist/pdfRenderer.*`.

### P1 - La checklist Phase 8 prouve un tarball different de celui qui serait regenere maintenant

Severity: High

Fichiers:

- `docs/release-evidence/release-checklist-v0.1.2.md:31`-`32`
- `docs/release-evidence/release-checklist-v0.1.2.md:55`-`56`
- `docs/release-evidence/release-checklist-v0.1.2.md:156`-`159`
- `docs/release-evidence/README.md:35`-`46`
- `docs/release-evidence/README.md:88`-`89`

Probleme:

La checklist annonce que le tarball Phase 8 courant `md2pdf-0.1.2.tgz` a 62
fichiers et que `dist/` a ete regenere depuis `src/` sans `dist/pdfRenderer.*`.
Or le pack dry-run courant avec scripts produit un artefact different:
`entryCount: 66`, shasum `6186bf6eadf183ee380bf99744151edf6cc3c88e`, et
`dist/pdfRenderer.*` inclus.

Preuve:

- `tar -tf md2pdf-0.1.2.tgz` compte 62 entrees et ne contient pas
  `dist/pdfRenderer.*`.
- `npm.cmd pack --dry-run --json --cache .tmp/npm-cache` compte 66 entrees et
  contient `dist/pdfRenderer.*`.
- La checklist declare pourtant le packaging et la distribution en `pass`
  (`docs/release-evidence/release-checklist-v0.1.2.md:81`,
  `docs/release-evidence/release-checklist-v0.1.2.md:156`-`159`).

Risque:

Les preuves user-scope install et reinstall valident le tarball archive, pas le
package qui serait produit aujourd'hui par le depot courant. Une release
effectuee maintenant peut diverger de la preuve documentee.

Correctif suggere:

Regenerer le tarball apres build propre, capturer le `npm pack --json` complet
dans les preuves de release, puis rejouer install et reinstall sur ce meme
tarball. Ne pas marquer `pass` si le pack dry-run courant diverge du tarball
documente.

Test/preuve necessaire:

Ajouter une preuve versionnee avec commande, environnement, resultat attendu,
resultat observe et packlist complete, conformement a
`docs/release-evidence/README.md:35`-`46`.

### P2 - `prepack` ne couvre pas le meme perimetre que `test:all`

Severity: Medium

Fichiers:

- `docs/post-audit-remediation-plan-2026-06-12.md:387`-`389`
- `package.json:37`
- `package.json:42`-`44`
- `vitest.config.ts:5`-`6`

Probleme:

`prepack` lance `npm run build && npm test && npm run check:artifacts`.
`npm test` exclut les tests d'integration (`vitest.config.ts:6`). Les gates
browser et real-browser sont dans `test:browser` et `test:real-browser`, et
`test:all` les execute. Si ces gates sont consideres essentiels pour le package
browser-backed Phase 8, `prepack` peut encore produire un package quand ils sont
rouges.

Preuve:

Le dry-run avec scripts a montre que `prepack` execute seulement:

- `npm run build`
- `npm test`
- `npm run check:artifacts`

Il n'a pas execute `npm run typecheck`, `npm run test:browser`,
`npm run test:real-browser`, ni `npm run test:all` directement. `build` couvre
le typecheck via `tsc`, mais pas les gates navigateur.

Risque:

La frontiere de packaging peut rester verte alors que le chemin browser-backed
qui justifie le package v0.1.2 est casse.

Correctif suggere:

Definir explicitement les "tests essentiels" pour `prepack`. Si le package ne
doit sortir qu'apres browser evidence locale, faire pointer `prepack` vers un
script release dedie qui inclut ces gates ou documenter pourquoi ils restent
hors `prepack`.

Test/preuve necessaire:

Un test de contrat sur `package.json` ou un script `check:package-scripts` doit
echouer si `prepack` perd un gate declare essentiel.

### P2 - Aucune regression automatisee ne protege packlist, install et reinstall

Severity: Medium

Fichiers:

- `docs/post-audit-remediation-plan-2026-06-12.md:390`-`397`
- `package.json:44`
- `docs/release-evidence/release-checklist-v0.1.2.md:156`-`159`

Probleme:

La Phase 8 demande de rejouer packlist, installation user-scope temporaire,
reinstall idempotente et verification de `bin.md2pdf`. Ces preuves existent
sous forme de resume dans la checklist, mais aucun test ni script de validation
ne les garde contre une regression. `test:all` execute beaucoup de gates utiles,
mais pas `npm pack`, pas d'assertion de packlist, pas d'installation dans un
prefix temporaire, pas de smoke du binaire installe, et pas de reinstall.

Preuve:

La recherche dans `tests`, `scripts` et `package.json` ne montre pas de test ou
script dedie a `npm pack`, `npm install --global --prefix`, packlist,
install/reinstall ou execution du `dist/cli.js` package. Les tests CLI importent
`../../../src/cli.js`, donc ils protegent le source, pas le package installe.

Risque:

Le bug detecte dans cet audit (`dist/pdfRenderer.*` reapparait dans la packlist
courante) aurait pu etre bloque automatiquement par une simple assertion de
packlist. Aujourd'hui, il faut refaire l'audit ou relire manuellement la sortie
`npm pack --json` pour le voir.

Correctif suggere:

Ajouter un script de smoke packaging, par exemple `check:package`, qui lance
`npm pack --json` dans un cache local, verifie la liste exacte des fichiers,
installe le tarball dans un prefix temporaire, execute le binaire installe,
reinstalle le meme tarball et reexecute le binaire.

Test/preuve necessaire:

Faire entrer ce script dans le gate de release local, ou documenter explicitement
qu'il reste une preuve manuelle a rejouer avant chaque tarball.

### P2 - La preuve `bin.md2pdf` reste surtout un smoke test, pas une preuve de cible installee

Severity: Medium

Fichiers:

- `docs/post-audit-remediation-plan-2026-06-12.md:397`
- `package.json:22`-`23`
- `docs/release-evidence/release-checklist-v0.1.2.md:158`
- `docs/release-evidence/release-checklist-v0.1.2.md:165`
- `tests/unit/cli/cli.test.ts:21`
- `tests/unit/cli/cli.test.ts:148`-`156`

Probleme:

La checklist prouve que `.tmp/phase8-final-prefix/bin/md2pdf --help` a imprime
l'aide, mais elle ne capture pas la cible du shim/symlink installe. Le test de
regression du symlink npm est utile, mais il est saute sur Windows
(`itOnPosix`) et teste la fonction importee depuis `src`, pas un package
installe.

Preuve:

- `npm.cmd test -- --run tests/unit/cli/cli.test.ts`: PASS, mais le test
  `@req FR-19 treats an npm bin symlink as the direct CLI entrypoint` est
  `skipped` sur Windows.
- `package.json` declare bien `"md2pdf": "./dist/cli.js"`, mais la preuve
  d'installation ne documente pas la resolution du shim vers cette cible.

Risque:

Une regression specifique a npm shim, `.cmd`, `.ps1`, symlink POSIX ou cible
installee peut passer la suite de tests courante et rester decouverte seulement
lors d'un smoke manuel tardif.

Correctif suggere:

Ajouter une preuve automatisee de packaging qui installe le tarball dans un
prefix temporaire, inspecte la cible du shim/symlink quand la plateforme le
permet, puis execute `md2pdf --help` via le chemin installe.

Test/preuve necessaire:

Sur Windows, verifier explicitement `md2pdf.cmd --help` via `cmd.exe`; sur
POSIX, verifier que le symlink installe pointe vers le `dist/cli.js` du package.

### P3 - Les preuves Phase 8 manquent de metadata suffisante

Severity: Low

Fichiers:

- `docs/release-evidence/README.md:4`-`6`
- `docs/release-evidence/README.md:35`-`46`
- `docs/release-evidence/README.md:72`-`82`
- `docs/release-evidence/release-checklist-v0.1.2.md:48`-`56`

Probleme:

Les lignes Phase 8 de la checklist contiennent des resumes `pass`, mais ne
capturent pas toutes les informations attendues: OS exact, Node/npm, commande
complete, resultat attendu, resultat observe et packlist complete.

Risque:

Un lecteur ne peut pas reconstituer l'evidence de release depuis le depot seul
sans faire confiance a un resume. C'est fragile pour une phase qui porte
explicitement sur la reproductibilite du package.

Correctif suggere:

Ajouter une preuve Phase 8 dediee sous `docs/release-evidence/` avec la sortie
complete ou resumee mais exhaustive de `npm pack --json`, les versions
Node/npm/OS, et les commandes install/reinstall exactes.

## Points conformes

- `package.json:44` rend `test:all` honnete sur ce qu'il execute: typecheck,
  unit tests, artifact tests, artifact freshness, build, browser integration et
  real-browser smoke.
- La limitation Windows PowerShell vs `.cmd` est documentee dans `README.md:66`
  a `README.md:81`; elle a aussi ete observee pendant l'audit lorsque `npm`
  a ete bloque par `npm.ps1`, puis contournee avec `npm.cmd`.
- Le tarball archive `md2pdf-0.1.2.tgz` contient bien 62 entrees et n'embarque
  pas `dist/pdfRenderer.*`; le probleme est qu'il ne correspond pas au pack
  regenerable depuis l'etat courant.

## Validation executee pendant l'audit

```text
npm.cmd run typecheck
=> PASS

npm.cmd run check:artifacts
=> PASS, Artifact freshness policy passed.

npm.cmd test -- --run tests/unit/cli/cli.test.ts
=> PASS, 22 passed, 1 skipped.

npm.cmd pack --dry-run --json --cache .tmp/npm-cache
=> PASS, prepack rejoue build/test/check:artifacts; entryCount 66;
   dist/pdfRenderer.d.ts, dist/pdfRenderer.d.ts.map,
   dist/pdfRenderer.js, dist/pdfRenderer.js.map presents.

tar -tf md2pdf-0.1.2.tgz
=> 62 entrees; dist/pdfRenderer.* absent.
```

## Questions ouvertes

- Les gates `test:browser` et `test:real-browser` sont-ils officiellement des
  tests essentiels pour `prepack`, ou seulement pour `test:all` et la preuve
  release locale?
- Le tarball `md2pdf-0.1.2.tgz` doit-il rester un artefact commite dans le
  depot, ou seulement une preuve de release regeneree et referencee?

## Conclusion

La Phase 8 ne peut pas etre acceptee telle quelle. Le probleme bloquant est
simple: un packaging rejoue maintenant ne produit pas le tarball documente et
inclut encore l'ancien artefact `dist/pdfRenderer.*`. Tant que `dist/` n'est pas
nettoye avant build et que la packlist complete n'est pas versionnee comme
preuve, les lignes `pass` de packaging/install/reinstall surestiment la
conformite reelle.
