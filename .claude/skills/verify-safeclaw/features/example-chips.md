# 예시 칩

첫 화면 폼 아래 「예시로 해보기」 칩 3개(외벽 도장·비계·강풍 / 창고 적재·폭염 / 용접 화기·외국인)를 누르면 입력 없이 그 예시 현장으로 바로 문서팩이 만들어진다.

## Sub-features

- `chips-count` 칩이 정확히 3개이고 href 가 `/workspace?scenario=<id>&autogen=1` 꼴이다.
- `chips-autogen` 클릭 → 입력 화면을 거치지 않고 생성이 시작되고 완료된다.
- `chips-result` 결과 머리에 「확인할 항목을 먼저 보세요」가 보인다.

## How to get to it (user POV)

- `/` 에서 폼 아래 칩 하나를 누른다.
- 주소창에 `/workspace?scenario=seoul-construction-windy&autogen=1` 처럼 직접 친다(같은 경로).

## Driving it with verify.mts

Preconditions:

- `doctor` OK. 익명 컨텍스트.

- **세기.** `/` 에서 `a[href*="autogen=1"]` 의 href 를 모두 읽는다. 3개, 전부 `^/workspace\?scenario=[a-z0-9-]+&autogen=1$`. 스크린샷 `01-home-chips.jpg`.
- **클릭.** 첫 칩을 클릭한다. URL 에 `scenario=` 와 `autogen=1` 이 둘 다 있다.
- **생성 완료.** `[aria-label="Safety Brief Dashboard"]` 대기. 스크린샷 `02-chip-generated.jpg`.
- **증거.** 본문 「확인할 항목을 먼저 보세요」, 금지어·`RA-`·enum 0, 콘솔 오류 0. 명령: `… drive --feature example-chips [--base URL]`.

## Gotchas

- `?scenario=` 만 있고 `autogen=1` 이 없으면 **생성 전 입력 화면**이 뜬다(PR-0 의 옵트인 결정). 18곳의 시험·감사가 그 동작을 기대하므로 바꾸지 않는다.
- 칩 목록은 `lib/workspace-autogenerate.ts` `LANDING_EXAMPLE_CHIPS`(런타임 값)에 있다. 랜딩 소스에는 `autogen=1` 리터럴이 없다 — 소스 grep 으로 세지 말 것.
- 예시 현장은 `lib/field-examples.ts` 의 기존 6개 중 3개만 쓴다. 새 예시를 넣지 않는다.
