## Audit du 2026-06-04 - Plan d'implementation v0.1.2

Sources auditees:

- `docs/implementation_plan_v0.1.2.md`
- `docs/project_requirements.md`
- `docs/user_stories.md`
- `docs/architecture.md`

## Acceptance Audit

### Verdict
Ready with minor fixes

Le plan v0.1.2 est assez precis pour guider une implementation MVP, mais il ne
doit pas encore etre execute tel quel sans corriger quelques criteres
contradictoires ou invérifiables. Les problemes restants ne demandent pas de
repenser le produit; ils demandent surtout de verrouiller les gates, les preuves
manuelles et la definition exacte de "local-only".

### Blocking Ambiguities
- **P0 exige `npm run typecheck` alors que le plan declare que `src/` peut etre
  vide.** Le texte prevoit une exception si le depot ne compile pas encore, mais
  le gate reste liste comme commande bloquante. Resultat: l'equipe ne sait pas
  si P0 est valide par une compilation reelle, par une note d'exception, ou par
  une documentation seulement.
- **Le plan demande de "prouver FR-19, FR-20 et FR-21" sans separer preuve
  automatique, preuve manuelle et preuve release.** FR-20 est explicitement une
  demonstration system-scope avec elevation et autre compte utilisateur; ce
  n'est pas equivalent a un test CI. Le format de preuve existe, mais le critere
  d'acceptation du plan ne dit pas quand une preuve partielle bloque la release.
- **"Aucune URL `http:` ou `https:` exploitable" reste trop vague.** Une URL
  dans un bloc de code, un lien Markdown, une image distante, un attribut CSS
  `url(...)`, un SVG inline, ou du texte utilisateur ne doivent pas tous recevoir
  le meme traitement. Sans matrice de cas, le test local-only peut passer tout en
  laissant une surface reseau indirecte.
- **Le comportement des entrees non-Markdown n'est pas fixe.** Les requirements
  definissent une "Markdown source file" en `.md`, mais le plan ne dit pas si un
  fichier existant sans extension `.md` est une `UsageError`, une
  `InputNotFoundError`, ou un skip. Cela affecte les exit codes et les tests de
  batch.

### Missing Edge Cases
- **Symlinks, junctions et chemins normalises.** Le plan couvre les collisions
  textuelles et basename, mais pas deux chemins differents pointant vers le meme
  fichier ou le meme output apres resolution OS.
- **Conflit entre input dossier et output dans ce meme dossier.** Une conversion
  de dossier peut creer des PDFs pendant que l'entree est inspectee. Le plan dit
  que les jobs sont resolus avant rendu, mais ne demande pas de test qui prouve
  que les outputs generes ne deviennent jamais de nouvelles entrees.
- **Images distantes.** Les requirements ne couvrent que les images relatives,
  mais le plan local-only doit preciser si `![x](https://...)` est rendu comme
  texte, supprime, ou transforme en erreur claire.
- **Mermaid invalide.** Le plan exige Mermaid rendu comme diagramme, mais ne
  fixe pas le resultat observable pour une syntaxe Mermaid invalide: erreur de
  conversion, rendu degrade, timeout, ou texte brut interdit.
- **Permissions Windows et chemins `.cmd`.** Le plan mentionne le shim Windows
  pour FR-19/FR-21, mais les cas permission dedies ne couvrent pas les ACL,
  fichiers verrouilles, chemins longs, ni espaces dans les chemins, alors que le
  depot est manifestement utilise sous Windows.

### Untestable Criteria
- Original: "rester local-only pendant la conversion"
  Issue: le plan autorise le provisioning reseau et ne definit pas l'instant
  exact ou la conversion commence.
  Why it blocks validation: un test peut observer du reseau pendant `md2pdf
  notes.md` et l'equipe pourra toujours dire que c'etait du provisioning, pas de
  la conversion.
- Original: "render Mermaid comme diagramme, pas comme texte brut"
  Issue: le test propose "absence du raw Mermaid dans le texte extrait du PDF et
  presence d'un objet image ou vectoriel" est bon, mais il ne couvre pas les
  labels Mermaid, les erreurs de rendu, ni les diagrammes avec texte
  partiellement conserve.
  Why it blocks validation: un rendu incomplet peut passer si le texte brut
  exact n'apparait plus.
- Original: "README verifie contre la liste d'options `--help`"
  Issue: aucune source de verite n'est declaree pour comparer les options.
  Why it blocks validation: le test peut comparer deux textes deja divergents ou
  imposer une duplication fragile.
- Original: "chaque decision defensive a un test ou une documentation
  referencee"
  Issue: "documentation referencee" peut devenir une echappatoire pour une
  decision qui devrait etre testee.
  Why it blocks validation: le critere ne distingue pas une preuve executable
  d'une simple note.

### Scope Risks
- **Le fallback Chromium-for-Testing risque de transformer le MVP en systeme de
  distribution de navigateur.** Le plan le limite au dernier recours, mais il
  ajoute catalogue, checksum, cache atomique, eligibility, purge et tests. C'est
  justifie par NFR-01 seulement si "host sans navigateur" est bien requis pour
  le MVP.
- **Le double support Chromium + Firefox multiplie les surfaces de test.** Les
  requirements demandent portabilite OS, pas deux familles navigateur en MVP.
  Sans priorisation, P2/P3 peuvent gonfler avant qu'un PDF reel soit produit.
- **FR-20 system-scope peut bloquer une release locale pour une preuve
  operationnelle difficile.** Le plan demande une preuve versionnee, mais ne dit
  pas si l'absence temporaire d'environnement admin est un no-go ou un risque
  accepte.

### Open Questions
- P0 peut-il etre accepte avec documentation coherente seulement, ou
  `npm run typecheck` doit-il obligatoirement etre vert des P0?
- Une invocation sans navigateur installe doit-elle zero-configurer via
  Chromium-for-Testing, ou peut-elle echouer clairement en MVP?
- Quel comportement exact faut-il pour les liens et images `http(s)` contenus
  dans le Markdown utilisateur?
- Les fichiers non-`.md` fournis explicitement doivent-ils produire exit `2`
  usage, exit `1` input, ou etre ignores?
- La preuve FR-20 doit-elle etre obligatoire pour chaque release candidate, ou
  seulement pour la release finale?

## Architecture Audit

### Requirement and User Story Compliance
| Requirement / Story | Status | Evidence | Architecture Problem |
| --- | --- | --- | --- |
| US-01 / FR-01 / NFR-01 single-file zero-config | Partially respected | Plan v0.1.2 exige `convertFile`, browser locator et fallback | Zero-config depend d'un navigateur installe ou d'un fallback complexe; le seuil d'acceptation si aucun navigateur n'est present reste ambigu. |
| NFR-02 local-only processing | Partially respected | Plan separe provisioning reseau et conversion local-only | La frontiere est documentaire, pas encore une interface forcee par l'architecture. |
| FR-08 a FR-14 batch/overwrite | Respected | Preflight jobs, collisions, overwrite policy, skips et summaries sont decrits | Risque residuel sur canonicalisation OS et liens symboliques. |
| FR-19 a FR-21 installation | Partially respected | npm bin, packlist, install user-scope, reinstall idempotent, preuve FR-20 | Le provisioning par utilisateur apres install system-scope peut echouer pour chaque compte; le plan ne modele pas cette difference dans l'architecture. |
| NFR-05 artifact freshness | Partially respected | `ArtifactPolicy`, `ReleaseCatalog`, cache atomique et checksum | La policy s'applique aux drivers/fallback, mais pas clairement aux dependances npm et assets inlines deja lockes. |
| FR-24 Mermaid | Respected | Browser-backed Mermaid, attente Mermaid, test PDF dedie | Le comportement d'erreur Mermaid invalide manque. |

### Architecture Problems

#### Finding 1
Severity: High
Area: Local-only boundary
Evidence: Le plan dit que le provisioning peut utiliser le reseau, que la
conversion est local-only depuis un etat pre-provisionne, et que le chemin
principal peut provisionner un driver compatible en cache utilisateur.
Problem: L'architecture ne force pas une separation operationnelle entre
`prepare/provision` et `convert`. Si `convertFile` appelle directement
`BrowserLocator` qui telecharge un driver, une invocation utilisateur standard
peut ouvrir le reseau pendant ce que l'utilisateur et les tests appellent une
conversion.
Impact: NFR-02 peut devenir improuvable ou faux en pratique, surtout pour le
premier run.
Suggested architectural correction: Introduire un contrat explicite en deux
modes: `ensureRuntimeAvailable({ allowNetwork })` et `convertFile(...,
{ networkPolicy: 'offline' })`, ou une interface equivalente. Les tests NFR-02
doivent executer le chemin offline avec cache prepare et echouer si une couche
runtime tente de provisionner.
Migration risk: Moyen; si le provisioning est deja imbrique dans le locator, il
faudra deplacer la responsabilite sans casser le zero-config first run.
Test or validation needed: Test first-run avec provisioning autorise; test
conversion pre-provisionnee avec reseau interdit; test qui verifie que le
contenu Markdown n'est jamais accessible au provisioner.

#### Finding 2
Severity: High
Area: Browser fallback and MVP scope
Evidence: Le plan inclut `FallbackBrowserProvisioner`, Chromium-for-Testing,
catalogue, checksum, cache atomique, non-eligibility, cache corrompu et cache
non writable.
Problem: Le fallback navigateur est traite comme composant MVP complet alors que
l'architecture originale privilegie le navigateur deja installe. Cela ajoute un
second produit interne: distribution securisee d'un runtime navigateur.
Impact: P2 risque d'absorber l'essentiel de l'effort avant la premiere valeur
PDF bout en bout, et les echecs de cache/provisioning peuvent masquer les bugs
de conversion.
Suggested architectural correction: Garder le fallback derriere une interface
petite et facultative pour le MVP: detection installed-browser d'abord,
`BrowserNotFoundError` clair si aucun artifact eligible, puis fallback seulement
comme sous-gate separee. La Definition de fini doit dire si ce fallback est
obligatoire pour finir v0.1.2.
Migration risk: Faible si la frontiere `BrowserLocator` /
`FallbackBrowserProvisioner` reste stricte.
Test or validation needed: Un test qui prouve que le chemin installed-browser ne
depend pas du fallback; un test qui prouve que l'absence de fallback eligible ne
degrade pas les machines avec navigateur installe.

#### Finding 3
Severity: Medium
Area: Shared contracts and stream ownership
Evidence: Stream A possede `errors.ts` "seulement pendant C0 puis sur accord
explicite"; Stream B produit des erreurs render/browser/artifact; C0 fige les
classes d'erreur.
Problem: Les erreurs sont un contrat transversal, mais le plan les met presque
hors d'atteinte apres C0. Les besoins reels de Stream B vont probablement faire
evoluer les contexts (`browserPath`, `driverPath`, `cachePath`, `url`, timeout)
apres la decouverte implementation.
Impact: Soit les streams contournent le contrat par messages stringifies, soit
ils bloquent sur des accords manuels frequents.
Suggested architectural correction: Declarer `errors.ts` comme module commun
avec schema stable minimal et extensions autorisees par champs optionnels
testes. Interdire le parsing de message reste la bonne regle; figer trop tot la
forme exacte ne l'est pas.
Migration risk: Faible maintenant; eleve apres multiplication des tests CLI.
Test or validation needed: Tests de formatage par `kind` et champs contextuels,
pas par classe concrete uniquement.

#### Finding 4
Severity: Medium
Area: Path resolution and preflight
Evidence: Le plan demande collisions d'output, duplicates, output egal source,
parent output cree, dossier non-recursif.
Problem: La resolution preflight n'indique pas si elle compare des chemins
lexicaux, absolus, normalises, case-insensitive selon filesystem, ou
canonicalises via realpath. Sous Windows et avec symlinks, deux jobs peuvent
viser le meme output sans collision textuelle.
Impact: Risque d'ecrasement accidentel malgre la promesse FR-12/FR-14, ou de
comportements differents entre CI Linux et utilisateurs Windows.
Suggested architectural correction: Definir une `PathIdentity` ou une fonction
unique de canonicalisation pour les checks de collision, avec politique OS
explicite. L'utiliser avant toute creation de parent output.
Migration risk: Moyen; la canonicalisation peut changer certains messages et
tests de paths.
Test or validation needed: Tests Windows ou simules pour case-insensitivity,
espaces, chemins relatifs equivalents, et symlink/junction si support CI.

#### Finding 5
Severity: Medium
Area: Artifact policy coverage
Evidence: NFR-05 vise tout artifact ajoute, locke, reference, vendore ou
provisionne; le plan se concentre surtout sur drivers et navigateurs fallback.
Problem: L'architecture ne dit pas comment la policy s'applique aux dependances
npm, au lockfile, aux CSS, aux fonts, au Mermaid engine inline, ni aux assets
generes depuis des packages.
Impact: `npm run check:artifacts` peut donner une fausse confiance: conforme
pour les binaires runtime, incomplet pour les assets qui entrent dans le PDF.
Suggested architectural correction: Ajouter un inventaire par categorie:
non-npm provisionne, npm locke, asset local source, asset derive d'une dependance
npm. Chaque categorie doit avoir une verification ou une justification dans
`artifacts.json` / policy.
Migration risk: Moyen; peut forcer la mise a jour d'`artifacts.json` et du
script de fraicheur.
Test or validation needed: Test policy qui echoue si un asset ou artifact
non-npm packe n'est pas inventorie; doc claire pour les dependances npm.

#### Finding 6
Severity: Low
Area: Release evidence
Evidence: P0 cree `docs/release-evidence/*`; P4 complete checklist et FR-20.
Problem: La preuve release est versionnee mais pas liee a une version/package
immutable. "version md2pdf testee" peut etre renseignee sans hash de tarball,
commit, ou resultat `npm pack --json` associe.
Impact: Une preuve FR-20 peut attester un build different de celui publie.
Suggested architectural correction: Faire du tarball packe ou du commit SHA un
champ obligatoire des preuves release, et lier checklist, packlist et tests au
meme identifiant.
Migration risk: Faible.
Test or validation needed: Script ou checklist qui refuse une preuve sans commit
SHA et nom/version de tarball.

### Remediation Plan
1. Clarifier les gates P0 et C0: commande obligatoire, exception documentee, et
   condition exacte de passage.
2. Definir explicitement les modes reseau: provisioning autorise vs conversion
   offline, puis faire porter cette separation par les interfaces.
3. Decider si Chromium-for-Testing fallback est un must-have de v0.1.2 ou un
   sous-gate optionnel; ajuster la Definition de fini.
4. Ajouter une politique de canonicalisation des chemins et des tests de
   collision adaptes a Windows.
5. Etendre la couverture `ArtifactPolicy` aux categories npm/assets ou documenter
   formellement pourquoi elles sont verifiees ailleurs.
6. Rendre les preuves release liables a un commit et a un tarball precis.

### Open Questions
- Le MVP doit-il fonctionner sur une machine sans aucun navigateur deja
  installe, ou seulement echouer clairement?
- Le first run zero-config peut-il telecharger un driver tout en satisfaisant
  NFR-02, ou faut-il exposer une etape prepare/provision separee?
- Quelle canonicalisation de chemin est attendue sous Windows pour proteger les
  outputs existants?
- Les assets derives de dependances npm doivent-ils apparaitre dans
  `artifacts.json`, ou le lockfile suffit-il comme preuve NFR-05?
