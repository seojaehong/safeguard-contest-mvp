# Workspace Bounded Workbench Current Gate

Checked at: 2026-07-22T09:08:01.405Z

Base URL: `https://www.safeclaw.kr`

Source HEAD: `6863bd81877c094c384a4e8d457e1be119a34ef9`

Production `/api/build-info`: `6863bd81877c094c384a4e8d457e1be119a34ef9`

Verdict: `PARTIAL_LIVE_PRODUCTION_SCOPED_DETAIL_DEPTH_DEBT_WITH_EXACT_SESSION_GAP`

Route split alone accepted as fix: `false`

Provider live dispatch claimed: `false`

External provider called: `false`

DB mutation performed: `false`

## Interpretation

This gate measures the bounded-workbench contract directly. Route/page split is orientation only; PASS requires first-task visibility and bounded simultaneous scope, while exact saved Share sessions remain separate evidence. Detail-depth debt tracks whether long work moved into a local shell that can still feel long even when body-level page height is bounded.

Allowed claim: measured routes can pass the scoped bounded-workbench contract when their rows pass. Forbidden claim: page split alone fixes the long-page issue, or fixture/generated Share proof closes an exact saved user session.

## Documents

| Route | Theme | State | Viewport | Overall | First task | Body height | Long containment | Detail depth | Body ratio | Shell scroll ratio | First action bottom | Hazard bottom | Selected editors | Full bodies visible | Supporting open | Support moves editor | Sticky overlap | OverflowX |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /documents?theme=day | day | default | 1440x723 | PASS | PASS | PASS | PASS | PARTIAL | 1.07 | 4.28 | 452 | 709 | 1 | 1 | false | false | 0 | false |
| /documents?theme=day | day | selected-riskAssessmentDraft | 1440x723 | PASS | PASS | PASS | PASS | PARTIAL | 1.07 | 4.28 | 452 | 709 | 1 | 1 | false | false | 0 | false |
| /documents?theme=day | day | supporting-9-expanded-index | 1440x723 | PASS | PASS | PASS | PASS | PARTIAL | 1.07 | 4.28 | 405 | 662 | 1 | 1 | true | false | 0 | false |
| /documents?theme=day | day | default | 390x723 | PASS | PASS | PASS | PASS | PARTIAL | 1 | 4.25 | 528 | 654 | 1 | 1 | false | false | 0 | false |
| /documents?theme=day | day | selected-riskAssessmentDraft | 390x723 | PASS | PASS | PASS | PASS | PARTIAL | 1 | 4.25 | 528 | 654 | 1 | 1 | false | false | 0 | false |
| /documents?theme=day | day | supporting-9-expanded-index | 390x723 | PASS | PASS | PASS | PASS | PARTIAL | 1 | 4.25 | 528 | 654 | 1 | 1 | false | false | 0 | false |
| /documents?theme=night | night | default | 1440x723 | PASS | PASS | PASS | PASS | PARTIAL | 1.07 | 4.28 | 452 | 709 | 1 | 1 | false | false | 0 | false |
| /documents?theme=night | night | selected-riskAssessmentDraft | 1440x723 | PASS | PASS | PASS | PASS | PARTIAL | 1.07 | 4.28 | 452 | 709 | 1 | 1 | false | false | 0 | false |
| /documents?theme=night | night | supporting-9-expanded-index | 1440x723 | PASS | PASS | PASS | PASS | PARTIAL | 1.07 | 4.28 | 409 | 666 | 1 | 1 | true | false | 0 | false |
| /documents?theme=night | night | default | 390x723 | PASS | PASS | PASS | PASS | PARTIAL | 1 | 4.25 | 528 | 654 | 1 | 1 | false | false | 0 | false |
| /documents?theme=night | night | selected-riskAssessmentDraft | 390x723 | PASS | PASS | PASS | PASS | PARTIAL | 1 | 4.25 | 528 | 654 | 1 | 1 | false | false | 0 | false |
| /documents?theme=night | night | supporting-9-expanded-index | 390x723 | PASS | PASS | PASS | PASS | PARTIAL | 1 | 4.25 | 528 | 654 | 1 | 1 | false | false | 0 | false |

## Documents Detail-Depth Debt

- /documents?theme=day day default 1440x723: shell scroll ratio 4.28 => PARTIAL
- /documents?theme=day day selected-riskAssessmentDraft 1440x723: shell scroll ratio 4.28 => PARTIAL
- /documents?theme=day day supporting-9-expanded-index 1440x723: shell scroll ratio 4.28 => PARTIAL
- /documents?theme=day day default 390x723: shell scroll ratio 4.25 => PARTIAL
- /documents?theme=day day selected-riskAssessmentDraft 390x723: shell scroll ratio 4.25 => PARTIAL
- /documents?theme=day day supporting-9-expanded-index 390x723: shell scroll ratio 4.25 => PARTIAL
- /documents?theme=night night default 1440x723: shell scroll ratio 4.28 => PARTIAL
- /documents?theme=night night selected-riskAssessmentDraft 1440x723: shell scroll ratio 4.28 => PARTIAL
- /documents?theme=night night supporting-9-expanded-index 1440x723: shell scroll ratio 4.28 => PARTIAL
- /documents?theme=night night default 390x723: shell scroll ratio 4.25 => PARTIAL
- /documents?theme=night night selected-riskAssessmentDraft 390x723: shell scroll ratio 4.25 => PARTIAL
- /documents?theme=night night supporting-9-expanded-index 390x723: shell scroll ratio 4.25 => PARTIAL

## Share / Result

| Route | Theme | Session kind | Viewport | Overall | Desktop workbench | Exact saved session | Page ratio | Root width ratio | X regions | Primary bottom | OverflowX |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /workspace?share&theme=day | day | generated | 1440x723 | PASS_SCOPED | PASS | MISSING_EVIDENCE | 1 | 0.82 | 3 | 389 | false |
| /share/sessionId?workerId=workerId&theme=day | day | fixture | 1440x723 | PASS_SCOPED | PASS | MISSING_EVIDENCE | 1.31 | 0.84 | 2 | 529 | false |
| /workspace?share&theme=day | day | generated | 390x723 | PASS_SCOPED | PASS | MISSING_EVIDENCE | 1 | 0.86 | 2 | 696 | false |
| /share/sessionId?workerId=workerId&theme=day | day | fixture | 390x723 | PASS_SCOPED | PASS | MISSING_EVIDENCE | 2.17 | 1 | 1 | 707 | false |
| /workspace?share&theme=night | night | generated | 1440x723 | PASS_SCOPED | PASS | MISSING_EVIDENCE | 1 | 0.82 | 3 | 389 | false |
| /share/sessionId?workerId=workerId&theme=night | night | fixture | 1440x723 | PASS_SCOPED | PASS | MISSING_EVIDENCE | 1.31 | 0.84 | 2 | 529 | false |
| /workspace?share&theme=night | night | generated | 390x723 | PASS_SCOPED | PASS | MISSING_EVIDENCE | 1 | 0.86 | 2 | 696 | false |
| /share/sessionId?workerId=workerId&theme=night | night | fixture | 390x723 | PASS_SCOPED | PASS | MISSING_EVIDENCE | 2.17 | 1 | 1 | 707 | false |

## Missing Exact Session Evidence

- Route: `/share/[sessionId] exact saved/generated user session`
- Verdict: `MISSING_EVIDENCE`
- Reason: No concrete production share session URL, saved session id, or user-observed generated payload was available. Fixture/generated PASS remains scoped and cannot close the exact user complaint.

## Product Structure Decision

사용자 질문에 대한 답은 유지한다: 페이지 수를 늘리는 것만으로는 해결이 아니다. 실제 해결은 route split plus first-viewport cockpit plus selected-only bounded workbench plus drilldown/local scroll이다. Documents는 core-3/supporting-9 index와 선택 문서 1개 작업대여야 하고, Share/Result는 desktop에서 2-3 region workbench여야 한다.
