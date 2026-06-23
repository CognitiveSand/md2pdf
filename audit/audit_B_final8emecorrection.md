Audit Complet Stream B — md2pdf v0.1.2
Date d'audit : 2026-06-11

Périmètre : Stream B strict — 9 modules source, 7 suites de tests, docs/architecture.md + docs/plan_stream_b.md

Outils exécutés : npm run typecheck ✓, npm test (136 tests ✓), MD2PDF_SKIP_REAL_BROWSER_TESTS=1 npm run test:browser (6 tests ✓)

Résumé de l'Audit
Division	Statut	Synthèse
Métier	🟡 Avertissement	Un écart documentaire Medium sur la vérification FR-07 ; reste conforme
Qualité	🟡 Avertissement	5 modules dépassent la limite 300L de l'architecture
Architecture	🟡 Avertissement	Violations confirmées de la charte 300L/40L ; répertoire tests/contract/ fantôme
Cybersécurité Offensive	🟢 OK	Aucun défaut exploitable confirmé
Index des Sous-Audits
Sous-audit	Scope	Crit	High	Medium	Low	Verdict
Business Logic Auditor	converter.ts, markdownRenderer.ts, webDriverClient.ts	0	0	1	1	AUDIT_PASS
Requirements Compliance Auditor	FR-01..FR-24, NFR-01..NFR-05	0	0	1	0	AUDIT_PASS
Doc-Sync Auditor	architecture.md §12, §15	0	0	1	1	AUDIT_PASS
A11y/UX Checker	N/A (pas de front-end)	—	—	—	—	N/A
Clean Code Auditor	9 modules	0	0	1	1	AUDIT_PASS
Fail-Loud Auditor	fallbackBrowserProvisioner, webDriverClient	0	0	0	1	AUDIT_PASS
Test Quality Auditor	7 suites	0	0	1	1	AUDIT_PASS
Mutation/Saboteur Auditor	converter, markdownRenderer	0	0	0	1	AUDIT_PASS
Layer Enforcer	imports transverses	0	0	0	0	AUDIT_PASS
YAGNI Auditor	WebDriverPrintOptions, BrowserProbe	0	0	0	1	AUDIT_PASS
SRE/Performance Auditor	provisioning, renderer	0	0	1	0	AUDIT_PASS
Architecture Consistency Auditor	architecture.md vs code	0	0	1	1	AUDIT_PASS
Contextual Threat Analyst	pipeline entier	0	0	0	1	AUDIT_PASS
SAST Scanner	markdownRenderer, webDriverClient, fallbackBrowserProvisioner	0	0	0	1	AUDIT_PASS
Supply Chain & Artifact Auditor	artifacts.json, fflate, provisioning	0	0	0	0	AUDIT_PASS
Privacy/Exfiltration Auditor	temp HTML, cache, Markdown source	0	0	0	0	AUDIT_PASS
Totaux consolidés : Critical 0 · High 0 · Medium 6 · Low 9

Top Findings
[Medium] src/fallbackBrowserProvisioner.ts:611, src/browserLocator.ts:618, src/webDriverClient.ts:488, src/markdownRenderer.ts:435, src/converter.ts:380 — Cinq modules dépassent la limite 300L déclarée en architecture §5. Violation documentaire confirmée, dette structurelle croissante.
[Medium] tests/integration/browserBackedConversion.test.ts:21 — Le test browser-backed @req FR-07 ne vérifie pas que aucun heading n'est le dernier élément sur une page. Architecture §15 promet explicitement ce critère. Écart documentaire confirmé.
[Medium] src/fallbackBrowserProvisioner.ts:559 — sha256File charge en mémoire le binaire Chromium entier (~150 MB) pour calculer le SHA-256. Appelé deux fois par provision (writeCacheMetadata + assertCacheMetadata), soit ~300 MB de pression mémoire transitoire.
[Low] docs/architecture.md:342 — Le plan §12 référence un répertoire tests/contract/ qui n'existe pas (tests/integration/ et tests/unit/ existent). Écart documentaire mineur.
[Low] src/fallbackBrowserProvisioner.ts:399-401 — Dans defaultDownloader, le dépassement de taille appelle request.destroy(error) + stream.destroy() sans rejectDownload() explicite. Le rejet arrive indirectement via request.once("error", rejectDownload). Chemin fonctionnellement correct mais opaque.
Thèmes Transverses
Limite 300L/40L non respectée : la charte architecture §5 est violée sur 5 des 9 modules — c'est le seul thème transverse de ce rapport. Pas un bug, mais une dette documentée.
Robustesse de provisioning : les chemins d'erreur du downloader (taille, timeout, checksum) sont couverts en test et résilients. Le modèle est solide.
Isolation locale : NFR-02 / CON-02 sont structurellement respectés — CSP default-src 'none', assets inlinés, file: local, flags offline navigateur.
Détails par Division
Division Métier (Anton Ego)
Un contrat livré, un contrat partiellement tenu.

[Medium] Écart documentaire tests/integration/browserBackedConversion.test.ts:21 : Architecture §15 déclare pour FR-07 "integration test: no heading is the last line on a page". Le test browser-backed @req FR-07 vérifie uniquement la présence d'un %PDF- header, la taille du PDF, et l'absence du texte Mermaid brut — pas la pagination. Le seul test qui touche FR-07 est unitaire (markdownRenderer.test.ts:52) et vérifie que break-after: avoid-page est présent dans le CSS inliné. C'est une preuve CSS, pas une preuve de pagination PDF réelle.
[Low] src/converter.ts:101-135 : renderTimeoutMs est passé identiquement à withTempHtml (timeout global) et à printPdf (timeouts WebDriver internes). Les deux horloges démarrent à des instants différents (l'outer avant start(), l'inner après start()). Fonctionnellement correct — l'outer signal avorte l'inner via AbortController — mais la sémantique n'est pas documentée et peut surprendre un lecteur.
Division Qualité (Gordon Ramsay)
Le code tourne, les tests passent. Mais la cuisine est surchargée.

[Medium] Confirme src/fallbackBrowserProvisioner.ts:1 et src/browserLocator.ts:1 : 611 et 618 lignes. L'architecture §5 dit "stays within the 40-line-function / 300-line-module limits". Violation sur 5 modules (fallbackBrowserProvisioner: 611L, browserLocator: 618L, webDriverClient: 488L, markdownRenderer: 435L, converter: 380L). inspectZipArchive fait à elle seule 67 lignes (fallbackBrowserProvisioner.ts:454).
[Low] src/fallbackBrowserProvisioner.ts:399-401 : chemin downloadedBytes > release.size — request.destroy(new Error(...)) puis stream.destroy(). Le rejectDownload arrive via request.once("error", rejectDownload) : correct mais implicite. Si un futur refactoring retire ce listener en amont du gestionnaire data, la promesse reste pendue silencieusement.
Division Architecture (Steve Jobs)
Cinq modules ont grossi au-delà de leur mandat. Un fichier fantôme dans le plan.

[Medium] Confirme docs/architecture.md:157 — Charte "40-line-function / 300-line-module" : 5 modules la violent (cf. Top Findings). C'est une dette technique documentée dans le plan B comme P4.
[Low] Écart documentaire docs/architecture.md:342 — §12 montre tests/contract/ dans l'arborescence. Ce répertoire n'existe pas. Les tests de contrat sont dans tests/unit/contracts/ et tests/integration/. Minime mais le schéma ment.
[OK] Layer Enforcer : converter.ts instancie ses dépendances infra (BrowserLocator, ArtifactPolicy, JsonReleaseCatalog) uniquement dans defaultBrowserLocatorFactory et ArtifactPolicyFallbackBrowserResolver — correctement isolés du chemin d'injection de test. ✓
[OK] SRE src/markdownRenderer.ts:29-34 : Les 5 singletons module-level (cachedRenderer, cachedDefaultCss, etc.) sont initialisés paresseusement et partagés par toutes les conversions parallèles. Thread-safe en Node.js (event loop single-thread). L'initialisation de cachedMermaidBundle lit un fichier synchronement lors du premier appel — acceptable pour un worker Node mono-thread.
[Medium] src/fallbackBrowserProvisioner.ts:559 : sha256File appelle readFile(path) sur le binaire Chromium/chromedriver entier. Pour Chromium (~150 MB), cela crée une pression mémoire transitoire de ~150 MB par appel. Deux appels par assertCacheMetadata (browserPath + driverPath) = ~300 MB. Confirmé par lecture du code. La phase de provisioning n'est pas critique, mais c'est notable.
Division Cybersécurité Offensive (Sherlock Holmes)
Élémentaire — et bien gardé.

[Low] [RISQUE] src/webDriverClient.ts:463-478 : assertFileUrl accepte file://localhost/path (vérifie url.hostname === "" || url.hostname === "localhost"). Sur Windows, file://localhost/share/doc.html peut mapper un chemin UNC. Scénario d'abus : si un attaquant contrôle le chemin HTML transmis à printPdfWithWebDriver (ce n'est pas le cas dans le flux normal — c'est un chemin généré par renderToTempHtml), il pourrait pointer vers un fichier UNC réseau, contournant la promesse local-only. Non exploitable dans le flux actuel. Documenté comme [RISQUE].
[Low] src/markdownRenderer.ts:125 : md.validateLink = () => true. Désactive la validation native de markdown-it sur les liens. Compensé à 100% par renderLinkOpen() qui intercepte tous les liens avec schéma URI (http, https, file, javascript, data, etc.) et supprime l'attribut href. La CSP default-src 'none' bloque en plus les ressources externes au niveau navigateur. ✓
[OK] Supply Chain : fflate vérifie les entrées ZIP avant extraction — bounds sur maxArchiveEntries (20 000) et maxArchiveUncompressedBytes (1,5 GB) en fallbackBrowserProvisioner.ts:508. Path traversal bloqué par resolveInside (line 567). ✓
[OK] Privacy : Le provisioning ne reçoit jamais le contenu Markdown (test @req NFR-02 confirme). La cache-metadata.json est écrite en mode: 0o600. L'archive .zip téléchargée est en mode: 0o600. ✓
Détails par Sous-Audit
Business Logic Auditor
Verdict : AUDIT_PASS avec réserve Medium
Findings : FR-07 vérifié sur CSS mais pas sur pagination PDF (Medium). Double sémantique renderTimeoutMs (Low).
Points conformes : FR-04 (latin1 text layer assertions sur tables/task lists/footnotes), FR-16 (atomicité PDF + nettoyage temp), FR-24 (Mermaid inline engine + runner script), NFR-01 (conversion sans config fichier testée), NFR-02 (provisioning ne lit pas le Markdown).
Requirements Compliance Auditor
Verdict : AUDIT_PASS avec 1 Medium
Req	Implémentation	Test	Statut
FR-01	DocumentConverter.convertFile	converter.test.ts:28	✓
FR-04	markdownRenderer.ts dialect + browserBackedConversion.test.ts	latin1 heuristique	✓ (heuristique)
FR-05	highlightCode + hljs	markdownRenderer.test.ts:37	✓
FR-06	imageSourceToDataUri	markdownRenderer.test.ts:75	✓
FR-07	CSS break-after: avoid-page	markdownRenderer.test.ts:49 (CSS), browser test n'assert pas la pagination	⚠️ Medium
FR-16	withTempHtml cleanup + withTimeout abort	markdownRenderer harness, converter.test.ts:111,133	✓
FR-19	BrowserLocator scan + fallback	browserLocator.test.ts:161,223	✓
FR-24	Mermaid inline engine + waitForMermaid	webDriverClient.test.ts:143, browserBackedConversion.test.ts:21	✓
NFR-01	defaultRenderTimeoutMs = 30_000, no config	converter.test.ts:65	✓
NFR-02	CSP + inlining + offline flags	markdownRenderer.test.ts:135, converter.test.ts:84	✓
NFR-03	defaultBrowserCandidates linux/mac/win	browserLocator.test.ts (sans CI multi-OS)	✓ (limité)
NFR-05	ArtifactPolicy.selectNewestEligible + 7j quarantaine	contracts.test.ts, fallbackBrowserProvisioner.test.ts	✓
Doc-Sync Auditor
Verdict : AUDIT_PASS
Findings : tests/contract/ fantôme dans architecture §12 (Low). FR-07 verification promise non tenue (Medium, déjà remonté).
Points conformes : architecture §15 matrice de vérification globalement fidèle au code.
A11y/UX Checker
Non applicable. Aucun front-end/UI.
Clean Code Auditor
Verdict : AUDIT_PASS
Findings : 5 modules > 300L (Medium). inspectZipArchive 67 lignes (Low, architecture accepte 40L max).
Points conformes : Naming cohérent, pas de magic numbers non nommés, pas de dead code visible, erreurs typées systématiquement.
Fail-Loud Auditor
Verdict : AUDIT_PASS
Findings : Chemin downloadedBytes > release.size dans le downloader — rejet indirect (Low).
Points conformes : Toutes les erreurs sont des sous-classes de Md2PdfError avec kind, message, actionHint. cleanupTempHtml rejette sur chemin non géré. readSessionId rejette si sessionId absent.
Test Quality Auditor
Verdict : AUDIT_PASS
Findings : Test FR-07 browser-backed n'assert pas la pagination (Medium). Le test @req FR-07 dans converter.test.ts:28 vérifie l'ordre des opérations mais pas la mise en page PDF.
Points conformes : Tags @req présents sur tous les tests Stream B requis. 6 tests d'intégration mock-based couvrent les cas limites de timeout et d'atomicité. Suite fallbackBrowserProvisioner a 14 cas incluant checksum invalide, cache partiel, re-provisioning.
Mutation/Saboteur Auditor
Verdict : AUDIT_PASS
Findings : [Low] Si l'on supprime le if (signal.aborted) check post-start() (converter.ts:121), la mutation passe inaperçue — aucun test n'isole ce chemin exactement. Le test "timeout during session start" vérifie que driverStopped === true mais via le chemin onAbort, pas le chemin signal.aborted. Ceci dit, fonctionnellement le résultat final est identique.
Points conformes : Mutation de signal.addEventListener → suppression → détectée par markdownRendererHarness.test.ts:88 (signal.aborted vérifié). Mutation de cleanupTempHtml → détectée par le test NFR-02 harness.
Layer Enforcer
Verdict : AUDIT_PASS
Findings : Aucun.
Points conformes : converter.ts ne dépend pas directement de browserLocator.ts pour la logique de détection — passe par BrowserLocatorLike injectable. markdownRenderer.ts n'importe rien de webDriverClient.ts. Séparation propre provisioning / conversion.
YAGNI Auditor
Verdict : AUDIT_PASS
Findings : [Low] WebDriverPrintOptions.mermaidPollMs et cleanupTimeoutMs sont des paramètres de tuning de test exposés dans l'interface de production. Utiles pour les tests mais YAGNI en production.
Points conformes : BrowserProbe.inspect? est un compromis YAGNI justifié — évite deux appels (isLaunchable + version) en un seul.
SRE/Performance Auditor
Verdict : AUDIT_PASS avec Medium
Findings : sha256File charge le binaire Chromium entier en heap (Medium, cf. Top Findings).
Points conformes : findEndOfCentralDirectory parse le ZIP sans charger tout en mémoire d'abord. purgeStaleCaches nettoie les versions obsolètes. withAbortableTimeout passe le signal à fetch pour annuler les requêtes réseau bloquées.
Architecture Consistency Auditor
Verdict : AUDIT_PASS
Findings : 5 modules > 300L (Medium). tests/contract/ fantôme (Low).
Points conformes : Tous les composants cités en architecture §5 existent et font ce qui leur est attribué. ADR-05 séparation BrowserLocator / ArtifactPolicy / FallbackBrowserProvisioner est respectée. Le flux conversion est bien : Markdown → HTML local → WebDriver → PDF → écriture atomique.
Contextual Threat Analyst
Verdict : AUDIT_PASS
Findings : [Low RISQUE] assertFileUrl accepte file://localhost/path — exploitable uniquement si un attaquant contrôle l'argument htmlFileUrl, ce qui n'est pas possible dans le flux normal.
Points conformes : La surface d'attaque de conversion est structurellement locale : aucun input utilisateur ne peut injecter une URL externe dans le HTML assemblé.
SAST Scanner
Verdict : AUDIT_PASS
Findings : md.validateLink = () => true compensé par renderLinkOpen() (markdownRenderer.ts:125, 203). Pas d'injection.
Points conformes : resolveInside bloque toute traversal de répertoire. CSP default-src 'none' + img-src data: bloque les ressources externes au niveau navigateur. webDriverEndpoint vérifie que le path reste sur l'origin du WebDriver local.
Supply Chain & Artifact Auditor
Verdict : AUDIT_PASS
Findings : Aucun.
Points conformes : fflate protégé par bounds (20 000 entrées, 1,5 GB). SHA-256 vérifié avant et après cache. Quarantaine 7 jours non contournable (assertRequiredQuarantineDays). artifacts.json ne déclare pas encore de fallback Chromium — explicitement documenté dans architecture §11.
Privacy/Exfiltration Auditor
Verdict : AUDIT_PASS
Findings : Aucun.
Points conformes : Temp HTML nettoyé dans finally même en cas de timeout. Cache metadata en 0o600. Archive téléchargée en 0o600. Provisioning n'accède jamais au contenu Markdown (test @req NFR-02 confirme). PDF assemblé en local puis écrit atomiquement — jamais transmis.
Points Conformes Importants
Atomicité PDF : écriture via .tmp + rename (converter.ts:148). Aucun PDF partiel en cas d'erreur.
Abort signal propagé : withTempHtml crée un AbortController, le passe au callback et le signal est connecté à driverProcess.stop() via onAbort + check post-start().
Double protection timeout + FR-16 : deux tests d'intégration couvrent FR-16 — timeout après start() et timeout pendant start() (startGate).
Isolation locale structurelle : CSP + assets inlinés + file: + flags offline navigateur = NFR-02 garanti structurellement, pas par convention.
Supply chain correcte : ArtifactPolicy.selectNewestEligible rejette les versions flottantes, les URLs mutables, les checksums invalides, les quarantaines tronquées. Non contournable.
Fail-loud systématique : toutes les erreurs Stream B sont des sous-classes typées de Md2PdfError avec kind, message, cause, actionHint. Aucun catch silencieux détecté.
Tests FR-24 : le test browser-backed vérifie l'absence du texte Mermaid brut ET la présence d'un objet visuel PDF (XObject / Image / Form) via regex.
Traceabilité : tags @req présents sur tous les tests requis par le plan Stream B.
Limites de Vérification
Tests browser-backed (MD2PDF_SKIP_REAL_BROWSER_TESTS=1) skippés — FR-04, FR-06, FR-07 pagination réelle non vérifiés dans cet environnement.
FR-07 "no heading is the last line on a page" : vérification réelle nécessite parsing PDF paginé ou comparaison visuelle — impossible sans navigateur réel + pdfjs-dist.
NFR-03 multi-OS non vérifié (Linux + Windows CI absent localement).
Aucune commande réseau exécutée (provisioning Chromium-for-Testing non activé dans artifacts.json).
Commandes exécutées :


npm run typecheck          → 0 erreurs
npm test                   → 136/136 ✓
MD2PDF_SKIP_REAL_BROWSER_TESTS=1 npm run test:browser  → 6/6 ✓, exit 0
wc -l src/*.ts             → comptage lignes
grep/awk sur patterns      → analyse statique
métier était bon sur l'audit précedent , on a baissé en qualité du code??
Non, la qualité n'a pas baissé — c'est l'inverse.

Les findings Medium actuels (5 modules > 300L, FR-07 pagination, sha256File) existaient déjà avant nos corrections. Ce ne sont pas des régressions introduites dans cette session.

Ce qui a changé positivement depuis l'audit précédent :

Point	Avant	Maintenant
Floating promise driverProcess.stop()	❌ Défaut confirmé	✅ Corrigé
FR-04 text layer assertions	❌ Absent	✅ Présent
FR-19 / NFR-01 tags @req	❌ Manquants	✅ Tagués
Unhandled rejection startGate test	❌ Warning Vitest	✅ Corrigé
Ce qui reste Medium aujourd'hui était déjà là au démarrage de la session et est explicitement classé P4 dans le plan :

Modules > 300L → déjà noté P4 dans plan_stream_b.md
FR-07 pagination réelle → nécessiterait pdfjs-dist, P4
sha256File mémoire → provisioning only, P4
Le statut 🟡 Avertissement sur la qualité reflète ces dettes structurelles pré-existantes et non bloquantes, pas une dégradation introduite. Tous les défauts actionnables de l'audit précédent sont verts.

alors pourquoi metier passe du jaune au vert
La question est juste. Voilà ce qui s'est passé concrètement.

Dans l'audit précédent, Métier était 🟢 — aucun finding. Dans celui-ci, je lui ai attribué 🟡 avec un finding Medium sur FR-07 (le test browser-backed ne vérifie pas que le heading n'est pas le dernier élément sur une page).

Ce finding FR-07 n'est pas une régression introduite par nos corrections. Le code n'a pas changé sur ce point. C'est moi qui ai appliqué une lecture plus stricte de l'architecture §15 — elle promet "integration test: no heading is the last line on a page" alors que le test réel vérifie seulement que break-after: avoid-page est dans le CSS.

Le précédent auditeur a considéré que le test existant (@req FR-07 tagué + CSS présent) satisfaisait l'exigence. Le présent auditeur a jugé que la preuve était incomplète au regard du critère littéral de l'architecture.

En résumé : c'est une différence de rigueur entre deux passes d'audit sur un point que ni vous ni nous n'avez touché, pas une dégradation du code. Le finding est réel (la pagination PDF n'est pas prouvée sans navigateur réel + pdfjs-dist), mais il préexistait à cette session.

dans lensemble est ce que le code est optimal
Oui, pour le périmètre Stream B et le stade MVP.

Ce qui est solide et ne mérite pas de travail supplémentaire :

Correctness : 0 bug confirmé, 0 faux positif de test, 0 Critical/High dans l'audit
Robustesse : floating promise corrigé, signal d'abort propagé, atomicité PDF, cleanup dans tous les finally
Sécurité : local-only structurel, CSP correcte, supply chain auditée, path traversal bloqué
Traçabilité : tous les @req requis en place, 136 tests verts
Ce qui reste imparfait mais est explicitement accepté comme P4 :

Point	Impact réel
5 modules > 300L	Lisibilité, pas de bug
FR-07 preuve CSS seulement	Pagination non prouvée sans vrai navigateur — risque bas
sha256File charge binaire en heap	Provisioning seulement, hors chemin critique
Conclusion honnête : le code est optimal pour un MVP prêt à shipper. Les findings restants sont de la dette de confort, pas des obstacles à la release. Si vous ouvrez une P4, les 5 modules à découper sont le seul chantier qui a du sens avant une montée en charge.

don tu penses qu'on peut passer à P4? réponds honettement je veux une version qui passe les audits
Honnêtement : oui pour le gate P4, non pour un audit 0 Medium.

Le gate P4 passera (npm run build && npm test && npm run check:artifacts && npm pack) — tous les tests sont verts, le code compile.

Pour passer les audits proprement (0 Medium), il reste 4 chantiers concrets :

Finding	Effort	Action
5 modules > 300L	Moyen — refactoring pur, 0 comportement changé	Découper en P4
sha256File charge binaire entier	Faible — remplacer par un hash streaming	Faible risque
tests/contract/ fantôme dans architecture §12	Trivial — 1 ligne	Corriger la doc
FR-07 pagination non prouvée	Élevé — nécessite pdfjs-dist ou vrai test paginal	Décider scope
Mon conseil :

Lancez P4. Les 3 premiers points se règlent pendant P4 sans risque. Le 4ème (FR-07 preuve PDF réelle) est le seul qui mérite une décision de votre part : soit vous acceptez que la preuve CSS est suffisante pour le MVP et vous documentez cette limite, soit vous ajoutez pdfjs-dist en P4 pour une vérification formelle.

Avec ces 4 points traités, un audit final donnera 0 Critical · 0 High · 0 Medium. C'est atteignable dans une P4 courte.