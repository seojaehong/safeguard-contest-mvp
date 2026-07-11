# Editor-first UI v2 P1/P2 remediation report

- 기준 커밋: `8e695b3f`
- 작업일: 2026-07-11
- 범위: editor export 무결성, current-workpack update loop, draft identity, Day metadata 대비, 브라우저 테스트 격리와 종료
- 판정: **요청 범위 검증 통과**

## 변경 결과

1. 사용자가 편집한 문서는 `dirtyKeys`와 함께 저장한다. 부모가 같은 편집값을 다시 `initialValues`로 전달해도 편집 여부가 사라지지 않는다.
2. 편집 문서의 XLSX/HWP 요청은 `edited: true`와 실제 파싱된 행을 보낸다. 서버는 이 경우 오래된 structured risk rows를 우선하지 않는다.
3. 산문을 임의로 제거하던 한글 완전문장 필터를 없앴다. 실제 브라우저 요청에서 사용자가 입력한 완전문장이 XLSX/HWP의 `rows[].content`에 남는지 확인한다.
4. current-workpack 편집 callback은 ref와 값 동일성 guard를 사용한다. 부모 상태 갱신 때 callback identity가 바뀌며 다시 저장하는 update-depth 순환을 제거했다.
5. generation fingerprint는 정렬된 생성 입력에서 만들고 `qualityContract.generatedAt` 같은 변동 시각을 제외한다. current-workpack에 fingerprint를 저장하고 다시 열 때 복원하며, 기존 저장 포맷은 data에서 fingerprint를 계산한다.
6. Day 문서 metadata는 workspace muted/success 토큰을 사용한다. 전역 OS yellow 규칙보다 구체적인 document-editor 규칙으로 자동 저장, 글자 수, 미리보기 metadata를 교정했다.
7. `/documents`와 `/workspace` 브라우저 테스트는 각각 고유 포트와 `.next-browser-tests/<suite-pid>` dist를 사용한다. 종료 시 browser context와 browser를 기다린 뒤 Windows process tree를 종료하고 suite dist를 제거한다.

## TDD RED

Production 수정 전에 다음 실패를 직접 확인했다.

| 명령 | RED |
| --- | --- |
| `npm.cmd test -- tests/editor-first-state.test.ts` | 0/1 통과. 저장 객체에 `generationFingerprint`가 없어 실패 |
| `npm.cmd test -- tests/editor-export-integrity.test.ts` | 0/1 통과. 실제 XLSX에 편집 행이 없고 `STALE_STRUCTURED_RISK_ROW`가 남아 실패 |
| `npm.cmd test -- tests/documents-editor-layout.test.ts` | 6/9 통과. 실제 current-workpack에서 `Maximum update depth exceeded`, reload 후 draft 유실, Day `자동 저장` 대비 1.2396803229990399로 각각 실패 |

추가 payload assertion을 강화하는 과정에서 `키: 값` 문장을 직렬화 문자열 한 덩어리로 기대한 테스트가 한 번 실패했다. 실제 payload는 `item=편집안전대책`, `content=SAFECLAW_DOCUMENT_EDIT_PRESERVED`로 정상 구조화되어 있었고, production 수정 없이 assertion을 실제 행 계약에 맞춘 뒤 재검증했다.

## GREEN 검증

| 명령 | 결과 |
| --- | --- |
| `npm.cmd test -- tests/editor-first-state.test.ts tests/editor-export-integrity.test.ts tests/workpack-readiness.test.ts tests/reporting-downloads.test.ts tests/workpack-store.test.ts` | 5 files, 20 tests 통과 |
| `npm.cmd test -- tests/documents-editor-layout.test.ts` | 1 file, 9 tests 통과 |
| `npm.cmd test -- tests/workspace-layout-regression.test.ts` | 1 file, 17 tests 통과 |
| `npm.cmd run typecheck` | 통과 |

브라우저 검증에는 다음 실제 동작이 포함된다.

- 저장된 current-workpack으로 `/documents`를 열고 React maximum update-depth 오류가 없으며 current-workpack write가 유한한지 확인
- 위험성평가표를 편집하고 전체 reload 후 동일 draft key와 편집 본문이 복원되는지 확인
- Day metadata 각 label의 계산 대비가 4.5 이상인지 확인
- workspace에서 한글 완전문장과 sentinel을 편집한 뒤 XLSX/HWP 요청의 실제 `rows`와 `edited: true`를 확인
- 격리 브라우저 suite 종료 후 `.next-browser-tests` 산출물이 남지 않는지 확인

## 검증 경계

- 전체 저장소 test suite와 live provider/API probe는 이번 remediation에서 실행하지 않았다.
- `tests/product-module-shell.test.ts` 전체 실행은 고정 screenshot 경로의 기존 외부 변경 PNG를 덮어쓸 수 있어 실행하지 않았다. Day metadata는 전용 `/documents` 브라우저 대비 테스트로 검증했다.
- 기존 외부 변경인 `desktop-tbm-night.png`, `desktop-workers-night.png`는 수정하거나 커밋 대상에 포함하지 않는다.
- DB schema, migration, Supabase 설정, env, secret은 변경하지 않았다.
- 이전 보고서의 전체 suite 숫자, 고정 포트 전체 종료, 무조건적인 Merge 승인 문구는 이번 검증 결과로 대체한다.
