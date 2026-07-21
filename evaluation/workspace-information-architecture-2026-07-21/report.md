# Workspace Information Architecture Recommendation

Verdict: `ROUTE_SPLIT_ALONE_IS_NOT_ENOUGH`

Live commit checked: `963b24e92d121359ca90505478da40131ccc876e`

Current source/evidence HEAD at report commit: `52d12965fa5d67b9a7f7536f71c9f0ce718059c2`

This report answers whether SafeClaw should split the workspace into more pages, and whether that would actually solve the long Document and Share screens.

## Current live geometry

`https://www.safeclaw.kr` now serves commit `963b24e92d121359ca90505478da40131ccc876e`.

| Viewport | Stage | Page height | Viewport | Ratio | Horizontal overflow | Outside viewport |
| --- | --- | ---: | ---: | ---: | --- | ---: |
| Desktop short | Documents | 876 | 723 | 1.21x | false | 0 |
| Desktop short | Editor | 952 | 723 | 1.32x | false | 0 |
| Desktop short | Share | 946 | 723 | 1.31x | false | 0 |
| Desktop | Documents | 1053 | 900 | 1.17x | false | 0 |
| Desktop | Editor | 1129 | 900 | 1.25x | false | 0 |
| Desktop | Share | 946 | 900 | 1.05x | false | 0 |
| Mobile | Documents | 980 | 844 | 1.16x | false | 0 |
| Mobile | Editor | 1131 | 844 | 1.34x | false | 0 |
| Mobile | Share | 844 | 844 | 1.00x | false | 0 |

## Diagnosis

The mobile Share cockpit is no longer the blocker: it is exactly one 390x844 viewport tall on live production.

The remaining problem is information architecture, not just CSS. Documents and Editor are long because they combine several different jobs in one stage:

- choose or confirm the core safety document,
- review the safety brief and top hazards,
- inspect generation/evidence provenance,
- browse 12 deliverables,
- open supporting documents,
- edit/export a selected document.

Splitting routes without changing those job boundaries would only move the same long stack from one URL to another. It would improve URL clarity, but not the perceived length.

## Recommended structure

Use four task-level screens, not just three marketing-level steps:

1. `Input`: one short brief, presets, AI strength, evidence/photo attachment state.
2. `Review`: one viewport cockpit with the risk assessment summary, top three hazards, TBM link, and evidence readiness.
3. `Documents`: a document index/detail model. Default shows the core three documents only; support documents stay collapsed. Selecting a document opens a focused detail/editor route or panel.
4. `Share`: one viewport dispatch cockpit. Advanced target/channel/language configuration remains collapsed unless the user opens it.

This preserves the user's mental model of input -> documents -> share, but internally separates "review a generated pack" from "edit a specific document." That is the split that actually reduces height.

## Implementation recommendation

Do not launch a broad route rewrite. Use bounded TDD waves:

1. Keep the live Share mobile fix as done and evidence-backed.
2. Add a Documents mobile cockpit test requiring the default mobile Documents page to move materially closer to one viewport while exposing:
   - risk assessment,
   - TBM briefing,
   - TBM log,
   - collapsed support-doc count.
3. Move full editing into an explicit `Edit selected document` interaction, preserving `WorkpackEditor` contracts and existing generated data.
4. Add route or URL state only after the cockpit/detail split is green. Candidate URLs:
   - `/workspace?step=review`
   - `/workspace?step=documents`
   - `/workspace?step=documents&doc=riskAssessmentDraft`
   - `/workspace?step=share`

## Product answer

Yes, the workspace should be split more, but not because every page must be short. It should be split because each screen needs one primary job.

Long documents are acceptable after the user intentionally opens a document detail/editor. They are not acceptable as the default Documents step immediately after generation.

So the target is:

- default Documents cockpit: short, decision-oriented, one-screen-ish;
- selected document editor: allowed to scroll because editing a safety document is inherently long;
- Share cockpit: one-screen-ish, already passing on mobile live;
- advanced configuration and evidence panels: collapsed by default.
