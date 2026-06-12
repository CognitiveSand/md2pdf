# Plan Stream B - Moteur de rendu local

Prerequis: C0 gate vert (`npm run typecheck` + `npm run test:contracts`).

Stream B livre la conversion documentaire réelle : Markdown vers HTML local,
HTML vers PDF via navigateur/driver, Mermaid, local-only, provisioning conforme
aux artifacts, rendu atomique.

## Fichiers possédés

| Fichier | Phase |
| --- | --- |
| `src/converter.ts` | P3 |
| `src/markdownRenderer.ts` | P1 |
| `src/browserLocator.ts` | P2 |
| `src/webDriverClient.ts` | P2 |
| `src/releaseCatalog.ts` | P1 |
| `src/artifactPolicy.ts` | C0 → P2 |
| `src/fallbackBrowserProvisioner.ts` | P2 |
| `assets/default.css` | P1 |
| `assets/highlight.css` | P1 |
| `scripts/checkArtifactFreshness.mjs` | P2 si nécessaire |

Stream B ne modifie pas : `cli.ts`, `paths.ts`, `overwrite.ts`, `pipeline.ts`.

---

## P1 - Markdown vers HTML local

### 1. `src/markdownRenderer.ts`

- Dialecte : CommonMark + tables, task lists, footnotes.
- Code fences non-Mermaid : highlight.js avec `assets/highlight.css` inline.
- Blocs Mermaid : rendus en éléments HTML exploitables par le navigateur (pas convertis ici).
- Images relatives : intégrées localement (base64 ou `file:`).
- Image manquante ou illisible : `RenderError` ou `ConversionError` avec `sourcePath` et `actionHint`.
- CSS `assets/default.css` et `assets/highlight.css` inline dans le HTML.
- Mermaid engine inline (pas de CDN).
- Aucune URL `http:` ou `https:` exploitable dans le HTML assemblé, hors texte utilisateur rendu explicitement comme texte.

### 2. Harness local

- `renderToHtml(markdown, context): string`
- `renderToTempHtml(markdown, context): Promise<string>` — crée un fichier HTML temporaire chargeable en `file:`.
- Nettoyage des fichiers temporaires après succès, erreur ou timeout.

### 3. `src/releaseCatalog.ts` — Release catalog fakeable

- Interface `ReleaseCatalog` injectable en test, avec timestamps de publication (`publishedAt`) pour chaque release.
- Implémentation réelle lit `artifacts.json`.
- Implémentation fake pour les tests : catalogue mémoire configurable.

---

## P2 - Browser, driver, fallback, WebDriver

### 4. `src/browserLocator.ts` — Détection navigateur

Navigateurs supportés : Chrome, Chromium, Edge, Brave, Firefox.

- Support `MD2PDF_BROWSER` (variable d'environnement).
- Modes d'échec `MD2PDF_BROWSER` :
  - Fichier inexistant → `BrowserNotFoundError` avec cause `env-browser-not-found` et chemin dans `actionHint`.
  - Non-exécutable ou non-navigateur → `BrowserNotFoundError` avec cause `env-browser-not-launchable`.
  - Navigateur sans driver éligible → `BrowserNotFoundError` avec cause `env-browser-no-eligible-driver`.
- Résolution/provisioning driver conforme à `ArtifactPolicy`.
- Si aucun navigateur trouvé et aucun artifact éligible : `BrowserNotFoundError` avec liste des navigateurs supportés et cause artifact.

### 5. `src/artifactPolicy.ts` — Politique des artifacts

- `ArtifactPolicy.selectNewestEligible(releases, constraints, now)` : sélectionne la version la plus récente éligible.
- Règles :
  - Interdit `latest`, tags flottants, téléchargements non inventoriés.
  - Chaque artifact non-npm doit déclarer : URL immuable, SHA-256, taille, provenance.
- Erreur `ArtifactFreshnessError` si aucune version compatible éligible.

### 6. `src/fallbackBrowserProvisioner.ts` — Chromium-for-Testing

Module isolé, indépendant de `browserLocator.ts`.

- `provisionFallbackBrowser(policy, catalog)`: Promise<FallbackBrowserResult>
- Flux :
  1. Interroger le catalogue pour sélectionner `newest eligible`.
  2. Vérifier le cache utilisateur (versionné par artifact + version exacte).
  3. Si absent ou corrompu : télécharger vers `.tmp`, vérifier SHA-256, renommer atomiquement.
  4. Si checksum invalide : supprimer `.tmp`, lever `ArtifactFreshnessError` avec cause `integrity-mismatch`.
  5. Si cache non writable : lever `ArtifactFreshnessError` ou `BrowserNotFoundError` avec cause explicite.
- Vérification checksum avant chaque utilisation, même si déjà en cache.
- Nettoyage automatique en cas de cache partiel ou version devenue non-éligible.
- Portée de l'étape 6 : livrer le moteur de provisioning, cache, intégrité et
  tests fake catalog. L'ajout d'un artifact Chromium-for-Testing réel dans
  `artifacts.json` est un travail supply-chain séparé : il doit déclarer le
  newest eligible exact après quarantaine, avec URL immuable, SHA-256, taille,
  provenance et plateforme. En attendant, le catalogue réel doit échouer
  explicitement plutôt que télécharger un fallback non déclaré.

Gate P2 spécifique fallback :

```bash
npm run test:artifacts
```

Tests fake catalog obligatoires :
- Checksum valide → succès.
- Checksum invalide → `ArtifactFreshnessError` cause `integrity-mismatch`.
- Download interrompu → nettoyage et erreur.
- Cache partiel → re-provisioning.
- Cache devenu non-éligible → purge et re-provisioning.
- Cache non writable → erreur explicite.

### 7. `src/webDriverClient.ts` — WebDriver Print

- Session WebDriver minimale.
- Navigation vers `file:`.
- Flags offline/no-proxy quand supportés.
- Attente rendu Mermaid avec timeout.
- Commande Print → bytes PDF.
- Timeout wrappé en `RenderError`.
- Fermeture session et process driver dans `finally` (même en cas d'erreur).

---

## P3 - Converter atomique (intégration verticale)

### 8. `src/converter.ts` — Conversion complète

Implémentation de `convertFile(sourcePath, outputPath, options?)` :

1. Lire la source UTF-8.
2. Assembler le HTML local via `markdownRenderer`.
3. Créer le fichier HTML temporaire.
4. Localiser/provisionner le navigateur et le driver (`browserLocator`).
5. Lancer la session WebDriver.
6. Rendre le PDF via Print.
7. Écrire l'output seulement après rendu complet.
8. Nettoyer les fichiers temporaires dans `finally`.

Règles de conversion atomique :

- Aucun PDF partiel en cas d'erreur.
- Frontière provisioning/conversion stricte :
  - Le provisioning se termine avant que la conversion commence.
  - La conversion depuis un état pré-provisionné n'ouvre aucune connexion sortante.
  - Le provisioning peut utiliser le réseau mais ne lit jamais le contenu Markdown.
- Les tests `NFR-02` utilisent un état "pré-provisionné" : cache rempli explicitement avant le test.

---

## Tests requis Stream B

Tags `@req` obligatoires :

`FR-01`, `FR-04`, `FR-05`, `FR-06`, `FR-07`, `FR-16`, `FR-19`, `FR-24`,
`NFR-01`, `NFR-02`, `NFR-03`, `NFR-05`.

Organisation des tests :

| Suite | Vitesse | Obligatoire pour |
| --- | --- | --- |
| Tests HTML (sans navigateur) | Rapide | P1, P2, P3 |
| Tests fake catalog artifacts | Rapide | P2 (`test:artifacts`) |
| Tests PDF/browser | Lent | P3, release (`test:browser`) |

Tests Mermaid obligatoires (fixés en début de P3) :

- Absence du texte raw Mermaid dans le texte extrait du PDF.
- Présence d'au moins un objet image rasterisé ou XObject vectoriel dans la structure PDF.
- Le test `test:browser` utilise un vrai navigateur et un vrai WebDriver pré-provisionnés; un skip local doit être explicite et ne constitue pas une preuve release.
- Le type attendu (rasterisé ou vectoriel) est fixé selon le navigateur de référence CI et documenté dans le test.

Tests local-only :

- HTML sans URL `http:`/`https:` exploitable hors texte utilisateur.
- Conversion browser-backed en mode offline/no-proxy depuis état pré-provisionné.
- Test séparé : le provisioning ne lit pas le contenu Markdown.

---

## Gate de validation par phase

| Phase | Commande |
| --- | --- |
| P1 | `npm run typecheck && npm test` |
| P2 | `npm run typecheck && npm test && npm run check:artifacts && npm run test:artifacts` |
| P3 | `npm run build && npm run test:browser` |
| P4 | `npm run build && npm test && npm run check:artifacts && npm pack` |
