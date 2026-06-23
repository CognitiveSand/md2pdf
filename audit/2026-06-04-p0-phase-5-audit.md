## Audit du 2026-06-04 - P0 phase 5

Sources auditees:

- `docs/release-evidence/release-checklist-v0.1.2.md`
- `docs/release-evidence/README.md`
- `docs/release-evidence/fr-20-system-scope.md`
- `docs/implementation_plan_v0.1.2_P0.md`
- `docs/implementation_plan_v0.1.2.md`
- `docs/architecture.md`
- audits P0 precedents dans `audit.md`

Note de contexte: cet audit juge la checklist creee en phase 5. Il ne juge pas
la completion factuelle des preuves release, qui est attendue plus tard en C0,
P4 ou release candidate.

## Acceptance Audit

### Verdict
Ready with minor fixes

La phase 5 satisfait le plan P0: le fichier attendu existe et couvre C0
rouge/vert, FR-20, packlist npm, README/options, decisions defensives, `dist/`
regenere depuis `src`, et alignement architecture/plan. La checklist integre
aussi les corrections issues des audits precedents, notamment `ConversionOutcome
extends ConversionJob`, la preuve FR-20 par resolution de commande sur le PATH,
et le scope check P0/no-C0. Elle est prete a servir de livrable P0, mais il
reste quelques criteres d'acceptation a durcir avant qu'elle puisse servir de
gate release sans discussion.

### Blocking Ambiguities
- Aucune ambiguite bloquante pour terminer P0 ou passer a la validation P0.
- **L'autorite qui peut "explicitly accept" un item bloquant n'est pas definie.**
  La checklist dit qu'un item `pending`, `fail` ou `blocked` rend la release non
  prete sauf si la raison est explicitement acceptee. Elle ne dit pas qui peut
  accepter, ou cette acceptation est enregistree, ni si certains items Must/MVP
  sont non-waivables.
- **La difference entre checklist P0 et checklist release reste implicite.** Le
  fichier porte `Status: pending` et beaucoup d'items attendus apres C0/P4, mais
  P0 veut seulement creer la structure. Un reviewer peut hesiter entre "phase 5
  terminee" et "release non prete", car les deux etats vivent dans le meme
  document.
- **"Remaining architecture audit questions resolved or accepted" est trop
  large.** La checklist pointe vers des audits entiers sans enumerer quelles
  questions doivent etre resolues avant C0, lesquelles peuvent attendre P1/P2,
  et qui peut les accepter.

### Missing Edge Cases
- **Items non-waivables.** La checklist ne marque pas les preuves qui ne peuvent
  jamais etre `n/a` ou acceptees en exception pour une release finale: FR-20,
  packlist, artifact freshness, typecheck, tests obligatoires.
- **Preuve de `git status --short`.** Le scope check demande `git status --short`
  ou resume de diff, mais ne dit pas si les fichiers P0/audit non suivis doivent
  etre acceptes explicitement ou ajoutes avant validation.
- **CI matrix partielle.** La checklist exige Linux/macOS/Windows, mais ne dit
  pas comment traiter une matrice partielle ou un OS temporairement indisponible.
- **Resolution des audits precedents.** La checklist reference `audit.md`, mais
  ne distingue pas les findings deja corriges, encore ouverts, acceptes comme
  risque, ou reportes a C0/P2.
- **Typecheck P0 bloque vs release typecheck.** Le P0 gate est `blocked` avec
  TS18003, tandis que le release gate typecheck est `pending`. C'est correct,
  mais la checklist ne dit pas que le `blocked` P0 est acceptable seulement pour
  P0, jamais pour C0/release.

### Untestable Criteria
- Original: "unless the reason is explicitly accepted in this checklist"
  Issue: aucune forme ni autorite d'acceptation n'est definie.
  Why it blocks validation: un reviewer peut accepter oralement ou implicitement
  un blocage sans trace auditable.
- Original: "`docs/architecture.md` no longer diverges from plan v0.1.2"
  Issue: le critere demande un reviewer sign-off, mais pas une liste d'items a
  cocher ni une trace des divergences fermees.
  Why it blocks validation: deux reviewers peuvent signer avec des standards
  differents.
- Original: "Remaining architecture audit questions resolved or accepted"
  Issue: "remaining" depend de la lecture manuelle de tout `audit.md`.
  Why it blocks validation: impossible de verifier automatiquement ou rapidement
  quelles questions bloquent encore C0.

### Scope Risks
- **La checklist devient un substitut de gestion de release.** Elle contient P0,
  C0, P4, CI, release decision, audits et decisions defensives. C'est utile pour
  une petite release, mais elle peut devenir lourde si elle n'a pas de regles de
  cloture par phase.
- **Les statuts `pass` en architecture peuvent masquer des questions ouvertes.**
  Les lignes d'architecture sont marquees `pass`, mais une autre ligne dit que
  des questions d'audit restent `pending`. Sans granularite par finding, un
  lecteur peut croire que l'architecture est totalement fermee.
- **Les preuves futures dependent encore de conventions humaines.** Les preuves
  FR-20, README/options, decisions defensives et audits ont des cases, mais pas
  encore de format strict de piece jointe ou de sign-off.

### Open Questions
- Qui peut accepter une exception sur un item `blocked`, `pending`, `fail` ou
  `n/a`?
- Quels items sont non-waivables pour la release finale?
- La checklist doit-elle avoir une section "P0 completion decision" distincte
  de "Final release decision"?
- Faut-il convertir les findings ouverts de `audit.md` en lignes dediees dans la
  checklist avant C0?
- Le `blocked` du gate P0 avec TS18003 doit-il etre marque `pass with exception`
  ou rester `blocked` jusqu'a C0?

## Architecture Audit

### Requirement and User Story Compliance
| Requirement / Story | Status | Evidence | Architecture Problem |
| --- | --- | --- | --- |
| P0 phase 5 required checklist file | Respected | `docs/release-evidence/release-checklist-v0.1.2.md` existe. | Aucun probleme bloquant. |
| C0 red then green evidence | Respected | Section "C0 Contract Trace" avec red state, green gate, `ConversionOutcome`, erreurs. | L'autorite de validation du log/note n'est pas definie. |
| FR-20 evidence | Respected | Section FR-20 exige fichier, resolution par nom, `md2pdf --help`, compte secondaire/simulation. | Bonne correction du risque chemin absolu, mais FR-20 completion reste future. |
| Packlist and distribution | Respected | Section Packaging exige `dist/` regenere, `npm pack --json`, user-scope install, reinstall. | Pas de mapping exact vers commit/tarball tant que release candidate absente. |
| README/options CLI | Respected | Section README And CLI Options couvre help, README match, FR-20 help. | Source de verite CLI finale reste a etablir en C0/Stream A. |
| Defensive decisions | Partially respected | Tableau liste decisions defensives majeures du plan v0.1.2. | Les findings d'audit ouverts ne sont pas decomposes en items actionnables. |
| Architecture alignment | Partially respected | Plusieurs items `pass`, plus une ligne pending pour questions d'audit. | Le statut global depend d'un pointeur large vers `audit.md`, pas d'une trace par divergence. |

### Architecture Problems

#### Finding 1
Severity: Medium
Area: Release gate authority
Evidence: la checklist permet qu'un item `pending`, `fail` ou `blocked` soit
explicitement accepte, mais ne definit pas l'autorite ni la forme de cette
acceptation.
Problem: le gate release depend d'une decision humaine non modelisee. Cela
affaiblit les garanties de preuves versionnees mises en place par P0.
Impact: une release peut passer avec un item bloquant accepte sans trace claire,
ou etre bloquee par des interpretations differentes.
Suggested architectural correction: ajouter une convention d'acceptation:
approver, date, raison, item concerne, portee P0/C0/release, et interdiction
d'accepter certains Must/MVP.
Migration risk: faible; modification documentaire uniquement.
Test or validation needed: checklist phase 5 avec champs d'acceptation explicites
ou section "Accepted exceptions".

#### Finding 2
Severity: Medium
Area: Phase boundary
Evidence: la meme checklist sert a la structure P0, aux gates C0, a P4 et a la
decision release finale.
Problem: la checklist ne separe pas clairement "phase 5 livree" de "release
prete". Le statut global `pending` est correct pour la release, mais peu
informatif pour valider P0.
Impact: un reviewer peut considerer P0 non termine parce que la checklist est
majoritairement `pending`, alors que ces `pending` sont normaux avant C0/P4.
Suggested architectural correction: ajouter un bloc "P0 checklist creation
status" ou une decision P0 distincte qui valide uniquement l'existence et la
structure des preuves.
Migration risk: faible.
Test or validation needed: revue P0 qui verifie les fichiers attendus et le
scope no-C0 sans exiger les preuves release futures.

#### Finding 3
Severity: Medium
Area: Audit finding traceability
Evidence: la checklist contient "Remaining architecture audit questions resolved
or accepted" avec reference globale a `audit.md`.
Problem: les audits appendes deviennent une source longue et cumulative. Une
reference globale ne donne pas de graphe clair des findings ouverts/fermes.
Impact: C0 peut demarrer avec un finding important oublie, ou au contraire etre
bloque par un ancien finding deja corrige.
Suggested architectural correction: transformer les findings ouverts qui
bloquent C0 en lignes dediees de checklist, avec statut et resolution attendue.
Migration risk: faible maintenant, moyen si les audits continuent a grossir.
Test or validation needed: checklist d'audit findings avec IDs ou titres stables.

#### Finding 4
Severity: Low
Area: Evidence immutability
Evidence: la checklist a des champs commit SHA et npm tarball/source `pending`,
mais plusieurs sections futures peuvent etre cochees sans rappeler ce meme
identifiant.
Problem: les preuves individuelles peuvent referencer des executions
legerement differentes si le commit/tarball global n'est pas propage.
Impact: risque de release evidence coherente en apparence mais composee de runs
sur differents builds.
Suggested architectural correction: exiger que chaque preuve finale reference le
commit SHA ou tarball de la checklist, ou declare explicitement une exception.
Migration risk: faible.
Test or validation needed: revue finale qui compare commit/tarball sur FR-20,
packlist, tests et CI.

### Remediation Plan
1. Ajouter une section "P0 completion decision" distincte de la decision release
   finale.
2. Definir une section "Accepted exceptions" avec approver, date, raison et
   items non-waivables.
3. Decomposer les findings d'audit ouverts en lignes de checklist avant C0.
4. Marquer clairement les items non-waivables pour la release finale.
5. Faire propager commit SHA / tarball dans les preuves finales, pas seulement
   dans les metadonnees globales.

### Open Questions
- Souhaitez-vous corriger ces points dans la checklist avant la validation P0,
  ou les traiter comme conditions de phase 6?
- Qui est l'approver attendu pour accepter une exception release?
- Les gates typecheck, artifact freshness, FR-20 et packlist peuvent-ils avoir
  une exception, ou sont-ils strictement non-waivables?
