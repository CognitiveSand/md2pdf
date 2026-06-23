**Audit Recalé Sur P2 Étape 4**

Scope corrigé : **uniquement `src/browserLocator.ts` / étape 4 P2**.  
Je n’ai donc pas compté `fallbackBrowserProvisioner`, `webDriverClient` ou le P2 complet comme bloquants. Ils restent hors scope ou travail anticipé.

Verdict : **AUDIT_FAIL léger pour l’étape 4**, avec 1 finding confirmé important et 1 finding moyen. Les tests passent, mais la détection “non-navigateur” n’est pas réellement prouvée.

**Index**

| Sous-audit | Verdict | Crit | High | Medium | Low |
| --- | --- | ---: | ---: | ---: | ---: |
| Métier / exigences étape 4 | FAIL | 0 | 1 | 0 | 0 |
| Qualité / fail-loud | WARN | 0 | 0 | 1 | 0 |
| Architecture | PASS | 0 | 0 | 0 | 0 |
| Sécurité / abus local | WARN | 0 | 0 | 1 | 0 |

**Matrice Étape 4**

| Contrat | Statut |
| --- | --- |
| Chrome/Chromium/Edge/Brave/Firefox supportés | OK |
| `MD2PDF_BROWSER` supporté | OK |
| Fichier inexistant -> `env-browser-not-found` | OK |
| Non-exécutable -> `env-browser-not-launchable` | OK |
| Non-navigateur -> `env-browser-not-launchable` | **Partiel / FAIL** |
| Navigateur sans driver -> `env-browser-no-eligible-driver` | OK |
| Aucun navigateur + cause artifact | OK au niveau interface, fallback complet hors scope |

**Findings**

**High** - `MD2PDF_BROWSER` accepte un exécutable “qui ressemble” à un navigateur sans le vérifier réellement.  
Preuve : [browserLocator.ts](/Users/samirtamboura/Desktop/md2pdf/src/browserLocator.ts:174) vérifie seulement l’exécutabilité, puis [browserLocator.ts](/Users/samirtamboura/Desktop/md2pdf/src/browserLocator.ts:186) classe le navigateur par chemin/nom. La reconnaissance Chrome accepte notamment `normalized.includes("google chrome")` [browserLocator.ts](/Users/samirtamboura/Desktop/md2pdf/src/browserLocator.ts:326).  
Impact : un fichier exécutable non-navigateur nommé comme un navigateur peut passer l’étape 4, alors que le plan demande `env-browser-not-launchable` pour “non-navigateur” [plan_stream_b.md](/Users/samirtamboura/Desktop/md2pdf/docs/plan_stream_b.md:65).  
Correction attendue : ajouter une validation de launch/version probe, ou au minimum durcir fortement la reconnaissance et tester un faux exécutable nommé Chrome/Firefox.

**Medium** - Les erreurs `ArtifactFreshnessError` du resolver driver sont toutes avalées comme “pas de driver”.  
Preuve : [browserLocator.ts](/Users/samirtamboura/Desktop/md2pdf/src/browserLocator.ts:240) appelle `selectNewestEligible`, puis [browserLocator.ts](/Users/samirtamboura/Desktop/md2pdf/src/browserLocator.ts:245) retourne `null` pour toute `ArtifactFreshnessError`.  
Impact : une vraie erreur de manifest/policy peut être transformée en `env-browser-no-eligible-driver`, moins diagnostique. Pour l’étape 4 ce n’est pas forcément bloquant, mais c’est fragile pour “conforme à ArtifactPolicy” [plan_stream_b.md](/Users/samirtamboura/Desktop/md2pdf/docs/plan_stream_b.md:67).  
Correction attendue : ne convertir en `null` que l’absence d’artifact éligible; propager les erreurs de manifest invalide.

**Points Conformes**

- Les erreurs `MD2PDF_BROWSER` principales sont testées : missing, non-exécutable, unsupported path, no driver.
- Le scan des candidats installés fonctionne avec injection `candidatePaths` + fake FS.
- Firefox snap `/usr/bin/firefox` -> vrai binaire snap est couvert.
- Les commandes passent :
  - `npm run typecheck`
  - `npx vitest run tests/unit/browserLocator/browserLocator.test.ts --reporter=verbose` : 11 tests OK
  - `npm test` : 100 tests OK

**Hors Scope Actuel**

Les anciens findings sur cache fallback, checksum du fallback, WebDriver Print et provisioning complet ne doivent pas bloquer **l’étape 4 seule**. Ils redeviendront pertinents quand tu déclareras les étapes 5, 6 et 7 comme livrées.