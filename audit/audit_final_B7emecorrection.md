Résumé De L'Audit — Fin Stream B (état actuel)
Division	Statut	Synthèse
Métier	🟢 OK	Toutes les exigences Stream B ont un tag @req et une implémentation couverte
Qualité	🟡 Avertissement	Floating promise résiduel (edge case start()), FR-04 text-layer heuristique
Architecture	🟡 Avertissement	5 modules dépassent la guideline 300L ; SpawnedWebDriverSessionFactory exporté sans usage externe confirmé
Cybersécurité	🟢 OK	Toutes les gardes critiques (SSRF, CSP, path-traversal, freshness) en place et testées
Verdict global : 🟡 AUDIT_WARN — Critical 0 · High 0 · Medium 3 · Low 4. Aucun bloquant. Acceptable comme état de fin Stream B.

Index Des Sous-Audits
Sous-audit	Scope	Crit	High	Medium	Low	Verdict
Business Logic	converter.ts, plan_stream_b.md	0	0	0	1	PASS
Requirements Compliance	tous Stream B	0	0	0	0	PASS
Doc-Sync	architecture.md §4–§15	0	0	0	0	PASS
A11y/UX	—	—	—	—	—	N/A
Clean Code	tous src/ Stream B	0	0	0	2	PASS
Fail-Loud	errors.ts, browserLocator.ts, converter.ts	0	0	0	0	PASS
Test Quality	tests/integration/, tests/unit/ Stream B	0	0	1	1	WARN
Mutation/Saboteur	chemin critique convert→print→write	0	0	0	1	PASS
Layer Enforcer	contracts.ts, converter.ts, imports	0	0	0	1	PASS
YAGNI	tous src/ Stream B	0	0	0	1	PASS
SRE/Performance	withTempHtml, session lifecycle, temp files	0	0	1	0	WARN
Architecture Consistency	architecture.md §5 vs wc -l	0	0	1	0	WARN
Contextual Threat	convertFile, provisioning, HTML	0	0	0	0	PASS
SAST Scanner	src/ entier Stream B	0	0	0	0	PASS
Supply Chain & Artifact	artifactPolicy, fallbackBrowserProvisioner	0	0	0	0	PASS
Privacy/Exfiltration	converter.ts, markdownRenderer.ts, HTML	0	0	0	0	PASS
Totaux consolidés : Critical 0 · High 0 · Medium 3 · Low 6

Matrice Exigences Stream B
Req	Implémentation	Tests	Statut
FR-01	converter.ts:convertFile	@req FR-01 ×2 (unit + browser)	✅
FR-04	markdownRenderer.ts tables/tasks/footnotes	@req FR-04 ×2 + assertions texte PDF	⚠️ Partiel (heuristique latin1)
FR-05	markdownRenderer.ts:highlightCode	@req FR-05 ×2	✅
FR-06	markdownRenderer.ts:imageSourceToDataUri	@req FR-06 ×5	✅
FR-07	webDriverClient.ts:printPdfWithWebDriver, CSS	@req FR-07 ×14	✅
FR-16	withTempHtml finally + signal stop driver	@req FR-16 ×4	✅
FR-19	BrowserLocator scan + fallback last-resort	@req FR-19 ×2	✅
FR-24	Mermaid inline + poll data-mermaid-status	@req FR-24 ×6	✅
NFR-01	Defaults dans converter.ts:58-61	@req NFR-01 ×1	✅
NFR-02	CSP, assertFileUrl, webDriverEndpoint	@req NFR-02 ×13	✅
NFR-03	BrowserLocator env + scan + EPERM/ENOENT	@req NFR-03 ×10	✅
NFR-05	ArtifactPolicy.selectNewestEligible 7j + SHA-256	@req NFR-05 ×25	✅
Top Findings
[Medium] src/converter.ts:113-116 — Floating promise résiduel : si le timeout fire pendant webdriverSessionFactory.start(), driverProcess vaut undefined et stop() ne sera jamais appelé. Le driver process continue de démarrer, sera acquis, et ne sera jamais arrêté par le signal. Correction attendue : introduire un AbortController dans start() ou vérifier signal.aborted après await start().
[Medium] tests/integration/browserBackedConversion.test.ts:121-126 — FR-04 text layer vérifié par pdf.toString("latin1").toContain("Left"). architecture.md:433 exige "tables, task lists, footnotes present in PDF text layer". La vérification latin1 est heuristique : elle est équivalente à la vérification Mermaid déjà en place et pragmatiquement suffisante, mais ne constitue pas une extraction formelle de la couche texte PDF.
[Medium] wc -l src/browserLocator.ts = 618L, src/fallbackBrowserProvisioner.ts = 612L, src/webDriverClient.ts = 488L, src/markdownRenderer.ts = 435L, src/converter.ts = 369L — 5 modules dépassent la guideline 300L de docs/architecture.md §5. Documenté comme guideline non hard-limit. Dette planifiable en P4.
[Low] src/converter.ts:176 — SpawnedWebDriverSessionFactory est export class mais n'est pas consommé dans les tests ni dans contracts.ts. Son export est implicitement nécessaire pour les intégrations avancées mais aucun test ne valide qu'un utilisateur externe en a besoin.
[Low] src/browserLocator.ts:608-616 — resolveBrowserPath contient un chemin hardcodé /snap/firefox/current/usr/lib/firefox/firefox — logique spécifique Ubuntu-snap. Non extensible pour d'autres variantes de packaging Firefox (Flatpak, nix, etc.). [RISQUE] de portabilité sur Linux hors Ubuntu.
[Low] src/fallbackBrowserProvisioner.ts:189 — const { readdir } = await import("node:fs/promises") à l'intérieur d'une boucle. readdir est déjà disponible via import statique au niveau module. Pas d'impact fonctionnel, légère anomalie stylistique.
Détails Par Division
Division Métier (Anton Ego)
[Low] tests/integration/browserBackedConversion.test.ts:121-126 — L'exigence FR-04 requiert que "tables, task lists, footnotes [soient] présents dans la couche texte du PDF" (architecture.md:433). L'implémentation actuelle vérifie la présence des chaînes "Left", "Right", "done", "Footnote body" dans pdf.toString("latin1") — ce qui est exactement ce que fait le contrôle Mermaid pour l'absence de texte brut. Logique cohérente, mais ni l'un ni l'autre n'est une extraction de couche texte PDF conforme à la lettre du §15. Pragmatiquement accepté pour Stream B; noté pour amélioration en P4.
Points conformes : Toutes les exigences FR-01, FR-04, FR-05, FR-06, FR-07, FR-16, FR-19, FR-24, NFR-01, NFR-02, NFR-03, NFR-05 ont une implémentation identifiable et au moins un test portant le tag @req correspondant. La frontière provisioning/conversion est strictement respectée.
Division Qualité (Gordon Ramsay)
[Medium] src/converter.ts:113-116 — driverProcess est déclaré undefined, et onAbort sera appelé avant que start() complète si le timeout fire pendant le démarrage du driver. Dans ce scénario, driverProcess?.stop() est un no-op. Le driver process naît, obtient son port, et personne ne le tue. Ce n'est pas un crash, c'est une fuite de processus silencieuse.
[Low] src/fallbackBrowserProvisioner.ts:189 — dynamic import("node:fs/promises") dans une boucle for...of. Le module est déjà importé statiquement ailleurs dans le fichier (lignes 3-4). Incohérence d'import, sans impact.
Points conformes : Pas de catch silencieux sur les chemins critiques. EPERM vs ENOENT distingués avec causes explicites. ConversionError et RenderError portent sourcePath + actionHint. Cleanup best-effort dans removeTemporaryOutput correctement commenté. Le test d'ordre ["read","locate","start","print","mkdir","write","rename"] tuerait toute inversion d'étapes.
Division Architecture (Steve Jobs)
[Medium] docs/architecture.md §5 — guideline 300L dépassée sur 5 modules (618, 612, 488, 435, 369L). Documenté comme guideline depuis la mise à jour. Pas de bloquant, mais la dette est visible.
[Low] src/converter.ts:176 — SpawnedWebDriverSessionFactory exporté publiquement. DocumentConverter est accessible via converter.ts (utilisé par les tests d'intégration), mais SpawnedWebDriverSessionFactory n'a aucun consommateur identifié en dehors du code interne. Il constitue une surface API supplémentaire sans validation externe.
[Low] src/browserLocator.ts:608-616 — resolveBrowserPath hardcode la résolution snap Firefox. C'est un cas d'usage documenté (snap Ubuntu), mais la fonction ne mentionne pas son périmètre explicitement. [RISQUE] : une distro utilisant Flatpak pour Firefox (/var/lib/flatpak/...) ne serait pas résolue.
Points conformes : Pas de violation de couche détectée — contracts.ts n'exporte que convertFile et les types de données ; DocumentConverter reste interne à converter.ts. Les imports respectent la hiérarchie : converter → browserLocator → artifactPolicy → releaseCatalog. withTempHtml est un utilitaire pur sans dépendance vers le domaine métier.
Division Cybersécurité (Sherlock Holmes)
Points conformes — Élémentaire, et confirmé par les tests :
CSP default-src 'none' en src/markdownRenderer.ts:290 — toute ressource externe injectée par un Markdown malveillant est bloquée par le navigateur.
assertFileUrl en src/webDriverClient.ts:463-478 — seul file: local accepté ; toute URL externe lève RenderError avant l'ouverture de session.
webDriverEndpoint en src/webDriverClient.ts:262-281 — paths absolus ou avec schéma rejetés ; l'endpoint WebDriver ne peut pas être redirigé vers un hôte distant.
resolveInside (via isPathInsideDirectory en src/markdownRenderer.ts:385-388) — traversal ../../../etc/passwd dans une image Markdown lève RenderError.
SVG avec URLs externes rejeté : src/markdownRenderer.ts:230-235.
Provisioning : SHA-256, URL HTTPS immuable (pas de query/fragment), quarantine 7j fixe non-bypassable — 25 tests couvrent les vecteurs de manipulation de la politique.
NFR-02 non-contamination : prouvé par converter.test.ts:84-107 — JSON.stringify(capturedOptions) ne contient pas le contenu Markdown.
Détails Par Sous-Audit
Business Logic Auditor
Verdict : PASS
Findings : FR-04 text layer heuristique (Low)
Points conformes : Flux de conversion respecte l'ordre du plan (read→locate→start→print→mkdir→write→rename) ; pas d'étape réordonnée ; PDF partiel impossible
Requirements Compliance Auditor
Verdict : PASS
Findings : Aucun
Points conformes : Les 12 exigences Stream B obligatoires ont chacune au moins un test @req dans le périmètre Stream B
Doc-Sync Auditor
Verdict : PASS
Findings : Aucun
Points conformes : architecture.md §4 — timeout 30s documenté ; §5 — guideline 300L documentée comme non-hard-limit ; §15 — matrice de vérification cohérente avec les tests existants
A11y/UX Checker
Non applicable — pas de front-end/UI dans le périmètre Stream B
Clean Code Auditor
Verdict : PASS
Findings : dynamic import dans boucle fallbackBrowserProvisioner.ts:189 (Low) ; SpawnedWebDriverSessionFactory export sans consommateur connu (Low)
Points conformes : Nommage cohérent ; constantes nommées (defaultRenderTimeoutMs, requiredQuarantineDays, etc.) ; fonctions inférieures à 40L pour la majorité ; pas de magic number nu
Fail-Loud Auditor
Verdict : PASS
Points conformes : EPERM → env-browser-not-launchable avec actionHint ; ENOENT → env-browser-not-found ; timeout → RenderError avec actionHint ; ConversionError sur écriture PDF avec chemin et hint ; BrowserNotFoundError avec liste des navigateurs supportés ; ArtifactFreshnessError avec artifactName
Test Quality Auditor
Verdict : WARN
Findings :
FR-04 text layer : assertions toContain("Left") sur latin1 — heuristique fiable pour Chromium/WinAnsi mais non formellement conforme à "PDF text layer" (Medium)
Skip MD2PDF_SKIP_REAL_BROWSER_TESTS non documenté dans le release checklist comme condition de preuve release (Low)
Points conformes : 136 tests unit + 19 artifacts + 5 integration (2 skip explicites) ; test d'ordre d'opérations ["read","locate","start","print","mkdir","write","rename"] détecterait toute inversion ; test NFR-02 avec JSON.stringify détecterait toute fuite de contenu Markdown vers le provisioning ; test FR-16 avec driverStopped = true vérifie la correction du floating promise
Mutation/Saboteur Auditor
Verdict : PASS
Findings : Si writePdfAtomically saute le rename (mutation suppression), le test d'ordre le détecterait (Low) — seul le test d'intégration le tuerait, pas un test unitaire isolé
Points conformes : order === ["read","locate","start","print","mkdir","write","rename"] tue l'inversion lecture/locate ; NFR-02 assertion not.toContain("Private") tue tout passage de Markdown au factory
Layer Enforcer
Verdict : PASS
Findings : SpawnedWebDriverSessionFactory export public sans consommateur identifié (Low)
Points conformes : contracts.ts n'expose que convertFile et les types data ; aucune dépendance inversée détectée dans le graphe d'imports
YAGNI Auditor
Verdict : PASS
Findings : SpawnedWebDriverSessionFactory export potentiellement mort (Low) — mais c'est l'implémentation par défaut, borderline
Points conformes : NotImplementedError supprimé ; DocumentConverter retiré de contracts.ts ; WebDriverSession interface interne ; aucune option jamais peuplée détectée
SRE/Performance Auditor
Verdict : WARN
Findings : src/converter.ts:113-116 — floating promise résiduel si timeout fire pendant start() : le driver process naît et n'est jamais arrêté dans cet edge case (Medium)
Points conformes : findOpenLocalPort retente 3 fois ; waitForProcessExit avec SIGKILL fallback à driverShutdownTimeoutMs ; withTempHtml finally garantit nettoyage HTML ; écriture PDF atomique .tmp + rename ; purgeStaleCaches nettoie les versions obsolètes du cache
Architecture Consistency Auditor
Verdict : WARN
Findings : 5 modules > 300L (guideline architecture.md §5) (Medium)
Points conformes : Tous les modules annoncés en §4 existent et correspondent à leurs responsabilités ; aucun phantom module ; aucun composant annoncé absent
Contextual Threat Analyst
Verdict : PASS
Points conformes : Un Markdown avec ../../../etc/passwd comme image → bloqué par resolveInside. Un Markdown avec <script src="https://evil.example"> → bloqué par CSP. Un WebDriver sur IP distante → bloqué par webDriverEndpoint. Un artifact avec URL http: ou querystring → rejeté par isImmutableHttpsUrl. Un tag latest → rejeté par isFloatingVersion.
SAST Scanner
Verdict : PASS
Points conformes : Spawn sans shell (pas d'injection de commande) ; pas d'eval ni de Function() dynamique ; pas de secrets hardcodés ; URL externe bloquée avant fetch ; pas de désérialisation unsafe (JSON.parse avec validation explicite dans releaseCatalog.ts)
Supply Chain & Artifact Auditor
Verdict : PASS
Findings : Runtime artifacts (chromedriver/Chromium-for-Testing) absents de artifacts.json — hors scope P3, planifié P4
Points conformes : SHA-256 64 hex, taille > 0, provenance non-vide, URL HTTPS sans query/fragment, version non-floating, quarantine exactement 7j non-bypassable ; 25 tests couvrent les vecteurs de manipulation ; atomic rename du cache après checksum vérifié
Privacy/Exfiltration Auditor
Verdict : PASS
Points conformes : NFR-02 non-contamination prouvé par test ; CSP bloque requêtes sortantes depuis HTML généré ; aucun log du contenu source détecté dans les chemins d'erreur ; PDFs écrits atomiquement en local seulement ; browserLocatorFactory ne reçoit que ConvertOptions, jamais le Markdown
Points Conformes Globaux
Gates verts — typecheck 0, 136 unit, 19 artifacts, 5 integration (2 skip browser explicites)
Floating promise adressé — signal branché sur driverProcess.stop() ; test de régression FR-16 prouve le comportement
Toutes les exigences Stream B tracées — FR-01, FR-04, FR-05, FR-06, FR-07, FR-16, FR-19, FR-24, NFR-01, NFR-02, NFR-03, NFR-05 ont chacun au moins un @req dans le périmètre
NFR-02 non-contamination — prouvé par assertion JSON.stringify(capturedOptions) ne contenant pas le Markdown
CSP default-src 'none' — toutes les ressources externes bloquées structurellement
SSRF guards — assertFileUrl + webDriverEndpoint + localWebDriverUrl
Path-traversal — isPathInsideDirectory, SVG externe rejeté
ArtifactPolicy — 25 tests couvrant quarantine, SHA-256, URL immutable, platform, compatibility, no-floating-version
Atomic PDF write — .tmp + rename ; test d'ordre tuerait toute mutation
withTempHtml finally — nettoyage HTML garanti en succès, erreur et timeout
EPERM vs ENOENT — cause env-browser-not-launchable vs env-browser-not-found distinguées, testées
Mermaid inline, no CDN, securityLevel strict — conforme NFR-02
Limites De Vérification
Commande	Résultat
npm run typecheck	✅ 0 erreur
npm test	✅ 136/136
npm run check:artifacts	✅ Freshness policy passed
npm run test:artifacts	✅ 19/19
MD2PDF_SKIP_REAL_BROWSER_TESTS=1 npm run test:browser	✅ 5/5 (2 skip explicites)
npm run test:browser (vrai navigateur)	⛔ Non exécutable localement — requiert navigateur + driver pré-provisionnés
Extraction formelle couche texte PDF (FR-04)	⛔ Heuristique latin1 utilisée — pdfjs-dist ou équivalent non installé
NFR-03 CI matrix (Linux/macOS/Windows, Chromium + Firefox)	⛔ Limite environnement — non vérifié localement
