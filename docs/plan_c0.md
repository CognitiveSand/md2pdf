# Plan C0 - Contrats et squelette partagé

Prerequis: P0 terminé (`docs/architecture.md` aligné, fichiers release-evidence créés).

C0 est un vrai gate : tout doit compiler vert avant de séparer les streams.

## Tâches

### 1. Créer `src/errors.ts`

Définir la hiérarchie d'erreurs partagées.

- `ErrorKind` : `'usage' | 'input' | 'conversion' | 'render' | 'browser' | 'artifact' | 'not-implemented'`
- Interface `Md2PdfErrorContext` avec les champs : `kind`, `message`, `sourcePath?`, `outputPath?`, `artifactName?`, `actionHint?`, `cause?`
- Classes à exporter :
  - `Md2PdfError` (base)
  - `UsageError`
  - `InputNotFoundError`
  - `ConversionError`
  - `RenderError`
  - `BrowserNotFoundError`
  - `ArtifactFreshnessError`
  - `NotImplementedError`
- Une fonction `formatError(error: Md2PdfError): string` testée, utilisée par le CLI uniquement via cette fonction.

### 2. Créer `src/contracts.ts`

Définir les types partagés entre Stream A et Stream B.

- `ConvertOptions` : `{ browserPath?: string; renderTimeoutMs?: number }`
- `convertFile(sourcePath, outputPath, options?): Promise<void>` — stub qui lance `NotImplementedError`
- `ConversionJob` : `{ sourcePath: string; outputPath: string; originEntry: string }`
- `ConversionStatus` : `'success' | 'failed' | 'skipped'`
- `ConversionOutcome` extends `ConversionJob` : `{ status: ConversionStatus; error?: Md2PdfError }`

### 3. Créer `src/artifactPolicy.ts` (contrat minimal + sélection C0)

- Interface `ArtifactRelease` : `{ version: string; publishedAt: string; url: string; sha256: string; size: number; provenance: string }`
- Interface `ArtifactConstraints` : `{ quarantineDays: number; compatibleWith?: string }`
- Interface `ReleaseCatalog` : fakeable en test, avec timestamps de publication (`publishedAt`)
- Classe `ArtifactPolicy` avec méthode `selectNewestEligible(releases, constraints, now): ArtifactRelease | null`
- `selectNewestEligible` est implémenté dès C0 : filtrer les releases compatibles sorties depuis au moins `quarantineDays`, puis retourner celle au `publishedAt` le plus récent
- `compatibleWith` compare un major de version normalisé quand la release et la contrainte commencent par un numéro; sinon la compatibilité exige une égalité exacte
- Toute autre logique artifact non couverte par C0 reste stub et lance `NotImplementedError`

### 4. Créer `src/fallbackBrowserProvisioner.ts` (interface uniquement)

- Interface `FallbackBrowserResult` : `{ browserPath: string; driverPath: string }`
- Fonction `provisionFallbackBrowser(policy: ArtifactPolicy, catalog: ReleaseCatalog): Promise<FallbackBrowserResult>` — stub `NotImplementedError`

### 5. Ajouter le script `test:contracts` dans `package.json`

```json
"test:contracts": "vitest run tests/unit/contracts --reporter=verbose"
```

### 6. Créer `tests/unit/contracts/` et écrire les premiers tests contractuels

Objectif : faire passer un test rouge en vert pour prouver que le gate fonctionne.

Tests à écrire :
- Import de tous les exports sans cycle (vérification structurelle)
- `formatError` retourne une chaîne non vide avec `kind` et `message`
- `formatError` utilise les champs `sourcePath` et `outputPath` quand présents
- `ArtifactPolicy.selectNewestEligible` avec releases/catalog fake : sélectionne la plus récente éligible après quarantaine
- `ConversionJob` et `ConversionOutcome` sont instanciables avec les bons champs
- Stubs lancent bien `NotImplementedError`

### 7. Tracer "rouge puis vert" dans la checklist release

Une fois le premier test contractuel passé de rouge à vert, noter dans
`docs/release-evidence/release-checklist-v0.1.2.md` :
- commit ou log de la séquence
- commandes utilisées

## Gate de validation

```bash
npm run typecheck
npm run test:contracts
```

Les deux doivent être verts avant de lancer P1 en parallèle.

## Fichiers créés par C0

| Fichier | Propriétaire |
| --- | --- |
| `src/errors.ts` | Commun (Stream A pendant C0, puis accord explicite) |
| `src/contracts.ts` | Commun |
| `src/artifactPolicy.ts` | Stream B après C0 |
| `src/fallbackBrowserProvisioner.ts` | Stream B après C0 |
| `tests/unit/contracts/` | Commun |
| `package.json` (script test:contracts) | Commun |
