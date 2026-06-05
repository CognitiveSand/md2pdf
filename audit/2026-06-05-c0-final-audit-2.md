# Deuxieme audit final C0 - passage aux streams

Date: 2026-06-05

Verdict: **GO pour sortir de C0 et ouvrir les streams P1**.

Decision release: **NO-GO release**. Les preuves release/P4 restent
volontairement `pending` et ne doivent pas etre confondues avec le gate C0.

## Sources utilisees

- `docs/implementation_plan_v0.1.2.md`
- `docs/implementation_plan_v0.1.2_P0.md`
- `docs/plan_c0.md`
- `docs/plan_stream_a.md`
- `docs/plan_stream_b.md`
- `docs/release-evidence/release-checklist-v0.1.2.md`
- `audit/audit-c0-etape1.md`
- `audit/audit-c0-etape2.md`
- `audit/audit-c0-etape3.md`
- `audit/audit-c0-post-corrections-etape3.md`
- `audit/audit-c0-etape4.md`
- `audit/audit-c0-etape5-6.md`
- `audit/audi-c0-final(inclut etape 5,6,7).md`
- `src/errors.ts`
- `src/contracts.ts`
- `src/artifactPolicy.ts`
- `src/fallbackBrowserProvisioner.ts`
- `tests/unit/contracts/contracts.test.ts`
- `package.json`

Synthese agents:

- Agent exigences: GO streams, confiance elevee, anciens blocages C0 resolus.
- Agent code/tests: C0 termine au sens strict du gate, avec deux durcissements
  recommandes.
- Agent documentation/preuves: PASS C0 / GO streams, mais NO-GO release.

## Critere de decision C0

Le plan C0 etablit explicitement que C0 est un gate avant separation des
streams: `docs/plan_c0.md:5`.

Gate officiel C0:

```bash
npm run typecheck
npm run test:contracts
```

Reference: `docs/plan_c0.md:79` et `docs/plan_c0.md:80`.

La trace rouge puis vert est aussi exigee par C0:

- objectif test rouge puis vert: `docs/plan_c0.md:59`;
- trace a noter en checklist: `docs/plan_c0.md:69` a `docs/plan_c0.md:71`.

La checklist actuelle marque cette preuve comme resolue:

- red state: `docs/release-evidence/release-checklist-v0.1.2.md:54`;
- green gate: `docs/release-evidence/release-checklist-v0.1.2.md:55`.

## Verification executee

Etat du depot avant creation de ce rapport:

```text
git status --short
```

Resultat observe: sortie vide, aucun changement suivi avant l'audit.

Commandes executees le 2026-06-05:

```bash
npm.cmd run typecheck
```

Resultat observe: `tsc --noEmit` termine en exit `0`.

```bash
npm.cmd run test:contracts
```

Resultat observe: `1 passed`, `11 passed`, exit `0`.

Note Windows: `npm.cmd` a ete utilise pour eviter les problemes PowerShell /
ExecutionPolicy et les echecs de demarrage sandbox observes hier.

## Matrice de conformite C0

| Exigence C0 | Statut | Preuve | Commentaire |
| --- | --- | --- | --- |
| Hierarchie d'erreurs partagees | PASS | `src/errors.ts`; `tests/unit/contracts/contracts.test.ts` | Exports importables et `formatError` teste. |
| `formatError` centralise | PASS | `src/errors.ts:80`; tests erreurs | Produit `kind`, message, chemins, artifact, hint et cause. |
| `ConvertOptions` / `convertFile` | PASS | `src/contracts.ts:8` | Stub lance `NotImplementedError` avec chemins. |
| `ConversionJob` | PASS | `src/contracts.ts:22` | Champs `sourcePath`, `outputPath`, `originEntry`. |
| `ConversionOutcome extends ConversionJob` | PASS | `src/contracts.ts:30` | Test d'instanciation present. |
| `ArtifactPolicy.selectNewestEligible` | PASS avec reserve | `src/artifactPolicy.ts:20`; tests a partir de `tests/unit/contracts/contracts.test.ts:107` | Strategie couverte, mais un cas de parsing version reste ambigu. |
| `FallbackBrowserProvisioner` interface/stub | PASS | `src/fallbackBrowserProvisioner.ts:9` | Stub `NotImplementedError` teste. |
| Script `test:contracts` | PASS | `package.json:39` | Commande existe et passe. |
| Gate typecheck | PASS | execution du 2026-06-05 | `npm.cmd run typecheck` exit `0`. |
| Gate contracts | PASS | execution du 2026-06-05 | `npm.cmd run test:contracts`, 11 tests OK. |
| Trace rouge puis vert | PASS | checklist lignes 54-55 | Ancien blocage de l'audit etape 5-6 resolu. |

## Findings

### Finding 1 - Regle de version compatible legerement ambigue

Severity: Medium

Fichier: `src/artifactPolicy.ts`

Probleme: le plan C0 dit que `compatibleWith` compare un major normalise quand
la release et la contrainte commencent par un numero. L'implementation actuelle
considere numerique seulement une version dont les premiers chiffres sont suivis
par `.`, `-` ou la fin de chaine. Un libelle comme `119beta` commence par un
numero au sens litteral du plan, mais tomberait en comparaison exacte.

Risque: Stream B pourrait figer une interpretation differente de la policy
artifact pendant P1/P2, puis devoir corriger plus tard des tests ou catalogues.

Impact sur decision streams: non bloquant pour ouvrir P1, car le gate C0 passe
et les cas de version standard sont couverts. A clarifier ou tester avant de
figer l'implementation artifact de Stream B.

Correction suggeree: soit preciser dans le plan/architecture que le major
normalise exige un separateur semver-like, soit etendre `majorVersion` et ajouter
un test pour un label numerique non standard.

### Finding 2 - Les tests ne prouvent pas tous les `kind` d'erreur

Severity: Medium

Fichier: `tests/unit/contracts/contracts.test.ts`

Probleme: les tests prouvent que toutes les classes d'erreur sont importables,
mais n'instancient pas toutes les classes pour verifier que chaque `kind`
contractuel est stable (`input`, `render`, `browser`, etc.).

Risque: les streams vont s'appuyer sur ces `kind` pour les erreurs CLI,
conversion, render et browser. Une regression d'un constructeur pourrait passer
si elle preserve seulement l'import.

Impact sur decision streams: non bloquant pour ouvrir P1, mais a durcir avant
que Stream A et Stream B dependent fortement de ces erreurs.

Correction suggeree: ajouter une table de tests qui instancie chaque classe
d'erreur et verifie `kind`, `context.kind`, `message`, et `toJSON()`.

### Finding 3 - Version package incoherente avec les preuves v0.1.2

Severity: Low

Fichier: `package.json`

Probleme: `package.json:3` indique encore `0.1.1`, tandis que la checklist
release cible `0.1.2` a `docs/release-evidence/release-checklist-v0.1.2.md:20`.

Risque: confusion dans les preuves release, les tarballs et les installations
system-scope.

Impact sur decision streams: non bloquant pour C0/P1. Bloquant avant release ou
packaging final.

Correction suggeree: synchroniser la version package au moment defini par le
workflow release, et capturer le commit SHA encore `pending` dans la checklist.

### Finding 4 - Les preuves release restent volontairement incompletes

Severity: Low pour C0, High pour release

Fichier: `docs/release-evidence/release-checklist-v0.1.2.md`

Probleme: les gates release, FR-20, packlist, `dist/` regenere, README/help et
CI restent `pending` ou `blocked`. Exemples: checklist lignes 63, 65 et section
packaging.

Risque: si le verdict GO C0 est lu comme un GO release, il masque des preuves
encore absentes.

Impact sur decision streams: non bloquant. Le plan v0.1.2 place ces preuves
dans P3/P4 ou release candidate, pas dans le gate C0.

Correction suggeree: conserver ce rapport comme decision C0 uniquement, puis
ouvrir des tickets Stream A/B ou P4 pour completer ces preuves.

## Decision

C0 est **accepte** pour ouvrir les streams.

Raisons:

- le gate C0 officiel est vert au 2026-06-05;
- les contrats communs requis existent;
- les stubs C0 lancent `NotImplementedError`;
- les tests contractuels importent et exercent le squelette commun;
- la trace rouge puis vert, ancien bloquant, est maintenant marquee `pass`;
- les reserves restantes sont des durcissements P1/P2/P4, pas des no-go C0.

Conditions de passage recommandees:

- Stream A et Stream B peuvent demarrer P1.
- Ne pas modifier `src/errors.ts`, `src/contracts.ts`, `src/artifactPolicy.ts`
  ou `src/fallbackBrowserProvisioner.ts` sans annoncer l'impact aux deux
  streams.
- Ajouter rapidement les tests de `kind` d'erreurs et clarifier la regle de
  version artifact avant les travaux profonds de Stream B.
- Ne pas utiliser ce GO comme preuve release: la release reste `pending`.

## Verdict final

**GO C0 -> Streams P1.**

Confiance: elevee.

Reserve principale: le passage est valide pour demarrer les streams, pas pour
figer une release ni pour considerer la policy artifact completement durcie.
