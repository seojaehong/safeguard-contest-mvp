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

## Release boundary

This artifact validates the hotfix branch built from current production. It does not claim that `www.safeclaw.kr` changed before this branch is merged and Vercel production deployment is verified.
