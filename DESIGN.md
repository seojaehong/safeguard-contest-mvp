# SafeClaw DESIGN.md — 안전보건표지 서식 체계

2026-10-25 개편. 정본 결정 = `evaluation/launch-depth-audit-2026-10-25/design-plan.md`(감사 작업트리).
구조는 IBM Carbon(평면·격자·0~2px 모서리)을 빌리고, 색은 산업안전보건법 시행규칙 [별표 8]
안전보건표지의 색도기준 및 용도에서 가져온다. 토큰은 `app/globals.css` 맨 위 `:root` 두 묶음에 있다.

## 1. 무엇을 위한 화면인가

- 사용자: 사업장 관리감독자·안전관리자. 작업 전 30분 안에 위험성평가·TBM·허가서를 만들고 비치·서명받는다.
- 화면은 마케팅 화면이 아니라 **서식 작성대**다. 현장은 휴대폰, 사무실은 PC로 인쇄한다.
- 기억에 남을 요소는 하나, **서식 미리보기**(2단계 작업)다. 나머지(입력·목록·버튼)는 조용하게 둔다.

## 2. 색 — 별표 8의 뜻으로만 쓴다

| 토큰 | 별표 8 | HEX | 쓰는 곳 |
|---|---|---|---|
| `--sign-red` | 금지 7.5R 4/14 | `#be1e2d` | 작업중지·필수 누락·오류·삭제 |
| `--sign-yellow` | 경고 5Y 8.5/12 | `#f2cf1d` | 주의·보완 필요·검토 필요. **바탕으로만, 글자는 `--ink`** |
| `--sign-blue` | 지시 2.5PB 4/10 | `#1d5aa6` | 주 행동 버튼·링크·선택 상태·키보드 초점 |
| `--sign-green` | 안내 2.5G 4/10 | `#0b7a4b` | 완료·확인됨·서명됨 |
| `--ink` | N0.5 계열 | `#1b1c1e` | 본문 글자, 서식 굵은 테두리 |
| `--ink-2` | — | `#4a5058` | 보조 글자 |
| `--ink-3` | — | `#5f6670` | 흐린 보조 글자(바탕·책상 모두 4.5:1 이상) |
| `--paper` | N9.5 | `#ffffff` | 서식·패널 바탕 |
| `--desk` | — | `#eef0f2` | 앱 바탕(서식이 놓인 책상) |
| `--desk-2` | — | `#e2e6ea` | 머리 칸·눌린 상태 |
| `--rule` | — | `#b9c0c7` | 서식 칸선·입력 테두리 |
| `--rule-soft` | — | `#d9dee3` | 구획 가는 선 |

보조: `--sign-*-soft`(옅은 바탕, 글자는 `--ink` 또는 같은 계열 진한 색), `--sign-blue-hover`, `--on-sign`(빨강·파랑·초록 바탕 위 흰 글자).
HEX는 먼셀 값의 근사이며 대비를 재서 확정했다(아래 5절).

규칙
- 파랑은 「지시」다. 주 행동에만 쓰고 장식·브랜드 색으로 쓰지 않는다.
- 노랑은 「경고」다. 경고 상태에만 쓴다. 노랑-검정 테이프 띠·형광펜 강조·노랑 버튼은 폐기했다.
- 빨강은 멈춤·오류, 초록은 끝남·확인에만 쓴다. 같은 색을 다른 뜻으로 섞지 않는다.
- 장식색은 없다. 보라·주황·청록 같은 옛 강조색은 위 토큰으로 옮겼다.

옛 이름(`--sc-*`, `--accent`, `--os-*`, `--workspace-*`, `--share-*`)은 위 토큰을 가리키는 별칭으로 남겼다.
새 코드는 `--sign-*`·`--ink`·`--paper`·`--desk`·`--rule`을 직접 쓴다.

야간 테마(사용자가 「Night」를 고를 때만)는 `--night-sign-*` 밝은 판을 쓴다. 잠정이며 기본은 주간이다.

## 3. 글꼴

- **IBM Plex Sans KR** 한 벌(400·500·600). `app/layout.tsx`에서 `next/font/google`로 불러와 `--font-plex-kr`로 넘긴다.
  `--font-product`·`--font-base`·`--font-hud`가 모두 이 글꼴이다. 700 이상 선언은 600으로 그려진다(가짜 굵기 금지 `font-synthesis: none`).
- 출력 서식 미리보기는 `--font-document`(맑은 고딕 계열)를 그대로 쓴다 — 인쇄물과 같은 모양이어야 하기 때문이다.
- 외국어 안내는 `--font-multilingual`(Noto Sans 태국·크메르·미얀마·데바나가리 CDN).
- 숫자 칸(가능성·중대성·일시·인원)과 모든 `table`은 `font-variant-numeric: tabular-nums`.
- 하지 않는 것: 대문자 눈썹 라벨(`text-transform: uppercase` 제거), 고정폭 라벨(Geist Mono 제거), 제목 한 단어만 색칠·형광펜.

## 4. 형태

- 모서리 0~2px. `--radius-*`·`--r-*` 전부 2px, 원(아바타·점·스피너)만 `--radius-circle: 50%`.
- 그림자 없음. 층은 테두리와 바탕색(`--paper` 대 `--desk`)으로만 나눈다.
- 허용되는 `box-shadow`는 두 가지뿐: 선택 상태 왼쪽 4px 띠(`inset 4px 0 0 …`)와 입력칸 초점 고리(`0 0 0 2px var(--sign-blue)`).
  목록은 `scripts/frontend_consistency_audit.mjs`의 `allowEffect`에 있다.
- 키보드 초점: 전역 `:focus-visible { outline: 2px solid var(--sign-blue); outline-offset: 2px }`.
- 터치 대상 44px 이상(`--control-height`). 장갑 낀 손을 기준으로 한다.

## 5. 대비

`tests/design-token-contrast.test.ts`가 `:root` 값을 읽어 아래 쌍이 4.5:1 이상인지 잰다(측정값, WCAG 2.x).

| 글자 / 바탕 | 대비 |
|---|---|
| `--ink` / `--paper` · `--desk` | 17.05 · 14.93 |
| `--ink-2` / `--paper` · `--desk` | 8.14 · 7.13 |
| `--ink-3` / `--desk` | 5.08 |
| `--on-sign` / `--sign-blue` · `--sign-red` · `--sign-green` | 6.85 · 6.15 · 5.39 |
| `--ink` / `--sign-yellow` | 11.14 |
| `--sign-blue` / `--paper` · `--desk` | 6.85 · 6.00 |
| `--night-sign-blue` / `--ink` | 8.09 |

`--sign-yellow` 글자는 흰 바탕에서 1.53이라 금지한다. 시험이 `color: var(--sign-yellow)`를 찾으면 실패한다.

## 6. 화면 구조

- 데스크톱: 문서 목록 │ 편집 │ 서식 미리보기(A4 비율). 휴대폰: 문서 선택 → 편집/미리보기 탭.
- 문서 상태는 목록 왼쪽 4px 색 띠: 빨강 = 필수 누락, 노랑 = 보완 필요, 초록 = 서명·확인 끝.
- 서식은 진짜 서식처럼: 바깥 2px `--ink` 테두리, 안쪽 1px `--rule` 칸선, 머리 칸 `--desk` 바탕, 오른쪽 위 결재란.
  굵은 칸선은 서식 미리보기에만 쓰고 편집 영역은 여백으로 나눈다.
- 공개 화면(홈·근거·이력)은 토큰만 따르고 레이아웃은 그대로 둔다.

## 7. 움직임·문구

- 자동 움직임 없음. 열기·접기·저장 확인처럼 사용자가 한 행동에만 짧게. `prefers-reduced-motion` 존중.
- 상태 문구는 운영 언어(`연결됨`, `일부 근거 보류`, `연결 점검 필요`). `demo`·`mock`·`fallback`·과장 표현 금지.
- 제품 화면에 이모지 금지. 작업자에게 보내는 전파 메시지만 고정 안전 그림문자(`⚠️` `✋` `🦺` `💧`) 허용.

## 8. 단계

1. 토큰층(이 문서·`:root`·글꼴·모서리·그림자) — 2026-10-25 완료.
2. 서식 미리보기 컴포넌트: 문서별 서식 정의 한 곳에서 미리보기·인쇄 HTML을 같이 만든다.
3. 휴대폰 편집/미리보기 탭, 행 카드 접기.

## 9. 검사

- `npm run audit:frontend-consistency` — 글자 역할·그림자·`!important` 정적 검사.
- `npx vitest run tests/design-token-contrast.test.ts tests/font-family-token-contract.test.ts tests/frontend-design-contract.test.ts`.
- 화면 캡처: `/`, `/workspace`, `/tools/leave`, `/evidence-file`, `/documents`를 1440·390에서 본다.
