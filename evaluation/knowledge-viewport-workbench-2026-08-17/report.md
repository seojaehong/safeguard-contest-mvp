# Knowledge viewport workbench

Verdict: `PASS_LIVE_PRODUCTION_KNOWLEDGE_VIEWPORT_WORKBENCH`

The live `/knowledge` route at production commit `5678b95f` exposes one selected task panel at a time on desktop, tablet, and mobile. KOSHA technical-support and PDF reference lists expose compact titles first. Wiki directories and governance support material now use the same selected-detail disclosure model while keeping the review state in the first mobile viewport.

## Measured contract

- Ten Day/Night rows passed at `1440x723`, `1440x900`, `1024x1000`, `390x723`, and `390x844`.
- Desktop body ratio is `1.00`, mobile is `1.01`, and the tablet maximum is `1.02`.
- Every row exposes exactly one visible panel and all six task controls with zero horizontal overflow or outside-viewport elements.
- Technical support exposes 6 disclosures and the PDF library exposes 7. All are closed by default and each list is an exclusive disclosure group.
- Wiki and governance each expose 2 exclusive disclosures, with all four closed by default. The governance review state remains visible before supporting detail.
- At `390x723`, technical-panel content fell from `2537px` to `818px`; reference-panel content fell from `1896px` to `674px`.
- At `390x723`, wiki content fell from `1361px` to `372px` (`7.44x` to `2.03x`) and governance content fell from `2431px` to `403px` (`13.28x` to `2.20x`).
- Maximum mobile local-scroll ratios are `4.47`, `3.68`, `2.03`, and `2.20` for technical support, references, wiki, and governance respectively.
- The first KOSHA disclosure ends at or above `590.97px`, inside the smallest measured panel bottom of `611.39px`.
- Minimum control height remains `44px`; 18 screenshots and raw browser rows are retained beside this report.

The historical mobile body height was `1152px`, and the old desktop source exposed all six panels in source order. Route splitting alone is not accepted as the fix; selected-only task exposure, selected-only KOSHA item detail, and local containment are the contract.

## Verification

- Focused Knowledge browser and static contracts: `23/23` passed.
- Dedicated live production geometry contract: `1/1` passed.
- Strict typecheck and production build passed; 28 static pages generated.
- No GitHub Actions run was created for this commit; local production build and direct live browser evidence are recorded instead.

## Boundaries

No DB, provider, Share session, vector/embedding, Wiki publication, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; LLM Wiki publication and SIF embedding runtime remain approval-gated. This report proves the Knowledge viewport and progressive-disclosure workbench only; it does not claim publication or embedding activation.
