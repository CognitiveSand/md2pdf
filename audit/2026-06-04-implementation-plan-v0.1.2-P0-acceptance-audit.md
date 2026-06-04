# Audit du plan d'implementation v0.1.2 P0

Date: 2026-06-04

Sources auditees:

- `docs/implementation_plan_v0.1.2_P0.md`
- `docs/implementation_plan_v0.1.2.md`
- `docs/project_requirements.md`
- `docs/user_stories.md`
- `docs/architecture.md`
- `docs/ci_matrix_v0.1.md`
- `ARTIFACT_FRESHNESS_POLICY.md`
- `artifacts.json`
- `audit/2026-06-04-implementation-plan-v0.1.1-new-audit.md`

Note de contexte: cet audit juge la qualite d'acceptance du plan P0 lui-meme,
pas l'etat d'une implementation applicative. P0 est presente comme un prerequis
bloquant avant C0; les criteres de validation doivent donc etre observables sans
discussion d'interpretation.

## Acceptance Audit

### Verdict

Not ready

Le plan P0 corrige plusieurs faiblesses de v0.1.1: il donne enfin un emplacement
pour les preuves release, isole `FR-20`, exige l'alignement de
`docs/architecture.md`, et clarifie mieux la frontiere provisioning/conversion.

Il n'est toutefois pas encore pret comme gate bloquant avant C0. Les criteres
centraux restent trop subjectifs ou non prouves: "ne divergent plus", "non
ambigues", "aucun travail C0 n'a commence", et le statut des preuves
partiellement remplies. Un relecteur peut encore valider P0 par impression
generale plutot que par signaux verifiables.

### Blocking Ambiguities

- La cible d'alignement n'est pas assez stricte. L'objectif dit que
  `docs/architecture.md` et le plan v0.1.2 ne doivent plus diverger, mais la
  liste des sources autorisees ne cite pas explicitement
  `docs/implementation_plan_v0.1.2.md`. Elle cite surtout le plan P0 et les
  sources amont. Il manque une hierarchie claire si le P0, le plan v0.1.2,
  l'architecture actuelle et les requirements ne disent pas exactement la meme
  chose.

- "Ne divergent plus" n'a pas de definition de sortie. Le plan demande de
  comprendre comment verifier l'absence de divergence, mais il ne fournit pas de
  matrice ou checklist point par point entre les contrats P0, les composants,
  ADR-05, R-1/R-3 et les preuves release. Une relecture manuelle peut donc
  oublier une ancienne phrase contradictoire dans l'architecture.

- Le statut des fichiers de preuve n'est pas defini. `fr-20-system-scope.md`
  peut rester partiellement "a completer", et la checklist release contient des
  confirmations qui ne seront vraies qu'apres C0 ou la release. Le plan ne dit
  pas quelles cases doivent etre vides, cochees, `N/A`, ou marquees
  "pending" a la fin de P0.

- La frontiere entre P0 documentaire et C0 code reste observable seulement par
  declaration. Le plan interdit de commencer C0 avant l'alignement, mais ne dit
  pas quels changements constituent du C0, ni comment constater l'absence de
  travail C0 dans la PR P0.

- Les contrats TypeScript proposes verrouillent surtout les noms, pas les
  semantiques. `convertFile(...): Promise<void>` ne precise pas le comportement
  d'erreur attendu, l'atomicite de l'ecriture PDF, les valeurs par defaut de
  `renderTimeoutMs`, ni la relation exacte entre une exception de conversion et
  un `ConversionOutcome`.

### Missing Edge Cases

- Alignement documentaire partiel: le plan demande de mettre a jour la vue
  composants, ADR-05 et les risques, mais ne demande pas explicitement de
  supprimer ou corriger toute ancienne phrase incompatible ailleurs dans
  `docs/architecture.md`, par exemple une responsabilite fallback encore portee
  par `BrowserLocator`.

- `BrowserNotFoundError`: le plan exige des causes, mais ne couvre pas le cas
  ou un navigateur est detecte sans driver eligible, ni le cas ou le fallback est
  declare mais refuse pour checksum, fraicheur ou plateforme incompatible.

- Template `FR-20`: le champ "compte utilisateur secondaire ou simulation
  documentee" laisse une echappatoire importante. Le plan ne definit pas ce qui
  rend une simulation acceptable pour prouver une installation system-scope.

- Evidence release: la checklist demande de confirmer que `dist/` a ete
  regenere depuis `src/`, mais P0 peut se terminer avant tout travail C0. Le
  plan ne distingue pas clairement les preuves structurelles creees en P0 des
  preuves factuelles a remplir plus tard.

- Gate `npm run typecheck`: ce gate mesure l'etat TypeScript du repo, pas la
  coherence documentaire P0. Si `src/` n'existe pas ou si le typecheck echoue
  pour une raison hors P0, le plan bascule vers des criteres alternatifs
  manuels, mais sans commande de verification documentaire equivalente.

### Untestable Criteria

- Original: "`docs/architecture.md` est coherent avec le plan v0.1.2"
  Issue: "coherent" n'a pas de liste de correspondance obligatoire.
  Why it blocks validation: deux relecteurs peuvent arriver a des conclusions
  differentes sans aucun fichier ou script pour arbitrer les divergences.

- Original: "les limites reseau/provisioning/conversion sont non ambigues"
  Issue: "non ambigues" decrit une qualite percue, pas un resultat observable.
  Why it blocks validation: le reviewer ne sait pas quelles phrases minimales
  doivent exister ni quelles anciennes formulations doivent disparaitre.

- Original: "aucun travail C0 n'a commence avant cet alignement"
  Issue: le plan ne definit pas les preuves attendues: diff sans `src/`, absence
  de tests C0, commit separe, ou note de revue.
  Why it blocks validation: un changement applicatif discret peut entrer dans P0
  sans signal clair, surtout si `typecheck` est execute dans la meme phase.

- Original: "`fr-20-system-scope.md` peut rester partiellement 'a completer'"
  Issue: aucun seuil minimal de remplissage n'est donne pour P0.
  Why it blocks validation: un fichier vide avec les bons titres pourrait
  satisfaire le texte tout en etant inutile comme future preuve.

- Original: "Gate officiel: `npm run typecheck`"
  Issue: le gate officiel n'est pas aligne avec une phase documentaire, puis le
  plan autorise une voie alternative si `src/` n'est pas compilable.
  Why it blocks validation: P0 peut passer sans gate automatique dedie aux
  livrables P0 et sans preuve que l'echec typecheck est acceptable.

### Scope Risks

- P0 commence a figer des signatures TypeScript avant que les criteres
  d'acceptance applicatifs soient relies a ces signatures. C'est utile pour C0,
  mais risque si les types deviennent normatifs sans definir les erreurs,
  defaults, invariants de chemins et garanties d'ecriture.

- La release evidence peut devenir une collection de templates plutot qu'un
  systeme de preuve. Sans convention de statut, un fichier "a completer" et une
  checklist non remplie donnent une impression de readiness alors que le risque
  est simplement deplace.

- Le fallback Chromium-for-Testing est documente comme dernier recours soumis a
  `artifacts.json`, mais le catalogue actuel ne contient aucun artifact. Si P0
  ne dit pas explicitement que le catalogue concret est hors scope jusqu'a une
  phase ulterieure, un reviewer peut lire la documentation comme une capacite
  deja verrouillee.

- La phrase "sources a ne pas utiliser pour piloter l'implementation" exclut
  `dist/`, ce qui est sain, mais P0 ne dit pas comment traiter les informations
  historiques qui existent seulement dans `dist/` tant que `src/` n'est pas
  disponible. Cela peut creer une zone grise au moment de reconstruire C0.

### Open Questions

- `docs/implementation_plan_v0.1.2.md` est-il une source normative directe pour
  P0, ou seulement le contexte parent du fichier P0?

- Quel format exact prouve l'absence de divergence entre
  `docs/architecture.md` et le plan v0.1.2: checklist, tableau de traceabilite,
  section "alignment notes", ou revue manuelle signee?

- A la fin de P0, quels champs de `fr-20-system-scope.md` doivent deja etre
  remplis, et lesquels doivent explicitement rester `TODO`?

- Quelle convention de statut doit utiliser `release-checklist-v0.1.2.md` pour
  les preuves impossibles avant C0 ou avant la release?

- Qu'est-ce qui compte comme "travail C0 commence": ajout de `src/`, ajout de
  tests contractuels, changement de `package.json`, ou seulement implementation
  applicative non documentaire?

- Quelle forme d'erreur publique est attendue pour `BrowserNotFoundError`:
  classe seule, code stable, message stable, champ `cause`, ou structure
  serialisable par le CLI?
