# md2pdf - Implementation Plan v0.1.2

## 1. Decision de cadrage

La version `0.1.2` reprend le plan `0.1.1` comme base executable et integre les
corrections de l'audit new du 2026-06-04. Elle reste un redemarrage applicatif:
pour ce plan, `src/` est considere vide et `dist/` reste une sortie de build
uniquement.

Sources autorisees:

- `docs/project_description.md`
- `docs/project_requirements.md`
- `docs/user_stories.md`
- `docs/architecture.md`
- `docs/ci_matrix_v0.1.md`, uniquement pour les gates de verification
- `ARTIFACT_FRESHNESS_POLICY.md`
- `artifacts.json`
- `audit/2026-06-04-implementation-plan-v0.1.1-new-audit.md`, comme liste de
  corrections a integrer

Sources volontairement exclues pour piloter l'implementation:

- `docs/implementation_plan_v0.1.md`
- `dist/`

Le premier build valide doit regenerer `dist/` depuis `src/`. Aucune decision
ne doit etre derivee d'un prototype partiel ou d'un fichier genere.

## 2. Portee v0.1.2

`0.1.2` couvre le MVP fonctionnel marque `MVP` dans les requirements:

- convertir un fichier `.md` en PDF a cote de la source par defaut;
- supporter prose, headings, listes, tables, task lists, footnotes, code fences
  avec highlighting, images relatives et Mermaid;
- rendre Mermaid comme diagramme, pas comme texte brut;
- rester local-only pendant la conversion;
- proposer `--output`, `--output-dir`, `--force-overwrite`, `--help`;
- convertir plusieurs fichiers et les fichiers Markdown top-level d'un dossier;
- continuer un batch apres une erreur et publier un resume stdout;
- proteger les PDFs existants contre l'ecrasement accidentel;
- produire des erreurs stderr claires et les exit codes `0`, `1`, `2`;
- etre packagable et installable comme commande npm `md2pdf`;
- prouver `FR-19`, `FR-20` et `FR-21`;
- respecter strictement la politique de fraicheur et d'integrite des artifacts.

Hors scope:

- GUI, preview, themes configurables, recursion de dossiers, fusion de plusieurs
  sources en un PDF, backend LaTeX, round-trip PDF vers Markdown.

Decision navigateur:

- Le chemin principal detecte un navigateur deja installe et provisionne le
  driver compatible en cache utilisateur.
- Le fallback Chromium-for-Testing est in scope comme dernier recours seulement
  s'il est declare dans `artifacts.json`, selectionne par `newest eligible`,
  verifie par checksum SHA-256 et couvert par tests d'artifact policy.
- Si aucune version compatible eligible n'existe, md2pdf echoue avec
  `BrowserNotFoundError` dont la cause indique l'absence d'artifact eligible.

## 3. P0 - Alignement documentaire et preuves release

P0 est un prerequis bloquant avant C0. Il transforme les corrections d'audit en
livrables versionnes et auditables.

### Livrables P0

1. Mettre a jour `docs/architecture.md`
   - ajouter `ConversionJob`, `ConversionOutcome`, `ConvertOptions` et
     `convertFile`;
   - decrire la separation `BrowserLocator` / `ArtifactPolicy` /
     `ReleaseCatalog` / `FallbackBrowserProvisioner`;
   - documenter que Chromium-for-Testing est un fallback soumis a
     `ArtifactPolicy`;
   - expliciter la frontiere entre provisioning reseau et conversion local-only.

2. Creer `docs/release-evidence/README.md`
   - definir les preuves attendues pour une release;
   - lister les preuves automatiques et manuelles;
   - expliquer que les preuves manuelles doivent etre versionnees.

3. Creer `docs/release-evidence/fr-20-system-scope.md`
   - champs obligatoires:
     - version md2pdf testee;
     - date;
     - OS et version exacte;
     - version Node/npm;
     - commande system-scope utilisee;
     - compte utilisateur secondaire ou simulation documentee;
     - chemin du binaire invoque;
     - sortie de `md2pdf --help`;
     - resultat attendu et resultat observe;
     - auteur de la preuve.

4. Creer `docs/release-evidence/release-checklist-v0.1.2.md`
   - trace C0: contrat rouge observe puis gate vert, avec commit/log ou note de
     preuve;
   - presence de `fr-20-system-scope.md`;
   - verification packlist;
   - verification README/options;
   - revue des decisions defensives avec reference vers test ou doc;
   - confirmation que `dist/` a ete regenere depuis `src/`.

Gate P0:

```bash
npm run typecheck
```

Si le depot ne compile pas encore faute de `src/`, P0 doit au minimum laisser la
documentation coherente et la checklist creee. Aucun travail C0 ne demarre tant
que `docs/architecture.md` et le plan divergent.

## 4. Contrat commun C0

C0 est un vrai gate compile vert. Les fonctions non implementees peuvent lancer
`NotImplementedError`, mais les types, exports, imports et scripts doivent etre
stables.

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
doivent venir des champs d'erreur, pas d'un parsing du message.

### Modele batch

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

### Contrat artifacts

- `ArtifactPolicy.selectNewestEligible(releases, constraints, now)`;
- `ReleaseCatalog` fakeable en test, avec timestamps de publication;
- `FallbackBrowserProvisioner` dedie pour Chromium-for-Testing;
- declaration obligatoire des drivers et navigateurs fallback dans
  `artifacts.json`;
- URL immuable, checksum SHA-256 attendu, taille attendue et provenance pour
  chaque artifact non-npm;
- telechargement et cache atomiques: fichier `.tmp`, verification complete,
  renommage atomique;
- verification checksum avant execution;
- suppression d'un cache corrompu, partiel ou devenu non-eligible;
- interdiction d'utiliser `latest`, un tag flottant ou un telechargement non
  inventorie.

Tests obligatoires C0:

- exports contractuels importables sans cycle;
- erreurs partagees serialisables/formattables;
- selection artifact fake `newest eligible`;
- stubs qui lancent `NotImplementedError`.

Gate C0:

```bash
npm run typecheck
npm run test:contracts
```

La sequence "test contractuel rouge puis vert" doit etre tracee dans
`docs/release-evidence/release-checklist-v0.1.2.md`.

## 5. Stream A - CLI, orchestration, packaging

### Mission

Stream A livre la surface observable par l'utilisateur: parsing, chemins,
overwrite, batch, erreurs, exit codes, installation, packaging et README.

### Fichiers possedes

- `src/cli.ts`
- `src/paths.ts`
- `src/overwrite.ts`
- `src/pipeline.ts`
- `src/errors.ts`, seulement pendant C0 puis sur accord explicite
- tests unitaires/contract CLI, paths, overwrite, pipeline, install et packlist
- `README.md`
- `package.json` pour bin/scripts

### Livrables

1. CLI testable
   - `main(argv, io)` sans dependance forte au process global;
   - `io` contient `stdin`, `stdout`, `stderr`, `env`, `cwd`, `isInteractive`;
   - `md2pdf [OPTIONS] ENTRY [ENTRY ...]`;
   - `--help` decrit toutes les options avec une ligne par option;
   - erreurs d'usage en exit `2`.

2. Resolution des jobs
   - entree fichier `.md`, extension case-insensitive;
   - entree dossier non recursive;
   - dossier sans fichier Markdown top-level: exit `0` et summary
     `0 succeeded, 0 failed, 0 skipped`;
   - default output path a cote de la source;
   - `--output` limite a un seul job resolu;
   - `--output` accepte n'importe quelle extension, utilisee verbatim;
   - `--output-dir` compatible single et batch;
   - parent d'output cree si possible;
   - `outputPath === sourcePath`: `UsageError`;
   - plusieurs jobs vers le meme output: `UsageError` avant rendu;
   - entrees dupliquees: `UsageError` si elles produisent un output duplique;
   - test explicite: `--output-dir` avec `a/report.md` et `b/report.md`
     produit une collision de basename.

3. Overwrite
   - table de decision pure;
   - prompt interactif default No;
   - reponses acceptees: `y`, `yes`, `n`, `no`, entree vide;
   - entree vide, EOF ou reponse non affirmative preserve le fichier;
   - `--force-overwrite` prioritaire;
   - skip non-interactif avec stderr et status `skipped`;
   - skips dans le summary, pas dans les failures.

4. Batch
   - continue-on-error pour erreurs de conversion par document;
   - erreurs de preflight globales en exit `2`;
   - stdout summary success/failure/skip;
   - exit `0` si aucun job n'a echoue;
   - exit `1` si au moins une conversion echoue.

5. Installation et packaging
   - `bin.md2pdf` pointe vers `dist/cli.js`;
   - `npm run build` produit le binaire;
   - `npm pack --json` inspecte la packlist;
   - install user-scope avec prefixe temporaire;
   - resolution du binaire par OS: `md2pdf.cmd` sous Windows, shim POSIX sur
     Linux/macOS;
   - deux installations successives du meme tarball dans le meme prefixe en
     exit `0`;
   - `FR-20` prouve par `docs/release-evidence/fr-20-system-scope.md`;
   - README verifie contre la liste d'options `--help`.

### Tests Stream A

Tags requis: `@req FR-02`, `FR-03`, `FR-08`, `FR-09`, `FR-10`, `FR-11`,
`FR-12`, `FR-13`, `FR-14`, `FR-15`, `FR-17`, `FR-18`, `FR-19`, `FR-20`,
`FR-21`, `FR-23`, `NFR-04`.

Les tests de pipeline utilisent un faux converter.

Cas permission dedies:

- input illisible;
- parent output non writable;
- output existant non remplacable;
- message avec `sourcePath` ou `outputPath` et `actionHint`.

## 6. Stream B - Moteur de rendu local

### Mission

Stream B livre Markdown vers HTML local, HTML vers PDF via navigateur/driver,
Mermaid, local-only, provisioning conforme artifacts et rendu atomique.

### Fichiers possedes

- `src/converter.ts`
- `src/markdownRenderer.ts`
- `src/browserLocator.ts`
- `src/webDriverClient.ts`
- `src/pdfRenderer.ts`
- `src/releaseCatalog.ts`
- `src/artifactPolicy.ts`
- `src/fallbackBrowserProvisioner.ts`
- `assets/default.css`
- `assets/highlight.css`
- tests unitaires/integration rendu, navigateur, WebDriver et artifacts
- `scripts/checkArtifactFreshness.mjs` si necessaire

### Livrables

1. Markdown vers HTML local
   - CommonMark plus tables, task lists, footnotes;
   - highlight.js pour code fences non-Mermaid;
   - blocs Mermaid rendus en elements utilisables par le navigateur;
   - images relatives integrees localement;
   - image manquante/illisible: `RenderError` ou `ConversionError` avec
     `sourcePath` et `actionHint`;
   - CSS default et highlight inline;
   - Mermaid engine inline;
   - aucune URL `http:` ou `https:` exploitable dans le HTML assemble, hors texte
     utilisateur rendu explicitement comme texte.

2. Harness local
   - `renderToHtml(markdown, context)`;
   - `renderToTempHtml(markdown, context)`;
   - fichier HTML temporaire chargeable en `file:`;
   - nettoyage apres succes, erreur ou timeout.

3. Browser, driver, fallback
   - detection Chrome/Chromium/Edge/Brave et Firefox;
   - support `MD2PDF_BROWSER`;
   - `env-browser-not-found`, `env-browser-not-launchable`,
     `env-browser-no-eligible-driver`;
   - resolution/provisioning driver conforme a `ArtifactPolicy`;
   - `FallbackBrowserProvisioner` isole pour Chromium-for-Testing;
   - gate P2 dedie: fallback provisionne depuis fake catalog + checksum/cache;
   - cache utilisateur versionne par artifact et version exacte;
   - verification checksum avant chaque utilisation;
   - cache utilisateur non writable: `ArtifactFreshnessError` ou
     `BrowserNotFoundError` avec cause explicite;
   - aucun chemin runtime ne telecharge hors `newest eligible`.

4. WebDriver Print
   - session WebDriver minimale;
   - navigation vers `file:`;
   - flags offline/no-proxy quand supportes;
   - attente Mermaid avec timeout;
   - Print command vers bytes PDF;
   - timeout wrappe en `RenderError`;
   - fermeture session et process driver en `finally`.

5. Converter atomique
   - lire la source UTF-8;
   - assembler HTML;
   - rendre PDF;
   - ecrire l'output seulement apres rendu complet;
   - aucun PDF partiel en cas d'erreur;
   - provisioning termine avant conversion;
   - conversion local-only depuis etat pre-provisionne;
   - provisioning peut utiliser le reseau mais ne lit jamais le contenu
     Markdown;
   - README: premier run peut telecharger driver/fallback, jamais le contenu du
     document.

### Tests Stream B

Tags requis: `@req FR-01`, `FR-04`, `FR-05`, `FR-06`, `FR-07`, `FR-16`,
`FR-19`, `FR-24`, `NFR-01`, `NFR-02`, `NFR-03`, `NFR-05`.

Tests obligatoires:

- HTML rapide sans navigateur;
- PDF/browser isole dans commande lente obligatoire pour P3/release;
- Mermaid: absence du raw Mermaid dans le texte extrait du PDF et presence d'un
  objet image ou vectoriel;
- local-only: HTML sans URL externe exploitable et conversion offline/no-proxy
  depuis cache pre-provisionne;
- fake catalog: checksum valide, checksum invalide, download interrompu, cache
  partiel, cache devenu non-eligible, cache non writable.

## 7. Ordre d'execution

### P0 - Documentation et evidence

- aligner `docs/architecture.md`;
- creer `docs/release-evidence/README.md`;
- creer `docs/release-evidence/fr-20-system-scope.md`;
- creer `docs/release-evidence/release-checklist-v0.1.2.md`.

Gate:

```bash
npm run typecheck
```

### C0 - Contrats et squelette

- creer les exports d'erreurs;
- valider `ConvertOptions` et `convertFile`;
- creer `ConversionJob`, `ConversionOutcome`, `ArtifactPolicy`,
  `ReleaseCatalog`, `FallbackBrowserProvisioner`;
- ajouter `"test:contracts": "vitest run tests/unit/contracts --reporter=verbose"`;
- poser conventions `@req`;
- ajouter stubs `NotImplementedError`;
- tracer rouge puis vert dans la checklist release.

Gate:

```bash
npm run typecheck
npm run test:contracts
```

### P1 - Parallele initial

Stream A:

- CLI help/parsing;
- paths;
- usage errors;
- preflight `ConversionJob`.

Stream B:

- Markdown vers HTML local;
- assets inline;
- tests HTML local-only;
- release catalog fakeable.

Gate:

```bash
npm run typecheck
npm test
```

### P2 - Parallele comportemental

Stream A:

- overwrite policy;
- batch/summaries/exit codes;
- collisions, duplicates, dossiers vides, prompt EOF;
- test basename collision cross-directory.

Stream B:

- browser locator;
- driver policy/provisioning;
- `FallbackBrowserProvisioner` avec fake catalog;
- WebDriver minimal;
- cleanup temporaire/sessions;
- cas cache non writable.

Gate:

```bash
npm run typecheck
npm test
npm run check:artifacts
```

Gate P2 specifique fallback:

```bash
npm run test:artifacts
```

Si `test:artifacts` n'existe pas encore, P2 doit l'ajouter ou documenter le
mapping exact vers la commande equivalente.

### P3 - Integration verticale

- Stream A appelle le vrai `convertFile`;
- conversion single-file bout en bout;
- Mermaid rendu comme diagramme;
- overwrite preserve sans confirmation;
- erreurs de rendu avec chemin source;
- conversion browser-backed offline apres provisioning.

Gate:

```bash
npm run build
npm run test:browser
```

### P4 - Stabilisation release

- README final;
- packaging smoke;
- install user-scope temporaire;
- reinstall idempotent;
- preuve `FR-20` completee;
- packlist tarball inspectee;
- checklist release completee;
- traceabilite requirements/tests;
- `dist/` regenere depuis `src/`.

Gate:

```bash
npm run build
npm test
npm run check:artifacts
npm pack
```

## 8. Regles anti-conflit

- Stream A ne modifie pas `markdownRenderer.ts`, `browserLocator.ts`,
  `webDriverClient.ts`, `pdfRenderer.ts`, `artifactPolicy.ts`,
  `fallbackBrowserProvisioner.ts`, sauf accord explicite.
- Stream B ne modifie pas `cli.ts`, `paths.ts`, `overwrite.ts`, `pipeline.ts`,
  sauf accord explicite.
- `errors.ts`, contrats et policy artifacts sont communs uniquement pendant C0;
  ensuite toute modification doit etre annoncee et testee par les deux streams.
- README finalise par Stream A, notes navigateur/cache/fallback fournies par
  Stream B.
- Toute nouvelle dependance, driver, asset vendore, runtime provisionne ou action
  CI passe par `ARTIFACT_FRESHNESS_POLICY.md`.

## 9. Definition de fini v0.1.2

`0.1.2` est fini quand:

- P0, C0, P1, P2, P3 et P4 ont ete verts au moins une fois;
- `docs/architecture.md` est aligne avec ce plan;
- `docs/release-evidence/release-checklist-v0.1.2.md` est completee;
- `docs/release-evidence/fr-20-system-scope.md` est completee;
- les acceptance criteria US-01 a US-08 passent;
- `npm run typecheck`, `npm test`, `npm run check:artifacts`, `npm run build`
  passent;
- `npm run test:contracts`, `npm run test:artifacts` ou son equivalent, et
  `npm run test:browser` passent;
- au moins un run browser-backed produit un PDF reel;
- Mermaid est prouve comme diagramme;
- la conversion ne reference aucune URL externe exploitable dans le HTML;
- conversion offline/no-proxy depuis etat pre-provisionne;
- exit codes `0`, `1`, `2` respectes;
- PDFs existants preserves sauf confirmation ou `--force-overwrite`;
- tests dedies: collisions `--output-dir`, collision basename cross-directory,
  duplicates, dossiers vides, prompt EOF, images manquantes, output egal source,
  input illisible, output parent non writable, cache non writable;
- `FR-19`: install user-scope temporaire et `md2pdf --help`;
- `FR-21`: double install du meme tarball en exit `0`;
- `FR-20`: preuve system-scope versionnee;
- `NFR-02`: tests distinguent pre-provisioned conversion offline et first-run;
- `NFR-03`: matrice CI Linux/macOS/Windows verte;
- `NFR-05`: checksum SHA-256 verifie pour chaque artifact non-npm;
- `npm pack --json` prouve la presence de `dist/`, `assets/`, `README.md`,
  `ARTIFACT_FRESHNESS_POLICY.md`, `artifacts.json`;
- README et `--help` restent synchronises;
- chaque decision defensive a un test ou une documentation referencee;
- `dist/` n'a pas servi de source de verite.

## 10. Decisions defensives

| Decision | Comportement | Validation |
| --- | --- | --- |
| Dossier vide | exit `0`, summary `0 succeeded, 0 failed, 0 skipped` | Test Stream A |
| Extension `.MD` | comparaison case-insensitive | Test Stream A |
| Extension output explicite | extension fournie utilisee verbatim | Test + README |
| Parent output auto-cree | creation si possible | Test Stream A |
| Parent output non writable | erreur claire avec `outputPath` et `actionHint` | Test Stream A |
| Skip compte dans summary | skip visible mais exit `0` si aucune failure | Test Stream A |
| Entrees dupliquees | `UsageError` si output duplique | Test Stream A |
| Collision basename `--output-dir` | `a/report.md` + `b/report.md` bloque avant rendu | Test Stream A |
| Cache atomique | `.tmp` puis renommage apres verification | Test Stream B |
| Cache non writable | erreur artifact/browser explicite | Test Stream B |
| C0 rouge puis vert | preuve versionnee en checklist | Checklist release |
| `FR-20` manuel | preuve versionnee a chemin fixe | Checklist release |

