# Workspace Bounded Workbench Definition of Done

Generated: 2026-07-22T07:18:28.493Z

Source HEAD: `140991153ab2bdf18a7e4a113d4874b53c9e3ea0`

Verdict: `DOD_RECORDED_NOT_A_PASS_CLAIM`

## Product Answer

페이지를 더 나누는 것은 orientation 개선일 뿐 충분조건이 아니다. 긴 문서와 공유 결과는 별도 route로 옮겨도 serial full-body stack이면 똑같이 길다. 실제 해결은 `three-step shell plus first-viewport cockpit plus selected-only bounded workbench plus progressive drilldown`이다.

## Documents Contract

- Desktop viewport: `1440x723`
- Target body/workbench height: `<= 1.5 screens`
- Hard RED: `> 2 screens`
- Mobile viewport: `390x723`
- First viewport must show current step, selected document name, core-3 launcher/selector, primary action, and review/status state.
- Core 3: `riskAssessmentDraft`, `tbmBriefing`, `tbmLogDraft`.
- Supporting 9 must be collapsed/index/detail/drawer/local-scroll navigation, not serial full-body content above the selected editor.
- Selected editor count must be exactly one. Raw/full textarea remains secondary drilldown.
- Risk assessment first task must expose basic info strip, action row, first risk row summary, and first hazard field.

## Share / Result Contract

- Desktop viewport: `1440x723`
- Desktop must be at least a 2-pane workbench: preview/document selector plus recipient/channel/action/provenance pane.
- Mobile `390x723` may use single-column stepper/accordion.
- Desktop mobile single-column stacked card layout is RED.
- Generated fixture route and exact saved/generated user session must be measured separately.

## Design-System Contract

Use existing primitive-to-semantic-to-component tokens for shell, rail, card, editor, detail-pane, and action-rail surfaces; no wholesale globals/component rewrite, raw px/hex proliferation, or typography/radius drift.

## Required Evidence

Measure day and night at `1440x723` and `390x723`; keep `1440x900` and `390x844` as recommended supporting viewports. Report route, session kind, scrollHeight ratio, visible selected editor count, full document body visible count, supporting-doc collapsed state, sticky overlap, horizontal overflow, hidden primary CTA, share desktop column count, share first-viewport x-region count, and design-token surface coverage.

## Legacy Regression Boundary

`tests\workspace-layout-regression.test.ts` remains a broad no-overflow/editor-flow smoke, not a Documents long-form UX pass gate. Its historical thresholds (`6.5x` collapsed desktop, `10x` expanded desktop, `3.4x` collapsed mobile) can allow a user-visible multi-screen document surface, so they must be paired with the stricter Documents/Share DoD evidence before any cockpit or selected-only bounded workbench claim.
