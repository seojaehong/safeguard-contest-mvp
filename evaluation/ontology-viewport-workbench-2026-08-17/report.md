# Ontology viewport workbench

Verdict: `PASS_LIVE_PRODUCTION_ONTOLOGY_VIEWPORT_WORKBENCH`

The live `/ontology` route at production commit `89b72fe3` keeps all ten measured Day/Night desktop, tablet, and mobile states at a body ratio of `1.0`. Long ontology content remains available inside local-scroll explorer and directory panes instead of extending the page body.

## Measured contract

- Desktop `1440x723` and `1440x900`: two-pane workbench, explorer width `848.5625px`, directory width `339.4375px`.
- Tablet `1024x1000`: one task pane is exposed at a time and remains locally scrollable.
- Mobile `390x723` and `390x844`: all four Day/Night task switches passed; the minimum pane client height is `322px`.
- All ten rows have no horizontal overflow or element overlap and preserve a minimum `44px` control height.
- Fourteen screenshots and the raw browser rows are retained beside this report.

The prior measured body heights were `2077px` on desktop and `2893px` on mobile, with an older mobile baseline of `4602px`. Route splitting alone is not accepted as the fix; viewport containment and progressive disclosure are the contract.

## Verification

- Browser contract: `1/1` passed against `https://www.safeclaw.kr`.
- Ontology UI contract: `9/9` passed.
- Frontend route and ontology regression: `48/48` passed.
- Typecheck and production build passed; 28 static pages generated.
- GitHub Actions run `31994327025` passed typecheck, full tests, and build.

## Boundaries

No DB, provider, Share session, vector/embedding, wiki, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`, and fully automated launch remains disallowed.
