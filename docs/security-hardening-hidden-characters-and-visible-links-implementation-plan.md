# Security Hardening Hidden Characters And Visible Links - Implementation Plan

Source de cadrage:

- `docs/security-hardening-hidden-characters-and-visible-links-plan.md`
- `ARTIFACT_FRESHNESS_POLICY.md`

Ce plan decrit l'ordre d'implementation pour ajouter une couche de durcissement
contre les caracteres invisibles, les controles dangereux, les caracteres de
reordonnancement bidirectionnel et les liens HTTPS visuellement trompeurs.

Aucun nouvel artifact tiers n'est requis.

## 1. Objectif

Mettre en place tous les points du plan "Security Hardening Plan - Hidden
Characters And Visible Links":

- rejeter le Markdown contenant des caracteres de controle non autorises;
- rejeter les caracteres invisibles ou modifiant l'ordre visuel du texte;
- conserver un lien PDF cliquable uniquement si le texte visible est exactement
  l'URL cible;
- bloquer les URLs HTTPS ambigues, malformees, avec credentials ou caracteres
  dangereux;
- conserver le texte visible des liens bloques en retirant seulement `href`;
- marquer les liens bloques avec `data-md2pdf-blocked-href="true"`;
- couvrir le comportement par tests unitaires et integration.

## 2. Regles de travail

- Ne pas ajouter de dependance, moteur, binaire, police, asset distant ou driver.
- Toute modification future d'artifact doit respecter
  `ARTIFACT_FRESHNESS_POLICY.md` avant d'etre referencee.
- Toutes les erreurs de rejet pre-parsing doivent utiliser `RenderError` avec:
  - un message clair;
  - `sourcePath`;
  - un `actionHint` demandant de retirer les caracteres de formatage caches;
  - si raisonnablement disponible, ligne et colonne dans la cause ou le
    contexte.
- Les liens bloques ne doivent pas interrompre le rendu: ils restent visibles,
  mais ne doivent plus etre cliquables.
- Le comportement doit etre conservateur: en cas d'ambiguite, le lien devient
  non cliquable.
- Ne pas modifier requirements, user stories ou architecture sans validation
  utilisateur explicite prealable.

## 3. Fichiers principaux concernes

Implementation:

- `src/markdownRenderer.ts`: prevalidation Markdown, rendu des liens,
  extraction du texte visible, validation d'URL.
- `src/errors.ts`: uniquement si le format actuel de `RenderError` ne permet pas
  de transporter proprement le contexte ligne/colonne.

Tests:

- `tests/unit/markdownRenderer/markdownRenderer.test.ts`
- `tests/integration/converter.test.ts`

Documentation de suivi:

- `docs/security-hardening-hidden-characters-and-visible-links-plan.md` reste le
  document de cadrage.
- Ce fichier reste le plan d'execution.

## 4. Phase 0 - Baseline et verification d'etat

1. Confirmer l'etat courant du depot:
   - `git status --short`
2. Lancer les controles cibles avant modification:
   - `npm run typecheck`
   - `npm test -- tests/unit/markdownRenderer/markdownRenderer.test.ts`
   - `npm test -- tests/integration/converter.test.ts`
3. Identifier les tests existants qui devront changer parce que le comportement
   actuel accepte encore `[safe](https://example.invalid/report)` comme lien
   cliquable avec un label different de l'URL.
4. Confirmer qu'aucun nouvel artifact n'est necessaire.

Gate de sortie:

```bash
npm run typecheck
npm test -- tests/unit/markdownRenderer/markdownRenderer.test.ts
npm test -- tests/integration/converter.test.ts
```

## 5. Phase 1 - Helper de detection des caracteres dangereux

1. Ajouter dans `src/markdownRenderer.ts` un helper dedie, par exemple:
   - `findDangerousMarkdownCharacter(markdown: string)`;
   - ou `validateMarkdownCharacters(markdown, context)`.
2. Rejeter les caracteres de controle C0/C1 sauf:
   - `\n`;
   - `\r`;
   - `\t`.
3. Rejeter les caracteres invisibles ou modifiant l'ordre visuel:
   - `U+00AD`;
   - `U+200B`;
   - `U+200C`;
   - `U+200D`;
   - `U+202A` a `U+202E`;
   - `U+2060`;
   - `U+2063`;
   - `U+2066` a `U+2069`;
   - `U+FEFF` dans le contenu.
4. Calculer la position utilisateur:
   - ligne basee sur 1;
   - colonne basee sur 1;
   - gerer `\r\n`, `\n` et `\r`.
5. Produire un message clair, par exemple:
   - "Markdown document contains hidden or unsafe formatting characters";
   - "Markdown document contains unsafe control characters".
6. Ajouter un `actionHint` explicite:
   - "Remove hidden formatting characters from the Markdown source before
     converting it."

Gate de sortie:

```bash
npm run typecheck
npm test -- tests/unit/markdownRenderer/markdownRenderer.test.ts
```

## 6. Phase 2 - Prevalidation avant parsing Markdown

1. Appeler le nouveau helper au debut de `renderToHtml`, avant instanciation et
   execution du renderer Markdown.
2. Conserver l'ordre de validation suivant:
   - taille globale Markdown;
   - longueur des lignes;
   - caracteres caches/dangereux.
3. S'assurer que les erreurs de caracteres dangereux surviennent avant:
   - parsing Markdown;
   - resolution image;
   - rendu Mermaid;
   - highlighting.
4. Garantir que `sourcePath` est present dans toutes les erreurs issues de cette
   prevalidation.

Gate de sortie:

```bash
npm run typecheck
npm test -- tests/unit/markdownRenderer/markdownRenderer.test.ts
```

## 7. Phase 3 - Extraction du texte visible des liens

1. Adapter `renderLinkOpen` pour pouvoir comparer le `href` avec le texte
   visible du lien.
2. Utiliser les tokens Markdown inline plutot qu'une recherche HTML ou regex.
3. Identifier, pour chaque token `link_open`, le token `link_close`
   correspondant au meme niveau.
4. Extraire le texte visible entre les deux:
   - utiliser les tokens `text`, `code_inline` et autres contenus textuels
     rendus visibles;
   - ignorer les marqueurs de structure;
   - ne pas inclure d'attribut HTML, car `html: false` reste actif.
5. Normaliser uniquement le bruit de presentation autorise:
   - `trim()` en debut et fin;
   - aucune normalisation Unicode;
   - aucune correction de schema;
   - aucune suppression interne d'espaces.
6. Ajouter des tests unitaires autour de liens simples avant de couvrir les
   cas imbriques.

Gate de sortie:

```bash
npm run typecheck
npm test -- tests/unit/markdownRenderer/markdownRenderer.test.ts
```

## 8. Phase 4 - Validation stricte des liens HTTPS visibles

1. Remplacer `isPassiveHttpsLink(href)` par un helper plus strict, par exemple:
   - `isClearVisibleHttpsLink(href: string, visibleText: string): boolean`.
2. Conserver un `href` uniquement quand toutes les conditions sont vraies:
   - `href.trim()` est une URL HTTPS valide;
   - le host n'est pas vide;
   - l'URL n'a ni `username` ni `password`;
   - `href` ne contient aucun caractere cache ou dangereux;
   - `visibleText.trim() === href`.
3. Bloquer tous les autres liens en retirant `href`.
4. Ajouter `data-md2pdf-blocked-href="true"` quand un lien est bloque.
5. Garder la politique existante pour les schemas non HTTPS:
   - `http:`, `javascript:`, `data:`, `file:`, `blob:`, `ftp:`, schemas
     inconnus, chemins root-relative et chemins locaux restent non cliquables.
6. Ne jamais transformer un lien bloque en erreur de rendu, sauf si le Markdown
   global contient lui-meme un caractere dangereux detecte par la prevalidation.

Gate de sortie:

```bash
npm run typecheck
npm test -- tests/unit/markdownRenderer/markdownRenderer.test.ts
```

## 9. Phase 5 - Regles de clarification URL

1. Utiliser `new URL(...)` pour les candidats HTTPS apres verification de base.
2. Rejeter comme non cliquable:
   - `https://user@example.com`;
   - `https://user:pass@example.com`;
   - `https:///path`;
   - toute URL malformee;
   - toute URL contenant un caractere cache ou dangereux;
   - tout href dont le texte visible ne correspond pas exactement.
3. Ne pas accepter de label alternatif meme utile:
   - `[example.com](https://example.com)` est bloque;
   - `[click here](https://example.com)` est bloque;
   - `[https://paypal.com](https://evil.example)` est bloque.
4. Accepter uniquement:
   - `[https://example.com/page](https://example.com/page)`.

Gate de sortie:

```bash
npm run typecheck
npm test -- tests/unit/markdownRenderer/markdownRenderer.test.ts
```

## 10. Phase 6 - Tests unitaires Markdown

Ajouter ou modifier les tests dans
`tests/unit/markdownRenderer/markdownRenderer.test.ts`:

1. Rejets pre-parsing:
   - Markdown contenant `U+200B`;
   - Markdown contenant un bidi override, par exemple `U+202E`;
   - Markdown contenant un controle inattendu, par exemple `U+0008`;
   - erreur avec `sourcePath` et `actionHint`;
   - si implemente, ligne et colonne dans le contexte ou la cause.
2. Liens bloques:
   - `[text](https://example.com)` perd `href`;
   - `[https://evil.example](https://example.com)` perd `href`;
   - `[example.com](https://example.com)` perd `href`;
   - `https://user@example.com` perd `href`;
   - une URL avec caractere invisible dans `href` est rejetee ou bloquee selon
     le chemin de detection choisi.
3. Liens autorises:
   - `[https://example.com](https://example.com)` garde `href`;
   - `[ https://example.com ](https://example.com)` garde `href` si seul le
     trim externe explique l'ecart;
   - le texte clair reste preserve pour les liens bloques.
4. Non-regressions:
   - images locales valides restent inchangees;
   - Mermaid reste inchange;
   - code highlighting reste inchange;
   - HTML final ne contient toujours pas de ressource reseau active.

Gate de sortie:

```bash
npm run typecheck
npm test -- tests/unit/markdownRenderer/markdownRenderer.test.ts
```

## 11. Phase 7 - Test d'integration converter

Modifier ou ajouter un test dans `tests/integration/converter.test.ts`:

1. Construire un Markdown avec:
   - `[https://example.invalid/report](https://example.invalid/report)`;
   - `[safe](https://example.invalid/report)`;
   - `[https://evil.example](https://example.invalid/report)`;
   - `[danger](javascript:alert(1))`;
   - `[local](/etc/passwd)`.
2. Convertir avec le faux `printPdf` existant pour capturer le HTML temporaire.
3. Verifier que:
   - seul le lien dont le texte visible est l'URL exacte conserve `href`;
   - les liens trompeurs ont `data-md2pdf-blocked-href="true"`;
   - aucun `href="javascript:` ni `href="/etc/passwd"` n'apparait;
   - aucune ressource active distante n'apparait.
4. Ajouter un test d'echec avant demarrage WebDriver pour un Markdown contenant
   un caractere cache global, si ce cas n'est pas deja suffisamment couvert en
   unitaire.

Gate de sortie:

```bash
npm run typecheck
npm test -- tests/integration/converter.test.ts
```

## 12. Phase 8 - Validation finale

Executer les gates complets disponibles:

```bash
npm run typecheck
npm test -- tests/unit/markdownRenderer/markdownRenderer.test.ts
npm test -- tests/integration/converter.test.ts
npm test
npm run check:artifacts
```

Si un script attendu n'existe pas dans `package.json`, noter le script absent
dans le rapport de validation et executer l'equivalent disponible.

## 13. Definition de fini

Le durcissement est termine quand:

- les controles C0/C1 non autorises sont rejetes avant parsing;
- les caracteres invisibles et bidirectionnels dangereux sont rejetes avant
  parsing;
- les erreurs indiquent clairement l'action utilisateur attendue;
- un lien PDF cliquable affiche toujours exactement son URL cible;
- les liens HTTPS avec label trompeur perdent `href` et sont marques bloques;
- les URLs avec credentials, host vide, forme malformee ou caracteres dangereux
  ne sont pas cliquables;
- les liens non HTTPS dangereux ou locaux restent bloques;
- les comportements images, Mermaid, highlighting et HTML local-only ne
  regressent pas;
- les tests unitaires, integration et gates de validation passent;
- aucun artifact tiers nouveau ou modifie n'a ete introduit sans passer par
  `ARTIFACT_FRESHNESS_POLICY.md`.
