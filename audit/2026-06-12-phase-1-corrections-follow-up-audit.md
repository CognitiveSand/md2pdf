# Audit Follow-up - Corrections Phase 1

Date: 2026-06-12 15:05 CEST
Branche auditee: `plan/v0.1.1_restart`
Base de comparaison: `48d6e46f6b8645a70da97c8287aba45992d43257`
Etat audite: `dfc83ebfc4711e0015da4098761efc3f26fb2151` plus creation du present rapport.

## Perimetre

Audit demande a partir de `audit/2026-06-12-phase-1-corrections-effectiveness-audit.md`, en ne regardant que les fichiers modifies depuis la base:

- `.gitattributes`
- `audit/2026-06-12-phase-1-corrections-effectiveness-audit.md`
- `src/browserLocator.ts`
- `src/converter.ts`
- `src/pipeline.ts`
- `src/webDriverSession.ts`
- `tests/integration/cli-pdf.test.ts`
- `tests/unit/browserLocator/browserLocator.test.ts`
- `tests/unit/cli/cli.test.ts`
- `tests/unit/converter/converter.test.ts`
- `tests/unit/webDriverSession/webDriverSession.test.ts`

Deux agents ont ete utilises:

- Agent runtime: audit des fichiers `src/` modifies.
- Agent tests: audit des tests modifies.

## Verdict

Verdict global: **AUDIT_PASS partiel**.

Les corrections F1, F2, F3, F5 et R1 sont correctement apportees dans le perimetre ferme des fichiers modifies. Le finding M1 du rapport source ne se confirme plus: le chemin `signal.aborted` arme maintenant l'escalade `SIGKILL` avant de rejeter, et un test unitaire cible le couvre.

Le point bloquant H1 reste ouvert: `npm.cmd run test:browser` sans skip echoue toujours sur la preuve real-browser faute de navigateur ou fallback eligible. Le point M2 `NotImplementedError` n'a pas pu etre revalide sans ouvrir les docs non modifiees; il reste donc hors perimetre de cette passe.

## Matrice De Verification

| Correction / point | Statut | Evidence | Probleme restant |
| --- | --- | --- | --- |
| F1 `createConverter` restaure | PASS | `src/converter.ts:65`, `tests/unit/converter/converter.test.ts:33` | Aucun finding confirme. |
| F2 tests CLI alignes runtime/WebDriver | PASS | `tests/integration/cli-pdf.test.ts:305`, `tests/integration/cli-pdf.test.ts:343` | Aucun finding confirme. |
| F3 contexte `sourcePath` / `outputPath` preserve | PASS | `src/pipeline.ts:99`, `src/pipeline.ts:113`, `tests/integration/cli-pdf.test.ts:136` a `:139` | Aucun finding confirme. |
| F5 Vivaldi POSIX depuis PATH | PASS avec limite de runner | `src/browserLocator.ts:95`, `src/browserLocator.ts:106`, `src/browserLocator.ts:703`, `tests/unit/browserLocator/browserLocator.test.ts:337` | Le test est saute sur Windows via `itOnPosix` a `tests/unit/browserLocator/browserLocator.test.ts:23`. |
| R1 arret WebDriver borne | PASS | `src/webDriverSession.ts:61`, `src/webDriverSession.ts:134`, `src/webDriverSession.ts:158`, `tests/unit/webDriverSession/webDriverSession.test.ts:13`, `:22`, `:25`, `:32` | Le finding M1 du rapport source est obsolete dans l'etat audite. |
| H1 preuve release real-browser sans skip | FAIL | `audit/2026-06-12-phase-1-corrections-effectiveness-audit.md:50`, commande `npm.cmd run test:browser` | Toujours 2 tests real-browser en echec: aucun navigateur/fallback eligible. |
| M2 ecart documentaire `NotImplementedError` | HORS PERIMETRE | `audit/2026-06-12-phase-1-corrections-effectiveness-audit.md:73` | Les docs citees ne sont pas dans la liste des fichiers modifies inspectes. |

## Findings Negatifs

### H1 - La preuve release real-browser reste rouge sans skip

Severity: High

Fichier: `audit/2026-06-12-phase-1-corrections-effectiveness-audit.md`
Ligne: 50

Probleme: le rapport source signalait deja que le gate release real-browser restait en echec. La verification actuelle confirme le meme etat: `npm.cmd run test:browser` echoue avec 19 tests passes et 2 tests fails.

Evidence: les deux echecs remontent `No supported browser was found and no eligible fallback browser artifact is available`. La cause racine exposee par la commande est `No compatible artifact release has completed quarantine` pour `chromium-for-testing`.

Risque: les corrections sont suffisantes pour les gates deterministes, mais pas pour produire une preuve release browser-backed dans cet environnement.

Correction attendue: fournir un navigateur/WebDriver pre-provisionne eligible, ou declarer un fallback browser/driver eligible conforme a `ARTIFACT_FRESHNESS_POLICY.md`, puis rejouer `npm.cmd run test:browser` sans `MD2PDF_SKIP_REAL_BROWSER_TESTS`.

Test requis: `npm.cmd run test:browser` sans skip doit passer.

### M1 - Le rapport source sous-evalue maintenant la couverture R1

Severity: Medium

Fichier: `audit/2026-06-12-phase-1-corrections-effectiveness-audit.md`
Ligne: 44

Probleme: le rapport source marque encore R1 comme `PARTIEL` avec une couverture limitee aux tests d'integration. Dans l'etat audite, les fichiers modifies ajoutent une couverture unitaire directe de `SpawnedDriverProcess`.

Evidence: `tests/unit/webDriverSession/webDriverSession.test.ts:13` teste le signal deja aborted et `tests/unit/webDriverSession/webDriverSession.test.ts:22` exige `[undefined, "SIGKILL"]`. Le cas driver ignorant le premier signal est aussi couvert a `tests/unit/webDriverSession/webDriverSession.test.ts:25` et `tests/unit/webDriverSession/webDriverSession.test.ts:32`.

Risque: le rapport source est devenu stale sur R1 et peut orienter une correction inutile.

Correction attendue: dans un prochain rapport, reclasser R1 en PASS pour le perimetre code/tests modifies, tout en gardant les limites de preuve real-browser separees.

Test requis: deja couvert par `npm.cmd test`; les deux tests `SpawnedDriverProcess` passent.

### M2 - Le diff de la branche contient des espaces finaux dans le rapport source

Severity: Medium

Fichier: `audit/2026-06-12-phase-1-corrections-effectiveness-audit.md`
Lignes: 3, 4, 5

Probleme: `git diff --check 48d6e46f6b8645a70da97c8287aba45992d43257..HEAD` echoue sur des trailing whitespaces dans le rapport source, alors que ce meme rapport indique `git diff --check: PASS` a la ligne 160.

Evidence: la commande signale:

```text
audit/2026-06-12-phase-1-corrections-effectiveness-audit.md:3: trailing whitespace.
audit/2026-06-12-phase-1-corrections-effectiveness-audit.md:4: trailing whitespace.
audit/2026-06-12-phase-1-corrections-effectiveness-audit.md:5: trailing whitespace.
```

Risque: un check de qualite de diff sur la branche peut echouer malgre les corrections fonctionnelles.

Correction attendue: supprimer les espaces finaux dans le rapport source.

Test requis: `git diff --check 48d6e46f6b8645a70da97c8287aba45992d43257..HEAD`.

### L1 - La preuve F5 Vivaldi POSIX n'est pas executee sur ce runner Windows

Severity: Low

Fichier: `tests/unit/browserLocator/browserLocator.test.ts`
Ligne: 23

Probleme: le test Vivaldi POSIX ajoute a `tests/unit/browserLocator/browserLocator.test.ts:337` utilise `itOnPosix`, defini comme `it.skip` sur Windows. Sur cette machine, `npm.cmd test` montre donc ce test comme skip.

Evidence: `tests/unit/browserLocator/browserLocator.test.ts:23` choisit `it.skip` quand `process.platform === "win32"`. Le run local affiche le test `@req NFR-03 detects Vivaldi from the POSIX PATH` en skip.

Risque: la correction code est presente, mais la preuve locale Windows ne l'execute pas. Une regression POSIX specifique peut passer inapercue si aucun runner POSIX ne valide la branche.

Correction attendue: executer la suite sur un runner POSIX, ou accepter explicitement cette limite pour une fonctionnalite POSIX.

Test requis: `npm test` sur Linux ou macOS doit executer le test Vivaldi POSIX.

## Points Correctement Corriges

- F1: `createConverter` est restaure comme facade injectable autour de `DocumentConverter`.
- F2: les tests CLI modifiees utilisent maintenant le converter runtime injecte avec locator, session factory et `printPdf` fake.
- F3: les erreurs `Md2PdfError` sont enrichies par `withJobContext`, et les tests CLI verifient `source`, `output` et `hint`.
- F5: Vivaldi est reintegre dans la liste POSIX et dans la detection de type navigateur.
- R1: l'escalade `SIGKILL` est armee avant le cas `signal.aborted`, ce qui ferme le trou signale par l'ancien audit.

## Commandes Executees

```bash
git status --short
git diff --name-only 48d6e46f6b8645a70da97c8287aba45992d43257..HEAD
npm.cmd test
npm.cmd run typecheck
npm.cmd run test:contracts
npm.cmd run check:artifacts
npm.cmd run test:browser
$env:MD2PDF_SKIP_REAL_BROWSER_TESTS='1'; npm.cmd run test:browser
npm.cmd run build
git diff --check 48d6e46f6b8645a70da97c8287aba45992d43257..HEAD
```

Resultats:

- `npm.cmd test`: PASS, 144 passes, 4 skips.
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run test:contracts`: PASS, 15 tests.
- `npm.cmd run check:artifacts`: PASS.
- `npm.cmd run test:browser`: FAIL, 19 passes, 2 fails.
- `MD2PDF_SKIP_REAL_BROWSER_TESTS=1 npm.cmd run test:browser`: PASS, 19 passes, 2 skips.
- `npm.cmd run build`: PASS.
- `git diff --check 48d6e46...HEAD`: FAIL sur trailing whitespace dans le rapport source.

## Limites

- Les fichiers non modifies n'ont pas ete ouverts pour l'audit de code, conformement a la demande.
- Les echecs real-browser ont ete verifies par sortie de commande, pas par inspection directe des tests non modifies.
- Le point documentaire `NotImplementedError` reste hors perimetre parce que les docs concernees ne font pas partie des fichiers modifies inspectes et que `AGENTS.md` exige un accord utilisateur avant toute modification de requirements, stories ou architecture.
