# Audit TeamComplete - Security hardening phases 0 a 6

Date: 2026-06-22
Branche auditee: `security`
Commit audite: `8b9aef689336a973f1483d1c9513cf26fc73331c`
Perimetre: code actuel apres implementation des phases 0, 1, 2, 3, 4, 5 et 6 du plan `docs/security-hardening-implementation-plan.md`.

## Verdict global

**AUDIT_PASS avec reserves non bloquantes.**

Les phases 0 a 6 sont implementees et couvertes par des tests unitaires ciblant les limites Markdown, Mermaid, code fences, images locales, containment realpath, signatures/dimensions image et politique de liens passifs. Les gates executes pendant cet audit sont verts.

Une reserve de testabilite reste presente sur le test symlink: il se termine silencieusement si la plateforme refuse la creation du lien symbolique. Ce n'est pas un defaut fonctionnel observe sur cette machine, mais cela peut masquer une absence de couverture sur un autre environnement.

## Sources relues

- `AGENTS.md`
- `ARTIFACT_FRESHNESS_POLICY.md`
- `docs/security-hardening-plan.md`
- `docs/security-hardening-implementation-plan.md`
- `src/markdownRenderer.ts`
- `tests/unit/markdownRenderer/markdownRenderer.test.ts`
- `tests/fixtures/imageFixtures.ts`

Etat du worktree avant creation de ce rapport: deux changements preexistants non lies ont ete observes et non modifies:

- `D audit/2026-06-16-final-complete-audit.md`
- `?? audit/2026-06-16-final-complete-auditaprescorrection.md`

## Findings

### LOW - TEST-01 - Le test symlink peut passer sans assertion sur les plateformes qui refusent les symlinks

Preuve:

- `tests/unit/markdownRenderer/markdownRenderer.test.ts:488` definit le test `rejects symlinks that escape the real baseDir`.
- `tests/unit/markdownRenderer/markdownRenderer.test.ts:498` tente de creer le symlink.
- `tests/unit/markdownRenderer/markdownRenderer.test.ts:500`-`501` intercepte toute erreur puis fait `return`.
- L'assertion de rejet n'est executee qu'apres ce retour potentiel, a `tests/unit/markdownRenderer/markdownRenderer.test.ts:504`-`510`.

Impact:

Sur une plateforme ou un runner CI sans droit symlink, la suite resterait verte sans verifier la protection symlink de la phase 4. Le plan autorise d'ignorer proprement le cas OS, mais le retour silencieux rend le statut de couverture moins visible.

Recommendation:

Transformer ce chemin en skip explicite ou en helper de capacite documente, par exemple avec une detection prealable et un message de skip controle. L'implementation produit reste correcte: `src/markdownRenderer.ts:299`-`319` resout `baseDir` et image via realpath puis verifie le containment.

### INFO - RISK-01 - Les parseurs image sont minimaux, conformes au plan, mais ne prouvent pas une decodabilite complete

Preuve:

- Le plan de phase 5 demande des parseurs minimaux sans dependance: `docs/security-hardening-implementation-plan.md:211`-`214`.
- Le PNG verifie la signature et `IHDR`, puis lit largeur/hauteur: `src/markdownRenderer.ts:572`-`584`.
- Le JPEG a un fallback de scan de marqueur SOF: `src/markdownRenderer.ts:636`-`658`.
- Le test de dimensions PNG modifie directement largeur/hauteur dans une fixture existante: `tests/unit/markdownRenderer/markdownRenderer.test.ts:536`-`540`.

Impact:

Ce choix est acceptable pour les exigences actuelles: SVG/GIF/URI distantes sont rejetees, la signature/extension est controlee, les dimensions et tailles sont bornee, et les images sont transformees en `data:`. En revanche, si l'exigence future devient "image completement decodable par le navigateur", ces parseurs ne suffiront pas a eux seuls.

Recommendation:

Ne rien changer pour les phases 0 a 6 sauf decision produit. Pour une phase ulterieure, soit documenter explicitement que la validation est une validation de type/dimensions minimale, soit ajouter une validation de decodage stricte avec une dependance admissible par la politique de fraicheur.

## Verification par phase

### Phase 0 - Baseline et garde-fous

Statut: **OK**

Le plan impose de ne pas ajouter de nouvel artifact et de respecter la politique de fraicheur: `docs/security-hardening-implementation-plan.md:26`-`35`. Aucun changement d'artifact n'est necessaire pour les phases 0 a 6, et `npm run check:artifacts` passe.

Les gates executes pendant cet audit:

- `npm run typecheck`: OK
- `npm test -- tests/unit/markdownRenderer/markdownRenderer.test.ts`: OK, 29 tests
- `npm test`: OK, 197 tests
- `npm run check:artifacts`: OK

### Phase 1 - Constantes et prevalidation Markdown

Statut: **OK**

Preuves implementation:

- Les constantes de limites attendues sont presentes dans `src/markdownRenderer.ts:32`-`40`.
- `renderToHtml` appelle `validateMarkdownSize` avant le rendu Markdown: `src/markdownRenderer.ts:82`-`88`.
- La validation rejette le document au-dessus de 10 MB et les lignes au-dessus de 1 MB: `src/markdownRenderer.ts:444`-`462`.

Preuves tests:

- Markdown trop gros: `tests/unit/markdownRenderer/markdownRenderer.test.ts:56`-`60`.
- Ligne trop longue: `tests/unit/markdownRenderer/markdownRenderer.test.ts:63`-`68`.

### Phase 2 - Compteurs de rendu et limites structurelles

Statut: **OK**

Preuves implementation:

- `RenderState` contient `imageCount`, `totalImageBytes` et `mermaidBlockCount`: `src/markdownRenderer.ts:58`-`63`.
- L'etat est initialise par rendu: `src/markdownRenderer.ts:464`-`470`.
- Les images sont comptees avant embedding: `src/markdownRenderer.ts:228`-`247` et `src/markdownRenderer.ts:473`-`483`.
- Les blocs Mermaid sont comptes et limites: `src/markdownRenderer.ts:180`-`196` et `src/markdownRenderer.ts:497`-`515`.
- Les code fences non Mermaid sont limites avant highlight: `src/markdownRenderer.ts:199`-`213` et `src/markdownRenderer.ts:517`-`525`.

Preuves tests:

- Code fence trop gros: `tests/unit/markdownRenderer/markdownRenderer.test.ts:70`-`78`.
- Mermaid trop nombreux: `tests/unit/markdownRenderer/markdownRenderer.test.ts:99`-`108`.
- Mermaid trop gros: `tests/unit/markdownRenderer/markdownRenderer.test.ts:110`-`117`.
- Images trop nombreuses: `tests/unit/markdownRenderer/markdownRenderer.test.ts:189`-`209`.

### Phase 3 - Allowlist image et rejet SVG/GIF

Statut: **OK**

Preuves implementation:

- La detection d'extension accepte uniquement `.jpg`, `.jpeg`, `.png` et `.webp`: `src/markdownRenderer.ts:527`-`548`.
- SVG a un message dedie et est refuse avant lecture contenu: `src/markdownRenderer.ts:534`-`539`, appele avant resolution/lecture a `src/markdownRenderer.ts:274`-`276`.

Preuves tests:

- SVG hostile refuse, incluant `http`, `https`, `file`, `<script>` et `<foreignObject>`: `tests/unit/markdownRenderer/markdownRenderer.test.ts:211`-`240`.
- GIF, sans extension et format inconnu refuses: `tests/unit/markdownRenderer/markdownRenderer.test.ts:242`-`249`.
- PNG/JPEG/WebP valides acceptes: `tests/unit/markdownRenderer/markdownRenderer.test.ts:142`-`166`.

### Phase 4 - Realpath containment des images

Statut: **OK avec reserve TEST-01**

Preuves implementation:

- Les URI, schemes et chemins absolus sont rejetes avant resolution disque: `src/markdownRenderer.ts:281`-`296`.
- `baseDir` et image candidate sont resolus via `realpathSync`: `src/markdownRenderer.ts:298`-`309`.
- Le containment est verifie sur chemins reels: `src/markdownRenderer.ts:311`-`319` et `src/markdownRenderer.ts:779`-`782`.
- Les fichiers manquants conservent une erreur de lecture explicite: `src/markdownRenderer.ts:322`-`333`.

Preuves tests:

- Image normale et sous-dossier acceptees: `tests/unit/markdownRenderer/markdownRenderer.test.ts:168`-`187`.
- `baseDir` explicite accepte: `tests/unit/markdownRenderer/markdownRenderer.test.ts:357`-`375`.
- Image manquante garde une erreur lisible: `tests/unit/markdownRenderer/markdownRenderer.test.ts:377`-`399`.
- Traversal refuse: `tests/unit/markdownRenderer/markdownRenderer.test.ts:472`-`486`.
- Symlink sortant refuse quand le symlink est cree: `tests/unit/markdownRenderer/markdownRenderer.test.ts:488`-`515`.

### Phase 5 - Signature, taille et dimensions image

Statut: **OK**

Preuves implementation:

- Lecture/validation centralisee: `src/markdownRenderer.ts:335`-`363`.
- Rejet image unique au-dessus de 20 MB: `src/markdownRenderer.ts:340`-`348`.
- Detection signature et comparaison extension/contenu: `src/markdownRenderer.ts:350`-`357`.
- Rejet dimensions au-dessus de 25 MP: `src/markdownRenderer.ts:735`-`743`.
- Cumul image au-dessus de 100 MB refuse: `src/markdownRenderer.ts:485`-`495`.
- Parseurs PNG/JPEG/WebP: `src/markdownRenderer.ts:551`-`725`.

Preuves tests:

- Contenu non image refuse: `tests/unit/markdownRenderer/markdownRenderer.test.ts:251`-`270`.
- Signature/extension mismatch refuse: `tests/unit/markdownRenderer/markdownRenderer.test.ts:272`-`289`.
- Image unique >20 MB refusee: `tests/unit/markdownRenderer/markdownRenderer.test.ts:291`-`308`.
- Dimensions >25 MP refusees: `tests/unit/markdownRenderer/markdownRenderer.test.ts:310`-`327`.
- Cumul >100 MB refuse: `tests/unit/markdownRenderer/markdownRenderer.test.ts:329`-`355`.

### Phase 6 - Politique de liens passifs

Statut: **OK**

Preuves cadrage:

- La politique produit autorise uniquement `https://...`: `docs/security-hardening-plan.md:163`-`189`.
- Le plan d'implementation demande de conserver `href` seulement pour HTTPS, de bloquer HTTP/dangerous/local, et de ne jamais appliquer cette autorisation aux images: `docs/security-hardening-implementation-plan.md:232`-`256`.

Preuves implementation:

- `renderLinkOpen` retire `href` et marque `data-md2pdf-blocked-href="true"` si le lien n'est pas HTTPS passif: `src/markdownRenderer.ts:250`-`261`.
- La detection HTTPS passif est centralisee: `src/markdownRenderer.ts:766`-`768`.
- Les images distantes restent refusees par `isRemoteOrSchemeReference`: `src/markdownRenderer.ts:264`-`278` et `src/markdownRenderer.ts:770`-`777`.
- Le HTML assemble n'autorise que `img-src data:` et n'ajoute pas de `script src`/`link href` externe: `src/markdownRenderer.ts:384`-`408`.

Preuves tests:

- HTTPS conserve, HTTP bloque, aucune ressource reseau active: `tests/unit/markdownRenderer/markdownRenderer.test.ts:401`-`422`.
- Schemas dangereux, `/etc/passwd` et chemin relatif local bloques: `tests/unit/markdownRenderer/markdownRenderer.test.ts:424`-`441`.
- Image HTTPS distante refusee: `tests/unit/markdownRenderer/markdownRenderer.test.ts:443`-`447`.
- File URL et chemin absolu image refuses: `tests/unit/markdownRenderer/markdownRenderer.test.ts:449`-`470`.

## Couverture specialist TeamComplete

### Metier / exigences

Statut: **OK**

Les exigences explicites des phases 0 a 6 sont tracees vers le code et les tests. La decision utilisateur de garder les liens HTTPS cliquables est respectee: un lien `https://...` reste en `href`, tandis que les images distantes HTTPS restent refusees.

### Qualite / tests

Statut: **OK avec reserve LOW TEST-01**

Les tests unitaires ciblent les chemins hostiles importants: tailles, formats, SVG hostile, traversal, symlink, schemes dangereux, ressources reseau actives. La seule reserve est le skip implicite du test symlink.

### Architecture / simplicite

Statut: **OK**

Le durcissement reste localise dans `src/markdownRenderer.ts`, sans nouvelle dependance ni nouveau moteur. Les controles sont proches des points d'entree: prevalidation avant parsing, image validation avant embedding, lien filtre au rendu token.

### Cybersecurite

Statut: **OK**

Les vecteurs principaux du Markdown hostile couverts par les phases 0 a 6 sont bloques: SVG actif, images distantes, `file:`/schemes, chemins absolus, symlinks sortants, explosions de taille, mismatch extension/signature et liens actifs dangereux. Les liens HTTPS restent passifs: ils sont presents comme ancres, sans chargement de ressource distante pendant le rendu.

## Gates executes

```bash
npm run typecheck
npm test -- tests/unit/markdownRenderer/markdownRenderer.test.ts
npm test
npm run check:artifacts
```

Resultats:

- `npm run typecheck`: OK
- `npm test -- tests/unit/markdownRenderer/markdownRenderer.test.ts`: OK, 1 fichier, 29 tests
- `npm test`: OK, 16 fichiers, 197 tests
- `npm run check:artifacts`: OK

## Conclusion

Les phases 0 a 6 du security hardening peuvent etre considerees comme validees sur le code actuel. La seule action conseillee avant d'oublier le sujet est d'expliciter le skip symlink pour eviter une couverture faussement verte sur certains environnements CI.
