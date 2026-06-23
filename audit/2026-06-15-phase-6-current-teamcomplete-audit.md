# Audit TeamComplete Phase 6 — État courant

Date: 2026-06-15  
Branche: `plan/v0.1.1_restart`  
Commit audité: `300894c` (audit: phase 5 final teamcomplete audit — GO)  
Phase précédente: Phase 5 GO (`cf2a7df`)

Sources d'exigences:

- `docs/post-audit-remediation-plan-2026-06-12.md`, section Phase 6 (lignes 304–341)
- `docs/architecture.md`, sections 15 (Verification mapping), §4 (pipeline)
- `docs/project_requirements.md` (FR-04, FR-05, FR-06, FR-07, FR-24)

---

## Résumé De L'Audit

| Division | Statut | Synthèse |
| --- | --- | --- |
| Métier | 🔴 Bloquant | 3 exigences promises par architecture.md sans preuve browser réelle ; `test:real-browser` fausse confiance |
| Qualité | 🔴 Bloquant | assertions `real-browser-mermaid.test.ts` uniquement `%PDF-` + length ; scénarios task lists / footnotes / highlighting non assertés dans PDF |
| Architecture | 🔴 Bloquant | `test:all` n'inclut pas `test:real-browser` ; heading page-break promis "integration test" mais absent des tests browser réels |
| Cybersécurité Offensive | 🟢 OK | aucun défaut de sécurité introduit par Phase 6 scope |

**Verdict global : NO-GO Phase 6**

Totaux : **Critical 2 · High 4 · Medium 2 · Low 3**

---

## Index Des Sous-Audits

| Sous-audit | Scope | Crit | High | Medium | Low | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Business Logic Auditor | Phase 6 objectifs vs implémentation | 1 | 1 | 0 | 0 | AUDIT_FAIL |
| Requirements Compliance Auditor | FR-04, FR-05, FR-06, FR-07, FR-24 vs tests browser | 1 | 2 | 0 | 1 | AUDIT_FAIL |
| Doc-Sync Auditor | architecture.md verification mapping vs code | 0 | 1 | 1 | 1 | AUDIT_FAIL |
| A11y/UX Checker | N/A | — | — | — | — | N/A |
| Clean Code Auditor | real-browser-mermaid.test.ts | 0 | 0 | 0 | 1 | AUDIT_PASS |
| Fail-Loud Auditor | real-browser-mermaid.test.ts, skip guards | 0 | 1 | 0 | 0 | AUDIT_FAIL |
| Test Quality Auditor | browserBackedConversion.test.ts, real-browser-mermaid.test.ts | 1 | 1 | 1 | 0 | AUDIT_FAIL |
| Mutation/Saboteur Auditor | assertions PDF, scénarios non assertés | 0 | 1 | 0 | 0 | AUDIT_FAIL |
| Layer Enforcer | séparation test layers | 0 | 0 | 0 | 0 | AUDIT_PASS |
| YAGNI Auditor | test configs, fixtures | 0 | 0 | 0 | 0 | AUDIT_PASS |
| SRE/Performance Auditor | hookTimeout real-browser, test:all | 0 | 0 | 1 | 0 | AUDIT_PASS |
| Architecture Consistency Auditor | plan Phase 6 vs code vs docs | 0 | 1 | 0 | 1 | AUDIT_FAIL |
| Contextual Threat Analyst | N/A (pas de changement sécurité) | 0 | 0 | 0 | 0 | AUDIT_PASS |
| SAST Scanner | N/A | 0 | 0 | 0 | 0 | AUDIT_PASS |
| Supply Chain & Artifact Auditor | N/A | 0 | 0 | 0 | 0 | AUDIT_PASS |
| Privacy/Exfiltration Auditor | N/A | 0 | 0 | 0 | 0 | AUDIT_PASS |

---

## Matrice Des Exigences Phase 6

| Exigence / Objectif Plan | Fichier(s) actuel | Preuve | Statut |
| --- | --- | --- | --- |
| Revoir smoke `real-browser-mermaid`: absence Mermaid brut | `real-browser-mermaid.test.ts:40-41` | Seulement `%PDF-` + length | ❌ Manquant |
| Revoir smoke: présence objet visuel | `real-browser-mermaid.test.ts:40-41` | Non asserté | ❌ Manquant |
| Documenter type visuel selon navigateur référence | — | Non documenté | ❌ Manquant |
| Scénario: Mermaid comme diagramme | `browserBackedConversion.test.ts:121-122` | `not.toContain("flowchart TD")` + `pdfContainsVisualObject` | ✅ (test:browser uniquement) |
| Scénario: tables | `browserBackedConversion.test.ts:177` | `/S /Table` dans PDF | ✅ (test:browser uniquement) |
| Scénario: task lists assertées dans PDF | `browserBackedConversion.test.ts:130-183` | Présentes dans source, NON assertées dans PDF | ❌ Absent |
| Scénario: footnotes assertées dans PDF | `browserBackedConversion.test.ts:130-183` | Présentes dans source, NON assertées dans PDF | ❌ Absent |
| Scénario: highlighting asserté dans PDF | `browserBackedConversion.test.ts:130-183` | Présent dans source, NON asserté dans PDF | ❌ Absent |
| Scénario: image relative embarquée | `browserBackedConversion.test.ts:178-180` | `/Alt (pixel)` + `pdfContainsVisualObject` | ✅ |
| Scénario: heading page-break integrity | aucun test browser | CSS unit test seulement | ❌ Absent |
| Scénario: erreur rendu sans PDF partiel | `converter.test.ts:272-295` | fake renderer, NON test browser réel | ⚠️ Partiel |
| Séparer layers clairement | structure existante | 3 layers présents | ✅ (mais `test:all` incomplet) |
| Interdire skip compté comme preuve release | `real-browser-mermaid.test.ts` | Pas de guard skip | ❌ Manquant |
| Gate `npm run test:browser` | cf2a7df | 24/24 VERT | ✅ |
| Gate `npm run test:real-browser` | `real-browser-mermaid.test.ts` | 1/1 VERT mais assertions faibles | ⚠️ Fausse confiance |

---

## Commandes Exécutées Et Résultats

```text
npm run typecheck
  Résultat: PASS (tsc --noEmit, 0 erreur)

npm test
  Résultat: PASS — 156 passed | 1 skipped

npm run test:browser
  Résultat: PASS — 24/24

npm run test:real-browser
  Résultat: PASS — 1/1 (37.66s, installed browser)
  MAIS: assertions uniquement %PDF- + length, pas de preuve Mermaid rendu
```

---

## Top Findings

- **Critique** `tests/integration/real-browser-mermaid.test.ts:40-41` — Assertions `%PDF-` + `length > 1_000` seulement. Aucune preuve d'absence de Mermaid brut, aucune preuve d'objet visuel. Le test passe même si Mermaid n'est pas rendu. C1.
- **Critique** `docs/architecture.md:440` — FR-04 annonce "integration test: tables, task lists, footnotes present in PDF text layer". Task lists et footnotes ne sont pas assertés dans la couche texte du PDF dans aucun test browser. Écart documentaire bloquant.
- **High** `docs/architecture.md:443` — FR-07 annonce "integration test: no heading is the last line on a page". Aucun test browser réel ne vérifie le comportement page-break des headings. L'assertion existe uniquement en CSS unitaire.
- **High** `tests/integration/browserBackedConversion.test.ts:131` — Test tagué `@req FR-04 @req FR-05` qui inclut tables, task lists, footnotes, code highlight dans la source mais n'asserte que `/S /Table`. FR-04 partiellement couvert, FR-05 non asserté dans le PDF réel.
- **High** `package.json:44` — `test:all` exécute `vitest run` + `vitest run --config vitest.browser.config.ts` mais PAS `vitest run --config vitest.real-browser.config.ts`. La preuve release-grade real-browser est absente du script de validation complète.
- **High** `tests/integration/real-browser-mermaid.test.ts` — Aucun guard contre skip (contrairement à `browserBackedConversion.test.ts` qui a le sentinel). Si aucun navigateur installé n'est disponible, le test échoue avec une erreur non typée, pas un échec explicite de gate.
- **Medium** `vitest.real-browser.config.ts:8` — `hookTimeout: 30_000` (30s). Si un navigateur installé ne démarre pas rapidement (Firefox cold start, Chrome premier lancement), le hook before peut timeout. Phase 5 a mis 300_000 pour le pre-provisioned path.
- **Medium** `docs/architecture.md:440-443` — FR-04/FR-07 ont des promesses "integration test" sans lien vers les tests browser réels dans la doc. Les references existantes sont invérifiables sans lire le code.

---

## Thèmes Transverses

- **Fausse confiance généralisée sur `test:real-browser`**: le smoke `real-browser-mermaid.test.ts` passe au vert même si Mermaid ne rend pas (un PDF vierge de 2 Ko passerait). C'est le problème central de Phase 6 identifié par le plan.
- **Écart documentation → tests** : `docs/architecture.md` promet des tests pour FR-04 (task lists, footnotes) et FR-07 (heading page-break) qui n'existent pas dans les tests browser réels. Le gap est corroboré par 3 endroits (`architecture.md:440`, `architecture.md:443`, `browserBackedConversion.test.ts:131`).
- **`test:all` incomplet** : la commande censée exécuter tous les tests n'inclut pas `test:real-browser`. La Phase 6 doit soit l'y ajouter, soit documenter explicitement la distinction.

---

## Détails Par Division

### Division Métier (Anton Ego)

Le plan Phase 6 est sans ambiguïté : le smoke `real-browser-mermaid` doit prouver l'absence du Mermaid brut et la présence d'un objet visuel. L'implémentation actuelle en `real-browser-mermaid.test.ts` ne fait ni l'un ni l'autre. Un test qui vérifie `%PDF-` et une taille > 1 Ko ne prouve pas que Mermaid a été rendu ; il prouve seulement qu'un fichier PDF a été émis. C'est une trahison du contrat.

- **Critique** `real-browser-mermaid.test.ts:40-41` : assertions insuffisantes, fausse confiance confirmée.
- **Critique** `architecture.md:440` : FR-04 (task lists, footnotes) annoncé comme couvert par "integration test" mais absent dans le PDF réel.
- **High** `architecture.md:443` : FR-07 (heading page-break) annoncé "integration test" absent dans les tests browser.

### Division Qualité (Gordon Ramsay)

Ce test de smoke `real-browser-mermaid.test.ts` est un désastre culinaire : il présente un plat, vérifie que l'assiette n'est pas vide, et appelle ça une preuve de qualité. Un PDF de 1001 octets contenant uniquement un header vide passerait. La codebase a les bons ingrédients — `pdfContainsVisualObject`, absence de Mermaid brut — dans `browserBackedConversion.test.ts`, mais ils ne sont pas transportés vers le smoke test installé-browser.

- **Critique** `real-browser-mermaid.test.ts:40-41` : test qui génère une fausse confiance confirmée. Seule correction possible : ajouter les mêmes assertions que `browserBackedConversion.test.ts:117-124`.
- **High** `browserBackedConversion.test.ts:131` : tagué `@req FR-04 @req FR-05`, source inclut task lists, footnotes, code highlight, mais seul `/S /Table` est asserté dans le PDF.
- **High** `real-browser-mermaid.test.ts` : pas de guard skip. Si l'installed browser n'est pas présent, le test crash avec une erreur non typée, non une preuve explicite d'absence.

### Division Architecture (Steve Jobs)

La séparation en 3 layers (HTML unitaire / fake renderer / browser réel) existe et est correcte. Mais `test:all` ne couvre pas le troisième layer. C'est une inconsistance de surface : le script qui s'appelle "tout" ne teste pas tout.

- **High** `package.json:44` : `test:all` absent de `test:real-browser`.
- **High** `architecture.md:440, 443` : mapping de vérification promet des tests "integration" pour FR-04/FR-07 qui n'existent pas sous cette forme dans les tests browser réels.
- **Medium** `vitest.real-browser.config.ts:8` : `hookTimeout: 30_000` insuffisant pour un cold start.

### Division Cybersécurité Offensive (Sherlock Holmes)

Le scope de Phase 6 est limité aux preuves PDF et Mermaid. Aucun vecteur d'attaque nouveau n'est introduit. Le smoke test `real-browser-mermaid.test.ts` utilise `convertFile` avec le navigateur installé — même surface d'attaque qu'en production. Pas de nouveaux risques.

Aucun finding de sécurité.

---

## Détails Par Sous-Audit

### Business Logic Auditor

- Verdict: AUDIT_FAIL
- Findings:
  - **Critique** C1: `real-browser-mermaid.test.ts:40-41` — smoke test trop faible. Plan Phase 6 action 1 et 2 non implémentés.
  - **Critique** C2: `architecture.md:440` — FR-04 task lists/footnotes promis "integration test" mais absent de la couche PDF dans les tests browser.
  - **High** H1: `architecture.md:443` — FR-07 heading page-break promis "integration test" absent.
- Points conformes:
  - Mermaid comme diagramme : ✅ `browserBackedConversion.test.ts:121-122`.
  - Image relative : ✅ `browserBackedConversion.test.ts:178-180`.
  - Tables : ✅ `browserBackedConversion.test.ts:177`.
  - `pdfContainsVisualObject` pattern existe et est réutilisable.

### Requirements Compliance Auditor

- Verdict: AUDIT_FAIL
- Findings:
  - **Critique** C2: FR-04 couverture partielle (tables ✅, task lists ❌, footnotes ❌).
  - **High** H1: FR-07 pas de test browser sur heading page-break.
  - **High** H2: FR-05 taggé dans `browserBackedConversion.test.ts:131` mais highlighting non asserté dans le PDF.
  - **Low** L1: FR-24 couvert par `browserBackedConversion.test.ts` mais non par `real-browser-mermaid.test.ts`.
- Points conformes: FR-06 (image) ✅, FR-24 dans test:browser ✅, NFR-02 ✅.

### Doc-Sync Auditor

- Verdict: AUDIT_FAIL
- Findings:
  - **High** `architecture.md:440` : "tables, task lists, footnotes present in PDF text layer" — task lists et footnotes non assertés.
  - **High** `architecture.md:443` : "no heading is the last line on a page" — test browser inexistant.
  - **Medium** `architecture.md:440-443` : mapping de vérification non mis à jour depuis Phase 6 pour refléter la séparation `test:browser` vs `test:real-browser`.
  - **Low** `vitest.browser.config.ts:6` : `exclude: ['tests/integration/real-browser-mermaid.test.ts']` non documenté ; un lecteur ne comprend pas pourquoi ce fichier est exclu.
- Points conformes: FR-24 mapping (`architecture.md:448`) cohérent avec `browserBackedConversion.test.ts`.

### A11y/UX Checker

- Non applicable.

### Clean Code Auditor

- Verdict: AUDIT_PASS
- Findings: Aucun défaut structurel dans le code existant.
  - **Low** `real-browser-mermaid.test.ts:19-43` : describe block compact et lisible, mais le test n'est pas tagué `@req FR-24` alors que c'est sa raison d'être.
- Points conformes: `pdfContainsVisualObject` dans `browserBackedConversion.test.ts:203-207` est une fonction bien nommée, réutilisable pour Phase 6.

### Fail-Loud Auditor

- Verdict: AUDIT_FAIL
- Findings:
  - **High** `real-browser-mermaid.test.ts` : pas de guard skip. Si aucun navigateur installé, le test échoue avec une erreur non typée (`BrowserNotFoundError` brute), pas un message de gate clair. Contrairement au sentinel de Phase 5 (`browserBackedConversion.test.ts:16-24`).
- Points conformes: sentinel test Phase 5 (`browserBackedConversion.test.ts:16-24`) modèle correct à suivre.

### Test Quality Auditor

- Verdict: AUDIT_FAIL
- Findings:
  - **Critique** `real-browser-mermaid.test.ts:40-41` : 2 assertions faibles, fausse confiance. Un PDF de 1001 octets sans Mermaid rendu passerait ce test.
  - **High** `browserBackedConversion.test.ts:131` : test `@req FR-04 @req FR-05` — source inclut task lists, footnotes, code highlight, mais seul `/S /Table` est asserté. Les autres scénarios sont présents dans le fixture mais non vérifiés dans le PDF.
  - **Medium** Pas de test heading page-break dans les tests browser réels (seul `markdownRenderer.test.ts` asserte `break-after: avoid-page` dans le CSS, pas dans le PDF final).
- Points conformes:
  - `pdfContainsVisualObject` logique de détection solide.
  - Test Mermaid 1 (`browserBackedConversion.test.ts:71-128`) : assertions multi-couches bien conçues (`not.toContain("flowchart TD")`, `Skia/PDF`, `/StructTreeRoot`).

### Mutation/Saboteur Auditor

- Verdict: AUDIT_FAIL
- Findings:
  - **High** mutation de `renderToHtml` qui supprimerait le rendu Mermaid (fallback à texte brut) : `real-browser-mermaid.test.ts` ne la tuerait PAS (seul `%PDF-` + length). `browserBackedConversion.test.ts:121-122` la tuerait grâce à `not.toContain("flowchart TD")`.
- Points conformes:
  - Mutation "supprimer `pdfContainsVisualObject`" : tuée par `browserBackedConversion.test.ts:181`.
  - Mutation "supprimer les flags proxy dans webDriverClient.ts" : non tuée par les tests actuels (limite structurelle documentée Phase 5).

### Layer Enforcer

- Verdict: AUDIT_PASS
- Points conformes:
  - Layer 1 (HTML unitaire) : `tests/unit/markdownRenderer/` ✅
  - Layer 2 (fake renderer) : `tests/integration/converter.test.ts`, `tests/integration/cli-pdf.test.ts` ✅
  - Layer 3 (browser réel) : `tests/integration/browserBackedConversion.test.ts` (pre-provisioned), `tests/integration/real-browser-mermaid.test.ts` (installed browser) ✅
  - Séparation claire ; pas de mélange.

### YAGNI Auditor

- Verdict: AUDIT_PASS
- Points conformes: pas d'abstraction superflue. `pdfContainsVisualObject` est un helper ciblé justifié. Configs vitest séparées par couche.

### SRE/Performance Auditor

- Verdict: AUDIT_PASS (avec observation)
- Findings:
  - **Medium** `vitest.real-browser.config.ts:8` : `hookTimeout: 30_000` peut être insuffisant pour un cold start d'un navigateur installé (Firefox sur Linux peut prendre > 20s au premier lancement). Phase 5 a utilisé 300_000 pour le même type de besoin.
- Points conformes: `testTimeout: 90_000` dans `vitest.real-browser.config.ts:7` est plus généreux que les 60_000 de `vitest.browser.config.ts`.

### Architecture Consistency Auditor

- Verdict: AUDIT_FAIL
- Findings:
  - **High** `package.json:44` + `docs/architecture.md:455-456` : `test:all` ne couvre pas `test:real-browser`. Architecture promise "browser-backed integration path" mais le script `test:all` exclut le real-browser smoke.
  - **Low** `vitest.browser.config.ts:6` : exclusion de `real-browser-mermaid.test.ts` correcte mais non expliquée.
- Points conformes: séparation `vitest.browser.config.ts` / `vitest.real-browser.config.ts` architecturalement saine.

### Contextual Threat Analyst

- Verdict: AUDIT_PASS
- Pas de nouveau vecteur lié à Phase 6.

### SAST Scanner

- Verdict: AUDIT_PASS
- Pas de nouveau code à risque dans le scope Phase 6.

### Supply Chain & Artifact Auditor

- Verdict: AUDIT_PASS
- Pas de modification d'artifacts dans Phase 6.

### Privacy/Exfiltration Auditor

- Verdict: AUDIT_PASS
- Le PDF généré lors du smoke `real-browser-mermaid.test.ts` est créé dans un `tempRoot` puis supprimé dans `afterEach`. Pas de fuite de données.

---

## Résumé Des Corrections Attendues

### C1 — Blocker principal (Critique)

`tests/integration/real-browser-mermaid.test.ts` : renforcer les assertions du smoke test:
- Ajouter `not.toContain("flowchart TD")` et `not.toContain("A[Start]")` pour prouver absence Mermaid brut.
- Ajouter `pdfContainsVisualObject(pdfText)` pour prouver présence d'objet visuel.
- Ajouter `toContain("Mermaid smoke")` ou équivalent pour prouver présence du contenu textuel.
- Ajouter tag `@req FR-24` au test.

### C2 — Blocker secondaire (Critique)

`tests/integration/browserBackedConversion.test.ts` test 2 : ajouter des assertions pour task lists et footnotes dans la couche texte du PDF:
- `expect(pdfText).toContain("done")` ou assertion sur la structure checkbox PDF.
- `expect(pdfText).toContain("Footnote body")` pour prouver rendu footnote.

### H1 — High

`tests/integration/` : ajouter un test browser réel pour heading page-break ou documenter explicitement dans `docs/architecture.md` que FR-07 est couvert par le test CSS unitaire seulement (et mettre à jour le mapping).

### H2 — High

`tests/integration/browserBackedConversion.test.ts:131` : ajouter assertion highlighting dans le PDF (ex: structure de police ou contenu `hljs`-tagged dans le PDF text layer) — ou retirer le tag `@req FR-05` si ce test ne peut pas le prouver via PDF brut.

### H3 — High

`package.json:44` : ajouter `vitest run --config vitest.real-browser.config.ts` dans `test:all`, ou créer un script dédié `test:release-grade` qui combine les 3 gates.

### H4 — High

`tests/integration/real-browser-mermaid.test.ts` : ajouter un guard skip avec message explicite (sentinel) si `MD2PDF_SKIP_REAL_BROWSER_TESTS=1` est défini, cohérent avec le pattern de Phase 5.

---

## Limites De Vérification

- `npm run test:real-browser` a été exécuté et a pris 37.66s avec le navigateur installé. Le navigateur utilisé n'a pas été identifié (le test utilise `convertFile` directement sans inspecter le browser choisi).
- Heading page-break: la vérification en PDF brut nécessiterait une analyse structurelle du PDF (pagination, position des headings). C'est faisable via PDF.js ou un parser PDF, mais hors scope de ce snapshot. Le plan Phase 6 demande la couverture mais ne prescrit pas la technique.
- FR-05 (highlighting dans PDF): la couche texte du PDF de Chromium encode les glyphs différemment selon le renderer. Il peut ne pas être possible d'asserter `hljs-keyword` dans le PDF brut. La correction attendue est soit de démontrer l'assertion faisable, soit de mettre à jour le mapping.
- `npm run check:artifacts` non rejoué (non requis par le gate Phase 6).
