# Code Audit - Phase 3 post-audit remediation

Date: 2026-06-15  
Branche auditee: `plan/v0.1.1_restart`  
Commit audite: `22fd3e632a2a87b3b7d12b9ac4c9499ad4d0336b` (`audit: add phase 3 TeamComplete report`)  
Plateforme locale: `win32 x64`, Node `v24.16.0`, npm.cmd `11.13.0`  
Source d'exigence: `docs/post-audit-remediation-plan-2026-06-12.md`, section
`Phase 3 - Retablir BrowserLocator, WebDriver et fallback`.

## Requirement and User Story Compliance

| Requirement / Story | Status | Evidence | Problem |
| --- | --- | --- | --- |
| Finaliser `BrowserLocator`: candidats Windows/macOS/Linux, `MD2PDF_BROWSER`, erreurs env typees, Firefox snap, pas de references absentes | Respected | `src/browserLocator.ts:80`, `src/browserLocator.ts:148`, `src/browserLocator.ts:157`, `src/browserLocator.ts:209`, `src/browserLocator.ts:673`; tests `tests/unit/browserLocator/browserLocator.test.ts` passent dans `npm.cmd test` | Aucun blocage strict observe. |
| Finaliser le demarrage de session WebDriver: module dedie, lifecycle process, fermeture en `finally`, timeouts propres | Partially respected | `src/webDriverSession.ts:26`, `src/webDriverSession.ts:29`, `src/webDriverSession.ts:36`, `src/converter.ts:139`, `src/converter.ts:173`; test timeout cible `tests/integration/converter.test.ts:135` | Le timeout de readiness `/status` n'est pas borne par `AbortSignal`, et le test d'integration complet expose une course de timing. |
| Garder `webDriverClient.ts` limite au protocole WebDriver local: endpoint local, `file:`, attente Mermaid, Print, PDF bytes valides | Partially respected | Endpoint local `src/webDriverClient.ts:246`, Print `src/webDriverClient.ts:172`, PDF bytes `src/webDriverClient.ts:479`, Mermaid `src/webDriverClient.ts:423`; `npm.cmd run test:browser` echoue sur les deux preuves browser-backed reelles | Le protocole est bien isole, mais la preuve reelle echoue au `POST /session` avec `WebDriver request failed`. |
| Integrer le fallback browser uniquement en dernier recours, derriere `ArtifactPolicy` et `ReleaseCatalog` | Partially respected | Fallback apres scan installe `src/browserLocator.ts:189`; resolver policy `src/converter.ts:253`; artifacts Windows declares `artifacts.json:30`, `artifacts.json:48`; cache local contient `chrome.exe` et `chromedriver.exe` sous `.tmp/md2pdf-real-browser-cache` | Le fallback Windows est declare et provisionne, mais la conversion browser-backed ne produit toujours pas de PDF reel dans le run courant. |
| Sortie attendue Phase 3: chemin browser/WebDriver executable et erreurs typees si artifacts reels absents; tests locator/WebDriver sans references absentes | Partially respected | `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run test:artifacts` passent | Les gates stricts passent, mais la preuve d'execution browser/WebDriver reelle reste rouge. |

## Negative Findings

### Finding 1 - Le chemin browser-backed reel reste rouge sur Windows malgre les artifacts fallback declares

Severity: High  
File: `tests/integration/browserBackedConversion.test.ts`, `src/webDriverClient.ts`, `artifacts.json`  
Line: `tests/integration/browserBackedConversion.test.ts:39`, `tests/integration/browserBackedConversion.test.ts:99`, `src/webDriverClient.ts:155`, `src/webDriverClient.ts:128`, `artifacts.json:30`, `artifacts.json:48`

Problem: `npm.cmd run test:browser` echoue sur les deux tests browser-backed reels:

- `@req FR-01 @req FR-07 @req FR-24 @req NFR-02 renders Mermaid to a real PDF with a pre-provisioned browser`
- `@req FR-04 @req FR-05 @req FR-06 renders rich Markdown and a relative image to a real PDF`

Les deux echecs remontent `RenderError: WebDriver request failed` depuis `WebDriverHttpTransport.request`. La pile passe par `printPdfWithWebDriver` au moment de la creation de session WebDriver (`src/webDriverClient.ts:155`), donc le browser/driver est trouve assez loin pour demarrer WebDriver mais pas assez pour ouvrir une session utilisable.

Risk: la Phase 3 avait pour but de rendre le chemin Stream B P2/P3 executable, pas seulement importable. Sur Windows x64, les artifacts `chromium-for-testing` et `chromedriver-for-testing` sont declares et le cache local contient bien `chrome.exe` et `chromedriver.exe`; pourtant aucun PDF browser-backed reel n'est prouve. Les exigences FR-01, FR-04, FR-05, FR-06, FR-07, FR-24 et NFR-02 restent non prouvees par un navigateur reel.

Evidence:

- `npm.cmd run test:browser`: 18 passed, 3 failed; deux echecs browser-backed reels avec `WebDriver request failed`.
- `artifacts.json:30` declare `chromium-for-testing` pour `win32-x64`.
- `artifacts.json:48` declare `chromedriver-for-testing` pour `win32-x64`.
- Cache observe: `.tmp/md2pdf-real-browser-cache/.../chrome-win64/chrome.exe` et `.tmp/md2pdf-real-browser-cache/.../chromedriver-win64/chromedriver.exe`.
- `docs/post-audit-remediation-plan-2026-06-12.md:173`-`docs/post-audit-remediation-plan-2026-06-12.md:206` demande un chemin BrowserLocator/WebDriver/fallback executable.

Suggested fix: capturer le `cause` complet du `RenderError` au `POST /session` dans le test ou dans une trace de diagnostic, puis corriger la combinaison capabilities/driver/browser. Verifier notamment le couple Chromium 151 / chromedriver 151, les flags `goog:chromeOptions`, le profil temporaire et la compatibilite du canal Chrome for Testing utilise. Rejouer `npm.cmd run test:browser` sans skip.

Test needed: un test browser-backed release-grade qui part d'un cache pre-provisionne Windows et produit un PDF reel; un test de diagnostic qui affirme le status/body WebDriver en cas d'echec session.

### Finding 2 - Le test du timeout pendant le demarrage de session est une course de timing

Severity: Medium  
File: `tests/integration/converter.test.ts`, `src/markdownRenderer.ts`, `src/converter.ts`  
Line: `tests/integration/converter.test.ts:135`, `tests/integration/converter.test.ts:164`, `src/markdownRenderer.ts:105`, `src/markdownRenderer.ts:108`, `src/markdownRenderer.ts:413`, `src/converter.ts:152`

Problem: dans le run complet `npm.cmd run test:browser`, le test `@req FR-16 stops the driver process when timeout fires during session start` a echoue avec `promise resolved "undefined" instead of rejecting`. Le meme test cible, relance seul avec `npm.cmd run test:browser -- tests/integration/converter.test.ts -t "timeout fires during session start"`, passe.

Risk: la preuve FR-16 est flakiness-sensitive. Le test planifie `resolveStart()` avec un `setTimeout(..., 100)` avant d'appeler `convertFile`, tandis que le timeout interne de 50 ms n'est arme qu'apres lecture, rendu HTML temporaire et appel a `useHtml`. Sous charge ou selon l'ordre d'ordonnancement, le timer externe peut expirer avant le timer interne; le test cesse alors de prouver que le demarrage WebDriver est borne.

Evidence:

- Echec complet: `npm.cmd run test:browser` signale `promise resolved "undefined" instead of rejecting` a `tests/integration/converter.test.ts:169`.
- Rejeu cible: meme test passe seul.
- `withTempHtml` cree le travail a `src/markdownRenderer.ts:105`, puis arme le timeout a `src/markdownRenderer.ts:108` / `src/markdownRenderer.ts:413`.
- Le test arme son `setTimeout(() => resolveStart(), 100)` a `tests/integration/converter.test.ts:165`, avant que le timeout interne soit garanti actif.

Suggested fix: remplacer le delai mural fragile par une synchronisation deterministe. Par exemple: faire retourner `start()` une promesse jamais resolue et verifier le rejet timeout; ou exposer/injecter un signal de demarrage que le test peut attendre avant d'autoriser le timer; ou utiliser fake timers pour maitriser l'ordre exact.

Test needed: un test FR-16 stable qui echoue si `webdriverSessionFactory.start()` ne respecte pas le timeout, sans dependance a la charge CPU ni a l'ordre global des fichiers Vitest.

### Finding 3 - Le probe `/status` de WebDriver peut depasser le timeout annonce

Severity: Medium  
File: `src/webDriverSession.ts`  
Line: `src/webDriverSession.ts:91`, `src/webDriverSession.ts:96`, `src/webDriverSession.ts:103`, `src/webDriverSession.ts:113`

Problem: `waitForDriver` calcule une deadline globale, mais chaque appel a `driverResponds` fait un `fetch("http://127.0.0.1:${port}/status")` sans `AbortSignal` ni timeout par requete. Si un endpoint local accepte la connexion puis garde la reponse pendante, la boucle ne revient plus verifier la deadline.

Risk: le contrat "timeouts propres" de la Phase 3 est incomplet. Un driver malade, bloque, ou un processus local sur le port alloue peut suspendre le demarrage plus longtemps que `renderTimeoutMs`, alors que l'utilisateur attend une erreur typee et bornee.

Evidence:

- Deadline globale: `src/webDriverSession.ts:96`.
- Appel non borne: `src/webDriverSession.ts:113`-`src/webDriverSession.ts:119`.
- Phase 3 exige explicitement des timeouts propres: `docs/post-audit-remediation-plan-2026-06-12.md:186`-`docs/post-audit-remediation-plan-2026-06-12.md:190`.

Suggested fix: borner chaque probe `/status` avec un `AbortController` calcule sur le temps restant, ou utiliser une requete HTTP bas niveau avec timeout court. Propager une cause explicite type `webdriver-readiness-timeout`.

Test needed: un test qui simule un endpoint `/status` local qui accepte la connexion mais ne repond jamais, et verifie que `SpawnedWebDriverSessionFactory.start()` rejette avant la deadline.

### Finding 4 - `test:real-browser` utilise l'ancien helper de detection et donne une preuve confuse

Severity: Low  
File: `tests/integration/real-browser-mermaid.test.ts`, `src/browserLocator.ts`  
Line: `tests/integration/real-browser-mermaid.test.ts:22`, `tests/integration/real-browser-mermaid.test.ts:37`, `src/browserLocator.ts:110`, `src/browserLocator.ts:229`

Problem: `test:real-browser` appelle d'abord l'ancien helper `locateBrowser`, qui ne retourne qu'un chemin executable, puis repasse ce chemin a `convertFile`. `convertFile` utilise ensuite le nouveau `BrowserLocator`, qui exige une launchability reelle et un driver eligible. Sur cette machine, le test echoue avec `Pinned browser path is not launchable as a supported browser` pour Brave.

Risk: le smoke real-browser ne diagnostique pas clairement la nouvelle architecture Phase 3. Il peut trouver un executable via l'ancien helper, puis echouer dans le vrai locator avec un message qui ressemble a un probleme de navigateur, alors que le probleme attendu peut etre driver/artifact/compatibilite.

Evidence:

- `tests/integration/real-browser-mermaid.test.ts:22` appelle `locateBrowser(process.env.MD2PDF_BROWSER)`.
- `tests/integration/real-browser-mermaid.test.ts:37` appelle ensuite `convertFile(..., { browserPath })`.
- `src/browserLocator.ts:110` est le helper historique qui retourne un chemin.
- `src/browserLocator.ts:229` est le nouveau chemin de validation explicite.

Suggested fix: faire utiliser au smoke le meme chemin runtime que le produit, sans pre-resolution par l'ancien helper; ou renommer le test en preuve historique et le sortir des preuves Phase 3/release.

Test needed: un smoke real-browser qui appelle directement `convertFile` sans `browserPath` force, et qui expose la cause exacte: navigateur absent, driver absent, fallback absent, ou session WebDriver incompatible.

### Finding 5 - La documentation architecture decrit encore le fallback comme absent du catalogue reel

Severity: Low  
File: `docs/architecture.md`, `artifacts.json`  
Line: `docs/architecture.md:293`, `docs/architecture.md:300`, `artifacts.json:30`, `artifacts.json:48`

Problem: l'architecture dit que le `current artifacts.json` ne declare pas de fallback Chromium-for-Testing. Ce n'est plus vrai: `artifacts.json` declare `chromium-for-testing` et `chromedriver-for-testing` pour `win32-x64`.

Risk: le prochain audit ou la prochaine phase peut raisonner sur un etat obsolete: le probleme courant n'est plus "aucun fallback declare", mais "fallback Windows declare/provisionne sans preuve browser-backed verte, et couverture plateforme incomplete".

Evidence:

- Texte stale: `docs/architecture.md:300`-`docs/architecture.md:303`.
- Declaration fallback browser: `artifacts.json:30`-`artifacts.json:45`.
- Declaration fallback driver: `artifacts.json:48`-`artifacts.json:63`.

Suggested fix: avec accord utilisateur, remplacer l'affirmation par un statut plateforme par plateforme: `win32-x64` declare; autres plateformes et preuve browser/release encore bloquees.

Test needed: revue doc-sync apres correction documentaire, sans changer requirements/architecture sans accord explicite.

## Gate Results

| Commande | Resultat |
| --- | --- |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd test` | PASS, 146 passed, 3 skipped, 14 files |
| `npm.cmd run test:artifacts` | PASS, 19 passed, 1 skipped, 2 files |
| `npm.cmd run check:artifacts` | PASS, `Artifact freshness policy passed` |
| `npm.cmd run test:browser` | FAIL, 18 passed, 3 failed |
| `npm.cmd run test:browser -- tests/integration/converter.test.ts -t "timeout fires during session start"` | PASS cible |
| `npm.cmd run test:real-browser` | FAIL, `Pinned browser path is not launchable as a supported browser` |

## Open Questions

- Le critere d'acceptation Phase 3 doit-il rester limite aux trois gates explicites du plan, ou doit-il inclure `test:browser` puisqu'il contient les preuves "chemin browser/WebDriver executable"?
- Le fallback Windows `151.0.7875.0` est-il volontairement la cible de reference, ou faut-il verifier si Chrome for Testing 151 est incompatible avec les capabilities actuelles?
- Le smoke `test:real-browser` doit-il rester comme preuve historique Stream A, ou etre remplace par un test Phase 3 alignant strictement le chemin runtime courant?

## Summary

Verdict: **GO Phase 3 stricte, NO-GO preuve browser-backed/release**.

La Phase 3 a corrige les references absentes et les gates directs passent:
`typecheck`, `npm test`, `test:artifacts` et `check:artifacts` sont verts. Le
chemin runtime n'est toutefois pas encore prouve comme executable de bout en
bout sur Windows: `test:browser` echoue sur les deux conversions reelles, et le
test de timeout session-start est fragile dans le run complet. Le prochain
travail utile est de diagnostiquer le `POST /session` WebDriver du fallback
Windows et de rendre la preuve FR-16 deterministic.
