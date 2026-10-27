# 작업공간 결과

생성이 끝나면 `/workspace` 는 결과를 「확인할 항목을 먼저 보세요」 머리 아래에 Safety Brief(핵심 위험 3개·위험성평가 상위 항목)로 보여 주고, 「위험성평가표 편집」·「다음: 공유」 단추와 「문서 깊게 보기」(문서 목록·미리보기·편집·다운로드)를 둔다. 분류가 확정되지 않았거나 편집 뒤 재검증이 필요하면 머리 바로 아래에 확인할 항목 블록이 먼저 보인다.

## Sub-features

- `result-head` 머리 문구와 Safety Brief 가 보인다.
- `result-check-first` review_required 알림·「편집본 재검증」 단추가 필요할 때만 보인다(없으면 확정 상태).
- `result-actions` 「위험성평가표 편집」·「다음: 공유」가 있다.
- `result-deep-review` 「문서 깊게 보기」를 열면 문서 목록(3개 이상)과 선택 문서의 미리보기 창(제목·「편집」 단추)이 나온다.
- `result-clean-text` 본문에 금지어·영문 관리번호(`RA-…`)·내부 enum 이 없다.

## How to get to it (user POV)

- 첫 화면에서 보내기 또는 칩을 눌러 도착한다.
- `/workspace?q=<한 줄>` 을 직접 연다.
- `/workspace` 에서 입력 화면을 거쳐 생성한다(이 지도에서는 위 두 경로만 구동).

## Driving it with verify.mts

Preconditions:

- `doctor` OK. 익명 컨텍스트. 합성 한 줄.

- **도착.** `/workspace?q=<합성>` 을 열고 `[aria-label="Safety Brief Dashboard"]` 를 기다린다. 스크린샷 `01-result-head.jpg`.
- **머리·브리프.** 본문에 「확인할 항목을 먼저 보세요」·「핵심 위험 3개」·「위험성평가 상위」.
- **확인할 항목 블록.** `data-testid=document-check-first` 수를 **보고**한다(0 = 분류 확정·재검증 불요, 1 = 알림 또는 재검증 단추). 어느 쪽도 결함이 아니다.
- **단추.** `getByRole("button", { name: "위험성평가표 편집" })` 1개, 「다음: 공유」(단추 또는 링크) 1개.
- **깊게 보기.** `data-testid=document-deep-review` 의 summary 를 클릭 → `[aria-label="문서 목록"]` 이 보이고 항목(button·a) 3개 이상. `.document-preview-pane .document-preview-head` 에 선택 문서 제목(strong)과 「편집」 단추 1개. 스크린샷 `02-deep-review-open.jpg`.
- **증거.** 본문 텍스트에서 금지어·`RA-`·enum 0, 진단·판정·상담·자문·대리는 문맥만 report.md 에. 콘솔 오류 0. 명령: `… drive --feature workspace-result [--base URL]`.

## Gotchas

- 문서별 조종석(`summary-document-cockpit` 등 `*-document-cockpit`)은 깊게 보기가 아니라 **편집기(「위험성평가표 편집」 또는 미리보기 「편집」)** 안에 있다. 깊게 보기에서 찾으면 0 이다(261027 운영 실측).
- 「문서 깊게 보기」는 기본 접힘이다(한 화면 계약 390×844 bodyHeight 때문에 PR-0 에서 펼치지 않기로 했다). 펼치지 않고 문서 목록을 찾으면 못 찾는다.
- 관리번호는 「위험성평가-01」 꼴이어야 한다. `RA-press-1` 같은 영문 코드가 보이면 #114·#120 게이트 회귀다.
- 「고객상담센터」·「노동위원회 판정」 같은 법정 복합어 때문에 상담·판정이 본문에 나올 수 있다. 치환하지 않는다(금지어 치환은 복합어를 깨뜨린다). 보고만.
- template 모드 본문은 고정 업체명 없이 입력 현장으로 채워진다. 「세이프건설」 같은 예시 업체명이 보이면 고정값 누출.
