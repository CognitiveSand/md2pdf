## Audit du 2026-06-04 - P0 phases 1 et 2

Sources auditees:

- `docs/p0_phase1_initial_review_v0.1.2.md`
- `docs/architecture.md`
- `docs/implementation_plan_v0.1.2_P0.md`
- `docs/implementation_plan_v0.1.2.md`
- `audit/2026-06-04-implementation-plan-v0.1.2-P0-acceptance-audit.md`

Note de contexte: cet audit juge uniquement les phases 1 et 2 deja realisees.
Les phases 3 a 5 restent hors scope sauf lorsqu'une decision de phase 1 ou 2
les rend plus difficiles a valider.

## Acceptance Audit

### Verdict
Ready with minor fixes

Les phases 1 et 2 sont assez solides pour continuer vers la phase 3: elles
creent une revue initiale exploitable, resoudent la hierarchie des sources,
identifient les divergences attendues et alignent largement `docs/architecture.md`
sur P0. Elles ne sont toutefois pas totalement verrouillees comme gate avant C0:
quelques criteres restent interpretables, et un contrat batch diverge encore du
plan parent v0.1.2.

### Blocking Ambiguities
- **`ConversionOutcome` ne suit pas la forme la plus stricte du plan parent.**
  La phase 1 declare que le plan v0.1.2 gagne lorsqu'il donne une precision plus
  stricte, et signale que la phase 2 doit eviter deux formes concurrentes du
  contrat. Pourtant `docs/architecture.md` definit `ConversionOutcome` avec
  seulement `sourcePath`, `outputPath?`, `status` et `error`, alors que
  `docs/implementation_plan_v0.1.2.md` attend `ConversionOutcome extends
  ConversionJob`. Le contrat perd donc au moins `originEntry` et `options` par
  rapport au job planifie. Cela peut produire deux implementations C0
  raisonnables mais incompatibles.
- **La preuve "aucun travail C0" reste externe au livrable.** La phase 1 liste
  ce qui compterait comme C0 et constate que `src/` n'existe pas, mais le
  document ne donne pas de preuve reproductible comme un `git status`, une note
  de diff, ou une checklist de fichiers autorises. Un reviewer peut le verifier
  manuellement aujourd'hui, mais pas reconstruire le constat depuis le document
  seul.
- **Le statut de `renderTimeoutMs` reste repousse a C0.** La phase 1 demandait
  de clarifier les valeurs par defaut ou leur statut volontairement non fixe.
  L'architecture dit que C0 devra documenter le default timeout avant production,
  mais ne fixe pas si `undefined` est permis, interdit, ou mappe vers une
  constante. C0 peut donc compiler avec plusieurs interpretations.

### Missing Edge Cases
- **Outcome `skipped` sans `outputPath` obligatoire.** `ConversionOutcome`
  autorise `outputPath?`, mais les skips d'overwrite ou de preservation doivent
  pouvoir reporter le chemin preserve. Sans invariant par statut, le resume
  stdout/stderr peut manquer le chemin utile.
- **Driver absent vs fallback browser.** L'architecture distingue navigateur
  absent, driver non eligible et fallback absent, mais ne dit pas si un navigateur
  installe sans driver eligible autorise ensuite un fallback Chromium-for-Testing
  ou doit echouer comme probleme de driver. Cette nuance conditionne le message
  `BrowserNotFoundError`.
- **Validation P0 non tracee dans les docs P0.** Le gate `npm run typecheck`
  peut echouer faute de `src/`, ce qui est prevu, mais les phases 1-2 ne
  definissent pas encore ou noter cette exception de gate. La phase 5 devrait
  probablement porter ce statut.
- **Artefact fallback planifie vs disponible.** L'architecture dit que
  `artifacts.json` vide rend le fallback "planned but not available", mais la
  checklist P0 ne distingue pas encore "decision documentee" de "capacite
  executable".

### Untestable Criteria
- Original: "`docs/architecture.md` no longer diverges from the v0.1.2 P0 plan"
  Issue: la checklist d'alignement donne des emplacements, pas un statut par
  item ni une assertion verifiable.
  Why it blocks validation: un item peut etre reference dans une section tout en
  restant incomplet ou contradictoire.
- Original: "`ConversionOutcome` is the batch-facing result used for stdout
  summaries and exit status decisions"
  Issue: le contrat ne precise pas les champs obligatoires par statut
  (`success`, `failed`, `skipped`).
  Why it blocks validation: les tests peuvent valider le type tout en laissant
  des outcomes inutilisables pour le reporting.
- Original: "Provisioning may use the network before conversion"
  Issue: la documentation ne definit pas l'evenement observable qui marque la
  fin du provisioning et le debut de la conversion.
  Why it blocks validation: un test reseau sur une invocation utilisateur peut
  etre interprete differemment selon que l'equipe appelle l'etape "provisioning"
  ou "conversion".

### Scope Risks
- **La phase 2 commence a figer des contrats au-dela du plan P0 minimal.**
  Ajouter `originEntry` et `options` dans `ConversionJob` est probablement utile,
  mais il faut aligner immediatement `ConversionOutcome` pour ne pas creer une
  norme hybride.
- **La separation navigateur/artifacts reste documentaire.** Elle est beaucoup
  plus claire qu'avant, mais les mots "find or request" dans `BrowserLocator`
  peuvent encore laisser entrer de la logique de provisioning dans le locator.
- **La phase 3 va heriter d'une question de statut.** Si les preuves release
  peuvent etre `pending`, `TODO` ou `N/A`, il faut choisir la convention avant
  de creer les templates, sinon les fichiers de preuve deviendront
  difficilement auditables.

### Open Questions
- `ConversionOutcome` doit-il etendre `ConversionJob` exactement comme le plan
  parent, ou le plan P0 minimal gagne-t-il sur ce point?
- `renderTimeoutMs` a-t-il une valeur par defaut normative des C0, ou doit-il
  rester explicitement `TODO` dans les contrats?
- Un navigateur installe sans driver eligible doit-il declencher le fallback
  Chromium-for-Testing ou une erreur driver dediee?
- Ou faut-il consigner l'exception P0 lorsque `npm run typecheck` echoue
  uniquement parce que `src/` n'existe pas encore?

## Architecture Audit

### Requirement and User Story Compliance
| Requirement / Story | Status | Evidence | Architecture Problem |
| --- | --- | --- | --- |
| P0 phase 1 cadrage | Respected | `docs/p0_phase1_initial_review_v0.1.2.md` liste sources, precedence, etat initial et divergences. | La preuve "no C0" reste un constat declaratif, pas une trace de diff. |
| P0 phase 2 contrats C0 | Partially respected | `docs/architecture.md` ajoute `ConvertOptions`, `ConversionJob`, `ConversionOutcome`, `convertFile`. | `ConversionOutcome` ne correspond pas au contrat parent `extends ConversionJob`; timeout et invariants par statut restent incomplets. |
| Separation navigateur/artifacts | Partially respected | `BrowserLocator`, `ReleaseCatalog`, `ArtifactPolicy`, `FallbackBrowserProvisioner` sont separes dans la vue composants et ADR-05. | `BrowserLocator` "find or request" un WebDriver, ce qui peut encore melanger detection et provisioning. |
| Fallback Chromium-for-Testing | Respected | Architecture: dernier recours, declare dans `artifacts.json`, `newest eligible`, checksum SHA-256, freshness, erreur si aucun artifact eligible. | La capacite reste explicitement indisponible avec `artifacts.json` vide; cela doit rester visible dans les preuves release. |
| NFR-02 local-only | Partially respected | Architecture separe provisioning reseau et conversion local-only avec HTML `file:` et assets inlines. | Aucun contrat d'interface ne force encore que le provisioning soit termine avant `convertFile`. |
| ADR-05 / R-1 / R-3 | Respected | ADR-05, R-1 et R-3 ont ete mis a jour pour la separation et les causes `BrowserNotFoundError`. | Risque residuel sur le cas "browser present, driver absent". |

### Architecture Problems

#### Finding 1
Severity: High
Area: Batch contract
Evidence: `docs/architecture.md` definit `ConversionJob` avec `originEntry` et
`options`, puis `ConversionOutcome` sans extension de ce job; le plan parent
definit `ConversionOutcome extends ConversionJob`.
Problem: le resultat batch ne preserve pas formellement toutes les informations
du job planifie. Cela contredit la precedence de phase 1 qui donne le dessus au
plan parent quand il est plus strict.
Impact: Stream A peut construire des summaries avec `originEntry`, tandis que
Stream B ou C0 peuvent retourner des outcomes qui ne le portent pas. Le CLI
risque alors de reparcourir les jobs, de parser des messages d'erreur, ou de
perdre le contexte utilisateur.
Suggested architectural correction: aligner `ConversionOutcome` sur le plan
parent (`extends ConversionJob`) ou documenter explicitement pourquoi P0 choisit
une forme plus petite, avec une regle de mapping job/outcome testable.
Migration risk: faible maintenant, moyen apres ajout des tests contractuels C0.
Test or validation needed: test contractuel C0 qui importe `ConversionOutcome`
et verifie les champs requis par statut.

#### Finding 2
Severity: Medium
Area: Network boundary
Evidence: `docs/architecture.md` dit que provisioning peut utiliser le reseau
avant conversion, et le plan parent exige "provisioning termine avant conversion"
et "conversion local-only depuis etat pre-provisionne".
Problem: la separation est textuelle. Aucun contrat de composant ou d'API ne
rend impossible un `convertFile` qui declenche le provisioning reseau pendant
une conversion utilisateur.
Impact: NFR-02 peut rester difficile a prouver, surtout au premier run ou le
driver manque.
Suggested architectural correction: introduire dans l'architecture une frontiere
operationnelle: runtime/provisioning d'abord, conversion ensuite, avec un
parametre ou service qui interdit le reseau dans le chemin `convertFile`.
Migration risk: moyen si C0 integre trop tot locator/provisioning dans le
converter.
Test or validation needed: test conversion offline depuis cache pre-provisionne;
test que le provisioner ne recoit jamais le contenu Markdown.

#### Finding 3
Severity: Medium
Area: Browser locator responsibility
Evidence: la vue composants dit que `BrowserLocator` detecte un navigateur et
"find or request" un WebDriver compatible, tandis que `ArtifactPolicy` et
`FallbackBrowserProvisioner` portent la policy/provisioning.
Problem: "request" est une responsabilite floue. Si le locator demande ou
declenche le provisioning, il dependra de la supply chain runtime et redeviendra
un orchestrateur.
Impact: le decoupage P0 peut se re-melanger en C0/P2, avec des tests locator qui
doivent simuler catalogue, policy, cache et reseau.
Suggested architectural correction: faire de `BrowserLocator` un pur detecteur
qui retourne un besoin de driver ou un descriptor; confier la resolution
provisionnee a un composant dedie ou a une orchestration explicite.
Migration risk: faible avant C0.
Test or validation needed: test unitaire `BrowserLocator` sans catalogue ni
telechargement; tests provisioning separes.

#### Finding 4
Severity: Medium
Area: Error contracts
Evidence: le plan parent definit `ErrorKind` et `Md2PdfErrorContext`; la phase 2
architecture mentionne seulement une hierarchie `Md2pdfError` avec contextes et
causes.
Problem: la phase 2 ne relie pas les causes `BrowserNotFoundError` au schema
d'erreur parent. Les causes peuvent devenir des messages libres au lieu de codes
stables.
Impact: le CLI peut etre teste par texte fragile, et les batch outcomes peuvent
porter des erreurs peu serialisables.
Suggested architectural correction: ajouter dans l'architecture une reference au
schema `ErrorKind` / contexte stable, au moins pour `browser` et `artifact`.
Migration risk: faible maintenant.
Test or validation needed: tests de formatage par `kind`, `actionHint`,
`artifactName`, `sourcePath` et `outputPath`.

#### Finding 5
Severity: Low
Area: P0 auditability
Evidence: la phase 1 etablit les fichiers interdits pour C0 (`src/`, tests,
scripts, `dist`) et la phase 2 modifie seulement `docs/architecture.md`, mais le
livrable ne conserve pas le statut Git observe.
Problem: l'auditabilite de P0 depend encore du reviewer qui inspecte le repo au
bon moment.
Impact: une PR future pourrait melanger P0 et C0 sans que la phase 1 fournisse
une preuve locale suffisante.
Suggested architectural correction: la phase 5 checklist devrait inclure un
bloc "P0 scope check" avec fichiers autorises, commande `git status --short` ou
resume de diff.
Migration risk: faible.
Test or validation needed: checklist release avec statut explicite `pass` /
`pending` / `blocked`.

### Remediation Plan
1. Aligner immediatement `ConversionOutcome` avec le plan parent ou documenter
   une exception explicite.
2. Decider la valeur par defaut ou le statut contractuel de `renderTimeoutMs`
   avant C0.
3. Transformer la frontiere reseau/provisioning en interface ou sequence
   operationnelle testable.
4. Repreciser `BrowserLocator` pour eviter qu'il porte du provisioning.
5. Relier `BrowserNotFoundError` au schema d'erreur stable du plan parent.
6. Prevoir dans la phase 5 une preuve de scope P0/no-C0 et une convention de
   statut pour les preuves non encore executables.

### Open Questions
- La phase 2 doit-elle corriger maintenant le contrat `ConversionOutcome`, ou
  cette correction doit-elle etre reportee a C0?
- Quel composant orchestre la sequence "provisioning termine avant conversion":
  CLI, pipeline, converter, ou un runtime manager dedie?
- Les causes de `BrowserNotFoundError` doivent-elles etre des codes stables ou
  seulement des messages humains?
- Le statut `pending` est-il la convention voulue pour les preuves de release
  impossibles avant C0/P4?
