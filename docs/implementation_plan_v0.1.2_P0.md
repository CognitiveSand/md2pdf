# md2pdf - Implementation Plan v0.1.2 - P0

## Objectif P0

Transformer les corrections d'audit en documentation versionnee, coherente et
verifiable avant de demarrer C0. P0 ne doit pas implementer le code applicatif:
il doit verrouiller les contrats, les responsabilites d'architecture et les
preuves release attendues.

P0 est un prerequis bloquant: aucun travail C0 ne doit commencer tant que
`docs/architecture.md` et le plan v0.1.2 divergent.

## Phase 1 - Cadrage et etat initial

### 1.1 Relire les sources autorisees

Sources a utiliser pour aligner P0:

- `docs/project_description.md`
- `docs/project_requirements.md`
- `docs/user_stories.md`
- `docs/architecture.md`
- `docs/ci_matrix_v0.1.md`, uniquement pour les gates de verification
- `ARTIFACT_FRESHNESS_POLICY.md`
- `artifacts.json`
- `audit/2026-06-04-implementation-plan-v0.1.1-new-audit.md`

Sources a ne pas utiliser pour piloter l'implementation:

- `docs/implementation_plan_v0.1.md`
- `dist/`

### 1.2 Verifier l'etat actuel

Constats attendus avant modification:

- `docs/architecture.md` existe mais doit etre aligne sur P0.
- `docs/release-evidence/` n'existe pas encore.
- `dist/` reste une sortie de build, non une source de decision.

### 1.3 Produire la liste des divergences a corriger

La revue initiale doit identifier au minimum:

- contrats publics manquants ou insuffisamment explicites;
- separation navigateur/artifact insuffisamment explicite;
- preuves release absentes;
- frontiere entre provisioning reseau et conversion local-only a clarifier.

## Phase 2 - Mettre a jour `docs/architecture.md`

### 2.1 Ajouter les contrats de conversion attendus

Documenter les types et fonctions qui structureront C0:

```ts
export interface ConvertOptions {
  browserPath?: string;
  renderTimeoutMs?: number;
}

export interface ConversionJob {
  sourcePath: string;
  outputPath: string;
  originEntry: string;
}

export type ConversionStatus = 'success' | 'failed' | 'skipped';

export interface ConversionOutcome extends ConversionJob {
  status: ConversionStatus;
  error?: Md2PdfError;
}

export async function convertFile(
  sourcePath: string,
  outputPath: string,
  options?: ConvertOptions,
): Promise<void>;
```

Clarifications attendues:

- `ConvertOptions` est l'API publique minimale pour une conversion unitaire.
- `ConversionJob` represente une conversion planifiee avec chemins deja resolus
  et entree utilisateur d'origine conservee dans `originEntry`.
- `ConversionOutcome` etend `ConversionJob` et represente le resultat
  exploitable par le batch et le resume stdout.
- `convertFile` est le point d'entree public pour convertir un seul fichier.

### 2.2 Clarifier les responsabilites des modules

Mettre a jour la vue composants pour expliciter les roles suivants:

- `ConversionPipeline`: transforme les entrees CLI en `ConversionJob[]`,
  execute les conversions, continue apres erreur et collecte les
  `ConversionOutcome[]`.
- `DocumentConverter`: orchestre une conversion unitaire via les etapes Markdown,
  HTML local, rendu navigateur et ecriture PDF.
- `BrowserLocator`: trouve un navigateur installe et le WebDriver compatible.
- `ReleaseCatalog`: lit et interprete `artifacts.json`.
- `ArtifactPolicy`: valide l'eligibilite, la fraicheur, le checksum SHA-256 et la
  strategie `newest eligible`.
- `FallbackBrowserProvisioner`: provisionne Chromium-for-Testing seulement en
  dernier recours.

### 2.3 Documenter le fallback Chromium-for-Testing

Ajouter une section claire indiquant que Chromium-for-Testing:

- n'est jamais le chemin principal;
- n'est autorise que s'il est declare dans `artifacts.json`;
- est selectionne selon `newest eligible`;
- est bloque si le checksum SHA-256 ou la politique de fraicheur echoue;
- produit une erreur explicite si aucun artifact eligible n'existe.

Erreur attendue si aucun chemin navigateur n'est disponible:

- `BrowserNotFoundError`;
- cause indiquant l'absence de navigateur installe compatible;
- cause indiquant, si applicable, l'absence d'artifact fallback eligible.

### 2.4 Expliciter la frontiere reseau/local-only

La documentation doit distinguer strictement:

- provisioning: peut utiliser le reseau pour recuperer un driver ou un fallback
  autorise;
- conversion: strictement local-only;
- HTML genere: aucune URL externe, aucun CDN;
- rendu navigateur: chargement en `file:` avec assets inlines;
- aucun telechargement pendant la conversion d'un Markdown en PDF.

Cette frontiere doit apparaitre dans l'architecture et dans les risques.

### 2.5 Mettre a jour les ADR et risques

ADR et risques a ajuster:

- ADR-05 doit refleter la separation `BrowserLocator` / `ArtifactPolicy` /
  `ReleaseCatalog` / `FallbackBrowserProvisioner`.
- R-1 doit mentionner l'echec `BrowserNotFoundError` avec cause "aucun artifact
  eligible".
- R-3 doit rester centre sur l'absence de reseau pendant le rendu, pas sur le
  provisioning.

## Phase 3 - Creer `docs/release-evidence/README.md`

### 3.1 But du dossier

Creer un README expliquant que `docs/release-evidence/` conserve les preuves
versionnees necessaires a une release md2pdf.

### 3.2 Typologie des preuves

Lister les preuves automatiques:

- `npm run typecheck`;
- tests unitaires, contractuels et integration;
- verification packlist npm;
- CI matrix;
- regeneration de `dist/` depuis `src/`.

Lister les preuves manuelles:

- FR-20 system-scope;
- revue des options CLI exposees par `md2pdf --help`;
- revue des decisions defensives;
- logs ou captures necessaires a une preuve release.

### 3.3 Regles de versionnement

Le README doit etablir que:

- toute preuve manuelle doit etre versionnee;
- toute preuve doit mentionner version, date, OS, commande, resultat attendu et
  resultat observe;
- aucune preuve release ne doit dependre d'un fichier genere non tracable;
- les preuves doivent rester lisibles sans contexte externe fragile.

## Phase 4 - Creer `fr-20-system-scope.md`

Creer `docs/release-evidence/fr-20-system-scope.md` avec un template remplissable.

Champs obligatoires:

- version md2pdf testee;
- date;
- OS et version exacte;
- version Node/npm;
- commande system-scope utilisee;
- compte utilisateur secondaire ou simulation documentee;
- chemin du binaire invoque;
- sortie de `md2pdf --help`;
- resultat attendu;
- resultat observe;
- auteur de la preuve.

Le fichier peut rester partiellement "a completer" tant que la release n'est pas
executee, mais sa structure doit etre presente des P0.

## Phase 5 - Creer `release-checklist-v0.1.2.md`

Creer `docs/release-evidence/release-checklist-v0.1.2.md`.

La checklist doit couvrir les points bloquants suivants:

- C0: contrat rouge observe puis gate vert, avec commit/log ou note de preuve;
- presence de `fr-20-system-scope.md`;
- verification packlist npm;
- verification README/options CLI;
- revue des decisions defensives avec reference vers test ou doc;
- confirmation que `dist/` a ete regenere depuis `src/`;
- confirmation que `docs/architecture.md` ne diverge plus du plan v0.1.2.

## Phase 6 - Validation P0

Gate officiel:

```bash
npm run typecheck
```

Si `src/` n'est pas encore compilable, P0 reste acceptable uniquement si:

- `docs/architecture.md` est coherent avec le plan v0.1.2;
- `docs/release-evidence/README.md` existe;
- `docs/release-evidence/fr-20-system-scope.md` existe;
- `docs/release-evidence/release-checklist-v0.1.2.md` existe;
- les limites reseau/provisioning/conversion sont non ambigues;
- aucun travail C0 n'a commence avant cet alignement.

## Definition of Done P0

P0 est termine quand un relecteur peut comprendre, sans lire le futur code:

- quels contrats C0 devra exposer;
- comment le fallback navigateur est autorise ou refuse;
- quelles preuves seront exigees pour la release v0.1.2;
- pourquoi la conversion reste local-only malgre le provisioning eventuel;
- comment verifier que `docs/architecture.md` et le plan v0.1.2 ne divergent
  plus.
