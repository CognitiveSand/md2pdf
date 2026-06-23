# Validation finale P0 - 2026-06-04

## Verdict

**No-Go pour validation finale P0 propre.**

P0 est proche: les livrables documentaires existent et les grandes ambiguities
sur les contrats, le fallback navigateur, la frontiere provisioning/conversion
et les preuves release sont largement cadrees. Mais les audits finaux gardent
des blocages avant C0:

- la checklist P0 conserve les preuves de cloture en `pending`;
- la checklist reference `audit.md`, alors que le fichier est supprime et que
  les audits reels sont sous `audit/`;
- `ConversionJob` diverge entre `docs/architecture.md` et le plan parent
  `docs/implementation_plan_v0.1.2.md` sur `options: ConvertOptions`;
- le contrat d'erreur diverge entre `Md2pdfError` et `Md2PdfError`;
- le package courant n'est pas prouvable: `bin.md2pdf` pointe vers
  `./dist/cli.js`, mais le build historique visible est sous `dist/src/`;
- le gate `npm.cmd run typecheck` echoue avec `TS18003` car `src/` n'existe pas;
- `npm.cmd run check:artifacts` echoue sur Windows avec `spawnSync npm ENOENT`
  parce que le script appelle `npm` au lieu de `npm.cmd`.

## Synthese des agents

| Agent | Verdict | Point principal |
| --- | --- | --- |
| Acceptance critic | Go conditionnel | Pas d'ambiguite de fond, mais preuves P0 encore `pending` et reference `audit.md` cassee. |
| Documentation sync | No-Go docs | README et `dist/` decrivent/contiennent un etat produit non conforme a la cible P0/C0. |
| Test engineer | No-Go tests | Les preuves release sont majoritairement `pending`, `src/`/`tests/` absents, CI absente. |
| Architect | No-Go architecture | Divergence de contrat `ConversionJob` et gate P0 non cloture. |
| Code auditor | No-Go code | Package non executable/rebuildable, contrat d'erreur incoherent, preuves P0 ouvertes. |
| Securite locale | Acceptable documentairement | Architecture cible claire, mais `dist/` runtime ne doit pas servir de preuve release. |

## Decision

Ne pas demarrer C0 tant que les points suivants ne sont pas traites:

1. choisir le contrat unique `ConversionJob` et aligner architecture/plan/checklist;
2. choisir un seul nom public pour l'erreur (`Md2PdfError` ou `Md2pdfError`);
3. cloturer les lignes P0 `pending` de `release-checklist-v0.1.2.md`;
4. remplacer la reference `audit.md` par les rapports reels sous `audit/`, ou
   restaurer un index d'audit stable;
5. tracer explicitement toute exception `blocked`/`pending`;
6. noter que `dist/` est non normatif jusqu'a regeneration depuis `src/`, et
   que le CLI packagable devra produire un `bin` reel avant release.

Apres ces corrections, P0 pourra passer en **Go** et C0 pourra commencer sur une
base plus nette.
