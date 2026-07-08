# SafeClaw Commercial Design Grill

Date: 2026-07-08

## Prompt

The user shared a reference with a left app sidebar, a cited-materials rail, and a long answer surface. The question was whether SafeClaw should move toward that structure.

## Research Signals

- getdesign.md frames `DESIGN.md` as a reusable design reference for consistent color, type, spacing, components, and visual language across pages.
- Linear's redesign notes emphasize reducing visual noise while improving sidebar, headers, panels, hierarchy, and navigation density.
- NotebookLM is relevant because it organizes source-grounded workspaces around sources, chat, and generated artifacts, with citations tied to uploaded documents.
- Citation-forward products are valuable only when the cited source can be inspected directly and kept aligned with the generated answer.

## Verdict

Do not put the full sidebar + cited rail pattern on the first input screen.

SafeClaw is not primarily a research chat product. It is an operations workbench where the first job is fast workpack creation. The first page should remain focused: one task input, one primary action, minimal readiness signals.

Use the reference pattern after generation:

- `input`: focused single-task surface.
- `document`: main document viewer plus cited evidence rail.
- `share`: confirmation/ack status plus saved history.
- `archive/projects`: persistent navigation for prior workpacks and recurring sites.

## Recommended Commercial Layout

Desktop document view:

- Left rail: project/site/workpack navigation, recent workpacks, saved improvements.
- Center: selected document, starting with risk assessment and TBM.
- Right rail: cited evidence, SIF/KOSHA references, weather/legal/education sources, ontology QA gaps, reflected improvement history.

Mobile document view:

- Single-column document body.
- `근거 보기` opens evidence as a bottom sheet.
- `작업팩` opens project/history as a drawer.
- No forced three-column layout.

## Risks

- A permanent sidebar on the input page can make the product feel heavy before the user has done anything.
- Showing evidence rail before generation can make SafeClaw feel like a generic legal research tool rather than a field safety operation tool.
- If the cited rail is only a list of links, it will not become a product differentiator. Each citation must show where it was reflected in the risk assessment/TBM.
- Mobile rail persistence will create horizontal overflow and touch congestion.

## Product Rule

SafeClaw should use citations as operational proof, not decoration:

> evidence item -> reflected document block -> worker acknowledgement -> improvement memory

That loop is the commercial differentiator.

## Sources

- https://getdesign.md/
- https://linear.app/now/how-we-redesigned-the-linear-ui
- https://academictech.uchicago.edu/2026/04/06/google-notebooklm-an-ai-tool-for-research-and-studying/
- https://www.codecademy.com/article/how-to-use-notebooklm
