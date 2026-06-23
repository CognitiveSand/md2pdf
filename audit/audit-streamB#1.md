## Resume De L'Audit

| Division | Statut | Synthese |
| --- | --- | --- |
| Metier | 🟡 Avertissement | Le coeur Markdown P1 est present, mais des ecarts existent sur la portee des images et l’etat Mermaid sans diagramme. |
| Qualite | 🟡 Avertissement | Tests rapides verts, mais ils ratent plusieurs mutations importantes. |
| Architecture | 🟡 Avertissement | HTML local globalement conforme, mais contradiction doc/code sur les URLs du bundle Mermaid. |
| Cybersecurite Offensive | 🔴 Bloquant | Conformite artifact fragilisee par asset vendore non declare et surface de lecture locale trop large. |

## Index Des Sous-Audits

| Sous-audit | Scope | Crit | High | Medium | Low | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Business Logic | `markdownRenderer` P1 | 0 | 0 | 2 | 0 | FAIL |
| Requirements Compliance | Stream B P1 | 0 | 1 | 2 | 0 | FAIL |
| Doc-Sync | docs/architecture/plan | 0 | 0 | 1 | 0 | FAIL |
| Test Quality | tests renderer | 0 | 0 | 2 | 0 | FAIL |
| Layer/YAGNI/SRE | renderer module | 0 | 0 | 1 | 1 | WARN |
| Security/Supply Chain | local HTML/assets | 0 | 1 | 2 | 0 | FAIL |

## Matrice Courte

| Req/Contrat | Preuve | Statut |
| --- | --- | --- |
| FR-04 dialecte | [src/markdownRenderer.ts](/Users/samirtamboura/Desktop/md2pdf/src/markdownRenderer.ts:50), [tests](/Users/samirtamboura/Desktop/md2pdf/tests/unit/markdownRenderer/markdownRenderer.test.ts:11) | Partiel OK |
| FR-05 highlighting | [src/markdownRenderer.ts](/Users/samirtamboura/Desktop/md2pdf/src/markdownRenderer.ts:100), [tests](/Users/samirtamboura/Desktop/md2pdf/tests/unit/markdownRenderer/markdownRenderer.test.ts:36) | OK |
| FR-06 images relatives | [src/markdownRenderer.ts](/Users/samirtamboura/Desktop/md2pdf/src/markdownRenderer.ts:161), [tests](/Users/samirtamboura/Desktop/md2pdf/tests/unit/markdownRenderer/markdownRenderer.test.ts:61) | OK, mais trop permissif |
| FR-16 render failure | [src/markdownRenderer.ts](/Users/samirtamboura/Desktop/md2pdf/src/markdownRenderer.ts:193), [tests](/Users/samirtamboura/Desktop/md2pdf/tests/unit/markdownRenderer/markdownRenderer.test.ts:77) | OK |
| FR-24 Mermaid | [src/markdownRenderer.ts](/Users/samirtamboura/Desktop/md2pdf/src/markdownRenderer.ts:79), [tests](/Users/samirtamboura/Desktop/md2pdf/tests/unit/markdownRenderer/markdownRenderer.test.ts:48) | HTML OK, PDF non scope |
| NFR-02 local-only | [src/markdownRenderer.ts](/Users/samirtamboura/Desktop/md2pdf/src/markdownRenderer.ts:214), [tests](/Users/samirtamboura/Desktop/md2pdf/tests/unit/markdownRenderer/markdownRenderer.test.ts:101) | Partiel |
| NFR-05 freshness | [ARTIFACT_FRESHNESS_POLICY.md](/Users/samirtamboura/Desktop/md2pdf/ARTIFACT_FRESHNESS_POLICY.md:47), [artifacts.json](/Users/samirtamboura/Desktop/md2pdf/artifacts.json:5) | FAIL |

## Top Findings

1. **High** - Asset vendore non declare sous politique artifact.  
Preuve: [ARTIFACT_FRESHNESS_POLICY.md](/Users/samirtamboura/Desktop/md2pdf/ARTIFACT_FRESHNESS_POLICY.md:47) exige les non-npm artifacts declares ; [assets/highlight.css](/Users/samirtamboura/Desktop/md2pdf/assets/highlight.css:1) est un theme `highlight.js` bundle ; [artifacts.json](/Users/samirtamboura/Desktop/md2pdf/artifacts.json:5) declare `artifacts: []`.  
Impact: NFR-05 peut etre faussement verte. Correction: declarer provenance/version/checksum ou generer depuis la dependance npm controlee.

2. **Medium** - HTML sans Mermaid reste en `data-mermaid-status="pending"` sans runner.  
Preuve: [src/markdownRenderer.ts](/Users/samirtamboura/Desktop/md2pdf/src/markdownRenderer.ts:206), [src/markdownRenderer.ts](/Users/samirtamboura/Desktop/md2pdf/src/markdownRenderer.ts:210), runner ajoute seulement si Mermaid [src/markdownRenderer.ts](/Users/samirtamboura/Desktop/md2pdf/src/markdownRenderer.ts:221).  
Impact: un futur `pdfRenderer` qui attend `done` peut timeout sur documents ordinaires. Correction: status `done` quand `hasMermaid === false`.

3. **Medium** - Images absolues/locales acceptables par le code, alors que le contrat parle d’images relatives.  
Preuve: exigence relative [docs/project_requirements.md](/Users/samirtamboura/Desktop/md2pdf/docs/project_requirements.md:75), code accepte `file:`/absolu [src/markdownRenderer.ts](/Users/samirtamboura/Desktop/md2pdf/src/markdownRenderer.ts:176) et lit directement [src/markdownRenderer.ts](/Users/samirtamboura/Desktop/md2pdf/src/markdownRenderer.ts:189).  
Type: [RISQUE] si Markdown non fiable. Impact: lecture/embedding de fichiers locaux hors dossier source. Correction: refuser `file:`/absolu ou borner à `baseDir`.

4. **Medium** - Ecart documentaire: architecture promet “no external URL appears”, mais Mermaid inline contient des URLs.  
Preuve: promesse [docs/architecture.md](/Users/samirtamboura/Desktop/md2pdf/docs/architecture.md:249), inlining brut [src/markdownRenderer.ts](/Users/samirtamboura/Desktop/md2pdf/src/markdownRenderer.ts:221). Probe: `withMermaidHasHttp=true`.  
Correction: ajuster doc vers “aucune URL exploitable” ou filtrer/commenter la preuve.

## Points Conformes

- `npm run typecheck`: vert.
- `npm test`: vert, 18 tests.
- `npm run check:artifacts`: vert.
- `npm --cache /private/tmp/md2pdf-npm-cache pack --dry-run`: vert.
- Mermaid est inline sans CDN et rendu comme bloc navigateur.
- HTML utilisateur brut est desactive (`html: false`), bon choix.

## Limites

- Audit lecture seule: aucune correction appliquee.
- Le rendu PDF/browser n’est pas implemente, donc FR-07/FR-24 PDF final non verifiables ici.
- `npm pack --dry-run` avec cache npm par defaut a echoue sur `~/.npm` root-owned ; avec cache temporaire autorise, il passe.
- Un fichier vide non tracke `Bn` est apparu pendant une probe shell mal quotee ; je ne l’ai pas supprime en mode audit.