# Audit implémentation Phase 5 (post-correction) - Clarifier provisioning / conversion local-only

Date: 2026-06-15

Source de vérité:

- `docs/post-audit-remediation-plan-2026-06-12.md`, section "Phase 5 - Clarifier la frontière provisioning / conversion local-only" lignes 271-300.
- Audit précédent (NO-GO): `audit/2026-06-15-phase-5-current-teamcomplete-audit.md`, commit `c247fa43`.
- Commit audité (post-correction): `642ba19` (HEAD de `plan/v0.1.1_restart`).

Périmètre audité:

- `src/converter.ts`
- `src/webDriverClient.ts`
- `tests/integration/browserBackedConversion.test.ts`
- `tests/integration/converter.test.ts`
- `tests/integration/cli-pdf.test.ts`
- `tests/unit/converter/converter.test.ts`
- `tests/unit/browserLocator/browserLocator.test.ts`
- `tests/unit/webDriverClient/webDriverClient.test.ts`
- `vitest.browser.config.ts`

Commandes exécutées:

```text
npm run typecheck
Résultat: PASS (tsc --noEmit, zéro erreur)

npm test
Résultat: PASS - 14 fichiers, 156 tests passés, 1 skipped

npm run test:browser
Résultat: FAIL
  Test Files: 1 failed | 2 passed (3)
  Tests: 22 passed | 2 skipped (24)
  Erreur: ArtifactFreshnessError dans beforeAll de browserBackedConversion.test.ts
  "No compatible artifact release has completed quarantine"
```

---

## Résumé de l'Audit

| Division | Statut | Synthèse |
| --- | --- | --- |
| Métier | 🔴 Bloquant | gate `test:browser` rouge, conversion pre-provisionnée sans connexion sortante non prouvée |
| Qualité | 🟡 Avertissement | nouvelles preuves solides, mais beforeAll fragile sur artifact manquant |
| Architecture | 🟢 OK | ordre access→locate→read cohérent, interfaces correctement étendues |
| Cybersécurité Offensive | 🟢 OK | flags offline, NFR-02 mieux prouvé, chaîne locate→read robuste |

---

## Index des Sous-Audits

| Sous-audit | Scope | Crit | High | Medium | Low | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Business Logic Auditor | Phase 5 objectifs vs implémentation | 1 | 1 | 1 | 0 | AUDIT_FAIL |
| Requirements Compliance Auditor | NFR-02, ordre normatif, gate | 1 | 0 | 1 | 1 | AUDIT_FAIL |
| Doc-Sync Auditor | Plan vs code vs tests | 0 | 0 | 1 | 0 | AUDIT_PASS |
| A11y/UX Checker | N/A | - | - | - | - | N/A |
| Clean Code Auditor | Fichiers modifiés | 0 | 0 | 1 | 1 | AUDIT_PASS |
| Fail-Loud Auditor | beforeAll, provisioning path | 1 | 0 | 0 | 0 | AUDIT_FAIL |
| Test Quality Auditor | Nouvelles assertions, preuves NFR-02 | 0 | 1 | 1 | 0 | AUDIT_FAIL |
| Mutation/Saboteur Auditor | Tests ordre et pre-provisioned | 0 | 0 | 1 | 0 | AUDIT_PASS |
| Layer Enforcer | converter, webDriverClient | 0 | 0 | 0 | 0 | AUDIT_PASS |
| YAGNI Auditor | Nouvelles abstractions | 0 | 0 | 0 | 1 | AUDIT_PASS |
| SRE/Performance Auditor | beforeAll provisioning, timeout | 0 | 0 | 1 | 0 | AUDIT_PASS |
| Architecture Consistency Auditor | Plan phase 5 vs code livré | 0 | 0 | 1 | 0 | AUDIT_PASS |
| Contextual Threat Analyst | Surface NFR-02 | 0 | 0 | 1 | 0 | AUDIT_PASS |
| SAST Scanner | Nouveaux chemins code | 0 | 0 | 0 | 0 | AUDIT_PASS |
| Supply Chain & Artifact Auditor | Artifact freshness gate | 1 | 0 | 0 | 0 | AUDIT_FAIL |
| Privacy/Exfiltration Auditor | NFR-02, contenu Markdown | 0 | 0 | 0 | 0 | AUDIT_PASS |

**Totaux normalisés: Critique 3 · High 2 · Medium 7 · Low 2**

---

## Ce qui a changé depuis le premier audit Phase 5 (c247fa43 → 642ba19)

| Finding précédent | Statut post-correction |
| --- | --- |
| Finding 1 Critique — gate `test:browser` rouge (RenderError: WebDriver request failed) | Partiellement adressé: `--remote-debugging-pipe` et `--no-sandbox` ajoutés à `src/webDriverClient.ts:399,402`, mais gate toujours rouge pour une raison différente (ArtifactFreshnessError dans beforeAll) |
| Finding 2 High — test "pre-provisioned" pouvait encore provisionner pendant `convertFile` | Résolu: `beforeAll` provisionne explicitement via `provisionFallbackBrowser()`, `preProvisionedConverter` injecte un locator direct, `locateCalls` prouve l'appel unique |
| Finding 3 Medium — preuve "provisioning ne reçoit jamais le contenu Markdown" trop superficielle | Partiellement adressé: ajout de `converter.test.ts:134-206` (ordre complet, pre-provisioned sans fallback), mais le chemin réel de provisioning (`ArtifactPolicyFallbackBrowserResolver`) reste non instrumenté |
| Finding 4 Medium — ordre locate→read dégrade les erreurs utilisateur sur fichier manquant | Résolu: `assertSourceAccessible` appelée avant `locate()` (`converter.ts:105`), prouvée par `converter/converter.test.ts:93-115` |

---

## Top Findings

- **[Critique]** `tests/integration/browserBackedConversion.test.ts:30` — `beforeAll` appelle `provisionFallbackBrowser()` sans artifact Chromium éligible dans la quarantaine de cet environnement. `ArtifactFreshnessError` tue toute la suite. Gate `npm run test:browser` rouge.
- **[Critique]** `tests/integration/browserBackedConversion.test.ts:13-14` — `MD2PDF_SKIP_REAL_BROWSER_TESTS=1` permet de skiper silencieusement les 2 tests browser réels et de faire passer le gate sans preuve. Phase 5 gate doit être vert sans skip.
- **[Critique]** `src/converter.ts:289-300` / plan phase 5 ligne 280 — "conversion pré-provisionnée n'ouvre pas de connexion sortante" : aucun test ne prouve qu'un `DocumentConverter` avec browser pré-provisionné n'active pas de connexion réseau sortante. `preProvisionedConverter` injecte un locator direct mais `ArtifactPolicyFallbackBrowserResolver` reste dans le chemin par défaut.
- **[High]** `tests/integration/browserBackedConversion.test.ts:29-43` — Si `provisionFallbackBrowser()` réussit (environment avec artifact), les tests réels tournent. Mais si l'artifact doit être téléchargé, le `hookTimeout: 30_000` du `vitest.browser.config.ts` est insuffisant pour un premier téléchargement. Le test peut produire un faux timeout.
- **[High]** `tests/integration/converter.test.ts:86-111` — Le test "browserLocatorFactory does not receive Markdown source content" ne couvre que les options sérialisées en JSON, pas les chemins de `ArtifactPolicyFallbackBrowserResolver`, `JsonReleaseCatalog` ou `provisionFallbackBrowser` qui pourraient lire le système de fichiers.

---

## Thèmes Transverses

- **Gate rouge par ArtifactFreshnessError, non par RenderError**: la cause du gate rouge a changé (c'est une amélioration structurelle) mais le gate reste rouge. Le beforeAll est le nouveau point de fragilité.
- **NFR-02 mieux prouvé sur les chemins fake/unitaire**: l'ordre `access→locate→read` a deux niveaux de preuve, la chaîne "missing source → pas de provisioning" est complète. La lacune est sur le chemin de provisioning réel.
- **Flags WebDriver corrigés**: `--remote-debugging-pipe` et `--no-sandbox` corrigent la cause technique des échecs RenderError de l'audit précédent. Confirmés par le test unitaire `webDriverClient.test.ts:49-51`.

---

## Matrice Exigences Phase 5

| Exigence phase 5 | Statut | Evidence | Problème résiduel |
| --- | --- | --- | --- |
| Ordre normatif: provisioning avant conversion | Confirmé | `converter.ts:105-106`, `converter.test.ts:62` ordre `[access, locate, read, ...]` | Aucun |
| Ordre normatif: conversion strictement local-only | Confirmé unitaire | `webDriverClient.ts:246-264, 282-291`, `webDriverClient.test.ts:412-433` | Non prouvé end-to-end avec navigateur réel |
| Ordre normatif: provisioning ne lit pas le Markdown | Confirmé partiel | `converter.test.ts:86-111` (options sérialisées) | Chemin réel `ArtifactPolicyFallbackBrowserResolver` non instrumenté |
| Ordre normatif: conversion pré-provisionnée sans connexion sortante | Manquant | Aucun test ne prouve l'absence de connexion sortante pendant `convertFile` avec browser pré-provisionné | Critique non adressé |
| Ajuster convertisseur pour ordre observable | Confirmé | `converter.ts:105` `assertSourceAccessible` avant `locate()` | Aucun |
| Test: provisioning ne reçoit jamais le contenu Markdown | Partiel | `converter.test.ts:86-111` | Chemin reel non prouvé |
| Test: conversion depuis état pré-provisionné ne provisionne pas | Confirmé (unitaire) | `converter.test.ts:134-179`, ordre exact `locate-pre-provisioned` | Gate browser rouge empêche la preuve intégration |
| Test: HTML assemblé sans URL externe exploitable | Confirmé | `markdownRenderer.test.ts:135-152`, `markdownRenderer.ts:203-217` | Aucun |
| Test: WebDriver local refuse endpoints non locaux | Confirmé | `webDriverClient.ts:246-264`, `webDriverClient.test.ts:412-433` | Aucun |
| Test: browser lancé avec flags offline/no-proxy | Confirmé | `webDriverClient.ts:397-408`, `webDriverClient.test.ts:47-58` | Aucun |
| Marquer limites non interceptables comme risques documentés | Manquant | `docs/architecture.md` risque R-3 existant non mis à jour | Aucun nouveau risque documenté pour "connexion sortante" |
| Gate: `npm test` | Respecté | 14 fichiers, 156 tests, 1 skipped | Aucun |
| Gate: `npm run test:browser` | Non respecté | ArtifactFreshnessError dans beforeAll | **Bloquant** |

---

## Détails par Division

### Division Métier (Anton Ego)

> Le contrat est clair sur quatre invariants. Trois sont prouvés correctement. Le quatrième — "conversion pré-provisionnée n'ouvre pas de connexion sortante" — n'est attesté par aucune preuve instrumentée. C'est la clause centrale de NFR-02. Sans elle, la phase n'est pas livrée.

- **[Critique]** `docs/post-audit-remediation-plan-2026-06-12.md:280` — "conversion pré-provisionnée n'ouvre pas de connexion sortante": aucun test ne vérifie que `DocumentConverter` avec un locator pre-provisioned n'active pas `ArtifactPolicyFallbackBrowserResolver.resolveFallbackBrowser()` ni aucune autre connexion réseau. `preProvisionedConverter` injecte un locator qui ne provisionne pas, mais ne stubise pas le réseau.
- **[High]** Gate `npm run test:browser` rouge: le premier invariant de la gate (preuve browser-backed) ne peut être validé.
- **[Medium]** `docs/post-audit-remediation-plan-2026-06-12.md:292` — "Marquer les limites non interceptables comme risques documentés": `docs/architecture.md` n'a pas été mis à jour pour le scénario "connexion sortante non vérifiable en test unitaire".

### Division Qualité (Gordon Ramsay)

> Le `beforeAll` qui appelle `provisionFallbackBrowser()` sans filet, c'est poser une casserole ouverte sur le feu et partir. Si l'artifact n'est pas en cache, la cuisine brûle avant que le cuisinier revienne. Le reste des tests est correctement cuisinés.

- **[Critique]** `tests/integration/browserBackedConversion.test.ts:29-43` — `beforeAll` sans `try/catch` autour de `provisionFallbackBrowser`. Sur un environnement sans artifact éligible en quarantaine, `ArtifactFreshnessError` tue la suite entière et produit 2 tests "skipped" qui masquent l'échec réel. Aucune bannière ni message actionnable pour le développeur CI.
- **[High]** `tests/integration/converter.test.ts:86-111` — Test NFR-02 "browserLocatorFactory does not receive Markdown source content": sérialise uniquement les `ConvertOptions` transmises à la factory. Ne couvre pas `ArtifactPolicyFallbackBrowserResolver`, `JsonReleaseCatalog` ni `provisionFallbackBrowser` qui lisent le filesystem et pourraient accéder indirectement à `sourcePath`.
- **[Medium]** `tests/integration/converter.test.ts:181-206` — Test "does not read Markdown when browser provisioning fails" vérifie l'ordre `["access", "locate"]`. Correct, mais le `recordingFileSystem` enregistre `access` comme premier événement. Si `assertSourceAccessible` était supprimée, ce test passerait quand même car `locate` échoue avant `read`. La mutation "supprimer `assertSourceAccessible`" n'est pas tuée par ce test seul.

### Division Architecture (Steve Jobs)

> Une décision simple et juste: `assertSourceAccessible` avant `locate()`. Trois lignes qui résolvent deux problèmes. C'est ça, l'architecture.

- **[OK]** `src/converter.ts:105-106` — L'ordre `access → locate → read` est sémantiquement propre, testé à deux niveaux, cohérent avec NFR-02 et avec l'UX attendu.
- **[OK]** `src/webDriverClient.ts:399,402` — `--remote-debugging-pipe` et `--no-sandbox` sont dans la bonne fonction (`browserCapabilities`), documentés par le test unitaire. Pas de duplication.
- **[OK]** `tests/integration/cli-pdf.test.ts:391-393` — `fakeFileSystem()` étend correctement l'interface `ConverterFileSystem` avec `access()`.
- **[Medium]** `src/converter.ts:283-301` — `ArtifactPolicyFallbackBrowserResolver` est une classe privée dans `converter.ts`. Elle ne peut pas être stubisée ou instrumentée depuis les tests d'intégration sans modifier l'injection de dépendances. C'est un angle mort architectural pour la preuve NFR-02 "sans connexion sortante".

### Division Cybersécurité Offensive (Sherlock Holmes)

> Élémentaire: la chaîne `access → locate → read` est maintenant prouvable, et les flags réseau de Chromium sont corrects. Le seul angle d'attaque restant est le gap entre "locator injecté qui ne provisionne pas" et "ArtifactPolicyFallbackBrowserResolver qui pourrait être activé autrement".

- **[OK]** `src/webDriverClient.ts:397-408` — Chromium: `--no-proxy-server`, `--proxy-server=direct://`, `--proxy-bypass-list=*`, `--no-sandbox`, `--remote-debugging-pipe`. Couverture réseau complète.
- **[OK]** `tests/unit/webDriverClient/webDriverClient.test.ts:412-433` — Deux tests NFR-02: rejet d'endpoint non-local, rejet de path absolu non-localhost. Preuves directes.
- **[Medium]** [RISQUE] `src/converter.ts:269-301` — `defaultBrowserLocatorFactory` instancie toujours `ArtifactPolicyFallbackBrowserResolver`. Si une régression future fait appeler `resolveFallbackBrowser()` même avec un browser pré-provisionné (ex: race condition dans `BrowserLocator.locateFallbackBrowser()`), une connexion réseau sortante serait initiée pendant `convertFile`. Aucun test ne détecte ce scénario car les tests browser réels utilisent un locator injecté, pas le default factory.
- **[OK]** `tests/integration/converter.test.ts:181-206` — "does not read Markdown when browser provisioning fails": preuve que le Markdown ne transite pas en cas d'échec.

---

## Détails par Sous-Audit Spécialisé

### Business Logic Auditor

- Verdict: AUDIT_FAIL
- Findings:
  - **[Critique]** "conversion pré-provisionnée sans connexion sortante" non instrumentée.
  - **[Medium]** Risques non documentés dans `docs/architecture.md`.
- Points conformes: trois invariants NFR-02 sur quatre prouvés correctement.

### Requirements Compliance Auditor

- Verdict: AUDIT_FAIL
- Voir matrice ci-dessus.

### Doc-Sync Auditor

- Verdict: AUDIT_PASS
- Findings:
  - **[Medium]** `docs/architecture.md` risque R-3 non mis à jour pour le scénario "conversion pré-provisionnée et connexion sortante".
- Points conformes: aucune contradiction entre README et implémentation introduite.

### A11y/UX Checker

- Non applicable — pas de surface UI/front-end.

### Clean Code Auditor

- Verdict: AUDIT_PASS
- Findings:
  - **[Medium]** `src/converter.ts:111-117` et `src/converter.ts:144-151` — Message d'erreur identique "Markdown source could not be read during conversion" pour deux chemins différents (ENOENT via `access`, ENOENT via `readFile`). Un utilisateur ne peut pas distinguer les deux cas depuis le message.
  - **[Low]** `tests/integration/browserBackedConversion.test.ts:174-188` — `preProvisionedConverter` lève `new Error("Real browser tests require a pre-provisioned browser")` sans indiquer pourquoi le `beforeAll` a échoué.
- Points conformes:
  - `preProvisionedConverter`, `pdfContainsVisualObject`, `tinyPng()` correctement isolés.
  - `locateCalls` array pattern clair et réutilisé deux fois.

### Fail-Loud Auditor

- Verdict: AUDIT_FAIL
- Findings:
  - **[Critique]** `tests/integration/browserBackedConversion.test.ts:29-43` — `provisionFallbackBrowser()` dans `beforeAll` sans guard ni message d'erreur actionnable pour CI. `ArtifactFreshnessError` produit des tests "2 skipped" dans la sortie vitest au lieu de "2 failed".
- Points conformes:
  - `assertSourceAccessible` produit un `ConversionError` avec `actionHint` utile.
  - `locateCalls.toEqual(["pre-provisioned"])` échoue explicitement si locate n'est pas appelé.

### Test Quality Auditor

- Verdict: AUDIT_FAIL
- Findings:
  - **[High]** `tests/integration/converter.test.ts:86-111` — Assertion sur `JSON.stringify(capturedOptions)`: ne prouve pas que les dépendances de provisioning réel ne lisent pas `sourcePath` via un autre chemin.
  - **[Medium]** `tests/integration/converter.test.ts:181-206` — La mutation "supprimer `assertSourceAccessible`" n'est pas tuée: si `locate()` échoue, l'ordre reste `["locate"]` sans `access`, et le test passe quand même car il vérifie uniquement l'absence de `"read"` dans l'ordre.
- Points conformes:
  - `converter.test.ts:134-179` — Ordre complet `["access", "locate-pre-provisioned", "read", "start", "print", "mkdir", "write", "rename"]` résistant aux mutations de séquençage.
  - `converter/converter.test.ts:93-115` — `locatorCalled === false` pour source manquante: mutation "supprimer `assertSourceAccessible`" tuée.
  - `webDriverClient.test.ts:412-433` — Deux tests NFR-02 WebDriver solides.

### Mutation/Saboteur Auditor

- Verdict: AUDIT_PASS
- Findings:
  - **[Medium]** Si on inverse l'ordre `assertSourceAccessible` / `locate()` dans `converter.ts`, le test `converter/converter.test.ts:93-115` (`locatorCalled === false`) échoue. Mutation tuée.
  - Si on supprime `assertSourceAccessible` entièrement, le test `converter/converter.test.ts:93-115` échoue. Mutation tuée.
  - Si on supprime `locateCalls.push("pre-provisioned")`, le test `converter.test.ts:114` échoue. Mutation tuée.
  - Si on supprime la vérification d'ordre dans `converter.test.ts:62`, la mutation "inverser locate et read" n'est plus détectée. [RISQUE] de régression silencieuse si ce test est supprimé.
- Points conformes: les tests d'ordre sont les plus résistants aux mutations.

### Layer Enforcer

- Verdict: AUDIT_PASS
- Points conformes:
  - `assertSourceAccessible` dans `DocumentConverter`, pas dans `BrowserLocator`.
  - `ArtifactPolicyFallbackBrowserResolver` dans `converter.ts` (côté conversion), non dans `browserLocator.ts`.

### YAGNI Auditor

- Verdict: AUDIT_PASS
- Findings:
  - **[Low]** `locateCalls` array dans les tests browser réels: indirection utile, mais pourrait être un simple compteur si l'identifiant "pre-provisioned" n'est pas destiné à évoluer.
- Points conformes: aucune abstraction spéculative introduite.

### SRE/Performance Auditor

- Verdict: AUDIT_PASS
- Findings:
  - **[Medium]** `tests/integration/browserBackedConversion.test.ts:29-43` — `provisionFallbackBrowser()` dans `beforeAll` sans timeout explicite. `vitest.browser.config.ts` a `hookTimeout: 30_000`. Un premier téléchargement d'artifact Chromium (~170 MB) dépasse 30s sur connexion lente, causant un faux timeout.
- Points conformes:
  - `afterEach` nettoie `tempRoots` correctement.
  - `afterAll` restaure `MD2PDF_ARTIFACT_CACHE`.
  - `renderTimeoutMs: 60_000` aligné avec `testTimeout: 60_000`.

### Architecture Consistency Auditor

- Verdict: AUDIT_PASS
- Findings:
  - **[Medium]** Le plan phase 5 action 4 demande de "marquer les limites non interceptables comme risques documentés". `docs/architecture.md` risque R-3 existant n'a pas été mis à jour pour inclure "connexion sortante non vérifiable en test unitaire lors de conversion avec default factory".
- Points conformes:
  - Actions 1, 2, 3 (partiellement) du plan sont reflétées dans le code.

### Contextual Threat Analyst

- Verdict: AUDIT_PASS
- Findings:
  - **[Medium]** [RISQUE] `MD2PDF_SKIP_REAL_BROWSER_TESTS=1` en CI masque les échecs browser. Le gate phase 5 est `npm run test:browser` sans condition sur cette variable.
- Points conformes:
  - `MD2PDF_ARTIFACT_CACHE` isole les artifacts de test de l'environnement système.

### SAST Scanner

- Verdict: AUDIT_PASS
- Findings: Aucune injection, path traversal, secret ou désérialisation non sécurisée détectée dans les modifications.
- Points conformes:
  - `--no-sandbox` est un choix conscient pour environnement conteneurisé.
  - `--proxy-server=direct://` maintient l'isolation réseau Chromium.

### Supply Chain & Artifact Auditor

- Verdict: AUDIT_FAIL
- Findings:
  - **[Critique]** `tests/integration/browserBackedConversion.test.ts:30` — `provisionFallbackBrowser()` dans `beforeAll` dépend de `artifacts.json` avec un artifact ayant complété la quarantaine. Sur cet environnement: `ArtifactFreshnessError: No compatible artifact release has completed quarantine`. Le gate `test:browser` échoue pour cette raison.
- Points conformes:
  - Le mécanisme de cache `MD2PDF_ARTIFACT_CACHE` est correctement utilisé.
  - `ArtifactPolicy.selectNewestEligible` applique bien les règles de quarantaine (prouvé par `contracts.test.ts`).

### Privacy/Exfiltration Auditor

- Verdict: AUDIT_PASS
- Points conformes:
  - `converter.test.ts:107-110` — `JSON.stringify(capturedOptions)` ne contient pas le contenu Markdown.
  - `converter.test.ts:181-206` — Markdown non lu si provisioning échoue.
  - Aucune fuite de `sourcePath` ou contenu Markdown dans les logs ou PDF détectée.

---

## Limites de Vérification

- `npm run test:browser` exécuté et échoue sur `ArtifactFreshnessError` dans `beforeAll`. Les 2 tests browser réels n'ont pas tourné sur cet environnement.
- `npm run test:real-browser` non exécuté (hors scope phase 5).
- "Connexion sortante pendant conversion pré-provisionnée" non vérifiable sans stub réseau ou proxy d'interception. Déclaré [RISQUE] documentaire.
- `docs/architecture.md` lu pour le risque R-3 existant; aucune modification récente constatée.

---

## Summary

La phase 5 post-correction résout trois des quatre findings de l'audit précédent: le WebDriver est réparé (`--remote-debugging-pipe`, `--no-sandbox`), le test pre-provisioned est instrumenté proprement (`beforeAll` + `preProvisionedConverter` + `locateCalls`), et l'UX de source manquante est préservée (`assertSourceAccessible` avant `locate()`). La chaîne de preuve NFR-02 sur les chemins unitaires et intégration fake est solide.

Il reste deux blocages pour déclarer la phase terminée:

1. **Gate `npm run test:browser` rouge** — `beforeAll` échoue avec `ArtifactFreshnessError`. La cause technique du RenderError (flags WebDriver) est adressée, mais le gate ne peut pas être validé sans artifact Chromium éligible en quarantaine dans l'environnement.

2. **"Conversion pré-provisionnée sans connexion sortante" non prouvée** — L'invariant central de NFR-02 reste sans preuve instrumentée. `preProvisionedConverter` évite le provisioning via injection, mais `ArtifactPolicyFallbackBrowserResolver` dans le default factory n'est pas stubisé ni intercepté.

**Statut audit: NO-GO phase 5.**
