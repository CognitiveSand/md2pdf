# Plan Stream A - CLI, orchestration, packaging

Prerequis: C0 gate vert (`npm run typecheck` + `npm run test:contracts`).

Stream A livre tout ce que l'utilisateur observe autour du rendu PDF : commande,
options, chemins, batch, overwrite, erreurs, exit codes, installation, packaging.

## Fichiers possédés

| Fichier | Phase |
| --- | --- |
| `src/cli.ts` | P1 |
| `src/paths.ts` | P1 |
| `src/overwrite.ts` | P2 |
| `src/pipeline.ts` | P1-P2 |
| `src/errors.ts` | C0 seulement, puis accord explicite |
| `README.md` | P4 |
| `package.json` (bin/scripts) | P1 |

Stream A ne modifie pas : `markdownRenderer.ts`, `browserLocator.ts`,
`webDriverClient.ts`, `artifactPolicy.ts`,
`fallbackBrowserProvisioner.ts`.

---

## P1 - CLI et résolution des jobs

### 1. `src/cli.ts` — CLI testable

- `main(argv, io)` sans dépendance forte au process global.
- `io` expose : `stdin`, `stdout`, `stderr`, `env`, `cwd`, `isInteractive`.
- Signature de commande : `md2pdf [OPTIONS] ENTRY [ENTRY ...]`.
- `--help` : une ligne par option, toutes les options décrites.
- Erreurs d'usage en exit `2`.
- Le CLI formate toute erreur via `formatError` depuis `src/errors.ts`.

### 2. `src/paths.ts` — Résolution des jobs

Règles à implémenter :

- Entrée fichier `.md` : extension comparée sans sensibilité à la casse (`.MD` accepté).
- Entrée dossier : non récursif, seuls les fichiers Markdown top-level.
- Dossier sans fichier Markdown : succès avec summary `0 succeeded, 0 failed, 0 skipped`, exit `0`.
- Output par défaut : à côté de la source (`source.md` → `source.pdf`).
- `--output` : limité à un seul job résolu.
- `--output` : extension fournie utilisée verbatim, aucune contrainte `.pdf`.
- `--output-dir` : compatible single et batch.
- Parent d'output créé si absent.
- `outputPath === sourcePath` : `UsageError`.
- Plusieurs jobs vers le même output : `UsageError` avant rendu.
- Entrées dupliquées produisant un output dupliqué : `UsageError`.
- Test explicite : `--output-dir` avec `a/report.md` et `b/report.md` → collision de basename.

### 3. `src/pipeline.ts` — Preflight et modèle batch

- Résoudre tous les `ConversionJob` avant tout rendu.
- Détecter les collisions d'output en preflight.
- Les collisions de preflight n'ouvrent jamais de prompt overwrite.
- Utiliser un faux converter en test (pas de dépendance navigateur).

---

## P2 - Overwrite, batch complet, edge cases

### 4. `src/overwrite.ts` — Politique d'écrasement

Table de décision pure :

| PDF existe | Mode | `--force-overwrite` | Résultat |
| --- | --- | --- | --- |
| Non | tout | tout | Continuer |
| Oui | interactif | Non | Prompt |
| Oui | non-interactif | Non | Skip |
| Oui | tout | Oui | Écraser |

- Prompt : default No.
- Réponses acceptées : `y`, `yes`, `n`, `no`, entrée vide.
- Entrée vide, EOF ou toute réponse non affirmative : préserve le fichier.
- Skip non-interactif : message stderr + status `skipped`.
- Skips visibles dans le summary, pas comptés comme failures.

### 5. Pipeline batch complet

- Continue-on-error pour les erreurs de conversion par document.
- Erreurs de preflight globales en exit `2`.
- Summary stdout : `N succeeded, N failed, N skipped`.
- Exit `0` si aucun job n'a échoué.
- Exit `1` si au moins une conversion échoue.

### 6. Edge cases à couvrir

- Collision `--output-dir` avec basenames identiques cross-directory.
- Dossier vide → exit `0`, summary `0 succeeded, 0 failed, 0 skipped`.
- Prompt EOF → préserver le fichier.
- Entrées dupliquées → `UsageError`.
- `outputPath === sourcePath` → `UsageError`.

### 7. Cas de permission dédiés

- Input illisible → `InputNotFoundError` avec `sourcePath` et `actionHint`.
- Parent output non writable → `ConversionError` avec `outputPath` et `actionHint`.
- Output existant non remplaçable → message clair avec chemin.

---

## P3 - Intégration verticale

### 8. Liaison avec le vrai converter

- Stream A remplace le faux converter par le vrai `convertFile` pour les tests d'intégration.
- Conversion single-file bout en bout avec sortie PDF réelle.
- Mermaid rendu comme diagramme, en coordination avec les preuves Stream B.
- Overwrite preserve sans confirmation quand un PDF existe et que `--force-overwrite` est absent.
- Erreurs de rendu propagées avec chemin source et formatées via `formatError`.
- Conversion browser-backed offline après provisioning préalable.

Gate P3 global :

```bash
npm run build
npm run test:browser
```

---

## P4 - Installation, packaging, README

### 9. Installation et packaging

- `bin.md2pdf` pointe vers `dist/cli.js` dans `package.json`.
- `npm run build` produit le binaire.
- `npm pack --json` inspecte la packlist.
- Install user-scope avec préfixe temporaire :
  - `npm install -g --prefix <tmp> <tarball>`
  - invoquer `md2pdf --help` depuis le préfixe
  - résoudre le binaire par OS : `md2pdf.cmd` sous Windows, shim POSIX sur Linux/macOS
- Deux installations successives du même tarball dans le même préfixe : exit `0` aux deux.
- Preuve `FR-20` : compléter `docs/release-evidence/fr-20-system-scope.md`.

### 10. README final

- Une section par option CLI.
- Documenter que l'extension output est utilisée verbatim.
- Documenter que le premier run peut télécharger un driver (notes fournies par Stream B).
- Vérification README/`--help` : chaque option de `--help` a une entrée README et vice-versa.

---

## Tests requis Stream A

Tags `@req` obligatoires :

`FR-02`, `FR-03`, `FR-08`, `FR-09`, `FR-10`, `FR-11`, `FR-12`, `FR-13`,
`FR-14`, `FR-15`, `FR-17`, `FR-18`, `FR-19`, `FR-20`, `FR-21`, `FR-23`, `NFR-04`.

Les tests de pipeline utilisent un faux converter sans dépendance navigateur.

---

## Gate de validation par phase

| Phase | Commande |
| --- | --- |
| P1 | `npm run typecheck && npm test` |
| P2 | `npm run typecheck && npm test` côté Stream A; gate global P2 : `npm run typecheck && npm test && npm run check:artifacts` |
| P3 | `npm run build && npm run test:browser` |
| P4 | `npm run build && npm test && npm run check:artifacts && npm pack` |
