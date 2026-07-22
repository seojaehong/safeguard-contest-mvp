# Workspace Bounded Workbench Current Gate

Checked at: 2026-07-22T07:38:13.713Z

Base URL: `https://www.safeclaw.kr`

Source HEAD: `1dbfc4ddfd99d06afecdf8f642cffc2b1f523c91`

Production `/api/build-info`: `1dbfc4ddfd99d06afecdf8f642cffc2b1f523c91`

Verdict: `PARTIAL_OR_RED_LIVE_PRODUCTION_MEASURED`

Route split alone accepted as fix: `false`

Provider live dispatch claimed: `false`

External provider called: `false`

DB mutation performed: `false`

## Interpretation

This gate measures the bounded-workbench contract directly. Route/page split is orientation only; PASS requires first-task visibility and bounded simultaneous scope, while exact saved Share sessions remain separate evidence.

Allowed claim: measured routes can pass the scoped bounded-workbench contract when their rows pass. Forbidden claim: page split alone fixes the long-page issue, or fixture/generated Share proof closes an exact saved user session.

## Documents

| Route | Theme | State | Viewport | Overall | First task | Body height | Long containment | Body ratio | Shell scroll ratio | First action bottom | Hazard bottom | Selected editors | Full bodies visible | Supporting open | Support moves editor | Sticky overlap | OverflowX |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /documents?theme=day | day | default | 1440x723 | PASS | PASS | PASS | PASS | 1.07 | 4.28 | 452 | 709 | 1 | 1 | false | false | 0 | false |
| /documents?theme=day | day | selected-riskAssessmentDraft | 1440x723 | PASS | PASS | PASS | PASS | 1.07 | 4.28 | 452 | 709 | 1 | 1 | false | false | 0 | false |
| /documents?theme=day | day | supporting-9-expanded-index | 1440x723 | PASS | PASS | PASS | PASS | 1.07 | 4.28 | 409 | 666 | 1 | 1 | true | false | 0 | false |
| /documents?theme=day | day | default | 390x723 | RED | RED | PASS | PASS | 1 | 7.09 | 662 | 788 | 1 | 1 | false | false | 0 | false |
| /documents?theme=day | day | selected-riskAssessmentDraft | 390x723 | RED | RED | PASS | PASS | 1 | 7.09 | 662 | 788 | 1 | 1 | false | false | 0 | false |
| /documents?theme=day | day | supporting-9-expanded-index | 390x723 | RED | RED | PASS | PASS | 1 | 7.09 | 662 | 788 | 1 | 1 | false | false | 0 | false |
| /documents?theme=night | night | default | 1440x723 | PASS | PASS | PASS | PASS | 1.07 | 4.28 | 452 | 709 | 1 | 1 | false | false | 0 | false |
| /documents?theme=night | night | selected-riskAssessmentDraft | 1440x723 | PASS | PASS | PASS | PASS | 1.07 | 4.28 | 452 | 709 | 1 | 1 | false | false | 0 | false |
| /documents?theme=night | night | supporting-9-expanded-index | 1440x723 | PASS | PASS | PASS | PASS | 1.07 | 4.28 | 414 | 671 | 1 | 1 | true | false | 0 | false |
| /documents?theme=night | night | default | 390x723 | RED | RED | PASS | PASS | 1 | 7.09 | 662 | 788 | 1 | 1 | false | false | 0 | false |
| /documents?theme=night | night | selected-riskAssessmentDraft | 390x723 | RED | RED | PASS | PASS | 1 | 7.09 | 662 | 788 | 1 | 1 | false | false | 0 | false |
| /documents?theme=night | night | supporting-9-expanded-index | 390x723 | RED | RED | PASS | PASS | 1 | 7.09 | 662 | 788 | 1 | 1 | false | false | 0 | false |

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
