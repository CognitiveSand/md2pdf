# Plan d'implementation Stream A - 2026-06-08

Ce plan consolide les derniers audits Streams A/B du 2026-06-08 et le plan
Stream A existant. Il decrit ce qu'il faut faire pour amener Stream A de l'etat
actuel a une validation P3/P4 auditable.

## Etat de depart

Statut a retenir:

- Stream A P1 est couvert par le code et les tests unitaires.
- Stream A P2 est couvert localement, mais la validation globale reste bloquee
  tant que la gate `check:artifacts` echoue.
- Stream A P3 est en cours, mais non acceptable tant que le chemin runtime
  utilise encore le stub public `convertFile`.
- Stream A P4 n'est pas implemente.
- Stream B fournit seulement le socle P1; le moteur browser/PDF complet reste
  une dependance pour la validation verticale Stream A P3.

Nuances observees dans l'etat courant du depot:

- `package.json` contient deja `test:artifacts`; le point d'audit "script
  absent" est donc deja corrige dans l'etat courant.
- `.githooks/pre-commit` et `scripts/checkArtifactFreshness.mjs` semblent deja
  traiter les chemins d'enforcement; ce point doit etre revalide, pas
  reimplemente aveuglement.
- `src/contracts.ts` expose encore `convertFile` avec un
  `NotImplementedError`, ce qui reste le blocage principal de P3 cote Stream A.

## Sources de reference

- `ARTIFACT_FRESHNESS_POLICY.md`
- `docs/plan_stream_a.md`
- `docs/implementation_plan_v0.1.2.md`
- `docs/release-evidence/release-checklist-v0.1.2.md`
- `docs/release-evidence/fr-20-system-scope.md`
- `audit/2026-06-08-stream-a-b-progress-code-audit.md`
- `audit/2026-06-08-stream-a-b-second-complete-audit.md`

## Objectif

Amener Stream A a un etat ou:

1. P2 global est validable par les gates obligatoires.
2. P3 prouve un chemin utilisateur reel `md2pdf ENTRY` vers un PDF produit.
3. P4 prouve packaging, installation, reinstall idempotent, README/help et
   evidence FR-20.

## Phase 1 - Retablir la gate P2 globale

### 1.1 Corriger le blocage artifact freshness

Blocage actuel:

- `assets/highlight.css` ne correspond pas au hash et a la taille declares dans
  `artifacts.json`.
- La policy interdit de simplement forcer ou bypasser le controle.

Travail a faire:

- Determiner quelle source est normative:
  - soit restaurer `assets/highlight.css` au contenu declare;
  - soit verifier que le contenu actuel est le newest eligible apres
    quarantaine, puis mettre a jour `artifacts.json` avec hash, taille et
    provenance exacts.
- Respecter strictement `ARTIFACT_FRESHNESS_POLICY.md`.
- Ne pas introduire d'artefact tiers nouveau sans verification newest eligible.

Validation:

```bash
npm.cmd run check:artifacts
```

### 1.2 Rejouer les gates P2 globales

Quand la gate artifact est corrigee, executer dans le meme run:

```bash
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:contracts
npm.cmd run check:artifacts
```

Critere de sortie:

- toutes les commandes passent;
- un court re-audit Stream A P2 global peut declarer P2 globalement acceptable.

## Phase 2 - Remettre les preuves P1/P2 a jour

Probleme:

- La release checklist sous-estime certains points Stream A deja couverts.
- Elle melange encore preuves unitaires, preuves P3 et preuves manuelles P4.

Travail a faire dans `docs/release-evidence/release-checklist-v0.1.2.md`:

- Marquer comme couverts par tests unitaires les points P1/P2 deja prouves:
  - dossier vide avec summary `0 succeeded, 0 failed, 0 skipped`;
  - extension `.MD` acceptee case-insensitively;
  - `--output` utilise l'extension verbatim;
  - parent output cree quand possible;
  - collisions et entrees dupliquees bloquees en preflight;
  - collisions `--output-dir` par basename;
  - skip overwrite visible dans le summary sans failure.
- Garder `pending` ou `blocked` pour:
  - PDF reel;
  - Mermaid rendu par navigateur;
  - browser-backed tests;
  - packaging/install;
  - FR-19, FR-20, FR-21.

Critere de sortie:

- la checklist distingue clairement:
  - couvert par test unitaire;
  - bloque par P3;
  - preuve release/P4 attendue.

## Phase 3 - Preparer l'integration verticale P3 cote Stream A

Principe de frontiere:

- Stream A orchestre la CLI, les chemins, l'overwrite, le batch, les summaries,
  les erreurs et le packaging.
- Stream A ne doit pas reimplementer `markdownRenderer`, `browserLocator`,
  `webDriverClient`, `pdfRenderer`, `artifactPolicy` ou le provisioning.
- Stream A doit brancher son runtime sur le vrai converter quand Stream B le
  fournit.

Travail a faire:

- Garder `src/contracts.ts` comme surface de types publics.
- Deplacer l'implementation concrete de `convertFile` hors `contracts.ts`, dans
  un module runtime/converter dedie.
- Modifier `src/cli.ts` pour que le default runtime utilise le vrai converter,
  tout en conservant l'injection de fake converter pour les tests unitaires.
- S'assurer que `ConvertOptions.browserPath` continue d'etre transmis par la
  CLI au converter.

Critere de sortie:

- le chemin utilisateur sans injection ne lance plus `NotImplementedError`;
- `md2pdf ENTRY` tente une vraie conversion via le converter runtime.

## Phase 4 - Ajouter les tests d'integration P3 Stream A

Le script `test:browser` cible deja:

```text
tests/integration/**/*.test.ts
```

Travail a faire:

- Ajouter les tests d'integration requis quand le converter et le renderer PDF
  existent.
- Couvrir au minimum:
  - single-file `md2pdf ENTRY` produit un PDF reel;
  - `--output` produit le fichier demande;
  - `--output-dir` fonctionne avec un ou plusieurs jobs;
  - PDF existant sans `--force-overwrite` est preserve;
  - `--force-overwrite` ecrit reellement;
  - erreur de rendu propage `sourcePath`, `outputPath` et `actionHint`;
  - `MD2PDF_BROWSER` ou l'option runtime equivalente atteint le converter.

Validation P3:

```bash
npm.cmd run build
npm.cmd run test:browser
```

Critere de sortie:

- un test d'integration prouve le chemin CLI -> vrai converter -> PDF;
- les erreurs P3 restent formatees via `formatError`;
- le statut P3 peut etre soumis a re-audit.

## Phase 5 - Renforcer overwrite et permissions au moment de l'ecriture reelle

Risque:

- Les tests P2 prouvent surtout les decisions preflight et les fakes de
  conversion.
- En P3, le vrai rendu peut echouer plus tard, au moment exact de l'ecriture.

Travail a faire:

- Rejouer ou renforcer les protections au point d'ecriture finale.
- Propager des erreurs riches compatibles Stream A.
- Ajouter des tests d'integration pour:
  - output devenu non writable entre preflight et rendu;
  - parent output non writable;
  - output existant non remplacable;
  - echec tardif sans perte de donnees.

Critere de sortie:

- les protections P2 restent vraies avec le vrai converter;
- les erreurs contiennent les chemins utiles et un `actionHint`.

## Phase 6 - Executer P4 packaging et installation

Prerequis:

- P3 doit etre vert avant de commencer l'acceptance P4.

Travail a faire:

- Verifier que `npm run build` produit `dist/cli.js`.
- Verifier que `package.json` pointe bien `bin.md2pdf` vers `./dist/cli.js`.
- Lancer `npm pack --json` et inspecter la packlist.
- Installer le tarball dans un prefixe temporaire user-scope.
- Invoquer `md2pdf --help` depuis le prefixe installe.
- Reinstaller le meme tarball une seconde fois dans le meme prefixe et verifier
  que l'operation reste idempotente.

Validation P4 locale:

```bash
npm.cmd run build
npm.cmd test
npm.cmd run check:artifacts
npm pack --json
```

Critere de sortie:

- packlist conforme;
- binaire installe invocable;
- reinstall idempotent;
- FR-19 et FR-21 peuvent etre marques avec preuves.

## Phase 7 - Completer FR-20 et README/help

### 7.1 FR-20 system-scope

Travail a faire:

- Completer `docs/release-evidence/fr-20-system-scope.md`.
- Renseigner:
  - version md2pdf;
  - commit SHA;
  - tarball ou source package;
  - OS, Node.js, npm;
  - commande d'installation system-scope;
  - compte utilisateur teste;
  - commande exacte `md2pdf --help`;
  - sortie observee;
  - statut final.

Critere de sortie:

- `md2pdf --help` est invocable par nom depuis le contexte utilisateur teste;
- le statut FR-20 peut passer a `pass` ou rester explicitement documente si une
  simulation valide est utilisee.

### 7.2 README final

Travail a faire:

- Aligner README et `--help`.
- Documenter une section par option CLI.
- Documenter que l'extension `--output` est utilisee verbatim.
- Documenter le premier run et le provisioning browser uniquement avec les
  notes exactes fournies par Stream B.
- Ne pas annoncer de capacite browser-backed comme disponible avant P3 acceptee.

Critere de sortie:

- chaque option de `--help` existe dans README;
- chaque option README existe dans `--help`;
- la checklist release contient la preuve de comparaison.

## Ordre recommande

1. Corriger `check:artifacts`.
2. Rejouer les gates P2 globales.
3. Mettre a jour les preuves P1/P2.
4. Brancher Stream A sur le vrai converter fourni par Stream B.
5. Ajouter les tests d'integration P3 sous `tests/integration`.
6. Valider le chemin CLI -> PDF reel.
7. Renforcer overwrite/permissions avec ecriture reelle.
8. Executer packaging/install P4.
9. Completer FR-20 et README/help.
10. Lancer un audit final Stream A P3/P4.

## Gates finales attendues

Avant de declarer Stream A complet:

```bash
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:contracts
npm.cmd run check:artifacts
npm.cmd run build
npm.cmd run test:browser
npm pack --json
```

## Points a ne pas faire dans Stream A

- Ne pas reimplementer le moteur Markdown/HTML/PDF de Stream B.
- Ne pas contourner `ARTIFACT_FRESHNESS_POLICY.md`.
- Ne pas declarer P3 complete tant que `convertFile` runtime reste un stub.
- Ne pas demarrer l'acceptance P4 tant que P3 n'a pas produit un PDF reel.
- Ne pas mettre a jour la checklist release en masquant les gates rouges.

