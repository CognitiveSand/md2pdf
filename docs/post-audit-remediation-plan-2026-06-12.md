# Plan d'implementation post-audit - remise en conformite v0.1.2

Date: 2026-06-12

Sources:

- `audit/2026-06-12-global-project-progress-structure-problems-audit.md`
- `audit/2026-06-12-global-project-progress-structure-problems-summary.md`
- `docs/plan_stream_a.md`
- `docs/plan_stream_b.md`
- `docs/implementation_plan_v0.1.2.md`
- `ARTIFACT_FRESHNESS_POLICY.md`

Objectif: ramener le projet md2pdf d'un etat `NO-GO v0.1.2` vers une release
candidate verifiable, sans masquer les problemes releves par les audits.

Ce document est un plan. Il ne constitue pas une implementation.

## Regles de pilotage

1. Ne pas utiliser `dist/` comme source de verite.
2. Ne pas declarer une phase terminee si son gate local echoue.
3. Ne pas transformer une preuve simulee en preuve release sans le marquer.
4. Ne pas ajouter, verrouiller, modifier ou provisionner d'artifact sans passer
   par `ARTIFACT_FRESHNESS_POLICY.md`.
5. Ne pas melanger deux architectures de rendu: le plan doit converger vers un
   seul chemin runtime.
6. Ne pas corriger les preuves release avant d'avoir enregistre leur etat reel:
   les anciens `pass` obsoletes doivent etre traites comme du drift.
7. Chaque phase doit produire une preuve executable ou une preuve documentaire
   explicite.

## Priorite globale

Ordre de resolution recommande:

1. Retablir la compilabilite et les contrats C0.
2. Choisir et stabiliser un seul chemin de rendu.
3. Retablir la politique artifacts et le catalogue runtime.
4. Reparer les tests pour qu'ils prouvent les exigences au bon niveau.
5. Regenerer `dist/` et le package depuis `src/`.
6. Rejouer et corriger les preuves release.

Tant que les points 1 a 3 ne sont pas termines, la v0.1.2 globale reste
`NO-GO`.

## Phase 0 - Remettre l'etat de preuve au clair

But: eviter de construire sur une checklist qui dit `pass` alors que les gates
echouent.

### Actions

1. Relire la checklist release v0.1.2 et identifier toutes les lignes marquees
   `pass` qui ne correspondent plus a l'etat courant.
2. Marquer explicitement les preuves obsoletes comme `blocked`, `fail` ou
   `stale`, selon le vocabulaire deja accepte par `docs/release-evidence/`.
3. Ajouter une section de reconciliation indiquant que les commandes suivantes
   sont rouges dans l'etat audite:
   - `npm.cmd run typecheck`
   - `npm.cmd test`
   - `npm.cmd run test:contracts`
   - `npm.cmd run test:browser`
   - `npm.cmd run check:artifacts`
4. Distinguer clairement:
   - preuves Stream A strict anciennes;
   - preuves globales v0.1.2 encore bloquees;
   - preuves simulees;
   - preuves release reelles.
5. Verifier que FR-20 reste documente comme simulation tant qu'aucune preuve
   system-scope multi-compte reelle n'existe.

### Sortie attendue

- La documentation release ne pretend plus que le code courant est vert.
- Les anciennes preuves restent conservees, mais leur statut temporel est clair.

### Gate

- Relecture documentaire.
- Aucune commande technique ne doit etre revendiquee verte dans cette phase sans
  execution nouvelle.

## Phase 1 - Retablir la compilabilite minimale

But: obtenir un socle TypeScript importable avant toute correction fonctionnelle.

### Actions

1. Corriger les references compile-time cassees dans `src/browserLocator.ts`:
   - import manquant de `isAbsolute`;
   - fonctions appelees mais absentes ou mal nommees;
   - incoherence entre `pathExecutablesFromEnv` et `pathExecutablesForEnv`;
   - resolution des racines Windows.
2. Corriger le graphe d'import de `src/converter.ts`:
   - traiter l'absence de `browserTypes.js`;
   - traiter l'absence de `webDriverSession.js`;
   - verifier que les types partages viennent d'un module existant.
3. Stabiliser `src/contracts.ts`:
   - eviter que l'import du contrat charge une implementation runtime cassee;
   - conserver les types publics attendus;
   - clarifier l'export public de `convertFile`.
4. Reconciler le contrat d'erreur C0:
   - verifier si `not-implemented` et `NotImplementedError` restent requis par
     le plan v0.1.2;
   - aligner le code, les tests et la documentation sur une seule decision.
5. Ne pas modifier le comportement fonctionnel tant que le code ne compile pas.

### Sortie attendue

- Le projet redevient importable.
- Les contrats publics ne dependent pas d'un module runtime incomplet.

### Gate

```bash
npm.cmd run typecheck
npm.cmd run test:contracts
```

## Phase 2 - Choisir un seul chemin de rendu

But: supprimer l'ambiguite entre l'ancien rendu direct navigateur et le chemin
WebDriver cible.

### Decision a prendre

Le plan v0.1.2 et l'architecture decrivent le chemin cible suivant:

Markdown -> HTML local -> WebDriver Print -> PDF

Le plan doit donc traiter l'ancien chemin `pdfRenderer.ts` comme un probleme de
coexistence.

### Actions

1. Inventorier tous les appels actuels vers:
   - `src/pdfRenderer.ts`;
   - `src/webDriverClient.ts`;
   - `src/converter.ts`;
   - `dist/pdfRenderer.js`.
2. Classer `pdfRenderer.ts`:
   - chemin obsolete a retirer;
   - ou helper temporaire strictement isole;
   - ou adapter explicitement au modele WebDriver.
3. Mettre a jour les tests qui verrouillent encore l'ancien protocole
   `--print-to-pdf`.
4. Faire converger le convertisseur vers un seul contrat:
   - lecture Markdown;
   - HTML temporaire;
   - localisation/provisionnement navigateur/driver;
   - session WebDriver;
   - Print command;
   - ecriture atomique du PDF.
5. Verifier que `dist/` sera regenere uniquement apres convergence du source.

### Sortie attendue

- Une seule architecture runtime est active.
- Les tests ne prouvent plus un ancien chemin incompatible.
- `dist/` n'est plus une trace stale d'une ancienne architecture.

### Gate

```bash
npm.cmd run typecheck
npm.cmd test
```

## Phase 3 - Retablir BrowserLocator, WebDriver et fallback

But: rendre le chemin Stream B P2/P3 executable au lieu de seulement partiel.

### Actions

1. Finaliser `BrowserLocator`:
   - candidats Windows/macOS/Linux;
   - support `MD2PDF_BROWSER`;
   - erreurs `env-browser-not-found`, `env-browser-not-launchable`,
     `env-browser-no-eligible-driver`;
   - resolution Firefox snap;
   - absence de references non definies.
2. Finaliser le demarrage de session WebDriver:
   - module session dedie;
   - lifecycle driver process;
   - fermeture session et process en `finally`;
   - timeouts propres.
3. Verifier que `webDriverClient.ts` reste limite au protocole WebDriver:
   - transport local uniquement;
   - navigation vers `file:`;
   - attente Mermaid;
   - Print command;
   - PDF bytes valides.
4. Integrer le fallback browser uniquement comme dernier recours:
   - apres echec installed browser;
   - jamais comme chemin principal implicite;
   - toujours derriere `ArtifactPolicy` et `ReleaseCatalog`.

### Sortie attendue

- Le chemin browser/WebDriver demarre et echoue avec des erreurs typees quand
  les artifacts reels ne sont pas declares.
- Les tests browser locator et WebDriver ne cassent plus sur des references
  absentes.

### Gate

```bash
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:artifacts
```

## Phase 4 - Remettre la politique artifacts en conformite

But: refaire passer le gate obligatoire `check:artifacts` et rendre le runtime
coherent avec la politique.

### Actions

1. Reconciler `assets/default.css` avec `artifacts.json`:
   - confirmer si le fichier courant est la version voulue;
   - confirmer sa provenance;
   - mettre le manifeste en coherence seulement apres validation de la version.
2. Declarer les artifacts runtime reels necessaires au chemin navigateur:
   - `chromedriver`;
   - `geckodriver`;
   - eventuel Chromium-for-Testing fallback.
3. Pour chaque artifact non-npm, fournir:
   - version exacte;
   - date de publication;
   - URL immutable;
   - SHA-256;
   - taille;
   - provenance;
   - plateforme si applicable;
   - compatibilite navigateur si applicable.
4. Garantir la regle `newest eligible`:
   - verifier que la version retenue est bien la plus recente eligible;
   - documenter la source de comparaison;
   - refuser tout `latest` ou tag flottant.
5. Aligner runtime et checker repo:
   - meme politique de fraicheur;
   - meme verification d'integrite;
   - meme traitement des waivers ou statut explicitement non supporte.
6. Ajouter des preuves pour les chemins critiques du checker:
   - checksum faux;
   - asset non declare;
   - waiver incomplete;
   - waiver avec rapport manquant;
   - lockfile divergent;
   - pre-commit path filter.

### Sortie attendue

- Le manifeste ne bloque plus `check:artifacts`.
- Les artifacts navigateur ne sont plus seulement des classes prevues.
- Le runtime ne peut pas utiliser un driver local sans integrite verifiee.

### Gate

```bash
npm.cmd run check:artifacts
npm.cmd run test:artifacts
npm.cmd run typecheck
```

## Phase 5 - Clarifier la frontiere provisioning / conversion local-only

But: rendre NFR-02 testable et non ambigu.

### Actions

1. Definir l'ordre normatif exact:
   - provisioning autorise avant conversion;
   - conversion strictement local-only;
   - provisioning ne lit pas le Markdown;
   - conversion pre-provisionnee n'ouvre pas de connexion sortante.
2. Ajuster le convertisseur pour que cet ordre soit observable.
3. Ajouter des tests separes:
   - provisioning ne recoit jamais le contenu Markdown;
   - conversion depuis etat pre-provisionne ne provisionne pas;
   - HTML assemble ne contient pas d'URL externe exploitable;
   - WebDriver local refuse endpoints non locaux;
   - browser lance avec flags offline/no-proxy quand supportes.
4. Marquer les limites qui ne sont pas techniquement interceptables comme
   risques documentes, pas comme preuves completes.

### Sortie attendue

- NFR-02 n'est plus prouve par simple intention structurelle.
- Le test distingue clairement first-run provisioning et conversion offline.

### Gate

```bash
npm.cmd test
npm.cmd run test:browser
```

## Phase 6 - Renforcer les preuves PDF et Mermaid

But: prouver FR-24 et les exigences PDF avec des assertions moins fragiles.

### Actions

1. Revoir le smoke `real-browser-mermaid`:
   - ne plus se limiter a `%PDF-` et a la taille;
   - prouver absence du Mermaid brut;
   - prouver presence d'un objet visuel raster ou vectoriel;
   - documenter le type attendu selon le navigateur de reference.
2. Remplacer les verifications trop fragiles sur octets PDF bruts par une
   strategie de preuve plus stable.
3. Couvrir les scenarios suivants:
   - Mermaid rendu comme diagramme;
   - tables, task lists, footnotes;
   - highlighting;
   - image relative embarquee;
   - heading page-break integrity;
   - erreur de rendu sans PDF partiel.
4. Separer clairement:
   - tests rapides HTML sans navigateur;
   - tests integration avec fake renderer;
   - tests browser reels release-grade.
5. Interdire qu'un skip local soit compte comme preuve release.

### Sortie attendue

- FR-24 a une preuve browser-backed exploitable.
- Les tests PDF ne donnent plus de faux sentiment de couverture.

### Gate

```bash
npm.cmd run test:browser
npm.cmd run test:real-browser
```

## Phase 7 - Remettre Stream A et les tests CLI en coherence

But: s'assurer que la surface utilisateur reste valide apres stabilisation du
runtime.

### Actions

1. Rejouer les tests CLI, paths, overwrite et pipeline.
2. Verifier les comportements Stream A:
   - help complet;
   - exit codes `0`, `1`, `2`;
   - batch continue-on-error;
   - summary stdout;
   - skip non-interactif;
   - prompt EOF;
   - collisions output;
   - duplicate entries;
   - dossier vide;
   - `--output-dir`;
   - output parent non-writable.
3. Supprimer les tests qui valident uniquement un ancien chemin runtime.
4. Revalider que Stream A appelle le vrai `convertFile` au bon niveau.

### Sortie attendue

- Stream A est de nouveau vert avec le runtime cible.
- Les tests Stream A ne masquent plus une integration Stream B cassee.

### Gate

```bash
npm.cmd test
npm.cmd run typecheck
```

## Phase 8 - Packaging, dist et installation

But: regenerer un package qui correspond au source courant.

### Actions

1. Nettoyer la relation `src/` -> `dist/`:
   - `dist/` doit venir d'un build courant;
   - aucune decision ne doit etre derivee de l'ancien `dist/`.
2. Revoir les scripts package:
   - `prepack` ne doit pas permettre un package alors que les tests essentiels
     sont rouges;
   - `test:all` ne doit pas promettre plus que ce qu'il execute.
3. Rejouer packaging:
   - build;
   - tests;
   - artifact gate;
   - packlist;
   - install user-scope temporaire;
   - reinstall idempotent.
4. Verifier que `bin.md2pdf` pointe bien vers le build courant.
5. Documenter toute limitation Windows PowerShell vs `.cmd` shim si elle reste
   observable.

### Sortie attendue

- Le tarball provient du source courant.
- L'installation user-scope et la reinstall idempotente sont prouvees a nouveau.

### Gate

```bash
npm.cmd run build
npm.cmd test
npm.cmd run check:artifacts
npm.cmd pack --json
```

## Phase 9 - FR-20 et preuves release globales

But: fermer les preuves qui ne peuvent pas etre remplacees par des tests
unitaires.

### Actions

1. Refaire la preuve FR-20 en decidant explicitement entre:
   - vraie installation system-scope multi-compte;
   - simulation acceptee mais marquee comme non-equivalente a une preuve finale.
2. Capturer:
   - OS exact;
   - Node/npm;
   - commande d'installation;
   - compte source;
   - compte secondaire ou justification de simulation;
   - chemin du binaire;
   - sortie `md2pdf --help`;
   - resultat attendu;
   - resultat observe.
3. Mettre a jour la checklist pour ne plus marquer `pass` sans preuve reelle.
4. Ajouter ou rattacher la preuve CI matrix:
   - Linux;
   - macOS;
   - Windows;
   - Node.js 20+;
   - browser family attendue.

### Sortie attendue

- La release evidence distingue clairement demonstration locale, simulation et
  preuve release.
- FR-20 n'est plus surdeclaree.

### Gate

- Checklist release sans `pending`, `fail`, `blocked` non expliques.
- CI matrix referencee ou explicitement bloquante.

## Phase 10 - Validation finale v0.1.2

But: fermer la definition de fini globale.

### Gates finaux

```bash
npm.cmd run typecheck
npm.cmd run test:contracts
npm.cmd test
npm.cmd run test:artifacts
npm.cmd run check:artifacts
npm.cmd run build
npm.cmd run test:browser
npm.cmd run test:real-browser
npm.cmd pack --json
```

### Criteres de sortie

La v0.1.2 ne peut repasser en `GO` que si:

1. Tous les gates finaux sont verts.
2. `dist/` est regenere depuis `src/`.
3. Le tarball est regenere apres les gates verts.
4. Mermaid est prouve comme diagramme.
5. Le rendu browser-backed produit un PDF reel.
6. NFR-02 est prouve depuis un etat pre-provisionne.
7. La politique artifacts passe.
8. Les drivers/fallback reels sont soit declares et utilisables, soit l'absence
   d'artifact eligible produit l'erreur attendue et documentee.
9. FR-19, FR-20 et FR-21 ont des preuves a jour.
10. La checklist release ne contient plus de `pass` stale.

## Decoupage recommande en commits

1. Documentation evidence reset.
2. Build/typecheck baseline.
3. Contract boundary cleanup.
4. Rendering architecture convergence.
5. BrowserLocator/WebDriver session stabilization.
6. Artifact manifest and policy alignment.
7. NFR-02 tests and local-only proof.
8. PDF/Mermaid proof strengthening.
9. Stream A regression cleanup.
10. Packaging/dist regeneration.
11. Release evidence refresh.

Chaque commit devrait garder un perimetre etroit et annoncer le gate rejoue.

## Matrice problemes vers phases

| Probleme audite | Phase principale |
| --- | --- |
| TypeScript ne compile pas | Phase 1 |
| Contrats C0 non importables | Phase 1 |
| Deux architectures de rendu | Phase 2 |
| BrowserLocator casse | Phase 3 |
| Modules WebDriver manquants | Phase 3 |
| Artifact gate rouge | Phase 4 |
| Drivers/fallback non declares | Phase 4 |
| Runtime integrity incomplete | Phase 4 |
| Waiver repo/runtime divergente | Phase 4 |
| NFR-02 ambigu | Phase 5 |
| Mermaid/PDF preuve faible | Phase 6 |
| Tests Stream A non courants | Phase 7 |
| `dist/` stale | Phase 8 |
| `prepack` et `test:all` incomplets | Phase 8 |
| FR-20 simulation marquee pass | Phase 9 |
| CI/browser matrix absente | Phase 9 |
| Checklist release stale | Phases 0, 9 et 10 |

## Statut attendu apres execution

Le statut cible n'est pas seulement "tests verts". Le statut cible est:

`GO v0.1.2` avec code source compilable, runtime coherent, artifacts conformes,
preuves release a jour, package regenere et exigences browser/Mermaid/local-only
verifiees.
