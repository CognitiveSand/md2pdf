# Audit Stream A - reste a faire - 2026-06-11

Verdict: **Stream A est largement implemente sur P1/P2, P3 est prouve par un
contrat d'integration deterministe, P4 packaging utilisateur est couvert, mais
Stream A ne doit pas encore etre declare complet pour une release.**

Les blocages restants sont surtout des blocages de preuve et d'alignement:
preuve avec navigateur reel et Mermaid, FR-20 system-scope, CI matrix, README /
architecture en avance sur le code, et decision explicite sur la frontiere
Stream A / Stream B autour de `browserLocator.ts` et `pdfRenderer.ts`.

## Sources inspectees

- `ARTIFACT_FRESHNESS_POLICY.md`
- `docs/plan_stream_a.md`
- `docs/stream-a-implementation-plan-2026-06-08.md`
- `docs/release-evidence/release-checklist-v0.1.2.md`
- `docs/release-evidence/fr-20-system-scope.md`
- `docs/architecture.md`
- `README.md`
- Audits Stream A du 2026-06-05 au 2026-06-09 sous `audit/`
- Code Stream A et runtime: `src/cli.ts`, `src/paths.ts`,
  `src/pipeline.ts`, `src/overwrite.ts`, `src/converter.ts`,
  `src/pdfRenderer.ts`, `src/browserLocator.ts`,
  `src/markdownRenderer.ts`, `src/fallbackBrowserProvisioner.ts`
- Tests: `tests/unit/**`, `tests/integration/cli-pdf.test.ts`

## Etat d'avancement Stream A

| Phase / objectif | Statut actuel | Evidence | Probleme restant |
| --- | --- | --- | --- |
| P1 CLI, paths, preflight | **Accepte** | `src/cli.ts:50`, `src/paths.ts`, `src/pipeline.ts`; tests unitaires Stream A P1 verts | Aucun blocage observe. |
| P2 overwrite, batch, permissions preflight | **Accepte** | `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run test:contracts`, `npm.cmd run check:artifacts` passent; audit `2026-06-08-stream-a-phase1-point2-p2-global-audit.md` | Aucun blocage P2 actuel. |
| Phase 3 runtime converter | **Prepare / implemente** | `src/contracts.ts:21` re-exporte `convertFile`; `src/converter.ts:15` expose le converter; `src/converter.ts:27` appelle `withTempHtml`; `src/converter.ts:7` branche `renderPdfFromHtml` | Le statut final depend du niveau de preuve attendu: fake-browser contract ou vrai navigateur. |
| Phase 4 integration P3 | **Passe en integration deterministe** | `npm.cmd run test:browser` passe: 1 fichier, 10 tests; `tests/integration/cli-pdf.test.ts:37`, `:119`, `:132`, `:149` | Ne prouve pas un navigateur installe reel ni Mermaid rendu en diagramme. |
| Phase 5 late write protections | **Implemente** | `src/pdfRenderer.ts:31-34`, `src/pdfRenderer.ts:128-136`; tests integration tardifs `tests/integration/cli-pdf.test.ts:132-180` | Les ACL / locks OS reels restent hors couverture. |
| Phase 6 packaging user-scope | **Couvert localement** | `npm.cmd run build` passe; `npm.cmd pack --json` passe; `package.json:22` mappe `bin.md2pdf` vers `./dist/cli.js`; audit `2026-06-09-stream-a-phase6-packaging-install-audit.md` | La preuve system-scope FR-20 reste absente; PowerShell shim caveat non resolu dans docs finales. |
| Phase 7 FR-20 et README/help | **Non termine** | `docs/release-evidence/fr-20-system-scope.md:6` et `:16-21` restent `pending`; `release-checklist-v0.1.2.md:88-91`, `:107-108` restent `pending` | Bloque la declaration Stream A complete / release-ready. |
| Gates finales Stream A | **Partiellement rejouees** | Toutes les commandes finales automatiques listees au plan ont ete lancees avec succes sauf preuve CI/system-scope manuelle | `CI matrix`, FR-20 et navigateur reel ne sont pas fermes. |

## Negative Findings

### 1. La preuve P3 actuelle ne prouve pas le vrai rendu navigateur utilisateur

Severity: **High**

Files:
- `tests/integration/cli-pdf.test.ts`
- `docs/release-evidence/release-checklist-v0.1.2.md`

Lines:
- `tests/integration/cli-pdf.test.ts:15`
- `tests/integration/cli-pdf.test.ts:203`
- `tests/integration/cli-pdf.test.ts:206`
- `tests/integration/cli-pdf.test.ts:234`
- `docs/release-evidence/release-checklist-v0.1.2.md:67`

Problem: `test:browser` passe avec un faux navigateur cree par le test. Ce faux
navigateur ecrit un PDF minimal et les assertions verifient principalement le
header `%PDF-`. Le contrat CLI -> converter -> renderer est utilement couvert,
mais il ne prouve pas qu'un Chrome / Edge / Chromium installe charge le HTML,
applique CSS/layout, execute Mermaid, puis imprime correctement.

Risk: Stream A peut etre declare P3 complet alors que l'experience utilisateur
reelle reste non prouvee. Un navigateur absent, incompatible, bloque par le
systeme, ou trop rapide sur l'impression Mermaid peut passer sous les radars.

Evidence: la checklist garde explicitement `Browser-backed tests` en `blocked`
a `docs/release-evidence/release-checklist-v0.1.2.md:67`.

Suggested fix: ajouter une gate separee avec navigateur installe reel, fixture
Markdown representative, et assertion plus forte que `%PDF-`. La preuve Mermaid
doit verifier le rendu en diagramme ou accepter explicitement que Mermaid reste
hors scope release.

Test needed: test navigateur reel sur au moins un navigateur supporte, puis
matrix CI ou smoke manuel documente.

### 2. Mermaid est asynchrone, mais `pdfRenderer` imprime sans attendre son etat

Severity: **High**

Files:
- `src/pdfRenderer.ts`
- `src/markdownRenderer.ts`
- `docs/architecture.md`

Lines:
- `src/pdfRenderer.ts:65`
- `src/pdfRenderer.ts:72`
- `src/markdownRenderer.ts:337`
- `src/markdownRenderer.ts:342-345`
- `docs/architecture.md:92-93`

Problem: le HTML marque `document.documentElement.dataset.mermaidStatus` a
`done` apres `await mermaid.run(...)`, mais le renderer lance directement le
navigateur avec `--print-to-pdf`. Il n'y a pas de boucle WebDriver, CDP, ou
equivalent pour attendre `mermaidStatus === "done"` avant l'impression.

Risk: un vrai navigateur peut imprimer avant la fin du rendu Mermaid. La sortie
peut contenir du texte brut, une zone vide, ou un rendu intermittent.

Evidence: l'architecture promet une attente Mermaid avant print
(`docs/architecture.md:92-93`), mais `src/pdfRenderer.ts:65-72` lance seulement
le print direct.

Suggested fix: soit implementer un controle navigateur capable d'attendre
Mermaid, soit retirer / degrader la promesse Mermaid de Stream A jusqu'a ce que
Stream B fournisse cette capacite.

Test needed: fixture Mermaid avec vrai navigateur et assertion que le diagramme
est rendu comme diagramme, pas comme code brut.

### 3. README et architecture documentent WebDriver / Firefox / provisioning que le code n'implemente pas

Severity: **High**

Files:
- `README.md`
- `docs/architecture.md`
- `src/browserLocator.ts`
- `src/pdfRenderer.ts`
- `src/fallbackBrowserProvisioner.ts`

Lines:
- `README.md:21`
- `README.md:28-30`
- `README.md:130-131`
- `docs/architecture.md:16`, `:39-42`, `:165-166`, `:282-288`
- `src/browserLocator.ts:38`
- `src/pdfRenderer.ts:65-72`
- `src/fallbackBrowserProvisioner.ts:16-19`

Problem: les docs disent WebDriver, Firefox, drivers compatibles et fallback
Chromium-for-Testing. Le code actuel localise Chrome / Chromium / Edge ou
`MD2PDF_BROWSER`, lance `--print-to-pdf`, et le fallback provisioner reste un
`NotImplementedError`.

Risk: un utilisateur ou reviewer peut installer Firefox/geckodriver ou attendre
un fallback provisionne, puis obtenir un comportement absent. Cela peut aussi
masquer la vraie definition de "Stream A complet".

Evidence: `src/browserLocator.ts:38` demande d'installer Chrome, Chromium ou
Edge; `src/pdfRenderer.ts:65-72` spawn un executable avec `--print-to-pdf`;
`src/fallbackBrowserProvisioner.ts:16-19` throw encore
`NotImplementedError`.

Suggested fix: Phase 7 doit aligner README et architecture sur le runtime
accepte, ou bien l'implementation doit rattraper les promesses WebDriver /
Firefox / fallback avant declaration finale.

Test needed: comparaison README/help plus test navigateur reel par famille si
Firefox/WebDriver reste supporte.

### 4. FR-20 system-scope est encore entierement pending

Severity: **High**

Files:
- `docs/release-evidence/fr-20-system-scope.md`
- `docs/release-evidence/release-checklist-v0.1.2.md`

Lines:
- `docs/release-evidence/fr-20-system-scope.md:6`
- `docs/release-evidence/fr-20-system-scope.md:16-21`
- `docs/release-evidence/fr-20-system-scope.md:37-40`
- `docs/release-evidence/fr-20-system-scope.md:51-55`
- `docs/release-evidence/fr-20-system-scope.md:89-93`
- `docs/release-evidence/release-checklist-v0.1.2.md:88-91`

Problem: la preuve FR-20 ne contient encore que des placeholders `pending`.
Phase 6 couvre un install user-scope temporaire, pas l'invocabilite system-scope
par compte utilisateur.

Risk: Stream A P4 / release-ready ne peut pas etre accepte tant que FR-20 reste
non prouve. Le risque est plus fort sur Windows a cause du shim PowerShell
signale par l'audit Phase 6.

Evidence: `release-checklist-v0.1.2.md:88-91` garde toutes les lignes FR-20 en
`pending`.

Suggested fix: executer ou documenter une simulation valide system-scope:
version, commit, tarball, OS, Node/npm, commande d'installation, resolution par
nom (`where md2pdf` ou equivalent), sortie exacte `md2pdf --help`, compte teste,
et statut final.

Test needed: smoke system-scope ou simulation approuvee, incluant le cas
PowerShell / `.cmd` sous Windows.

### 5. La frontiere Stream A / Stream B est devenue ambigue

Severity: **Medium**

Files:
- `docs/stream-a-implementation-plan-2026-06-08.md`
- `src/browserLocator.ts`
- `src/pdfRenderer.ts`

Lines:
- `docs/stream-a-implementation-plan-2026-06-08.md:126-130`

Problem: le plan dit que Stream A orchestre et ne reimplemente pas
`browserLocator`, `webDriverClient`, `pdfRenderer`, `artifactPolicy` ou
provisioning. Le depot contient maintenant `src/browserLocator.ts` et
`src/pdfRenderer.ts`, utilises par le runtime.

Risk: si ce code est considere "Stream A", il viole la frontiere du plan. S'il
est considere "Stream B minimal", les audits Stream A doivent le dire
explicitement pour eviter une double implementation ou un remplacement non
coordonne.

Evidence: le plan pose la frontiere a
`docs/stream-a-implementation-plan-2026-06-08.md:126-130`; les modules existent
et sont appeles par `src/converter.ts:7`.

Suggested fix: ajouter une decision d'architecture: runtime Chromium
`--print-to-pdf` accepte comme implementation cible, ou glue temporaire a
remplacer par Stream B WebDriver.

Test needed: tests de contrat entre orchestration CLI et renderer pour pouvoir
remplacer le backend sans casser Stream A.

### 6. Le status release reste pending malgre les gates automatiques vertes

Severity: **Medium**

Files:
- `docs/release-evidence/release-checklist-v0.1.2.md`

Lines:
- `docs/release-evidence/release-checklist-v0.1.2.md:3`
- `docs/release-evidence/release-checklist-v0.1.2.md:21-26`
- `docs/release-evidence/release-checklist-v0.1.2.md:67`
- `docs/release-evidence/release-checklist-v0.1.2.md:69`
- `docs/release-evidence/release-checklist-v0.1.2.md:107-108`
- `docs/release-evidence/release-checklist-v0.1.2.md:146-150`

Problem: plusieurs lignes release restent `pending` ou `blocked`: metadata,
browser-backed tests, CI matrix, README options match, FR-20 help output,
decision finale.

Risk: les validations locales peuvent donner une impression de completion,
mais le dossier de release ne permet pas encore de fermer Stream A proprement.

Evidence: release status `pending` a la ligne 3 et decision finale `pending`
aux lignes 146-150.

Suggested fix: terminer Phase 7, rejouer les gates finales, puis mettre a jour
la checklist avec les preuves exactes ou des limitations explicitement
acceptees.

Test needed: audit final Stream A P3/P4 apres completion de FR-20, navigateur
reel/Mermaid ou decision de scope, README/help, CI matrix.

### 7. Validation executable du navigateur trop faible pour POSIX

Severity: **Low**

File: `src/browserLocator.ts`

Lines:
- `src/browserLocator.ts:85-91`

Problem: `isUsableExecutable` utilise `access(path)` sans verifier le bit
execute sur POSIX. Un fichier existant mais non executable peut etre accepte
comme "usable" puis echouer plus tard au spawn.

Risk: erreur tardive moins claire et selection possible d'un mauvais candidat
sur `PATH`.

Suggested fix: verifier l'executabilite lorsque la plateforme le permet, en
gardant le comportement Windows compatible.

Test needed: test POSIX `MD2PDF_BROWSER` pointant vers un fichier existant non
executable.

## Validation executee pendant cet audit

Toutes les commandes suivantes ont ete executees le 2026-06-11.

```text
npm.cmd run typecheck
PASS

npm.cmd test
PASS - 10 test files, 84 tests

npm.cmd run test:contracts
PASS - 1 test file, 10 tests

npm.cmd run check:artifacts
PASS - Artifact freshness policy passed.

npm.cmd run build
PASS

npm.cmd run test:browser
PASS - 1 integration file, 10 tests

npm.cmd pack --json
PASS - md2pdf-0.1.2.tgz
shasum fb8fc5f856797cf492e61e22c18af756e5f724b4
integrity sha512-KwRtaWNPIusd1wj/aMLAMi3HYTkeqTpY2PEgHAeLxWi8BbIYtz5KyOHSbDSE4IcMI7hvIuDuy5B4zBSINOTLXA==

node dist\cli.js --help
PASS - help output printed
```

Note: `npm.cmd run build`, `npm.cmd run test:browser`, `npm.cmd pack --json`,
et `node dist\cli.js --help` ont ete relances hors sandbox apres une erreur
Windows `spawn setup refresh`. `npm.cmd pack --json` a cree le fichier non suivi
`md2pdf-0.1.2.tgz`.

## Reste a faire recommande

1. Decider si le backend Chromium `--print-to-pdf` est la cible acceptee ou une
   glue temporaire avant WebDriver/Firefox.
2. Ajouter une preuve avec navigateur reel installe. Inclure un fixture Mermaid
   ou retirer Mermaid du scope accepte jusqu'a implementation de l'attente.
3. Corriger README et, si necessaire, `docs/architecture.md` pour ne plus
   promettre WebDriver/Firefox/provisioning tant que le code ne le fait pas.
4. Completer `docs/release-evidence/fr-20-system-scope.md` avec une execution
   system-scope ou une simulation valide.
5. Documenter le caveat Windows PowerShell `.ps1` vs `.cmd` issu de Phase 6.
6. Renseigner la checklist release: metadata, CI matrix, README/help comparison,
   FR-20 help output, final release decision.
7. Rejouer les gates finales du plan, puis faire un audit final Stream A P3/P4.

## Summary

Stream A n'est plus bloque par les anciens problemes P1/P2 ni par le
`convertFile` public stub. Le coeur CLI / paths / overwrite / pipeline passe,
le converter runtime est branche, le pack est generable, et les tests
d'integration deterministes prouvent le contrat de production PDF.

Ce qu'il reste pour "implementer Stream A" au sens release-ready n'est pas un
gros trou CLI: c'est la fermeture des preuves utilisateur finales. Tant que le
navigateur reel / Mermaid, FR-20, CI matrix, et l'alignement README /
architecture ne sont pas traites, Stream A doit rester **partiellement complete
mais non finalisable pour release**.
