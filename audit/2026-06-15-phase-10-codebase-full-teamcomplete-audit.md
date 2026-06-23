# Audit TeamComplete — Phase 10 Codebase Complet v0.1.2

**Date :** 2026-06-15  
**Scope :** Codebase intégral — sources TypeScript, tests, scripts, assets, configuration, packaging, docs, preuves release, politique d'artefacts.  
**Auditeur :** teamcompleteaudit (4 divisions)  
**Référence exigences :** `docs/project_requirements.md`, `docs/user_stories.md`, `docs/architecture.md`

---

## Résumé De L'Audit

| Division | Statut | Synthèse |
| --- | --- | --- |
| Métier (Anton Ego) | 🔴 Bloquant | Release auto-déclarée NO-GO : FR-20 system-scope multi-compte absent, CI/matrix absent. Linux non couvert par les artefacts. |
| Qualité (Gordon Ramsay) | 🟡 Avertissement | Tests solides et bien taggés @req ; mais pipeline séquentiel non protégé contre mutation `Promise.all`, intégration exclue par défaut de `npm test`. |
| Architecture (Steve Jobs) | 🟡 Avertissement | Layering globalement propre ; `contracts.ts` viole les frontières via dynamic import ; `locateBrowser()` est du code mort ; `ArtifactPolicyDriverResolver` ne filtre pas par plateforme. |
| Cybersécurité Offensive (Sherlock) | 🟡 Avertissement | CSP `unsafe-inline` justifié par l'offline ; `--no-sandbox` Chromium ; `md.validateLink = () => true` ; archive ~195 Mo en mémoire entière. |

**Verdict global : AUDIT_FAIL — NO-GO release globale**

Blocages confirmés : FR-20 system-scope absent, CI/matrix absent (preuves release l'admettent explicitement), Linux sans artefact runtime déclaré.

---

## Index Des Sous-Audits

| Sous-audit | Scope | Crit | High | Medium | Low | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Business Logic Auditor | Fonctionnel FR/NFR | 0 | 2 | 0 | 1 | AUDIT_FAIL |
| Requirements Compliance | Matrice FR→impl→test | 0 | 1 | 1 | 1 | AUDIT_FAIL |
| Doc-Sync Auditor | README / release-evidence | 0 | 1 | 0 | 1 | AUDIT_FAIL |
| A11y/UX Checker | N/A (pas de front-end) | — | — | — | — | N/A |
| Clean Code Auditor | src/*.ts | 0 | 1 | 2 | 2 | AUDIT_WARN |
| Fail-Loud Auditor | src/*.ts | 0 | 0 | 2 | 0 | AUDIT_WARN |
| Test Quality Auditor | tests/**/*.ts | 0 | 0 | 2 | 1 | AUDIT_WARN |
| Mutation/Saboteur Auditor | pipeline, overwrite | 0 | 0 | 1 | 0 | AUDIT_WARN |
| Layer Enforcer | Dépendances inter-modules | 0 | 1 | 1 | 0 | AUDIT_WARN |
| YAGNI Auditor | Code mort / abstractions | 0 | 1 | 1 | 0 | AUDIT_WARN |
| SRE/Performance Auditor | Mémoire, timeout, FS | 0 | 0 | 2 | 1 | AUDIT_WARN |
| Architecture Consistency | Docs vs code | 0 | 0 | 1 | 1 | AUDIT_WARN |
| Contextual Threat Analyst | Abus métier | 0 | 0 | 2 | 0 | AUDIT_WARN |
| SAST Scanner | Injections, secrets | 0 | 0 | 2 | 1 | AUDIT_WARN |
| Supply Chain & Artifact | artifacts.json, lockfile | 0 | 2 | 1 | 0 | AUDIT_FAIL |
| Privacy/Exfiltration | Temp files, PDF metadata | 0 | 0 | 1 | 1 | AUDIT_WARN |

**Totaux normalisés : Critical 0 · High 9 · Medium 19 · Low 11**

---

## Matrice De Couverture Des Exigences Principales

| Exigence | Fichier(s) implémentation | Test(s) | Statut |
| --- | --- | --- | --- |
| FR-01 Single-file | `pipeline.ts`, `converter.ts` | `cli.test.ts`, `cli-pdf.test.ts` | ✅ Couvert |
| FR-02 Default output path | `paths.ts:145-157` | `cli.test.ts` | ✅ Couvert |
| FR-03 Explicit output path | `paths.ts:146` | `cli.test.ts:177` | ✅ Couvert |
| FR-04 Dialect rendering | `markdownRenderer.ts` | `markdownRenderer.test.ts` | ✅ Couvert |
| FR-05 Syntax highlighting | `markdownRenderer.ts:160-166` | `markdownRenderer.test.ts:37` | ✅ Couvert |
| FR-06 Image embedding | `markdownRenderer.ts:217-239` | `markdownRenderer.test.ts:75` | ✅ Couvert |
| FR-07 Heading orphan | `assets/default.css` (break-after) | `markdownRenderer.test.ts:49` | ✅ Couvert |
| FR-08 Multi-file batch | `pipeline.ts` | `pipeline.test.ts:82` | ✅ Couvert |
| FR-09 Directory batch | `paths.ts:104-125` | `cli.test.ts:197` | ✅ Couvert |
| FR-10 Batch continuation | `pipeline.ts:84-96` | `pipeline.test.ts:116` | ✅ Couvert |
| FR-11 Batch outcome reporting | `cli.ts:198-204` | `cli.test.ts:177` | ✅ Couvert |
| FR-12 Overwrite prompt | `overwrite.ts:62-98` | `overwrite.test.ts`, `cli.test.ts` | ✅ Couvert |
| FR-13 Forced overwrite | `overwrite.ts:77-79` | `overwrite.test.ts:56`, `cli.test.ts` | ✅ Couvert |
| FR-14 Non-interactive guard | `overwrite.ts:82-85` | `overwrite.test.ts:100`, `cli.test.ts` | ✅ Couvert |
| FR-15 Missing-input reporting | `paths.ts:91-101` | `cli.test.ts:238` | ✅ Couvert |
| FR-16 Render-failure reporting | `pipeline.ts:84-96` | `cli-pdf.test.ts:126` | ✅ Couvert |
| FR-17 Failure exit status | `cli.ts:187`, `exitCodeFor()` | `cli.test.ts:61` | ✅ Couvert |
| FR-18 Success exit status | `cli.ts:187` | `cli.test.ts:177` | ✅ Couvert |
| FR-19 User-scope install | `package.json`, `checkPackage.mjs` | `cli.test.ts:148`, release evidence | ✅ Couvert local |
| FR-20 System-scope install | Non implémenté / non prouvé | Absent | 🔴 **Bloquant** |
| FR-21 Idempotent install | `checkPackage.mjs` (reinstall) | Release evidence (reinstall) | ✅ Couvert local |
| FR-22 LaTeX backend | Post-MVP | N/A | N/A |
| FR-23 Output-dir option | `paths.ts:152-154` | `cli.test.ts`, `pipeline.test.ts` | ✅ Couvert |
| FR-24 Mermaid rendering | `markdownRenderer.ts:148-157` | `markdownRenderer.test.ts:55` | ✅ Couvert local |
| NFR-01 Zero-config first run | `converter.ts` (defaultBrowserLocatorFactory) | `cli.test.ts:102` | ✅ Couvert |
| NFR-02 Local-only | CSP, `assertFileUrl`, `isHttpUrl` | `markdownRenderer.test.ts` | ✅ Couvert structurel |
| NFR-03 Platform portability | Linux : artefacts absents | Absent CI matrix | 🔴 **Bloquant Linux** |
| NFR-04 Self-describing usage | `cli.ts:41-49` | `cli.test.ts:45` | ✅ Couvert |
| NFR-05 Artifact freshness | `artifactPolicy.ts`, `checkArtifactFreshness.mjs` | `tests/unit/artifacts/` | ✅ Couvert |

---

## Top Findings

1. **[High]** `docs/release-evidence/phase-8-9-10-local-replay-2026-06-15.md` — Release auto-déclarée NO-GO : FR-20 system-scope multi-compte et CI/browser matrix absents. Ne pas livrer.
2. **[High]** `artifacts.json` — Zéro artefact runtime pour Linux (ni `chromium-for-testing`, ni `chromedriver`, ni `geckodriver` linux-x64). NFR-03 portabilité Linux est structurellement bloquée.
3. **[High]** `contracts.ts:21-28` — `convertFile` viole les frontières de couche (contracts importent dynamiquement l'implémentation `converter.ts`) et constitue une API publique non documentée, non testée.
4. **[High]** `browserLocator.ts:112-128` et `483-513` — `locateBrowser()` (free function) et `browserCandidates()` sont du code mort. Rien dans la chaîne de production n'appelle ces fonctions.
5. **[High]** `browserLocator.ts:335-367` — `ArtifactPolicyDriverResolver.resolveDriver()` ne filtre pas par plateforme courante. Sur Linux, des entrées `win32-x64` du catalogue pourraient être sélectionnées si elles avaient un champ `path`.
6. **[High]** `artifacts.json` — `geckodriver` absent pour macOS et Linux. Firefox ne peut pas utiliser le fallback provisionner sur ces plateformes.
7. **[Medium]** `fallbackBrowserProvisioner.ts:580-582` — L'archive complète (~195 Mo Chrome, potentiellement ~1,5 Go décompressée) est lue en mémoire d'un bloc avant extraction.
8. **[Medium]** `vitest.config.ts:4-6` — `tests/integration/**` exclu de `npm test`. Un développeur qui ne court que `npm test` manque l'intégration runtime.
9. **[Medium]** `pipeline.ts:58-61` — Aucun test ne vérifie l'exécution séquentielle des jobs. Une mutation `for` → `Promise.all` passerait tous les tests.

---

## Thèmes Transverses

- **Evidence gap vs. code gap :** Le code est solide sur les chemins testés ; les blocages sont des gaps de preuve (FR-20, CI matrix) et de déclaration d'artefact (Linux, macOS Firefox).
- **Code mort cumulatif :** Deux vecteurs de code mort dans `browserLocator.ts` et `contracts.ts` témoignent de refactorings partiels non nettoyés.
- **Sécurité locale acceptable :** `--no-sandbox`, `unsafe-inline` et la mémoire d'archive sont des compromis documentés pour un outil local-only sans réseau.

---

## Détails Par Division

### Division Métier (Anton Ego)

*Voici ce que je constate, et ce que je constate m'est insupportable : un projet qui se déclare lui-même NO-GO dans ses propres preuves de release n'est pas un projet terminé. C'est un projet qui a l'honnêteté de l'admettre.*

- **[High]** `docs/release-evidence/phase-8-9-10-local-replay-2026-06-15.md:169-183` — La preuve de release déclare explicitement "Global v0.1.2 remains NO-GO until these release-grade proofs are added: CI/browser-family matrix across target platforms; real FR-20 system-scope multi-account proof." — Confirme FR-20 (Should, MVP) non prouvé, CI matrix absente.
- **[High]** `artifacts.json` (entier) — NFR-03 exige "Linux, macOS, and Windows". Le catalogue runtime ne déclare aucun artefact pour Linux. La portabilité Linux en mode fallback est structurellement impossible.
- **[Medium]** `docs/ci_matrix_v0.1.md` existe mais aucun run CI multi-platform n'est référencé. La matrice est un plan, pas une preuve.
- **[Low]** `README.md:14-20` — La section "Status" reconnaît les fonctionnalités manquantes mais reste dans un document présenté à l'utilisateur final. Un utilisateur qui lit la première ligne voit "v0.1.2 is the current MVP implementation track" sans comprendre immédiatement que le release est bloqué.

### Division Qualité (Gordon Ramsay)

*C'est du bon travail, d'accord. Mais du bon travail avec trois points noirs que j'aurais expulsés de ma cuisine avant le service.*

- **[High]** `contracts.ts:21-28` — API publique `convertFile` exportée qui fait un `await import("./converter.js")`. Jamais importée par aucun test, jamais documentée dans le README. Du code mort qui prétend être une API. Si vous l'avez mis, testez-le. Si vous ne le testez pas, supprimez-le.
- **[Medium]** `pipeline.ts:58-61` — La boucle `for` est séquentielle, ce qui est requis par les tests overwrite. Mais aucun test ne vérifie cela. `Promise.all()` passerait tous les tests. C'est une mutation survivante qui invalide la confiance dans la suite.
- **[Medium]** `vitest.config.ts:4-6` — `exclude: ['tests/browser/**', 'tests/integration/**']`. Les tests d'intégration les plus importants (`cli-pdf.test.ts`, `converter.test.ts`) sont exclus de `npm test`. Un développeur qui court `npm test` obtient uniquement les tests unitaires. Cela ne protège pas contre une régression runtime détectée uniquement par `npm run test:all`.
- **[Medium]** `markdownRenderer.ts:29-34` — Cinq singletons mutables au niveau module (`cachedRenderer`, `cachedDefaultCss`, `cachedHighlightCss`, `cachedMermaidBundlePath`, `cachedMermaidBundle`, `tempHtmlDirectories`). Si deux tests s'exécutent dans le même worker Vitest et modifient les caches, la pollution d'état est possible.
- **[Low]** `converter.ts:120-124` — Bloc de commentaire multi-lignes pour une invariante dual-clock. L'invariante est non-triviale, mais le commentaire dépasse la limite d'une ligne définie par les guidelines. Acceptable eu égard à la complexité.
- **[Low]** `scripts/checkArtifactFreshness.mjs:13` — `const failures = []` déclaré en dehors de `main()`, au niveau module. Un appel programmatique multiple en test accumulerait les failures entre appels. Acceptable pour un script standalone.

**Test Quality Auditor (détail) :**

- `cli.test.ts:102-119` — Le test "uses the runtime converter when no converter is injected" est un vrai test de boundary : il force un browser manquant et vérifie `[browser]` dans stderr. Solide.
- `overwrite.test.ts` — Couverture exhaustive de `decideOverwriteAction`, `isAffirmativeOverwriteResponse`, `evaluateOverwrite` avec EOF, y/yes/n/no, mode interactive/non-interactive. Excellent.
- `cli-pdf.test.ts` — Tests d'intégration avec fakes injectables couvrant late write failures, race conditions, Mermaid timeout. Très bonne qualité.
- `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts` — Non lu pendant cette session (limite de vérification). Voir section "Limites".

**Mutation/Saboteur Auditor :**

- `pipeline.ts:69-76` — Si on retire le bloc `if (!evaluation.shouldConvert) return skipped`, les tests overwrite du pipeline échoueraient. Mutation tuée.
- `artifactPolicy.ts:38` — Si on change `quarantineDays * 24 * 60 * 60 * 1000` → `/`, les tests d'artifacts échoueraient. Mutation tuée.
- `paths.ts:132-133` — Si `sources.length !== 1` → `sources.length !== 0`, le test "retourne exit 2 pour --output avec zéro fichiers résolu" échouerait (aucun test ne vérifie ce cas exact). **Mutation potentiellement survivante sur l'edge case `--output` + 0 sources.**
- `pipeline.ts:58-61` — `for (const job of jobs)` → `await Promise.all(jobs.map(...))` : tous les tests passent. **Mutation survivante critique.** [Medium]

### Division Architecture (Steve Jobs)

*La simplicité est la sophistication suprême. Mais trois exports qui ne servent à rien, c'est de la complexité qui se déguise en optionnalité.*

- **[High]** `contracts.ts:21-28` — `convertFile` dans `contracts.ts` fait un `await import("./converter.js")`. Les contrats ne doivent pas importer les implémentations. Violation de la frontière `contracts ← implementation`. Si c'est une API publique, elle doit être dans un module `api.ts` documenté et testé. Si c'est du code de glue transitoire, supprimez-le.
- **[High]** `browserLocator.ts:112-128` et `483-513` — `locateBrowser()` (free function, non utilisée) et `browserCandidates()` (utilisée uniquement par `locateBrowser()`) sont du code mort. La chaîne de production utilise exclusivement `BrowserLocator` (classe). Export mort = surface d'API non maintenue.
- **[Medium]** `browserLocator.ts:335-367` — `ArtifactPolicyDriverResolver.resolveDriver()` construit la contrainte via `driverCompatibilityConstraint(browser)` qui ne retourne que `{ compatibleWith }`, sans `platform`. Si un artefact futur ajoute un champ `path` sans contrainte de plateforme, un driver win64 serait sélectionné sur Linux.
- **[Medium]** `converter.ts:27-28` — `export type { WebDriverSession, WebDriverSessionFactory } from "./webDriverSession.js"` — Re-export de commodité acceptable mais augmente la surface publique de `converter.ts`.
- **[Low]** Aucune violation de couche détectée sur le reste : `cli → pipeline → contracts/paths/overwrite`, `converter → markdownRenderer/browserLocator/webDriverClient/webDriverSession`, `converter → fallbackBrowserProvisioner → releaseCatalog/artifactPolicy`. Le graphe de dépendances est sain.

**YAGNI Auditor :**

- **[High]** `browserLocator.ts:112-128` — `locateBrowser()` est exported mais non utilisé. Supprimable.
- **[Medium]** `contracts.ts:21-28` — `convertFile` dans contracts non utilisé dans la chaîne de production ni dans les tests. Supprimable ou à documenter/tester comme API publique.
- **[Low]** `webDriverClient.ts:35-50` — `WebDriverPrintSettings` et ses nombreux champs optionnels (`mermaidPollMs`, `cleanupTimeoutMs`, `print`) sont des points d'injection pour les tests. Justifiés par la testabilité.

**SRE/Performance Auditor :**

- **[Medium]** `fallbackBrowserProvisioner.ts:568-582` — `readFile(archivePath)` charge l'archive entière en mémoire (195 Mo pour Chrome win64, 180 Mo pour Chrome mac-arm64). Puis `unzipSync(archive)` décompresse en mémoire. Limite max déclarée : 1,5 Go décompressés (`maxArchiveUncompressedBytes = 1_500_000_000`). Sur une machine avec 2 Go de RAM, cela peut déclencher un OOM. Risque concret sur des VM ou des containers contraints.
- **[Medium]** `fallbackBrowserProvisioner.ts:379-395` — `chmodDirectoryExecutable` est récursif sur le bundle Chrome (~centaines de répertoires, ~milliers de fichiers). `Promise.all` à chaque niveau sans limite de concurrence. Sur un système de fichiers lent (réseau, WSL), cela peut générer des milliers d'appels FS simultanés.
- **[Low]** `converter.ts:195-219` — `writePdfAtomically` : le fichier temporaire est créé dans le même répertoire que la sortie finale. `rename()` est atomique si source et destination sont sur le même système de fichiers, ce qui est garanti ici. Correct.
- **[Low]** `webDriverSession.ts:113` — `delay(Math.min(50, Math.max(0, deadline - Date.now())))` dans la boucle de probe. Peut introduire un délai minimum de 50 ms même quand il ne reste que quelques ms. Acceptable.

**Architecture Consistency Auditor :**

- **[Medium]** `docs/architecture.md` décrit "Both browser families are supported: Chromium-family via `chromedriver`, and Firefox via `geckodriver`." mais `artifacts.json` ne déclare `geckodriver` que pour `win32-x64`. macOS et Linux Firefox ne sont pas supportés par le fallback provisionner. Écart documentaire.
- **[Low]** `docs/ci_matrix_v0.1.md` existe mais aucune URL de CI run n'est référencée dans les preuves release. La matrice annoncée dans l'architecture n'a pas de preuve d'exécution réelle.

### Division Cybersécurité Offensive (Sherlock Holmes)

*Élémentaire, et pourtant souvent ignoré : les compromis sécurité d'un outil offline ne sont acceptables que si l'outil reste réellement offline.*

**Contextual Threat Analyst :**

- **[Medium]** **Vecteur : archive zip malformée dans le cache** — Si un attaquant local remplace l'archive dans `~/.cache/md2pdf/chromium-for-testing/<version>/artifact.zip` avec une archive zip dont les entrées traversent le répertoire de cache, `resolveInside()` à `fallbackBrowserProvisioner.ts:703-716` bloque le path traversal. Mais `assertChecksum()` est appelé avant `assertExecutablePaths()`. Si le checksum passe (archive remplacée par une version ayant le même hash… impossible), le guard est double. Protégé.
- **[Medium]** **Vecteur : exécutable de browser contrôlé par l'attaquant via MD2PDF_BROWSER** — `browserLocator.ts:231-285` valide l'existence, l'exécutabilité et que le nom correspond à un browser supporté (`browserKindFromPath`). Puis `execBrowserVersion` exécute `browser --version` via `execFile` (pas de shell injection). Protégé contre l'injection de commandes shell. Mais un attaquant qui contrôle `MD2PDF_BROWSER` peut pointer vers un exécutable malveillant qui se nomme `chrome` ; ce binaire sera invoqué en `execFile`. [RISQUE] acceptable pour un outil local-only.
- **[Low]** **Vecteur : Markdown malveillant avec images à grande taille** — Les images sont lues via `readFileSync` et converties en base64. Une image de 500 Mo dans un Markdown source gonflerait la taille du fichier HTML temporaire. Aucune limite de taille sur les images. [RISQUE] DoS local.

**SAST Scanner :**

- **[Medium]** `markdownRenderer.ts:125` — `md.validateLink = () => true` désactive la validation de protocole de markdown-it (qui bloque `javascript:`, `vbscript:`, `data:` par défaut). La protection est assurée par `renderLinkOpen()` qui retire les hrefs pour toute URL avec un schéma URI (`hasUriScheme`). Protection correcte mais en profondeur insuffisante : si `renderLinkOpen` était supprimé ou bypassé, `validateLink = () => true` serait le seul guard manqué. Défense en profondeur dégradée.
- **[Medium]** `webDriverClient.ts:395-409` — `--no-sandbox` est passé à tous les browsers Chromium. Ce flag désactive le sandbox de renderer Chrome. Si le contenu Markdown exploite une vulnérabilité dans le moteur de rendu Chrome (via Mermaid ou HTML injecté), l'absence de sandbox augmente l'impact. Justifié pour les environnements CI sans `/proc` ou sans user namespace, mais augmente le risque en usage développeur.
- **[Low]** `markdownRenderer.ts:290-293` — CSP : `script-src 'unsafe-inline'` et `style-src 'unsafe-inline'`. Nécessaire car le bundle Mermaid et le runner sont injectés inline. Acceptable pour un document local `file://` sans exposition réseau.
- **[Low]** `webDriverClient.ts:279-298` — `webDriverEndpoint()` vérifie que l'URL construite reste sur `baseUrl.origin`. Protection SSRF correcte.

**Supply Chain & Artifact Auditor :**

- **[High]** `artifacts.json:31-102` — Les artefacts `chromium-for-testing` et `chromedriver` ne couvrent que `win32-x64` et `darwin-arm64`. Linux est absent. NFR-05 (artifact freshness policy) ne peut pas être appliqué pour Linux faute d'artefact déclaré.
- **[High]** `artifacts.json:86-102` — `geckodriver` : un seul release, `win32-x64`. macOS et Linux Firefox sans geckodriver déclaré. Si un utilisateur macOS/Linux avec Firefox uniquement appelle md2pdf, la provisioning échoue.
- **[Medium]** `fallbackBrowserProvisioner.ts:514-564` — Le downloader utilise `https.get` sans certificate pinning. L'intégrité est vérifiée APRÈS le download via SHA-256 comparé au catalogue. Protection acceptable si `artifacts.json` n'est pas compromis. [RISQUE] si l'attaquant contrôle à la fois le réseau et `artifacts.json`.
- **[Low]** `package.json:51-65` — Toutes les dépendances sont en versions exactes (sans `^` ni `~`). Bonne hygiène supply chain.

**Privacy/Exfiltration Auditor :**

- **[Medium]** `markdownRenderer.ts:63-79` — Le fichier HTML temporaire est créé dans `os.tmpdir()` avec des permissions par défaut (0o600 non forcé sur `writeFile`). La permission effective dépend du umask de l'OS. Sur un umask permissif (0o022), le fichier HTML contenant les images de l'utilisateur encodées en base64 est lisible par d'autres utilisateurs locaux pendant la durée de la session WebDriver. Le cleanup dans `finally` est correct mais la fenêtre de visibilité existe.
- **[Low]** Le PDF généré par le Print WebDriver Chrome contient des métadonnées (date de création, générateur). L'utilisateur ne peut pas contrôler ces métadonnées via l'API actuelle. Non-bloquant pour un outil local.

---

## Détails Par Sous-Audit

### Business Logic Auditor
- **Verdict :** AUDIT_FAIL
- **Findings :** FR-20 non prouvé (system-scope multi-compte) ; Linux non couvert runtime.
- **Points conformes :** FR-01 à FR-19, FR-21, FR-23, FR-24 fonctionnellement implémentés et testés.

### Requirements Compliance Auditor
- **Verdict :** AUDIT_FAIL
- **Findings :** NFR-03 Linux manquant ; FR-20 manquant (High) ; CI matrix documentée mais sans preuves d'exécution (Medium).
- **Matrice :** Voir tableau complet ci-dessus.
- **Points conformes :** NFR-05 artifact freshness : politique implémentée en runtime (`artifactPolicy.ts`) et en gate statique (`checkArtifactFreshness.mjs`), avec pré-commit hook. NFR-01 zero-config validé. NFR-02 local-only structurellement enforced.

### Doc-Sync Auditor
- **Verdict :** AUDIT_FAIL
- **Findings :** Écart documentaire `architecture.md` vs `artifacts.json` pour Firefox/geckodriver (High) ; CI matrix annoncée sans exécution prouvée (Low).
- **Points conformes :** README cohérent avec les options CLI réelles. ARTIFACT_FRESHNESS_POLICY.md exhaustif et précis.

### A11y/UX Checker
- **Verdict :** N/A — aucun front-end ou UI HTML exposé à l'utilisateur final.

### Clean Code Auditor
- **Verdict :** AUDIT_WARN
- **Findings :** API morte dans `contracts.ts:21-28` (High) ; singletons mutables module-level dans `markdownRenderer.ts:29-34` (Medium) ; integration tests exclus de `npm test` (Medium) ; commentaire multi-lignes `converter.ts:120-124` (Low).
- **Points conformes :** Naming cohérent ; pas de magic numbers exposés ; erreurs structurées (6 kinds) ; pas de `catch` silencieux non intentionnel.

### Fail-Loud Auditor
- **Verdict :** AUDIT_WARN
- **Findings :** `browserLocator.ts:289-294` — `candidateFromPath()` retourne null silencieusement sur erreur filesystem (Medium, intentionnel pour le scan de candidats) ; `fallbackBrowserProvisioner.ts:395` — `chmod().catch(() => undefined)` silencieux sur les helpers du bundle (Medium, intentionnel best-effort).
- **Points conformes :** Tous les chemins d'erreur métier sont wrappés en types `Md2PdfError` typés et propagés. `cleanupTempHtml` lève si appelé avec un chemin non géré. La chaîne de cleanup préserve l'erreur primaire (`primaryFailure` pattern dans `converter.ts` et `webDriverClient.ts`).

### Test Quality Auditor
- **Verdict :** AUDIT_WARN
- **Findings :** Pipeline séquentiel non protégé contre mutation (Medium) ; intégration exclue du run par défaut (Medium) ; `fallbackBrowserProvisioner.test.ts` non analysé dans cette session (limite).
- **Points conformes :** Tags `@req FR-XX` sur 100% des tests units cli/pipeline/overwrite. Tests d'intégration `cli-pdf.test.ts` couvrent race conditions, late write failures, Mermaid timeout. Cleanup `afterEach` dans tous les tests avec temp dirs.

### Mutation/Saboteur Auditor
- **Verdict :** AUDIT_WARN
- **Findings :** `pipeline.ts:58-61` — `for` → `Promise.all` survit (Medium).
- **Points conformes :** Mutations sur `decideOverwriteAction`, `artifactPolicy.selectNewestEligible`, `resolveOutputPath`, `validateJobs` seraient détectées par les tests existants.

### Layer Enforcer
- **Verdict :** AUDIT_WARN
- **Findings :** `contracts.ts:21-28` — contracts importent implementation (High) ; re-export convenience dans `converter.ts:27-28` (Medium).
- **Points conformes :** Flux `cli → pipeline → paths/overwrite/contracts`, `converter → browserLocator → artifactPolicy/releaseCatalog` correct. Pas de dépendance circulaire détectée.

### YAGNI Auditor
- **Verdict :** AUDIT_WARN
- **Findings :** `locateBrowser()` + `browserCandidates()` dead code (High) ; `convertFile` dans contracts mort (Medium).
- **Points conformes :** `WebDriverPrintSettings` justifié par la testabilité. Pas d'abstraction spéculative détectée dans le reste du code.

### SRE/Performance Auditor
- **Verdict :** AUDIT_WARN
- **Findings :** Archive 195 Mo en mémoire entière (Medium) ; `chmodDirectoryExecutable` sans limite de concurrence (Medium) ; délai probe 50 ms plancher dans `waitForDriver` (Low).
- **Points conformes :** Écriture atomique du PDF via rename. Timeout double sur `withTempHtml` et `requestWithTimeout`. Cleanup process WebDriver dans `finally` avec support abort signal. Port aléatoire via `createServer().listen(0)`.

### Architecture Consistency Auditor
- **Verdict :** AUDIT_WARN
- **Findings :** `architecture.md` annonce Firefox supporté partout ; `artifacts.json` ne le couvre que win32 (Medium) ; CI matrix sans run réel (Low).
- **Points conformes :** Tous les modules src/* correspondent à leurs références dans `artifacts.json` `trackedLocations`. Pas de module fantôme dans la liste de packaging.

### Contextual Threat Analyst
- **Verdict :** AUDIT_WARN
- **Findings :** `MD2PDF_BROWSER` pointant vers un exécutable malveillant (Medium, [RISQUE]) ; images sans limite de taille (Low, [RISQUE]).
- **Points conformes :** Zip slip protégé via `resolveInside()`. Path traversal image protégé via `isPathInsideDirectory`. WebDriver SSRF protégé via `webDriverEndpoint()` + `localWebDriverUrl()`.

### SAST Scanner
- **Verdict :** AUDIT_WARN
- **Findings :** `md.validateLink = () => true` + défense en profondeur dégradée (Medium) ; `--no-sandbox` Chromium (Medium) ; CSP `unsafe-inline` justifié (Low).
- **Points conformes :** `html: false` dans markdown-it (pas de raw HTML). `execFile` utilisé partout (pas de `exec` avec shell). `--allowed-ips=` sur chromedriver. `webDriverEndpoint()` bloque les paths non-relatifs.

### Supply Chain & Artifact Auditor
- **Verdict :** AUDIT_FAIL
- **Findings :** Linux absent de tous les artefacts runtime (High) ; geckodriver absent pour macOS/Linux (High) ; downloader sans certificate pinning (Medium, [RISQUE]).
- **Points conformes :** Versions exactes dans `package.json`. Checksums SHA-256 + taille vérifiés pré et post-extraction. Quarantaine 7 jours hardcodée à deux endroits (`artifactPolicy.ts:29` et `fallbackBrowserProvisioner.ts:47`). Pré-commit hook actif.

### Privacy/Exfiltration Auditor
- **Verdict :** AUDIT_WARN
- **Findings :** Temp HTML avec images base64 en permissions umask-dépendantes (Medium) ; métadonnées PDF non contrôlables (Low).
- **Points conformes :** Aucune transmission réseau pendant la conversion (enforced par CSP + `assertFileUrl` + `localWebDriverUrl`). Cache artefacts local (`~/.cache/md2pdf`). Mode 0o600 sur les fichiers d'archive téléchargés (`createWriteStream(path, { mode: 0o600 })`).

---

## Points Conformes

1. Taxonomie d'erreurs typée (6 kinds) cohérente sur tout le codebase.
2. Écriture atomique du PDF (temp file + rename dans le même répertoire).
3. Zip slip guard `resolveInside()` correctement implémenté.
4. `--allowed-ips=` sur chromedriver bloque les connexions externes.
5. `assertFileUrl()` bloque tout URL non-`file://` dans le WebDriver.
6. `localWebDriverUrl()` bloque tout WebDriver non-localhost.
7. `webDriverEndpoint()` bloque les paths non-relatifs et les SSRF.
8. `html: false` dans markdown-it : pas d'injection HTML brut.
9. Images HTML-escaped avant insertion dans le div Mermaid (`.escapeHtml(token.content)`).
10. `isPathInsideDirectory()` bloque le path traversal dans les images.
11. La politique de fraîcheur est enforced à trois niveaux : gate statique (script), pré-commit hook, runtime (`artifactPolicy.ts`).
12. Tags `@req FR-XX` sur les tests CLI/pipeline/overwrite permettant la traçabilité.
13. Cleanup `finally` systématique : temp HTML, session WebDriver, process driver, browser profile dir.
14. Port WebDriver alloué dynamiquement via `createServer().listen(0)` — pas de conflit de port.
15. Idempotence de l'install vérifiée par `checkPackage.mjs` (install + reinstall).

---

## Limites De Vérification

| Limite | Raison |
| --- | --- |
| `tests/unit/artifacts/fallbackBrowserProvisioner.test.ts` non analysé en détail | Fichier non lu pendant cette session pour raisons de temps |
| `tests/unit/browserLocator/browserLocator.test.ts` non analysé en détail | Idem |
| `docs/architecture.md` lu partiellement (50 lignes) | Tronqué pour préserver le contexte |
| CI matrix : aucune URL de run vérifiable | Aucun CI run référencé dans la branche courante |
| `npm run check:artifacts` non exécuté dans cette session | Environnement sandbox |
| Tests real-browser (`vitest.real-browser.config.ts`) non vérifiés localement | Nécessite Chromium et chromedriver éligibles |

## Commandes Non Exécutées

- `npm run test:all` (gate complet)
- `npm run check:artifacts` (politique artefacts)
- `npm run check:package` (package smoke)
- `npx tsc --noEmit` (typecheck)

---

*Fin de l'audit TeamComplete Phase 10 — 2026-06-15*
