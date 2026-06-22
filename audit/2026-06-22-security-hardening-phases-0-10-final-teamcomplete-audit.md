# Audit TeamComplete - Security hardening phases 0 a 10 final

Date: 2026-06-22
Branche auditee: `security`
Commit audite: `0d28995`
Perimetre: code actuel apres implementation annoncee des phases 0 a 10 du plan `docs/security-hardening-implementation-plan.md`.

## Resume De L'Audit

| Division | Statut | Synthese |
| --- | --- | --- |
| Metier | Avertissement | Les protections Markdown phases 0 a 6 sont conformes, les tests hostiles et la doc existent, mais la definition de fini WebDriver n'est pas completement prouvee. |
| Qualite | Avertissement | Les gates finaux passent, mais deux exigences phase 7 ne sont pas assez testees ni explicitement enforcees. |
| Architecture | Avertissement | Le durcissement reste bien localise, mais la responsabilite "driver local + profil temporaire" n'est pas uniformement portee par `webDriverSession`/`webDriverClient`. |
| Cybersecurite Offensive | Bloquant | Le lancement WebDriver Chromium ne force pas explicitement le bind `127.0.0.1`; Firefox n'a pas de profil temporaire explicite. |

Verdict global: **AUDIT_FAIL pour la definition de fini phase 7/10**.

Totaux normalises: Critical 0 - High 1 - Medium 1 - Low 0.

Les gates phase 10 passent sur cette machine apres relance hors sandbox pour les tests qui doivent ecouter sur localhost. Le refus ne vient donc pas d'un test rouge fonctionnel, mais de deux ecarts de securite/traçabilite confirmes dans le code.

## Index Des Sous-Audits

| Sous-audit | Scope | Crit | High | Medium | Low | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Business Logic Auditor | Phases 0-10 | 0 | 0 | 1 | 0 | WARN |
| Requirements Compliance Auditor | Plan secu vs code/tests | 0 | 1 | 1 | 0 | FAIL |
| Doc-Sync Auditor | README/docs | 0 | 0 | 0 | 0 | PASS |
| A11y/UX Checker | UI | 0 | 0 | 0 | 0 | N/A |
| Clean Code Auditor | Renderer/WebDriver | 0 | 0 | 0 | 0 | PASS |
| Fail-Loud Auditor | Rejets/cleanup | 0 | 0 | 0 | 0 | PASS |
| Test Quality Auditor | Phase 7/10 | 0 | 1 | 1 | 0 | FAIL |
| Mutation/Saboteur Auditor | WebDriver hardening | 0 | 1 | 1 | 0 | FAIL |
| Layer Enforcer | Runtime boundaries | 0 | 0 | 0 | 0 | PASS |
| YAGNI Auditor | Scope des ajouts | 0 | 0 | 0 | 0 | PASS |
| SRE/Performance Auditor | Timeouts/process/temp | 0 | 0 | 0 | 0 | PASS |
| Architecture Consistency Auditor | Plan vs implementation | 0 | 1 | 1 | 0 | FAIL |
| Contextual Threat Analyst | Markdown hostile + WebDriver | 0 | 1 | 1 | 0 | FAIL |
| SAST Scanner | Traversal/SSRF/local bind | 0 | 1 | 1 | 0 | FAIL |
| Supply Chain & Artifact Auditor | Freshness/artifacts | 0 | 0 | 0 | 0 | PASS |
| Privacy/Exfiltration Auditor | Reseau/fichiers/PDF | 0 | 1 | 1 | 0 | FAIL |

## Matrice Courte Des Exigences

| Contrat / exigence | Source | Implementation | Tests | Statut |
| --- | --- | --- | --- | --- |
| Images PNG/JPEG/WebP locales, SVG/GIF/URI/absolus rejetes | `docs/security-hardening-plan.md:38`-`100` | `src/markdownRenderer.ts:264`-`363`, `src/markdownRenderer.ts:527`-`589` | `tests/unit/markdownRenderer/markdownRenderer.test.ts`, `tests/integration/converter.test.ts:209`-`272` | OK |
| Realpath containment et symlink sortant refuse | `docs/security-hardening-plan.md:102`-`123` | `src/markdownRenderer.ts:281`-`320`, `src/markdownRenderer.ts:798`-`800` | `tests/unit/markdownRenderer/markdownRenderer.test.ts`, `tests/integration/converter.test.ts:209`-`240` | OK |
| Limites Markdown, lignes, images, Mermaid, code fences | `docs/security-hardening-plan.md:125`-`161` | `src/markdownRenderer.ts:32`-`40`, `src/markdownRenderer.ts:444`-`525` | `npm test`, renderer unit suite | OK |
| Liens HTTPS passifs gardes, schemes actifs/local refuses | `docs/security-hardening-plan.md:163`-`198` | `src/markdownRenderer.ts:250`-`278`, `src/markdownRenderer.ts:378`-`408`, `src/markdownRenderer.ts:785`-`795` | `tests/integration/converter.test.ts:274`-`314` | OK |
| WebDriver reste bind sur `127.0.0.1` | `docs/security-hardening-implementation-plan.md:265`-`290`, `docs/security-hardening-plan.md:205`-`224` | Gecko force `--host 127.0.0.1`; Chromium ne force que `--port` et `--allowed-ips=` | Pas de test de `driverArgs`/spawn args Chromium | **FAIL** |
| Profil navigateur per-run et temporaire | `docs/security-hardening-plan.md:200`-`216` | Chromium cree `--user-data-dir`; Firefox retourne `undefined` | Test profil uniquement Chromium | **FAIL** |
| Tests hostiles integration + browser-backed | `docs/security-hardening-implementation-plan.md:300`-`322` | Integration + browser-backed presents | `npm run test:browser`: OK hors sandbox, 28 tests | OK |
| Documentation utilisateur minimale | `docs/security-hardening-implementation-plan.md:324`-`342` | `README.md:138`-`159`, `README.md:172`-`177` | Doc relue | OK |
| Gates finaux phase 10 | `docs/security-hardening-implementation-plan.md:344`-`360` | Scripts package | Tous executes; browser gates OK hors sandbox | OK |
| Aucun nouvel artifact hors politique freshness | `ARTIFACT_FRESHNESS_POLICY.md:1`-`16`, `artifacts.json:1`-`182` | Catalog declare | `npm run check:artifacts`: OK | OK |

## Top Findings

### HIGH - WD-01 - Chromium WebDriver n'est pas force explicitement a binder sur `127.0.0.1`

- Preuve exigence: `docs/security-hardening-implementation-plan.md:267`-`269` demande que le driver reste bind sur `127.0.0.1`.
- Preuve code: `src/webDriverSession.ts:84`-`90` passe `["--host", "127.0.0.1", "--port", ...]` uniquement pour `geckodriver`; pour Chromium-family il retourne seulement ``--port=${port}`` et `--allowed-ips=`.
- Preuve transport insuffisante: `src/webDriverSession.ts:49` force le client HTTP a appeler `http://127.0.0.1:${port}/`, mais cela ne prouve pas l'adresse de bind du processus driver lui-meme.
- Preuve test: `tests/unit/webDriverSession/webDriverSession.test.ts:1`-`59` couvre l'arret du process et la probe `/status`, mais pas les arguments de spawn ni le bind Chromium.

Type: Confirme.

Impact:

La definition de fini exige que WebDriver reste local. Si un driver Chromium accepte une interface autre que loopback selon ses defaults ou options, le port WebDriver expose une API d'automatisation navigateur. C'est exactement le genre de surface que la phase 7 devait verrouiller.

Correction attendue:

Forcer le bind local pour les drivers Chromium-family avec le flag supporte par le driver cible, ou ajouter une verification de lancement qui prouve l'ecoute loopback-only. Ajouter un test unitaire sur `SpawnedWebDriverSessionFactory.start`/arguments de spawn pour `chromedriver`, en miroir du cas `geckodriver`.

### MEDIUM - WD-02 - Firefox n'a pas de profil temporaire explicite, contrairement au contrat "per-run temporary profile"

- Preuve exigence: `docs/security-hardening-plan.md:200`-`216` demande de garder un profil navigateur isole, per-run et temporaire.
- Preuve code: `src/webDriverClient.ts:390`-`396` retourne `undefined` pour `browser.kind === "firefox"` et ne cree donc pas de repertoire de profil gere par md2pdf.
- Preuve capabilities Firefox: `src/webDriverClient.ts:405`-`414` fournit `binary`, `args` et `prefs`, mais pas d'argument/profile temporaire explicite.
- Preuve test: `tests/unit/webDriverClient/webDriverClient.test.ts:75`-`79` verifie le nettoyage `--user-data-dir` Chromium; `tests/unit/webDriverClient/webDriverClient.test.ts:141`-`186` verifie seulement headless/offline/prefs Firefox.

Type: Confirme.

Impact:

Firefox peut rester durci par preferences et geckodriver peut avoir ses propres defaults, mais md2pdf ne prouve pas son contrat "per-run temporary profile" pour Firefox. C'est une faiblesse de privacy/isolation et une divergence testable entre familles navigateur.

Correction attendue:

Creer un profil temporaire Firefox par run, le passer explicitement via l'option WebDriver/Firefox supportee, et le nettoyer dans le meme chemin que Chromium. Ajouter un test qui verifie la presence du profil Firefox et sa suppression.

## Details Par Division

### Division Metier - Anton Ego

Le renderer honore le menu annonce: images raster locales, Mermaid, code highlighting, liens HTTPS passifs. La documentation utilisateur explique les formats supportes et les limites dans `README.md:138`-`159`. Mais le contrat final promet aussi un WebDriver local et un profil temporaire; sur ce plat-la, le service n'est pas complet.

### Division Qualite - Gordon Ramsay

Les tests sont nombreux et les gates passent. La vraie faiblesse: personne ne cuisine les arguments de spawn Chromium. On teste le transport local, pas le serveur qui ecoute. Pour Firefox, on teste des prefs, mais pas le profil. C'est moins une casserole qu'un angle mort net.

### Division Architecture - Steve Jobs

L'architecture reste sobre: renderer, converter, WebDriver client/session, artifact policy. Mais la responsabilite "isoler le navigateur" est coupee entre deux fichiers: `webDriverSession` lance le driver, `webDriverClient` construit les capabilities. Cette separation est acceptable seulement si les contrats critiques sont verifies de bout en bout; ici, deux bords ne le sont pas.

### Division Cybersecurite Offensive - Sherlock Holmes

Elementaire, et pourtant: le Markdown hostile est bien enferme, mais WebDriver est une serrure differente. Un port WebDriver qui ne serait pas strictement loopback-only expose une telecommande navigateur. Un profil Firefox non gere explicitement affaiblit l'isolation et peut compliquer la preuve de non-persistance.

## Details Par Sous-Audit

### Business Logic Auditor

Verdict: WARN. Les phases 0 a 6 sont conformes et les phases 8 a 10 ont leurs gates. La phase 7 reste incomplete sur bind Chromium et profil Firefox.

### Requirements Compliance Auditor

Verdict: FAIL. Deux lignes de contrat ne sont pas prouvees par le code/tests: local bind du driver Chromium et profil temporaire Firefox.

### Doc-Sync Auditor

Verdict: PASS. `README.md:145`-`159` documente correctement les formats, rejets et limites; `README.md:172`-`177` distingue tests browser-backed et skip local.

### A11y/UX Checker

Verdict: N/A. Pas de front-end interactif modifie.

### Clean Code Auditor

Verdict: PASS. Les fonctions restent nommees et localisees. Le CRC PNG est local et court; les erreurs passent par `RenderError`/`ConversionError`.

### Fail-Loud Auditor

Verdict: PASS. Les erreurs de render, timeouts WebDriver, cleanup et invalid PDF sont fail-loud. Les cleanup best-effort sont limites aux chemins ou un echec primaire existe deja.

### Test Quality Auditor

Verdict: FAIL. Les tests hostiles Markdown sont solides, mais la phase 7 manque deux assertions structurelles: arguments de spawn Chromium et profil Firefox.

### Mutation/Saboteur Auditor

Verdict: FAIL. Supprimer `--host 127.0.0.1` cote geckodriver serait probablement detecte seulement si un test des args existait; pour Chromium, l'absence actuelle n'est pas testee. Supprimer un hypothetique profil Firefox ne ferait echouer aucun test, puisqu'il n'existe pas.

### Layer Enforcer

Verdict: PASS. Pas de violation de couche majeure. Le renderer ne depend pas de WebDriver; le converter orchestre; la policy artifact reste separee.

### YAGNI Auditor

Verdict: PASS. Aucun ajout speculatif observe dans le hardening final.

### SRE/Performance Auditor

Verdict: PASS. Timeouts, cleanup driver, cleanup temp HTML et ecriture PDF atomique sont couverts. `src/converter.ts:195`-`219` ecrit via fichier temporaire puis rename.

### Architecture Consistency Auditor

Verdict: FAIL. La definition de fini `docs/security-hardening-implementation-plan.md:362`-`378` inclut WebDriver local + flags hardening; le code ne ferme pas totalement le bind Chromium/profil Firefox.

### Contextual Threat Analyst

Verdict: FAIL. Scenario plausible: un environnement ou le driver Chromium ecoute hors loopback expose l'API WebDriver; un acteur local-reseau pourrait piloter le navigateur de rendu. Le code ne force pas explicitement la propriete attendue.

### SAST Scanner

Verdict: FAIL. Pas d'injection shell, SSRF Markdown ou traversal image confirme; le probleme est la surface WebDriver non strictement prouvee.

### Supply Chain & Artifact Auditor

Verdict: PASS. Aucun artifact nouveau n'est requis par l'audit. `artifacts.json:31`-`137` declare Chromium/chromedriver/geckodriver, et `npm run check:artifacts` passe.

### Privacy/Exfiltration Auditor

Verdict: FAIL. Markdown ne charge pas de ressource reseau active, mais l'isolation du navigateur Firefox et l'exposition potentielle du driver Chromium restent a fermer pour valider la privacy de bout en bout.

## Points Conformes

- `npm run typecheck`: OK.
- `npm test`: OK, 16 fichiers, 211 tests.
- `npm run test:artifacts`: OK, 2 fichiers, 24 tests.
- `npm run check:artifacts`: OK.
- `npm run build`: OK.
- `npm run test:browser`: OK hors sandbox, 3 fichiers, 28 tests.
- `npm run test:real-browser`: OK hors sandbox, 1 fichier, 1 test.
- Les echecs initiaux browser etaient dus au sandbox (`listen EPERM 127.0.0.1`) et disparaissent hors sandbox.
- `dist/` et `.tmp/` sont ignores par `.gitignore`, donc le build n'a pas ajoute de fichier source audite.

## Limites De Verification

- Je n'ai pas verifie via inspection reseau OS que le processus `chromedriver` ecoute uniquement sur loopback; l'audit juge ici le code et les tests.
- Les deux changements locaux preexistants dans `audit/` restent hors scope et non modifies:
  - `D audit/2026-06-16-final-complete-audit.md`
  - `?? audit/2026-06-16-final-complete-auditaprescorrection.md`

## Commandes Executees

```bash
npm run typecheck
npm test
npm run test:artifacts
npm run check:artifacts
npm run build
npm run test:browser
npm run test:browser # relance hors sandbox apres EPERM localhost
npm run test:real-browser
npm run test:real-browser # relance hors sandbox apres EPERM localhost
```

Resultats:

- `npm run typecheck`: OK.
- `npm test`: OK, 211 tests.
- `npm run test:artifacts`: OK, 24 tests.
- `npm run check:artifacts`: OK.
- `npm run build`: OK.
- `npm run test:browser`: echec sandbox `listen EPERM: operation not permitted 127.0.0.1`; relance hors sandbox OK, 28 tests.
- `npm run test:real-browser`: echec sandbox `listen EPERM: operation not permitted 127.0.0.1`; relance hors sandbox OK, 1 test.
