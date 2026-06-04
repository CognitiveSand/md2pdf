# Audit du plan d'implementation v0.1.1

Date: 2026-06-04

Sources auditees:

- `docs/implementation_plan_v0.1.1.md`
- `docs/project_requirements.md`
- `docs/user_stories.md`
- `docs/architecture.md`
- `ARTIFACT_FRESHNESS_POLICY.md`
- `artifacts.json`
- `package.json`
- audits precedents dans `audit/`

Note de contexte: `src/` et `tests/` n'existent pas encore dans le depot inspecte.
Cet audit juge donc le plan et sa coherence avec les sources de verite, pas une
implementation applicative.

## Acceptance Audit

### Verdict

Ready with minor fixes

Le plan v0.1.1 est maintenant beaucoup plus proche d'un plan executable: il
reintegre `FR-19` a `FR-21`, transforme C0 en vrai gate compile vert, definit
les contrats d'erreurs et de batch, separe provisioning et conversion pour
`NFR-02`, et durcit la politique d'artifacts avec checksum/cache atomique.

Il reste toutefois quelques points qui peuvent encore produire une fausse
validation en fin de release.

### Blocking Ambiguities

- La preuve "test contractuel rouge puis vert" en C0 n'a pas de support
  d'evidence. C'est utile pedagogiquement, mais le plan ne dit pas comment cette
  sequence sera constatee apres coup. Sans trace, un reviewer peut seulement
  verifier que le test est vert, pas que le contrat a vraiment pilote le C0.

- `FR-20` depend d'un artifact de preuve manuel "obligatoire dans la PR de
  release", mais le plan ne fixe pas son emplacement ni son format exact. Le
  contenu attendu est liste, mais pas le chemin versionne ni le gate qui echoue
  si l'artifact manque.

- Le plan exige que `docs/architecture.md` soit mis a jour avant tout travail
  C0, mais l'architecture actuelle ne contient pas encore les nouveaux contrats
  (`ConversionJob`, `ArtifactPolicy`, `ReleaseCatalog`, fallback
  Chromium-for-Testing soumis a policy). La readiness depend donc d'une
  modification documentaire bloquante qui doit etre traitee comme un vrai livrable
  P0, pas comme une note.

### Missing Edge Cases

- `--output-dir` avec deux entrees provenant de dossiers differents mais ayant
  le meme basename est couvert par "plusieurs jobs resolus vers le meme output",
  mais le plan ne donne pas l'exemple. C'est un cas important pour tester
  directement `FR-23`.

- L'installation user-scope temporaire doit gerer le nom du binaire Windows
  (`md2pdf.cmd`) aussi bien que le shim POSIX. Le plan dit tester `md2pdf
  --help`, mais pas comment le chemin du binaire est resolu par OS.

- Les erreurs de permission filesystem sont implicites dans "parent d'output
  cree si possible" et "missing/unreadable input", mais aucun cas dedie ne
  distingue input illisible, output parent non writable et cache utilisateur non
  writable.

### Untestable Criteria

- Original: "au moins un test contractuel rouge puis vert"
  Issue: l'etat rouge historique n'est pas observable dans le repo final.
  Why it blocks validation: sans log, commit separe, ou note de preuve, la
  release peut satisfaire le texte par declaration seulement.

- Original: "`FR-20`: artifact de preuve manuel versionne present dans la PR de
  release"
  Issue: le plan ne precise pas ou le fichier doit vivre ni comment son absence
  bloque la release.
  Why it blocks validation: un critere manuel non localise est facile a oublier
  et difficile a auditer automatiquement.

- Original: "la section Decisions defensives a ete relue"
  Issue: "relue" ne laisse pas de signal de validation.
  Why it blocks validation: il faut soit des tests references, soit une checklist
  versionnee indiquant quelles lignes sont testees ou documentees.

### Scope Risks

- Le fallback Chromium-for-Testing reste MVP et entraine un sous-systeme lourd:
  catalogue, selection newest eligible, checksum, extraction, cache atomique,
  nettoyage, compatibilite OS et tests de corruption. Le plan le cadre mieux,
  mais c'est encore le principal risque de delai.

- `audit/2026-06-04-implementation-plan-v0.1.1-audit.md` est une source
  autorisee "comme liste de corrections". C'est acceptable pour la traçabilite,
  mais il faut garder les requirements, stories, architecture et policy comme
  seules sources normatives durables.

- Comme `src/` et `tests/` n'existent pas encore, C0 porte plus qu'un simple
  squelette: il doit creer les frontieres, les modules, les exports, les scripts
  et les conventions de test. Le plan est pret, mais seulement si C0 est traite
  comme un jalon substantiel.

### Open Questions

- Ou doit etre stockee la preuve manuelle `FR-20` pour qu'elle soit versionnee
  et auditable?

- Faut-il un fichier de checklist release dedie pour tracer "rouge puis vert",
  revue des decisions defensives, packlist et preuve system-scope?

- Le fallback Chromium-for-Testing doit-il etre livre des P2, ou peut-il etre
  derriere un gate explicite qui bloque P3 tant que le catalogue exact n'est pas
  rempli?

## Architecture Audit

### Requirement and User Story Compliance

| Requirement / Story | Status | Evidence | Architecture Problem |
| --- | --- | --- | --- |
| `US-01`, `FR-01`, `FR-02`, `NFR-01` | Respected | Le plan couvre single-file, output par defaut, zero config, navigateur installe et fallback eligible. | Le cout architectural est concentre dans le provisioning first-run. |
| `US-02`, `FR-04` a `FR-07`, `FR-24` | Respected | Markdown dialect, highlighting, images, Mermaid, PDF/browser tests et preuve Mermaid non raw sont prevus. | La fiabilite du test Mermaid dependra du navigateur de reference fixe en P3. |
| `US-03`, `FR-03`, `FR-23` | Respected | `--output`, `--output-dir`, output verbatim, collisions et source==output sont definis. | Ajouter un test explicite basename collision cross-directory. |
| `US-04`, `FR-08` a `FR-11` | Respected | `ConversionJob`, `ConversionOutcome`, continue-on-error et summary success/failure/skip sont definis. | Aucun probleme majeur. |
| `US-05`, `FR-12` a `FR-14` | Respected | Prompt default No, EOF preserve, force prioritaire, skip non-interactif. | Aucun probleme majeur. |
| `US-06`, `FR-15` a `FR-18` | Respected | Erreurs typees avec contexte et formatter unique. | Les erreurs de permission doivent etre testees pour eviter des messages generiques. |
| `US-07`, `FR-19` a `FR-21` | Partially respected | Install user-scope et reinstall idempotent automatises; `FR-20` manuel. | La preuve system-scope reste hors automation et doit etre rendue auditable. |
| `US-08`, `NFR-04` | Respected | Help et comparaison README/options sont prevus. | Aucun probleme majeur si la comparaison a une source de verite unique. |
| `NFR-02` | Respected | Le plan separe pre-provisioning, conversion offline/no-proxy et provisioning ne lisant pas le Markdown. | La documentation doit eviter l'ambiguite "first run telecharge" vs "document local-only". |
| `NFR-03` | Respected | La DoD exige la matrice CI Linux/macOS/Windows verte. | Aucun probleme majeur. |
| `NFR-05` | Respected | Newest eligible, artifacts declares, checksum SHA-256, cache atomique et tests de corruption sont prevus. | Le catalogue exact reste a materialiser dans `artifacts.json`. |

### Architecture Problems

#### Finding 1

Severity: High

Area: Architecture source of truth

Evidence: `docs/implementation_plan_v0.1.1.md` impose de mettre a jour
`docs/architecture.md` avant C0. Le fichier `docs/architecture.md` inspecte ne
contient pas encore les nouveaux contrats partages ni la separation
`ArtifactPolicy` / `ReleaseCatalog` / `BrowserLocator`.

Problem: le plan est coherent seulement si ce prerequis est execute en premier.
Tant que l'architecture reste dans son etat actuel, deux documents directeurs
decrivent des responsabilites differentes.

Impact: Stream A et Stream B peuvent partir sur des imports ou des proprietes
de modules incompatibles, surtout autour du provisioning runtime.

Suggested architectural correction: creer un jalon P0 documentaire explicite:
mettre a jour `docs/architecture.md`, puis faire relire uniquement la coherence
plan/architecture avant C0.

Migration risk: moyen si reporte apres les premiers modules.

Test or validation needed: test contractuel d'import sans cycle plus revue
plan/architecture.

#### Finding 2

Severity: Medium

Area: Release evidence

Evidence: `FR-20` est prouve par un artifact manuel versionne dans la PR de
release, mais aucun chemin ni schema de preuve n'est defini.

Problem: la validation system-scope est architectee comme une preuve externe,
mais le stockage de cette preuve ne fait pas partie du systeme.

Impact: la release peut etre bloquee tard par une discussion de forme plutot que
par un vrai probleme produit.

Suggested architectural correction: reserver un chemin, par exemple
`docs/release-evidence/fr-20-system-scope.md`, et definir les champs requis:
OS, version, commande, compte secondaire ou simulation, sortie `md2pdf --help`,
date et auteur.

Migration risk: faible.

Test or validation needed: checklist release qui verifie l'existence de ce
fichier pour `0.1.1`.

#### Finding 3

Severity: Medium

Area: Runtime provisioning complexity

Evidence: le fallback Chromium-for-Testing est in scope, soumis a
`ArtifactPolicy`, checksum, cache atomique et tests de corruption.

Problem: ce fallback transforme `browserLocator` en orchestration de supply
chain runtime. Meme bien separe, il reste plus risque que le rendu Markdown ou
le CLI.

Impact: P2 peut devenir le chemin critique et retarder P3; les tests rapides
peuvent rester verts pendant que la capacite zero-config sur machine sans
navigateur est incomplete.

Suggested architectural correction: isoler le fallback dans un module dedie
derriere l'interface C0 et ajouter un gate P2 specifique "fallback provisioned
from fake catalog + integrity checks" avant toute integration verticale.

Migration risk: moyen.

Test or validation needed: tests fake catalog, cache corrompu, checksum invalide
et absence d'artifact eligible.

#### Finding 4

Severity: Low

Area: Implementation sequencing

Evidence: `package.json` ne contient pas encore `test:contracts`; `src/` et
`tests/` n'existent pas. Le plan exige ces elements en C0.

Problem: aucun defaut de plan, mais le premier commit C0 doit modifier plus que
des types: scripts, dossiers, exports, stubs et tests.

Impact: risque de sous-estimer C0 et de lancer les streams trop tot.

Suggested architectural correction: traiter C0 comme une livraison complete
avec PR/revue propre, pas comme une tache de bootstrap.

Migration risk: faible maintenant, moyen apres divergence des streams.

Test or validation needed: `npm run typecheck` et `npm run test:contracts` verts
avant P1.

### Remediation Plan

1. Ajouter un jalon P0 explicite pour aligner `docs/architecture.md` avec le
   plan avant C0.
2. Definir le chemin et le schema de l'artifact manuel `FR-20`.
3. Ajouter une checklist release versionnee pour les preuves non purement
   automatiques.
4. Isoler le fallback Chromium-for-Testing derriere un module et un gate P2
   dedies.
5. Garder C0 bloque tant que `src/`, `tests/unit/contracts` et
   `npm run test:contracts` ne sont pas verts.

### Open Questions

- Voulez-vous que l'audit suivant porte sur le futur C0 une fois cree, ou sur
  l'alignement immediat de `docs/architecture.md`?

- Le projet accepte-t-il une preuve `FR-20` manuelle par release, ou faut-il
  viser une automatisation partielle en CI privilegiee plus tard?

## Business Logic Audit

### Requirement Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| MVP conversion single-file et batch | Covered by plan | Streams A/B, C0 contracts, P1-P4 gates. |
| Rich Markdown, Mermaid, images, local-only | Covered by plan | Stream B plus tests HTML/PDF/offline. |
| Overwrite protection and exit codes | Covered by plan | Stream A overwrite table, outcomes, formatter errors. |
| Installation `FR-19`/`FR-21` | Covered by plan | User-scope prefix install and double install same tarball. |
| System-scope `FR-20` | Partial | Manual evidence required, but path/gate unspecified. |
| Artifact freshness and integrity | Covered by plan | Newest eligible, checksum, atomic cache, fake catalog tests. |
| Implemented code behavior | Unverifiable | `src/` and `tests/` are absent in the inspected repo. |

### Functional Findings

#### Finding: FR-20 can still pass by paperwork shape instead of behavior

Severity: Medium

Requirement: `FR-20`

File: `docs/implementation_plan_v0.1.1.md`

Line: Not line-numbered in this audit

Problem: the plan asks for a manual proof artifact, but does not define its
location or release gate.

User/business impact: system-scope availability may be claimed without a
repeatable evidence trail.

Suggested fix: define a versioned evidence path and add it to the release
checklist.

Test needed: release checklist or script that fails when the expected evidence
file is absent for `0.1.1`.

#### Finding: C0 evidence is not fully auditable after the fact

Severity: Low

Requirement: C0 contract gate

File: `docs/implementation_plan_v0.1.1.md`

Line: Not line-numbered in this audit

Problem: "red then green" is not preserved unless the team records it.

User/business impact: the team may lose the intended benefit of test-driven
contract design while still believing the plan was followed.

Suggested fix: record the C0 sequence in a short checklist or split the contract
test commit from the implementation commit.

Test needed: not a runtime test; release/process evidence is enough.

#### Finding: No implementation exists to validate product behavior yet

Severity: Low

Requirement: all MVP behavior

File: repository state

Line: Not applicable

Problem: `src/` and `tests/` are absent, so business behavior cannot be audited
against executable code.

User/business impact: the plan is ready to execute, but no user-facing promise
is implemented yet.

Suggested fix: audit again after C0 and after P3 vertical integration.

Test needed: `npm run typecheck`, `npm run test:contracts`, then P3 browser-backed
single-file conversion.

### Unverified Assumptions

- The team will not use `dist/` as a source of truth while recreating `src/`.
- The `FR-20` manual proof will be committed in-repo, not only attached to a PR
  discussion.
- The fallback artifact catalog can be populated with immutable URLs and SHA-256
  checksums for every supported OS.

### Summary

The business intent is now mostly preserved by the plan. The remaining risks are
not conceptual gaps in the MVP; they are evidence gaps around system-scope
install, C0 traceability, and the still-unimplemented codebase.
