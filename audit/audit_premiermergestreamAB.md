**Audit Recadré**

Oui, cette fois l’audit prend bien comme scope réel:

- **Stream A livré attendu**: P1 + P2, donc CLI, paths, pipeline, overwrite, faux converter en tests.
- **Stream B livré attendu**: P1 seulement, donc Markdown -> HTML local, assets inline, Mermaid préparé pour navigateur, release catalog fakeable.
- **Hors-scope volontaire**: vrai `convertFile`, WebDriver/PDF, fallback browser, `test:browser`, `npm pack`, packaging final, Stream A P3/P4, Stream B P2/P3.

Verdict: **AUDIT_PASS avec avertissements** pour ce jalon intermédiaire.  
Totaux confirmés: **Critique 0 · High 0 · Medium 2 · Low 1**.

**Matrice Courte**

| Contrat du jalon | Statut |
| --- | --- |
| Stream A P1 CLI testable | Conforme |
| Stream A P1 path/job resolution | Conforme |
| Stream A P2 overwrite + skipped summary | Conforme |
| Stream A P2 batch continue-on-conversion-error | Conforme |
| Stream B P1 Markdown -> HTML local | Conforme |
| Stream B P1 temp HTML cleanup | Conforme |
| Stream B P1 release catalog fakeable | Conforme |
| Gates P1/P2 | Conforme |

Commandes exécutées:

- `npm run typecheck`: pass
- `npm run test:contracts`: pass, 11 tests
- `npm test`: pass, 88 tests
- `npm run check:artifacts`: pass

**Findings Confirmés**

1. **Medium - Interactivité calculée sur `stderr` au lieu de `stdout`**  
   Preuve: [docs/project_requirements.md](/Users/samirtamboura/Desktop/md2pdf/docs/project_requirements.md:29) définit une session interactive comme `stdin` + `stdout` TTY. Le code utilise `stdin` + `stderr`: [src/cli.ts](/Users/samirtamboura/Desktop/md2pdf/src/cli.ts:99), [src/cli.ts](/Users/samirtamboura/Desktop/md2pdf/src/cli.ts:103). Le test fige aussi ce comportement: [tests/unit/cli/cli.test.ts](/Users/samirtamboura/Desktop/md2pdf/tests/unit/cli/cli.test.ts:99).  
   Impact: dans un script avec `stdout` redirigé mais `stderr` attaché, md2pdf peut prompter alors que le contrat global dit non-interactif.  
   Correction attendue: calculer `isInteractive` avec `process.stdin` + `process.stdout`, tout en gardant le prompt écrit sur `stderr`.

2. **Medium - Tags `@req` incorrects dans plusieurs tests**  
   Preuve: la traçabilité doit être générée depuis les tags [docs/project_requirements.md](/Users/samirtamboura/Desktop/md2pdf/docs/project_requirements.md:150). Mais un test qui attend `exitCode === 1` est taggé `FR-18` succès: [tests/unit/cli/cli.test.ts](/Users/samirtamboura/Desktop/md2pdf/tests/unit/cli/cli.test.ts:273), [tests/unit/cli/cli.test.ts](/Users/samirtamboura/Desktop/md2pdf/tests/unit/cli/cli.test.ts:298). Des tests d’input illisible sont taggés `FR-14` au lieu de `FR-15`: [tests/unit/paths/paths.test.ts](/Users/samirtamboura/Desktop/md2pdf/tests/unit/paths/paths.test.ts:61), [tests/unit/paths/paths.test.ts](/Users/samirtamboura/Desktop/md2pdf/tests/unit/paths/paths.test.ts:83). Des erreurs d’output non remplaçable sont taggées `FR-15`, qui parle d’input manquant/illisible: [tests/unit/overwrite/overwrite.test.ts](/Users/samirtamboura/Desktop/md2pdf/tests/unit/overwrite/overwrite.test.ts:179).  
   Impact: la matrice de couverture peut déclarer des exigences couvertes par de mauvais tests.  
   Correction attendue: corriger les tags, probablement `FR-17` pour exit `1`, `FR-15` pour input illisible, et retirer ou remplacer `FR-15` sur les cas d’output non remplaçable.

3. **Low - Worktree non clean / fichiers non suivis dans le scope audité**  
   Preuve: `git status --short --branch` montre `.agents/`, `audit/audit_premiermergestreamAB.md`, `src/browserLocator.ts`, `tests/unit/browserLocator/` non suivis.  
   Impact: l’audit porte sur le code de travail actuel, pas seulement sur le commit merge `75a9a50`.  
   Correction attendue: décider si ces fichiers font partie du merge à committer ou s’ils doivent rester hors audit de merge.

**Points Conformes**

Stream A P1/P2 est en bon état pour le jalon: `main(argv, io)` est testable, les erreurs d’usage sortent en `2`, les outputs par défaut/`--output`/`--output-dir` sont couverts, les collisions sont stoppées avant rendu, l’overwrite non-interactif skippe et compte dans le summary, le batch continue bien sur erreur de conversion injectée.

Stream B P1 est également cohérent: CommonMark/tables/task lists/footnotes, highlight, images relatives en data URI, Mermaid rendu comme bloc HTML local avec engine inline, CSP sans ressources externes exploitables, temp HTML nettoyé sur succès/erreur/timeout, `JsonReleaseCatalog` + `InMemoryReleaseCatalog` testés.

Les anciens gros rouges comme `convertFile` stub, absence `pdfRenderer.ts`, `test:browser` vide, fallback stub, packaging `dist/cli.js` ne sont **pas des défauts de ce jalon**. Ils redeviennent bloquants uniquement si on prétend avoir livré Stream A P3/P4, Stream B P2/P3, ou le MVP release-ready.