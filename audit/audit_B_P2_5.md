**Audit `auditcompleteTeam_agent` - Stream B P2 Étape 5**

Verdict : **AUDIT_FAIL** pour l’étape 5, malgré les tests verts.  
Le code couvre bien la majorité du contrat `ArtifactPolicy`, mais il reste un défaut confirmé important : la quarantaine de 7 jours est paramétrable à la baisse par l’appelant.

**Résumé Global**

| Division | Statut | Synthèse |
| --- | --- | --- |
| Métier | 🔴 Bloquant | La règle “7-day quarantine, no bypass” peut être contournée via `constraints.quarantineDays`. |
| Qualité | 🟡 Avertissement | Tests solides sur URL/version/checksum, mais pas de test anti-bypass quarantaine. |
| Architecture | 🟢 OK | `ArtifactPolicy` reste isolé et injecté proprement dans le resolver driver. |
| Sécurité | 🔴 Bloquant | La policy dépend trop de la bonne foi du caller pour la durée de quarantaine. |

**Matrice Étape 5**

| Contrat | Preuve | Statut |
| --- | --- | --- |
| Sélection newest eligible | [artifactPolicy.ts](/Users/samirtamboura/Desktop/md2pdf/src/artifactPolicy.ts:35) | OK |
| Rejet `latest` / tags flottants | [artifactPolicy.ts](/Users/samirtamboura/Desktop/md2pdf/src/artifactPolicy.ts:76) | OK |
| URL immuable HTTPS | [artifactPolicy.ts](/Users/samirtamboura/Desktop/md2pdf/src/artifactPolicy.ts:126) | OK |
| SHA-256 / size / provenance obligatoires | [artifactPolicy.ts](/Users/samirtamboura/Desktop/md2pdf/src/artifactPolicy.ts:84) | OK |
| Erreur si aucune version éligible | [artifactPolicy.ts](/Users/samirtamboura/Desktop/md2pdf/src/artifactPolicy.ts:40) | OK |
| Quarantaine 7 jours sans bypass | [artifactPolicy.ts](/Users/samirtamboura/Desktop/md2pdf/src/artifactPolicy.ts:34) | **FAIL** |

**Top Finding**

**High** - La durée de quarantaine peut être réduite par l’appelant.  
Preuve : `selectNewestEligible` calcule le cutoff avec `constraints.quarantineDays` directement [artifactPolicy.ts](/Users/samirtamboura/Desktop/md2pdf/src/artifactPolicy.ts:34). Or la policy projet impose 7 jours et aucun bypass [ARTIFACT_FRESHNESS_POLICY.md](/Users/samirtamboura/Desktop/md2pdf/ARTIFACT_FRESHNESS_POLICY.md:41), [ARTIFACT_FRESHNESS_POLICY.md](/Users/samirtamboura/Desktop/md2pdf/ARTIFACT_FRESHNESS_POLICY.md:44).  
Impact : un appel à `selectNewestEligible(releases, { quarantineDays: 0 }, now)` peut sélectionner une release publiée le jour même.  
Correction attendue : refuser `quarantineDays < 7` ou supprimer la variabilité côté runtime policy en imposant une constante minimale de 7 jours.

**Détails Par Sous-Audit**

- Business Logic Auditor : FAIL. La règle centrale “newest eligible après 7 jours” est implémentée, mais pas protégée contre un caller permissif.
- Requirements Compliance Auditor : FAIL sur absence de bypass quarantaine; PASS sur versions flottantes, URL immuable, checksum, size, provenance.
- Test Quality Auditor : WARN. Les tests couvrent bien les mauvais manifests [contracts.test.ts](/Users/samirtamboura/Desktop/md2pdf/tests/unit/contracts/contracts.test.ts:169), mais aucun test ne prouve qu’une quarantaine inférieure à 7 est rejetée.
- Supply Chain Auditor : FAIL. La policy artifact est la frontière de sécurité; elle doit imposer la règle, pas seulement recevoir une valeur supposée correcte.

**Points Conformes**

- `ArtifactPolicyDriverResolver` propage maintenant les manifests invalides au lieu de les masquer [browserLocator.ts](/Users/samirtamboura/Desktop/md2pdf/src/browserLocator.ts:267).
- Les tests étape 5 rejettent `latest`, URLs mutables, checksum invalide, size invalide, provenance vide [contracts.test.ts](/Users/samirtamboura/Desktop/md2pdf/tests/unit/contracts/contracts.test.ts:182).
- Validations passées :
  - `npm run typecheck`
  - `npx vitest run tests/unit/contracts/contracts.test.ts tests/unit/browserLocator/browserLocator.test.ts --reporter=verbose`
  - `npm test` : 105 tests OK
  - `npm run check:artifacts`
  - `npm run test:artifacts`
  - `git diff --check`

**Hors Scope**

Les fichiers anticipés des étapes 6-7 (`fallbackBrowserProvisioner`, `webDriverClient`) ne bloquent pas ce verdict, sauf là où ils appellent directement `ArtifactPolicy`.