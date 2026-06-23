# Resume de l'audit global projet

Date: 2026-06-12

Source: `audit/2026-06-12-global-project-progress-structure-problems-audit.md`

Objet: resume court de l'audit d'avancement, de structure et de problemes du
projet md2pdf par rapport aux plans Stream A, Stream B et v0.1.2.

Ce resume ne propose aucune solution.

## Verdict global

Etat observe: `NO-GO` pour la v0.1.2 globale.

Le projet contient une partie importante du code attendu, mais l'etat courant ne
valide pas la definition de fini v0.1.2. Les contrats, les tests, les preuves
release, le build et la politique d'artifacts ne sont pas alignes avec le code
actuellement present.

## Avancement par zone

| Zone | Etat resume | Probleme principal |
| --- | --- | --- |
| P0 documentaire | Partiel | La documentation existe, mais les preuves release ne refletent plus l'etat courant. |
| C0 contrats | Non valide | Les contrats ne s'importent plus a cause de dependances runtime manquantes. |
| Stream A CLI / paths / overwrite / batch | Partiel | Des tests existent, mais les suites globales echouent. |
| Stream A packaging / install | Regressif | `dist/` et le tarball ne sont plus regenerables depuis le source courant. |
| Stream B Markdown HTML | Partiel | Le rendu HTML existe, mais le rendu PDF final n'est pas prouve. |
| Stream B browser / driver / fallback | Non valide | Le locator ne compile pas et aucun driver/fallback reel n'est declare comme artifact utilisable. |
| Stream B converter WebDriver | Non valide | Le convertisseur cible WebDriver depend de fichiers absents. |
| Definition de fini v0.1.2 | Non atteinte | Plusieurs gates sont rouges et les preuves browser/CI restent absentes ou bloquees. |

## Blocages critiques

1. Le code TypeScript courant ne compile pas.
2. `test:contracts` echoue avant execution des tests.
3. `npm test` echoue.
4. `test:browser` echoue avant les tests d'integration.
5. `check:artifacts` echoue car `assets/default.css` ne correspond plus a
   `artifacts.json`.
6. `dist/` ne correspond plus au source courant.
7. Les preuves release marquent encore des gates en `pass` alors que ces gates
   echouent actuellement.

## Probleme structurel central

Deux architectures de rendu coexistent:

- le chemin cible recent autour de WebDriver (`src/converter.ts`,
  `src/webDriverClient.ts`);
- un ancien chemin direct navigateur via `src/pdfRenderer.ts` et `dist/pdfRenderer.js`.

Cette coexistence rend l'etat du runtime ambigu: le source vise une architecture,
le build existant en expose une autre, et le package ne peut pas etre regenere
proprement dans l'etat courant.

## Problemes de preuves

Les preuves release sont fragiles ou obsoletes:

- la checklist indique des gates en `pass` alors que les commandes echouent le
  2026-06-12;
- FR-20 est marquee `pass`, mais la preuve reste une simulation sans vraie
  installation system-scope multi-compte;
- les preuves browser-backed et Mermaid reel restent bloquees;
- la matrice CI Linux/macOS/Windows n'est pas prouvee;
- les tests PDF/Mermaid existants ne prouvent pas suffisamment que Mermaid est
  rendu comme diagramme.

## Problemes de politique artifacts

La politique d'artifacts bloque l'etat courant:

- `check:artifacts` echoue sur `assets/default.css`;
- les drivers `chromedriver`, `geckodriver` et le fallback Chromium-for-Testing
  ne sont que des classes prevues, pas des releases utilisables declarees dans
  `artifacts.json`;
- le runtime ne prouve pas le meme niveau de verification d'integrite pour tous
  les artifacts;
- le modele de waiver n'est pas partage clairement entre le checker repo et le
  runtime.

## Risques de test et validation

Les tests ne donnent pas une preuve release suffisante:

- `test:all` ne couvre pas tous les gates requis;
- `prepack` ne bloque pas sur les tests;
- les tests navigateur reels peuvent etre skippes localement;
- le smoke Mermaid reel verifie seulement un PDF valide et sa taille;
- certaines assertions PDF cherchent du texte brut dans les octets du PDF, ce
  qui est fragile.

## Synthese courte

Le projet est avance sur plusieurs briques, surtout CLI, orchestration,
Markdown HTML, artifact policy et fallback fake/teste. Mais l'integration globale
est actuellement cassee: compilation rouge, contrats rouges, tests rouges,
artifact gate rouge, preuves release stales, `dist/` stale et rendu
browser/Mermaid non prouve.

Le statut global reste donc: `NO-GO v0.1.2`.
