# Security Hardening Implementation Plan

Source de cadrage:

- `docs/security-hardening-plan.md`
- `ARTIFACT_FRESHNESS_POLICY.md`

Ce plan decrit l'ordre d'implementation pour rendre le Markdown hostile
inoffensif pendant la conversion, sans ajouter de nouvel artifact tiers et sans
changer la politique de fraicheur des artifacts.

## 1. Objectif

Mettre en place tous les points du Security Hardening Plan:

- images raster locales uniquement: PNG, JPEG, WebP;
- rejet systematique de SVG, GIF, chemins absolus, URI et images distantes;
- containment image base sur les chemins reels;
- limites de taille pour Markdown, lignes, images, Mermaid et code fences;
- liens HTTPS passifs conserves dans le PDF;
- schemas actifs, locaux ou dangereux bloques;
- rendu HTML local sans ressource reseau active;
- lancement navigateur/WebDriver durci;
- tests hostiles couvrant chaque frontiere de securite.

## 2. Regles de travail

- Ne pas ajouter de dependance, moteur, binaire, police, asset distant ou driver.
- Toute modification future d'artifact doit respecter
  `ARTIFACT_FRESHNESS_POLICY.md` avant d'etre referencee.
- Toutes les nouvelles erreurs de rejet doivent utiliser `RenderError` avec un
  message clair, `sourcePath` quand disponible, et un `actionHint` exploitable.
- Les constantes de limites doivent rester internes dans un premier temps.
- Les changements doivent etre livres par petites etapes testees, avec
  `npm run typecheck` et les suites ciblees avant les gates complets.

## 3. Fichiers principaux concernes

Implementation:

- `src/markdownRenderer.ts`: validation Markdown, images, liens, Mermaid, code
  fences, HTML assemble.
- `src/converter.ts`: lecture source et propagation des erreurs, si un precheck
  de taille fichier doit etre place avant lecture complete.
- `src/webDriverClient.ts`: capabilities navigateur, flags, profils temporaires,
  transport local WebDriver.
- `src/webDriverSession.ts`: binding local du driver et tests de readiness.

Tests:

- `tests/unit/markdownRenderer/markdownRenderer.test.ts`
- `tests/unit/markdownRenderer/markdownRendererHarness.test.ts`
- `tests/unit/webDriverClient/webDriverClient.test.ts`
- `tests/unit/webDriverSession/webDriverSession.test.ts`
- `tests/integration/converter.test.ts`
- `tests/browser/browserBackedConversion.test.ts`

## 4. Phase 0 - Baseline et garde-fous

1. Lancer les controles actuels pour capturer l'etat de depart:
   - `npm run typecheck`
   - `npm test`
   - `npm run test:artifacts`
   - `npm run check:artifacts`
2. Confirmer qu'aucun nouvel artifact n'est necessaire.
3. Identifier les tests a modifier parce que le comportement attendu change:
   - les liens HTTPS ne doivent plus etre retires;
   - SVG doit etre refuse par format, meme sans URL externe.
4. Creer, si utile, des helpers de fixtures dans les tests Markdown:
   - tiny PNG valide;
   - tiny JPEG valide;
   - tiny WebP valide;
   - buffers avec extension trompeuse;
   - fichiers surdimensionnes synthetiques.

Gate de sortie:

```bash
npm run typecheck
npm test
```

## 5. Phase 1 - Constantes et prevalidation Markdown

1. Ajouter dans `src/markdownRenderer.ts` des constantes internes:
   - `MAX_MARKDOWN_BYTES = 10 * 1024 * 1024`;
   - `MAX_MARKDOWN_LINE_BYTES = 1 * 1024 * 1024`;
   - `MAX_IMAGE_COUNT = 100`;
   - `MAX_MERMAID_BLOCK_COUNT = 50`;
   - `MAX_MERMAID_BLOCK_BYTES = 256 * 1024`;
   - `MAX_HIGHLIGHT_CODE_BYTES = 1 * 1024 * 1024`;
   - `MAX_SINGLE_IMAGE_BYTES = 20 * 1024 * 1024`;
   - `MAX_TOTAL_IMAGE_BYTES = 100 * 1024 * 1024`;
   - `MAX_IMAGE_PIXELS = 25_000_000`.
2. Ajouter un precheck appele au debut de `renderToHtml`:
   - mesurer la taille UTF-8 du Markdown;
   - rejeter tout document au-dessus de 10 MB;
   - parcourir les lignes et rejeter toute ligne au-dessus de 1 MB;
   - utiliser `RenderError` avec action hint "Simplify the document...".
3. Ajouter des tests unitaires:
   - Markdown trop gros;
   - ligne trop longue;
   - message et `actionHint` coherents.

Gate de sortie:

```bash
npm run typecheck
npm test -- tests/unit/markdownRenderer/markdownRenderer.test.ts
```

## 6. Phase 2 - Compteurs de rendu et limites structurelles

1. Remplacer l'environnement de rendu par un etat mutable interne:
   - `imageCount`;
   - `totalImageBytes`;
   - `mermaidBlockCount`;
   - eventuellement `sourcePath` et `context`.
2. Dans `renderImage`:
   - incrementer `imageCount`;
   - rejeter au-dessus de 100 images avant embedding.
3. Dans `renderFence`:
   - detecter Mermaid;
   - incrementer `mermaidBlockCount`;
   - rejeter au-dessus de 50 blocs;
   - rejeter un bloc Mermaid au-dessus de 256 KB.
4. Dans `renderHighlightedFence` ou `highlightCode`:
   - rejeter tout code fence non-Mermaid au-dessus de 1 MB;
   - garder une erreur fail-loud, sauf decision produit contraire ulterieure.
5. Ajouter des tests unitaires:
   - trop d'images;
   - trop de blocs Mermaid;
   - bloc Mermaid trop gros;
   - code fence trop gros.

Gate de sortie:

```bash
npm run typecheck
npm test -- tests/unit/markdownRenderer/markdownRenderer.test.ts
```

## 7. Phase 3 - Allowlist image et rejet SVG/GIF

1. Remplacer `mimeTypeForPath` par une detection stricte:
   - extension autorisee: `.png`, `.jpg`, `.jpeg`, `.webp`;
   - extension interdite: `.svg`, `.gif`, sans extension, inconnue;
   - message SVG dedie:
     "SVG images are not supported for security reasons; use PNG/JPEG/WebP."
2. Refuser SVG avant toute lecture ou analyse de contenu.
3. Supprimer l'exception actuelle qui accepte SVG sans URL externe.
4. Garder Mermaid separe: les diagrammes Mermaid restent issus de code fences
   echappes et du moteur Mermaid inline deja embarque.
5. Ajouter des tests:
   - SVG simple refuse;
   - SVG avec `http:`, `https:`, `file:`, `<script>`, `<foreignObject>` refuse;
   - GIF refuse;
   - fichier sans extension refuse;
   - extension inconnue refusee;
   - PNG/JPEG/WebP valides toujours acceptes.

Gate de sortie:

```bash
npm run typecheck
npm test -- tests/unit/markdownRenderer/markdownRenderer.test.ts
```

## 8. Phase 4 - Realpath containment des images

1. Modifier `resolveImagePath`:
   - rejeter URI, protocole scheme, `//...` et chemins absolus avant toute
     resolution disque;
   - resoudre le repertoire source;
   - resoudre `baseDir` via `realpath`;
   - resoudre le chemin candidat via `realpath`;
   - accepter uniquement si le chemin reel de l'image reste sous le `baseDir`
     reel.
2. Conserver un message clair pour les images manquantes:
   - ne pas transformer un missing file en erreur de containment ambigue.
3. Ajouter une branche testable pour symlink:
   - sur plateformes supportant les symlinks, creer un lien local vers un
     fichier hors `baseDir`;
   - ignorer proprement le test si l'OS refuse la creation du symlink.
4. Ajouter des tests:
   - `../outside.png` refuse;
   - symlink sortant refuse;
   - image normale dans le dossier source acceptee;
   - image en sous-dossier acceptee;
   - image sous `baseDir` explicite acceptee;
   - image manquante garde l'erreur missing-file.

Gate de sortie:

```bash
npm run typecheck
npm test -- tests/unit/markdownRenderer/markdownRenderer.test.ts
```

## 9. Phase 5 - Signature, taille et dimensions image

1. Ajouter une fonction de lecture/validation d'image:
   - lire le fichier;
   - rejeter si taille fichier > 20 MB;
   - detecter la signature magique;
   - comparer signature detectee et extension attendue;
   - extraire les dimensions minimales;
   - rejeter si largeur * hauteur > 25 MP;
   - incrementer `totalImageBytes`;
   - rejeter si total > 100 MB.
2. Implementer les parseurs minimaux sans nouvelle dependance:
   - PNG: signature PNG, IHDR width/height;
   - JPEG: marqueurs SOF pertinents pour width/height;
   - WebP: RIFF/WEBP avec VP8, VP8L et VP8X.
3. Rejeter les fichiers tronques ou non parseables avec `RenderError`.
4. Ajouter des tests:
   - `.png` avec contenu non-PNG refuse;
   - `.jpg`/`.jpeg` avec contenu non-JPEG refuse;
   - `.webp` avec contenu non-WebP refuse;
   - fichier > 20 MB refuse;
   - image > 25 MP refusee;
   - cumul > 100 MB refuse;
   - fixtures PNG/JPEG/WebP valides acceptees.

Gate de sortie:

```bash
npm run typecheck
npm test -- tests/unit/markdownRenderer/markdownRenderer.test.ts
```

## 10. Phase 6 - Politique de liens passifs

1. Modifier `renderLinkOpen`:
   - conserver `href` uniquement pour `https://...`;
   - retirer `href` pour `http://...`;
   - retirer `href` pour `javascript:`, `data:`, `file:`, `blob:`, `ftp:`,
     schemas inconnus;
   - retirer `href` pour chemins locaux absolus ou root-relative comme
     `/etc/passwd`;
   - ajouter `data-md2pdf-blocked-href="true"` quand un lien est bloque.
2. Ne jamais appliquer cette autorisation aux images:
   - les images `https://...` restent refusees.
3. Verifier l'HTML assemble:
   - pas de `<img src="https://...">`;
   - pas de `<script src="https://...">`;
   - pas de `<link href="https://...">`.
4. Mettre a jour le test actuel `NFR-02` qui attend que les liens HTTPS soient
   retires.
5. Ajouter des tests:
   - HTTPS conserve;
   - HTTP bloque;
   - dangerous schemes bloques;
   - `/etc/passwd` et chemins locaux absolus bloques;
   - remote image HTTPS toujours refusee;
   - HTML sans ressource reseau active.

Gate de sortie:

```bash
npm run typecheck
npm test -- tests/unit/markdownRenderer/markdownRenderer.test.ts
```

## 11. Phase 7 - Durcissement WebDriver et navigateur

1. Verifier `src/webDriverSession.ts`:
   - le driver doit rester bind sur `127.0.0.1`;
   - aucune configuration ne doit exposer le driver sur une interface externe.
2. Completer `browserCapabilities` dans `src/webDriverClient.ts` pour Chrome,
   Chromium, Edge, Brave et Vivaldi:
   - conserver profil temporaire par run;
   - conserver direct/no-proxy;
   - conserver `--disable-background-networking`;
   - ajouter les flags supportes pour desactiver extensions, sync, prompts,
     services inutiles et features de background;
   - ne pas desactiver les liens PDF.
3. Completer Firefox:
   - conserver `-headless` et `--offline`;
   - ajouter les preferences supportees pour limiter reseau, permissions,
     telemetry, sync et services de fond, si WebDriver les accepte.
4. Garder `WebDriverHttpTransport` strictement local:
   - endpoints uniquement `localhost`, `127.0.0.1`, `::1`;
   - chemins de requete incapables de sortir de l'origine locale.
5. Ajouter ou renforcer les tests:
   - capabilities Chrome/Chromium/Edge contiennent les flags durcis;
   - Firefox contient les options/prefs attendues;
   - endpoint non local refuse;
   - request path absolu ou scheme refuse;
   - profil temporaire cree et nettoye.

Gate de sortie:

```bash
npm run typecheck
npm test -- tests/unit/webDriverClient/webDriverClient.test.ts
npm test -- tests/unit/webDriverSession/webDriverSession.test.ts
```

## 12. Phase 8 - Tests hostiles d'integration

1. Ajouter une section hostile-input aux tests d'integration converter:
   - document avec image traversal refuse;
   - document avec SVG refuse;
   - document avec lien dangereux produit HTML sans href dangereux;
   - conversion ne laisse pas de PDF partiel en cas de `RenderError`.
2. Ajouter un test browser-backed local-only si l'infrastructure existante le
   permet:
   - etat pre-provisionne;
   - HTML local sans ressource active;
   - liens HTTPS passifs conserves dans le PDF ou au minimum dans l'HTML imprime.
3. Verifier que les tests lents restent dans les scripts existants:
   - `npm run test:browser`;
   - `npm run test:real-browser`.

Gate de sortie:

```bash
npm run typecheck
npm test
npm run test:browser
```

## 13. Phase 9 - Documentation utilisateur minimale

1. Mettre a jour `README.md` seulement si l'implementation change la surface
   utilisateur visible:
   - formats image supportes;
   - SVG/GIF non supportes;
   - limites documentees;
   - liens HTTPS cliquables mais ressources distantes interdites.
2. Ne pas modifier requirements, user stories ou architecture sans validation
   utilisateur explicite prealable.
3. Si README est modifie, verifier qu'il ne promet pas de support qui contredit
   `docs/security-hardening-plan.md`.

Gate de sortie:

```bash
npm run typecheck
npm test
```

## 14. Phase 10 - Validation finale

Executer les gates complets:

```bash
npm run typecheck
npm test
npm run test:artifacts
npm run check:artifacts
npm run build
npm run test:browser
npm run test:real-browser
```

Si la machine locale ne peut pas executer un test browser-backed, noter la
raison exacte dans la PR ou le rapport de validation et garder les tests unitaires
en vert.

## 15. Definition de fini

Le hardening est termine quand:

- SVG, GIF, extensions inconnues et mismatches extension/signature sont rejetes;
- les images PNG/JPEG/WebP valides restent acceptees;
- traversal, chemins absolus, URI, remote images et symlinks sortants sont
  rejetes;
- les limites Markdown, ligne, image count, Mermaid, code fence, taille image,
  cumul image et pixels sont couvertes par tests;
- HTTPS reste cliquable comme lien passif;
- schemas actifs, locaux ou inconnus perdent leur `href`;
- l'HTML genere ne contient aucune ressource reseau active;
- WebDriver reste local et les capabilities incluent les flags de durcissement;
- les suites de tests ciblees et les gates finaux passent;
- aucun artifact tiers nouveau ou modifie n'a ete introduit sans passer par
  `ARTIFACT_FRESHNESS_POLICY.md`.

