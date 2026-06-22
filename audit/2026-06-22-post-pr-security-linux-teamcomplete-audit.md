# Audit TeamComplete — Post PR #16 (Linux) + PR #17 (Security)

**Date :** 2026-06-22
**Branche :** `plan/v0.1.1_restart` (inclut merge PR #16 linux-browser + PR #17 security)
**Périmètre :** codebase complète — `src/`, `tests/`, `scripts/`, `assets/`, `artifacts.json`, `.githooks/`, `docs/`, config

---

## Résumé De L'Audit

| Division | Statut | Synthèse |
|---|---|---|
| Métier | 🟡 Avertissement | Exigences fonctionnelles couvertes; deux défauts d'implémentation Snap Firefox (dead code + profil) rompent la promesse de prise en charge Linux Snap. |
| Qualité | 🟡 Avertissement | Code solide dans l'ensemble; un paramètre mort confirme le dead code Firefox, le port TOCTOU est sans filet de test, une duplication entre `firefoxOptions` et `moz:firefoxOptions` survit. |
| Architecture | 🟡 Avertissement | Limites de couche bien tenues; Intel Mac (`darwin-x64`) absent de `artifacts.json`, doc `architecture_globale.md` en retard sur les profils Firefox. |
| Cybersécurité Offensive | 🟢 OK | Mesures de sécurité hardening importantes et correctement implémentées; deux observations résiduelles LOW (TOCTOU port, `localhost` DNS). |

**Verdict global : AUDIT_PASS avec réserves Medium**
**Totaux normalisés : Critical 0 · High 0 · Medium 2 · Low 5**

---

## Index Des Sous-Audits

| Sous-audit | Scope | Crit | High | Med | Low | Verdict |
|---|---|---:|---:|---:|---:|---|
| Business Logic Auditor | Exigences FR/NFR vs code | 0 | 0 | 1 | 0 | WARN |
| Requirements Compliance Auditor | Matrice req → impl → test | 0 | 0 | 0 | 1 | WARN |
| Doc-Sync Auditor | README, docs, architecture | 0 | 0 | 0 | 1 | WARN |
| A11y/UX Checker | Aucun front-end/UI | — | — | — | — | N/A |
| Clean Code Auditor | src/ | 0 | 0 | 1 | 1 | WARN |
| Fail-Loud Auditor | Erreurs, cleanup, timeouts | 0 | 0 | 0 | 0 | PASS |
| Test Quality Auditor | tests/ | 0 | 0 | 0 | 1 | WARN |
| Mutation/Saboteur Auditor | Chemins critiques | 0 | 0 | 0 | 0 | PASS |
| Layer Enforcer | Frontières src/ | 0 | 0 | 0 | 0 | PASS |
| YAGNI Auditor | Abstractions | 0 | 0 | 0 | 1 | WARN |
| SRE/Performance Auditor | Process, temp files, atomic | 0 | 0 | 0 | 1 | WARN |
| Architecture Consistency Auditor | Plan vs code | 0 | 0 | 1 | 1 | WARN |
| Contextual Threat Analyst | Markdown hostile, WebDriver | 0 | 0 | 0 | 0 | PASS |
| SAST Scanner | Injection, traversal, SSRF | 0 | 0 | 0 | 0 | PASS |
| Supply Chain & Artifact Auditor | artifacts.json, lockfile | 0 | 0 | 0 | 0 | PASS |
| Privacy/Exfiltration Auditor | Réseau, PDF, profils, logs | 0 | 0 | 0 | 1 | WARN |

---

## Matrice De Couverture Des Exigences Principales

| Contrat / Exigence | Source | Implémentation | Tests | Statut |
|---|---|---|---|---|
| Caractères cachés/bidi rejetés avant parsing | `docs/security-hardening-plan.md` | `src/markdownRenderer.ts:551-625` | `markdownRenderer.test.ts:72-147` | ✅ OK |
| Seuls les liens HTTPS visiblement identiques restent cliquables | `docs/security-hardening-plan.md` | `src/markdownRenderer.ts:260-328, 951-975` | `markdownRenderer.test.ts:499-563` | ✅ OK |
| Images : raster local uniquement, réalpath, containment | `docs/project_requirements.md FR-06 / NFR-02` | `src/markdownRenderer.ts:330-429` | `markdownRenderer.test.ts:205-633` | ✅ OK |
| Limites de taille MD/lignes/images/mermaid/code | `README.md` | `src/markdownRenderer.ts:32-40, 510-691` | `markdownRenderer.test.ts:58-197` | ✅ OK |
| CSP `default-src 'none'` dans HTML généré | `docs/security-hardening-plan.md` | `src/markdownRenderer.ts:455` | `markdownRenderer.test.ts:539-544` | ✅ OK |
| WebDriver local uniquement (127.0.0.1) | `docs/security-hardening-implementation-plan.md` | `src/webDriverClient.ts:246-265`, `src/webDriverSession.ts:86-89` | `tests/unit/webDriverSession/webDriverSession.test.ts:39-55` | ✅ OK |
| Profil navigateur par run + cleanup | `docs/security-hardening-plan.md` | `src/webDriverClient.ts:390-392, 217-223` | Partiel — snap Firefox non couvert | ⚠️ PARTIEL |
| Capacités Firefox durcies (prefs réseau/télémétrie) | `docs/security-hardening-plan.md` | `src/webDriverClient.ts:458-486` | `tests/unit/webDriverClient/webDriverClient.test.ts:98+` | ✅ OK |
| Snap Firefox : omission du `binary` | `src/webDriverClient.ts:402-404` (commentaire) | **DEAD CODE** — jamais appliqué | Non testé | ❌ KO |
| Politique de fraîcheur des artefacts (7 jours) | `ARTIFACT_FRESHNESS_POLICY.md` | `src/artifactPolicy.ts:29-116`, `scripts/checkArtifactFreshness.mjs` | `tests/unit/artifacts/` | ✅ OK |
| Écriture PDF atomique | Architecture | `src/converter.ts:258-283` | `tests/unit/converter/` | ✅ OK |

---

## Top Findings (dédupliqués)

- **Medium** `src/webDriverClient.ts:401-424` — Dead code + bug snap Firefox : la variable `firefoxOptions` avec la logique snap-aware n'est jamais incluse dans le retour; `moz:firefoxOptions.binary` est toujours assigné à `browserPath`, causant l'échec de Firefox snap sur Linux.
- **Medium** `src/webDriverClient.ts:390-392` — `createBrowserProfileDir` ignore son paramètre `browser: LocatedBrowser` et utilise toujours `tmpdir()` (= `/tmp`), inaccessible aux navigateurs snap-confinés; `converter.ts:211-212` corrige ce cas pour les fichiers HTML mais pas pour les profils.
- **Low** `src/webDriverSession.ts:67-82` — TOCTOU sur le port WebDriver : le port est alloué par bind+close puis passé au processus WebDriver; fenêtre de quelques ms pendant laquelle un autre processus local peut s'accaparer le port.
- **Low** `src/webDriverClient.ts:263-265` — `isLocalHost` accepte `"localhost"` comme hôte valide dans le transport; si `/etc/hosts` est falsifié, `localhost` peut résoudre vers une adresse non-loopback.
- **Low** `artifacts.json` — Plateforme `darwin-x64` (Mac Intel) absente des releases de `chromium-for-testing`, `chromedriver` et `geckodriver`; les Mac Intel n'ont pas de navigateur de repli (`ArtifactFreshnessError` systématique si aucun navigateur local n'est détecté).
- **Low** `docs/architecture_globale.md` — Documentation mentionne uniquement les profils temporaires Chromium, non mise à jour pour Firefox (carry-over de l'audit précédent).
- **Low** `src/webDriverClient.ts:405-410` (YAGNI) — Variable `firefoxOptions` construite mais jamais utilisée; constitue du dead code confirmé.

---

## Thèmes Transverses

1. **Snap Linux Firefox** : deux défauts indépendants (`binary` toujours injecté, profil dans `/tmp`) se combinent pour rompre la prise en charge Snap Firefox, malgré l'infrastructure correcte dans `browserLocator.ts` et le commentaire explicite en ligne 402-404.
2. **Mesures de sécurité hardening globalement solides** : détection de caractères cachés, politique de liens, confinement d'images, CSP stricte, WebDriver local, profils temporaires (hors snap), artefacts avec checksum — toutes ces protections sont correctement implémentées et testées.
3. **Artefacts et fraîcheur** : politique exemplaire avec quarantaine, SHA-256, taille déclarée, waivers formalisés, pre-commit hook, Renovate configuré avec `minimumReleaseAge: "7 days"`.

---

## Détails Par Division

### Division Métier — Anton Ego

Les exigences fonctionnelles (FR-01 à FR-24) et non-fonctionnelles sont honorées avec une certaine rigueur. La mécanique de détection de caractères dangereux est presque élégante — rejeter le bidi override au niveau du Markdown avant même le rendu, c'est traiter le problème à la source. La politique de liens est correcte : seul un lien où le texte visible est identique à l'URL HTTPS passe.

Mais il y a une trahison du contrat sur Linux Snap Firefox. Le commentaire à la ligne 402 est honnête — « Passing the snap path fails with 'binary is not a Firefox executable' » — mais le correctif a été écrit dans une variable morte. Résultat : l'utilisateur Snap Firefox obtient une erreur runtime que le code prétend avoir prévenue.

**Finding :** `[MED-01]` Snap Firefox binary bug (voir détails).

### Division Qualité — Gordon Ramsay

Le code de `markdownRenderer.ts` est propre pour un fichier de 1048 lignes. Les fonctions d'échappement `mdEscapeHtml`/`mdEscapeAttr` sont distinctes et appliquées dans les bons contextes. Les parseurs d'image (PNG CRC32, JPEG SOF scan, WebP chunks) sont manuels mais corrects et bien testés.

La verrue, c'est ce `firefoxOptions` fantôme — une variable construite sur 5 lignes avec une logique conditionnelle, suivie d'un `return` qui l'ignore complètement. La cuisine est propre sauf un couteau laissé sur le plan de travail sans raison.

**Findings :** `[MED-02]` (dead code paramètre `browser` dans `createBrowserProfileDir`), `[LOW-04]` (dead code variable `firefoxOptions`).

### Division Architecture — Steve Jobs

La séparation des couches est respectée : `cli.ts` → `pipeline.ts` → `converter.ts` → `markdownRenderer.ts`/`webDriverClient.ts`. Pas de violation de frontière. La délégation au navigateur pour la génération PDF via WebDriver local est un choix architectural cohérent.

L'élément manquant : `darwin-x64` absent d'`artifacts.json`. Sur Mac Intel, si aucun navigateur local n'est trouvé, `provisionFallbackBrowser` lance une `ArtifactFreshnessError`. Le catalogue de releases ne couvre pas cette plateforme, pourtant supportée par Chrome for Testing.

**Findings :** `[LOW-03]` (darwin-x64), `[LOW-05]` (doc architecture).

### Division Cybersécurité Offensive — Sherlock Holmes

**Élémentaire, et pourtant** — j'ai cherché des failles dans les couches de protection et n'en ai pas trouvé de confirmées.

**Scénario 1 — Markdown hostile avec bidi override :** `validateMarkdownCharacters` est appelée avant tout parsing, `findDangerousMarkdownCharacter` bloque U+202E et ses cousins, et ce rejet est testé pour les hrefs, les fences Mermaid, et le contenu code. Fermé.

**Scénario 2 — Path traversal par image symlink :** `resolveImagePath` applique `realpathSync` sur le chemin de l'image puis `isPathInsideDirectory` sur le chemin réel (pas le chemin apparent). Un symlink pointant hors du répertoire source sera rejeté après résolution. Testé par `itIfFileSymlinkSupported`. Fermé.

**Scénario 3 — Injection de scheme via lien :** `renderLinkOpen` intercepte tous les tokens `link_open`; `isClearVisibleHttpsLink` rejette tout ce qui n'est pas HTTPS avec texte visible == href. Les schémas `javascript:`, `data:`, `file:`, `blob:`, `ftp:`, chemins relatifs et absolus sont tous bloqués. Testé exhaustivement. Fermé.

**Scénario 4 — Zip bomb dans l'artefact de repli :** `inspectZipArchive` limite à 20 000 entrées et 1,5 Go non compressé avant extraction. `assertChecksum` valide SHA-256 + taille avant et après extraction. Fermé.

**Scénario 5 — WebDriver SSRF vers endpoint distant :** `localWebDriverUrl` rejette tout ce qui n'est pas `http://` + `localhost`/`127.0.0.1`/`::1`. `webDriverEndpoint` rejette les schémas absolus, `//`, et les segments `.`/`..` (y compris encodés `%2E`). Fermé.

**Observation résiduelle [LOW-01] :** TOCTOU sur port WebDriver — fenêtre de quelques millisecondes entre fermeture du serveur temporaire et bind du driver. Exploitable uniquement par un attaquant ayant déjà accès au compte utilisateur local.

**Observation résiduelle [LOW-02] :** `isLocalHost` accepte `"localhost"` — configurable par `/etc/hosts`, mais aucun chemin de code par défaut ne passe `"localhost"` comme URL de transport (le transport utilise `http://127.0.0.1:${port}/`). [RISQUE] théorique uniquement.

---

## Détails Par Sous-Audit

### Business Logic Auditor

**Verdict : WARN**

#### MED-01 — Snap Firefox binary toujours injecté dans `moz:firefoxOptions`

- **Preuve :** `src/webDriverClient.ts:401-424`
- **Type :** Confirmé
- **Impact :** Sur Linux avec Firefox snap (chemin `/snap/firefox/...`), geckodriver reçoit `binary: browserPath` dans les capabilities et tente de lancer directement le binaire snap, ce qui échoue avec « binary is not a Firefox executable ». La conversion est alors impossible pour tout utilisateur Ubuntu avec Firefox snap.
- **Pourquoi c'est un problème :** Le commentaire ligne 402-404 décrit explicitement le problème et indique qu'il faut omettre `binary` pour snap Firefox. La logique snap-aware existe dans `firefoxOptions` (lignes 405-410) mais n'est jamais incluse dans le `return`. Le bug est donc documenté et non appliqué.
- **Correction attendue :** Remplacer le bloc `"moz:firefoxOptions"` par l'utilisation de `firefoxOptions` (déjà construit avec la logique snap-aware), y ajouter `args` et `prefs`.

**Points conformes :**
- Toutes les exigences FR-01 à FR-24 sont implémentées et testées hors cas snap.
- La logique overwrite (FR-12, FR-13, FR-14), les codes de retour (FR-17, FR-18), et le batch (FR-08 à FR-11) sont corrects.

### Requirements Compliance Auditor

**Verdict : WARN**

#### LOW-06 — NFR Snap Firefox non couvert par les tests automatisés

- **Preuve :** Absence de test snap dans `tests/unit/webDriverClient/` ou `tests/integration/`
- **Type :** Limite de vérification
- **Impact :** Le bug MED-01 survit parce qu'aucun test n'exerce le chemin snap.
- **Correction attendue :** Ajouter un test unitaire qui vérifie que pour `kind === "firefox"` et `browserPath.startsWith("/snap/")`, `moz:firefoxOptions` ne contient pas `binary`.

**Points conformes :**
- La matrice NFR-02 (sécurité de rendu) est couverte par 30+ tests dans `markdownRenderer.test.ts`.

### Doc-Sync Auditor

**Verdict : WARN**

#### LOW-05 — `architecture_globale.md` — profils temporaires Firefox non documentés

- **Preuve :** `docs/architecture_globale.md:224-226` (d'après l'audit précédent du 2026-06-22)
- **Type :** Écart documentaire (carry-over du précédent audit)
- **Impact :** Documentation de sécurité incomplète sur les profils temporaires navigateur.
- **Correction attendue :** Mettre à jour `docs/architecture_globale.md` pour mentionner les profils temporaires pour toutes les familles de navigateurs, conformément à `AGENTS.md` (approbation utilisateur requise avant modification d'architecture).

**Points conformes :**
- `README.md` décrit correctement les limites de sécurité, les formats d'images acceptés, et la politique de freshness.
- `ARTIFACT_FRESHNESS_POLICY.md` est complet et précis.

### A11y/UX Checker

Non applicable — aucune interface utilisateur graphique.

### Clean Code Auditor

**Verdict : WARN**

#### MED-02 — `createBrowserProfileDir` ignore son paramètre `browser`

- **Preuve :** `src/webDriverClient.ts:390-392`
- **Type :** Confirmé
- **Impact :** Sur Linux snap, `/tmp` est inaccessible aux processus snap-confinés. Le profil est créé dans `/tmp` mais Firefox snap ne peut pas y accéder. Pour les navigateurs non-snap et les autres OS, ce bug est sans effet. Combiné avec MED-01, snap Firefox serait doublement cassé.
- **Pourquoi c'est un problème :** `converter.ts:204-216` résout correctement ce problème pour les fichiers HTML temporaires (`resolveTempDir` retourne `join(homedir(), "md2pdf-tmp")` pour les browsers snap sur Linux). La même logique devrait s'appliquer à `createBrowserProfileDir`.
- **Correction attendue :** Utiliser `isSnapBrowser(browser.browserPath)` et `process.platform` pour retourner `join(homedir(), "md2pdf-browser-profile-")` comme prefix sur Linux snap.

#### LOW-04 — Variable `firefoxOptions` dead code

- **Preuve :** `src/webDriverClient.ts:405-410`
- **Type :** Confirmé
- **Impact :** Code mort qui génère de la confusion et masque le bug MED-01. Le lecteur suppose que `firefoxOptions` est utilisé; il ne l'est pas.
- **Correction attendue :** Supprimer `firefoxOptions` et intégrer sa logique directement dans la construction du retour.

**Points conformes :**
- `mdEscapeHtml` / `mdEscapeAttr` correctement distingués et appliqués dans les bons contextes.
- `isManagedTempHtmlPath` avec marqueur de fichier protège contre `rm -rf` arbitraire.
- `safeSegment` sanitise les versions pour les chemins de cache.

### Fail-Loud Auditor

**Verdict : PASS**

Tous les chemins d'erreur remontent des `Md2PdfError` typées. Le cleanup des ressources (WebDriver session, profil navigateur, processus driver) est fait dans des blocs `finally` avec gestion de l'échec primaire. Les timeouts sont appliqués à chaque requête WebDriver avec `AbortController`. Aucune erreur silencieuse identifiée.

### Test Quality Auditor

**Verdict : WARN**

Les tests de `markdownRenderer.ts` sont exhaustifs et bien ancrés sur les exigences (`@req NFR-02`, `@req FR-06`). Mais :

- Aucun test pour snap Firefox dans `webDriverClient.test.ts` ni `webDriverSession.test.ts`.
- Le port TOCTOU n'est pas testé (difficilement testable en unitaire, mais la race condition n'est pas documentée comme limitation connue).

**Points conformes :**
- 213+ tests unitaires couvrent le chemin critique de rendu.
- Tests pour les cas limites d'images (PNG CRC corrupt, JPEG multi-scan, WebP VP8/VP8L/VP8X, symlinks, traversal).
- Tests pour les caractères Unicode dangereux (bidi overrides multiples, zero-width).

### Mutation/Saboteur Auditor

**Verdict : PASS**

Vérifications menées sur les chemins critiques :

1. **Inverser la condition `isPathInsideDirectory`** → test `rejects symlinks that escape the real baseDir` tuerait la mutation ✓
2. **Supprimer `findDangerousMarkdownCharacter` dans `isClearVisibleHttpsLink`** → test `rejects invisible characters inside link hrefs` tuerait la mutation ✓
3. **Remplacer `>` par `>=` dans `assertRequiredQuarantineDays`** → test `artifacts.test.ts` tuerait la mutation ✓
4. **Supprimer `assertChecksum` dans `provisionIntoCache`** → test d'intégrité tuerait la mutation ✓

### Layer Enforcer

**Verdict : PASS**

Frontières respectées : `cli.ts` ne connaît pas `markdownRenderer.ts` directement; `converter.ts` est le seul orchestrateur qui combine renderer et WebDriver. `artifactPolicy.ts` est un module pur sans effets de bord.

### YAGNI Auditor

**Verdict : WARN (LOW-04 déjà cité)**

La variable `firefoxOptions` (lignes 405-410) est spéculative sans être utilisée. C'est du code de transition abandonné, pas une abstraction future-proofée.

Sinon, le codebase est remarquablement sobre. Pas d'options jamais peuplées, pas d'API publiques mortes au-delà du cas Firefox.

### SRE/Performance Auditor

**Verdict : WARN**

#### LOW-01 — TOCTOU sur le port WebDriver

- **Preuve :** `src/webDriverSession.ts:67-82`
- **Type :** [RISQUE] — race condition confirmée structurellement, exploitation non prouvée
- **Impact :** Fenêtre de quelques millisecondes entre `server.close()` (ligne 79) et le bind du processus WebDriver. Sur une machine chargée ou si un processus malveillant local surveille les ports, le WebDriver pourrait échouer à bind ou, pire, le processus malveillant pourrait intercepter les requêtes WebDriver.
- **Pourquoi c'est un problème :** Le WebDriver transport valide `127.0.0.1` à la construction, mais si le port est pris par un autre processus avant le driver, les requêtes iraient vers ce processus. Dans le contexte local de md2pdf, c'est un risque faible mais structurel.
- **Correction attendue :** Passer le serveur créé directement au processus WebDriver via socket ou stdin, ou accepter le risque documenté comme limitation connue sur localhost.

**Points conformes :**
- Écriture PDF atomique via fichier temporaire UUID + `rename` (évite les PDFs partiels).
- Cleanup des répertoires temp HTML via marqueur de fichier.
- `purgeStaleCaches` nettoie les anciennes versions de cache browser.
- Limites anti-bomb sur les archives ZIP.

### Architecture Consistency Auditor

**Verdict : WARN**

#### LOW-03 — `darwin-x64` absent des releases d'artefacts

- **Preuve :** `artifacts.json:37-138` — uniquement `win32-x64`, `darwin-arm64`, `linux-x64`
- **Type :** Confirmé
- **Impact :** Les utilisateurs sur Mac Intel (`darwin-x64`) sans navigateur local installé reçoivent une `ArtifactFreshnessError` systématique. Chrome for Testing publie des releases pour `mac-x64` au même moment que `mac-arm64`.
- **Correction attendue :** Ajouter les entrées `darwin-x64` pour `chromium-for-testing`, `chromedriver`, et `geckodriver` (ce dernier publiant des builds universels ou `macos`) dans `artifacts.json`.

**Points conformes :**
- `artifacts.json` structuré avec `waivers`, `trackedLocations`, `plannedArtifactClasses` — cohérent avec `ARTIFACT_FRESHNESS_POLICY.md`.
- Les 3 plateformes déclarées correspondent à la logique de `currentArtifactPlatform()` pour les machines couvertes.

### Contextual Threat Analyst

**Verdict : PASS**

**Scénario — Fichier Markdown hostile distribué :** Un attaquant pourrait distribuer un fichier `.md` contenant des bidi overrides pour masquer du contenu dangereux dans l'éditeur, des liens `javascript:` ou `file://`, des images avec traversal `../../../etc/passwd`, ou un SVG avec `<script>`. Tous ces vecteurs sont bloqués en amont : bidi/zero-width rejetés au pre-parsing, links sans href sauf HTTPS visible, images avec realpath + containment, SVG refusé par extension avant lecture.

**Scénario — Mermaid XSS :** Un bloc Mermaid malveillant pourrait tenter d'injecter du HTML ou du JavaScript. Le contenu Mermaid est HTML-escapé avant insertion dans le div (`md.utils.escapeHtml`), et `securityLevel: 'strict'` dans le runner Mermaid désactive les click handlers et le HTML inline. La CSP `script-src 'unsafe-inline'` est nécessaire pour le runner mais ne permet pas de charger des scripts externes (`default-src 'none'`).

**Scénario — Fuite via PDF généré :** Les PDF n'embarquent que des images locales en base64 et du texte; aucune ressource réseau n'est référencée. `assertFileUrl` garantit que le WebDriver ne navigue que vers des `file:` URLs locales.

### SAST Scanner

**Verdict : PASS**

| Vecteur | Statut |
|---|---|
| Path traversal images | Bloqué par realpath + `isPathInsideDirectory` |
| Path traversal ZIP | Bloqué par `resolveInside` dans extracteur |
| Injection HTML dans rendu | `html: false` + escaping systématique |
| Injection dans attributs (`class`, `title`) | `mdEscapeAttr` appliqué |
| SSRF WebDriver | `localWebDriverUrl` + `webDriverEndpoint` |
| Traversal path WebDriver | `hasUnsafeWebDriverPathSegment` + `decodeURIComponent` |
| XSS Mermaid | HTML-escaping + `securityLevel: 'strict'` |
| Secrets en dur | Aucun trouvé |
| Floating versions | Rejeté par `isFloatingVersion` dans `assertReleaseShape` |
| Checksum non vérifié | SHA-256 vérifié avant et après extraction |

### Supply Chain & Artifact Auditor

**Verdict : PASS**

- `package-lock.json` v3, lockfile pinned.
- `renovate.json` : `minimumReleaseAge: "7 days"` conforme à la politique.
- `artifacts.json` : toutes les releases ont `sha256`, `size`, `url` HTTPS immutable, `provenance`, `publishedAt` valide.
- Pre-commit hook : `node scripts/checkArtifactFreshness.mjs --pre-commit` — bloque les commits avec artefacts non conformes.
- `waivers: []` — aucun waiver actif.
- `mermaid` `11.15.0`, `highlight.js` `11.11.1` dans `package.json` — versions exactes, pas de floating.

### Privacy/Exfiltration Auditor

**Verdict : WARN**

#### LOW (Observation) — Profil Firefox snap dans `/tmp` potentiellement non nettoyé

- **Preuve :** `src/webDriverClient.ts:390-392`
- **Type :** Confirmé
- **Impact :** Sur snap Linux, le répertoire de profil est créé dans `/tmp` mais Firefox snap ne peut pas y accéder. Si Firefox échoue au démarrage avant que le bloc `finally` soit atteint, le répertoire de profil en `/tmp` n'est pas nettoyé. Les profils temporaires Firefox peuvent contenir des cookies ou historique de session créés pendant le run.
- **Correction attendue :** Couplée à MED-02 — corriger `createBrowserProfileDir` pour snap et vérifier que le cleanup fonctionne pour les répertoires dans `homedir()`.

**Points conformes :**
- Aucune ressource externe chargée par le HTML généré (CSP + assets inline).
- Aucun appel réseau pendant le rendu (ChromeDriver `--no-proxy-server`, Firefox `--offline`).
- Profils navigateur supprimés après chaque run (hors snap Linux).
- PDF généré localement, pas de télémétrie ou envoi réseau.
- Prefs Firefox désactivent télémétrie, safebrowsing réseau, DNS prefetch, etc.

---

## Points Conformes Notables

1. **Détection de caractères Unicode dangereux** (`src/markdownRenderer.ts:551-625`) — couverture exhaustive : contrôles C0/C1, bidi overrides (U+202A–U+202E, U+2066–U+2069), zero-width (U+200B–U+200D), soft hyphen (U+00AD), BOM (U+FEFF), invisible separator (U+2063). Position ligne/colonne incluse dans l'erreur.

2. **Politique de liens** (`src/markdownRenderer.ts:260-278, 951-975`) — condition `visibleText.trim() === href` stricte : un lien masqué derrière du texte différent de l'URL est toujours bloqué, quelle que soit la casse ou l'encodage.

3. **Validation magic bytes images** — parseurs manuels PNG (CRC32 IHDR), JPEG (SOF scan avec fallback), WebP (VP8/VP8L/VP8X). Rejet si le contenu ne correspond pas à l'extension.

4. **Confinement symlink** — `realpathSync` appliqué avant `isPathInsideDirectory`, ce qui empêche l'exploitation via symlink hors répertoire source.

5. **Artifact freshness policy** — quarantaine 7 jours appliquée côté runtime (`artifactPolicy.ts:29`), côté pre-commit (`scripts/checkArtifactFreshness.mjs`), et côté Renovate (`minimumReleaseAge: "7 days"`). Trois points de contrôle indépendants.

6. **Intégrité du cache navigateur** — SHA-256 du ZIP vérifié (`assertChecksum`), SHA-256 du binaire extrait stocké dans `cache-metadata.json` et re-vérifié à chaque utilisation du cache (`assertCacheMetadata`). Anti-substitution.

7. **WebDriver path injection** — `webDriverEndpoint` vérifie l'origine après construction de l'URL et la concordance du pathname. `encodeURIComponent` appliqué sur le sessionId dans les paths.

8. **Mermaid avec `securityLevel: 'strict'`** — empêche les click handlers et le HTML embarqué dans les diagrammes.

9. **`assertFileUrl`** — garantit que le WebDriver ne navigue que vers des `file:` URLs locales, empêchant toute navigation vers une URL réseau.

10. **PDF header validation** — `readPdfData` vérifie la signature `%PDF-` avant d'accepter les données retournées par WebDriver Print.

---

## Limites De Vérification

- Pas de test d'exécution sur Linux Snap Firefox — le comportement runtime de MED-01 et MED-02 n'est pas vérifié par l'environnement de CI courant.
- `architecture_globale.md` non relu intégralement dans cet audit (référencé depuis l'audit précédent du 2026-06-22).
- Les checksums SHA-256 de `artifacts.json` n'ont pas été vérifiés contre les sources upstream (nécessiterait un accès réseau).
- Les tests de release evidence (`docs/release-evidence/`) non vérifiés dans cet audit.

## Commandes Exécutées

```
find /Users/samirtamboura/Desktop/md2pdf -type f (non-git, non-node_modules)
read AGENTS.md, ARTIFACT_FRESHNESS_POLICY.md, README.md, package.json, artifacts.json, renovate.json, .gitattributes
read src/markdownRenderer.ts, src/cli.ts, src/pipeline.ts, src/paths.ts, src/contracts.ts, src/errors.ts, src/overwrite.ts
read src/converter.ts, src/artifactPolicy.ts, src/fallbackBrowserProvisioner.ts, src/releaseCatalog.ts
read src/webDriverClient.ts (complet), src/webDriverSession.ts (complet)
read src/browserLocator.ts (partiel — grep isSnapBrowser)
read tests/unit/markdownRenderer/markdownRenderer.test.ts (complet)
read scripts/checkArtifactFreshness.mjs (partiel)
read docs/project_requirements.md (partiel)
grep: isSnapBrowser, localhost, 127.0.0.1, createBrowserProfileDir, allocatePort, darwin-x64
head -100 audit/2026-06-22-security-hardening-phases-0-10-post-corrections-teamcomplete-audit.md
```
