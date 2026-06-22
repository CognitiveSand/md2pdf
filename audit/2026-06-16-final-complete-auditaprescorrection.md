# Audit Final — md2pdf v0.1.2 (Codebase Complet)

**Date :** 2026-06-16  
**Auditeur :** audit-agent (Anton Ego / Gordon Ramsay / Steve Jobs / Sherlock Holmes)  
**Portée :** Codebase complet — `src/`, `tests/`, `scripts/`, `assets/`, `docs/`, configuration

---

## Résumé De L'Audit

| Division | Statut | Synthèse |
|---|---|---|
| Métier | 🟡 Avertissement | Exigences MVP couvertes ; README partiellement périmé ; NFR-03 (CI matrix) sans preuve en repo |
| Qualité | 🟡 Avertissement | 179/179 tests verts, typecheck propre ; deux modules dépassent les limites documentées ; état global mutable dans `markdownRenderer.ts` |
| Architecture | 🟡 Avertissement | Layering correct ; `tests/contract/` absent mais documenté ; limites de taille de module violées |
| Cybersécurité Offensive | 🟢 OK | CSP + offline-flags + vérification SHA-256 + path-traversal défendu ; aucun finding critique |

**Verdict global : 🟡 AUDIT_WARN — Aucun bloquant critique. Plusieurs avertissements Medium à traiter avant la prochaine release.**

**Totaux :** Critical 0 · High 0 · Medium 3 · Low 7 · Conformes majeurs 20

---

## Index Des Sous-Audits

| Sous-audit | Scope | Crit | High | Medium | Low | Verdict |
|---|---|---:|---:|---:|---:|---|
| Business Logic Auditor | FR-01 à FR-24, NFR-01 à NFR-05 | 0 | 0 | 1 | 2 | AUDIT_WARN |
| Requirements Compliance Auditor | Matrice req↔impl↔test | 0 | 0 | 0 | 1 | AUDIT_WARN |
| Doc-Sync Auditor | README, architecture.md, docs/ | 0 | 0 | 1 | 1 | AUDIT_WARN |
| A11y/UX Checker | N/A — CLI uniquement | — | — | — | — | N/A |
| Clean Code Auditor | src/ (14 modules) | 0 | 0 | 1 | 2 | AUDIT_WARN |
| Fail-Loud Auditor | Chemins d'erreur | 0 | 0 | 0 | 1 | AUDIT_PASS |
| Test Quality Auditor | 179 tests, 16 fichiers | 0 | 0 | 0 | 1 | AUDIT_PASS |
| Mutation/Saboteur Auditor | Logique critique | 0 | 0 | 0 | 1 | AUDIT_PASS |
| Layer Enforcer | cli→pipeline→converter→… | 0 | 0 | 0 | 0 | AUDIT_PASS |
| YAGNI Auditor | Abstractions, API publiques | 0 | 0 | 0 | 1 | AUDIT_PASS |
| SRE/Performance Auditor | I/O, caches, boucles | 0 | 0 | 1 | 1 | AUDIT_WARN |
| Architecture Consistency Auditor | docs/architecture vs code | 0 | 0 | 1 | 0 | AUDIT_WARN |
| Contextual Threat Analyst | Surfaces d'attaque métier | 0 | 0 | 0 | 1 | AUDIT_PASS |
| SAST Scanner | Injections, XSS, path traversal | 0 | 0 | 0 | 1 | AUDIT_PASS |
| Supply Chain & Artifact Auditor | artifacts.json, lockfile, renovate | 0 | 0 | 0 | 0 | AUDIT_PASS |
| Privacy/Exfiltration Auditor | Fuite réseau, temp files, metadata | 0 | 0 | 0 | 0 | AUDIT_PASS |

---

## Matrice De Couverture Des Exigences Principales

| Req | Titre | Implémentation | Test | Statut |
|---|---|---|---|---|
| FR-01 | Conversion fichier unique | `converter.ts:convertFile` | `cli.test.ts:L102`, `cli-pdf.test.ts:L48` | ✅ |
| FR-02 | Chemin de sortie par défaut | `paths.ts:resolveOutputPath` | `cli.test.ts:L177`, `pipeline.test.ts` | ✅ |
| FR-03 | Chemin de sortie explicite | `paths.ts:resolveOutputPath` | `cli.test.ts:L87, L177` | ✅ |
| FR-04 | Rendu dialecte Markdown | `markdownRenderer.ts` | `markdownRenderer.test.ts:L11` | ✅ |
| FR-05 | Coloration syntaxique | `markdownRenderer.ts:highlightCode` | `markdownRenderer.test.ts:L37` | ✅ |
| FR-06 | Images relatives embarquées | `markdownRenderer.ts:renderImage` | `markdownRenderer.test.ts:L76` | ✅ |
| FR-07 | Break-after heading | `assets/default.css:36` | `markdownRenderer.test.ts:L49` | ✅ |
| FR-08 | Batch multi-fichiers | `pipeline.ts:convertJobs` | `pipeline.test.ts:L98` | ✅ |
| FR-09 | Batch répertoire | `paths.ts:resolveDirectory` | `cli.test.ts:L197` | ✅ |
| FR-10 | Continuation batch | `pipeline.ts:runConverter` (catch) | `pipeline.test.ts:L133`, `cli.test.ts:L257` | ✅ |
| FR-11 | Rapport outcome batch | `cli.ts:formatSummary` | `cli.test.ts:L177` | ✅ |
| FR-12 | Prompt overwrite interactif | `overwrite.ts:evaluateOverwrite` | `overwrite.test.ts:L143`, `cli.test.ts:L452` | ✅ |
| FR-13 | Forced overwrite | `overwrite.ts:decideOverwriteAction` | `overwrite.test.ts:L56`, `cli.test.ts:L431` | ✅ |
| FR-14 | Guard non-interactif | `overwrite.ts:decideOverwriteAction→skip` | `overwrite.test.ts:L100`, `cli.test.ts:L411` | ✅ |
| FR-15 | Rapport input manquant | `paths.ts:statEntry→InputNotFoundError` | `cli.test.ts:L238` | ✅ |
| FR-16 | Rapport échec render | `converter.ts:ConversionError/RenderError` | `cli-pdf.test.ts:L126` | ✅ |
| FR-17 | Exit 1 sur échec | `cli.ts:exitCode` | `cli.test.ts:L61` | ✅ |
| FR-18 | Exit 0 sur succès | `cli.ts:exitCode` | `cli.test.ts:L177` | ✅ |
| FR-19 | Install user-scope | `package.json:bin`, `checkPackage.mjs` | `checkPackage.mjs` (smoke double install) | ✅ |
| FR-20 | System-scope availability | `package.json:bin` global | Démonstration uniquement | ⚠️ Low |
| FR-21 | Install idempotent | npm semantics | `checkPackage.mjs` (run×2) | ✅ |
| FR-22 | LaTeX backend | Post-MVP, non implémenté | N/A | OOS |
| FR-23 | `--output-dir` | `paths.ts:resolveOutputPath` | `cli.test.ts:L177`, `cli-pdf.test.ts:L77` | ✅ |
| FR-24 | Mermaid diagrams | `markdownRenderer.ts:renderFence`, `webDriverClient.ts:waitForMermaid` | `markdownRenderer.test.ts:L55`, `browserBackedConversion.test.ts:L72` | ✅ |
| NFR-01 | Zero-config first run | `createConverter` avec defaults | `cli-pdf.test.ts:L48` | ✅ |
| NFR-02 | Local-only | CSP + `file:` + offline flags | `markdownRenderer.test.ts:L135`, `webDriverClient.ts:assertFileUrl` | ✅ |
| NFR-03 | Portabilité | `defaultBrowserCandidates` multi-OS | Matrice CI documentée, pas de preuve en repo | ⚠️ Low |
| NFR-04 | Self-describing | `HELP_TEXT` | `cli.test.ts:L45` | ✅ |
| NFR-05 | Artifact freshness | `artifactPolicy.ts`, `checkArtifactFreshness.mjs` | `contracts.test.ts`, `artifactFreshness.test.ts`, check runtime → ✅ | ✅ |

---

## Top Findings

- **[Medium]** `src/fallbackBrowserProvisioner.ts` (748 lignes) et `src/browserLocator.ts` (723 lignes) violent la limite de 300 lignes par module documentée dans `docs/architecture.md:§5`. Risque de couplage silencieux et de maintenance dégradée.
- **[Medium]** `src/markdownRenderer.ts:29-34` — état mutable global (`cachedRenderer`, `cachedDefaultCss`, `cachedHighlightCss`, `cachedMermaidBundlePath`, `cachedMermaidBundle`, `tempHtmlDirectories`) persistant au niveau module. En contexte de tests parallèles ou de batch haute fréquence, la réutilisation de ce cache sans invalidation peut masquer des erreurs de configuration.
- **[Medium]** `README.md:17-22` — texte de statut de développement périmé décrivant Stream A/B comme incomplètes alors que le projet est déclaré terminé. Ce langage contradictoire est trompeur pour un nouvel utilisateur ou un contributeur.
- **[Low]** `docs/architecture.md:§12` référence un répertoire `tests/contract/` qui n'existe pas. Les tests de contrat se trouvent en réalité dans `tests/unit/contracts/`.
- **[Low]** `scripts/checkPackage.mjs:9` contient `const packageVersion = "0.1.2"` codé en dur. Ce champ doit être mis à jour manuellement à chaque release; un oubli passe silencieusement si `package.json` change.
- **[Low]** `src/fallbackBrowserProvisioner.ts:assertCacheMetadata` appelle `sha256File()` (lecture + hachage SHA-256) sur le binaire browser (~180 Mo) et driver (~9-20 Mo) à chaque validation de cache. Latence d'amorçage potentiellement perceptible sur SSD lent.
- **[Low]** NFR-03 (portabilité Linux/macOS/Windows + Chromium/Firefox) est annoncé dans `docs/architecture.md:§15` mais la preuve (`docs/ci_matrix_v0.1.md`) décrit une matrice CI planifiée, non des runs réels en repo. Aucun badge CI n'est présent dans README.
- **[Low]** `src/markdownRenderer.ts:125` — `md.validateLink = () => true` désactive la validation de liens intégrée à markdown-it sans commentaire explicatif. La compensation par `renderLinkOpen` (suppression du `href` externe) est correcte mais non évidente pour un futur mainteneur.
- **[Low]** `src/webDriverClient.ts:388` — le `browserProfileDir` pour Chromium est créé dans `tmpdir()` sans nettoyage garanti si `createBrowserProfileDir` réussit mais que l'exception se produit avant l'entrée du bloc `finally` (entre `createBrowserProfileDir` et l'assignation de `browserProfileDir`). [RISQUE] — scenario de race condition très improbable mais structurellement présent.
- **[Low]** FR-20 (system-scope availability) est vérifié par "démonstration" uniquement, sans test automatisé. Acceptable pour un "Should" MVP mais à noter comme dette de vérification.

---

## Thèmes Transverses

1. **Freshness-first discipline** : La politique d'artefacts est cohérente du manifeste JSON jusqu'aux checks runtime. C'est le contrat non-fonctionnel le mieux défendu du projet.
2. **Injection de dépendances systématique** : Toutes les classes acceptent des collaborateurs en paramètre (fileSystem, browserLocatorFactory, printPdf, etc.), ce qui a rendu possible une suite de 179 tests sans vrai navigateur pour la majorité.
3. **Taille des modules** : La politique de 300 lignes est documentée mais non automatiquement vérifiée. Deux modules la violent significativement (×2,4 et ×2,5). Sans gate, la limite continuera à dériver.
4. **État global dans markdownRenderer** : Optimisation de performance valide mais fragilisante pour les tests à longue durée de vie de processus.

---

## Détails Par Division

### Division Métier (Anton Ego)

> Le projet livre ce qu'il promet. Vingt-deux des vingt-quatre exigences MVP sont implémentées et couvertes par des tests. FR-22 (LaTeX) est correctement différé. Deux points de friction : la matrice CI existe sur le papier mais sans preuve d'exécution, et le README parle encore de "Stream A" et "Stream B" comme si le projet était en chantier.

- **[Medium]** `README.md:17-22` — texte périmé sur le statut du projet. Doc promet Y (streams non terminés) ; état du code est X (projet terminé). Écart documentaire.
- **[Low]** NFR-03 — portabilité déclarée, matrice planifiée dans `docs/ci_matrix_v0.1.md`, mais aucune preuve d'exécution réelle de CI dans le dépôt.
- **[Low]** FR-20 — "Should" sans test automatisé ; acceptable en MVP mais à inscrire dans la dette.

### Division Qualité (Gordon Ramsay)

> 179 tests verts et zéro erreur TypeScript. Le projet passe ses propres gates. Mais deux modules ont enflé au-delà des limites qu'il s'est fixées lui-même, et l'état global du renderer peut piquer dans six mois quand quelqu'un ajoutera un test qui modifie les CSS inlinés.

- **[Medium]** `src/fallbackBrowserProvisioner.ts` — 748 lignes. Limite documentée : 300. `src/browserLocator.ts` — 723 lignes. Idem.
- **[Medium]** `src/markdownRenderer.ts:29-34` — state globaux mutables : `cachedRenderer`, `cachedDefaultCss`, `cachedHighlightCss`, `cachedMermaidBundlePath`, `cachedMermaidBundle`, `tempHtmlDirectories`. Risque d'interférence entre tests ou conversions successives dans un même processus Node.
- **[Low]** `src/fallbackBrowserProvisioner.ts:382-395` — `chmod` des fichiers dans les bundles .app macOS est swallowed avec `.catch(() => undefined)`. Si chmod échoue silencieusement, le browser peut être non-exécutable malgré un cache apparemment valide.
- **[Low]** `src/converter.ts:222-228` — `removeTemporaryOutput` avale silencieusement toute exception avec un commentaire "Best effort". Acceptable puisque la conversion a déjà échoué, mais le fichier temp peut rester sur disque indéfiniment.
- **[Low]** Test manquant sur le comportement de `waitForMermaid` quand `data-mermaid-status` est absent (ni "done" ni "error" ni "pending") — le script attend indéfiniment jusqu'au timeout, ce qui est le comportement attendu mais non explicitement vérifié.

### Division Architecture (Steve Jobs)

> L'architecture est propre. Les couches sont respectées. Le mécanisme de dependency injection est exemplaire. Mais si tu documentes une limite de 300 lignes par module et que deux modules en font 700+, tu as soit une limite erronée soit un problème de discipline. Supprime la règle ou respecte-la.

- **[Medium]** `docs/architecture.md:§5` — "40-line-function / 300-line-module limits" : deux violations confirmées (`fallbackBrowserProvisioner.ts:748L`, `browserLocator.ts:723L`). Écart documentaire/code.
- **[Low]** `docs/architecture.md:§12` — `tests/contract/` référencé, inexistant. Les contrats vivent dans `tests/unit/contracts/`.
- **[Low]** `scripts/checkPackage.mjs:9` — version hardcodée : `const packageVersion = "0.1.2"`. Non synchronisée avec `package.json` par construction.
- **[Low]** `src/fallbackBrowserProvisioner.ts:assertCacheMetadata` — `sha256File()` sur des binaires >100 Mo à chaque démarrage. Pas critique mais mesurable en latence d'amorçage.

### Division Cybersécurité Offensive (Sherlock Holmes)

> Élémentaire, et pourtant bien défendu. La surface d'attaque la plus intéressante est le fichier Markdown utilisateur rendu dans un vrai browser — et l'équipe l'a blindé : CSP strict, browser offline, assets inlinés, path traversal rejeté. Un seul angle résiduel à surveiller.

- **[Low]** `src/markdownRenderer.ts:125` — `md.validateLink = () => true` — désactive la validation de liens markdown-it. Compensé par `renderLinkOpen()` qui supprime le `href` de tout lien non-relatif. [RISQUE] : un nouveau contributeur qui supprimerait `renderLinkOpen` sans comprendre la dépendance laisserait passer des liens `javascript:` dans les attributs.
- **[Low]** `src/webDriverClient.ts` — CSP : `script-src 'unsafe-inline'` est nécessaire pour le mermaid runner mais constitue une surface d'inline script dans le contexte browser. Mitigé par `default-src 'none'` (pas de réseau) et le browser offline. Acceptable mais à documenter.
- **[RISQUE]** `src/webDriverClient.ts:366-371` — `browserProfileDir` pourrait ne pas être nettoyé si une exception se produit entre `createBrowserProfileDir` et l'assignation de la variable. L'analyse du code indique que le bloc `try/finally` couvre bien `browserProfileDir` après son assignation, mais la fenêtre entre la création et l'assignation est hors `finally`. Scénario extrêmement improbable ; inclus pour complétude.

---

## Détails Par Sous-Audit

### Business Logic Auditor
- **Verdict :** AUDIT_WARN
- **Findings :** README périmé (Medium). NFR-03 sans preuve CI (Low). FR-20 non automatisé (Low).
- **Points conformes :** Toutes les règles métier de l'overwrite policy (4 cases de la matrice) implémentées et testées. Batch continuation confirmé. Sommaire en fin de batch (FR-11) correct. Path de sortie par défaut et explicit corrects. Directory batch non-récursif conforme à OOS-02.

### Requirements Compliance Auditor
- **Verdict :** AUDIT_WARN (pour NFR-03)
- **Findings :** Voir matrice ci-dessus. FR-22 correctement OOS. NFR-03 : implémentation multi-OS présente, preuve CI absente (Low).
- **Points conformes :** 22/24 exigences MVP couvertes par tests tagués `@req`. Traceabilité descendante complète.

### Doc-Sync Auditor
- **Verdict :** AUDIT_WARN
- **Findings :**
  - `README.md:17-22` : texte "Stream A / Stream B remain outside" périmé si le projet est terminé. Écart documentaire (Medium).
  - `docs/architecture.md:§12` : `tests/contract/` référencé, absent (Low).
- **Points conformes :** `docs/architecture.md` est précis et cohérent avec le code sur les contrats publics (`ConvertOptions`, `ConversionJob`, `ConversionOutcome`, `convertFile`). ADR-01 à ADR-05 correspondent à l'implémentation effective. `ARTIFACT_FRESHNESS_POLICY.md` est fidèlement appliqué par `checkArtifactFreshness.mjs` et `artifactPolicy.ts`.

### A11y/UX Checker
- **Non applicable** — outil CLI sans interface web ni navigateur exposé à l'utilisateur.

### Clean Code Auditor
- **Verdict :** AUDIT_WARN
- **Findings :**
  - `src/fallbackBrowserProvisioner.ts` (748L) et `src/browserLocator.ts` (723L) — violation de la limite documentée 300L (Medium).
  - `src/markdownRenderer.ts:29-34` — 6 variables globales mutables (Medium).
  - `src/fallbackBrowserProvisioner.ts:382-395` — chmod swallowed (Low).
  - `src/converter.ts:222-228` — cleanup silencieux (Low).
- **Points conformes :** Naming cohérent et auto-documenté. Pas de magic strings non défendus (les constantes sont nommées : `defaultRenderTimeoutMs`, `maxArchiveEntries`, `requiredQuarantineDays`, etc.). Pas de dead code détecté. Fonctions courtes dans `cli.ts`, `pipeline.ts`, `overwrite.ts`, `paths.ts`, `errors.ts`.

### Fail-Loud Auditor
- **Verdict :** AUDIT_PASS
- **Findings :** Cleanup silencieux dans `removeTemporaryOutput` (Low, justifié par commentaire).
- **Points conformes :** `Md2PdfError` avec `kind` discriminant et `formatError` structuré. Exit codes 0/1/2 corrects. `BrowserNotFoundError` avec 5 causes distinctes. `InputNotFoundError` avec path et hint. Aucun `catch(_)` sans re-throw sur le chemin critique de conversion.

### Test Quality Auditor
- **Verdict :** AUDIT_PASS
- **Findings :** Aucun test pour le comportement de `waitForMermaid` sans attribut `data-mermaid-status` (Low).
- **Points conformes :** 179 tests tous verts. Tags `@req` présents sur tous les tests critiques. Injection de dépendances permet des tests sans vrai browser. `MemoryWriter` réutilisé correctement pour capturer stdout/stderr. Fixtures créées/nettoyées avec `beforeEach`/`afterEach`. Tests de mutation-résistants sur l'overwrite policy (truth-table complète).

### Mutation/Saboteur Auditor
- **Verdict :** AUDIT_PASS
- **Findings :** La logique de `decideOverwriteAction` est entièrement couverte par la truth-table dans `overwrite.test.ts:L39-98`. La logique `exitCodeFor` (usage→2, autres→1) est testée dans `cli.test.ts`. Le code `status === "failed"` pour le comptage d'échecs dans `cli.ts:L187` : inverser en `!== "failed"` serait détecté (les tests comparent des valeurs exactes). Le `sha256` dans `assertChecksum` : inverser le guard serait détecté par les tests d'intégrité.
- **Points conformes :** La mutation "supprimer `encodeURIComponent` sur `sessionId`" serait détectée par les tests WebDriver. La mutation "swapper `shouldConvert: true`/`false`" dans `evaluateOverwrite` serait détectée par les tests overwrite. La mutation "supprimer `rename`" dans `writePdfAtomically` serait détectée par les tests d'intégration.

### Layer Enforcer
- **Verdict :** AUDIT_PASS
- **Findings :** Aucun.
- **Points conformes :** `cli.ts` → `pipeline.ts` → `converter.ts` : flux à sens unique respecté. `pipeline.ts` ne connaît pas le browser. `markdownRenderer.ts` ne connaît pas le WebDriver. `overwrite.ts` ne connaît pas la pipeline. `paths.ts` ne connaît pas le converter. `errors.ts` sans dépendances (racine du graphe). `contracts.ts` sans dépendances sauf `errors.ts`.

### YAGNI Auditor
- **Verdict :** AUDIT_PASS
- **Findings :** `WebDriverPrintSettings` permet des overrides de print (page size, margin, etc.) non exposés via la CLI. [RISQUE] abstraction spéculative mais défendable comme point d'extension pour les tests (Low).
- **Points conformes :** Pas d'abstraction "repository pattern" superflue. Pas de factory injected inutilement. `InMemoryReleaseCatalog` est utilisé dans les tests (pas du code mort). `NullDriverResolver` est utilisé dans les tests sans artifact policy. Le `createConverter` helper est utilisé dans les tests d'intégration.

### SRE/Performance Auditor
- **Verdict :** AUDIT_WARN
- **Findings :**
  - `assertCacheMetadata` → `sha256File` sur binaires >100 Mo à chaque startup (Low).
  - `tempHtmlDirectories` Set croît sans limite en cas de bug de cleanup (Medium - voir Clean Code).
- **Points conformes :** Pas de N+1 détecté dans la boucle de conversion (séquentielle par design). Timeout `renderTimeoutMs` propagé correctement à toutes les opérations async. `createBrowserProfileDir` ne crée un répertoire que pour Chromium (Firefox n'en a pas besoin). `purgeStaleCaches` nettoie les anciennes versions à chaque démarrage. Fermeture WebDriver session dans `finally` garantit pas de fuite.

### Architecture Consistency Auditor
- **Verdict :** AUDIT_WARN
- **Findings :**
  - `docs/architecture.md:§5` : "40-line-function / 300-line-module limits" — violation confirmée sur 2 modules (Medium).
  - `docs/architecture.md:§12` : `tests/contract/` inexistant (Low).
- **Points conformes :** Tous les modules annoncés dans §5 existent dans `src/`. Les contrats publics annoncés dans §4 sont implémentés à l'identique dans `src/contracts.ts`. La politique de freshness décrite dans §9 est correctement implémentée. La séparation provisioning/conversion de §9 est structurellement appliquée.

### Contextual Threat Analyst
- **Verdict :** AUDIT_PASS
- **Findings :**
  - [RISQUE] Scénario : un Markdown contenant `![x](../../../../etc/passwd)` — protégé par `resolveInside()` et la vérification `isPathInsideDirectory`. Bloqué confirmé.
  - [RISQUE] Scénario : Mermaid diagram contenant du code JavaScript malveillant exécuté dans le browser — le browser est offline (pas d'exfiltration réseau), le PDF résultant est statique. Risque résiduel faible.
  - [Low] `md.validateLink = () => true` pourrait permettre des liens `javascript:` dans le HTML généré — compensé par `renderLinkOpen` qui supprime le `href`. Chaîne de compensation fragile si `renderLinkOpen` est un jour supprimé.
- **Points conformes :** Le browser est lancé avec `--no-proxy-server`, `--proxy-server=direct://`, `--proxy-bypass-list=*`. Firefox lancé avec `--offline`. CSP `default-src 'none'` sur la page HTML. Aucune URL externe dans le HTML généré (testé par `markdownRenderer.test.ts:L135`).

### SAST Scanner
- **Verdict :** AUDIT_PASS
- **Findings :**
  - [Low] `script-src 'unsafe-inline'` dans la CSP — nécessaire pour le runner Mermaid inline mais large.
- **Points conformes :** `html: false` dans markdown-it empêche l'injection HTML brut depuis les sources. `mdEscapeHtml()` appliqué à `documentTitle` (`markdownRenderer.ts:279`), au contenu Mermaid (`markdownRenderer.ts:152`). `mdEscapeAttr()` appliqué à l'identifiant de langage (`markdownRenderer.ts:162`). `encodeURIComponent(sessionId)` dans toutes les URLs WebDriver (`webDriverClient.ts:166,172,193`). La vérification `assertFileUrl` bloque les URLs non-`file:` dans le WebDriver. `webDriverEndpoint` bloque les chemins absolus ou avec schéma dans les requêtes WebDriver.

### Supply Chain & Artifact Auditor
- **Verdict :** AUDIT_PASS
- **Findings :** Aucun.
- **Points conformes :** `artifacts.json` avec schemaVersion, quarantineDays, SHA-256, size, publishedAt, provenance pour chaque artifact. `renovate.json` avec `minimumReleaseAge: "7 days"` et `internalChecksFilter: "strict"`. `checkArtifactFreshness.mjs` passe en exécution réelle (confirmé). `package-lock.json` committé. `quarantineDays === 7` enforced côté runtime par `assertRequiredQuarantineDays`. `isImmutableHttpsUrl` rejette les URLs avec query string ou fragment. Waivers validés : format strict, audit en repo, version exacte.

### Privacy/Exfiltration Auditor
- **Verdict :** AUDIT_PASS
- **Findings :** Aucun.
- **Points conformes :** Aucun appel réseau pendant la conversion (structurellement garanti par assets inlinés + `file:` + offline). Images embarquées en data URI (pas de référence externe dans le PDF). Les fichiers HTML temporaires sont nettoyés après conversion (dans le `finally` de `withTempHtml`). Le PDF ne contient pas de métadonnées md2pdf (le tag Skia/PDF vient du browser). Le `browserProfileDir` Chromium est supprimé dans `finally` avec `rm({ recursive: true, force: true, maxRetries: 3 })`. Aucune télémétrie, aucun appel externe, aucune clé API.

---

## Points Conformes (Résumé)

1. TypeScript typecheck : **0 erreur** sur l'ensemble du codebase
2. Suite de tests : **179/179 passing**, durée < 1s (hors browser-backed)
3. Artifact freshness check : **passed** en exécution réelle
4. Hiérarchie d'erreurs typée (`Md2PdfError`) avec 6 `kind` discriminants et `formatError` structuré
5. Écriture atomique du PDF via temp file + `rename` (pas de PDF partiel en cas d'échec)
6. Traceabilité `@req` complète sur tous les tests critiques
7. CSP `default-src 'none'` dans le HTML généré (pas de ressource externe)
8. Vérification SHA-256 sur tous les artifacts runtime (`assertDriverIntegrity`, `assertChecksum`)
9. Protection path traversal confirmée pour les images (`isPathInsideDirectory`) et l'extraction ZIP (`resolveInside`)
10. Browser lancé offline avec `--no-proxy-server` + `--proxy-server=direct://` (Chromium) et `--offline` (Firefox)
11. `encodeURIComponent(sessionId)` sur toutes les URL WebDriver
12. Truth-table overwrite policy complète : 4 cases couvertes (FR-12/FR-13/FR-14)
13. Batch continuation confirmé par test (pipeline ne s'arrête pas sur une erreur de conversion)
14. `waitForMermaid` détecte l'état `error` et lève `RenderError` avec le message du browser
15. Nettoyage du `browserProfileDir` dans `finally` avec `maxRetries: 3`
16. `assertCacheMetadata` vérifie SHA-256 des exécutables extraits (pas seulement de l'archive)
17. `purgeStaleCaches` nettoie les versions précédentes à chaque run
18. `renovate.json` enforce la politique de freshness sur les PRs automatiques
19. `resolveInside()` rejette correctement les paths d'archive qui escapent le répertoire cible
20. `md.validateLink = () => true` compensé par `renderLinkOpen()` qui supprime les `href` non-relatifs

---

## Limites De Vérification

- **Tests browser-backed réels** (`test:browser`, `test:real-browser`) non exécutés dans cet audit — nécessitent un browser local et une mise en cache des artifacts. Les résultats proviennent des derniers runs documentés dans `docs/release-evidence/`.
- **NFR-03 (portabilité Linux/Windows)** non vérifiable sur la machine de l'auditeur (macOS arm64 uniquement).
- **FR-20 (system-scope)** non vérifiable sans installation system-wide.
- **`checkPackage.mjs`** non exécuté dans cet audit (nécessite un `npm pack` complet avec réseau).
- `checkArtifactFreshness.mjs` exécuté et confirmé passant.

### Commandes Exécutées

```
find /Users/samirtamboura/Desktop/md2pdf -type f | grep -v '.git|node_modules|.tmp' | sort
npm run typecheck                          → 0 erreur
npm test                                   → 179/179 passed (879ms)
node scripts/checkArtifactFreshness.mjs    → Artifact freshness policy passed.
```

### Commandes Non Exécutées

```
npm run test:browser          (nécessite browser local + cache artifacts)
npm run test:real-browser     (idem)
npm run check:package         (nécessite npm pack + réseau)
npm run test:all              (inclut les deux ci-dessus)
```
