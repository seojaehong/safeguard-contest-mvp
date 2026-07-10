# Editor-first UI v2 수정 검증 보고서

- 원 리뷰 범위: `596ea1447702b4b13cf06f3b6014e7cb5e87e883...72f53447b12755e1ac57c485a899637ec31f7429`
- 수정 검증 범위: `72f53447` 이후 현재 worktree
- 검증일: 2026-07-11
- 판정: **요청 범위 Merge 승인**

## 결론

원 리뷰의 Important 3건과 Minor 1건은 모두 해결됐다. 실제 `/workspace`의 608px 중첩 편집 컨테이너에서 문서 네비게이터가 상단 선택기로 접히고 textarea가 294px에서 550px로 넓어졌다. Day/Night와 390px에서 문서 폭을 넘는 가로 스크롤 없이 페이지 세로 스크롤이 유지되며, export 기본 접힘과 사용자식 펼침 후 다운로드, ARIA tablist 키보드 탐색도 자동화 및 실제 브라우저로 확인했다.

전체 저장소 스위트에는 이번 diff 밖의 기존 테스트 수집 오류와 dev-server 테스트 격리 문제가 남아 있다. 관련 editor/workspace 테스트와 typecheck는 전부 통과했으며, 해당 기존 실패는 아래 `잔여 우려`에 분리했다.

## Critical

없음.

## Important

### 1. 해결됨: 실제 `/workspace` 중첩 편집기의 294px 병목

- 위치: `components/WorkpackEditor.module.css:1-7`, `components/WorkpackEditor.module.css:495-541`
- 회귀 테스트: `tests/workspace-layout-regression.test.ts:1035-1085`
- 원 재현: 1440x900 `/workspace`에서 내부 shell 608px, 문서 네비게이터 240px, editor 352px, textarea 294px였다.
- 수정: `.workspace`를 inline-size container로 만들고 실제 편집 컨테이너가 760px 이하일 때 navigator와 editor가 전체 grid 폭을 차지하도록 했다. 데스크톱 tablist는 상단 select로 접히므로 viewport가 1440px이어도 중첩 컨테이너 폭을 기준으로 반응한다.
- 수정 후 실측: shell 608px, navigator 608px, editor 608px, textarea 550px이며 textarea가 shell 폭의 90.5%를 사용한다. navigator bottom 201px, editor top 217px로 서로 겹치지 않는다.
- 재현 단계: `/workspace?theme=day`를 1440x900으로 열고 template 문서를 생성한 뒤 위험성평가표 `편집`을 누른다. 문서 선택기가 editor 위에 있고 textarea가 주 작업면인지 확인한다.
- 판정: 해결됨.

### 2. 해결됨: `overflow:hidden !important`의 Night/scroll-safe 회귀

- 위치: `components/WorkpackEditor.module.css:104-111`
- 회귀 테스트: `tests/workspace-layout-regression.test.ts`의 Night editor 및 생성 후 편집 검증
- 원 재현: `.editor`의 강제 hidden이 기존 `.document-editor { overflow: visible; }` 계약을 덮어 X/Y computed overflow가 모두 `hidden`이었다.
- 수정: 강제 hidden을 제거하고 module 우선순위에서도 `overflow: visible !important`를 명시했다. clipping은 editor 전체에 적용하지 않는다.
- 수정 후 실측: desktop Day/Night와 mobile 390px Day/Night 모두 editor `overflowX=visible`, `overflowY=visible`이다. 390px에서 `scrollWidth=390`, 문서 `scrollHeight=11,269`(Night)/`11,334`(Day)로 가로 overflow 0과 세로 페이지 스크롤을 함께 확인했다.
- 재현 단계: Day/Night 각각 생성 후 편집 화면에서 근거/export 패널을 펼치고 `documentElement.scrollWidth === innerWidth`, `scrollHeight > innerHeight`, editor X/Y overflow visible을 확인한다.
- 판정: 해결됨.

### 3. 해결됨: 기본 접힘 export와 workspace 회귀 테스트 불일치

- 위치: `components/WorkpackEditor.tsx:2733`, `tests/workspace-layout-regression.test.ts:1210-1217`
- 원 재현: export panel은 의도대로 닫혀 있지만 테스트가 숨겨진 Excel 버튼을 바로 클릭해 timeout됐다.
- 수정: production의 기본 접힘을 유지했다. 회귀 테스트는 먼저 `open === false`를 확인하고 summary를 클릭해 `open === true`로 전환한 뒤 Excel/HWP export 계약을 검증한다.
- 실제 브라우저: 390px `/workspace`에서 export panel을 연 뒤에도 `scrollWidth=390`이다. Excel 버튼으로 받은 파일은 11,057바이트이고 `PK 03 04` OOXML/ZIP 시그니처를 가졌다.
- 재현 단계: 생성 후 편집, 문서 수정, 검토 화면 왕복, editor 재마운트 후 export summary를 열고 Excel 버튼을 누른다. 수정 sentinel과 revalidation payload가 유지되는지 확인한다.
- 판정: 해결됨.

## Minor

### 1. 해결됨: ARIA tablist 키보드 탐색과 roving tabIndex

- 위치: `components/WorkpackEditor.tsx:2064-2085`, `components/WorkpackEditor.tsx:2469-2496`
- 회귀 테스트: `tests/documents-editor-layout.test.ts:192-232`
- 수정: 선택 tab만 `tabIndex=0`, 나머지는 `-1`로 유지한다. ArrowRight/ArrowDown은 다음 tab, ArrowLeft/ArrowUp은 이전 tab, Home/End는 첫/마지막 tab을 선택하고 포커스를 이동한다. tabpanel은 선택 tab id를 `aria-labelledby`로 참조한다.
- 재현 단계: `/documents`에서 첫 tab에 포커스하고 End, Home, 네 방향키를 차례로 누른다. 선택 문서, 포커스, mobile select 값, roving tabIndex, tabpanel label이 함께 갱신되는지 확인한다.
- 판정: 해결됨.

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| TDD RED | 기존 코드에서 nested navigator/editor 관계식 실패, 12개 tab 모두 `tabIndex=0` 실패 확인 |
| `npm.cmd run typecheck` | 통과 |
| `npm.cmd test -- tests/documents-editor-layout.test.ts` | 6/6 통과 |
| `npm.cmd test -- tests/workspace-layout-regression.test.ts` | 17/17 통과 |
| sticky-header 격리 재검증 | 1/1 통과 |
| evidence-route 격리 재검증 | 9/9 통과 |
| 전체 스위트 병렬 실행 | 82 files, 644 tests 통과, 12 skip; 기존/격리 관련 실패는 `잔여 우려` 참조 |
| 전체 스위트 단일 worker (`live-harness` 제외) | 86/87 files, 657/659 tests 통과; 기존 Day 대비 2건 실패 |
| Playwright desktop `/workspace` Day/Night | container 반응, textarea 주 폭, overflow, 색상, 세로 스크롤 통과 |
| Playwright mobile 390px Day/Night | 가로 overflow 0, 세로 스크롤, 접힌/펼친 보조 패널 통과 |
| 실제 Excel download | 11,057바이트 OOXML, ZIP magic 확인 |
| 임시 서버 종료 | 3227, 3228, 3231, 3233, 3241 LISTEN 프로세스 없음 |

## 잔여 우려

1. `tests/live-harness-quality-probe.test.ts`는 `72f53447`과 동일한 상태에서도 Vitest 수집 단계의 `SyntaxError: Invalid or unexpected token`으로 단독 실패한다. 이번 변경 파일이 아니며 `node --check`와 직접 ESM import는 통과한다.
2. `tests/product-module-shell.test.ts`는 캐시 삭제 후 단독 및 단일-worker 전체 실행에서 desktop/mobile 2건이 실패한다. `/documents` Day의 `자동 저장`, 글자수, `XLS(HTML 호환) 미리보기`가 기존 노란색 `rgb(255, 220, 46)`을 상속해 AA 대비 검사를 통과하지 못한다. 이번 diff는 해당 색상 선언을 바꾸지 않으며 사용자가 지정한 네 수정 항목 밖이다.
3. 전체 병렬 실행은 여러 Next dev 테스트가 같은 `.next`를 동시에 사용해 404와 `prerender-manifest.json` ENOENT를 냈다. 실패했던 evidence-route와 sticky-header는 격리 재실행에서 각각 9/9, 1/1 통과했다.
4. 브라우저에서 localStorage의 template mode와 서버 기본 mode가 다를 때 기존 hydration mismatch 경고가 관찰된다. `72f53447` 이후 이번 diff에서 새로 생긴 경고는 아니며 요청 범위 밖이다.

## QA 산출물

- 수정 전: `output/playwright/editor-first-ui-v2-review/workspace-generated-editor-day.png`
- 수정 후 desktop Day: `output/playwright/editor-first-ui-v2-review/workspace-generated-editor-day-fixed.png`
- 수정 후 desktop Night: `output/playwright/editor-first-ui-v2-review/workspace-generated-editor-night-fixed.png`
- 수정 후 mobile Day 390px: `output/playwright/editor-first-ui-v2-review/workspace-generated-editor-day-mobile-390-fixed.png`
- 수정 후 mobile Night 390px: `output/playwright/editor-first-ui-v2-review/workspace-generated-editor-night-mobile-390-fixed.png`
- export 증거: `output/playwright/editor-first-ui-v2-review/export-smoke-risk-assessment-fixed.xlsx`

## Merge 판정

**요청 범위 Merge 승인.** 원 리뷰의 Important 3건과 Minor 1건은 코드, 회귀 테스트, 실제 `/workspace` desktop/mobile QA로 닫혔다. 전체 저장소 스위트의 기존 수집/격리 문제는 별도 후속 정리가 필요하지만 이 editor-first 수정의 merge blocker로 판정하지 않는다.
