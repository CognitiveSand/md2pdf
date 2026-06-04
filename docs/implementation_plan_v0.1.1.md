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
- `audit/2026-06-04-implementation-plan-v0.1.1-audit.md`, comme liste de
  corrections a integrer au plan

`dist/` est une sortie de build uniquement. Il ne doit pas etre consulte,
copie, diff-checke ou utilise comme source de verite pour reconstruire `src/`.
Le premier build valide doit regenerer `dist/` depuis `src/`.

## 2. Portee v0.1.1

`0.1.1` couvre le MVP fonctionnel marque `MVP` dans les requirements:

- convertir un fichier `.md` en PDF a cote de la source par defaut;
- supporter le dialecte Markdown attendu: prose, headings, listes, tables,
  task lists, footnotes, code fences avec highlighting, images relatives;
- rendre les blocs Mermaid comme diagrammes, pas comme texte brut;
- rester local-only pendant la conversion: aucun service reseau et aucune
  ressource distante;
- proposer `--output`, `--output-dir`, `--force-overwrite`, `--help`;
- convertir plusieurs fichiers et les fichiers Markdown top-level d'un dossier;
- continuer un batch apres une erreur et publier un resume stdout;
- proteger les PDFs existants contre l'ecrasement accidentel;
- produire des erreurs stderr claires et les exit codes `0`, `1`, `2`;
- etre packagable et installable comme commande npm `md2pdf`;
- prouver l'installation user-scope, la procedure system-scope documentee et
  l'idempotence install/upgrade (`FR-19`, `FR-20`, `FR-21`);
- respecter strictement la politique de fraicheur des artifacts, y compris pour
  tout driver ou navigateur provisionne a runtime.

Hors scope `0.1.1`:

- GUI, preview, themes configurables, recursion de dossiers, fusion de plusieurs
  sources en un PDF, backend LaTeX, round-trip PDF vers Markdown.

Decision navigateur pour `0.1.1`:

- Le chemin principal detecte un navigateur deja installe et provisionne le
  driver compatible en cache utilisateur.
- Le fallback Chromium-for-Testing est in scope comme dernier recours seulement
  si son navigateur et son driver sont declares dans `artifacts.json`, choisis
  par `newest eligible`, et couverts par tests d'artifact policy. Si aucune
  version compatible eligible n'existe, md2pdf doit echouer clairement avec
  `BrowserNotFoundError` dont la cause indique l'absence d'artifact eligible.

## 3. Contrat commun C0

C0 est un vrai gate: il doit compiler vert. Les fonctions non implementees
peuvent lancer `NotImplementedError`, mais les types, exports et imports
partages doivent etre stables.

### API de conversion

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

### Erreurs partagees

Chaque erreur partagee herite de `Md2PdfError` et expose au minimum:

```ts
export type ErrorKind =
  | 'usage'
  | 'input'
  | 'conversion'
  | 'render'
  | 'browser'
  | 'artifact'
  | 'not-implemented';

export interface Md2PdfErrorContext {
  kind: ErrorKind;
  message: string;
  sourcePath?: string;
  outputPath?: string;
  artifactName?: string;
  actionHint?: string;
  cause?: unknown;
}
```

Classes requises:

- `Md2PdfError`
- `UsageError`
- `InputNotFoundError`
- `ConversionError`
- `RenderError`
- `BrowserNotFoundError`
- `ArtifactFreshnessError`
- `NotImplementedError`

Le CLI formate toute erreur via une seule fonction testee. Les chemins fautifs
exiges par `FR-15` et `FR-16` doivent venir des champs d'erreur, pas d'un parsing
fragile du message.

### Modele de travail batch

Stream A et Stream B partagent le modele suivant:

```ts
export interface ConversionJob {
  sourcePath: string;
  outputPath: string;
  originEntry: string;
}

export type ConversionStatus = 'success' | 'failed' | 'skipped';

export interface ConversionOutcome extends ConversionJob {
  status: ConversionStatus;
  error?: Md2PdfError;
}
```

Les jobs sont resolus avant tout rendu. Les collisions d'output sont detectees
en preflight et n'ouvrent jamais de prompt overwrite.

### Contrat artifact/runtime provisioning

Avant `browserLocator`, C0 definit aussi les interfaces suivantes:

- `ArtifactPolicy.selectNewestEligible(releases, constraints, now)`;
- `ReleaseCatalog` fakeable en test, avec timestamps de publication;
- declaration obligatoire des drivers et navigateurs fallback dans
  `artifacts.json`;
- erreur `ArtifactFreshnessError` si aucune version compatible eligible n'existe;
- interdiction d'utiliser `latest`, un tag flottant ou un telechargement non
  inventorie.

## 4. Stream A - Experience CLI et orchestration

### Mission

Stream A livre tout ce que l'utilisateur observe autour du rendu PDF: commande,
options, resolution des chemins, batch, overwrite, erreurs, exit codes,
installation et packaging.

### Fichiers possedes

- `src/cli.ts`
- `src/paths.ts`
- `src/overwrite.ts`
- `src/pipeline.ts`
- `src/errors.ts`, seulement pendant C0 puis sur accord explicite
- tests unitaires/contract lies au CLI, paths, overwrite, pipeline,
  installation et packlist
- `README.md` pour la surface utilisateur finale
- `package.json` pour le bin et les scripts, sans ajout de dependance non
  validee par la politique d'artifacts

### Livrables

1. CLI testable
   - `main(argv, io)` sans dependance forte au process global.
   - `io` contient `stdin`, `stdout`, `stderr`, `env`, `cwd`, `isInteractive`.
   - `md2pdf [OPTIONS] ENTRY [ENTRY ...]`.
   - `--help` decrit toutes les options avec une ligne par option.
   - erreurs d'usage en exit `2`.

2. Resolution des jobs
   - entree fichier `.md`, extension comparee sans sensibilite a la casse;
   - entree dossier non recursive;
   - dossier sans fichier Markdown top-level: succes avec summary `0 succeeded,
     0 failed, 0 skipped`;
   - default output path a cote de la source;
   - `--output` limite a un seul job resolu;
   - `--output-dir` compatible single et batch;
   - parent d'output cree si possible;
   - `outputPath === sourcePath`: `UsageError`;
   - plusieurs jobs resolus vers le meme output: `UsageError` avant rendu;
   - entrees dupliquees: `UsageError` si elles produisent un output duplique.

3. Overwrite policy
   - table de decision pure;
   - prompt interactif default No;
   - reponses acceptees: `y`, `yes`, `n`, `no`, entree vide;
   - entree vide, EOF ou toute reponse non affirmative preserve le fichier;
   - `--force-overwrite` prioritaire partout;
   - skip non-interactif avec stderr et status `skipped`;
   - les skips ne comptent pas comme failures, mais apparaissent dans le summary.

4. Batch et resultats
   - continue-on-error pour les erreurs de conversion par document;
   - erreurs de preflight globales en exit `2`;
   - stdout summary avec success/failure/skip counts;
   - exit `0` si aucun job n'a echoue;
   - exit `1` si au moins une conversion echoue.

5. Installation et packaging
   - `bin.md2pdf` pointe vers `dist/cli.js`;
   - `npm run build` produit le binaire;
   - `npm pack --json` est inspecte pour verifier la packlist;
   - installation user-scope testee avec un prefixe temporaire;
   - deux installations successives du meme tarball dans le meme prefixe
     terminent en exit `0`;
   - procedure system-scope documentee et demontrable sans modifier le poste de
     developpement;
   - README verifie par checklist testable: options CLI, exemples, limitations,
     navigateur/driver, installation, exit codes.

### Tests Stream A

- `@req FR-02`, `FR-03`, `FR-08`, `FR-09`, `FR-10`, `FR-11`,
  `FR-12`, `FR-13`, `FR-14`, `FR-15`, `FR-17`, `FR-18`, `FR-19`,
  `FR-20`, `FR-21`, `FR-23`, `NFR-04`.
- Les tests de pipeline utilisent un faux converter pour eviter toute dependance
  au navigateur.

## 5. Stream B - Moteur de rendu local

### Mission

Stream B livre la conversion documentaire reelle: Markdown vers HTML local,
HTML vers PDF via navigateur installe ou fallback eligible, Mermaid, local-only
et rendu atomique.

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
   - image relative manquante ou illisible: `RenderError` ou `ConversionError`
     avec `sourcePath` et `actionHint`;
   - CSS default et highlight inline;
   - Mermaid engine inline;
   - aucune URL `http:` ou `https:` dans le HTML assemble, hors texte utilisateur
     rendu explicitement comme texte.

2. Local render harness
   - `renderToHtml(markdown, context)`;
   - `renderToTempHtml(markdown, context)`;
   - fichier HTML temporaire chargeable en `file:`;
   - nettoyage des fichiers temporaires apres succes, erreur ou timeout.

3. Browser, driver et artifacts
   - detection Chrome/Chromium/Edge/Brave et Firefox;
   - support `MD2PDF_BROWSER`;
   - resolution/provisioning driver conforme a `ArtifactPolicy`;
   - fallback Chromium-for-Testing conforme a `ArtifactPolicy`;
   - cache utilisateur versionne par artifact et version exacte;
   - aucun chemin runtime ne telecharge ou selectionne un artifact hors
     `newest eligible`;
   - `BrowserNotFoundError` contient navigateurs supportes, `MD2PDF_BROWSER`,
     et cause artifact si le fallback est impossible.

4. WebDriver Print
   - session WebDriver minimale;
   - navigation vers `file:`;
   - flags offline/no-proxy quand supportes;
   - attente Mermaid avec timeout;
   - Print command vers bytes PDF;
   - timeout et wrapping en `RenderError`;
   - fermeture session et process driver en `finally`.

5. Converter atomique
   - lire la source UTF-8;
   - assembler HTML;
   - rendre PDF;
   - ecrire l'output seulement apres rendu complet;
   - aucun PDF partiel en cas d'erreur;
   - le provisioning peut utiliser le reseau avant conversion si necessaire et
     conforme a la politique; la conversion d'un job deja provisionne ne doit
     ouvrir aucune connexion sortante.

### Tests Stream B

- `@req FR-01`, `FR-04`, `FR-05`, `FR-06`, `FR-07`, `FR-16`,
  `FR-19`, `FR-24`, `NFR-01`, `NFR-02`, `NFR-03`, `NFR-05`.
- Les tests HTML restent rapides et sans navigateur.
- Les tests PDF/browser sont isoles dans une commande lente dediee, mais sont
  obligatoires pour P3 et la release gate.
- Mermaid est valide par un test qui detecte l'absence du raw diagram source
  dans le PDF et la presence d'un rendu graphique/vectoriel ou image.
- Local-only est valide par deux preuves: HTML sans URL externe exploitable et
  conversion browser-backed en mode offline/no-proxy apres provisioning.

## 6. Ordre d'execution

### C0 - Contrat et squelette partage

Travail commun, court, avant de separer les streams:

- creer les exports partages d'erreurs;
- valider `ConvertOptions` et `convertFile`;
- creer `ConversionJob`, `ConversionOutcome`, `ArtifactPolicy`,
  `ReleaseCatalog`;
- verifier que les imports entre streams ne creent pas de cycle;
- poser les conventions de nommage de tests avec tags `@req`;
- ajouter des stubs qui lancent `NotImplementedError` mais compilent.

Gate bloquant:

```bash
npm run typecheck
npm test -- --run tests/unit/contracts
```

Si cette commande est rouge, les streams ne partent pas en parallele.

### P1 - Parallele initial

Stream A:

- CLI help et parsing;
- paths;
- usage errors;
- preflight `ConversionJob`.

Stream B:

- Markdown vers HTML local;
- assets inline;
- tests local-only sur le HTML;
- release catalog fakeable.

Gate commune:

```bash
npm run typecheck
npm test
```

### P2 - Parallele comportemental

Stream A:

- overwrite policy;
- batch et summaries;
- exit codes;
- edge cases: output collisions, duplicates, dossiers vides, prompt EOF.

Stream B:

- browser locator;
- driver et fallback policy/provisioning;
- WebDriver client minimal;
- cleanup temporaire et sessions en erreur.

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
- Mermaid rendu comme diagramme et raw source absent;
- aucun ecrasement sans confirmation ou `--force-overwrite`;
- erreurs de rendu remontent avec le chemin source;
- conversion browser-backed offline apres provisioning.

Gate bloquant:

```bash
npm run build
npm run test:browser
```

### P4 - Stabilisation release

- README final avec checklist options/limitations/install/errors;
- packaging smoke;
- install user-scope temporaire;
- reinstall idempotent du tarball;
- verification `npm pack --json` et contenu tarball;
- procedure system-scope documentee;
- correction des ecarts de traceabilite requirements/tests;
- verification que `dist/` est regenere depuis `src/`.

Gate bloquant:

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
- `errors.ts`, `contracts` et `ArtifactPolicy` sont communs uniquement pendant
  C0; ensuite toute modification doit etre annoncee et testee par les deux
  streams.
- Le README est finalise par Stream A, mais Stream B fournit les notes exactes
  sur navigateur, driver, fallback, cache et limitations runtime.
- Toute nouvelle dependance, driver, asset vendore, runtime provisionne ou
  action CI doit passer par `ARTIFACT_FRESHNESS_POLICY.md` avant d'etre ajoute
  ou reference.

## 8. Definition de fini v0.1.1

`0.1.1` est fini quand:

- les acceptance criteria US-01 a US-08 passent;
- `npm run typecheck`, `npm test`, `npm run check:artifacts`, `npm run build`
  passent;
- C0, P1, P2, P3 et P4 ont ete verts au moins une fois sur la branche;
- au moins un run browser-backed produit un PDF reel;
- Mermaid est prouve comme rendu graphique ou image, et non comme raw text;
- la conversion ne reference aucune URL externe exploitable dans le HTML
  assemble;
- la conversion browser-backed passe en mode offline/no-proxy apres
  provisioning;
- le CLI respecte les exit codes `0`, `1`, `2`;
- les PDFs existants sont preserves sauf confirmation ou `--force-overwrite`;
- collisions `--output-dir`, duplicates, dossiers vides, prompts EOF, images
  manquantes et output egal source ont des tests dedies;
- `FR-19`, `FR-20` et `FR-21` ont une preuve d'installation ou une procedure
  documentee conforme aux requirements;
- `npm pack --json` et l'inspection du tarball prouvent la presence de `dist/`,
  `assets/`, `README.md`, `ARTIFACT_FRESHNESS_POLICY.md`, `artifacts.json`;
- le README correspond a la CLI via checklist testable;
- `dist/` n'a pas servi de source de verite et est regenere depuis `src/`.
