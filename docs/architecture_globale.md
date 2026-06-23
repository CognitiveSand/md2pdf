# md2pdf - Architecture globale du projet

## 1. Role du document

Ce document presente une vue d'ensemble de l'architecture actuelle de `md2pdf`
a partir du code, des exigences, des user stories, de l'architecture existante,
des preuves de release et des audits presents dans le depot.

Il complete `docs/architecture.md` sans le remplacer. En cas de divergence,
`docs/project_requirements.md` reste la source normative sur ce que le produit
doit faire, et `docs/architecture.md` reste la source normative sur les
mecanismes internes acceptes. Le present fichier sert de synthese lisible de
l'ensemble du systeme.

## 2. Intention produit

`md2pdf` est un outil CLI qui transforme des fichiers Markdown en PDF lisibles,
partageables et correctement pagines, avec le moins de configuration possible.
La promesse centrale est simple: un utilisateur donne un fichier `.md`, lance
une commande, et obtient un PDF exploitable sans installer de chaine TeX/LaTeX
ni envoyer son document vers un service externe.

Cette intention impose plusieurs contraintes architecturales fortes:

- l'experience principale passe par une commande `md2pdf`;
- la conversion doit rester locale pour le contenu utilisateur;
- le rendu doit supporter le Markdown courant, les images relatives, le code
  colore et les diagrammes Mermaid;
- l'installation doit fonctionner en scope utilisateur, sans privileges
  administrateur dans le cas courant;
- les artefacts tiers, y compris les drivers et navigateurs de fallback, sont
  soumis a la politique de fraicheur du depot.

## 3. Vue d'ensemble du flux

Le systeme suit un pipeline volontairement separe en couches:

```text
Arguments CLI
  -> parsing et validation
  -> resolution des entrees Markdown et chemins de sortie
  -> politique d'ecrasement
  -> conversion document par document
  -> rendu Markdown en HTML local autonome
  -> lancement d'un WebDriver local
  -> ouverture du HTML file:
  -> attente du rendu Mermaid
  -> commande WebDriver Print
  -> ecriture atomique du PDF
  -> resume stdout/stderr et code de sortie
```

Le choix central est de produire le PDF via un vrai navigateur local pilote par
WebDriver. Le Markdown est d'abord transforme en HTML autonome, puis ce HTML est
imprime en PDF par le moteur natif du navigateur. Ce choix permet de rendre
Mermaid, les styles CSS, les tables, les images et la pagination avec un moteur
de rendu HTML complet, tout en evitant une dependance TeX/LaTeX.

## 4. Frontiere conversion / provisioning

L'architecture distingue deux phases qui ne portent pas les memes garanties:

- **Provisioning**: le programme peut selectionner ou telecharger des artefacts
  techniques approuves, comme un driver WebDriver ou un navigateur
  Chromium-for-Testing de fallback. Cette phase est gouvernee par
  `ARTIFACT_FRESHNESS_POLICY.md` et `artifacts.json`.
- **Conversion**: le Markdown utilisateur est lu, transforme, charge localement
  via `file:` et imprime en PDF. Cette phase ne doit pas transmettre le
  document ni le PDF a un service externe.

Cette separation est importante: la politique reseau de la conversion protege
le contenu utilisateur, tandis que la politique artefact protege la chaine
d'approvisionnement technique.

## 5. Modules applicatifs

### `src/cli.ts`

`cli.ts` est la frontiere utilisateur. Il parse les arguments avec
`node:util.parseArgs`, lit `MD2PDF_BROWSER`, choisit le mode interactif selon
`stdin.isTTY` et `stdout.isTTY`, instancie le pipeline, ecrit les erreurs et le
resume, puis retourne le code de sortie.

Ses responsabilites sont volontairement limitees:

- afficher `--help`;
- rejeter les usages invalides simples;
- transmettre les options au pipeline;
- convertir les erreurs typees en stderr structure;
- retourner `0`, `1` ou `2` selon le resultat.

Le CLI ne rend pas lui-meme les documents et ne contient pas la logique de
resolution de chemins, de WebDriver ou de politique artefact.

### `src/pipeline.ts`

`ConversionPipeline` orchestre les conversions d'une invocation complete. Il
resout le plan de conversion via `paths.ts`, applique la politique
d'ecrasement, appelle le convertisseur document par document, puis retourne une
liste de `ConversionOutcome`.

Il porte la logique de batch:

- les entrees manquantes deviennent des echecs reportes;
- les conversions valides continuent apres un echec par document;
- les sorties preservees deviennent des outcomes `skipped`;
- les exceptions inconnues sont encapsulees en `Md2PdfError`.

Cette couche est la frontiere entre le monde "commande utilisateur" et le monde
"conversion d'un document unique".

### `src/paths.ts`

`paths.ts` transforme les entrees utilisateur en `ConversionJob`.

Il gere:

- les fichiers `.md`, avec extension insensible a la casse;
- les dossiers, convertis seulement sur les fichiers Markdown de premier
  niveau;
- le chemin de sortie par defaut, place a cote du source;
- `--output` pour une conversion unique;
- `--output-dir` pour une ou plusieurs conversions;
- la creation et la verification des dossiers parents de sortie;
- le rejet des collisions de sortie;
- le rejet d'une sortie identique a l'entree.

Cette couche evite que le convertisseur runtime ait a connaitre les details de
batch, d'options CLI ou d'expansion de dossier.

### `src/overwrite.ts`

`overwrite.ts` implemente la politique de preservation des PDFs existants. Sa
decision depend de trois informations: existence de la sortie, presence de
`--force-overwrite`, et mode interactif ou non.

La regle est:

- si la sortie n'existe pas, convertir;
- si `--force-overwrite` est fourni, remplacer;
- si la sortie existe en mode interactif, demander confirmation;
- si la sortie existe en mode non interactif, la preserver et signaler le skip.

Avant de remplacer un fichier existant, le module verifie qu'il s'agit d'un
fichier regulier accessible en ecriture.

### `src/converter.ts`

`DocumentConverter` orchestre une conversion unique. Il est responsable du
chemin nominal:

1. resoudre les chemins absolus source et sortie;
2. verifier que le source est accessible;
3. localiser un navigateur et un driver compatibles;
4. lire le Markdown;
5. produire un HTML temporaire autonome;
6. lancer l'impression WebDriver;
7. ecrire le PDF de maniere atomique.

L'ecriture atomique passe par un fichier temporaire dans le dossier de sortie,
puis un `rename` vers le fichier final. En cas d'echec, le temporaire est
supprime autant que possible. Le convertisseur evite ainsi de laisser un PDF
partiel a l'emplacement cible.

Le convertisseur accepte des dependances injectables pour les tests: systeme de
fichiers, factory de navigateur, fonction d'impression PDF, repertoire
temporaire et factory de session WebDriver.

### `src/markdownRenderer.ts`

`markdownRenderer.ts` transforme le Markdown en HTML local autonome.

Il utilise:

- `markdown-it` en mode CommonMark;
- `markdown-it-footnote`;
- `markdown-it-task-lists`;
- `highlight.js` pour le code non Mermaid;
- le bundle `mermaid/dist/mermaid.min.js`, inline seulement si le document
  contient un bloc Mermaid.

Le HTML assemble contient les CSS locaux `assets/default.css` et
`assets/highlight.css`, une Content Security Policy restrictive, et aucun lien
vers une ressource HTTP externe. Les images relatives sont lues localement et
integrees sous forme de data URI. Les images absolues, les URL distantes et les
SVG contenant des URL externes sont rejetees.

Les blocs fenced `mermaid` ne sont pas rendus dans Node. Ils sont emis comme
conteneurs HTML et traites ensuite dans le navigateur, ce qui conserve la
fidelite du moteur Mermaid reel.

Le module gere aussi la creation et le nettoyage de repertoires HTML temporaires
marques par un fichier sentinelle, afin d'eviter de supprimer un chemin non
gere.

### `src/webDriverSession.ts`

`webDriverSession.ts` demarre un driver WebDriver local. Il choisit un port
local libre, lance le binaire du driver, attend que `/status` reponde, puis
retourne une session composee d'un transport HTTP local et d'un handle de
processus.

Le port est choisi par bind local temporaire puis fermeture avant le lancement
du driver. Cette fenetre de rebind est une limite TOCTOU locale connue; le
driver reste contraint a `127.0.0.1` et le transport client refuse les endpoints
non loopback litteraux.

Le module gere aussi l'arret du driver. Si le processus ne s'arrete pas
normalement dans le delai prevu, il peut etre tue plus fermement. Cette logique
protege les conversions qui echouent ou expirent.

### `src/webDriverClient.ts`

`webDriverClient.ts` parle le protocole W3C WebDriver.

Il cree une session navigateur avec des capacites adaptees a Firefox ou a la
famille Chromium, force l'utilisation d'un endpoint WebDriver HTTP local,
charge le fichier HTML via une URL `file:`, attend que Mermaid signale son etat
`done`, puis appelle la commande WebDriver `print`.

Le module verifie plusieurs invariants:

- l'URL HTML doit etre locale et de schema `file:`;
- l'endpoint WebDriver doit etre `127.0.0.1` ou `::1`;
- les chemins de requete WebDriver ne doivent pas s'echapper de l'origin local;
- les donnees retournees par `print` doivent etre un PDF valide commencant par
  `%PDF-`.

Les navigateurs sont lances en mode headless avec des options visant a reduire
les acces reseau et le bruit de premiere execution. Les profils temporaires
Chromium et Firefox sont crees par conversion puis nettoyes. Sur Linux, un
Firefox snap utilise une racine de profil sous `$HOME`, comme son HTML
temporaire, afin de rester lisible depuis le confinement snap.

### `src/browserLocator.ts`

`BrowserLocator` trouve un navigateur supporte et un driver WebDriver eligible.
Il gere deux chemins:

- `MD2PDF_BROWSER`, qui epingle explicitement un binaire navigateur;
- la detection automatique de navigateurs installes sur macOS, Windows, Linux
  et dans le `PATH`.

Les navigateurs supportes sont Chrome, Chromium, Edge, Brave, Firefox et
Vivaldi. Pour Firefox, le driver attendu est `geckodriver`; pour les navigateurs
Chromium, le driver attendu est `chromedriver`.

Le locator inspecte le navigateur avec `--version`, verifie qu'il est lancable,
puis demande au resolver de driver un artefact compatible. Pour Chromium, la
compatibilite est contrainte par la version majeure quand elle est connue. Si
aucun navigateur installe n'est utilisable, le locator peut demander un
navigateur de fallback a `FallbackBrowserResolver`.

### `src/artifactPolicy.ts`

`ArtifactPolicy` encode la regle runtime de selection des artefacts: choisir la
version eligible la plus recente apres exactement sept jours de quarantaine.

Le module rejette:

- les versions flottantes comme `latest`, `stable`, `beta`, `canary`, `dev` ou
  `nightly`;
- les URLs non HTTPS, mutables, avec query string ou fragment;
- les releases sans checksum SHA-256;
- les tailles invalides;
- les releases sans provenance;
- les selections dont le delai de quarantaine n'est pas exactement de sept
  jours.

Il applique aussi les contraintes de plateforme et de compatibilite de version.

### `src/releaseCatalog.ts`

`releaseCatalog.ts` lit `artifacts.json` et expose les releases d'artefacts
declarees. Il transforme le manifest JSON en objets `ArtifactRelease` valides
pour les couches runtime.

Il existe aussi un `InMemoryReleaseCatalog`, utilise par les tests pour fournir
des catalogues controles.

### `src/fallbackBrowserProvisioner.ts`

`fallbackBrowserProvisioner.ts` provisionne un navigateur Chromium-for-Testing
et son driver uniquement comme fallback. Il selectionne les releases via
`ArtifactPolicy`, telecharge les archives declarees, verifie les checksums,
inspecte les ZIP avant extraction, extrait dans un cache utilisateur, rend les
binaires executables et ecrit des metadonnees de cache.

Le cache est versionne par release et nettoye pour ne conserver que la version
selectionnee. Les caches partiels, corrompus ou ne correspondant plus aux
metadonnees sont reprovisionnes. Les chemins d'extraction sont controles pour
ne pas sortir du repertoire de cache, et les archives trop grandes ou aux
metadonnees ZIP non supportees sont rejetees.

### `src/errors.ts`

`errors.ts` definit la hierarchie d'erreurs stable du projet:

- `UsageError`;
- `InputNotFoundError`;
- `ConversionError`;
- `RenderError`;
- `BrowserNotFoundError`;
- `ArtifactFreshnessError`.

Toutes heritent de `Md2PdfError` et portent un contexte structure:
`kind`, message, source, sortie, artefact, hint et cause. Le CLI formate ce
contexte en stderr. Cette decision garde les erreurs lisibles pour l'utilisateur
et testables pour la suite de regression.

### `src/contracts.ts`

`contracts.ts` contient les types publics partages:

- `ConvertOptions`;
- `ConversionJob`;
- `ConversionStatus`;
- `ConversionOutcome`.

Ces types constituent la frontiere commune entre CLI, pipeline, convertisseur
et tests contractuels.

## 6. Assets et rendu visuel

Les assets locaux sont places sous `assets/`:

- `default.css` definit la presentation Markdown et les regles d'impression;
- `highlight.css` fournit le theme de coloration syntaxique.

Ces fichiers sont declares dans `artifacts.json` car ils sont distribues avec
le package et participent au rendu. Le CSS est inline dans le HTML genere afin
de garder la conversion locale et reproductible depuis le package installe.

## 7. Distribution et packaging

Le projet est un package npm TypeScript ESM:

- `package.json` declare le binaire `md2pdf` vers `dist/cli.js`;
- `tsconfig.json` compile `src/` vers `dist/`;
- `npm run build` nettoie `dist/` puis lance `tsc`;
- `npm run check:package` verifie la packlist, installe le tarball dans un
  prefix temporaire, verifie le binaire installe et rejoue une reinstall;
- le tarball publie inclut `dist/`, `assets/`, `README.md`,
  `ARTIFACT_FRESHNESS_POLICY.md`, `artifacts.json` et `package.json`.

Sur Windows, le README documente explicitement le cas ou PowerShell resout le
shim `.ps1` avant le `.cmd`. Le script de packaging verifie le shim `.cmd`.

## 8. Politique de fraicheur des artefacts

`ARTIFACT_FRESHNESS_POLICY.md` s'applique a tout artefact ajoute, verrouille,
embarque, reference, distribue ou provisionne. Le principe est strict:
selectionner la version eligible la plus recente apres sept jours complets de
quarantaine.

La politique couvre notamment:

- les dependances npm et transitives;
- les fichiers lock;
- les assets distribues;
- les drivers WebDriver;
- le navigateur de fallback;
- les scripts et chemins de provisioning runtime.

`scripts/checkArtifactFreshness.mjs` implemente le gate local. Il verifie les
fichiers de politique, `renovate.json`, `artifacts.json`, les artefacts declares
et la fraicheur du lockfile npm regenere avec un cutoff `--before`. En mode
pre-commit, il limite le travail aux chemins stages pertinents, mais garde les
fichiers d'enforcement dans le perimetre.

Les waivers de quarantaine existent dans la politique, mais ils doivent pointer
vers un audit versionne sous `security/audits/<package>@<version>.md`, porter
une approbation, et correspondre exactement a la version verrouillee.

## 9. Tests et preuves

La strategie de validation est composee de plusieurs couches:

- tests unitaires pour les modules purs ou injectables;
- tests contractuels pour les types et erreurs stables;
- tests d'integration du pipeline et du convertisseur;
- tests browser-backed pour le rendu PDF, Mermaid, HTML local et WebDriver;
- tests de politique artefact et de provisioning;
- smoke packaging via `npm run check:package`;
- evidence de release versionnee sous `docs/release-evidence/`.

Les tests sont tags avec des IDs d'exigences (`@req FR-...`, `@req NFR-...`)
afin de maintenir la trace entre exigences, user stories, architecture et
verification.

La checklist de release indique que les gates locaux de v0.1.2 sont verts dans
les preuves locales recentes, mais que la release globale reste bloquee par les
preuves CI/matrice et FR-20 system-scope.

## 10. Invariants transverses

L'architecture repose sur plusieurs invariants:

- le CLI ne fait pas de rendu;
- le pipeline ne connait pas WebDriver;
- le convertisseur ne resout pas les batchs;
- le rendu Markdown produit un HTML autonome;
- les ressources externes dans le contenu rendu sont bloquees ou inlinees;
- WebDriver n'est accessible que via un endpoint HTTP local;
- les artefacts runtime doivent passer par `ReleaseCatalog` et
  `ArtifactPolicy`;
- un PDF final n'est ecrit qu'apres un rendu complet;
- les erreurs doivent rester typees et porter du contexte;
- les skips d'ecrasement sont des outcomes normaux, pas des echecs;
- les sorties multiples ne doivent pas pointer vers le meme chemin final.

Ces invariants expliquent la decoupe en modules. Chacun protege une frontiere:
utilisateur, planification, ecriture, rendu, navigateur, supply chain ou
reporting.

## 11. Risques et limites actuelles

Les risques principaux restent ceux identifies par la documentation et les
audits:

- la disponibilite navigateur/driver depend de la machine hote et des artefacts
  declares;
- la sortie PDF peut varier entre navigateurs et versions;
- la garantie local-only repose sur une structure de rendu locale et des options
  navigateur, pas sur une interception reseau complete;
- le fallback Chromium-for-Testing est volontairement lourd et strictement
  gouverne par la politique artefact;
- la release globale v0.1.2 demande encore des preuves CI/matrice et FR-20
  completes;
- le graphe `graphify-out` present dans le depot a ete genere sur un commit
  anterieur et doit etre considere comme une aide de navigation, pas comme une
  source plus fraiche que le code courant.

## 12. Synthese

L'architecture de `md2pdf` est celle d'un outil CLI local avec une separation
forte entre orchestration utilisateur, rendu document, controle navigateur et
politique supply chain. Le projet evite une chaine TeX/LaTeX en s'appuyant sur
le moteur d'impression PDF d'un vrai navigateur local, tout en encapsulant les
risques de drivers et de fallback dans une politique d'artefacts stricte.

Le coeur du design est donc double: rendre le cas courant simple pour
l'utilisateur, et rendre les frontieres techniques explicites pour que la
conversion reste locale, testable et auditable.
