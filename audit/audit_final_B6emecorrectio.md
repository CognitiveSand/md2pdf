Résumé De L'Audit
Date : 2026-06-11 — État post-corrections 4ème itération, branche share/streamB-restart-next

Division	Statut	Synthèse
Métier	🟡 Avertissement	1 High structurel (artifacts.json vide) ; contrats et workflow conformes
Qualité	🟡 Avertissement	135 tests verts ; 1 Medium (PDF text-layer non prouvé en intégration) ; 1 Low (YAGNI NotImplementedError)
Architecture	🟡 Avertissement	5 modules > 300L ; 1 Low (fonctions > 40L) ; 1 [RISQUE] SRE floating driver promise
Cybersécurité	🟢 OK	SSRF, path traversal, ZIP bomb, offline/no-proxy tous en place. 1 High partagé avec Métier (supply chain artifacts)
Verdict global : Pas de bloquant de correctness ou de sécurité. Gates rapides 100% verts : typecheck + 135 tests + check:artifacts. Le seul High restant est structurel et documenté comme tel dans le plan : artifacts.json sans artifact runtime, conséquence reconnue d'une décision supply-chain séparée. Le Gate P3 (npm run build && npm run test:browser) est non-exécutable sans navigateur pré-provisionné.

Index Des Sous-Audits
Sous-audit	Verdict	Crit	High	Medium	Low
Business Logic	AUDIT_FAIL	0	1	0	0
Requirements Compliance	AUDIT_PASS	0	0	1	0
Doc-Sync	AUDIT_FAIL	0	0	2	1
A11y/UX	N/A	—	—	—	—
Clean Code	AUDIT_PASS	0	0	0	1
Fail-Loud	AUDIT_PASS	0	0	0	1
Test Quality	AUDIT_PASS	0	0	1	0
Mutation/Saboteur	AUDIT_PASS	0	0	0	0
Layer Enforcer	AUDIT_PASS	0	0	0	0
YAGNI	AUDIT_PASS	0	0	0	1
SRE/Performance	AUDIT_PASS	0	0	0	1
Architecture Consistency	AUDIT_FAIL	0	0	2	1
Contextual Threat	AUDIT_PASS	0	0	0	1
SAST	AUDIT_PASS	0	0	0	0
Supply Chain & Artifact	AUDIT_FAIL	0	1	0	0
Privacy/Exfiltration	AUDIT_PASS	0	0	0	0
Totaux : Critique 0 · High 2 · Medium 4 · Low 7
(Le H1 Supply Chain et le H1 Business Logic sont le même finding vu depuis deux divisions.)

Matrice De Couverture Des Exigences Stream B
Req	Implémentation	Test	Statut
FR-01 (Markdown→PDF)	converter.ts	converter.test.ts, browserBackedConversion.test.ts	✅ Couvert
FR-04 (tables, tasks, footnotes)	markdownRenderer.ts	markdownRenderer.test.ts	✅ Couvert
FR-05 (highlight.js)	markdownRenderer.ts	markdownRenderer.test.ts	✅ Couvert
FR-06 (images relatives)	markdownRenderer.ts	markdownRenderer.test.ts	✅ Couvert
FR-07 (heading orphan)	assets/default.css:36, webDriverClient.ts	markdownRenderer.test.ts, webDriverClient.test.ts	✅ Couvert
FR-16 (image manquante)	markdownRenderer.ts	markdownRenderer.test.ts	✅ Couvert
FR-19 (MD2PDF_BROWSER)	browserLocator.ts	browserLocator.test.ts	✅ Couvert
FR-24 (Mermaid)	markdownRenderer.ts, webDriverClient.ts	markdownRenderer.test.ts, browserBackedConversion.test.ts	✅ Couvert (browser skip-able)
NFR-01 (zero config)	converter.ts, markdownRenderer.ts	converter.test.ts	✅ Couvert
NFR-02 (local-only HTML)	markdownRenderer.ts, webDriverClient.ts	markdownRenderer.test.ts, webDriverClient.test.ts	✅ Couvert
NFR-02 (provisioning ne lit pas Markdown)	converter.ts:103-104	converter.test.ts:65-90	✅ Nouveau test ajouté
NFR-02 (conversion offline pré-provisionnée)	webDriverClient.ts	browserBackedConversion.test.ts	⚠️ Skip par défaut
NFR-03 (portabilité browser detection)	browserLocator.ts	browserLocator.test.ts	✅ Couvert
NFR-05 (SHA-256 artifacts)	fallbackBrowserProvisioner.ts, artifactPolicy.ts	fallbackBrowserProvisioner.test.ts	✅ Couvert
Top Findings
[High] artifacts.json — Aucun artifact runtime déclaré

Preuve : artifacts.json:54-63 liste chromedriver, geckodriver, Chromium-for-Testing dans plannedArtifactClasses mais aucun n'est dans artifacts[]. ArtifactPolicyDriverResolver.resolveDriver() retourne null pour tout navigateur. FallbackBrowserProvisioner lève BrowserNotFoundError(cause: ArtifactFreshnessError("no-eligible-release")).
Impact : Outil non-fonctionnel en production sur toute machine sans navigateur et driver déjà installés.
Atténuation documentée : docs/plan_stream_b.md:90-95 reconnaît cette limite comme "travail supply-chain séparé". Le mécanisme est complet et prouvé via fake catalog — il manque uniquement les déclarations réelles.
[Medium] docs/architecture.md §15 — PDF text-layer non prouvé en intégration

Preuve : docs/architecture.md promet "FR-04: integration test: tables, task lists, footnotes present in PDF text layer". tests/integration/browserBackedConversion.test.ts:68-74 vérifie seulement %PDF- et byteLength > 1_000. Aucune extraction de texte PDF.
Type : Écart documentaire.
Correction attendue : soit extraire et vérifier le texte du PDF (pdf-parse ou pdftotext), soit mettre à jour l'architecture pour déclarer que cette preuve est différée.
[Medium] 5 modules > 300 lignes (docs/architecture.md §5)

Preuve : fallbackBrowserProvisioner.ts 612L, browserLocator.ts 599L, webDriverClient.ts 488L, markdownRenderer.ts 435L, converter.ts 369L — limite documentée docs/architecture.md:157.
Type : Écart documentaire persistant.
Impact : Documentation fausse sur la structure du code. Pas de bug de code.
[Medium] [RISQUE] converter.ts:106-125 — Floating promise sur timeout extérieur

Preuve : withTempHtml passe renderTimeoutMs comme timeout extérieur (converter.ts:124). Si le timeout withTempHtml se déclenche, la promesse work (session WebDriver) continue de tourner en arrière-plan ; convertFile a déjà rejeté avant que le cleanup WebDriver se termine.
Type : [RISQUE] — aucun crash ou fuite de rejection non gérée confirmée (le .then de withTimeout est déjà settled), mais le process driver n'est pas attendu avant retour de convertFile.
Impact potentiel : sur une séquence timeout + cleanup long, une seconde conversion peut démarrer avec le driver précédent encore actif.
Détails Par Division
Division Métier (Anton Ego)
Ce code fait ce qu'il promet : il lit un Markdown, produit un HTML local, et délègue le rendu à un navigateur. Le pipeline est propre, les contrats sont tenus.

Cependant, le catalogue d'artifacts est vide de tout artifact runtime. Le mécanisme de provisioning est une cathédrale parfaitement construite, sans pierre pour la remplir. Ce n'est pas un défaut d'implémentation — c'est un choix documenté et assumé — mais cela signifie qu'aucun utilisateur sur machine fraîche ne peut convertir un seul document sans installer Chrome ou Firefox lui-même.

[High] artifacts.json — Voir Top Findings.

Points conformes : lecture source UTF-8 avant localisation navigateur (converter.ts:103-104) ; HTML temporaire nettoyé dans finally (markdownRenderer.ts:109) ; PDF écrit uniquement après rendu complet (converter.ts:127) ; écriture atomique via .tmp + rename (converter.ts:136-144) ; release checklist cache-writes-atomic et cache-not-writable désormais pass.

Division Qualité (Gordon Ramsay)
135 tests, zéro faux vert confirmé. C'est la première fois depuis le début de cette série d'audits que je peux écrire cette phrase sans caveat sur un test:browser saboteur.

[Medium] browserBackedConversion.test.ts:68-74 — La preuve PDF "tables, task lists, footnotes" n'inspecte pas le texte du PDF. L'architecture promet une vérification de la couche texte. Le test est fonctionnellement honnête (un vrai PDF est produit), mais la preuve documentaire est incomplète.

[Low] NotImplementedError (src/errors.ts:74) — Exporté, jamais levé dans aucun module source. Testé uniquement comme import dans contracts.test.ts:39. YAGNI résiduel du C0 stub.

[Low] 3 fonctions > 40L : printPdfWithWebDriver (68L, webDriverClient.ts:141), inspectZipArchive (68L, fallbackBrowserProvisioner.ts), defaultDownloader.download (51L) — écarts avec architecture.md §5.

Points conformes : test d'ordre d'opérations vérifie ["read", "locate", "start", "print", "mkdir", "write", "rename"] (converter.test.ts:62) ; nouveau test @req NFR-02 vérifie l'absence du contenu Markdown dans les options transmises au provisioning (converter.test.ts:65-90) ; mutations résistantes : checksum, quarantaine, Mermaid, %PDF-.

Division Architecture (Steve Jobs)
Layer Enforcer : Aucune violation. converter.ts ignore les internals de webDriverClient.ts. contracts.ts n'expose plus que convertFile — DocumentConverter a été retiré du re-export public. WebDriverSession est désormais interne à converter.ts. Pipeline propre.

YAGNI : NotImplementedError (errors.ts:74) — seule interface résiduelle sans usage production. Tous les autres exports précédemment signalés ont été supprimés.

SRE/Performance : [RISQUE] [Low] Floating promise driver sur timeout extérieur — voir Top Findings. Charge mémoire ZIP (archive × 2 pour extraction) reste acceptable et documentée.

Architecture Consistency :

[Medium] Limite 300L violée par 5 modules — voir Top Findings.

[Medium] docs/architecture.md §15 — PDF text-layer non prouvé — voir Top Findings.

[Low] docs/architecture.md §5 mentionne la limite 40L par fonction — 3 fonctions la dépassent.

Points conformes : architecture.md §4 aligne les contrats publics avec l'implémentation ; timeout 30s désormais documenté (architecture.md:132-133) ; §9 frontière provisioning/conversion structurellement tenue.

Division Cybersécurité Offensive (Sherlock Holmes)
Élémentaire, et cette fois sans réserve majeure.

SAST : Toutes les surfaces d'injection correctement défendues. resolveInside() anti-traversal ZIP testé. webDriverEndpoint() et assertFileUrl() anti-SSRF confirmés. execFile sans shell. CSP default-src 'none'. Liens javascript: bloqués par hasUriScheme.

Supply Chain : [High] artifacts.json sans artifact runtime — partagé avec Division Métier. Tant que chromedriver/geckodriver/Chromium-for-Testing ne sont pas déclarés avec URL immuable HTTPS, SHA-256, taille et provenance, le mécanisme complet reste inopérant.

[Low] [RISQUE] TOCTOU port : findOpenLocalPort() (converter.ts:280) libère le port entre server.close() et spawn(). Atténué par 3 tentatives et loopback-only.

Privacy : Markdown ne transite pas vers le provisioning (converter.ts:103-104) — prouvé structurellement et désormais couvert par test. HTML sans URL externe. Navigateurs en mode offline/no-proxy.

Détails Par Sous-Audit
Business Logic Auditor
Verdict : AUDIT_FAIL (H1 artifacts.json)
Findings : H1 artifacts.json vide
Points conformes : pipeline atomique ; harness HTML avec cleanup ; trois causes MD2PDF_BROWSER ; écriture PDF uniquement après rendu complet
Requirements Compliance Auditor
Verdict : AUDIT_PASS (M1)
Findings : M1 — browserBackedConversion.test.ts skip par défaut sans obligation CI (acceptable per plan, non bloquant)
Points conformes : tous tags @req présents ; FR-01/04/05/06/07/16/19/24, NFR-01/02/03/05 tracés ; nouveau test NFR-02 provisioning ajouté
Doc-Sync Auditor
Verdict : AUDIT_FAIL (M2, M3)
Findings : M2 — architecture.md §15 PDF text-layer non prouvé ; M3 — 5 modules > 300L ; L1 — 3 fonctions > 40L
Points conformes : timeout 30s documenté dans architecture.md ; release checklist cache items désormais pass
Clean Code Auditor
Verdict : AUDIT_PASS (L)
Findings : L1 — nodeFileSystem.isExecutable (browserLocator.ts:317-328) swallows EPERM silencieusement ; L2 — 3 fonctions > 40L
Points conformes : constantes symboliques ; module-level caches justifiés ; nommage cohérent
Fail-Loud Auditor
Verdict : AUDIT_PASS (L)
Findings : L1 — isExecutable swallows EPERM → retourne false au lieu de remonter l'erreur de permission
Points conformes : removeTemporaryOutput catch documenté (best-effort) ; handleCleanup élève les erreurs quand il n'y a pas d'échec primaire ; purgeStaleCaches propage les erreurs de permission
Test Quality Auditor
Verdict : AUDIT_PASS (M)
Findings : M1 — browserBackedConversion.test.ts:68-74 n'extrait pas le texte PDF pour vérifier FR-04
Points conformes : test d'ordre opérations ; test atomicité (fichier existant préservé sur erreur) ; nouveau test NFR-02 non-contamination Markdown ; fake catalog exhaustif
Mutation/Saboteur Auditor
Verdict : AUDIT_PASS
Findings : aucun
Points conformes : inversion SHA-256 → test integrity-mismatch ; inversion quarantineDays → test quarantine bypass ; suppression hasMermaid → Mermaid runner absent ; retrait validation %PDF- → test non-PDF
Layer Enforcer
Verdict : AUDIT_PASS
Findings : aucun
Points conformes : Stream B ne touche pas cli.ts, paths.ts, overwrite.ts, pipeline.ts ; imports unidirectionnels sans cycle
YAGNI Auditor
Verdict : AUDIT_PASS (L)
Findings : L1 — NotImplementedError (errors.ts:74) exporté, jamais levé en production
Points conformes : DocumentConverter retiré du re-export contracts.ts ; WebDriverSession rendu interne à converter.ts ; toutes les interfaces d'injection (BrowserLocatorLike, ConverterFileSystem, WebDriverSessionFactory) utilisées en tests
SRE/Performance Auditor
Verdict : AUDIT_PASS (L [RISQUE])
Findings : [RISQUE] floating promise driver sur timeout withTempHtml ; [L] pic RAM ZIP × 2 acceptable
Points conformes : 3 tentatives port ; SIGKILL sur shutdown timeout ; purge vieux caches ; caches versionnés
Architecture Consistency Auditor
Verdict : AUDIT_FAIL (M2, M3)
Findings : M2 — 5 modules > 300L ; M3 — PDF text-layer non prouvé en intégration
Points conformes : architecture.md §4 contrats alignés ; §9 local-only tenu ; timeout documenté
Contextual Threat Analyst
Verdict : AUDIT_PASS (L [RISQUE])
Findings : [RISQUE] TOCTOU port allocation
Points conformes : UUID cryptographique pour noms tmp ; Mermaid securityLevel:'strict' ; liens javascript: bloqués
SAST Scanner
Verdict : AUDIT_PASS
Findings : aucun
Points conformes : pas d'exécution shell (execFile) ; resolveInside anti-traversal ; webDriverEndpoint + assertFileUrl anti-SSRF ; ZIP bomb bounds (20k entrées, 1.5GB) ; CSP default-src 'none'
Supply Chain & Artifact Auditor
Verdict : AUDIT_FAIL (H1)
Findings : H1 — artifacts.json sans artifact runtime
Points conformes : quarantineDays figé à 7 ; isImmutableHttpsUrl (pas de query/fragment) ; tags flottants interdits ; SHA-256 64 hex obligatoire ; size > 0 obligatoire ; provenance non vide obligatoire
Privacy/Exfiltration Auditor
Verdict : AUDIT_PASS
Findings : aucun
Points conformes : HTML sans URL externe ; navigateur offline ; Markdown non transmis au provisioning (structurel + testé) ; PDF uniquement du navigateur local
Points Conformes Majeurs (Rapport Global)
Retrait de DocumentConverter du re-export public contracts.ts — surface API minimale respectée.
WebDriverSession rendu interne à converter.ts — no-leak confirmé.
Timeout 30s documenté dans architecture.md §4.
Release checklist cache-writes-atomic et cache-not-writable désormais pass.
Test @req NFR-02 browserLocatorFactory does not receive Markdown source content ajouté.
Ordre d'opérations (read → locate → start → print → mkdir → write → rename) vérifié par test.
Écriture atomique PDF (.tmp + rename) testée et confirmée.
Tous les contrôles de sécurité de la 3ème correction maintenus : SSRF, path traversal, ZIP bomb, offline/no-proxy, CSP, lien javascript: bloqué.
Limites De Vérification
npm run test:browser non exécuté — nécessite navigateur + driver pré-provisionné.
npm run build non exécuté — dist/ non régénéré dans cet audit.
Windows : isExecutable avec constants.X_OK — comportement non testable dans le sandbox actuel.
CI matrix : aucun fichier .github/workflows/ présent — non vérifiable.
Commandes Exécutées

npm run typecheck    → vert (0 erreur TypeScript)
npm test             → vert (135 tests, 12 fichiers, 676ms)
npm run check:artifacts → vert ("Artifact freshness policy passed")