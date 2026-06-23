AUDIT COMPLET — FIN STREAM B (share/streamB-restart-next)
Date : 2026-06-11

Auditeur : Claude Sonnet 4.6 (audit-agent)

Sources d'exigences : docs/plan_stream_b.md, docs/implementation_plan_v0.1.2.md, docs/architecture.md, docs/user_stories.md, docs/project_requirements.md

Périmètre : src/converter.ts (nouveau), src/browserLocator.ts (modifié), src/contracts.ts (modifié), src/webDriverClient.ts, src/markdownRenderer.ts, src/fallbackBrowserProvisioner.ts, src/artifactPolicy.ts, src/releaseCatalog.ts, tests/integration/, tests/unit/contracts/, tests/unit/browserLocator/, tests/unit/artifacts/, tests/unit/markdownRenderer/

Résumé de l'Audit
Division	Statut	Synthèse
Métier	🟡 Avertissement	3 exigences non prouvées au niveau test; checklist non mise à jour sur items désormais implémentés
Qualité	🟡 Avertissement	1 test manquant du plan; 2 fonctions > 40 lignes; YAGNI confirmés
Architecture	🟡 Avertissement	5 modules dépassent la limite de 300 lignes documentée; 3 écarts documentaires confirmés
Cybersécurité	🟢 OK	Contrôles SSRF, path traversal, ZIP bomb, offline/no-proxy tous en place
Verdict global : pas de bloquant de sécurité ou de correctness critique. Les gates P2 passent vert (typecheck + 135 tests + check:artifacts). Le gap principal est que artifacts.json n'a aucun artifact runtime (chromedriver, geckodriver, Chromium-for-Testing) — l'outil ne peut pas fonctionner en production réelle.

Index des Sous-Audits
Sous-audit	Scope	Crit	High	Medium	Low	Verdict
Business Logic Auditor	Stream B P1-P3	0	1	0	1	AUDIT_FAIL
Requirements Compliance Auditor	Tags @req FR/NFR	0	0	2	0	AUDIT_FAIL
Doc-Sync Auditor	architecture.md vs code	0	0	3	1	AUDIT_FAIL
A11y/UX Checker	N/A (pas de front-end)	—	—	—	—	N/A
Clean Code Auditor	converter.ts, browserLocator.ts, fallbackBrowserProvisioner.ts	0	0	0	2	AUDIT_PASS
Fail-Loud Auditor	browserLocator.ts, converter.ts	0	0	0	1	AUDIT_PASS
Test Quality Auditor	tests/integration/, tests/unit/	0	0	1	0	AUDIT_FAIL
Mutation/Saboteur Auditor	logique critique	0	0	0	0	AUDIT_PASS
Layer Enforcer	imports transverses	0	0	0	1	AUDIT_PASS
YAGNI Auditor	exports inutilisés	0	0	0	2	AUDIT_PASS
SRE/Performance Auditor	mémoire, timeouts, ports	0	0	1	1	AUDIT_PASS
Architecture Consistency Auditor	architecture.md §5	0	0	3	1	AUDIT_FAIL
Contextual Threat Analyst	TOCTOU, ports, liens	0	0	0	1	AUDIT_PASS
SAST Scanner	SSRF, path traversal, injections	0	0	0	0	AUDIT_PASS
Supply Chain & Artifact Auditor	artifacts.json, downloads	0	1	0	0	AUDIT_FAIL
Privacy/Exfiltration Auditor	HTML généré, PDF, logs	0	0	0	0	AUDIT_PASS
Totaux normalisés : Critique 0 · High 2 · Medium 9 · Low 11

Matrice de Couverture des Exigences Stream B
Req	Fichier(s) source	Test	Statut
FR-01 (Markdown→PDF)	converter.ts	converter.test.ts, browserBackedConversion.test.ts	✅ Couvert
FR-04 (CommonMark+tables+tasks+footnotes)	markdownRenderer.ts	markdownRenderer.test.ts	✅ Couvert
FR-05 (highlight.js)	markdownRenderer.ts	markdownRenderer.test.ts	✅ Couvert
FR-06 (images relatives)	markdownRenderer.ts	markdownRenderer.test.ts	✅ Couvert
FR-07 (heading orphan)	assets/default.css, webDriverClient.ts	markdownRenderer.test.ts, webDriverClient.test.ts	✅ Couvert
FR-16 (image manquante)	markdownRenderer.ts	markdownRenderer.test.ts	✅ Couvert
FR-19 (MD2PDF_BROWSER)	browserLocator.ts	browserLocator.test.ts	✅ Couvert
FR-24 (Mermaid diagram)	markdownRenderer.ts, webDriverClient.ts	markdownRenderer.test.ts, browserBackedConversion.test.ts	✅ Couvert (browser skippé par défaut)
NFR-01 (zero config)	converter.ts, markdownRenderer.ts	converter.test.ts	✅ Couvert
NFR-02 (local-only HTML)	markdownRenderer.ts, webDriverClient.ts	markdownRenderer.test.ts, webDriverClient.test.ts	⚠️ Partiel — test séparé "provisioning ne lit pas Markdown" absent
NFR-02 (conversion offline pré-provisionnée)	webDriverClient.ts, browserLocator.ts	browserBackedConversion.test.ts	⚠️ Skip par défaut
NFR-03 (portabilité browser detection)	browserLocator.ts	browserLocator.test.ts	✅ Couvert
NFR-05 (SHA-256 artifacts)	fallbackBrowserProvisioner.ts, artifactPolicy.ts	fallbackBrowserProvisioner.test.ts, contracts.test.ts	✅ Couvert
Top Findings
[High] artifacts.json — Aucun artifact chromedriver, geckodriver, ou Chromium-for-Testing déclaré. L'outil est non-fonctionnel en production sur toute machine sans navigateur déjà installé avec driver.
[High] converter.ts:106-125 / markdownRenderer.ts:95-112 — Driver process non attendu lors d'un timeout withTempHtml : la promesse work flotte, le cleanup WebDriver se déroule en tâche de fond sans que l'appelant l'attende. [RISQUE] de fuite si cleanup échoue après timeout.
[Medium] plan_stream_b.md — Test manquant : "le provisioning ne lit pas le contenu Markdown" (exigé explicitement par le plan NFR-02).
[Medium] tests/integration/browserBackedConversion.test.ts:9-10 — Skip silencieux par défaut via MD2PDF_SKIP_REAL_BROWSER_TESTS. Conformément au plan, le skip explicite est acceptable pour local dev, mais aucun mécanisme de preuve release n'oblige à le désactiver en CI.
[Medium] docs/architecture.md §5 — 5 modules Stream B dépassent la limite de 300 lignes documentée (fallbackBrowserProvisioner.ts 613L, browserLocator.ts 600L, webDriverClient.ts 489L, markdownRenderer.ts 436L, converter.ts 370L).
[Medium] docs/architecture.md §15 — Promet "integration test: tables, task lists, footnotes present in PDF text layer" mais browserBackedConversion.test.ts ne vérifie que l'en-tête %PDF- et la taille en octets. Aucune extraction du texte du PDF pour vérifier la présence du contenu.
[Medium] docs/release-evidence/release-checklist-v0.1.2.md — Items "Cache writes are atomic" et "Cache non-writable reports explicit artifact/browser error" sont marqués pending alors que l'implémentation est complète et testée.
Détails par Division
Division Métier (Anton Ego)
La logique métier est bien exécutée. Chaque conversion passe par le pipeline attesté : lecture UTF-8 → rendu HTML → HTML temporaire → WebDriver Print → écriture atomique. La politique d'écrasement est laissée au Stream A comme prévu. La frontière provisioning/conversion est nette.

Cependant, ce dossier souffre de lacunes documentaires qui trahissent le contrat livré.

[High] artifacts.json — Aucun artifact runtime n'est déclaré. ArtifactPolicyDriverResolver.resolveDriver() retournera toujours null pour tout navigateur sur toute installation fraîche. FallbackBrowserProvisioner échouera avec BrowserNotFoundError(cause: ArtifactFreshnessError("no-eligible-release")). Le plan reconnaît cette limite (artifacts.json séparé du provisioning engine), mais le livrable Stream B P2-P3 est structurellement incomplet pour une release.
[Low] docs/release-evidence/release-checklist-v0.1.2.md:126-128 — "Cache writes are atomic" et "Cache non-writable" marqués pending alors que fallbackBrowserProvisioner.ts les implémente avec tests vert. Écart de traçabilité.
Points conformes : logique de rendu Mermaid (attente data-mermaid-status="done", timeout wrappé en RenderError, surfaçage de data-mermaid-error); écriture atomique PDF (.tmp + rename); RenderError avec sourcePath et actionHint sur image manquante; support MD2PDF_BROWSER avec les trois causes d'erreur prescrites.

Division Qualité (Gordon Ramsay)
135 tests verts. Aucun faux-vert confirmé. Mais il y a des angles morts.

Clean Code Auditor :

[Low] webDriverClient.ts:141-208 (printPdfWithWebDriver, 68 lignes) et fallbackBrowserProvisioner.ts:455-522 (inspectZipArchive, 68 lignes) dépassent la limite de 40 lignes par fonction documentée en architecture.md §5. fallbackBrowserProvisioner.ts:378-428 (defaultDownloader.download, 51 lignes) également.
[Low] browserLocator.ts:308-337 — nodeFileSystem.isExecutable swallows toute exception (y compris EPERM) et retourne false. Un fichier inaccessible par permissions devient silencieusement "non-exécutable" au lieu de déclencher une erreur explicite. Sur validateExplicitBrowser, cela produit un env-browser-not-found au lieu d'un env-browser-not-launchable attendu.
Test Quality Auditor :

[Medium] Test absent — plan_stream_b.md (et implementation_plan_v0.1.2.md §9) exige explicitement : "Test séparé : le provisioning ne lit pas le contenu Markdown." Aucun test dans converter.test.ts ni browserBackedConversion.test.ts ne vérifie que browserLocatorFactory ne reçoit pas le contenu du fichier Markdown. C'est un contrat de non-contamination (NFR-02) non prouvé.
Mutation/Saboteur Auditor :

Points résistants aux mutations : assertChecksum (inversion SHA-256 → test "integrity-mismatch" échoue ✓), condition de quarantaine dans ArtifactPolicy (inversion → test "selects newest release" échoue ✓), hasMermaid dans assembleHtml (false fixé → test @req FR-24 marks documents without Mermaid passe mais le test Mermaid runner échouerait ✓), validation PDF %PDF- dans readPdfData (retrait → test "rejects non-PDF" échoue ✓).

Points conformes : les tests de fallbackBrowserProvisioner.test.ts couvrent l'intégralité des cas fake catalog prescrits (checksum invalide, download interrompu, cache partiel, cache racine fichier, archive réelle, plateforme, path traversal, ZIP oversized, cache tampered, non-exécutable, version périmée, cache non writable).

Division Architecture (Steve Jobs)
Layer Enforcer :

[Low] src/contracts.ts:8 — export { convertFile, DocumentConverter } from "./converter.js" : DocumentConverter est re-exporté depuis contracts.ts. Cet export n'est pas dans la spécification C0 (implementation_plan_v0.1.2.md §4) qui ne liste que convertFile. Cela expose les interfaces d'injection de dépendances (DocumentConverterDependencies) comme contrat public. Aucun consommateur externe n'utilise cet export (les tests importent directement depuis converter.js).
YAGNI Auditor :

[Low] src/converter.ts:34-37 — Interface WebDriverSession exportée alors qu'elle n'est utilisée qu'en interne dans converter.ts. Aucun test ni module externe ne l'importe.
[Low] src/contracts.ts:8 — DocumentConverter re-exporté (voir Layer Enforcer ci-dessus). Doublon YAGNI confirmé.
Architecture Consistency Auditor :

[Medium] docs/architecture.md §5 — Limite de 300 lignes par module documentée. Violations confirmées :

src/fallbackBrowserProvisioner.ts : 613 lignes
src/browserLocator.ts : 600 lignes
src/webDriverClient.ts : 489 lignes
src/markdownRenderer.ts : 436 lignes
src/converter.ts : 370 lignes
Aucun de ces fichiers ne respecte la contrainte. Écart documentaire, non défaut de code.

[Medium] docs/architecture.md §15 — "FR-04 : integration test: tables, task lists, footnotes present in PDF text layer". Le test browserBackedConversion.test.ts:73 vérifie uniquement %PDF- et pdf.byteLength > 1_000. Il n'extrait pas de couche texte du PDF. La promesse de l'architecture n'est pas tenue.

[Medium] docs/architecture.md §4 — "C0 must document the default timeout before any production implementation relies on it." defaultRenderTimeoutMs = 30_000 est codé en dur dans webDriverClient.ts:71 et converter.ts:59 mais n'est pas documenté dans architecture.md. Écart documentaire.

SRE/Performance Auditor :

[Medium] [RISQUE] converter.ts:106-125 + markdownRenderer.ts:95-112 — Lorsque le timeout withTempHtml se déclenche, la promesse work de l'useHtml callback continue de s'exécuter en tâche de fond (non-awaited). Le cleanup WebDriver (DELETE /session + driverProcess.stop()) se déroule via le signal d'abort, mais l'appelant (convertFile) a déjà rejeté et retourné. Si le cleanup WebDriver échoue après que le timeout ait déclenché, la rejection est absorbée par le .then de withTimeout (déjà settled). Aucune fuite de rejet non géré, mais le driver process n'est pas attendu avant le retour du convertFile. Sur une séquence timeout + cleanup long, la prochaine conversion peut commencer avant que le driver précédent soit terminé.

[Low] fallbackBrowserProvisioner.ts:562 (sha256File) et fallbackBrowserProvisioner.ts:240-244 (assertChecksum) — Les deux chargent l'archive entière en mémoire pour le calcul SHA-256. Pour les archives déclarées (jusqu'à release.size octets), c'est acceptable. Le unzipSync(archive) dans defaultExtractor charge simultanément compressé + décompressé. Pour une archive de 200 Mo, pic RAM ≈ 400 Mo. Documenté comme limite acceptable.

Points conformes : séparation stricte des responsabilités (BrowserLocator / ArtifactPolicy / ReleaseCatalog / FallbackBrowserProvisioner); converter.ts ne connaît pas les internals du WebDriver; aucune violation de couche Stream A / Stream B; pipeline.ts utilise convertFile comme fonction injectable.

Division Cybersécurité Offensive (Sherlock Holmes)
SAST Scanner :

Élémentaire, et pourtant... toutes les surfaces d'injection sont correctement défendues.
Path traversal : resolveInside() (fallbackBrowserProvisioner.ts:568-579) utilise resolve + relative + startsWith(".."). Test @req NFR-05 rejects zip entries that escape the cache directory confirme. ✓
SSRF via WebDriver path : webDriverEndpoint() (webDriverClient.ts:262-281) rejette les URL absolues et les protocoles. assertFileUrl() n'accepte que file: avec hostname vide ou localhost. ✓
Injection via browserPath : execFile(path, ["--version"]) sans shell. Pas d'injection commande. ✓
XSS Markdown : md.html = false, mdEscapeHtml() appliqué aux attributs. CSP default-src 'none'. Liens non-relatifs strippés de leur href. ✓
ZIP bomb : limite de 20 000 entrées et 1,5 GB décompressés vérifiée sur la Central Directory avant extraction. Test dédié. ✓
Supply Chain & Artifact Auditor :

[High] artifacts.json — Aucun artifact runtime (chromedriver, geckodriver, chromium-for-testing) déclaré. Les champs plannedArtifactClasses les mentionnent comme prévus mais non déclarés. Jusqu'à déclaration avec URL immuable HTTPS, SHA-256, taille et provenance, le mécanisme complet est non-utilisable.
[Low] [RISQUE] fallbackBrowserProvisioner.ts:377-429 — defaultDownloader utilise httpsGet de node:https au lieu du fetch global. Le reste du code utilise fetch. Incohérence mineure, pas de risque de sécurité.
Contextual Threat Analyst :

[Low] [RISQUE] converter.ts:280-294 (findOpenLocalPort) — TOCTOU : le port libéré entre server.close() et spawn(driverPath, ...) peut être capturé par un autre processus local. Atténuation : 3 tentatives, loopback uniquement (127.0.0.1). Risque marginal sur machine partagée.
Privacy/Exfiltration Auditor :

HTML généré : CSP default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'. Aucune URL externe exploitable. renderLinkOpen() retire les hrefs non-relatifs. ✓
Navigateurs : Chrome avec --no-proxy-server --proxy-server=direct://, Firefox avec --offline. ✓
Le contenu Markdown ne transite pas vers les fonctions de download (order vérifiable dans converter.ts:100-128 : locate() est appelé avant withTempHtml). ✓
Détails par Sous-Audit
Business Logic Auditor
Verdict : AUDIT_FAIL (H1 délivrance, L1 traçabilité)
Findings : Voir H1 (artifacts.json vide), L1 (checklist périmée)
Points conformes : Conversion atomique; harness HTML temporaire avec cleanup; RenderError avec sourcePath sur image manquante; les 3 causes MD2PDF_BROWSER implémentées
Requirements Compliance Auditor
Verdict : AUDIT_FAIL (M1 test NFR-02 manquant, M2 skip browser tests)
Findings : Test "provisioning ne lit pas Markdown" absent; tests browser default-skip sans obligation CI
Points conformes : Tous les tags @req présents dans les tests unitaires et d'intégration; FR-01, FR-04→FR-07, FR-16, FR-19, FR-24, NFR-01→NFR-05 tracés
Doc-Sync Auditor
Verdict : AUDIT_FAIL (M3, M4, M5 écarts architecture.md)
Findings :
M3 : 5 modules > 300 lignes (architecture.md §5)
M4 : 3 fonctions > 40 lignes (printPdfWithWebDriver, inspectZipArchive, download)
M5 : FR-04 vérification PDF text layer promise non tenue
L4 : timeout 30 000ms non documenté dans architecture.md
Points conformes : architecture.md §4 contrats publics alignés; §9 frontière provisioning/conversion documentée; §13 ADR-05 séparation BrowserLocator/FallbackBrowserProvisioner validée par le code
A11y/UX Checker
Verdict : N/A (aucune interface front-end touchée par Stream B)
Clean Code Auditor
Verdict : AUDIT_PASS (Low uniquement)
Findings : L2 (isExecutable swallows EPERM), L3 (fonctions > 40L)
Points conformes : Nommage cohérent; constantes symboliques (driverStartupTimeoutMs, defaultRenderTimeoutMs); aucun magic string non expliqué; module-level caches justifiés (perf)
Fail-Loud Auditor
Verdict : AUDIT_PASS (Low uniquement)
Findings : L2 (nodeFileSystem.isExecutable swallows EPERM)
Points conformes : removeTemporaryOutput catch documenté ("best effort cleanup: the conversion has already failed"); cleanupTempDir retourne l'erreur pour inspection; handleCleanup élève les erreurs de cleanup quand il n'y a pas d'échec primaire; purgeStaleCaches propage les erreurs de permission
Test Quality Auditor
Verdict : AUDIT_FAIL (M1)
Findings : Test "provisioning ne lit pas Markdown" absent
Points conformes : converter.test.ts vérifie l'ordre des opérations (invariant atomicité); assertions fortes sur chemins temporaires supprimés; browserBackedConversion.test.ts vérifie absence du texte Mermaid raw dans le PDF et présence d'un objet visuel (/XObject, /Image, /Form); tous les cas fake catalog couverts
Mutation/Saboteur Auditor
Verdict : AUDIT_PASS
Findings : Aucun
Points conformes : checksum SHA-256 muté → test integrity-mismatch; quarantineDays muté → test quarantine bypass; hasMermaid muté → tests Mermaid; %PDF- muté → test non-PDF; readSessionId muté → session invalide détectée
Layer Enforcer
Verdict : AUDIT_PASS (Low)
Findings : L1 (DocumentConverter re-exporté depuis contracts.ts)
Points conformes : Stream B ne modifie pas cli.ts, paths.ts, overwrite.ts, pipeline.ts; imports unidirectionnels errors.ts → pas de cycle
YAGNI Auditor
Verdict : AUDIT_PASS (Low)
Findings : DocumentConverter re-exporté depuis contracts.ts (non spécifié en C0); WebDriverSession exporté depuis converter.ts (usage interne uniquement)
Points conformes : Toutes les interfaces d'injection (BrowserLocatorLike, ConverterFileSystem, WebDriverSessionFactory) sont utilisées dans les tests; pas d'abstraction spéculative
SRE/Performance Auditor
Verdict : AUDIT_PASS (M/L [RISQUE])
Findings : [RISQUE] M — floating promise driver cleanup sur timeout outer; [L] mémoire archive × 2 pour extraction ZIP
Points conformes : Retry de port (3 tentatives); SIGKILL sur shutdown timeout driver; purge des vieux caches au provisioning; caches versionnés par artifact + version exacte
Architecture Consistency Auditor
Verdict : AUDIT_FAIL (3 Medium)
Findings : modules > 300L; fonctions > 40L; FR-04 PDF text layer non prouvé en integration; timeout 30s non documenté
Points conformes : architecture.md §5 componant view aligné avec le code réel; §9 local-only enforcement structurellement implémentée; §11 packaging bin/scripts aligné
Contextual Threat Analyst
Verdict : AUDIT_PASS (Low [RISQUE])
Findings : TOCTOU port allocation
Points conformes : Mermaid securityLevel: 'strict'; liens javascript: bloqués par hasUriScheme; UUID cryptographique pour nommage tmp files
SAST Scanner
Verdict : AUDIT_PASS
Findings : Aucun
Points conformes : Pas d'exécution shell (execFile); resolveInside anti-traversal; webDriverEndpoint anti-SSRF; assertFileUrl anti-SSRF; ZIP bomb bounds; CSP default-src 'none'
Supply Chain & Artifact Auditor
Verdict : AUDIT_FAIL (High)
Findings : H1 — artifacts.json sans artifact runtime
Points conformes : Policy freshness check: quarantineDays hardcodé à 7, rejet de toute autre valeur; isImmutableHttpsUrl (pas de query/fragment); interdiction des tags flottants (latest, stable...); SHA-256 64 hex chars obligatoire; size > 0 obligatoire; provenance non vide obligatoire
Privacy/Exfiltration Auditor
Verdict : AUDIT_PASS
Findings : Aucun
Points conformes : HTML sans URL externe; navigateur offline; Markdown non transmis au provisioning; PDF uniquement du navigateur local
Limites de Vérification
npm run test:browser non exécuté — nécessite navigateur réel pré-provisionné sur la machine hôte.
npm run build non exécuté — non demandé; le dist/ existant n'est pas audité.
docs/ci_matrix_v0.1.md lu mais aucun fichier .github/workflows/ présent dans le repo — la matrice CI n'est pas implémentée.
Windows : nodeFileSystem.isExecutable avec constants.X_OK — comportement sous Windows non testé (tous les fichiers sont "exécutables" pour access(X_OK) sur Win32). [RISQUE] plateforme non vérifiable dans le sandbox actuel.
Commandes Exécutées

npm run typecheck       → vert (0 erreur)
npm test                → vert (135 tests, 12 fichiers)
npm run check:artifacts → vert ("Artifact freshness policy passed")
