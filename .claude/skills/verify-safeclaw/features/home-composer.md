# 첫 화면 입력 폼

첫 화면(`/`)은 입력 폼 하나다. 사용자가 오늘 작업을 한 줄 적고 「보내기」를 누르면 `/workspace?q=<입력>` 으로 이동해 바로 문서팩 생성이 시작되고, 로그인하지 않았으면 기본 문서(템플릿)만 만든다는 안내가 보인다.

## Sub-features

- `home-form` 첫 뷰포트에 textarea 와 「보내기」가 보이고 가로 넘침이 없다.
- `home-contract` 지운 섹션(파이프라인 격자·상태 띠)·「문서팩 보기」 문구가 없고 예시 칩이 3개다.
- `home-anonymous-notice` 폼 아래에 `ANONYMOUS_MESSAGE` 원문이 보인다(서버 admission 과 같은 문장).
- `home-submit` 보내기 → `/workspace?q=` 이동 → 생성 완료(머리 「확인할 항목을 먼저 보세요」).
- `home-echo` 결과 본문에 입력한 작업(지게차)이 반영된다.

## How to get to it (user POV)

- 브라우저로 `/` 를 연다(운영 `https://www.safeclaw.kr/`).
- textarea 에 작업 한 줄을 적고 「보내기」 단추(또는 Enter 가 아닌 단추 클릭)를 누른다.

## Driving it with verify.mts

Preconditions:

- `doctor --base <URL>` 이 OK(첫 화면 200, 폼 있음, 칩 3, 익명 안내).
- 로그인하지 않은 새 브라우저 컨텍스트.

- **열기.** `/` 를 390×844 로 연다. `textarea[name=q]` 가 보이고 h1 에 「오늘 작업을 한 줄로 적으면」이 있다. 스크린샷 `01-home.jpg`.
- **계약.** 페이지 HTML 에 `safeclaw-pipeline-grid`·`safeclaw-os-status` 등 지운 클래스 0, 「문서팩 보기」 0, `a[href*="autogen=1"]` 3개, `data-testid=anonymous-mode-notice` 에 「로그인하지 않은 체험에서는 기본 문서(템플릿)만 만듭니다」.
- **입력·보내기.** textarea 에 합성 한 줄을 채우고 `getByRole("button", { name: "보내기" })` 클릭. URL 이 `/workspace?q=` 로 바뀐다.
- **생성 완료.** `[aria-label="Safety Brief Dashboard"]` 가 보일 때까지 기다린다(격리 dev 첫 컴파일 포함 최대 240초, 운영은 수 초). 스크린샷 `02-workspace-generated.jpg`.
- **증거.** 본문에 「확인할 항목을 먼저 보세요」·「지게차」·익명 안내 문장이 있고, 금지어·`RA-`·enum 0, 콘솔 오류 0. 명령: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .claude/skills/verify-safeclaw/scripts/verify.mts drive --feature home-composer [--base URL]`.

## Gotchas

- 운영 첫 화면 HTML 을 문자열로 세면 RSC 페이로드 때문에 칩이 6, h2 가 2 로 나온다. DOM 또는 `href="…"` 패턴으로 센다.
- 익명 안내 문장은 「로그인하면」이 아니라 「로그인하지 않은 체험에서는」이다. 정규식을 느슨하게 쓰면 거짓 FAIL.
- 첫 뷰포트 클릭 요소는 링크·버튼만 셀 때 데스크톱 6·모바일 5 다(textarea 포함 시 7·6). ux-direction 문서의 「6개」는 링크·버튼 기준.
- 720px 이하에서 상단 nav(「작업공간」)가 숨고 대체 메뉴가 없다(ux-direction 마찰 #5, PR-1 미처리). 결함이 아니라 알려진 미처리로 보고한다.
- 사진 첨부는 첫 화면에 없다(PR-3 몫). 안내 한 줄 「사진은 문서를 만든 뒤 작업공간에서 첨부할 수 있습니다.」가 그 자리다.
