## Audit du 2026-06-04 - P0 phase 3

Sources auditees:

- `docs/release-evidence/README.md`
- `docs/implementation_plan_v0.1.2_P0.md`
- `docs/p0_phase1_initial_review_v0.1.2.md`
- `docs/architecture.md`

Note de contexte: cet audit juge uniquement la phase 3, c'est-a-dire la creation
du README de `docs/release-evidence/`. Les templates `fr-20-system-scope.md` et
`release-checklist-v0.1.2.md` relevent des phases 4 et 5.

## Acceptance Audit

### Verdict
Ready with minor fixes

La phase 3 satisfait l'essentiel du plan P0: le dossier de preuves a un but
clair, les preuves automatiques et manuelles sont listees, les preuves manuelles
sont imposees en Git, et une convention de statut reduit fortement l'ambiguite
des fichiers partiellement remplis. Les corrections restantes sont mineures mais
importantes pour eviter que les futurs fichiers de preuve passent par forme
plutot que par contenu.

### Blocking Ambiguities
- Aucune ambiguite bloquante pour continuer vers la phase 4.
- **"Every evidence file must include" est plus strict que certains futurs
  fichiers structurels.** Le README impose version, date, commande/procedure,
  expected/observed, status et auteur a tout fichier de preuve. C'est adapte a
  une preuve executee, mais moins net pour un README ou une checklist agregative.
  Sans distinction entre "evidence record" et "evidence governance file", la
  phase 5 peut se demander si la checklist elle-meme doit dupliquer toutes les
  metadonnees de chaque preuve.
- **Le statut `pending` et le statut `blocked` se recouvrent partiellement.**
  `pending` couvre une preuve requise impossible pour l'instant, tandis que
  `blocked` couvre un check impossible faute d'environnement, artifact ou phase
  prealable. Un check P0 impossible parce que `src/` n'existe pas peut etre les
  deux.

### Missing Edge Cases
- **Preuves multi-OS.** Le README demande OS et version exacte "when
  environment-specific", mais la CI matrix exige Linux, macOS et Windows. Il ne
  dit pas si une preuve multi-OS doit etre un fichier par OS, une table unique,
  ou un lien vers une execution CI.
- **Preuves echouees.** Le statut `fail` existe, mais le README ne dit pas si
  une preuve `fail` doit contenir une action corrective, une reference de ticket,
  ou bloquer automatiquement la release.
- **Preuves de commandes non executees en P0.** Le README dit d'utiliser
  `pending` ou `blocked` lorsque `src/` n'existe pas, mais ne demande pas de
  consigner le message observe du gate, par exemple `TS18003`. Cela peut rendre
  l'exception P0 moins auditable.
- **Evidence attachment format.** Le README autorise logs, terminal output,
  screenshots ou notes, mais ne precise pas les formats acceptables ni ou placer
  les captures binaires si elles existent.

### Untestable Criteria
- Original: "Evidence kept here must be readable from the repository alone"
  Issue: "readable" n'a pas de seuil observable.
  Why it blocks validation: un reviewer peut accepter une preuve trop vague
  parce qu'elle est techniquement dans le repo. Il manque une condition minimale:
  commande/procedure, expected, observed, status, auteur, et lien commit/tarball
  quand disponible.
- Original: "Automatic evidence should capture the command, environment,
  expected result, and observed result"
  Issue: "should" affaiblit un critere que le plan P0 presente comme une regle
  de preuve.
  Why it blocks validation: une preuve automatique peut omettre l'environnement
  ou le resultat observe sans violer explicitement le README.
- Original: "`n/a` is explicitly not applicable, with a documented reason"
  Issue: le README ne dit pas ce qui rend une raison `n/a` acceptable.
  Why it blocks validation: `n/a` peut devenir une echappatoire pour une preuve
  difficile, notamment FR-20 ou browser-backed tests.

### Scope Risks
- **La phase 3 anticipe des preuves release-candidate.** Ajouter commit SHA et
  tarball est utile, mais P0 ne peut pas encore les remplir. Si la phase 5 ne
  distingue pas clairement structure P0 et preuve P4, la checklist peut sembler
  incomplete alors qu'elle est correctement `pending`.
- **Les preuves automatiques sont listees mais pas mappees aux gates.**
  `npm run typecheck`, tests, packlist et CI matrix sont mentionnes, mais le
  README ne dit pas quelle phase ou checklist portera chaque commande. Le risque
  est une duplication entre README, checklist release et CI docs.
- **La notion de preuve manuelle reste large.** "logs, terminal output,
  screenshots, or notes" peut autoriser des preuves heterogenes difficiles a
  comparer d'une release a l'autre.

### Open Questions
- La checklist phase 5 doit-elle avoir ses propres metadonnees globales, ou
  repeter les metadonnees pour chaque preuve referencee?
- Quand `src/` n'existe pas, le statut attendu pour `npm run typecheck` est-il
  `pending` ou `blocked`?
- Une preuve `fail` doit-elle obligatoirement bloquer la release jusqu'a une
  preuve `pass`, ou peut-elle coexister comme historique?
- Quels formats de logs/captures sont acceptes dans `docs/release-evidence/`?
- Le statut `n/a` doit-il etre interdit pour les preuves Must/MVP, sauf raison
  approuvee explicitement?
