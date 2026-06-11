# Stream A Strict Final Audit - 2026-06-11

Verdict: **GO Stream A strict.**

Global release verdict: **NO-GO release globale tant que Stream B
navigateur/rendu n'est pas ferme.**

## Perimetre Stream A strict audite

Stream A strict couvre uniquement:

- parsing CLI et options exposees par `--help`;
- resolution des chemins et preflight;
- orchestration batch;
- overwrite, skip, summaries et codes de sortie;
- packaging npm;
- installation/invocabilite de la commande;
- preuves release associees a ce perimetre.

## Hors-scope Stream B / release globale

Les sujets suivants ne sont pas fermes par Stream A strict:

- rendu navigateur reel;
- Mermaid rendu comme diagramme;
- WebDriver, Firefox, geckodriver;
- fallback Chromium-for-Testing;
- provisioning navigateur;
- compatibilite navigateur multi-famille;
- CI/browser matrix globale.

## Requirement and Evidence Compliance

| Requirement / Evidence | Status | Evidence | Problem |
| --- | --- | --- | --- |
| FR-20 invocabilite CLI par nom | Pass for Stream A strict simulation | `docs/release-evidence/fr-20-system-scope.md` | Simulation documentee, pas un vrai install system-wide multi-compte. |
| README aligne sur `--help` | Pass | `README.md`; `node dist\cli.js --help`; `audit.md` point 2 | Aucun blocage. |
| Caveat Windows PowerShell documente | Pass | `README.md` section Windows PowerShell Shim; checklist release installation note | Aucun blocage. |
| Checklist release separe Stream A strict de Stream B | Pass | `docs/release-evidence/release-checklist-v0.1.2.md` | Release globale reste bloquee. |
| Gates Stream A strict | Pass | Commandes listees ci-dessous | Aucun blocage Stream A strict. |
| Final tarball metadata | Pass | `md2pdf-0.1.2.tgz`, shasum `cc11a64ec297c708b2178727bd372f753fabee33`, integrity `sha512-KUOkmzNX9/0yaqlkpGBFWwu/WqoWHizE4Fe1xG43cuf8JQfnGmBFaA+s3uOvQRIr3cQraFXhNlqJdO9Kk6bGdw==` | Tarball genere depuis un working tree local deja dirty; notee dans FR-20 evidence. |

## Gates Rejouees

```text
npm.cmd run typecheck
PASS

npm.cmd test
PASS - 11 test files, 85 tests passed, 2 skipped

npm.cmd run test:contracts
PASS - 1 test file, 10 tests

npm.cmd run check:artifacts
PASS - Artifact freshness policy passed.

npm.cmd run build
PASS

npm.cmd pack --json
PASS - md2pdf-0.1.2.tgz
shasum cc11a64ec297c708b2178727bd372f753fabee33
integrity sha512-KUOkmzNX9/0yaqlkpGBFWwu/WqoWHizE4Fe1xG43cuf8JQfnGmBFaA+s3uOvQRIr3cQraFXhNlqJdO9Kk6bGdw==

node dist\cli.js --help
PASS
```

## Point 5 Correction Audit

The failing unit test at `tests/unit/cli/cli.test.ts:99` was corrected by
forcing `MD2PDF_BROWSER` to a missing executable inside the test temp directory.
This keeps the test on the default runtime converter path while preventing it
from launching a real installed browser during unit execution.

Residual limitation: this proves the old public `NotImplementedError` stub is
gone and the runtime converter boundary is reached; it does not prove browser
rendering or PDF fidelity. That limitation is correct for Stream A strict and is
tracked as Stream B/global release scope.

## FR-20 State

`docs/release-evidence/fr-20-system-scope.md` is complete for Stream A strict
with a valid simulation:

- package installed into a global-style npm prefix;
- prefix placed on `PATH`;
- `where md2pdf` resolves command names;
- `md2pdf --help` exits `0`;
- simulation limits are explicit.

This is not a real elevated system-scope install visible to a secondary Windows
account. Global release can require that stronger manual proof separately.

## README / Help State

The README documents the CLI options exposed by help:

- `ENTRY`;
- `-o, --output`;
- `--output-dir`;
- `-f, --force-overwrite`;
- `-h, --help`.

It does not document a nonexistent `--browser` option. `MD2PDF_BROWSER` is
described as an environment variable, not as CLI surface.

## Release Checklist State

`docs/release-evidence/release-checklist-v0.1.2.md` now records:

- Stream A strict gates passed;
- FR-20 simulation passed;
- README/help comparison passed;
- final tarball metadata;
- global release blocked by Stream B/browser evidence.

## Residual Risks

1. Real installed-browser rendering is not proven by Stream A strict.
2. Mermaid-as-diagram rendering remains Stream B/global release evidence.
3. Fallback browser/provisioning evidence remains Stream B/global release
   evidence.
4. CI/browser matrix remains global release evidence.
5. The current tarball was generated from a dirty local working tree, which is
   acceptable for this local Stream A strict audit but should be regenerated from
   the final reviewed tree before publication.

## Decision

**GO Stream A strict.**

Stream A is complete for CLI, orchestration, packaging, install evidence,
README/help alignment, and command invocability.

**NO-GO release globale** until Stream B closes browser/rendering, Mermaid,
fallback/provisioning, and compatibility evidence.
