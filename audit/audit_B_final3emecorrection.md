
---

## Audit Stream B — Fin de stream · md2pdf v0.1.2

**Scope :** Stream B complet (P1 → P3) — `src/markdownRenderer.ts`, `src/releaseCatalog.ts`, `src/browserLocator.ts`, `src/webDriverClient.ts`, `src/fallbackBrowserProvisioner.ts`, `src/converter.ts`, `assets/`, `tests/unit/` (9 suites stream B), `tests/integration/`  
**Sources d'exigences :** `docs/project_requirements.md`, `docs/plan_stream_b.md`, `docs/architecture.md`  
**Commandes exécutées :** `npm run typecheck` (propre), `npm test` (134/134 vert), `npm run check:artifacts` (propre)

---

## Résumé De L'Audit

| Division | Statut | Synthèse |
| --- | --- | --- |
| Métier (Anton Ego) | 🟡 Avertissement | Deux écarts FR-24/FR-16 confirmés sur la détection Mermaid ; couverture NFR-01 absente |
| Qualité (Gordon Ramsay) | 🟡 Avertissement | Race condition de port + mutation sur le poller Mermaid tuerait sans bruit |
| Architecture (Steve Jobs) | 🟡 Avertissement | Promesse fonts architecturale non tenue ; `NotImplementedError` fantôme |
| Cybersécurité Offensive (Sherlock Holmes) | 🟢 OK | Surfaces défensives solides ; un seul risque TOCTOU classé Medium |

**Verdict global : 🟡 Avertissement — 0 Critique · 2 High · 4 Medium · 3 Low**

---

## Index Des Sous-Audits

| Sous-audit | Scope | Crit | High | Medium | Low | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Business Logic Auditor | FR-24, FR-16, flux Mermaid | 0 | 2 | 0 | 0 | AUDIT_FAIL |
| Requirements Compliance Auditor | Plan B tous @req | 0 | 0 | 2 | 0 | AUDIT_FAIL |
| Doc-Sync Auditor | architecture.md vs code | 0 | 0 | 0 | 1 | AUDIT_FAIL |
| A11y/UX Checker | Non applicable (pas de front-end) | — | — | — | — | N/A |
| Clean Code Auditor | Tous modules stream B | 0 | 0 | 0 | 1 | AUDIT_PASS |
| Fail-Loud Auditor | Chemins d'erreur Mermaid | 0 | 1 | 0 | 0 | AUDIT_FAIL |
| Test Quality Auditor | Tests B + intégration | 0 | 0 | 2 | 1 | AUDIT_FAIL |
| Mutation/Saboteur Auditor | `mermaidReadyScript` | 0 | 1 | 0 | 0 | AUDIT_FAIL |
| Layer Enforcer | Couches modulaires | 0 | 0 | 0 | 0 | AUDIT_PASS |
| YAGNI Auditor | Exports inutilisés | 0 | 0 | 0 | 1 | AUDIT_FAIL |
| SRE/Performance Auditor | Port, temp files, timeouts | 0 | 0 | 1 | 0 | AUDIT_FAIL |
| Architecture Consistency Auditor | architecture.md §10 vs assets/ | 0 | 0 | 0 | 1 | AUDIT_FAIL |
| Contextual Threat Analyst | Path traversal, exfiltration | 0 | 0 | 0 | 0 | AUDIT_PASS |
| SAST Scanner | Injections, SSRF, secrets | 0 | 0 | 0 | 0 | AUDIT_PASS |
| Supply Chain & Artifact Auditor | artifacts.json, checksum | 0 | 0 | 0 | 0 | AUDIT_PASS |
| Privacy/Exfiltration Auditor | CSP, HTML assemblé, logs | 0 | 0 | 0 | 0 | AUDIT_PASS |

---

## Matrice De Couverture (exigences Stream B)

| Req | Fichier(s) | Preuve test | Statut |
| --- | --- | --- | --- |
| FR-01 | `converter.ts` | `converter.test.ts:27`, `browserBackedConversion.test.ts:21` | ✅ |
| FR-04 | `markdownRenderer.ts` | `markdownRenderer.test.ts:11` | ✅ |
| FR-05 | `markdownRenderer.ts` | `markdownRenderer.test.ts:37` | ✅ |
| FR-06 | `markdownRenderer.ts` | `markdownRenderer.test.ts:75,90,111` | ✅ |
| FR-07 | `markdownRenderer.ts`, `webDriverClient.ts` | `markdownRenderer.test.ts:49`, `webDriverClient.test.ts:14` | ✅ |
| FR-16 | `markdownRenderer.ts`, `converter.ts` | `markdownRendererHarness.test.ts:66,88`, `markdownRenderer.test.ts:111` | ⚠️ partiel |
| FR-19 | `browserLocator.ts` | **aucun `@req FR-19` trouvé** | ❌ |
| FR-24 | `markdownRenderer.ts`, `webDriverClient.ts` | `browserBackedConversion.test.ts:21` | ⚠️ H1/H2 |
| NFR-01 | `converter.ts` | **aucun `@req NFR-01` trouvé** | ❌ |
| NFR-02 | `markdownRenderer.ts`, `webDriverClient.ts` | `markdownRenderer.test.ts:135,155`, `webDriverClient.test.ts:171,186,377` | ✅ |
| NFR-03 | `browserLocator.ts` | `browserLocator.test.ts` (9 tests) | ✅ |
| NFR-05 | `artifactPolicy.ts`, `fallbackBrowserProvisioner.ts` | 21 tests | ✅ |

---

## Top Findings

- **[High]** `webDriverClient.ts:466` — `mermaidReadyScript` poll sur `data-processed="true"` que Mermaid v11 pose **avant** l'insertion SVG (ligne `177982` vs `177992` de `mermaid.min.js`) — FR-24 peut être violé silencieusement.
- **[High]** `webDriverClient.ts:463-470` — `data-mermaid-status="error"` (posé par le runner sur `<html>` quand `mermaid.run()` échoue) n'est jamais vérifié ; le PDF est imprimé sans erreur levée — FR-16 et FR-24 violés.
- **[Medium]** `converter.ts:272-285` — `findOpenLocalPort()` libère le port avant que le processus driver le bind (TOCTOU classique).
- **[Medium]** Aucun test `@req NFR-01` (zéro-configuration first run) ni `@req FR-19` (user-scope install).
- **[Medium]** `browserBackedConversion.test.ts:131` n'isole pas l'état "pré-provisionné" et n'identifie pas le type de rendu attendu (rasterisé ou vectoriel) par famille de navigateur.
- **[Low]** `architecture.md §10` promet des fonts bundlées — `assets/` ne contient que `default.css` et `highlight.css`, aucun `fonts/`.

---

## Thèmes Transverses

- **Détection Mermaid** : l'état de completion est ambigu entre le signal `data-processed` (individuel, posé avant render) et `data-mermaid-status` (global, posé après `mermaid.run()`). Le poller WebDriver utilise le premier, le runner script écrit le second. Les deux ne se parlent pas.
- **Couverture @req manquante** : NFR-01 et FR-19 n'ont aucun test tagué, alors que le plan les exige explicitement.
- **Tests d'intégration navigateur** : solides en structure mais manquent de précision sur l'état pré-provisionné et le type d'artefact PDF attendu.

---

## Détails Par Division

### Division Métier (Anton Ego)

*"Un diagramme Mermaid non rendu dans le PDF final est une trahison silencieuse du contrat FR-24. Que le code ne lève pas d'erreur rend cette trahison encore plus élégante — et inexcusable."*

- **[High]** `webDriverClient.ts:466` : violation FR-24/FR-16 — Mermaid error silently lost.
- **[High]** `webDriverClient.ts:463-470` : violation FR-24 — poll prématuré sur `data-processed`.
- **[Medium]** `tests/unit/browserLocator/browserLocator.test.ts` : aucun test ne porte `@req FR-19` alors que `plan_stream_b.md` liste FR-19 comme exigence de Stream B P2.
- **[Medium]** Absence totale de couverture `@req NFR-01` dans toute la suite de tests.

### Division Qualité (Gordon Ramsay)

*"Un poll script de 6 lignes avec un bug de timing sur la condition de sortie — c'est comme prétendre que le soufflé est cuit parce qu'on l'a mis au four."*

- **[High]** `webDriverClient.ts:463-470` — mutation test : si on **supprime** la vérification `svg !== null`, tous les tests passent quand même. Seul `data-processed` est testé, pas le vrai résultat.
- **[Medium]** `findOpenLocalPort()` (`converter.ts:272-285`) : TOCTOU classique — clean code mais comportement fragile.
- **[Low]** `errors.ts:74` : `NotImplementedError` — aucun call site dans les modules Stream B. Dead export.

### Division Architecture (Steve Jobs)

*"Si la documentation promet des fonts bundlées et que le répertoire assets ne contient aucune font, soit le code ment, soit la documentation ment. Dans les deux cas, quelque chose doit être supprimé."*

- **[Low]** `architecture.md §10` : "Fonts are bundled so output is consistent" — aucune font dans `assets/`. `default.css:16` utilise `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial` — des polices système. Écart documentaire.
- **[Low]** `errors.ts:74` : `NotImplementedError` exportée, inutilisée, YAGNI.
- Points conformes : couche provisioning (browserLocator → fallbackProvisioner → releaseCatalog → artifactPolicy) strictement séparée de la couche conversion. Frontière locale/réseau honorée. Chaque module ≤ 300 lignes sauf `fallbackBrowserProvisioner.ts` (613 lignes) — acceptable vu la complexité requise (extraction ZIP, cache metadata, stale purge).

### Division Cybersécurité Offensive (Sherlock Holmes)

*"Élémentaire, et pourtant... l'assemblée HTML est le seul endroit où une donnée utilisateur touche le PDF. Chaque vecteur d'exfiltration a été couvert avec une rigueur inhabituelle."*

- **[Medium]** `converter.ts:272` : TOCTOU port. Scénario : autre processus bind le port libéré → le driver échoue à démarrer → `RenderError` levée. Pas d'exfiltration, pas de corruption — juste une erreur de lancement. Mitigé par le fait que 127.0.0.1 réduit la surface.
- Points conformes :
  - CSP `default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'` — aucune ressource externe possible.
  - `renderLinkOpen()` : `href` supprimé des `<a>` vers URLs externes (`data-md2pdf-blocked-href`).
  - `imageSourceToDataUri()` : URLs HTTP rejetées, paths absolus rejetés, path traversal hors `baseDir` rejeté.
  - SVG avec URLs HTTP rejetés.
  - `resolveInside()` : path traversal dans le ZIP rejeté avant extraction.
  - Zip bomb : limite 20 000 entrées, 1,5 Go décompressé.
  - Checksum SHA-256 vérifié avant ET après cache (double vérification).
  - WebDriver uniquement sur `localhost`/`127.0.0.1`/`::1` — pas de SSRF possible.
  - `webDriverEndpoint()` : absolute paths vers hôtes distants rejetés.
  - `assertFileUrl()` : seules les URLs `file:` avec hostname vide ou `localhost` acceptées.

---

## Détails Par Sous-Audit

### Business Logic Auditor
- **Verdict :** AUDIT_FAIL
- **Findings :**
  - **[High] H1** — `webDriverClient.ts:463-470` : `mermaidReadyScript` vérifie `data-processed === "true"` comme signal de fin de rendu Mermaid. Or Mermaid v11 (`mermaid.js:177982`) pose cet attribut **avant** d'appeler l'opération de rendu asynchrone (`element3.innerHTML = svg2` à la ligne 177992). Sur une page à un seul diagramme, la première itération du poll (pollMs = 100ms par défaut) peut retourner `true` dès que le rendu *démarre*, avant que le SVG soit inséré. Le PDF est alors imprimé avec le texte brut Mermaid à la place du diagramme — violation directe de FR-24.
  - **[High] H2** — Même fichier : si `mermaid.run()` échoue (diagramme syntaxiquement invalide), le runner script (`markdownRenderer.ts:344-346`) pose `data-mermaid-status="error"` sur `<html>`. Le `mermaidReadyScript` ne consulte jamais cet attribut. Comme `data-processed="true"` a déjà été posé sur le nœud (avant la tentative de rendu), le poll retourne `true`, le PDF est imprimé, et aucun `RenderError` n'est levé — violation de FR-16 et FR-24.
- **Points conformes :** Dialecte CommonMark + tables + task lists + footnotes implémenté et testé. Blocs Mermaid correctement émis comme `<div class="mermaid">`. Highlight.js non-Mermaid correct.

### Requirements Compliance Auditor
- **Verdict :** AUDIT_FAIL
- **Findings :**
  - **[Medium]** Aucun test tagué `@req NFR-01` dans toute la suite. `architecture.md §15` exige "integration test: conversion with no config file present". `plan_stream_b.md` liste NFR-01 dans les tags obligatoires.
  - **[Medium]** Aucun test tagué `@req FR-19`. Le plan liste FR-19 en scope Stream B P2. Certes FR-19 est une "Demonstration" per requirements, mais l'absence de tout test traceability est un écart de la politique.
- **Points conformes :** NFR-05 : 21 tests, couverture exhaustive. NFR-02 : 8 tests unitaires + 1 intégration. NFR-03 : 9 tests browserLocator.

### Doc-Sync Auditor
- **Verdict :** AUDIT_FAIL
- **Findings :**
  - **[Low] L1** — Écart documentaire. `architecture.md §10` : *"Fonts are bundled so output is consistent regardless of host-installed fonts."* `assets/default.css:16` utilise exclusivement des noms de polices système (`-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `Helvetica`, `Arial`). Aucun répertoire `assets/fonts/`, aucune déclaration `@font-face`. La promesse de bundling n'est pas tenue. L'architecture doc doit être corrigée ou les fonts doivent être bundlées.
- **Points conformes :** `architecture.md §11` (Chromium-for-Testing "last resort, no declared artifact yet") correspond exactement au code et à `artifacts.json`. Architecture doc correcte sur la séparation provisioning/conversion.

### Clean Code Auditor
- **Verdict :** AUDIT_PASS
- **Findings :**
  - **[Low] L2** — `errors.ts:74` : `NotImplementedError` exportée sans aucun call site dans les modules Stream B (grep confirme). Résidu C0.
- **Points conformes :** Modules < 300 lignes en général. `fallbackBrowserProvisioner.ts` à 613 lignes — la complexité est justifiée (ZIP parser, cache lifecycle, checksum double-check, stale purge). Nommage honnête : `assertUsableCache`, `purgeStaleCaches`, `withTempHtml`. Magic numbers documentés par constantes nommées (`maxArchiveEntries`, `maxArchiveUncompressedBytes`, `requiredQuarantineDays`).

### Fail-Loud Auditor
- **Verdict :** AUDIT_FAIL
- **Findings :**
  - **[High] H2** (voir Business Logic) — Mermaid render failure silently lost.
- **Points conformes :** `cleanupTempHtml()` refuse les paths non-managés avec `RenderError`. `assertFileUrl()` échoue fort sur les URLs non-locales. `handleCleanup()` ne supprime pas l'erreur primaire. Driver cleanup en `finally` confirmé. Erreur `integrity-mismatch` levée avant extraction.

### Test Quality Auditor
- **Verdict :** AUDIT_FAIL
- **Findings :**
  - **[Medium] M3** — `browserBackedConversion.test.ts:21` : le test déclare "renders Mermaid to a real PDF with a pre-provisioned browser" mais utilise `new DocumentConverter({ tempDir })` sans injecter de browser pré-provisionné. Le test dépend du navigateur installé sur la machine hôte. Le plan (`plan_stream_b.md`) exige un état pré-provisionné explicite : "cache rempli explicitement avant le test". Ce test est donc un skip crédible (`MD2PDF_SKIP_REAL_BROWSER_TESTS=1`) mais pas une vraie preuve de release NFR-02 "depuis état pré-provisionné".
  - **[Medium] M4** — `browserBackedConversion.test.ts:130` : `pdfContainsVisualObject` accepte indifféremment `/XObject`, `/Subtype /Image`, ou `/Subtype /Form`. Le plan exige : "Le type attendu (rasterisé ou vectoriel) est fixé selon le navigateur de référence CI et documenté dans le test." Ni le type attendu ni le navigateur de référence ne sont documentés.
- **Points conformes :** Test `converter.test.ts:64` confirme l'absence de PDF partiel après échec de rendu. `fallbackBrowserProvisioner.test.ts` : 14 tests, couverture remarquable des chemins d'erreur (integrité, partial cache, tampered, non-executable, purge). `afterEach` cleanup systématique dans tous les tests avec temp dirs.

### Mutation/Saboteur Auditor
- **Verdict :** AUDIT_FAIL
- **Findings :**
  - **[High] H1** — Mutation test sur `mermaidReadyScript` (`webDriverClient.ts:463-470`) : si on supprime la condition `node.querySelector("svg") !== null || node.querySelector("img") !== null` et ne garde que `data-processed === "true"`, **tous les tests unitaires passent**. La condition SVG n'est testée par aucun test. La fausse confiance est confirmée.
- **Points conformes :** Mutation `assertChecksum` : si on supprime la comparaison de taille (`data.byteLength !== release.size`), le test `integrity-mismatch` échoue correctement. Mutation `resolveInside` : si on supprime la guard `startsWith("..")`, le test zip-traversal le détecte.

### Layer Enforcer
- **Verdict :** AUDIT_PASS
- **Findings :** Aucun.
- **Points conformes :** `converter.ts` orchestre mais ne lit pas le contenu Markdown directement (délégué à `markdownRenderer`). `browserLocator.ts` ne provisionne pas (délégué à `fallbackBrowserProvisioner`). `webDriverClient.ts` n'accède jamais au filesystem. `releaseCatalog.ts` est purement lecture.

### YAGNI Auditor
- **Verdict :** AUDIT_FAIL
- **Findings :**
  - **[Low] L2** (voir Clean Code) — `NotImplementedError` dead export.
- **Points conformes :** `BrowserLocatorOptions.candidatePaths` est peuplé par les tests — pas spéculatif. `BrowserProbe.inspect?` est utilisé dans les tests avec `InspectingBrowserProbe`. `ConvertOptions.browserPath` est consommé dans `defaultBrowserLocatorFactory`.

### SRE/Performance Auditor
- **Verdict :** AUDIT_FAIL
- **Findings :**
  - **[Medium] M1** — `converter.ts:272-285` : TOCTOU port. `findOpenLocalPort()` ouvre un serveur TCP sur le port 0 (OS alloue), récupère le port, ferme le serveur, puis passe le port au processus driver. Entre `server.close()` et `spawn(browser.driverPath, ...)`, un autre processus peut bind ce port. Le driver échoue à démarrer → `RenderError`. Ce n'est pas un vecteur de sécurité mais une fragilité SRE sous charge parallèle (ex : batch de conversions simultanées).
- **Points conformes :** `withAbortableTimeout` nettoie le `setTimeout` dans `finally`. `waitForProcessExit` a un `SIGKILL` fallback après `driverShutdownTimeoutMs` (5s). Temp files nettoyés dans tous les chemins (success, error, timeout) grâce au pattern `withTempHtml` + `finally`. Nettoyage du `.tmp-{uuid}` en cas d'échec d'écriture PDF (`removeTemporaryOutput`).

### Architecture Consistency Auditor
- **Verdict :** AUDIT_FAIL
- **Findings :**
  - **[Low] L1** (voir Doc-Sync) — Fonts promise architecturale non tenue.
- **Points conformes :** `architecture.md §11` déclare Chromium-for-Testing comme "last resort, no eligible artifact declared yet" — code `converter.ts:244-262` (`ArtifactPolicyFallbackBrowserResolver`) correspond. `architecture.md §5` : tous les composants listés existent et font exactement ce qui est décrit.

### Contextual Threat Analyst
- **Verdict :** AUDIT_PASS
- **Findings :** Aucun.
- Scénarios analysés : injection via contenu Mermaid → contenu HTML-escaped avant insertion (`md.utils.escapeHtml`). Exfiltration via image SVG avec URL externe → détection `containsHttpUrl` et `RenderError`. Cache poisoning via fake artifact → double checksum (archive + metadata post-extraction). Path traversal ZIP → `resolveInside` avant ET après extraction.

### SAST Scanner
- **Verdict :** AUDIT_PASS
- **Findings :** Aucun.
- Points vérifiés : pas d'injection shell (tous les `execFile` passent des tableaux d'arguments). Pas de `eval`. Pas de secrets hardcodés. `JSON.parse` wrappé avec try/catch. Inputs utilisateur (`src` d'images) validés avant usage filesystem.

### Supply Chain & Artifact Auditor
- **Verdict :** AUDIT_PASS
- **Findings :** Aucun.
- **Points conformes :** `artifacts.json` déclare `url` HTTPS immuable (no query, no fragment) pour tous les artifacts. `sha256` 64 chars hex enforced. `publishedAt` validé comme date ISO. `quarantineDays` figé à 7 et non-overridable par l'appelant (`assertRequiredQuarantineDays`). `url: "latest"` rejeté (`isFloatingVersion` + `isImmutableHttpsUrl`). Freshness script (`checkArtifactFreshness.mjs`) : passe.

### Privacy/Exfiltration Auditor
- **Verdict :** AUDIT_PASS
- **Findings :** Aucun.
- **Points conformes :** CSP `default-src 'none'` interdit toute ressource externe depuis le HTML généré. `renderLinkOpen()` supprime les `href` vers URLs HTTP — liens rendus inertes dans le PDF. Aucune URL externe dans le HTML assemblé (testé par `markdownRenderer.test.ts:135`). WebDriver lancé avec `--no-proxy-server` / `--offline` (Chrome) et `--offline` (Firefox). Aucun log de contenu Markdown dans les erreurs (`RenderError` contient `sourcePath` et `actionHint`, pas le contenu).

---

## Points Conformes (remarquables)

- ✅ 134 tests / 134 verts, 0 erreur TypeScript, artifact freshness OK.
- ✅ PDF atomique : écriture via `.tmp-{uuid}` + `rename` — aucun PDF partiel visible.
- ✅ `withTempHtml` : cleanup dans les 3 chemins (succès, erreur, timeout). AbortSignal propagé.
- ✅ Double vérification SHA-256 : à l'import dans le cache ET à la réutilisation (metadata + live hash).
- ✅ Zip bomb mitigation : 20 000 entrées max, 1,5 Go décompressé max, détection header EOCD.
- ✅ Path traversal artifact : `resolveInside()` protège avant ET après extraction.
- ✅ `ArtifactPolicy.selectNewestEligible` : quarantineDays imposé à 7, non-bypassable.
- ✅ Finaliser session WebDriver + process driver confirmé dans `finally` même sur timeout.
- ✅ `waitForMermaid` : boucle correcte avec `deadline` recalculé à chaque itération.
- ✅ `cleanupTempHtml` refuse de supprimer des paths non-enregistrés dans `tempHtmlDirectories`.
- ✅ CSP `default-src 'none'` + absence totale d'URL externe dans le HTML.
- ✅ `InMemoryReleaseCatalog` injectable — policy testable sans filesystem.
- ✅ `purgeStaleCaches` nettoie automatiquement les versions périmées du cache.

---

## Limites De Vérification

- `npm run test:browser` non exécuté (nécessite navigateur + driver installés sur la machine).
- Comportement réel de Mermaid v11 sur `data-processed` avant/après SVG insert confirmé par lecture de `mermaid.js:177979-177992` (minified) — non simulé en test.
- `npm run test:artifacts` non exécuté séparément (couvert par `npm test`).
- FR-19 / NFR-01 sont des "Demonstration" requirements — impossible à vérifier automatiquement sans environnement d'installation réel.
- Comportement Windows non vérifié (NFR-03 Platform portability) — limité à lecture de code.

---

**Résumé : 2 High à corriger avant release — tous les deux sur `mermaidReadyScript` dans `webDriverClient.ts`. Les 4 Medium sont des dettes de test et un risque SRE connu. La supply chain et la sécurité défensive du code sont solides.**