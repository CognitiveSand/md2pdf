# md2pdf - Implementation Plan v0.1.1

## 1. Decision de cadrage

La version `0.1.1` repart de zero cote implementation applicative. Pour ce
plan, `src/` est considere vide: les modules TypeScript doivent etre crees a
partir des exigences et de l'architecture, pas derives d'un prototype partiel.

Source volontairement exclue pour piloter le travail:

- `docs/implementation_plan_v0.1.md`

Sources autorisees pour `0.1.1`:

- `docs/project_description.md`
- `docs/project_requirements.md`
- `docs/user_stories.md`
- `docs/architecture.md`
- `docs/ci_matrix_v0.1.md`, uniquement pour les gates de verification
- `ARTIFACT_FRESHNESS_POLICY.md`

Le but est de livrer une implementation propre de `md2pdf@0.1.1`, conforme a la
doc produit, avec deux streams paralleles et un contrat d'integration stable.

## 2. Portee v0.1.1

`0.1.1` doit couvrir le MVP fonctionnel decrit par les requirements:

- convertir un fichier `.md` en PDF a cote de la source par defaut;
- supporter le dialecte Markdown attendu: prose, headings, listes, tables,
  task lists, footnotes, code fences avec highlighting, images relatives;
- rendre les blocs Mermaid comme diagrammes, pas comme texte brut;
- rester local-only: aucune ressource externe, aucun service reseau;
- proposer `--output`, `--output-dir`, `--force-overwrite`, `--help`;
- convertir plusieurs fichiers et les fichiers Markdown top-level d'un dossier;
- continuer un batch apres une erreur et publier un resume stdout;
- proteger les PDFs existants contre l'ecrasement accidentel;
- produire des erreurs stderr claires et les exit codes `0`, `1`, `2`;
- etre packagable comme commande npm `md2pdf`;
- respecter strictement la politique de fraicheur des artifacts.

Hors scope `0.1.1`:

- GUI, preview, themes configurables, recursion de dossiers, fusion de plusieurs
  sources en un PDF, backend LaTeX, round-trip PDF vers Markdown.

## 3. Contrat commun minimal

Avant de travailler en parallele, les deux streams stabilisent un petit contrat
partage. Ce contrat est la frontiere d'integration.

```ts
export interface ConvertOptions {
  browserPath?: string;
  renderTimeoutMs?: number;
}

export async function convertFile(
  sourcePath: string,
  outputPath: string,
  options?: ConvertOptions,
): Promise<void>;
```

Erreurs partagees:

- `Md2PdfError`
- `UsageError`
- `ConversionError`
- `RenderError`
- `BrowserNotFoundError`
- `ArtifactFreshnessError`

Regle d'integration: Stream A peut injecter un faux `convertFile` pour tester le
CLI et le batch; Stream B peut tester le vrai `convertFile` sans CLI.

## 4. Stream A - Experience CLI et orchestration

### Mission

Stream A livre tout ce que l'utilisateur observe autour du rendu PDF: commande,
options, resolution des chemins, batch, overwrite, erreurs, exit codes et
packaging.

### Fichiers possedes

- `src/cli.ts`
- `src/paths.ts`
- `src/overwrite.ts`
- `src/pipeline.ts`
- `src/errors.ts`, seulement apres accord C0 sur les classes communes
- tests unitaires/contract lies au CLI, paths, overwrite, pipeline
- `README.md` pour la surface utilisateur finale
- `package.json` pour le bin et les scripts, sans ajout de dependance non
  validee par la politique d'artifacts

### Livrables

1. CLI testable
   - `main(argv, io)` sans dependance forte au process global.
   - `md2pdf [OPTIONS] ENTRY [ENTRY ...]`.
   - `--help` decrit toutes les options avec une ligne par option.
   - erreurs d'usage en exit `2`.

2. Resolution des travaux
   - entree fichier `.md`;
   - entree dossier non recursive;
   - default output path a cote de la source;
   - `--output` limite a une seule sortie;
   - `--output-dir` compatible single et batch.

3. Overwrite policy
   - table de decision pure;
   - prompt interactif default No;
   - skip non-interactif avec stderr;
   - `--force-overwrite` prioritaire partout.

4. Batch et resultats
   - continue-on-error;
   - stdout summary avec success/failure counts;
   - exit `0` si tout reussit;
   - exit `1` si au moins une conversion echoue.

5. Packaging utilisateur
   - `bin.md2pdf` pointe vers `dist/cli.js`;
   - `npm run build` produit le binaire;
   - `npm pack` contient les fichiers attendus;
   - README aligne sur la CLI implementee.

### Tests Stream A

- `@req FR-02`, `FR-03`, `FR-08`, `FR-09`, `FR-10`, `FR-11`,
  `FR-12`, `FR-13`, `FR-14`, `FR-15`, `FR-17`, `FR-18`, `FR-23`,
  `NFR-04`.
- Les tests de pipeline utilisent un faux converter pour eviter toute dependance
  au navigateur.

## 5. Stream B - Moteur de rendu local

### Mission

Stream B livre la conversion documentaire reelle: Markdown vers HTML local,
HTML vers PDF via navigateur installe, Mermaid, local-only et rendu atomique.

### Fichiers possedes

- `src/converter.ts`
- `src/markdownRenderer.ts`
- `src/browserLocator.ts`
- `src/webDriverClient.ts`
- `src/pdfRenderer.ts`
- `src/releaseCatalog.ts`
- `assets/default.css`
- `assets/highlight.css`
- tests unitaires/integration lies au rendu, navigateur, WebDriver et artifacts
- `scripts/checkArtifactFreshness.mjs` seulement si necessaire pour relier le
  runtime provisioning a la politique

### Livrables

1. Markdown vers HTML local
   - CommonMark plus tables, task lists, footnotes;
   - highlight.js pour les code fences non-Mermaid;
   - blocs Mermaid rendus en elements utilisables par le navigateur;
   - images relatives integrees localement;
   - CSS default et highlight inline;
   - Mermaid engine inline;
   - aucune URL `http:` ou `https:` dans le HTML assemble.

2. Local render harness
   - `renderToHtml(markdown, context)`;
   - `renderToTempHtml(markdown, context)`;
   - fichier HTML temporaire chargeable en `file:`.

3. Browser et driver
   - detection Chrome/Chromium/Edge/Brave et Firefox;
   - support `MD2PDF_BROWSER`;
   - resolution/provisioning driver conforme a la politique de fraicheur;
   - `BrowserNotFoundError` actionnable.

4. WebDriver Print
   - session WebDriver minimale;
   - navigation vers `file:`;
   - attente Mermaid;
   - Print command vers bytes PDF;
   - timeout et wrapping en `RenderError`.

5. Converter atomique
   - lire la source UTF-8;
   - assembler HTML;
   - rendre PDF;
   - ecrire l'output seulement apres rendu complet;
   - aucun PDF partiel en cas d'erreur.

### Tests Stream B

- `@req FR-01`, `FR-04`, `FR-05`, `FR-06`, `FR-07`, `FR-16`,
  `FR-19`, `FR-24`, `NFR-01`, `NFR-02`, `NFR-03`, `NFR-05`.
- Les tests HTML restent rapides et sans navigateur.
- Les tests PDF/browser sont isoles dans une commande lente dediee.

## 6. Ordre d'execution

### C0 - Contrat et squelette partage

Travail commun, court, avant de separer les streams:

- creer les exports partages d'erreurs;
- valider `ConvertOptions` et `convertFile`;
- verifier que les imports entre streams ne creent pas de cycle;
- poser les conventions de nommage de tests avec tags `@req`.

Gate:

```bash
npm run typecheck
```

Il peut rester rouge pour les fonctions non implementees, mais pas pour une
ambiguite de contrat entre les streams.

### P1 - Parallele initial

Stream A:

- CLI help et parsing;
- paths;
- usage errors.

Stream B:

- Markdown vers HTML local;
- assets inline;
- tests local-only sur le HTML.

Gate commune:

```bash
npm run typecheck
npm test
```

### P2 - Parallele comportemental

Stream A:

- overwrite policy;
- batch et summaries;
- exit codes.

Stream B:

- browser locator;
- driver policy/provisioning;
- WebDriver client minimal.

Gate commune:

```bash
npm run typecheck
npm test
npm run check:artifacts
```

### P3 - Integration verticale

Integration des deux streams:

- Stream A appelle le vrai `convertFile`;
- conversion single-file bout en bout;
- Mermaid visible dans le PDF;
- aucun ecrasement sans confirmation ou `--force-overwrite`;
- erreurs de rendu remontent avec le chemin source.

Gate:

```bash
npm run build
npm run test:browser
```

### P4 - Stabilisation release

- README final;
- packaging smoke;
- install user-scope temporaire;
- verification des fichiers inclus dans le tarball;
- correction des ecarts de traceabilite requirements/tests.

Gate:

```bash
npm run build
npm test
npm run check:artifacts
npm pack
```

## 7. Regles anti-conflit

- Stream A ne modifie pas `markdownRenderer.ts`, `browserLocator.ts`,
  `webDriverClient.ts`, `pdfRenderer.ts`, sauf accord explicite.
- Stream B ne modifie pas `cli.ts`, `paths.ts`, `overwrite.ts`, `pipeline.ts`,
  sauf accord explicite.
- `errors.ts` est commun uniquement pendant C0; ensuite toute modification doit
  etre annoncee.
- Le README est finalise par Stream A, mais Stream B fournit les notes exactes
  sur navigateur/driver quand elles sont implementees.
- Toute nouvelle dependance, driver, asset vendore, runtime provisionne ou
  action CI doit passer par `ARTIFACT_FRESHNESS_POLICY.md` avant d'etre ajoute
  ou reference.

## 8. Definition de fini v0.1.1

`0.1.1` est fini quand:

- les acceptance criteria US-01 a US-08 passent;
- `npm run typecheck`, `npm test`, `npm run check:artifacts`, `npm run build`
  passent;
- au moins un run browser-backed produit un PDF reel;
- Mermaid est rendu comme diagramme;
- la conversion ne reference aucune URL externe dans le HTML assemble;
- le CLI respecte les exit codes `0`, `1`, `2`;
- les PDFs existants sont preserves sauf confirmation ou `--force-overwrite`;
- `npm pack` contient `dist/`, `assets/`, `README.md`,
  `ARTIFACT_FRESHNESS_POLICY.md`, `artifacts.json`;
- le README correspond exactement a la CLI et aux limitations implementees.
