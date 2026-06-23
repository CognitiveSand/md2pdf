## Audit du 2026-06-04 - P0 phase 4

Sources auditees:

- `docs/release-evidence/fr-20-system-scope.md`
- `docs/release-evidence/README.md`
- `docs/implementation_plan_v0.1.2_P0.md`
- `docs/project_requirements.md`
- `docs/user_stories.md`
- `docs/architecture.md`

Note de contexte: cet audit juge uniquement la phase 4, c'est-a-dire le template
de preuve `FR-20` system-scope. La preuve peut rester `pending` en P0; l'audit
porte donc sur la capacite du template a produire une preuve exploitable plus
tard.

## Acceptance Audit

### Verdict
Ready with minor fixes

La phase 4 respecte le plan P0: le fichier existe, il est remplissable, tous les
champs obligatoires sont presents, et les champs non executables avant release
sont explicitement marques `pending`. La structure est suffisante pour passer a
la phase 5. Les corrections recommandees portent sur la force probante de
FR-20: prouver une commande system-scope disponible sur le PATH de chaque compte,
pas seulement un binaire executable par chemin absolu.

### Blocking Ambiguities
- Aucune ambiguite bloquante pour continuer vers la phase 5.
- **Invocation par chemin absolu vs disponibilite sur le PATH.** Le template
  demande le chemin du binaire invoque et autorise une commande par chemin
  absolu. Or FR-20 et la definition de system-scope portent sur une commande
  disponible pour les comptes utilisateurs. Une preuve par chemin absolu peut
  montrer que le fichier existe sans prouver que `md2pdf` est invocable depuis le
  PATH du compte teste.
- **Simulation acceptable encore trop large.** Le template dit qu'une simulation
  doit prouver le meme contrat observable, mais ne dit pas quels signaux rendent
  cette simulation suffisante: compte non administrateur, environnement separe,
  PATH herite ou reconstruit, absence de dependance au profil de l'installateur.

### Missing Edge Cases
- **Shim Windows vs binaire POSIX.** Le template demande le chemin du binaire,
  mais ne force pas a distinguer `md2pdf.cmd` sous Windows du shim POSIX sous
  Linux/macOS. Cette difference etait deja identifiee comme risque pour les
  preuves d'installation.
- **Compte secondaire sans droits admin.** Le template parle de compte
  secondaire, mais ne demande pas de noter si ce compte est administrateur ou
  utilisateur standard. Pour FR-20, un compte standard est une meilleure preuve.
- **PATH du compte teste.** Le template ne demande pas la valeur ou l'origine du
  PATH observe. Sans cela, une invocation reussie peut venir d'une variable
  preparee manuellement pour le test.
- **Echec attendu/observe.** Le template prevoit deviations et exit status, mais
  ne demande pas de joindre le stderr en cas d'echec. Une preuve `fail` serait
  moins diagnostiquable.
- **Plusieurs comptes.** FR-20 dit "each user account"; le template couvre un
  compte secondaire ou une simulation. C'est probablement acceptable comme
  preuve manuelle pragmatique, mais le critere de selection du compte teste n'est
  pas documente.

### Untestable Criteria
- Original: "the system-scope binary is on the invoked account's PATH"
  Issue: le template permet ensuite une invocation par chemin absolu.
  Why it blocks validation: une commande absolue ne prouve pas l'invocabilite de
  `md2pdf` par nom depuis le compte teste.
- Original: "Simulation used instead of secondary account"
  Issue: aucune definition minimale d'une simulation valide n'est fournie.
  Why it blocks validation: une simulation peut devenir une simple execution dans
  le meme compte avec un PATH modifie, ce qui ne prouve pas FR-20.
- Original: "The help output lists the supported md2pdf CLI options"
  Issue: le template ne dit pas quelle source de verite permet de juger que les
  options listees sont completes.
  Why it blocks validation: un reviewer peut valider une sortie `--help` qui
  s'affiche mais qui omet une option attendue.

### Scope Risks
- **La preuve FR-20 peut devenir plus stricte que ce que l'equipe pourra
  executer localement.** Tester un system-scope install avec compte secondaire
  demande elevation et controle utilisateur. La convention `pending` aide, mais
  la phase 5 doit clarifier si une preuve `blocked` interdit la release.
- **Le template peut prouver l'existence du binaire plutot que l'installation
  system-scope.** Le champ "Installed binary path invoked" est utile, mais il ne
  suffit pas a prouver que chaque compte peut lancer `md2pdf`.
- **La preuve `--help` peut dupliquer la future verification README/options.**
  Phase 4 capture la sortie help; phase 5 demandera une verification
  README/options CLI. Sans lien explicite, les deux preuves peuvent diverger.

### Open Questions
- La preuve FR-20 doit-elle obligatoirement inclure une invocation par nom
  (`md2pdf --help`) depuis le compte teste, en plus d'un chemin absolu eventuel?
- Quel est le minimum acceptable pour une simulation FR-20?
- Le compte secondaire doit-il etre un compte standard sans droits admin?
- Faut-il enregistrer le PATH du compte teste ou au moins le resultat de
  resolution du binaire (`where md2pdf`, `which md2pdf`, equivalent OS)?
- Une preuve FR-20 `blocked` peut-elle coexister avec une release candidate, ou
  bloque-t-elle toujours la release finale?

## Architecture Audit

### Requirement and User Story Compliance
| Requirement / Story | Status | Evidence | Architecture Problem |
| --- | --- | --- | --- |
| FR-20 system-scope availability | Partially respected | Template avec installation command, compte secondaire/simulation, binaire invoque, sortie `md2pdf --help`, expected/observed. | La preuve peut passer par chemin absolu et ne garantit pas encore que la commande est sur le PATH du compte teste. |
| P0 phase 4 template required fields | Respected | Tous les champs obligatoires du plan P0 sont presents et non vides grace a `pending`. | Aucun probleme structurel bloquant. |
| Release evidence versioning | Respected | Le template inclut version, commit SHA, tarball/source, date, auteur et statut. | La liaison au tarball reste `pending` jusqu'a P4, ce qui est normal. |
| Manual evidence readability | Partially respected | Sections metadata, environment, install, account, command, help output, expected/observed. | Le format de simulation et la preuve PATH ne sont pas assez normatifs. |
| Architecture install model | Partially respected | Architecture dit que l'installation system-shared place l'entree `md2pdf` sur le PATH de chaque compte. | Le template ne force pas la preuve de cette assertion precise. |

### Architecture Problems

#### Finding 1
Severity: Medium
Area: FR-20 proof boundary
Evidence: `fr-20-system-scope.md` autorise une commande par chemin absolu si le
chemin du binaire est renseigne.
Problem: une invocation absolue contourne le point architectural de FR-20:
system-scope signifie que la commande `md2pdf` est disponible pour le compte
utilisateur, pas seulement qu'un executable existe quelque part.
Impact: une release peut contenir une preuve FR-20 qui ne detecte pas un PATH
mal installe.
Suggested architectural correction: exiger deux preuves separees: resolution par
nom depuis le compte teste (`where md2pdf` / `which md2pdf` ou equivalent) puis
execution `md2pdf --help`. Garder le chemin absolu comme information de
diagnostic, pas comme commande principale de validation.
Migration risk: faible; le template peut etre ajuste sans impact code.
Test or validation needed: checklist phase 5 qui refuse FR-20 si la commande par
nom n'est pas prouvee.

#### Finding 2
Severity: Medium
Area: Simulation validity
Evidence: le template accepte une simulation si elle documente pourquoi le compte
secondaire est indisponible et prouve le meme contrat observable.
Problem: "meme contrat observable" n'est pas assez contraignant. Un test dans le
compte installateur avec un PATH modifie pourrait etre presente comme simulation.
Impact: la preuve system-scope peut devenir une demonstration locale faible,
incapable de detecter des problemes par compte.
Suggested architectural correction: definir les criteres minimaux de simulation:
environnement de processus separe, PATH representatif du compte cible, resolution
du binaire par nom, et justification de l'absence de compte reel.
Migration risk: faible.
Test or validation needed: revue manuelle phase 5 avec statut `blocked` si ces
criteres ne sont pas remplis.

#### Finding 3
Severity: Low
Area: Cross-platform evidence
Evidence: le template capture OS, shell et binaire, mais ne distingue pas les
shims attendus par OS.
Problem: la preuve FR-20 peut etre difficile a comparer entre Windows
(`md2pdf.cmd`) et POSIX (`md2pdf`) si le format de resolution du binaire n'est
pas explicite.
Impact: risque de preuve Windows incomplete, surtout pour npm global installs.
Suggested architectural correction: ajouter des indications par OS dans le
template ou la checklist: Windows `where md2pdf` / `md2pdf.cmd`, POSIX `command
-v md2pdf` / `which md2pdf`.
Migration risk: faible.
Test or validation needed: preuve FR-20 finale sur l'OS cible avec commande de
resolution adaptee.

### Remediation Plan
1. Faire de `md2pdf --help` par nom la commande principale obligatoire de la
   preuve FR-20.
2. Garder le chemin absolu du binaire comme resultat de resolution, pas comme
   substitut a la preuve PATH.
3. Definir les criteres minimaux d'une simulation acceptable.
4. Ajouter dans la phase 5 une verification explicite de presence et de statut
   du fichier FR-20.
5. Preciser les commandes de resolution du binaire par OS dans le template ou la
   checklist.

### Open Questions
- Voulez-vous corriger le template phase 4 maintenant ou laisser la phase 5
  checklist porter ces contraintes?
- La preuve FR-20 doit-elle etre executee sur chaque OS de la matrice ou sur un
  seul OS representatif avec note de risque?
- Quelle commande de resolution du binaire doit etre normative sous Windows:
  `where md2pdf`, inspection du shim npm, ou les deux?
