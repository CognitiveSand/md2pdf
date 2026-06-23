# Plan de finalisation Stream A strict

Date: 2026-06-11

## Objectif

Finaliser Stream A sans empieter sur Stream B.

Stream A est limite a la surface utilisateur autour de la CLI:

- parsing des options;
- resolution des chemins;
- orchestration batch;
- overwrite / skip;
- summaries et codes de sortie;
- packaging npm;
- installation et invocabilite de la commande;
- preuves release associees a ce perimetre.

Stream A ne doit pas implementer ni corriger:

- le rendu navigateur reel;
- Mermaid rendu comme diagramme;
- WebDriver / Firefox / geckodriver;
- le fallback Chromium-for-Testing;
- le provisioning de navigateur;
- la compatibilite navigateur multi-famille.

Ces sujets restent des dependances Stream B ou des validations release globales.

## 1. Finaliser FR-20 cote invocabilite CLI

### Objectif

Completer `docs/release-evidence/fr-20-system-scope.md` pour prouver, ou
simuler validement, que `md2pdf --help` est invocable par nom depuis le compte
utilisateur teste.

### Implementation

1. Relever les metadonnees necessaires:
   - version `package.json`;
   - commit SHA courant;
   - tarball npm utilise;
   - OS et version exacte;
   - architecture CPU;
   - versions Node.js et npm;
   - shell utilise.
2. Generer ou reutiliser un tarball valide apres build:
   - `npm.cmd run build`;
   - `npm.cmd pack --json`.
3. Tester l'invocabilite par nom:
   - idealement via une installation system-scope reelle;
   - sinon via une simulation documentee qui prouve le meme contrat observable.
4. Capturer les preuves:
   - commande d'installation;
   - mecanisme d'elevation ou justification de simulation;
   - compte utilisateur teste;
   - commande de resolution par nom, par exemple `where md2pdf`;
   - commande exacte `md2pdf --help`;
   - sortie observee;
   - code de sortie.
5. Renseigner `docs/release-evidence/fr-20-system-scope.md` avec les valeurs
   reelles.
6. Si une simulation est utilisee, documenter:
   - pourquoi un vrai compte secondaire ou une vraie installation system-scope
     n'a pas ete utilise;
   - pourquoi la simulation prouve le meme contrat CLI observable;
   - les limites de cette preuve.

### Critere de sortie

FR-20 peut passer seulement si `md2pdf --help` est invocable par nom dans le
contexte teste, ou si une simulation explicitement acceptee documente le meme
contrat observable.

## 2. Aligner README sur la CLI uniquement

### Objectif

Verifier que le README decrit exactement la CLI Stream A livree, sans promettre
de capacites Stream B non livrees.

### Implementation

1. Capturer la sortie actuelle de la CLI:
   - `node dist\cli.js --help`;
   - ou `md2pdf --help` depuis le package installe si disponible.
2. Comparer les options du README avec les options exposees par `--help`:
   - entree Markdown;
   - `--output`;
   - `--output-dir`;
   - `--force-overwrite`;
   - `--browser`, si expose par la CLI;
   - `--help`.
3. Corriger le README pour documenter uniquement les comportements Stream A
   prouves:
   - chemins d'entree;
   - sortie par defaut;
   - `--output`;
   - `--output-dir`;
   - overwrite / skip;
   - batch;
   - summaries;
   - codes de sortie;
   - installation npm et invocation CLI.
4. Retirer ou reformuler les promesses hors perimetre Stream A:
   - WebDriver;
   - Firefox / geckodriver;
   - Mermaid garanti avec navigateur reel;
   - fallback Chromium-for-Testing automatique;
   - provisioning navigateur.
5. Si ces sujets restent mentionnes, les marquer clairement comme:
   - hors perimetre Stream A;
   - dependants de Stream B;
   - non requis pour declarer Stream A strict complet.

### Critere de sortie

Chaque option documentee dans le README existe dans `--help`, chaque option de
`--help` est documentee dans le README, et aucune capacite Stream B n'est
presentee comme livree par Stream A.

## 3. Documenter le caveat Windows PowerShell

### Objectif

Ajouter la note issue de la Phase 6: sous Windows, le shim npm `.ps1` peut etre
bloque par l'ExecutionPolicy PowerShell, tandis que `md2pdf.cmd` fonctionne via
`cmd.exe`.

### Implementation

1. Ajouter une note Windows dans le README, dans la section installation ou
   troubleshooting.
2. Expliquer que npm peut generer plusieurs shims:
   - `md2pdf.cmd`;
   - `md2pdf.ps1`.
3. Documenter le comportement observe:
   - PowerShell peut resoudre `md2pdf` vers `md2pdf.ps1`;
   - l'ExecutionPolicy locale peut bloquer ce script;
   - `md2pdf.cmd` reste invocable.
4. Donner une commande de contournement explicite:

```powershell
md2pdf.cmd --help
```

ou via `cmd.exe`:

```cmd
md2pdf --help
```

5. Reporter cette nuance dans la checklist release si elle est utilisee comme
   preuve d'installation Windows.

### Critere de sortie

Le README documente le cas PowerShell sans le transformer en echec Stream A,
car l'invocabilite via le shim `.cmd` reste prouvee.

## 4. Mettre a jour la checklist release pour Stream A strict

### Objectif

Mettre a jour `docs/release-evidence/release-checklist-v0.1.2.md` pour fermer
les preuves Stream A, tout en gardant les preuves Stream B separees.

### Implementation

1. Passer en `pass` uniquement les elements deja prouves cote Stream A:
   - P1 CLI / paths / preflight;
   - P2 overwrite / batch / permissions preflight;
   - typecheck;
   - tests unitaires;
   - tests contrats;
   - artifact freshness;
   - build;
   - packlist npm;
   - install user-scope;
   - reinstall idempotent;
   - FR-19;
   - FR-21;
   - README/help comparison, apres verification;
   - FR-20, seulement si la preuve est completee.
2. Laisser separes les elements hors perimetre Stream A:
   - navigateur reel;
   - Mermaid rendu comme diagramme;
   - WebDriver / Firefox;
   - fallback browser provisioning;
   - browser compatibility matrix.
3. Marquer ces lignes avec un statut explicite:
   - `blocked by Stream B`;
   - `pending Stream B`;
   - ou une note equivalente compatible avec les statuts acceptes par la
     checklist.
4. Eviter toute decision de release globale si Stream B reste incomplet.
5. Ajouter, si necessaire, une note de decision:
   - `Stream A strict complete`;
   - `Global release still blocked by Stream B browser/rendering evidence`.

### Critere de sortie

La checklist ne laisse plus croire que Stream A doit livrer le moteur navigateur
ou Mermaid. Elle distingue clairement Stream A strict complet et release globale
encore dependante de Stream B.

## 5. Rejouer les gates Stream A

### Objectif

Verifier que les preuves et la documentation Stream A restent coherentes avec
le code et le package.

### Commandes a executer

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:contracts
npm.cmd run check:artifacts
npm.cmd run build
npm.cmd pack --json
node dist\cli.js --help
```

### Implementation

1. Executer les commandes dans l'ordre.
2. Capturer les resultats importants:
   - pass/fail;
   - nombre de tests;
   - nom du tarball;
   - shasum;
   - integrity;
   - sortie help.
3. Si `npm.cmd pack --json` genere un nouveau tarball, reporter les valeurs
   observees dans les preuves release concernees.
4. Ne pas bloquer Stream A strict sur les tests ou preuves qui appartiennent a
   Stream B.
5. Corriger uniquement les echecs qui appartiennent au perimetre Stream A.

### Critere de sortie

Toutes les gates Stream A passent. Les preuves produites sont reportees dans
FR-20, la checklist release, et l'audit final.

## 6. Faire un audit final Stream A strict

### Objectif

Produire un audit final qui conclut sur Stream A strict, sans absorber les
responsabilites Stream B.

### Implementation

1. Creer un nouvel audit date sous `audit/`, par exemple:

```text
audit/2026-06-11-stream-a-strict-final-audit.md
```

2. Structurer l'audit avec:
   - verdict;
   - perimetre Stream A strict;
   - hors-scope Stream B;
   - preuves executees;
   - etat FR-20;
   - etat README/help;
   - etat checklist release;
   - risques residuels;
   - decision finale.
3. Conclure explicitement:
   - Stream A est complet sur CLI, orchestration, packaging et invocabilite;
   - Stream A ne ferme pas le rendu navigateur reel;
   - Mermaid, WebDriver, fallback et provisioning restent Stream B;
   - la release globale reste bloquee si Stream B n'a pas fourni ses preuves.
4. Lister les commandes rejouees et leurs resultats.

### Critere de sortie

L'audit final peut conclure:

```text
GO Stream A strict.
NO-GO release globale tant que Stream B navigateur/rendu n'est pas ferme.
```

## Ordre d'execution recommande

1. Completer FR-20 ou documenter une simulation valide.
2. Aligner README sur `md2pdf --help`.
3. Ajouter le caveat Windows PowerShell.
4. Mettre a jour la checklist release pour Stream A strict.
5. Rejouer les gates Stream A.
6. Produire l'audit final Stream A strict.

## Definition de termine

Stream A strict est termine quand:

- FR-20 est prouve ou explicitement simule avec justification;
- README et `--help` sont alignes;
- le caveat Windows PowerShell est documente;
- la checklist release distingue clairement Stream A et Stream B;
- les gates Stream A passent;
- un audit final conclut `GO Stream A strict`;
- les dependances navigateur/rendu restent listees comme hors-scope Stream A.
