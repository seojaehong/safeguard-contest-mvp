# SafeClaw launch UI P0 hotfix

- Production base: `238a011b3d0d436b5d498c415795cede61b3045e`
- Branch: `fix/launch-ui-p0-20260716`
- Scope: `/why`, `/ontology`, blank workspace submission, contrast, and mobile touch targets
- Database/schema mutation: none

## Selected reviewed lineage

- `/why` responsive comparison: `30dd9d6`
- focused ontology explorer: `98573e0`, `3c8ed41`, `f308704`
- blank workspace feedback: `13ff3d0`
- contrast contracts: `904fad5`, `897720a`
- workspace composer touch targets: `0985659`

The hotfix selects only the bounded product and test changes above instead of merging the 92-commit north-star integration PR into production. Existing production code outside these surfaces remains unchanged.

## Behavior closed

- `/why` renders five stacked comparison cards at 390px and preserves the five-column desktop table.
- `/ontology` renders a selected 1-hop/2-hop neighborhood instead of the full graph hairball, uses a mobile relationship list, and removes the customer-facing internal ontology term.
- Blank workspace generation announces `현장 상황을 입력해 주세요.`, marks the textarea invalid, focuses it, and performs no `/api/ask` request.
- Yellow/light-surface labels and primary document actions use readable text tokens.
- Mobile workspace document choices use a vertical list instead of a native horizontal rail.
- Composer controls preserve the 44px interaction target contract.

## Verification

Initial aggregate run exposed two missing CSS prerequisites after selective integration: the core-card accent text token and the mobile document rail rule. These were repaired with selector-scoped rules copied from the already-green north-star integration surface.

- Initial focused run: 78 passed, 2 failed, 2 skipped.
- Corrected static contracts: 20 passed.
- Final focused browser/contracts: 55 passed, 2 environment-gated skipped, 0 failed.
- Strict TypeScript: passed (`tsc --noEmit --incremental false`).
- Production build: passed; 28/28 static pages generated.
- `node_modules` and build output are not tracked.

The two skipped tests are explicit environment gates in the ontology browser suite; the deterministic ontology unit/DOM contracts and the remaining browser scenarios passed.

## Live verification

The bounded hotfix was merged as `1b17eecf05faeed20c711f771c01e73917c2566d` and Vercel production deployment completed.

- Blank workspace: visible alert, focus returned to `field-command-input`, `/api/ask` requests 0, horizontal overflow 0.
- `/why` at 390px Day/Night: five stacked rows, width 332px, outside elements 0, horizontal overflow 0.
- `/ontology` desktop Day/Night: 13 neighborhood nodes, overlap pairs 0, outside elements 0, horizontal overflow 0.
- `/ontology` mobile Day/Night: desktop graph nodes hidden, relationship list present, outside elements 0, horizontal overflow 0.
- Customer-facing ontology internal-term matches: 0.

The first live contrast sweep found the `/why` desktop header at 1.56:1 in Day mode. A follow-up TDD contract reproduced the failure and changed only the header text token to `--sc-black`; Day and Night browser tests then passed with a minimum 4.5:1 contract.

## Final CI remediation

The production merge CI exposed four follow-up failures. Three assertions still described the retired ontology surface, and the KOSHA route test depended on live official-site latency. The tests now follow the focused explorer's actual presentation boundary and mock KOSHA retrieval at the route boundary while preserving production fail-closed behavior.

The 1024px audit also exposed a real 124px horizontal overflow in `/ontology`. The root grid's implicit min-content track expanded to 912px inside a 788px module main. A browser RED test added tablet Day/Night coverage, and the root now uses a bounded `minmax(0, 1fr)` track.

- CI remediation focused suite: 78/78 passed.
- Ontology browser contract: 1440/1024/390 Day/Night passed; tablet horizontal overflow 0.
- Static frontend audit: 32 pages, 23 product components, coverage issues 0, violations 0.
- Browser audit: 108/108 rows passed, failed rows 0, findings 0, recovered rows 0.
- Strict TypeScript: passed.
- Clean normal production build: 28/28 static pages generated.
- Normal browser bundle audit markers: 0.

The audit-only alias now captures `SAFECLAW_FRONTEND_AUDIT` when Next loads its configuration. This keeps the audit probe stable across server and client compiler passes. A clean normal build still selects the no-op module, so the probe does not ship or hydrate in production.
