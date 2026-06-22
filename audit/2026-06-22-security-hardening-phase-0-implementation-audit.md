# Audit implementation Phase 0 - Security Hardening Implementation Plan

Date: 2026-06-22

Scope: audit de l'implementation courante de la Phase 0 du plan
`docs/security-hardening-implementation-plan.md`.

Sources relues:

- `ARTIFACT_FRESHNESS_POLICY.md`
- `docs/security-hardening-implementation-plan.md`
- `docs/security-hardening-plan.md`
- `docs/release-evidence/security-hardening-phase-0-baseline-2026-06-22.md`
- `tests/fixtures/imageFixtures.ts`
- `tests/unit/markdownRenderer/markdownRenderer.test.ts`
- `tests/browser/browserBackedConversion.test.ts`
- `package.json`
- `artifacts.json`

Etat du workspace observe:

- Fichiers modifies: `tests/browser/browserBackedConversion.test.ts`,
  `tests/unit/markdownRenderer/markdownRenderer.test.ts`.
- Fichiers non suivis: `docs/release-evidence/security-hardening-phase-0-baseline-2026-06-22.md`,
  `tests/fixtures/imageFixtures.ts`.

## Verdict global

**Phase 0 majoritairement implementee, avec reserve de reproductibilite.**

Les points fonctionnels de Phase 0 sont presents: baseline documentee, decision
artifact documentee, tests a modifier identifies, helpers de fixtures ajoutes,
et gates relances. Le principal probleme n'est pas une omission de Phase 0 mais
la solidite de la preuve: le fichier de baseline reference un commit SHA alors
que l'etat audite inclut des fichiers non committes/non suivis, et `npm.cmd
test` a echoue une fois pendant cet audit avant de passer au rerun complet.

## Matrice Phase 0

| Point Phase 0 | Statut audit | Evidence | Evaluation |
| --- | --- | --- | --- |
| 1. Lancer les controles actuels: `npm run typecheck`, `npm test`, `npm run test:artifacts`, `npm run check:artifacts` | **Partiellement correct** | Plan: `docs/security-hardening-implementation-plan.md:60-64`. Baseline: `docs/release-evidence/security-hardening-phase-0-baseline-2026-06-22.md:18-21`. | Les quatre controles sont bien consignes. Pendant cet audit, `npm.cmd run typecheck`, `npm.cmd run test:artifacts`, et `npm.cmd run check:artifacts` passent. `npm.cmd test` a d'abord echoue sur `tests/integration/converter.test.ts:230`, puis le test cible et un rerun complet ont passe. Le point est implemente, mais le gate garde un risque de flake documente. |
| 2. Confirmer qu'aucun nouvel artifact n'est necessaire | **Correct avec reserve mineure** | Plan: `docs/security-hardening-implementation-plan.md:65`. Baseline: `docs/release-evidence/security-hardening-phase-0-baseline-2026-06-22.md:28-33`. Dependencies existantes: `package.json:51-65`. Catalogue: `artifacts.json:5`, `artifacts.json:139`. | Aucun changement observe sur `package.json`, `package-lock.json`, `artifacts.json`, `assets/` ou les chemins de provisioning runtime. Les helpers ajoutent des buffers image inline, pas des packages/lockfiles/assets distants. Reserve: `tests/fixtures/imageFixtures.ts` contient des blobs base64 sans note de generation/provenance dans le fichier lui-meme; la baseline affirme qu'ils sont synthetiques. |
| 3. Identifier les tests a modifier car les liens HTTPS ne doivent plus etre retires et SVG doit etre refuse par format | **Correct** | Plan: `docs/security-hardening-implementation-plan.md:66-68`. Baseline: `docs/release-evidence/security-hardening-phase-0-baseline-2026-06-22.md:35-38`. Test HTTPS courant: `tests/unit/markdownRenderer/markdownRenderer.test.ts:162-179`. | Le fichier de baseline identifie bien le test NFR-02 qui retire encore les `href` HTTPS et l'absence de test deny-by-format SVG. L'implementation runtime n'est pas encore modifiee, ce qui reste conforme a Phase 0. |
| 4. Creer, si utile, les helpers de fixtures Markdown: tiny PNG/JPEG/WebP, buffers trompeurs, fichiers surdimensionnes synthetiques | **Correct** | Plan: `docs/security-hardening-implementation-plan.md:69-74`. Helpers: `tests/fixtures/imageFixtures.ts:1`, `:8`, `:26`, `:33`, `:37`. Usage unit: `tests/unit/markdownRenderer/markdownRenderer.test.ts:10`, `:92-112`. Usage browser: `tests/browser/browserBackedConversion.test.ts:14`, `:142`. | Les cinq helpers demandes existent. Le test Markdown couvre PNG/JPEG/WebP valides comme data URIs, et le test browser reutilise `tinyPng`. Les helpers trompeur/surdimensionne sont prets pour les phases suivantes mais pas encore utilises, ce qui est acceptable en Phase 0. |
| Gate de sortie Phase 0: `npm run typecheck`, `npm test` | **Partiellement correct** | Plan: `docs/security-hardening-implementation-plan.md:76-80`. Baseline: `docs/release-evidence/security-hardening-phase-0-baseline-2026-06-22.md:18-19`. Test flakey: `tests/integration/converter.test.ts:230-268`. | `npm.cmd run typecheck` passe. `npm.cmd test` a echoue une premiere fois pendant l'audit avec `promise resolved "undefined" instead of rejecting` sur le timeout session-start, puis le test cible et un rerun complet ont passe avec 16 fichiers et 179 tests passed, 2 skipped. La sortie Phase 0 est donc acceptable seulement avec reserve explicite de flakiness. |

## Findings

### Finding 1 - Gate `npm test` non parfaitement reproductible

Severity: Medium

Files:

- `docs/release-evidence/security-hardening-phase-0-baseline-2026-06-22.md:19`
- `tests/integration/converter.test.ts:230-268`

Problem:
La baseline signale deja un timeout intermittent, et l'audit l'a reproduit:
`npm.cmd test` a echoue une fois sur le test "stops the driver process when
timeout fires during session start", puis a passe au test cible et au rerun
complet.

Risk:
Un gate de sortie qui depend d'un rerun peut masquer une regression de
temporisation. Pour Phase 0, cela ne prouve pas que les nouveaux helpers sont
incorrects, mais cela affaiblit la preuve "pass" globale.

Suggested fix:
Stabiliser le test de timeout ou documenter explicitement une politique de rerun
avec le resultat initial, le resultat cible, et le resultat complet final.

Test needed:
Relancer `npm.cmd test` apres stabilisation ou apres commit/stage du perimetre
Phase 0.

### Finding 2 - Baseline difficilement reproductible depuis le SHA seul

Severity: Low

Files:

- `docs/release-evidence/security-hardening-phase-0-baseline-2026-06-22.md:7`
- `docs/release-evidence/security-hardening-phase-0-baseline-2026-06-22.md:18-21`

Problem:
La baseline donne un commit SHA, mais l'etat audite inclut des fichiers modifies
et non suivis. Un lecteur qui checkout uniquement le SHA ne retrouve pas
necessairement les helpers ni le fichier de preuve Phase 0.

Risk:
La preuve d'audit est moins portable et moins reconstructible tant que les
fichiers Phase 0 ne sont pas staged/committed ensemble.

Suggested fix:
Apres stabilisation, committer ou au minimum stager les fichiers Phase 0, puis
rerun les gates et mettre a jour la preuve avec l'etat exact audite.

### Finding 3 - Provenance des fixtures image implicite

Severity: Low

Files:

- `ARTIFACT_FRESHNESS_POLICY.md:22`
- `docs/release-evidence/security-hardening-phase-0-baseline-2026-06-22.md:28-33`
- `tests/fixtures/imageFixtures.ts:1-40`

Problem:
Les fixtures image inline semblent synthetiques et first-party, et ne modifient
aucun artifact tiers. Cependant, comme elles embarquent des bytes base64, leur
origine n'est documentee que dans le fichier de baseline, pas dans le fichier de
fixtures.

Risk:
Une lecture stricte de la politique artifact peut demander de distinguer
explicitement "fixture synthetique first-party" d'un asset externe encode.

Suggested fix:
Ajouter une courte note de provenance dans `tests/fixtures/imageFixtures.ts` ou
dans la preuve Phase 0 finale, indiquant que les buffers sont des fixtures
synthetiques minimales et non des assets tiers.

## Commandes executees pendant l'audit

| Commande | Resultat observe |
| --- | --- |
| `npm run typecheck` | Echec PowerShell local: `npm.ps1` bloque par ExecutionPolicy. Non retenu comme gate, remplace par `npm.cmd`. |
| `npm.cmd run typecheck` | Pass: `tsc --noEmit`. |
| `npm.cmd run test:artifacts` | Pass: 2 files passed, 23 tests passed, 1 skipped. |
| `npm.cmd run check:artifacts` | Pass: `Artifact freshness policy passed.` |
| `npm.cmd test` | Premier run: fail sur `tests/integration/converter.test.ts` timeout session-start. |
| `npm.cmd test -- tests/integration/converter.test.ts -t "stops the driver process when timeout fires during session start"` | Pass: 1 test passed, 8 skipped. |
| `npm.cmd test` | Deuxieme run complet: pass, 16 files passed, 179 tests passed, 2 skipped. |

## Conclusion

Phase 0 peut etre consideree **fonctionnellement couverte**: chaque point demande
par le plan a une implementation ou une preuve correspondante. Je ne donne pas
un PASS sans reserve, car la preuve actuelle depend d'un workspace non commite
et d'un gate `npm test` qui a montre une instabilite reelle pendant l'audit.
