# Audit du plan d'implementation v0.1.1

Date: 2026-06-04

Sources auditees:

- `docs/implementation_plan_v0.1.1.md`
- `docs/project_requirements.md`
- `docs/user_stories.md`
- `docs/architecture.md`
- `ARTIFACT_FRESHNESS_POLICY.md`
- `package.json`

## Acceptance Audit

### Verdict

Not ready

Le plan est exploitable comme direction de travail, mais il n'est pas encore pret
comme plan d'execution verrouille. Il oublie des exigences MVP, laisse plusieurs
criteres de validation non observables, et accepte trop de zones rouges dans les
gates d'integration.

### Blocking Ambiguities

- Le plan declare que `0.1.1` doit couvrir le MVP fonctionnel, mais sa portee ne
  couvre pas explicitement `FR-20` et `FR-21`, alors que les requirements les
  marquent `MVP`. La Definition of Done parle seulement de `US-01` a `US-08`,
  donc `US-07` est incluse, mais les livrables Stream A ne valident que le
  packaging npm et pas l'installation system-scope ni l'idempotence d'upgrade.

- Le contrat commun minimal expose seulement `ConvertOptions` et `convertFile`,
  mais ne definit pas les champs observables des erreurs. Les stories exigent des
  chemins fautifs sur `stderr`, l'architecture parle d'erreurs portant leur
  contexte, et le plan liste des classes sans contrat de donnees. Deux streams
  peuvent donc "respecter" le contrat tout en produisant des erreurs impossibles
  a formatter correctement par le CLI.

- `BrowserNotFoundError`, provisioning driver, Chromium-for-Testing fallback et
  politique de fraicheur sont mentionnes, mais le plan ne dit pas si le fallback
  navigateur est in scope, optionnel, automatique, ou seulement documente. Cette
  ambiguite touche directement `NFR-01`, `FR-19` et `NFR-05`.

- La regle "local-only" est formulee comme absence d'URL `http:` ou `https:`
  dans le HTML assemble. C'est necessaire mais insuffisant comme critere
  d'acceptation de `NFR-02`, qui exige qu'aucune connexion sortante ne soit
  ouverte pendant la conversion.

### Missing Edge Cases

- Combinaison `--output` avec plusieurs entrees, avec une entree dossier, ou
  avec une entree fichier qui se developpe indirectement en plusieurs travaux.

- Collision de noms dans `--output-dir`, par exemple deux sources de dossiers
  differents ayant le meme basename `README.md`. Le requirement `FR-23` dit
  d'utiliser le basename, mais le plan ne prevoit ni erreur, ni overwrite
  policy, ni strategie deterministe de conflit.

- Dossier d'entree sans fichier `.md` top-level. Le plan ne precise pas si c'est
  un succes avec `0` conversions, une erreur d'usage, ou un echec de batch.

- Entrees dupliquees dans une meme invocation. Sans regle, le meme output peut
  etre converti deux fois et declencher un prompt ou un overwrite inattendu.

- Output path egal au source path, extension non `.pdf`, parent inexistant,
  dossier non writable, ou output resolu hors du repertoire attendu.

- Images relatives manquantes ou illisibles. Les exigences disent que les images
  existent en hypothese, mais `US-02` renvoie les references non resolues vers
  `US-06`; le plan Stream B ne decrit pas la classification d'erreur attendue.

- Fichiers `.md` en majuscules ou mixtes (`.MD`, `.Md`) dans les dossiers. Le
  plan ne fixe pas la sensibilite a la casse alors que la portabilite Windows,
  macOS et Linux est en jeu.

- Prompt interactif: reponses acceptees, comportement EOF, interruption clavier,
  localisation de la question, et garantie que le default No est applique meme
  en entree vide.

- Nettoyage des fichiers HTML temporaires et des sessions WebDriver en cas
  d'erreur ou de timeout.

### Untestable Criteria

- Original: "Mermaid visible dans le PDF"
  Issue: "visible" est trop faible et subjectif.
  Why it blocks validation: `FR-24` exige que le diagramme soit rendu comme image
  plutot que texte brut. Un test doit pouvoir distinguer raw code, image/vector,
  et echec silencieux.

- Original: "README aligne sur la CLI implementee" et "README correspond
  exactement a la CLI"
  Issue: "aligne" et "exactement" n'ont pas de procedure de verification.
  Why it blocks validation: la release peut passer avec une documentation
  incomplete si aucun check ne compare options, limitations, installation et
  erreurs.

- Original: "BrowserNotFoundError actionnable"
  Issue: "actionnable" n'est pas mesurable.
  Why it blocks validation: il faut definir les informations minimales du
  message: navigateurs supportes, variable `MD2PDF_BROWSER`, driver/provisioning,
  et absence de TeX.

- Original: "`npm pack` contient les fichiers attendus"
  Issue: le plan liste les familles de fichiers, mais pas la methode de controle.
  Why it blocks validation: `npm pack` peut inclure `dist/` tout en oubliant un
  asset necessaire au runtime ou en embarquant un fichier temporaire.

- Original: "tests PDF/browser sont isoles dans une commande lente dediee"
  Issue: le critere ne dit pas quand cette commande est obligatoire.
  Why it blocks validation: un stream peut livrer du rendu sans executer le seul
  test qui prouve la generation PDF reelle.

### Scope Risks

- Le plan dit repartir de zero avec `src/` considere vide, mais le depot audite
  ne contient actuellement pas de dossier `src/`. C'est coherent avec le cadrage,
  mais cela transforme `v0.1.1` en reconstruction complete, pas en correction
  incrementale. Le risque principal est d'avoir un plan qui promet deux streams
  paralleles alors que le premier jalon C0 doit d'abord recreer toute la
  charpente compilable.

- Le moteur de rendu local combine Markdown, highlighting, Mermaid, assets
  inline, navigateur, driver, WebDriver Print, timeout, atomic write et
  artifact policy dans un seul stream. C'est probablement trop large pour un
  parallele propre sans sous-contrats supplementaires.

- `FR-20` et `FR-21` sont MVP dans les requirements, mais le plan les traite
  comme une consequence de npm plutot que comme des livrables valides. C'est une
  dette d'acceptation cachee.

- Le plan reference `docs/ci_matrix_v0.1.md` pour les gates, mais il ne rend pas
  la portabilite `NFR-03` bloquante dans la Definition of Done. Une release peut
  donc etre declaree finie apres un run local unique.

### Open Questions

- `FR-20` system-scope et `FR-21` idempotent install/upgrade sont-ils reellement
  requis pour `0.1.1`, ou faut-il modifier les requirements pour les sortir du
  MVP?

- En cas de collision dans `--output-dir`, le comportement attendu est-il une
  erreur d'usage, un skip, ou l'application normale de la politique overwrite?

- Le fallback Chromium-for-Testing doit-il etre implemente en `0.1.1`, ou
  `BrowserNotFoundError` suffit-il pour le MVP?

- La preuve `NFR-02` attendue est-elle seulement structurelle (HTML sans URL
  externe), ou faut-il un test runtime avec reseau desactive?

- Quels champs obligatoires doivent porter les erreurs partagees pour que le CLI
  puisse garantir les messages `stderr` exiges par les stories?

## Architecture Audit

### Requirement and User Story Compliance

| Requirement / Story | Status | Evidence | Architecture Problem |
| --- | --- | --- | --- |
| `US-01`, `FR-01`, `FR-02`, `NFR-01` | Partially respected | Le plan prevoit `convertFile`, output par defaut, et conversion single-file. | La dependance a un navigateur installe/provisionne n'est pas tranchee contre "sans setup step"; le fallback navigateur reste ambigu. |
| `US-02`, `FR-04` a `FR-07`, `FR-24` | Partially respected | Stream B couvre Markdown, highlighting, images, Mermaid et print CSS. | La preuve Mermaid et heading orphan repose sur des formulations faibles; le plan ne decompose pas les risques de rendu par navigateur. |
| `US-03`, `FR-03`, `FR-23` | Partially respected | Stream A couvre `--output` et `--output-dir`. | Les collisions, parents inexistants et incompatibilites multi-sorties ne sont pas specifiques. |
| `US-04`, `FR-08` a `FR-11` | Partially respected | Stream A couvre batch, continue-on-error et summaries. | La frontiere entre erreurs de resolution, skips overwrite et conversions echouees n'est pas modelisee. |
| `US-05`, `FR-12` a `FR-14` | Partially respected | Table overwrite pure, prompt default No, skip non-interactif. | Le prompt interactif depend d'I/O process-level alors que le plan veut un CLI testable avec `main(argv, io)`; le contrat `io` n'est pas defini. |
| `US-06`, `FR-15` a `FR-18` | Partially respected | Exit codes `0`, `1`, `2` et erreurs partagees sont listes. | Les types d'erreurs ne couvrent pas `InputNotFoundError` cite par l'architecture; les donnees d'erreur ne sont pas contractuelles. |
| `US-07`, `FR-19` a `FR-21` | Not respected | Le plan couvre `bin`, build, `npm pack`; il ne couvre pas system-scope ni idempotent upgrade. | Installation est traitee comme packaging, pas comme capacite verifiee. |
| `US-08`, `NFR-04` | Respected | Le plan exige `--help` avec une ligne par option. | Aucun probleme bloquant si le test compare bien toutes les options supportees. |
| `NFR-02` | Partially respected | Le plan interdit les URL `http:`/`https:` dans le HTML. | La garantie runtime sans connexion sortante n'est pas assuree par ce seul controle. |
| `NFR-03` | Partially respected | Le plan cite detection multi-navigateurs et CI matrix comme source. | La Definition of Done ne rend pas Linux/macOS/Windows bloquants. |
| `NFR-05` | Partially respected | Le plan impose `check:artifacts` et la politique avant toute dependance. | Runtime provisioning n'a pas de contrat clair avec `artifacts.json`, `releaseCatalog`, cache et versions newest eligible. |

### Architecture Problems

#### Finding 1

Severity: High

Area: Scope and requirement coverage

Evidence: `FR-20` et `FR-21` sont `MVP` dans `docs/project_requirements.md`.
`US-07` contient l'installation system-scope et l'idempotence. Le plan
`v0.1.1` liste surtout `bin.md2pdf`, `npm run build`, `npm pack` et README.

Problem: le plan confond packaging npm avec validation de l'installation. Une
commande packagable ne prouve ni l'installation system-scope, ni l'idempotence
de reinstall/upgrade, ni l'invocabilite multi-comptes.

Impact: une release peut etre declaree terminee tout en violant deux exigences
MVP. Ce sera probablement decouvert tard, au moment d'une demonstration
d'installation ou d'un usage CI.

Suggested architectural correction: ajouter un livrable "Installation contract"
dans Stream A ou un Stream C court: smoke `npm pack`, installation dans un
prefixe utilisateur temporaire, reinstall meme version, upgrade/downgrade cible
si applicable, et decision explicite sur system-scope.

Migration risk: faible si traite maintenant; eleve si decouvert apres que la
CLI et le packaging ont ete stabilises autour d'hypotheses non testees.

Test or validation needed: scripts smoke non destructifs avec prefixe temporaire,
plus procedure documentee pour system-scope ou decision de retrait du MVP.

#### Finding 2

Severity: High

Area: Shared contract

Evidence: le contrat C0 expose `ConvertOptions` et `convertFile`, puis liste
`Md2PdfError`, `UsageError`, `ConversionError`, `RenderError`,
`BrowserNotFoundError`, `ArtifactFreshnessError`. L'architecture mentionne aussi
`InputNotFoundError`.

Problem: le contrat d'integration ne definit pas les proprietes necessaires:
`sourcePath`, `outputPath`, `exitCode`, `cause`, `actionHint`, classification
usage/conversion/render/skip, et serialisation en `stderr`.

Impact: Stream A peut construire un pipeline incapable de rapporter les chemins
fautifs exiges par `FR-15`/`FR-16`, tandis que Stream B peut lever des erreurs
riches mais non reconnues par le CLI. C'est exactement le genre de couture qui
craque en integration verticale.

Suggested architectural correction: faire de C0 un contrat d'erreurs teste:
hierarchie complete, champs obligatoires, mapping exit-code, format minimal des
messages, et tests contractuels sans navigateur.

Migration risk: moyen; changer les erreurs apres P2 force a reprendre tous les
tests de batch et de rendu.

Test or validation needed: tests unitaires du formatter d'erreurs et tests de
pipeline avec faux converter levant chaque classe d'erreur.

#### Finding 3

Severity: High

Area: Artifact freshness and runtime provisioning

Evidence: la politique impose que tout artifact provisionne applique la regle
"newest eligible" et que les non-npm artifacts soient declares dans
`artifacts.json`. Le plan place `releaseCatalog.ts` et un possible
`checkArtifactFreshness.mjs` dans Stream B, mais ne decrit pas le contrat entre
catalogue, driver, cache et check.

Problem: le runtime provisioning est une architecture de securite, pas un detail
de Stream B. Sans interface partagee, le code peut telecharger ou utiliser un
driver correct fonctionnellement mais non conforme a `NFR-05`.

Impact: risque de release bloquee par `check:artifacts`, ou pire, d'un chemin
runtime qui contourne la politique locale tout en passant les tests unitaires.

Suggested architectural correction: extraire un contrat `ArtifactPolicy` des C0:
selection `newest eligible`, source de timestamps, declaration `artifacts.json`,
cache per-user, comportement offline, et erreur specifique si aucune version
eligible compatible n'existe.

Migration risk: eleve si reporte apres implementation du browser locator; la
selection de driver est transversale a detection navigateur, WebDriver et cache.

Test or validation needed: tests avec catalogue fake couvrant eligible,
in-quarantine, waiver, version incompatible et absence de reseau.

#### Finding 4

Severity: Medium

Area: Gates and integration discipline

Evidence: C0 dit que `npm run typecheck` peut rester rouge pour les fonctions
non implementees, "mais pas pour une ambiguite de contrat". Les gates suivantes
exigent `typecheck` et `npm test`.

Problem: un gate rouge n'est pas un gate. TypeScript ne distingue pas
automatiquement "fonction non implementee" et "contrat ambigu"; si le build est
rouge, les streams peuvent diverger en pensant que l'echec est attendu.

Impact: les erreurs de contrat seront detectees plus tard, au moment ou elles
coutent cher. Le parallele devient une course avec brouillard, petit gyrophare
orange dans le cockpit.

Suggested architectural correction: C0 doit compiler vert avec des stubs
explicites qui lancent `NotImplementedError` ou equivalent, ou bien un
`typecheck:contract` dedie limite aux declarations partagees.

Migration risk: faible maintenant; moyen apres que les streams ont empile des
tests sur des imports instables.

Test or validation needed: `npm run typecheck` vert des C0, plus test minimal
d'import public des modules partages.

#### Finding 5

Severity: Medium

Area: Batch model and overwrite boundaries

Evidence: Stream A possede paths, overwrite, pipeline. Stream B ecrit l'output
seulement apres rendu complet. Le plan ne definit pas l'objet "work item" ni les
etats skip/failure/success.

Problem: la separation des responsabilites est plausible, mais la donnee
partagee manque. Sans modele de work item, les decisions overwrite peuvent etre
prises trop tard ou trop tot, les skips peuvent etre comptes comme failures, et
les sorties peuvent entrer en collision dans `--output-dir`.

Impact: batch summaries incorrects, prompts repetes, outputs partiels ou
ecrasements accidentels dans les cas limites.

Suggested architectural correction: definir en C0/P1 un type `ConversionJob`
resolu avant rendu, avec `sourcePath`, `outputPath`, `originEntry`, `status`
possible, et une phase de preflight pour collisions et overwrite.

Migration risk: moyen; un pipeline deja implemente autour de strings sera
douloureux a corriger.

Test or validation needed: tests de resolution pure pour dossiers, duplicates,
collisions, output-dir et skips non interactifs.

#### Finding 6

Severity: Medium

Area: Local-only guarantee

Evidence: le plan demande qu'aucune URL `http:` ou `https:` n'apparaisse dans le
HTML assemble. L'architecture reconnait que WebDriver n'offre pas
d'interception type Playwright et propose aussi un test reseau desactive.

Problem: l'absence d'URL dans le HTML n'empeche pas toute connexion sortante:
le navigateur, l'engine Mermaid, le driver, le provisioning ou un comportement
de startup peuvent tenter un acces reseau.

Impact: violation possible de `CON-02`/`NFR-02`, particulierement grave car la
confidentialite est un critere de succes du produit.

Suggested architectural correction: rendre obligatoire un test runtime de
conversion avec reseau bloque/desactive ou environnement instrumente, et separer
strictement "conversion local-only" de "provisioning autorise a telecharger".

Migration risk: moyen; si le lancement navigateur n'est pas encapsule avec des
flags offline/no-proxy des le depart, il faudra reprendre `pdfRenderer`.

Test or validation needed: test HTML sans URL externe, plus test browser-backed
en mode offline, plus test que le provisioning n'est pas invoque pendant une
conversion deja provisionnee.

#### Finding 7

Severity: Low

Area: Repository layout and plan assumptions

Evidence: le plan dit que `src/` est considere vide. Dans le depot audite,
`src/` n'existe pas actuellement, tandis que `dist/` existe.

Problem: le plan ne dit pas comment eviter que `dist/` ou d'anciens artifacts
compiles servent involontairement de source de verite pendant la reconstruction.

Impact: risque de copier un comportement obsolescent depuis `dist/` alors que
`docs/implementation_plan_v0.1.md` est explicitement exclu comme source de
pilotage.

Suggested architectural correction: ajouter une regle de source de verite:
`dist/` est sortie build uniquement, non consultable pour recreer `src/`, et le
premier build doit regenerer `dist/` depuis `src/`.

Migration risk: faible.

Test or validation needed: clean build depuis `src/` apres suppression locale de
`dist/` dans un workspace temporaire, ou au minimum validation que `dist/` n'est
pas inclus comme input de conception.

### Remediation Plan

1. Clarifier le statut MVP de `FR-20` et `FR-21`, puis ajouter les livrables et
   checks d'installation correspondants ou corriger les requirements.

2. Remplacer le C0 minimal par un contrat compile vert: `ConvertOptions`,
   `convertFile`, hierarchie d'erreurs complete, `ConversionJob`, mapping
   resultats/exit codes, et fixtures de tests partages.

3. Definir le contrat artifact/runtime provisioning avant d'implementer
   `browserLocator`: sources de versions, cache, `artifacts.json`, waivers,
   erreurs, et relation avec `check:artifacts`.

4. Transformer les criteres flous de DoD en checks observables: Mermaid non raw
   text, no external URL plus runtime offline, packlist verifiee, README compare
   a la surface CLI.

5. Rendre tous les gates bloquants ou les renommer en jalons non bloquants. Un
   gate qui peut rester rouge ne doit pas piloter deux streams paralleles.

6. Ajouter les edge cases de path/batch/overwrite au plan Stream A avant P2,
   surtout collisions `--output-dir`, duplicates, dossiers vides et prompts EOF.

### Open Questions

- Le dossier de rapport voulu est-il `audit/` ou faut-il rejoindre le dossier
  existant `audits/` pour conserver l'historique au meme endroit?

- Faut-il considerer `dist/` comme artifact historique a ignorer pendant
  l'implementation `0.1.1`, ou comme reference autorisee pour certains details
  techniques?

- La release `0.1.1` doit-elle prouver la portabilite complete
  Linux/macOS/Windows avant merge, ou seulement avant publication npm?

- Qui possede le contrat artifact policy: Stream B seul, ou un pre-requis commun
  valide en C0?
