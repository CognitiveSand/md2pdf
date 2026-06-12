# Audit Team Complete - Phase 1 remediation

Date: 2026-06-12  
Branche auditee: `plan/v0.1.1_restart`  
Commit audite: `12fa037b67025da7c42f35e2cc380cb4c4c266dc`  
Scope: code actuel apres implementation de la Phase 1 du plan post-audit.

## Resume Global

Verdict: **AUDIT_PASS pour la Phase 1 stricte, AUDIT_FAIL pour une validation release globale**.

La Phase 1 demandait de retablir la compilabilite minimale et des contrats importables. Sur ce perimetre, les gates passent: `npm run typecheck`, `npm run test:contracts` et `npm run check:artifacts` sont verts.

Mais le depot n'est pas encore sain en validation large: `npm test` echoue sur 4 tests et `npm run test:browser` echoue sur 14 tests. Les echecs viennent d'un decalage entre l'ancien contrat de test/converter et le nouveau chemin WebDriver, plus une perte de contexte source/output pour certaines erreurs runtime.

Totaux normalises: Critical 0 - High 2 - Medium 3 - Low 0.

## Index Des Sous-Audits

| Division | Verdict | Severites |
| --- | --- | --- |
| Metier / Requirements | 🟡 Avertissement | 0C / 1H / 1M / 0L |
| Qualite / Tests | 🔴 Bloquant release | 0C / 2H / 0M / 0L |
| Architecture / Cohesion | 🟡 Avertissement | 0C / 0H / 2M / 0L |
| Securite / Supply chain | 🟢 OK Phase 1 | 0C / 0H / 0M / 0L |

## Matrice Des Exigences Phase 1

| Exigence | Preuve implementation | Preuve test/gate | Statut |
| --- | --- | --- | --- |
| Corriger `browserLocator.ts`: `isAbsolute`, fonctions manquantes, Windows roots | `src/browserLocator.ts:4`, `src/browserLocator.ts:688`, `src/browserLocator.ts:709`, `src/browserLocator.ts:719` | `npm run typecheck` vert | PASS |
| Corriger graphe d'import `converter.ts` | `src/converter.ts:6`, `src/converter.ts:22`, `src/converter.ts:27`; `src/webDriverSession.ts:15` | `npm run typecheck` vert | PASS |
| Stabiliser `contracts.ts` sans charger runtime casse a l'import | `src/contracts.ts:21`, `src/contracts.ts:26`; test `tests/unit/contracts/contracts.test.ts:29` | `npm run test:contracts` vert | PASS |
| Reconciler `not-implemented` / `NotImplementedError` | Code actuel: `src/errors.ts:1`; docs anciennes encore contraires: `docs/implementation_plan_v0.1.2.md:140` | Pas de test d'alignement doc/code | PARTIEL |
| Ne pas modifier le comportement fonctionnel avant compilabilite | Etat final compilable; sequence historique non verifiable depuis l'etat courant | Limite d'audit | NON VERIFIABLE |

## Top Findings Deduplicates

### F1 High - La suite globale reste rouge car `createConverter` a disparu du contrat de tests

- Preuve: `tests/unit/converter/converter.test.ts:7` importe `createConverter` depuis `src/converter.js`.
- Preuve: `tests/unit/converter/converter.test.ts:27`, `tests/unit/converter/converter.test.ts:55`, `tests/unit/converter/converter.test.ts:68` l'appellent directement.
- Preuve: `src/converter.ts:59` expose `convertFile`, et `src/converter.ts:67` expose `DocumentConverter`, mais le contrat `createConverter` attendu par ces tests n'existe plus.
- Type: Confirme.
- Impact: `npm test` echoue avec `createConverter is not a function`, donc la validation globale ne peut pas passer.
- Pourquoi c'est un probleme: ce n'est pas un simple bruit de test; ces tests documentent une surface d'injection runtime utilisee pour verifier le rendu HTML temporaire et le wrapping des erreurs sans lancer le vrai navigateur.
- Correction attendue: choisir explicitement entre restaurer une facade `createConverter(...)` compatible, ou migrer les tests vers `new DocumentConverter(...)` avec dependances injectees. La decision doit etre coherente avec le contrat public souhaite.

### F2 High - Les integrations CLI navigateur testent encore l'ancien faux navigateur direct, incompatible avec le chemin WebDriver actuel

- Preuve: `tests/integration/cli-pdf.test.ts:15` utilise `createFakeBrowser(tempRoot)`.
- Preuve: `tests/integration/cli-pdf.test.ts:255` injecte ce binaire via `MD2PDF_BROWSER`.
- Preuve: `tests/integration/cli-pdf.test.ts:277` cree un executable `fake-browser`, sans identite Chrome/Firefox/Vivaldi.
- Preuve: `src/browserLocator.ts:573` derive le type navigateur depuis le chemin, puis retourne `null` si aucun nom supporte ne matche a `src/browserLocator.ts:624`.
- Preuve: `src/browserLocator.ts:506` construit alors une `BrowserNotFoundError`.
- Type: Confirme.
- Impact: `npm run test:browser` echoue sur 14 tests, dont les scenarios succes attendus a `tests/integration/cli-pdf.test.ts:44`, `tests/integration/cli-pdf.test.ts:58`, `tests/integration/cli-pdf.test.ts:70`, `tests/integration/cli-pdf.test.ts:99` et `tests/integration/cli-pdf.test.ts:128`.
- Pourquoi c'est un probleme: le test d'integration n'exerce plus le runtime cible; il reste cale sur un fake de l'ancien renderer direct `--print-to-pdf`. Le nouveau code exige un navigateur reconnu, un driver eligible et une session WebDriver.
- Correction attendue: remplacer ces integrations par un fake WebDriver/driver compatible, ou injecter proprement `DocumentConverter`/`WebDriverSessionFactory` au niveau CLI pour tester le flux sans dependance a un binaire non reconnu.

### F3 Medium - Les erreurs `Md2PdfError` perdent le contexte `source` / `output` dans le pipeline

- Preuve: `src/pipeline.ts:91` detecte une `Md2PdfError`.
- Preuve: `src/pipeline.ts:92` a `src/pipeline.ts:94` la retourne telle quelle, sans enrichir `sourcePath` ni `outputPath`.
- Preuve: `src/browserLocator.ts:506` cree une `BrowserNotFoundError` avec message, hint et cause, mais sans source/output.
- Preuve: `src/errors.ts:77` et `src/errors.ts:78` n'impriment `source` et `output` que si ces champs existent deja dans le contexte.
- Preuve de contrat attendu: `tests/unit/cli/cli.test.ts:113`, `tests/unit/cli/cli.test.ts:114`, `tests/unit/cli/cli.test.ts:115` attendent une erreur formatee avec type conversion et chemins.
- Type: Confirme.
- Impact: une erreur navigateur/artifact depuis une conversion CLI peut sortir sans rappeler quel fichier Markdown et quel PDF etaient en cause.
- Pourquoi c'est un probleme: le CLI batch perd son diagnostic principal au moment ou plusieurs fichiers peuvent echouer differemment.
- Correction attendue: au niveau `ConversionPipeline`, envelopper ou enrichir les `Md2PdfError` qui n'ont pas `sourcePath`/`outputPath`, sans ecraser le `kind` quand il est utile.

### F4 Medium - La reconciliation `NotImplementedError` reste partielle dans la documentation

- Preuve requirement Phase 1: `docs/post-audit-remediation-plan-2026-06-12.md:106` a `docs/post-audit-remediation-plan-2026-06-12.md:109` demandent d'aligner code, tests et documentation sur une seule decision.
- Preuve doc contraire: `docs/implementation_plan_v0.1.2.md:140` a `docs/implementation_plan_v0.1.2.md:147` listent encore `not-implemented` dans `ErrorKind`.
- Preuve doc contraire: `docs/implementation_plan_v0.1.2.md:160` a `docs/implementation_plan_v0.1.2.md:169` listent encore `NotImplementedError` comme classe requise.
- Preuve code actuel: `src/errors.ts:1` a `src/errors.ts:7` listent les kinds sans `not-implemented`; `src/errors.ts:37` a `src/errors.ts:70` listent les classes sans `NotImplementedError`.
- Type: Ecart documentaire.
- Impact: les prochains implementateurs peuvent reintroduire un contrat C0 obsolete ou corriger dans le mauvais sens.
- Pourquoi c'est un probleme: cette action faisait partie explicite de Phase 1; elle est fonctionnellement tranchee dans le code, mais pas documentee partout.
- Correction attendue: declarer dans le plan actif que `NotImplementedError` est retire, ou marquer les anciens plans comme historiques/non normatifs.

### F5 Medium - Vivaldi est annonce supporte mais absent de la recherche POSIX par defaut

- Preuve: `src/browserLocator.ts:77` annonce `Vivaldi` dans la liste des navigateurs supportes.
- Preuve: `src/browserLocator.ts:95` a `src/browserLocator.ts:108` incluent `vivaldi` et `vivaldi-stable` dans `POSIX_BROWSER_NAMES`.
- Preuve: `src/browserLocator.ts:702` a `src/browserLocator.ts:706` construisent les candidats POSIX avec Chrome, Chromium, Edge, Brave et Firefox, mais pas Vivaldi.
- Type: Confirme.
- Impact: sur Linux/Unix, un utilisateur avec Vivaldi dans le `PATH` peut recevoir une erreur de navigateur introuvable alors que le produit l'annonce comme supporte.
- Pourquoi c'est un probleme: petite incoherence fonctionnelle dans le module que Phase 1 venait justement de remettre en compilabilite.
- Correction attendue: reutiliser `POSIX_BROWSER_NAMES` dans `defaultBrowserCandidates(...)`, ou ajouter explicitement `vivaldi` et `vivaldi-stable`.

### R1 Medium [RISQUE] - Arret de WebDriver potentiellement bloquant si le process ignore SIGTERM

- Preuve: `src/converter.ts:122` lance `driverProcess?.stop()` sans signal d'abort associe.
- Preuve: `src/webDriverSession.ts:54` a `src/webDriverSession.ts:60` appellent `child.kill()` puis attendent `waitForExit(...)`.
- Preuve: `src/webDriverSession.ts:129` a `src/webDriverSession.ts:140` attendent l'evenement `exit`, avec timeout seulement si un signal externe est fourni.
- Type: [RISQUE].
- Impact: un driver qui ignore SIGTERM ou reste bloque peut laisser une promesse de cleanup pendante et un process vivant.
- Pourquoi c'est un probleme: ce n'est pas prouve par les tests actuels, mais c'est un risque SRE classique sur les process externes.
- Correction attendue: ajouter une borne de shutdown interne, puis SIGKILL/escalade controlee si le driver ne sort pas.

## Details Par Division

### Division Metier - Anton Ego

Verdict: 🟡 Avertissement.

La Phase 1 accomplit son contrat minimal: le TypeScript est importable, les imports cassants sont remplaces par des modules existants, et `contracts.ts` ne charge plus l'implementation runtime au simple import. C'est correct, presque elegant dans sa retenue.

Mais l'histoire du produit n'est pas encore harmonisee: les anciens plans continuent de reclamer `NotImplementedError` alors que le code l'a abandonne, et la promesse Vivaldi n'est pas tenue en recherche POSIX.

### Division Qualite - Gordon Ramsay

Verdict: 🔴 Bloquant release.

Les gates Phase 1 passent, mais la cuisine globale fume encore: `npm test` et `npm run test:browser` sont rouges. Les tests ne sont pas des ornements; ils representent ici des contrats de diagnostic, d'injection et d'integration. Tant que ces echecs restent presents, la branche ne doit pas etre declaree stable au-dela de Phase 1.

### Division Architecture - Steve Jobs

Verdict: 🟡 Avertissement.

Le deplacement vers `DocumentConverter` et `WebDriverSessionFactory` donne une meilleure forme au runtime que l'ancien rendu direct. Mais l'architecture de tests n'a pas suivi: un fake navigateur `--print-to-pdf` cohabite encore avec un runtime WebDriver. Il faut choisir une seule surface de test cible.

### Division Cybersecurite Offensive - Sherlock Holmes

Verdict: 🟢 OK Phase 1.

Elementaire, et pourtant important: la politique artefacts passe (`npm run check:artifacts`). Le code actuel refuse les URLs/artifacts flottants via les tests contractuels existants, et la localisation navigateur reste locale. Le risque restant n'est pas supply-chain, mais process-lifecycle: l'arret de WebDriver doit etre borne.

## Points Conformes

- `src/browserLocator.ts` importe maintenant `isAbsolute` a `src/browserLocator.ts:4`.
- `windowsRoots(...)` existe a `src/browserLocator.ts:709` et `pathExecutablesForEnv(...)` existe a `src/browserLocator.ts:719`.
- `src/converter.ts` importe ses types navigateur depuis `src/browserLocator.ts` via `src/converter.ts:6` a `src/converter.ts:11`.
- `src/webDriverSession.ts` existe et expose `WebDriverSessionFactory` a `src/webDriverSession.ts:20`.
- `src/contracts.ts` utilise un import dynamique a `src/contracts.ts:26`, ce qui evite de charger le runtime lors de l'import contractuel.
- `tests/unit/contracts/contracts.test.ts:29` a `tests/unit/contracts/contracts.test.ts:42` prouvent l'import contractuel sans cycle.

## Commandes Executees

```bash
git rev-parse HEAD
git status --short --branch
npm run typecheck
npm run test:contracts
npm run check:artifacts
npm run test:browser
npm test
```

Resultats:

- `npm run typecheck`: PASS.
- `npm run test:contracts`: PASS, 15 tests.
- `npm run check:artifacts`: PASS.
- `npm test`: FAIL, 4 tests echoues.
- `npm run test:browser`: FAIL, 14 tests echoues.

## Limites De Verification

- Audit en lecture seule du code de production; aucune correction appliquee.
- Les echecs `browserBackedConversion` dependent de l'absence de navigateur/fallback eligible dans l'environnement local. Cela confirme que le gate n'est pas autonome ici, mais ne prouve pas seul une regression production.
- La consigne "ne pas modifier le comportement fonctionnel tant que le code ne compile pas" est une contrainte de sequence; l'etat courant ne permet pas de prouver l'ordre exact des changements.
