# Workspace Safety Brief Dashboard Architecture

Checked at: 2026-07-20 KST

## Verdict

**Adopt as the next bounded UX architecture patch.**

The remaining workspace concern is not mainly routing or color. Splitting `Input -> Documents -> Share` into more pages will not solve the problem if the first generated page or share page still carries too much information. The product needs progressive disclosure and mode separation.

## Product Direction

1. Input page: scenario capture only.
   - Situation textarea
   - Presets and AI mode
   - Attachments and metadata
   - One generate CTA
   - No generated document stack

2. Safety Brief Dashboard: first post-generation result page.
   - Work summary
   - Top 3 hazards
   - Top 3-5 risk-assessment rows
   - Field 5-minute mode, near-first viewport

3. Documents Review page: manager review mode.
   - Core: risk assessment, TBM briefing, TBM record
   - Plans and permits
   - Education and emergency
   - Foreign-worker and share variants
   - One selected document or category open by default
   - No default 12-document vertical stack

4. Evidence panel/page: on demand.
   - Open from dashboard rows or document sections
   - Keep KOSHA/law/accident provenance accessible
   - Do not permanently expand the page unless opened

5. Share page: action mode.
   - Desktop: left recipients/channel/language/options, right message preview/status/warnings
   - Mobile: compact single-column wizard
   - One primary send CTA

## Acceptance Questions

- After generation, can the user understand top risks and risk assessment without scrolling multiple viewports?
- On Documents Review, is the default page height bounded because only one category or document is expanded?
- On Share desktop, does the layout use real desktop width and composition instead of a mobile panel width?
- Are sticky regions limited to one concise header/status/index with no stacked sticky overlap?

## Boundary

This is a structural UX follow-up, not a cosmetic CSS task. It should preserve current workpack generation, provenance, exports, recipient portal, and audit contracts. The current quick launch patch should not broaden into a full document-editor rewrite without a separate implementation gate.
