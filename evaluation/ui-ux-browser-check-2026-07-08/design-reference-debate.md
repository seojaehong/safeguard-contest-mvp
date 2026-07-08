# SafeClaw Design Reference Debate

Date: 2026-07-08

## Reference Set

Used as product direction, not as visual cloning:

- Linear: quiet operational density and status clarity.
- SafetyCulture: inspection, checklist, mobile confirmation, report sharing.
- Notion: editable document surface.
- Rows: data, evidence, and output coexisting in one work surface.
- IBM Carbon: accessibility, clear enterprise information blocks.
- Airtable: record-oriented operational data.
- Vercel, Intercom, Cal.com, ClickHouse: narrowly borrowed feedback, guidance, scheduling/confirmation, and log-density patterns.
- Cohere-style white enterprise AI surface from `DESIGN-cohere.md`: stark white canvas, near-black pill CTA, restrained borders, and large editorial question.

## Consensus

- SafeClaw should feel like a workbench, not a wizard.
- The workspace should not be a long-scroll dashboard. It should render as page-state screens: input first, document after generation, share after review.
- The primary product proof is not the number of generated documents.
- The proof is the loop: field input -> official evidence -> risk/TBM documents -> team read confirmation -> improvement memory.
- DB facts should appear as small repeated evidence signals, not row-count dashboards.
- Worker UI should stay simple: core risks, language switch, acknowledgement.
- The first workspace screen can be more radical than the downstream document/share screens: one question, one input, one action.

## Implementation Translation

- Input stage gets a `근거 준비 레일`.
- First load renders only the input page; document/share panels are not pre-rendered below the fold.
- Generation feedback belongs inside the document page loading state, not on the input page.
- Document stage gets a right-side evidence/quality panel.
- Share stage gets scope, permission, confirmation, and persistence panels.
- Today's improvements support Before/After photos and become operational ontology candidates.
- OpenClaw stays on operator/developer surfaces, not the worker screen.
- Cohere influence was translated as a SafeClaw-specific variation, not a clone: white first screen, minimal topbar, thin evidence rail, and no decorative gradients.
