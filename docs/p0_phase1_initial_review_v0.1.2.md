# md2pdf - P0 Phase 1 - Cadrage et etat initial

Date: 2026-06-04

Ce document realise la phase 1 du plan P0 v0.1.2. Il fige les sources relues,
l'etat initial constate et la liste des divergences a corriger avant de
demarrer C0. Il ne lance aucun travail applicatif: pas de `src/`, pas de tests
C0, pas de modification de `dist/`.

## 1. Sources relues

Sources autorisees relues pour cadrer P0:

- `docs/project_description.md`
- `docs/project_requirements.md`
- `docs/user_stories.md`
- `docs/architecture.md`
- `docs/ci_matrix_v0.1.md`, uniquement pour les gates de verification
- `ARTIFACT_FRESHNESS_POLICY.md`
- `artifacts.json`
- `audit/2026-06-04-implementation-plan-v0.1.1-new-audit.md`
- `docs/implementation_plan_v0.1.2_P0.md`
- `audit/2026-06-04-implementation-plan-v0.1.2-P0-acceptance-audit.md`

Source de contexte normative pour lever l'ambiguite signalee par l'audit P0:

- `docs/implementation_plan_v0.1.2.md`

Sources exclues pour piloter l'implementation:

- `docs/implementation_plan_v0.1.md`
- `dist/`

## 2. Regle de precedence pour P0

Pour les phases P0 suivantes, la precedence de lecture est:

1. `docs/project_requirements.md`, `docs/user_stories.md`,
   `ARTIFACT_FRESHNESS_POLICY.md` et `artifacts.json` pour les obligations
   produit, local-only et artifacts.
2. `docs/implementation_plan_v0.1.2.md` pour la portee v0.1.2, les contrats C0,
   les gates et les decisions defensives.
3. `docs/implementation_plan_v0.1.2_P0.md` pour l'ordre d'execution documentaire
   de P0.
4. `docs/architecture.md` comme document a aligner, pas comme preuve que P0 est
   deja conforme.
5. `docs/ci_matrix_v0.1.md` uniquement pour les gates et preuves de release.

En cas de contradiction, un requirement ou la politique d'artifacts gagne sur un
plan. Le plan v0.1.2 gagne sur le plan P0 lorsqu'il donne une precision plus
stricte sur les contrats C0 ou les preuves. Le plan P0 gagne seulement pour le
decoupage des livrables documentaires de P0.

## 3. Etat initial constate

| Point verifie | Constat | Impact P0 |
| --- | --- | --- |
| `docs/architecture.md` | Existe. | Doit etre aligne en phase 2. |
| `docs/release-evidence/` | N'existe pas. | Doit etre cree en phases 3 a 5. |
| `src/` | N'existe pas. | Aucun travail C0 n'a commence dans l'arbre source. |
| `dist/` | Existe et contient des sorties generees. | Ne doit pas servir de source de decision. |
| `artifacts.json` | Existe avec `artifacts: []` et des classes planifiees. | Le fallback Chromium-for-Testing n'est pas encore prouve par un catalogue concret. |
| `docs/ci_matrix_v0.1.md` | Existe. | Sert seulement a cadrer les gates et preuves release. |

## 4. Divergences a corriger

### D-01 - Contrats publics C0 insuffisants dans l'architecture

`docs/architecture.md` ne documente pas encore les contrats attendus pour C0:

- `ConvertOptions`
- `ConversionJob`
- `ConversionOutcome`
- `convertFile(...)`

Le plan P0 et le plan parent v0.1.2 ne presentent pas exactement le meme detail:
le P0 associe `options` a `ConversionJob`, tandis que le plan parent ajoute
`originEntry` dans le modele batch. La phase 2 doit rendre cette combinaison
explicite pour eviter deux formes concurrentes du contrat.

Points semantiques a clarifier dans l'architecture:

- comportement d'erreur de `convertFile`;
- relation entre exception unitaire et `ConversionOutcome` de batch;
- garantie qu'aucun PDF partiel n'est ecrit en cas d'echec;
- valeurs par defaut, ou statut volontairement non encore fixe, de
  `renderTimeoutMs`;
- invariants de chemins deja resolus dans `ConversionJob`.

### D-02 - Responsabilites navigateur/artifacts encore melangees

L'architecture actuelle attribue a `BrowserLocator` la detection navigateur, la
resolution de driver et le fallback Chromium-for-Testing. P0 doit separer les
responsabilites suivantes:

- `BrowserLocator`: detecter un navigateur installe et le WebDriver compatible;
- `ReleaseCatalog`: lire et interpreter `artifacts.json`;
- `ArtifactPolicy`: appliquer `newest eligible`, fraicheur, checksum SHA-256 et
  eligibilite;
- `FallbackBrowserProvisioner`: provisionner Chromium-for-Testing uniquement en
  dernier recours.

### D-03 - Fallback Chromium-for-Testing pas assez contraint

`docs/architecture.md` dit que md2pdf peut provisionner Chromium-for-Testing en
dernier recours, mais ne dit pas encore que ce chemin est refuse si:

- l'artifact n'est pas declare dans `artifacts.json`;
- aucune version compatible n'est `newest eligible`;
- le checksum SHA-256 echoue;
- la politique de fraicheur echoue;
- la plateforme n'est pas couverte par le catalogue.

`artifacts.json` ne declare actuellement aucun artifact concret. P0 doit donc
documenter que le fallback est une capacite planifiee et soumise a catalogue,
pas une preuve qu'un navigateur fallback est deja disponible.

### D-04 - Frontiere provisioning reseau / conversion local-only a durcir

Les exigences CON-02 et NFR-02 interdisent tout reseau pendant la conversion.
L'architecture parle de HTML local et d'assets inlines, mais la frontiere doit
etre plus explicite:

- le provisioning peut utiliser le reseau avant conversion pour un driver ou un
  fallback autorise;
- le provisioning ne lit jamais le contenu Markdown;
- la conversion d'un Markdown en PDF est strictement local-only;
- le HTML genere ne contient aucune URL externe exploitable ni CDN;
- le navigateur charge le HTML en `file:` avec assets inlines;
- aucun telechargement n'est autorise pendant le rendu d'un document.

Cette distinction doit aussi apparaitre dans les risques: R-3 doit rester centre
sur le rendu local-only, tandis que le provisioning releve de la politique
d'artifacts.

### D-05 - Preuves release absentes

Le dossier `docs/release-evidence/` n'existe pas. Il manque donc:

- un README de preuves release;
- le template `fr-20-system-scope.md`;
- la checklist `release-checklist-v0.1.2.md`.

La phase 3 a 5 doivent aussi definir le statut attendu en fin de P0 pour les
preuves qui ne peuvent pas encore etre completes avant C0 ou avant la release:
`pending`, `TODO`, `N/A`, ou autre convention explicite.

### D-06 - Preuve FR-20 insuffisamment verifiable

FR-20 exige que l'installation system-scope rende `md2pdf` invocable par chaque
compte utilisateur. L'audit P0 signale que la preuve peut rester trop formelle.
Le template de phase 4 doit donc encadrer au minimum:

- le compte utilisateur secondaire utilise, ou la justification de simulation;
- ce qui rend une simulation acceptable;
- le chemin exact du binaire invoque;
- la sortie de `md2pdf --help`;
- le resultat attendu et observe.

### D-07 - `BrowserNotFoundError` manque de causes distinctes

L'architecture actuelle mentionne l'absence de navigateur utilisable, mais P0
doit documenter des causes observables:

- aucun navigateur installe compatible;
- navigateur detecte mais aucun driver eligible;
- fallback absent de `artifacts.json`;
- fallback present mais refuse par checksum, fraicheur ou plateforme;
- cache/provisioning non utilisable.

### D-08 - Alignement architecture/plan non prouvable sans matrice

Le critere "ne divergent plus" reste trop subjectif sans liste de correspondance.
Les phases suivantes doivent conserver une trace minimale entre:

- contrats C0;
- composants `BrowserLocator`, `ReleaseCatalog`, `ArtifactPolicy`,
  `FallbackBrowserProvisioner`;
- ADR-05;
- risques R-1 et R-3;
- preuves release et checklist.

Cette trace peut vivre dans `docs/architecture.md` ou dans la checklist release,
mais elle doit etre observable par un relecteur.

### D-09 - Limite P0/C0 a rendre observable

P0 est documentaire. Les changements suivants compteraient comme demarrage C0 et
ne doivent pas etre faits avant l'alignement:

- creation ou modification de `src/`;
- creation de tests contractuels C0;
- ajout de scripts `test:contracts`, `test:artifacts` ou exports applicatifs;
- modification du comportement CLI, packaging ou conversion;
- regeneration de `dist/` comme preuve applicative.

Les phases P0 peuvent modifier les documents de cadrage, architecture et preuves
release uniquement.

## 5. Sortie de phase 1

La phase 1 est terminee quand ce document existe et que les phases suivantes
utilisent les divergences ci-dessus comme checklist d'entree:

- phase 2: corriger D-01, D-02, D-03, D-04, D-07 et D-08 dans
  `docs/architecture.md`;
- phase 3: corriger D-05 avec `docs/release-evidence/README.md`;
- phase 4: corriger D-06 avec `docs/release-evidence/fr-20-system-scope.md`;
- phase 5: corriger D-05, D-08 et D-09 avec
  `docs/release-evidence/release-checklist-v0.1.2.md`.
