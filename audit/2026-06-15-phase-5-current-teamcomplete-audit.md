# Audit implementation phase 5 - Clarifier provisioning / conversion local-only

Date: 2026-06-15

Source de verite:

- `docs/post-audit-remediation-plan-2026-06-12.md`, section "Phase 5 - Clarifier la frontiere provisioning / conversion local-only" lignes 271-300.
- Commit audite: `c247fa43c7294da01addd7e9ca8a32fac762e5bd` (`fix: enforce local-only conversion boundary`).

Perimetre audite:

- `src/converter.ts`
- `src/browserLocator.ts`
- `src/webDriverClient.ts`
- `src/webDriverSession.ts`
- `src/markdownRenderer.ts`
- `tests/integration/converter.test.ts`
- `tests/integration/browserBackedConversion.test.ts`
- `tests/unit/browserLocator/browserLocator.test.ts`
- `tests/unit/webDriverClient/webDriverClient.test.ts`
- `tests/unit/markdownRenderer/markdownRenderer.test.ts`

Commandes executees:

```text
npm.cmd run typecheck
Resultat: PASS

npm.cmd test
Resultat: PASS - 14 fichiers, 152 tests passes, 3 skipped

npm.cmd run test:browser
Resultat: FAIL - 2 tests browser-backed reels echouent
```

## Requirement and User Story Compliance

| Exigence phase 5 | Statut | Evidence | Probleme |
| --- | --- | --- | --- |
| Definir l'ordre normatif exact: provisioning autorise avant conversion, conversion local-only, provisioning ne lit pas le Markdown, conversion pre-provisionnee sans connexion sortante | Partiel | `src/converter.ts:103-106` localise/provisionne avant `readFile`; `tests/integration/converter.test.ts:86-158` verifie que le locator ne recoit pas le contenu Markdown et que l'echec de provisioning ne lit pas le Markdown. | La partie "conversion pre-provisionnee n'ouvre pas de connexion sortante" n'est pas prouvee; le test real-browser peut encore provisionner pendant `convertFile`. |
| Ajuster le convertisseur pour que cet ordre soit observable | Partiel | `tests/integration/converter.test.ts:113-131` observe `locate` avant `read`. | L'observation s'arrete a l'ordre locate/read; elle ne distingue pas un etat pre-provisionne d'un first-run qui telecharge/provisionne. |
| Test: provisioning ne recoit jamais le contenu Markdown | Partiel | `tests/integration/converter.test.ts:86-110` verifie seulement `ConvertOptions`. | Le test ne couvre pas le resolver/catalog/policy/fallback reels; il ne prouve pas que tout le chemin de provisioning reste sans acces au fichier Markdown. |
| Test: conversion depuis etat pre-provisionne ne provisionne pas | Manquant | `tests/integration/browserBackedConversion.test.ts:17-20` configure seulement un cache; `tests/integration/browserBackedConversion.test.ts:78-83` utilise `new DocumentConverter()` avec le locator par defaut. | Aucune instrumentation ne prouve que `provisionFallbackBrowser` n'est pas appele pendant la conversion. |
| Test: HTML assemble ne contient pas d'URL externe exploitable | Couvert | `tests/unit/markdownRenderer/markdownRenderer.test.ts:135-152`; `src/markdownRenderer.ts:203-217`, `src/markdownRenderer.ts:290`. | Couverture acceptable au niveau HTML statique; le texte brut peut encore contenir une URL externe mais sans attribut exploitable. |
| Test: WebDriver local refuse endpoints non locaux | Couvert | `src/webDriverClient.ts:246-264`, `src/webDriverClient.ts:282-291`; `tests/unit/webDriverClient/webDriverClient.test.ts:410-424`. | Pas de probleme bloquant trouve sur ce point. |
| Test: browser lance avec flags offline/no-proxy quand supportes | Couvert au niveau unitaire | `src/webDriverClient.ts:374-404`; `tests/unit/webDriverClient/webDriverClient.test.ts:14-101`. | La preuve browser reelle echoue, donc ces flags ne suffisent pas encore a fermer le gate phase 5. |
| Marquer les limites non interceptables comme risques documentes | Partiel | `docs/architecture.md` contient deja un risque R-3, mais le commit de phase 5 ne l'a pas mis a jour. | L'audit n'a trouve aucune nouvelle reconciliation documentaire liee a l'echec actuel de `test:browser`. |
| Gate phase 5: `npm.cmd test` et `npm.cmd run test:browser` | Non respecte | `npm.cmd test` passe; `npm.cmd run test:browser` echoue deux fois, y compris relance seule. | Phase 5 ne peut pas etre declaree terminee. |

## Negative Findings

### Finding 1 - Le gate obligatoire `test:browser` est rouge

Severity: Critical

File: `tests/integration/browserBackedConversion.test.ts`

Line: 40, 133

Problem:

La phase 5 exige explicitement le gate:

```text
npm.cmd test
npm.cmd run test:browser
```

`npm.cmd test` passe, mais `npm.cmd run test:browser` echoue sur les deux tests browser-backed reels:

- `@req FR-01 @req FR-07 @req FR-24 @req NFR-02 renders Mermaid to a real PDF with a pre-provisioned browser`
- `@req FR-04 @req FR-05 @req FR-06 renders rich Markdown and a relative image to a real PDF`

Les deux echouent avec:

```text
RenderError: WebDriver request failed
src/webDriverClient.ts:128
```

Risk:

La phase 5 pretend durcir NFR-02, mais son gate de validation ne passe pas. Le projet ne prouve donc pas qu'une conversion browser-backed locale fonctionne en pratique, encore moins qu'elle fonctionne depuis un etat pre-provisionne et offline/no-proxy.

Evidence:

- `tests/integration/browserBackedConversion.test.ts:40-94` contient le test Mermaid real-browser marque NFR-02.
- `tests/integration/browserBackedConversion.test.ts:133-149` contient le test rich Markdown real-browser.
- `src/webDriverClient.ts:126-130` transforme les reponses HTTP WebDriver non-OK en `RenderError`.
- Relance isolee de `npm.cmd run test:browser`: 2 echecs sur 23 tests.

Suggested fix:

Diagnostiquer la reponse WebDriver reelle dans ces deux tests, puis corriger la compatibilite browser/driver/capabilities ou l'environnement de test. La phase ne doit pas etre marquee complete tant que `test:browser` reste rouge.

Test needed:

Relancer `npm.cmd run test:browser` apres correction et conserver la sortie comme preuve de phase.

### Finding 2 - Le test "pre-provisioned browser" peut encore provisionner pendant `convertFile`

Severity: High

File: `tests/integration/browserBackedConversion.test.ts`

Line: 17, 78, 82

Problem:

Le test real-browser annonce "with a pre-provisioned browser", mais il ne pre-provisionne pas explicitement le navigateur/driver et ne verifie pas qu'aucun provisioning n'a lieu pendant `convertFile`.

Il configure seulement `MD2PDF_ARTIFACT_CACHE` (`tests/integration/browserBackedConversion.test.ts:17-20`), puis instancie `new DocumentConverter()` (`tests/integration/browserBackedConversion.test.ts:78-80`) et appelle `convertFile` (`tests/integration/browserBackedConversion.test.ts:82-84`). Or le convertisseur par defaut installe toujours un fallback resolver (`src/converter.ts:252-263`), dont `resolveFallbackBrowser` appelle `provisionFallbackBrowser` (`src/converter.ts:272-273`).

Risk:

Le test peut valider un first-run qui provisionne pendant la commande de conversion, au lieu de prouver le scenario demande par la phase 5: "conversion depuis etat pre-provisionne ne provisionne pas" et "conversion pre-provisionnee n'ouvre pas de connexion sortante".

Evidence:

- `src/browserLocator.ts:191-193` accepte le fallback si aucun browser/driver installe n'est utilisable.
- `src/browserLocator.ts:217` appelle le fallback resolver.
- `src/converter.ts:272-273` appelle `provisionFallbackBrowser`.
- Aucun test ne spy/stub `provisionFallbackBrowser` ni ne force un resolver pre-provisionne qui echoue si un provisioning est tente pendant conversion.

Suggested fix:

Ajouter un test separe qui prepare explicitement un etat pre-provisionne, injecte un resolver/locator qui ne peut que reutiliser cet etat, et echoue si un chemin de provisioning/download est appele pendant `convertFile`.

Test needed:

Un test NFR-02 dedie "pre-provisioned conversion does not provision" avec instrumentation du resolver/fallback/provisioner, distinct du test browser-backed de rendu PDF.

### Finding 3 - La preuve "provisioning ne recoit jamais le contenu Markdown" est trop superficielle

Severity: Medium

File: `tests/integration/converter.test.ts`

Line: 86, 97, 107

Problem:

Le test ajoute pour NFR-02 serialise uniquement les `ConvertOptions` captures par `browserLocatorFactory` et verifie que ces options ne contiennent pas des fragments du Markdown. Cela prouve que le contenu Markdown n'est pas passe dans l'objet options, mais pas que le chemin de provisioning reel ne peut pas acceder au fichier source ou a son contenu.

Risk:

Une regression future pourrait introduire une lecture du Markdown dans `BrowserLocator`, `ArtifactPolicyFallbackBrowserResolver`, `JsonReleaseCatalog` ou `provisionFallbackBrowser` sans etre detectee par ce test, tant que les options ne contiennent pas la chaine testee.

Evidence:

- `tests/integration/converter.test.ts:86-110` capture uniquement `options`.
- Le chemin reel inclut `defaultBrowserLocatorFactory` et `ArtifactPolicyFallbackBrowserResolver` (`src/converter.ts:252-273`), qui ne sont pas exerces par ce test.

Suggested fix:

Renforcer le test avec un fake file system qui echoue si le Markdown est lu avant le provisioning, plus un locator/provisioner instrumente. Pour le chemin par defaut, ajouter un test d'integration qui verifie que le provisioning n'a pas de dependance vers `sourcePath` ou vers le contenu Markdown.

Test needed:

Un test qui enregistre les appels aux dependances du provisioning reel et echoue si `readFile(sourcePath, "utf8")` se produit avant la fin du provisioning, ou si le contenu Markdown est observe par le chemin de provisioning.

### Finding 4 - L'ordre `locate -> read` degrade les erreurs utilisateur sur fichier source manquant

Severity: Medium

File: `src/converter.ts`

Line: 103, 106

Problem:

Pour respecter l'ordre "provisioning avant conversion", `convertFile` appelle maintenant `browserLocatorFactory(options).locate()` avant de lire le Markdown. Consequence: si le fichier Markdown est absent mais que le navigateur/driver/fallback est absent ou casse, l'utilisateur recevra une erreur de browser/provisioning au lieu de l'erreur directe "Markdown source could not be read during conversion".

Le test unitaire a ete adapte en injectant un fake browser locator (`tests/unit/converter/converter.test.ts`) au lieu de verifier le comportement par defaut. Cela masque le changement d'experience sur le vrai chemin.

Risk:

Une faute simple de chemin source peut declencher du provisioning, des verifications d'artifact, voire une tentative de fallback avant que l'outil dise que le fichier d'entree n'existe pas. C'est coherent avec une lecture stricte de la phase 5, mais c'est un cout UX et operationnel qui doit etre assume et teste explicitement.

Evidence:

- `src/converter.ts:103` localise/provisionne avant toute lecture source.
- `src/converter.ts:106-116` ne produit l'erreur de lecture Markdown qu'apres succes du locator.
- Le test "reports source read failures..." injecte un locator fake pour eviter le chemin reel.

Suggested fix:

Documenter ce compromis dans le plan de phase ou ajouter une preflight metadata-only qui verifie existence/accessibilite sans lire le contenu Markdown. Cette preflight doit etre explicitement distinguee de la lecture du Markdown pour ne pas casser NFR-02.

Test needed:

Un test qui couvre le comportement attendu quand le source est manquant et que le browser locator reel echoue aussi, afin que la priorite d'erreur soit volontaire et non accidentelle.

## Open Questions

1. La phase 5 autorise-t-elle `convertFile` a provisionner pendant le meme appel public, tant que cela arrive avant la lecture Markdown, ou faut-il introduire une commande/API de pre-provisioning separee?
2. Le gate `test:browser` doit-il etre considere release-grade dans cette phase, ou seulement integration locale? Le plan le liste comme gate, donc cet audit le traite comme bloquant.
3. Faut-il capturer la reponse WebDriver brute dans les tests en echec pour rendre le diagnostic actionnable sans relancer en mode debug?

## Summary

La phase 5 est seulement partiellement implementee. Le commit corrige un bout important de l'ordre local-only (`locate` avant `read`) et ajoute des tests utiles autour de la fuite du contenu Markdown vers les options. En revanche, la preuve centrale "pre-provisioned conversion does not provision / no outbound connection during conversion" reste absente, et le gate obligatoire `npm.cmd run test:browser` est rouge. Statut audit: **NO-GO phase 5**.
