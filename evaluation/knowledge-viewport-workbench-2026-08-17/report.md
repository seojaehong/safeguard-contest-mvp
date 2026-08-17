# Knowledge viewport workbench

Verdict: `PASS_LIVE_PRODUCTION_KNOWLEDGE_VIEWPORT_WORKBENCH`

The live `/knowledge` route at production commit `b6a11993` exposes one selected task panel at a time on desktop, tablet, and mobile. All six knowledge tasks remain reachable from the task rail, while long technical, reference, Wiki, governance, and diagnostic content stays inside local-scroll panels.

## Measured contract

- Ten Day/Night rows passed at `1440x723`, `1440x900`, `1024x1000`, `390x723`, and `390x844`.
- Desktop body ratio is `1.00`, mobile is `1.01`, and the tablet maximum is `1.02`.
- Every row exposes exactly one visible panel and all six task controls.
- Every row has zero horizontal overflow and zero outside-viewport elements.
- Minimum control height is `44px`; at least four long panels per row are locally scroll-contained.
- Ten screenshots and the raw browser rows are retained beside this report.

The historical mobile body height was `1152px`, and the old desktop source exposed all six panels in source order. Route splitting alone is not accepted as the fix; selected-only exposure plus local containment is the contract.

## Verification

- Focused Knowledge browser and static contracts: `23/23` passed.
- Dedicated live production geometry contract: `1/1` passed.
- Canonical frontend identity and route coverage contracts: `48/48` passed.
- Strict typecheck and production build passed; 28 static pages generated.
- GitHub Actions run `32001280102` passed typecheck, the full test suite, and the production build.

## Boundaries

No DB, provider, Share session, vector/embedding, Wiki publication, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; LLM Wiki publication and SIF embedding runtime remain approval-gated. This report proves the Knowledge viewport workbench only.
