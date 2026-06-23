# Re-audit du plan d'implementation v0.1.1

Date: 2026-06-04

Sources auditees:

- `docs/implementation_plan_v0.1.1.md` apres pull `e2d89fb`
- `docs/project_requirements.md`
- `docs/user_stories.md`
- `docs/architecture.md`
- `docs/ci_matrix_v0.1.md`
- `ARTIFACT_FRESHNESS_POLICY.md`
- `package.json`

## Acceptance Audit

### Verdict

Ready with minor fixes

Le nouveau plan corrige l'essentiel des blocages du precedent audit: `FR-19` a
`FR-21` sont remis dans la portee, C0 devient un vrai gate vert, le contrat
d'erreurs est beaucoup plus clair, les collisions de jobs sont traitees, et la
politique artifacts est integree au runtime provisioning.

Il reste toutefois quelques criteres qui peuvent encore produire une fausse
validation: system-scope trop faible, commande de gate C0 probablement fragile,
preuve local-only pas assez separee du provisioning, et incoherences entre le
plan et l'architecture de reference.

### Blocking Ambiguities

- La Definition de fini dit que `FR-19`, `FR-20` et `FR-21` ont "une preuve
  d'installation ou une procedure documentee conforme". Le `ou` est trop faible
  pour `FR-19` et `FR-21`, qui exigent une installation user-scope et une
  reinstallation idempotente observables. Une procedure documentee seule ne
  prouve pas ces deux requirements.

- `FR-20` est traite comme "procedure system-scope documentee et demontrable
  sans modifier le poste de developpement". Or le requirement parle d'un outil
  installe system-scope et invocable par chaque compte utilisateur. Le plan ne
  dit pas ce qui constitue une demonstration acceptable sans elevation ni second
  compte utilisateur.

- Le fallback Chromium-for-Testing est declare in scope, mais l'architecture
  reste formulee autour du navigateur deja installe avec un fallback "can
  provision". Le plan ne dit pas si cette extension doit mettre a jour
  `docs/architecture.md` avant implementation, alors que l'architecture est
  declaree authoritative sur les mecanismes internes.

- `NFR-02` separe "provisioning peut utiliser le reseau" et "conversion deja
  provisionnee ne doit ouvrir aucune connexion sortante", mais les acceptance
  criteria `US-01` disent simplement "When the user runs md2pdf ... Then no
  outbound network connection is opened during the conversion". Le plan doit
  fixer si le first run qui provisionne est hors conversion ou si le test
  d'acceptation doit pre-provisionner explicitement.

### Missing Edge Cases

- `MD2PDF_BROWSER` pointe vers un fichier inexistant, un dossier, un executable
  non-navigateur, ou un navigateur dont aucun driver eligible n'existe. Le plan
  mentionne le support de la variable, mais pas ses modes d'echec.

- Dossier sans fichier Markdown: le plan impose un succes avec `0 succeeded, 0
  failed, 0 skipped`, mais ne precise pas l'exit code. D'apres "exit 0 si aucun
  job n'a echoue", c'est probablement `0`; il faut le rendre explicite parce que
  c'est un cas de batch sans conversion.

- Sortie explicite avec extension autre que `.pdf`. `FR-03` dit "explicit output
  path" sans imposer l'extension; le plan ne dit pas si `out/report` ou
  `out/report.txt` sont acceptes.

- Cas Windows pour les executables installes dans un prefixe npm temporaire. La
  matrice CI dit d'utiliser le bin path specifique Windows, mais le plan ne
  transforme pas cette contrainte en livrable/test d'installation.

- Cache utilisateur pour drivers/fallback: corruption de cache, version
  partiellement telechargee, ou cache contenant une version devenue non eligible
  par rapport au "newest eligible" actuel. Le plan parle de cache versionne, pas
  de validation/reparation.

### Untestable Criteria

- Original: "procedure system-scope documentee et demontrable sans modifier le
  poste de developpement"
  Issue: "demontrable" n'a pas de protocole.
  Why it blocks validation: impossible de savoir si une lecture README suffit,
  si un dry-run suffit, ou si un vrai second compte doit invoquer `md2pdf`.

- Original: "README correspond a la CLI via checklist testable"
  Issue: le type de checklist n'est pas defini.
  Why it blocks validation: une checklist manuelle peut passer sans detecter une
  option manquante; un test automatise demanderait une source de verite pour les
  options.

- Original: "Mermaid est valide par un test qui detecte ... la presence d'un
  rendu graphique/vectoriel ou image"
  Issue: le signal attendu dans un PDF n'est pas precise.
  Why it blocks validation: selon le navigateur, le rendu peut etre vectoriel,
  rasterise, ou expose differemment dans la structure PDF; le test risque
  d'etre flaky si le critere technique n'est pas fixe.

- Original: "`npm test -- --run tests/unit/contracts`"
  Issue: cette commande est probablement fragile avec le script actuel
  `vitest run --reporter=verbose`.
  Why it blocks validation: l'argumentation `-- --run` peut etre interpretee
  comme pattern ou option invalide selon Vitest/npm. Un gate contractuel devrait
  avoir un script dedie comme `test:contracts`.

### Scope Risks

- Le fallback Chromium-for-Testing ajoute une surface lourde: catalogue de
  releases, downloads, cache, integrity, unpacking, chemins OS, et artifact
  policy. C'est justifie par le plan, mais ce n'est plus un simple "dernier
  recours"; c'est un sous-produit de provisioning complet dans le MVP.

- Le plan ajoute `ArtifactPolicy`, `ReleaseCatalog`, erreurs, jobs, CLI,
  renderer, WebDriver et installation dans une reconstruction from scratch.
  Meme corrige, le parallele A/B depend d'un C0 dense. Si C0 est traite comme
  "court" sans budget reel, le risque d'integration reste eleve.

- Le plan autorise `audit/2026-06-04-implementation-plan-v0.1.1-audit.md`
  comme source de corrections. Utile pour tracer les corrections, mais dangereux
  si l'audit devient une source normative au meme niveau que requirements et
  architecture.

### Open Questions

- Quelle preuve minimale accepte-t-on pour `FR-20` system-scope sans elevation
  dans l'environnement de developpement?

- Le first run avec provisioning doit-il satisfaire `NFR-02`, ou `NFR-02`
  s'applique-t-il uniquement apres pre-provisioning explicite?

- Faut-il mettre a jour `docs/architecture.md` avant de commencer C0 pour
  refleter `ArtifactPolicy`, `ConversionJob`, le fallback in-scope et les
  nouveaux modules/contracts?

- Le gate C0 doit-il devenir un script stable `npm run test:contracts` plutot
  qu'une invocation ad hoc via `npm test -- ...`?

## Architecture Audit

### Requirement and User Story Compliance

| Requirement / Story | Status | Evidence | Architecture Problem |
| --- | --- | --- | --- |
| `US-01`, `FR-01`, `FR-02`, `NFR-01` | Partially respected | Plan: single-file, default output, browser/fallback decision. | Zero-configuration first run reste ambigu si le provisioning navigateur/driver se declenche pendant le premier run. |
| `US-02`, `FR-04` a `FR-07`, `FR-24` | Partially respected | Plan: dialecte, images, Mermaid, test raw absent + rendu graphique. | Le critere PDF exact pour prouver Mermaid et heading orphan n'est pas encore stabilise. |
| `US-03`, `FR-03`, `FR-23` | Respected | Plan: `--output`, `--output-dir`, collisions et source==output en `UsageError`. | Reste seulement l'ambiguite extension `.pdf` pour output explicite. |
| `US-04`, `FR-08` a `FR-11` | Respected | Plan: `ConversionJob`, continue-on-error, summaries success/failure/skip. | Aucun probleme bloquant; le summary ajoute `skipped`, ce qui depasse les stories sans les contredire. |
| `US-05`, `FR-12` a `FR-14` | Respected | Plan: prompt default No, EOF preserve, skip non-interactif, force prioritaire. | Aucun probleme bloquant. |
| `US-06`, `FR-15` a `FR-18` | Respected | Plan: erreurs avec contexte, formatter unique, exit `0/1/2`. | Le traitement `skipped` en exit `0` doit etre assume dans la doc utilisateur. |
| `US-07`, `FR-19` a `FR-21` | Partially respected | Plan: install user-scope temporaire, reinstall idempotent, procedure system-scope. | `FR-20` et la DoD "preuve ou procedure" restent insuffisants pour une validation objective. |
| `US-08`, `NFR-04` | Respected | Plan: help avec une ligne par option et README checklist. | Le test README/CLI doit avoir une source de verite explicite. |
| `NFR-02` | Partially respected | Plan: offline/no-proxy apres provisioning et HTML sans URL externe. | La frontiere conversion/provisioning doit etre explicite pour eviter un faux echec ou une fausse passe. |
| `NFR-03` | Partially respected | CI matrix l'exige sur trois OS; plan cite `NFR-03` en Stream B. | La DoD ne dit pas explicitement que la matrice Linux/macOS/Windows doit etre verte avant release. |
| `NFR-05` | Partially respected | Plan: `ArtifactPolicy`, `ReleaseCatalog`, newest eligible, `artifacts.json`. | Le plan ne mentionne pas integrity/hash verification des downloads non-npm, seulement leur eligibilite temporelle. |

### Architecture Problems

#### Finding 1

Severity: High

Area: Architecture source of truth

Evidence: le plan introduit `ConversionJob`, `ConversionOutcome`,
`ArtifactPolicy`, `ReleaseCatalog` et un fallback Chromium-for-Testing in scope.
`docs/architecture.md` ne decrit pas ces contrats comme composants; il garde
`BrowserLocator` comme proprietaire de la detection et du driver, avec fallback
"can provision".

Problem: le plan d'implementation modifie l'architecture effective sans mettre a
jour le document architectural declare authoritative. Deux sources peuvent donc
diverger des C0: l'une pousse vers des contrats partages, l'autre vers des
responsabilites concentrees dans `BrowserLocator`.

Impact: les streams peuvent respecter le plan tout en violant l'architecture,
ou respecter l'architecture tout en oubliant les nouveaux contrats. C'est un
risque d'integration et de revue, pas seulement de documentation.

Suggested architectural correction: avant C0, mettre a jour
`docs/architecture.md` avec les contrats partages, la separation
`ArtifactPolicy`/`ReleaseCatalog`/`BrowserLocator`, et la decision ferme sur le
fallback Chromium-for-Testing.

Migration risk: moyen si reporte; les imports et responsabilites risquent de se
figer au mauvais endroit.

Test or validation needed: revue d'architecture comparee plan/architecture avant
implementation, puis test d'import sans cycle des modules contractuels.

#### Finding 2

Severity: High

Area: Runtime artifact security

Evidence: la politique impose les versions newest eligible et la declaration
dans `artifacts.json`. Le plan impose ces regles au provisioning, mais ne parle
pas d'integrity verification, checksum, signature, taille attendue, ou
provenance immuable des archives telechargees.

Problem: l'eligibilite temporelle ne suffit pas a securiser un binaire driver ou
un navigateur fallback telecharge au runtime. Un artifact peut etre eligible
mais corrompu, substitue, ou servi depuis une URL compromise.

Impact: le chemin le plus sensible du produit, executer un binaire provisionne,
peut satisfaire `NFR-05` tout en restant faible en supply-chain security.

Suggested architectural correction: etendre le contrat non-npm artifact avec
URL immuable, checksum cryptographique attendu, verification avant execution,
stockage atomique en cache, et erreur explicite en cas d'integrity mismatch.

Migration risk: eleve si ajoute apres le provisioning; le format
`artifacts.json`, le cache et les tests devront changer.

Test or validation needed: tests catalog fake avec checksum valide, checksum
invalide, download interrompu, cache partiel et cache corrompu.

#### Finding 3

Severity: Medium

Area: System-scope installation validation

Evidence: `FR-20` exige qu'une installation system-scope rende `md2pdf`
invocable par chaque compte. Le plan demande seulement une procedure
documentee et demontrable sans modifier le poste de developpement.

Problem: la validation proposee ne prouve pas le comportement multi-utilisateur.
Elle peut au mieux prouver que la commande documentee semble plausible.

Impact: `FR-20` peut etre coche sans evidence. C'est acceptable seulement si le
projet assume explicitement que `FR-20` est verifie par procedure manuelle hors
environnement local.

Suggested architectural correction: distinguer trois niveaux: test automatise
user-scope, smoke idempotence automatise, et checklist manuelle system-scope
avec prerequis, commande, compte secondaire, resultat attendu.

Migration risk: faible.

Test or validation needed: artifact de preuve manuel versionne ou ticket de
release contenant OS, commande system-scope, compte utilisateur teste et sortie
`md2pdf --help`.

#### Finding 4

Severity: Medium

Area: Gate design

Evidence: C0 gate: `npm run typecheck` puis `npm test -- --run
tests/unit/contracts`. `package.json` definit `test` comme `vitest run
--reporter=verbose` et ne definit pas `test:contracts`.

Problem: le gate critique C0 repose sur une invocation ad hoc potentiellement
mal interpretee par npm/Vitest. Le premier gate du projet est l'endroit ou il
faut le moins d'ambiguite de commande.

Impact: l'equipe peut perdre du temps a diagnostiquer le gate au lieu du
contrat, ou pire, croire que les tests contracts ont tourne alors qu'ils ont ete
interpretes comme autre chose.

Suggested architectural correction: ajouter un script explicite dans le plan:
`"test:contracts": "vitest run tests/unit/contracts --reporter=verbose"` ou un
chemin exact equivalent, puis utiliser `npm run test:contracts` en C0.

Migration risk: faible.

Test or validation needed: execution du script sur un squelette C0 avec au
moins un test contractuel volontairement rouge puis vert.

#### Finding 5

Severity: Medium

Area: Local-only boundary

Evidence: le plan dit que le provisioning peut utiliser le reseau avant
conversion, mais que la conversion d'un job deja provisionne ne doit ouvrir
aucune connexion sortante. Les stories formulent le comportement depuis la
commande utilisateur.

Problem: la frontiere entre "provisioning" et "conversion" est technique, pas
visible utilisateur. Un utilisateur lance une seule commande; si celle-ci
telecharge un driver avant de rendre le PDF, il peut comprendre que la
conversion a ouvert le reseau.

Impact: risque de conflit d'acceptation sur `NFR-02` et la promesse
confidentialite. Le produit peut etre techniquement raisonnable mais paraitre
contraire aux requirements.

Suggested architectural correction: documenter un etat "pre-provisioned" dans
les tests `NFR-02`, et separer les commandes/tests "provisioning autorise" de
"conversion local-only". Si le premier run peut telecharger, le README doit le
dire explicitement sans suggerer que le Markdown/PDF est transmis.

Migration risk: moyen si les tests browser-backed melangent provisioning et
conversion.

Test or validation needed: test de conversion offline avec cache deja rempli;
test separe que le provisioning ne lit pas le contenu Markdown et respecte
artifact policy.

#### Finding 6

Severity: Low

Area: Acceptance vs implementation edge cases

Evidence: le plan ajoute des comportements pour `.MD`, dossier vide, skips,
prompts EOF, outputs dupliques et parent d'output cree.

Problem: plusieurs comportements depassent les stories sans etre reintroduits
dans requirements ou acceptance criteria. Ce n'est pas une contradiction, mais
cela transforme le plan en source de requirements secondaires.

Impact: le scope peut gonfler par "bons details" qui deviennent obligatoires
sans validation produit.

Suggested architectural correction: marquer explicitement ces points comme
decisions d'implementation defensives, ou ajouter une petite section
"policy decisions not present in stories" pour eviter de les confondre avec le
MVP produit.

Migration risk: faible.

Test or validation needed: revue produit rapide des decisions supplementaires:
dossier vide exit `0`, extension case-insensitive, parent auto-created, skip
count dans summary.

### Remediation Plan

1. Mettre a jour `docs/architecture.md` avant C0 pour absorber les nouveaux
   contrats et le fallback Chromium-for-Testing in scope.

2. Remplacer le gate C0 ad hoc par un script stable `npm run test:contracts`.

3. Durcir le contrat non-npm artifact avec checksum/integrity, cache atomique et
   tests de corruption.

4. Clarifier la preuve `FR-20` et remplacer "preuve ou procedure" par des
   preuves adaptees a chaque requirement: automatique pour `FR-19`/`FR-21`,
   manuelle documentee pour `FR-20`.

5. Ecrire noir sur blanc la frontiere provisioning/conversion pour `NFR-02`,
   puis aligner README, tests et DoD.

6. Lister les decisions defensives hors stories pour eviter qu'elles deviennent
   du scope cache non valide.

### Open Questions

- Le fallback Chromium-for-Testing doit-il rester MVP si son implementation
  integrity/cache multiplie le cout, ou peut-il etre garde comme fallback
  documente mais non implemente en `0.1.1`?

- Quelle forme de preuve system-scope sera acceptee pour `FR-20` dans ce projet?

- Le projet veut-il garantir seulement "no Markdown/PDF transmission" pendant
  provisioning, ou "zero outbound connection" pour toute invocation utilisateur?

- Les comportements defensifs ajoutes par le plan doivent-ils etre promus dans
  les requirements, ou rester des decisions internes testees?
