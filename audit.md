# Audit Stream A P1 - 2026-06-05

Verdict: **P1 Stream A n'est pas completement implemente**.

Le gate technique P1 passe (`npm.cmd run typecheck`, puis `npm.cmd test`: 4 fichiers, 28 tests OK), mais le contrat utilisateur P1 n'est pas respecte de bout en bout. Les modules `paths` et `pipeline` couvrent une grande partie des regles internes, tandis que le CLI reel reste bloque sur un `NotImplementedError` pour toute commande valide non-`--help`.

## Sources auditees

- `docs/plan_stream_a.md`
- `docs/implementation_plan_v0.1.2.md`
- `docs/project_requirements.md`
- `src/cli.ts`
- `src/paths.ts`
- `src/pipeline.ts`
- `src/errors.ts`
- `tests/unit/cli/cli.test.ts`
- `tests/unit/paths/paths.test.ts`
- `tests/unit/pipeline/pipeline.test.ts`
- `docs/release-evidence/release-checklist-v0.1.2.md`
- audits P1 existants du 2026-06-05

## Requirement and User Story Compliance

| Exigence P1 | Statut | Evidence | Probleme |
| --- | --- | --- | --- |
| CLI `main(argv, io)` testable | Partiel | `src/cli.ts:41`, `src/cli.ts:59` | La signature et le parsing existent, mais l'execution reste un stub. |
| Signature `md2pdf [OPTIONS] ENTRY [ENTRY ...]` | Respecte | `src/cli.ts:31` | Aucun probleme trouve pour la declaration d'usage. |
| `--help` une ligne par option | Respecte pour les flags CLI | `src/cli.ts:31`, `tests/unit/cli/cli.test.ts:24` | Ambiguite mineure: `MD2PDF_BROWSER` est lu mais pas documente dans l'aide. |
| Erreurs d'usage en exit `2`, via `formatError` | Partiel | `src/cli.ts:53`, `src/cli.ts:162`, `tests/unit/cli/cli.test.ts:42` | Prouve pour parsing/validation CLI, pas pour les erreurs de preflight appelees depuis le CLI. |
| Extension `.md` case-insensitive | Respecte dans le resolver | `src/paths.ts:32`, `tests/unit/paths/paths.test.ts:20` | Pas encore expose par le CLI reel. |
| Dossier non recursif, Markdown top-level seulement | Respecte dans le resolver | `src/paths.ts:102`, `tests/unit/paths/paths.test.ts:34` | Pas encore expose par le CLI reel. |
| Dossier vide: `0 succeeded, 0 failed, 0 skipped`, exit `0` | Non respecte en CLI | `docs/plan_stream_a.md:43`, `src/cli.ts:140`, `src/cli.ts:144` | Toute commande valide arrive sur `NotImplementedError`, donc exit `1` et pas de summary. |
| Output par defaut a cote de la source | Respecte dans le resolver | `src/paths.ts:132`, `tests/unit/paths/paths.test.ts:20` | Pas encore expose par le CLI reel. |
| `--output` limite a un seul job et extension verbatim | Respecte dans le resolver | `src/paths.ts:118`, `src/paths.ts:133`, `tests/unit/paths/paths.test.ts:52` | Pas encore expose par le CLI reel. |
| `--output-dir` single et batch | Respecte dans le resolver | `src/paths.ts:139`, `tests/unit/paths/paths.test.ts:68` | Pas encore expose par le CLI reel. |
| Parent d'output cree si absent | Respecte dans le resolver | `src/paths.ts:174`, `tests/unit/paths/paths.test.ts:52` | Creation faite pendant resolution, avant rendu. |
| `outputPath === sourcePath` en `UsageError` | Respecte dans le resolver | `src/paths.ts:146`, `tests/unit/paths/paths.test.ts:92` | Pas encore expose par le CLI reel. |
| Collisions/duplicates avant rendu | Respecte dans pipeline/resolver | `src/paths.ts:146`, `src/pipeline.ts:26`, `tests/unit/pipeline/pipeline.test.ts:43` | Le CLI ne les appelle pas. |
| Preflight resout tous les jobs avant rendu | Respecte dans pipeline | `src/pipeline.ts:26`, `tests/unit/pipeline/pipeline.test.ts:24` | Le CLI ne l'utilise pas. |
| Faux converter en test | Respecte | `tests/unit/pipeline/pipeline.test.ts:67` | Couverture utile au niveau pipeline. |

## Negative Findings

### 1. Le CLI utilisateur ne lance jamais la resolution de jobs ni le pipeline

Severity: **High**

File: `src/cli.ts`

Line: `50`, `140`, `144`

Problem: `main()` parse les arguments puis appelle `executeCommand()`, mais `executeCommand()` ignore `command` et `io`, puis lance toujours `NotImplementedError`.

Risk: Toute invocation valide (`md2pdf file.md`, `md2pdf folder`, `md2pdf --output-dir out a.md b.md`) echoue en exit `1` au lieu de produire les jobs, appliquer le preflight, convertir ou imprimer un summary. C'est un echec direct du P1 observable.

Suggested fix: cabler `executeCommand()` a `ConversionPipeline`, injecter le converter, transmettre `entries`, `cwd`, `outputPath`, `outputDir`, `browserPath`, puis retourner un code de sortie base sur les `ConversionOutcome`.

Test needed: tests CLI avec faux converter pour single-file, dossier, dossier vide, collision `--output-dir`, erreur de conversion et succes.

### 2. Le cas dossier vide requis par P1 n'est pas satisfait par la commande

Severity: **High**

File: `src/cli.ts`, `src/paths.ts`

Line: `src/cli.ts:144`, `src/paths.ts:102`

Problem: `resolveDirectory()` retourne bien `[]` pour un dossier sans Markdown, mais le CLI n'appelle pas le resolver et n'a aucun chemin qui imprime `0 succeeded, 0 failed, 0 skipped`.

Risk: Une regle defensive explicite du plan P1 echoue en usage reel. Les tests actuels donnent une confiance trompeuse: ils prouvent seulement le comportement du resolver.

Suggested fix: apres execution du pipeline, toujours imprimer le summary, y compris quand `outcomes.length === 0`, et retourner `0` si aucun job n'a echoue.

Test needed: `main(["empty-dir"], io)` avec fixture dossier vide: exit `0`, stdout exact, stderr vide.

### 3. Le modele summary/exit code n'est pas cable

Severity: **High**

File: `src/cli.ts`, `src/pipeline.ts`

Line: `src/cli.ts:50`, `src/pipeline.ts:50`, `src/pipeline.ts:55`

Problem: `ConversionPipeline` retourne des `ConversionOutcome[]`, mais `main()` retourne toujours `0` si `executeCommand()` termine, et `executeCommand()` retourne `void`. Il n'existe pas de mapping CLI vers stdout summary, exit `0` sans failure, exit `1` avec failure, exit `2` pour preflight/usage.

Risk: `FR-11`, `FR-17` et `FR-18` ne sont pas prouvables au niveau commande. Le pipeline peut continuer apres erreur, mais l'utilisateur ne recoit ni le bon resume ni le bon statut.

Suggested fix: faire retourner a `executeCommand()` un code ou une synthese; centraliser `N succeeded, N failed, N skipped`; convertir les erreurs globales `UsageError` en exit `2`.

Test needed: batch avec un faux converter qui echoue sur un fichier: conversion du suivant, summary correct, exit `1`.

### 4. Les tests P1 ne couvrent pas le flux integre CLI -> paths -> pipeline

Severity: **Medium**

Test/file: `tests/unit/cli/cli.test.ts`, `tests/unit/paths/paths.test.ts`, `tests/unit/pipeline/pipeline.test.ts`

Problem: Les tests sont bons par module, mais aucun test CLI de commande valide n'atteint `ConversionPipeline`. Le trou principal (`executeCommand()` stub) passe donc le gate.

Risk: Le gate `npm test` peut rester vert alors que `md2pdf file.md` est inutilisable.

Missing validation: tests de `main()` sur commandes valides avec dependances injectees, ou extraction d'un orchestrateur testable qui relie parser, resolver, pipeline et summary.

### 5. Les tags `@req` Stream A sont partiels ou prematurement attribues

Severity: **Medium**

Test/file: `tests/unit/cli/cli.test.ts`, `tests/unit/paths/paths.test.ts`, `tests/unit/pipeline/pipeline.test.ts`

Problem: Les tags presents couvrent `FR-02`, `FR-03`, `FR-08`, `FR-09`, `FR-10`, `FR-13`, `FR-17`, `FR-23`, `NFR-04`. Manquent encore `FR-11`, `FR-12`, `FR-14`, `FR-15`, `FR-18`, `FR-19`, `FR-20`, `FR-21` face a la liste obligatoire Stream A. Certains relevent plutot de P2/P4, mais `FR-11` et `FR-18` touchent deja le comportement summary/success attendu.

Risk: La traceabilite peut laisser croire que Stream A est plus avance qu'il ne l'est. Le tag `FR-13` ne prouve actuellement que le parsing de `-f`, pas l'overwrite force.

Suggested fix: distinguer tags "parse only" et tags comportementaux, ajouter les tests manquants au moment ou les fonctions P2/P4 arrivent, et couvrir des maintenant `FR-11`/`FR-18` au niveau CLI.

### 6. Les preuves release ne refletent pas encore les tests P1 existants

Severity: **Low**

Document: `docs/release-evidence/release-checklist-v0.1.2.md`

Line: `118` a `125`

Problem: Plusieurs decisions defensives P1 restent `pending` dans la checklist: dossier vide, `.MD`, extension verbatim, parent output, duplicates et collision basename.

Risk: Meme les points correctement testes dans `paths`/`pipeline` ne sont pas encore absorbables comme preuve release. Cela ne bloque pas l'implementation P1 stricte, mais bloque une lecture release-ready.

Suggested update: passer les lignes couvertes a `pass` avec reference aux tests, et laisser `pending` uniquement les comportements non encore cables au CLI ou appartenant P2/P4.

## Architecture Problems

### Frontiere CLI/orchestration incomplete

Severity: **High**

Area: `cli.ts` vers `pipeline.ts`

Evidence: `src/cli.ts:140` ignore la commande; `src/pipeline.ts:23` expose pourtant `ConversionPipeline`.

Problem: Les responsabilites documentees dans l'architecture disent que le CLI doit parser, cabler les composants et fixer l'exit code, pendant que le pipeline execute les conversions. Aujourd'hui, la frontiere existe sur papier et en modules, mais la liaison critique est absente.

Suggested architectural correction: garder `paths` pur et `pipeline` injectable, mais introduire un orchestrateur CLI testable qui transforme `CliCommand` en `ConversionPipelineOptions`, imprime le summary et retourne l'exit code.

Migration risk: faible si le converter reste injecte en test; attention a ne pas coupler P1 au navigateur reel.

## Test Audit

### Couverture satisfaisante

- Resolution `.MD` case-insensitive.
- Expansion dossier non recursive.
- Output par defaut, `--output`, `--output-dir`.
- Creation du parent d'output.
- Rejet `outputPath === sourcePath`.
- Rejet duplicates/collisions avant conversion.
- Pipeline avec faux converter.
- Preflight avant rendu.
- Continuation apres erreur de conversion dans le pipeline.
- Help CLI et erreurs de parsing usage en exit `2`.

### Gaps bloquants pour le verdict P1 complet

- Aucun test `main(["file.md"], io)` ne prouve une commande valide.
- Aucun test CLI dossier vide ne prouve summary + exit `0`.
- Aucun test CLI collision/preflight ne prouve exit `2` depuis la commande.
- Aucun test CLI batch failure ne prouve summary + exit `1`.
- `npm test` passe malgre le stub `NotImplementedError`.

## Validation executee

- `npm run typecheck`: bloque par la politique PowerShell (`npm.ps1` interdit).
- `npm.cmd run typecheck`: **PASS**.
- `npm.cmd test`: **PASS**, 4 fichiers, 28 tests.

Commande pratique sur ce shell Windows:

```powershell
npm.cmd run typecheck
npm.cmd test
```

## Open Questions

- Le P1 attendu inclut-il seulement les briques internes point 1/2/3, ou exige-t-il deja le flux CLI complet `md2pdf ENTRY`? Le plan Stream A parle de surface observable utilisateur; cet audit retient donc le flux CLI comme obligatoire.
- `MD2PDF_BROWSER` doit-il etre documente dans `--help` ou reserve a la documentation Stream B/README?
- Le comportement `--output` avec dossier vide doit-il rester `UsageError` car zero job resolu, ou produire le summary vide? Le plan dit `--output` limite a un seul job resolu et dossier vide succes; l'intersection merite une decision explicite.

## Summary

Les morceaux `src/paths.ts` et `src/pipeline.ts` sont globalement bons pour P1 interne. Le verdict global reste **NO-GO pour P1 complet**, parce que `src/cli.ts` n'est pas cable au pipeline et que les comportements utilisateur les plus visibles (commande valide, summary, exit codes, dossier vide) ne sont ni implementes ni testes au niveau CLI.

---

# Audit Stream A P1 - Consolidation actuelle - 2026-06-05

Verdict: **GO pour Stream A P1 strict**, avec reserves a traiter avant P2/P3/P4.

Note de contexte: la section precedente de ce fichier ne reflete plus l'etat
actuel du code. `src/cli.ts` est maintenant cable a `ConversionPipeline`; le
verdict NO-GO precedent etait valide pour l'ancien etat ou `executeCommand()`
lancait encore directement `NotImplementedError`.

## Sources auditees

- `docs/plan_stream_a.md`
- `docs/implementation_plan_v0.1.2.md`
- `docs/architecture.md`
- `docs/release-evidence/release-checklist-v0.1.2.md`
- `package.json`
- `src/cli.ts`
- `src/paths.ts`
- `src/pipeline.ts`
- `src/contracts.ts`
- `src/errors.ts`
- `tests/unit/cli/cli.test.ts`
- `tests/unit/paths/paths.test.ts`
- `tests/unit/pipeline/pipeline.test.ts`
- retours de 3 sous-agents: conformite fonctionnelle, tests/preuves,
  architecture/code.

## Requirement and User Story Compliance

| Exigence P1 Stream A | Statut | Evidence | Probleme |
| --- | --- | --- | --- |
| CLI `main(argv, io)` testable | Respecte | `src/cli.ts:20`, `src/cli.ts:52` | Aucun blocage P1. |
| Signature `md2pdf [OPTIONS] ENTRY [ENTRY ...]` | Respecte | `src/cli.ts:42` | Aucun blocage P1. |
| `--help` decrit les options | Respecte pour P1 | `src/cli.ts:42`, `tests/unit/cli/cli.test.ts:41` | Test partiellement tautologique; README/binaire package restent P4. |
| Erreurs d'usage exit `2` via `formatError` | Respecte | `src/cli.ts:69`, `src/cli.ts:211`, `tests/unit/cli/cli.test.ts:57` | Aucun blocage P1. |
| CLI cable a la resolution et au pipeline | Respecte | `src/cli.ts:65`, `src/cli.ts:154`, `src/cli.ts:159`, `tests/unit/cli/cli.test.ts:116` | Le converter par defaut reste le stub C0 jusqu'a P3. |
| Summary stdout et exit code sur resultats | Respecte pour P1/P1+ | `src/cli.ts:170`, `src/cli.ts:171`, `src/cli.ts:184`, `tests/unit/cli/cli.test.ts:116`, `tests/unit/cli/cli.test.ts:177` | Les skips overwrite restent P2. |
| Entree fichier `.md` case-insensitive | Respecte | `src/paths.ts:18`, `src/paths.ts:32`, `tests/unit/paths/paths.test.ts:20` | Aucun blocage P1. |
| Entree dossier non recursive, Markdown top-level | Respecte | `src/paths.ts:102`, `tests/unit/paths/paths.test.ts:34` | Aucun blocage P1. |
| Dossier vide: exit `0`, summary vide | Respecte au CLI | `src/paths.ts:102`, `src/cli.ts:184`, `tests/unit/cli/cli.test.ts:136` | Aucun blocage P1. |
| Output par defaut a cote de la source | Respecte | `src/paths.ts:132`, `tests/unit/paths/paths.test.ts:20` | Aucun blocage P1. |
| `--output` limite a un seul job et extension verbatim | Respecte | `src/paths.ts:118`, `src/paths.ts:132`, `tests/unit/paths/paths.test.ts:49`, `tests/unit/paths/paths.test.ts:77` | README reste P4. |
| `--output-dir` single et batch | Respecte | `src/paths.ts:132`, `tests/unit/paths/paths.test.ts:61` | Aucun blocage P1. |
| Parent output cree si absent | Respecte | `src/paths.ts:174`, `tests/unit/paths/paths.test.ts:49` | Cas non writable reste P2. |
| `outputPath === sourcePath` en `UsageError` | Respecte | `src/paths.ts:146`, `tests/unit/paths/paths.test.ts:94` | Aucun blocage P1. |
| Collisions et entrees dupliquees avant rendu | Respecte | `src/paths.ts:146`, `tests/unit/paths/paths.test.ts:110`, `tests/unit/paths/paths.test.ts:121`, `tests/unit/cli/cli.test.ts:154` | Aucun blocage P1. |
| Preflight resout tous les jobs avant rendu | Respecte | `src/pipeline.ts:26`, `src/pipeline.ts:27`, `tests/unit/pipeline/pipeline.test.ts:24` | Semantique input manquant a aligner avec architecture avant P2. |
| Faux converter en test | Respecte | `src/cli.ts:39`, `tests/unit/cli/cli.test.ts:116`, `tests/unit/pipeline/pipeline.test.ts:67` | Aucun blocage P1. |

## Negative Findings

### 1. Le CLI reste cable au stub `contracts.ts` tant que P3 n'a pas relie le vrai converter

Severity: **Medium** pour P1, **High** si oublie en P3.

File: `src/cli.ts`, `src/contracts.ts`

Line: `src/cli.ts:6`, `src/cli.ts:159`, `src/contracts.ts:8`, `src/contracts.ts:15`

Problem: le CLI utilise `convertFile` depuis `contracts.ts` comme converter par
defaut. Cette fonction lance encore `NotImplementedError`. Les tests P1
contournent correctement ce point par injection d'un faux converter, mais le
binaire package ne convertira pas reellement tant que P3 ne remplace pas cette
dependance par le vrai `convertFile`.

Risk: Stream B peut livrer le vrai converter sans que le binaire l'appelle, si
le raccord P3 est oublie.

Suggested fix: en P3, faire pointer le CLI vers le vrai module de conversion, ou
faire de `contracts.ts` la facade qui re-exporte l'implementation reelle.

Test needed: integration P3 avec le vrai converter et un PDF reel.

### 2. `--force-overwrite` est parse mais pas encore transporte dans l'orchestration

Severity: **Medium** pour P1, **High** pour P2.

File: `src/cli.ts`, `src/pipeline.ts`

Line: `src/cli.ts:33`, `src/cli.ts:48`, `src/cli.ts:79`, `src/cli.ts:160`,
`src/pipeline.ts:18`

Problem: `--force-overwrite` existe dans l'aide et le parser, mais
`ConversionPipelineOptions` ne porte pas encore `forceOverwrite`, `stdin` ou
`isInteractive`.

Risk: P2 overwrite devra rouvrir la frontiere CLI/pipeline. Ce n'est pas un
echec P1 car l'overwrite est explicitement P2 dans `docs/plan_stream_a.md`, mais
c'est un piege de migration.

Suggested fix: en P2, introduire explicitement les options overwrite dans le
contrat pipeline ou dans un orchestrateur CLI dedie.

Test needed: table overwrite P2 avec mode interactif/non-interactif,
`--force-overwrite`, prompt EOF et skips dans summary.

### 3. La semantique des inputs manquants/illisibles diverge entre architecture et tests

Severity: **Medium**.

File: `src/pipeline.ts`, `src/paths.ts`, `tests/unit/pipeline/pipeline.test.ts`,
`docs/architecture.md`

Line: `src/pipeline.ts:27`, `src/paths.ts:93`,
`tests/unit/pipeline/pipeline.test.ts:24`, `docs/architecture.md:162`

Problem: le pipeline resout tous les jobs avant rendu et traite un input
manquant comme erreur globale de preflight. C'est coherent avec la logique P1
"resoudre tous les jobs avant tout rendu", mais l'architecture de batch peut
etre lue comme "continuer apres erreurs par document".

Risk: P2 peut diverger sur les cas input manquant/illisible: soit abort global
exit `2`, soit outcome failed avec continuation.

Suggested fix: trancher en P2 si les erreurs de resolution sont globales ou par
entree, puis aligner architecture, tests et formatter.

Test needed: batch avec un input manquant/illisible et un input valide.

### 4. Les cas permission et certains tags globaux Stream A restent hors P1

Severity: **Low** pour P1, **Medium** pour la traceabilite Stream A globale.

File: `tests/unit/*`, `docs/release-evidence/release-checklist-v0.1.2.md`,
`package.json`

Line: `docs/release-evidence/release-checklist-v0.1.2.md:122`,
`package.json:3`

Problem: les tags presents couvrent le P1 strict, mais pas toute la liste globale
Stream A (`FR-12`, `FR-14`, `FR-15`, `FR-19`, `FR-20`, `FR-21`). La checklist
garde logiquement en `pending` le parent output non writable et les preuves
release/install. `package.json` annonce encore `0.1.1` alors que la checklist
cible `0.1.2`.

Risk: si on lit la liste de tags Stream A comme obligatoire des P1, le verdict
devient artificiellement bloque. En realite, `FR-19/20/21` sont P4 et
permissions/overwrite sont P2; il faut eviter de les melanger au gate P1.

Suggested fix: separer explicitement tags "P1 gate" et tags "Stream A release",
puis aligner `package.json` avant les preuves pack/install v0.1.2.

Test needed: P2 permissions/overwrite; P4 pack/install/FR-20/FR-21.

## Architecture Audit

La frontiere actuelle est acceptable pour P1: `cli.ts` parse, instancie un
pipeline injectable, transmet `entries`, `cwd`, `outputPath`, `outputDir` et
`browserPath`, puis imprime le summary. `paths.ts` et `pipeline.ts` respectent le
preflight avant rendu.

Deux points doivent etre gardes ouverts:

1. P2 devra etendre explicitement le contrat pipeline pour overwrite/prompt.
2. P3 devra retirer le risque de binaire connecte au stub C0.

## Test Audit

### Couverture P1 satisfaisante

- Help, parsing, erreurs usage exit `2`.
- Commande single-file valide avec faux converter et summary.
- Dossier vide au niveau CLI avec exit `0`.
- Erreur de preflight collision depuis le CLI avec exit `2`.
- Batch avec une conversion en erreur, continuation, summary et exit `1`.
- `.MD`, dossier non recursif, output par defaut, `--output`, `--output-dir`.
- Duplicates/collisions avant conversion.
- Pipeline avec fake converter et preflight avant rendu.

### Gaps hors P1 strict

- Overwrite, prompt, skip summary.
- Parent output non writable, input illisible.
- README/help du package construit.
- Pack/install/FR-19/FR-20/FR-21.
- Vrai converter et PDF reel.

## Validation executee

- `npm.cmd run typecheck`: **PASS**.
- `npm.cmd run test`: **PASS**, 4 fichiers, 32 tests.
- `npm.cmd run test:contracts`: **PASS**, 1 fichier, 11 tests.

Note Windows: `npm run ...` via PowerShell peut etre bloque par `npm.ps1`.
Utiliser `npm.cmd ...` pour les gates locaux.

## Open Questions

- Confirmer pour P2 si un input manquant/illisible dans un batch doit stopper
  tout le preflight en exit `2`, ou devenir un outcome `failed` avec
  continuation.
- Confirmer si `MD2PDF_BROWSER` doit etre liste dans `--help` ou seulement dans
  README/docs Stream B.
- Decider si `resolveConversionJobs()` doit continuer a creer les parents
  d'output, ou si cette mutation doit migrer vers pipeline/overwrite en P2.

## Summary

P1 Stream A est **bien implemente sur le perimetre strict du plan**:
CLI/parsing, usage errors, resolution des jobs, preflight `ConversionJob`,
summary minimal et tests avec faux converter sont en place et verts.

Les reserves restantes ne bloquent pas P1, mais elles doivent etre traitees
avant les gates suivants: overwrite/permissions en P2, raccord au vrai converter
en P3, packaging/install/version `0.1.2` en P4.

---

# Audit Stream A strict - Point 1 FR-20 CLI invocability - 2026-06-11

## Requirement and User Story Compliance

| Requirement / Story | Status | Evidence | Problem |
| --- | --- | --- | --- |
| Complete FR-20 evidence with package metadata | Respected | `docs/release-evidence/fr-20-system-scope.md:17-23` | None blocking. |
| Generate or reuse valid tarball after build | Respected | `docs/release-evidence/fr-20-system-scope.md:19`, `docs/release-evidence/fr-20-system-scope.md:113-118` | None blocking. |
| Prove command-name resolution and `md2pdf --help` execution | Respected for Stream A strict simulation | `docs/release-evidence/fr-20-system-scope.md:40`, `docs/release-evidence/fr-20-system-scope.md:60-82`, `docs/release-evidence/fr-20-system-scope.md:96-99`, `docs/release-evidence/fr-20-system-scope.md:124-130` | Not a real elevated multi-account install; documented as simulation. |
| Document simulation reason and limits | Respected | `docs/release-evidence/fr-20-system-scope.md:39`, `docs/release-evidence/fr-20-system-scope.md:55`, `docs/release-evidence/fr-20-system-scope.md:99` | None blocking. |
| Avoid hiding dirty working-tree provenance | Respected | `docs/release-evidence/fr-20-system-scope.md:106-110` | None blocking. |

## Negative Findings

No blocking finding for Stream A strict point 1.

### Finding 1

Severity: Low

File: `docs/release-evidence/fr-20-system-scope.md`

Line: 99

Problem: The evidence is a valid CLI-invocability simulation, not a real
host-wide system install visible to a secondary Windows account.

Risk: This cannot be reused as proof that machine-level ACLs, system PATH
propagation, or every account on the host can invoke md2pdf.

Evidence: The deviation is explicitly documented at
`docs/release-evidence/fr-20-system-scope.md:99`.

Suggested fix: For a global release, rerun FR-20 with an elevated system-scope
install and a real secondary account. For Stream A strict, no change is needed
because the plan allows a documented simulation of the observable CLI contract.

Test needed: Manual system-scope smoke on the release candidate, outside Stream
A strict if global release evidence is required.

## Open Questions

- Does the project owner want a later real Windows secondary-account FR-20 run
  before global release approval?

## Summary

Point 1 can continue. The modified evidence file is internally consistent,
records the generated tarball metadata, proves command-name invocation and
`md2pdf --help` exit `0` through a global-style npm prefix, and keeps the
simulation limits visible instead of overstating them.

---

# Audit Stream A strict - Point 2 README/CLI alignment - 2026-06-11

## Requirement and User Story Compliance

| Requirement / Story | Status | Evidence | Problem |
| --- | --- | --- | --- |
| README documents every `--help` option | Respected | `README.md:64-70`, `README.md:90-102` | None blocking. |
| README does not document a nonexistent `--browser` option | Respected | `README.md:31-32` states `MD2PDF_BROWSER` is an environment variable, not a CLI option. | None blocking. |
| README documents Stream A CLI behavior only | Respected | `README.md:13-15`, `README.md:85-113` | None blocking. |
| Stream B capabilities are not presented as delivered by Stream A | Respected | `README.md:18-21`, `README.md:123-128`, `README.md:141-143` | None blocking. |
| README documents verbatim `--output` extension behavior | Respected | `README.md:93-96` | None blocking. |

## Negative Findings

No blocking finding for Stream A strict point 2.

### Finding 1

Severity: Low

File: `README.md`

Line: 24

Problem: The README still says actual PDF rendering needs a supported local
browser runtime, but the exact supported runtime matrix is intentionally not
specified in Stream A strict.

Risk: This is acceptable for Stream A strict, but global release documentation
will still need a precise Stream B-backed browser support statement.

Evidence: `README.md:18-21` marks browser rendering, WebDriver, Firefox,
fallback provisioning, and compatibility evidence as outside Stream A strict.

Suggested fix: After Stream B closes browser/rendering evidence, replace the
generic runtime requirement with the exact supported browser/runtime matrix.

Test needed: README/help comparison is sufficient for Stream A strict; global
release needs browser/runtime documentation review after Stream B.

## Open Questions

- Should `MD2PDF_BROWSER` eventually be added to `--help`, or remain documented
  only as an environment variable?

## Summary

Point 2 can continue. README and CLI help are aligned for the Stream A strict
surface, and browser/Mermaid/WebDriver/fallback promises are no longer written
as delivered Stream A behavior.

---

# Audit Stream A strict - Point 3 Windows PowerShell caveat - 2026-06-11

## Requirement and User Story Compliance

| Requirement / Story | Status | Evidence | Problem |
| --- | --- | --- | --- |
| README documents npm `.cmd` and `.ps1` shims on Windows | Respected | `README.md:61-65` | None blocking. |
| README explains local ExecutionPolicy can block the PowerShell shim | Respected | `README.md:63-65` | None blocking. |
| README gives explicit `.cmd` workaround | Respected | `README.md:67-75` | None blocking. |
| Release checklist carries the same Windows nuance where installation evidence is used | Respected | `docs/release-evidence/release-checklist-v0.1.2.md:99` | None blocking. |

## Negative Findings

No blocking finding for Stream A strict point 3.

### Finding 1

Severity: Low

File: `README.md`

Line: 63

Problem: The caveat is Windows-specific and based on the observed local
PowerShell behavior, not a cross-version Windows matrix.

Risk: Some Windows environments may resolve shims differently, but the advice is
still accurate for the known failure mode and does not overstate a failure as a
Stream A blocker.

Evidence: `docs/release-evidence/release-checklist-v0.1.2.md:99` records the
same observed PowerShell `.ps1` behavior and `.cmd` workaround.

Suggested fix: No Stream A strict change needed. Global release evidence can add
more Windows shell variants if required.

Test needed: Optional Windows smoke under PowerShell and `cmd.exe` during global
release validation.

## Open Questions

- Should the final release checklist require both PowerShell and `cmd.exe`
  invocation, or is `.cmd` invocability sufficient for FR-19/FR-20?

## Summary

Point 3 can continue. The Windows PowerShell shim caveat is documented without
turning the `.ps1` policy block into a false Stream A failure, because the npm
`.cmd` shim remains invocable.

---

# Audit Stream A strict - Point 4 release checklist separation - 2026-06-11

## Requirement and User Story Compliance

| Requirement / Story | Status | Evidence | Problem |
| --- | --- | --- | --- |
| Stream A strict evidence is marked separately from global release readiness | Respected | `docs/release-evidence/release-checklist-v0.1.2.md:3`, `docs/release-evidence/release-checklist-v0.1.2.md:21`, `docs/release-evidence/release-checklist-v0.1.2.md:146-150` | None blocking. |
| FR-20 proof is closed with documented simulation limits | Respected | `docs/release-evidence/release-checklist-v0.1.2.md:88-91` | None blocking. |
| README/help comparison is marked complete | Respected | `docs/release-evidence/release-checklist-v0.1.2.md:107-108` | None blocking. |
| Stream B/global browser evidence remains separate | Respected | `docs/release-evidence/release-checklist-v0.1.2.md:67`, `docs/release-evidence/release-checklist-v0.1.2.md:69`, `docs/release-evidence/release-checklist-v0.1.2.md:126-127` | None blocking. |
| Final pack metadata is not falsely reused after README edits | Respected | `docs/release-evidence/release-checklist-v0.1.2.md:26`, `docs/release-evidence/release-checklist-v0.1.2.md:98` | None blocking; intentionally deferred to Point 5. |

## Negative Findings

No blocking finding for Stream A strict point 4.

### Finding 1

Severity: Low

File: `docs/release-evidence/release-checklist-v0.1.2.md`

Line: 98

Problem: `npm packlist verified` is still `pending`.

Risk: This would block final Stream A strict closure if left as-is, because the
README changed after the previous tarball was generated.

Evidence: The checklist explicitly says Point 5 must replay
`npm.cmd pack --json`.

Suggested fix: Complete Point 5 and update the tarball metadata from the final
pack output.

Test needed: Point 5 gate replay.

## Open Questions

- None blocking for Point 4.

## Summary

Point 4 can continue. The checklist no longer assigns browser, Mermaid,
WebDriver, fallback provisioning, or compatibility matrix evidence to Stream A
strict, and it keeps the final package metadata honestly pending until the
Point 5 gate replay.

---

# Audit Stream A strict - Point 5 gate replay - 2026-06-11

## Requirement and User Story Compliance

| Requirement / Story | Status | Evidence | Problem |
| --- | --- | --- | --- |
| Run `npm.cmd run typecheck` | Respected | Point 5 replay output; `docs/release-evidence/release-checklist-v0.1.2.md:63` | None. |
| Run `npm.cmd test` | Not respected | Point 5 replay output; `docs/release-evidence/release-checklist-v0.1.2.md:64` | Unit suite failed before the remaining gates could be replayed. |
| Continue to `test:contracts`, `check:artifacts`, `build`, `pack`, and `help` only if earlier gates pass | Respected by stopping | This audit | Stopped after the unit-test failure instead of manufacturing later evidence. |

## Negative Findings

### Finding 1

Severity: High

File: `tests/unit/cli/cli.test.ts`

Line: 99

Problem: `npm.cmd test` times out on `@req FR-01 @req FR-18 uses the runtime
converter when no converter is injected`.

Risk: Stream A strict cannot be finalized because the required unit gate is red.
The failing test exercises the default runtime converter path from a unit suite;
that path can now wait on real browser/rendering behavior instead of failing
quickly and deterministically.

Evidence: Point 5 replay result:

```text
npm.cmd test
FAIL
Test Files: 1 failed, 10 passed
Tests: 1 failed, 84 passed, 2 skipped
Failure: tests/unit/cli/cli.test.ts:99 timed out in 5000ms
```

Suggested fix: Make the test deterministic again without hiding the runtime
boundary. Options include injecting a bounded fake browser/converter for unit
scope, adding a short explicit timeout to the runtime failure path expected by
the test, or moving this proof to the integration suite and replacing the unit
test with a narrower assertion that `main()` uses the default converter factory.

Test needed: Rerun `npm.cmd test`, then continue the Point 5 gates only after it
passes.

## Open Questions

- Should this unit test remain responsible for the real default converter path,
  or should that proof live only in Stream A integration tests?

## Summary

Point 5 is blocked. I stopped before `test:contracts`, `check:artifacts`,
`build`, `pack`, and `node dist\cli.js --help` because the required unit gate is
red. The checklist has been updated to show the current failure instead of
claiming a stale pass.

---

# Re-audit Stream A strict - Point 5 gate replay correction - 2026-06-11

## Requirement and User Story Compliance

| Requirement / Story | Status | Evidence | Problem |
| --- | --- | --- | --- |
| Make the unit test deterministic without hiding the runtime boundary | Respected | `tests/unit/cli/cli.test.ts:99` | None blocking. |
| Rerun `npm.cmd test` after correction | Respected | `npm.cmd test`: 11 files passed, 85 tests passed, 2 skipped | None. |
| Continue remaining Point 5 gates only after unit tests pass | Respected | `npm.cmd run test:contracts`, `npm.cmd run check:artifacts`, `npm.cmd run build`, `npm.cmd pack --json`, `node dist\cli.js --help` all passed | None. |
| Refresh final tarball evidence after README/test changes | Respected | `docs/release-evidence/release-checklist-v0.1.2.md:26`, `docs/release-evidence/release-checklist-v0.1.2.md:98`, `docs/release-evidence/fr-20-system-scope.md:19` | None. |

## Negative Findings

No blocking finding for Stream A strict point 5 after correction.

### Finding 1

Severity: Low

File: `tests/unit/cli/cli.test.ts`

Line: 107

Problem: The unit test proves the default runtime converter is no longer the
old `NotImplementedError` stub by forcing a missing configured browser path,
not by producing a PDF.

Risk: This is appropriate for Stream A strict unit scope, but it must not be
misread as browser rendering proof.

Evidence: `docs/release-evidence/release-checklist-v0.1.2.md:67` keeps real
installed-browser/Mermaid evidence outside Stream A strict and blocked by
Stream B/global release validation.

Suggested fix: No Point 5 change needed. Keep real browser rendering proof in
Stream B/global release gates.

Test needed: None for Stream A strict. Global release still needs real browser
tests.

## Gates Replayed

```text
npm.cmd run typecheck
PASS

npm.cmd test
PASS - 11 test files, 85 tests passed, 2 skipped

npm.cmd run test:contracts
PASS - 1 test file, 10 tests

npm.cmd run check:artifacts
PASS - Artifact freshness policy passed.

npm.cmd run build
PASS

npm.cmd pack --json
PASS - md2pdf-0.1.2.tgz
shasum cc11a64ec297c708b2178727bd372f753fabee33
integrity sha512-KUOkmzNX9/0yaqlkpGBFWwu/WqoWHizE4Fe1xG43cuf8JQfnGmBFaA+s3uOvQRIr3cQraFXhNlqJdO9Kk6bGdw==

node dist\cli.js --help
PASS
```

## Open Questions

- None blocking for Stream A strict.

## Summary

Point 5 can continue to Point 6. The red unit gate is fixed, every Stream A
strict gate listed in the plan passes, and release evidence now points at the
final tarball produced after the README/test updates.
