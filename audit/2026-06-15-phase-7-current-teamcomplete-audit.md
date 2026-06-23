# Audit Phase 7 - remise en coherence Stream A et tests CLI

Date: 2026-06-15

Source de verite auditee:

- `docs/post-audit-remediation-plan-2026-06-12.md`, section "Phase 7 - Remettre Stream A et les tests CLI en coherence"

Revision auditee:

- `fb2ba7f88a18b42cb7ccadc2cb1dcb09b702886f`

Verdict: **GO Phase 7 sans reserve ouverte sur Stream A -> convertFile**

La phase 7 est globalement conforme a son gate local: les tests Stream A
pertinents sont presents, les comportements CLI listes par la phase sont
couverts, l'ancien chemin `pdfRenderer` / `--print-to-pdf` n'est plus verrouille
par les tests actifs, et les gates demandes passent.

Correction post-audit: le finding initial sur la preuve CLI/PDF avec runtime
injecte a ete corrige par un test browser-backed qui appelle `main(...)` sans
`dependencies`, donc via le `defaultConvertFile` importe par `src/cli.ts`.

## Gates rejoues

| Commande | Resultat | Observation |
| --- | --- | --- |
| `npm.cmd test` | `pass` | 14 fichiers de test passes, 154 tests passes, 3 skips Windows/POSIX. |
| `npm.cmd run typecheck` | `pass` | `tsc --noEmit` vert. |
| `npm.cmd run test:browser` | `pass` | 3 fichiers de test passes, 25 tests passes, dont le nouveau test CLI sans injection. |

Note d'execution: `npm run typecheck` a d'abord echoue sous PowerShell car
`npm.ps1` est bloque par la policy locale. Le meme gate a ete rejoue avec le
shim Windows `npm.cmd run typecheck`, qui passe.

## Requirement and User Story Compliance

| Exigence Phase 7 | Statut | Evidence | Probleme |
| --- | --- | --- | --- |
| Rejouer les tests CLI, paths, overwrite et pipeline | Respectee | `npm.cmd test` vert; suites `tests/unit/cli/cli.test.ts`, `tests/unit/paths/paths.test.ts`, `tests/unit/overwrite/overwrite.test.ts`, `tests/unit/pipeline/pipeline.test.ts` executees. | Aucun blocage observe. |
| Help complet | Respectee | `src/cli.ts:40` definit `HELP_TEXT`; `tests/unit/cli/cli.test.ts:42` verifie une ligne par option supportee. | Limite release hors phase: l'aide du binaire package n'est pas rejouee par ce gate. |
| Exit codes `0`, `1`, `2` | Respectee | `src/cli.ts:224` mappe usage/input vers `2`; `src/cli.ts:186` retourne `1` si au moins une conversion echoue; tests CLI a `tests/unit/cli/cli.test.ts:58`, `tests/unit/cli/cli.test.ts:163`, `tests/unit/cli/cli.test.ts:343`. | Aucun blocage observe. |
| Batch continue-on-error | Respectee | `src/pipeline.ts:58` continue job par job; `tests/unit/pipeline/pipeline.test.ts:116`; `tests/unit/cli/cli.test.ts:343`. | Aucun blocage observe. |
| Summary stdout | Respectee | `src/cli.ts:184` ecrit le resume; `src/cli.ts:197` compte success/fail/skip; tests a `tests/unit/cli/cli.test.ts:163`, `tests/unit/cli/cli.test.ts:343`, `tests/unit/cli/cli.test.ts:376`. | Aucun blocage observe. |
| Skip non-interactif | Respectee | `src/overwrite.ts:82` ecrit le skip; `tests/unit/overwrite/overwrite.test.ts:100`; `tests/unit/cli/cli.test.ts:376`. | Aucun blocage observe. |
| Prompt EOF | Respectee | `src/overwrite.ts:119` retourne `undefined` en EOF; `tests/unit/overwrite/overwrite.test.ts:143`; `tests/unit/cli/cli.test.ts:441`. | Aucun blocage observe. |
| Collisions output | Respectee | `src/paths.ts:159` detecte les outputs dupliques avant rendu; `tests/unit/paths/paths.test.ts:195`; `tests/unit/cli/cli.test.ts:201`. | Aucun blocage observe. |
| Duplicate entries | Respectee | Meme preflight `src/paths.ts:159`; `tests/unit/paths/paths.test.ts:184`; `tests/unit/cli/cli.test.ts:304`. | Aucun blocage observe. |
| Dossier vide | Respectee | `src/paths.ts:104` retourne uniquement les Markdown top-level; `tests/unit/paths/paths.test.ts:34`; `tests/unit/cli/cli.test.ts:183`. | Aucun blocage observe. |
| `--output-dir` | Respectee | `src/paths.ts:145` place les outputs dans le dossier cible; `tests/unit/paths/paths.test.ts:107`; `tests/integration/cli-pdf.test.ts:77`. | Aucun blocage observe. |
| Output parent non-writable | Respectee | `src/paths.ts:187` cree/verifie les parents; `tests/unit/paths/paths.test.ts:123`; `tests/unit/cli/cli.test.ts:243`. | Aucun blocage observe. |
| Supprimer les tests qui valident uniquement un ancien chemin runtime | Respectee | `rg` ne trouve pas de `src/pdfRenderer.ts` ni de `--print-to-pdf` dans `src/` ou les tests actifs; seules des references documentaires historiques restent. | Aucun blocage observe. |
| Revalider que Stream A appelle le vrai `convertFile` au bon niveau | Respectee | `src/cli.ts:6` importe le convertisseur runtime; `src/cli.ts:164` l'utilise par defaut; `tests/unit/cli/cli.test.ts:99` verifie le chemin sans injection en erreur; `tests/integration/browserBackedConversion.test.ts:191` verifie un succes PDF via `main(...)` sans injection. | Aucun blocage observe. |

## Negative Findings

### Finding 1 - Corrige: le succes CLI/PDF restait prouve avec un runtime injecte

Severity: Medium, corrige le 2026-06-15

Requirement: "Revalider que Stream A appelle le vrai `convertFile` au bon
niveau" et "Les tests Stream A ne masquent plus une integration Stream B cassee."

File:

- `tests/integration/cli-pdf.test.ts:53`
- `tests/integration/cli-pdf.test.ts:305`
- `tests/integration/browserBackedConversion.test.ts:191`
- `tests/integration/browserBackedConversion.test.ts:205`
- `src/cli.ts:164`

Problem:

Avant correction, les tests d'integration CLI qui prouvent les conversions reussies appelaient
`main(..., runtimeDependencies())`. Cette dependance injecte `createConverter`
avec `fakeLocatorFactory`, `fakeFileSystem`, `fakePrintPdf` et
`fakeSessionFactory`. Cela isole correctement Stream A, mais cela ne prouve pas
qu'un appel CLI sans injection reussit avec le runtime de production complet.

Risk:

Avant correction, `npm.cmd test` pouvait rester vert si le raccord de production
CLI -> `defaultConvertFile` -> `BrowserLocator` -> WebDriver -> PDF est casse
sur le chemin de succes. Le test sans injection a `tests/unit/cli/cli.test.ts:99`
est utile, mais il ne prouve qu'un echec browser structure correctement l'erreur;
il ne produit pas de PDF.

Evidence:

- `src/cli.ts:164` utilise `dependencies.convertFile ?? defaultConvertFile`.
- `tests/integration/cli-pdf.test.ts:53` passe explicitement
  `runtimeDependencies()` au CLI.
- `tests/integration/cli-pdf.test.ts:305` definit `runtimeDependencies()` avec
  un convertisseur construit autour de doubles de test.
- `tests/unit/cli/cli.test.ts:99` couvre le chemin sans injection seulement par
  un scenario d'echec navigateur attendu.
- `tests/integration/browserBackedConversion.test.ts:191` ajoute une preuve
  browser-backed CLI sans injection.
- `tests/integration/browserBackedConversion.test.ts:205` appelle
  `main(["cli.md"], io)` sans troisieme argument `dependencies`.

Correction appliquee:

Un test browser-backed a ete ajoute dans `tests/integration/browserBackedConversion.test.ts`.
Il invoque le CLI sans `dependencies`, verifie l'exit code `0`, le summary
stdout, l'absence de stderr, un PDF `%PDF-`, et une taille superieure a 1 KiB.

Test ajoute:

- `@req FR-01 @req FR-18 runs the CLI through the default runtime convertFile without injection`

## Test Gaps / Residual Risks

- Les trois skips de `npm.cmd test` sont lies a des cas POSIX/executable sous
  Windows. Ils ne bloquent pas la phase 7, mais doivent rester couverts sur une
  matrice CI Linux/macOS/Windows avant release globale.
- Le gate phase 7 strict ne demandait pas `test:browser`, mais ce gate a ete
  rejoue pour fermer la preuve CLI sans injection. `test:real-browser`,
  packaging et install restent hors de cette correction.
- La release checklist contient encore des sections globales `blocked` pour les
  preuves package/browser/CI/FR-20. Cet audit ne les ferme pas.

## Open Questions

- Aucune question ouverte pour la correction Stream A -> `defaultConvertFile`.

## Summary

Phase 7 peut etre consideree verte pour son perimetre local: CLI, paths,
overwrite, pipeline, preflight, skips, summaries, collisions, dossiers vides,
`--output-dir`, EOF et exit codes sont couverts et les gates demandes passent.

La reserve initiale sur le succes CLI/PDF avec dependances runtime injectees est
fermee par un test browser-backed sans injection de `convertFile`. Les limites
restantes concernent la release globale: `test:real-browser`, packaging,
install, CI et FR-20.
