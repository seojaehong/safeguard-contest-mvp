# Documents complete cockpit evidence

## Verdict

PASS_CURRENT_SOURCE.

All 12 document surfaces now have a first-task cockpit or equivalent first editable row before the long raw document body. This addresses the structural issue behind the long `/documents` page: splitting pages alone is not enough if each page still begins with a long textarea.

## Source

- Branch: `chore/recipient-foreign-live-gate-20260720`
- Product commit: `5124ef5f34aa89072402ba6c6e98b08c2ec5464c`
- Route: `/documents`
- Production live geometry claimed: no

## Covered document surfaces

| Document | First-task surface |
| --- | --- |
| 점검결과 요약 | 요약 cockpit |
| 위험성평가표 | 첫 위험행 editor |
| 작업계획서 | 작업 실행 cockpit |
| 안전작업허가 확인서 | 작업 실행 cockpit |
| TBM/작업 전 안전점검회의 | TBM cockpit |
| TBM 기록 | TBM cockpit |
| 안전보건교육 기록 | 교육 cockpit |
| 외국인 근로자 출력본 | compact 교육 cockpit |
| 비상대응 절차 | 비상대응 cockpit |
| 사진/증빙 | 사진·증빙 cockpit |
| 외국인 근로자 전송본 | 전송 cockpit |
| 현장 공유 메시지 | 전송 cockpit |

## Verification

| Check | Result |
| --- | --- |
| `npm.cmd test -- tests\documents-editor-layout.test.ts -t "puts supporting document cockpits" --maxWorkers=1 --fileParallelism=false` | PASS, 1 file / 1 test |
| `npm.cmd test -- tests\documents-editor-layout.test.ts -t "supports roving keyboard navigation\|bounds the default documents route editor\|puts the core launcher before the mobile editor\|puts supporting document cockpits\|keeps the editor workspace and expanded tools contained" --maxWorkers=1 --fileParallelism=false` | PASS, 1 file / 6 tests |
| `npm.cmd run typecheck` | PASS |
| `git diff --check` | PASS |

## Structural conclusion

The product should not solve the user's complaint by merely creating more routes. `/documents` and `/workspace?share` can still become long mobile-like pages if the first viewport is a raw editor or stacked configuration form.

The durable pattern is:

1. Show a short cockpit/rail first.
2. Let the user confirm the next decision.
3. Keep long source text and supporting detail behind drilldown/editing panels.

This commit applies that pattern across all document surfaces in current source. Production live geometry remains a separate gate.
