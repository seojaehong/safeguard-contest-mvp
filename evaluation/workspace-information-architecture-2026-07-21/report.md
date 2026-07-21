# Workspace Information Architecture Recommendation

Verdict: `ROUTE_SPLIT_ALONE_IS_NOT_ENOUGH`

Live commit checked: `be64c3b15a8cb55bb132fa065ec485ffb700f652`

Current source/evidence HEAD at report generation: `b005b968fb519180fb1f93dbdb434aee07f24f69`

This report answers whether SafeClaw should split the workspace into more pages, and whether that would actually solve the long Document and Share screens.

## Current live geometry

`https://www.safeclaw.kr` now serves runtime commit `be64c3b15a8cb55bb132fa065ec485ffb700f652`. The current report/evidence refresh commit is `b005b968fb519180fb1f93dbdb434aee07f24f69`; it does not imply a UI runtime delta.

| Viewport | Stage | Page height | Viewport | Ratio | Horizontal overflow | Outside viewport |
| --- | --- | ---: | ---: | ---: | --- | ---: |
| Desktop short | Documents | 723 | 723 | 1.00x | false | 0 |
| Desktop short | Editor | 882 | 723 | 1.22x | false | 0 |
| Desktop short | Share | 723 | 723 | 1.00x | false | 0 |
| Desktop | Documents | 1053 | 900 | 1.17x | false | 0 |
| Desktop | Editor | 1129 | 900 | 1.25x | false | 0 |
| Desktop | Share | 946 | 900 | 1.05x | false | 0 |
| Mobile | Documents | 844 | 844 | 1.00x | false | 0 |
| Mobile | Editor | 1067 | 844 | 1.26x | false | 0 |
| Mobile | Share | 844 | 844 | 1.00x | false | 0 |

## Diagnosis

The default Documents cockpit and mobile Share cockpit are no longer the raw page-height blockers: both are exactly one viewport tall in the current short/mobile checks.

The remaining problem is information architecture, not just CSS. The selected Editor/detail is still long because it combines several different jobs after the user opens a document:

- choose or confirm the core safety document,
- review the safety brief and top hazards,
- inspect generation/evidence provenance,
- inspect row-level field content,
- open the raw long-form textarea,
- inspect supporting document detail,
- edit/export a selected document.

Splitting routes without changing those job boundaries would only move the same long stack from one URL to another. It would improve URL clarity, but not the perceived length.

Current selected editor evidence makes the distinction concrete:

- Desktop short editor: first risk row header `522-579`, first hazard field `615-675`, but raw textarea `1094-1267`.
- Mobile editor: first risk row header `526-583`, first hazard field `607-657`, but raw textarea `987-1160`.
- Share desktop is already raw two-column geometry with form/preview widths `636/520` at 1440x723; any remaining "mobile-like" complaint should be treated as perceived workbench composition, not literal one-column stacking.

## Recommended structure

Use four task-level screens, not just three marketing-level steps:

1. `Input`: one short brief, presets, AI strength, evidence/photo attachment state.
2. `Review`: one viewport cockpit with the risk assessment summary, top three hazards, TBM link, and evidence readiness.
3. `Documents`: a document index/detail model. Default shows the core three documents only; support documents stay collapsed. Selecting a document opens a focused detail/editor route or panel where field summaries and row-level controls land before raw textarea.
4. `Share`: one viewport dispatch cockpit. Advanced target/channel/language configuration remains collapsed unless the user opens it.

This preserves the user's mental model of input -> documents -> share, but internally separates "review a generated pack" from "edit a specific document." That is the split that actually reduces height.

## Implementation recommendation

Do not launch a broad route rewrite. Use bounded TDD waves:

1. Keep the live Share mobile fix as done and evidence-backed.
2. Keep the current Documents default cockpit as closed for raw page height.
3. For selected editor/detail, keep requiring the first meaningful editable content or field summary to intersect the visible viewport or bounded pane immediately. Current live evidence satisfies that with the first risk row header and hazard field; raw textarea remains explicit secondary drilldown.
4. Add route or URL state only after the cockpit/detail split is green. Candidate URLs:
   - `/workspace?step=review`
   - `/workspace?step=documents`
   - `/workspace?step=documents&doc=riskAssessmentDraft`
   - `/workspace?step=share`

## Product answer

Yes, the workspace should be split more, but not because every page must be short. It should be split because each screen needs one primary job.

Long documents are acceptable after the user intentionally opens a document detail/editor. They are not acceptable as the default Documents step immediately after generation.

So the target is:

- default Documents cockpit: short, decision-oriented, one-screen-ish and currently live-closed for raw height;
- selected document editor: allowed to scroll because editing a safety document is inherently long, but the first field summary or row-level work surface must land immediately;
- Share cockpit: one-screen-ish, already passing on mobile live;
- advanced configuration and evidence panels: collapsed by default.
