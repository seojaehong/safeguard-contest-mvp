# Knowledge viewport workbench

Verdict: `PASS_LIVE_PRODUCTION_KNOWLEDGE_VIEWPORT_WORKBENCH`

The live `/knowledge` route at production commit `b1149628` exposes one selected task panel at a time on desktop, tablet, and mobile. KOSHA technical-support and PDF reference lists now expose compact titles first and reveal only the selected item's summary, document role, and source actions.

## Measured contract

- Ten Day/Night rows passed at `1440x723`, `1440x900`, `1024x1000`, `390x723`, and `390x844`.
- Desktop body ratio is `1.00`, mobile is `1.01`, and the tablet maximum is `1.02`.
- Every row exposes exactly one visible panel and all six task controls with zero horizontal overflow or outside-viewport elements.
- Technical support exposes 6 disclosures and the PDF library exposes 7. All are closed by default and each list is an exclusive disclosure group.
- At `390x723`, technical-panel content fell from `2537px` to `818px`; reference-panel content fell from `1896px` to `674px`.
- Maximum mobile local-scroll ratios are `4.47` for technical support and `3.68` for references.
- The first KOSHA disclosure ends at or above `590.97px`, inside the smallest measured panel bottom of `611.39px`.
- Minimum control height remains `44px`; ten screenshots and raw browser rows are retained beside this report.

The historical mobile body height was `1152px`, and the old desktop source exposed all six panels in source order. Route splitting alone is not accepted as the fix; selected-only task exposure, selected-only KOSHA item detail, and local containment are the contract.

## Verification

- Focused Knowledge browser and static contracts: `23/23` passed.
- Dedicated live production geometry contract: `1/1` passed.
- Strict typecheck and production build passed; 28 static pages generated.
- No GitHub Actions run was created for this commit; local production build and direct live browser evidence are recorded instead.

## Boundaries

No DB, provider, Share session, vector/embedding, Wiki publication, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; LLM Wiki publication and SIF embedding runtime remain approval-gated. This report proves the Knowledge viewport and KOSHA reference disclosure workbench only.
