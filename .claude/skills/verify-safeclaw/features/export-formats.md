# 내보내기 4형식

결과에서 「위험성평가표 편집」을 누르면 편집기가 열리고, 접힘 상자 「내보내기」에서 Excel 표 양식(.xlsx)·한글 표 양식(.hwp)을 내려받거나 PDF(브라우저 인쇄)를 띄울 수 있다. 「베타 형식」 아래에 HWPX 제출형 초안·XLS(구형 호환)·DOC·TXT·JSON·CSV·HTML·JPG 가 더 있다.

## Sub-features

- `export-ready` 패널의 `data-server-export-readiness` 가 `ready`(아니면 xlsx·hwp 단추가 비활성).
- `export-xlsx` 「Excel 표 양식(.xlsx)」 → 내려받은 파일 머리가 `PK`(OOXML).
- `export-hwp` 「한글 표 양식(.hwp)」 → 머리가 `D0CF11E0`(OLE, HWP 5).
- `export-pdf-print` 「PDF(브라우저 인쇄)」 → 인쇄용 **팝업 창**이 열리고(처음 제목 「SafeClaw PDF 준비 중」), 서버 인쇄본 HTML 로 바뀐 뒤(제목 = 문서명) 팝업에서 `window.print` 가 1회 불린다.
- `export-hwpx-beta` 베타 「.hwpx 텍스트 초안」(생성 중 「HWPX 생성 중」) → 브라우저 안 rhwp 로 만든 파일, 머리 `PK`.

## How to get to it (user POV)

- 결과 화면의 「위험성평가표 편집」 단추 → 편집기 → 「내보내기」 접힘 상자.
- 「문서 깊게 보기」 안 문서별 조종석의 다운로드(이 지도에서는 위 경로만 구동).

## Driving it with verify.mts

Preconditions:

- `doctor` OK. 익명 컨텍스트. 생성이 끝난 작업공간(`/workspace?q=<합성>`).
- 브라우저 컨텍스트가 `acceptDownloads: true`. `window.print` 는 **컨텍스트** init script 로 호출 수를 세는 스텁으로 바꿔 둔다(팝업에도 적용되어야 한다. 실제 인쇄 대화상자는 헤드리스에서 막힌다).

- **편집기 열기.** 「위험성평가표 편집」 클릭 → `data-testid=editor-export-panel` 이 보인다. summary 클릭으로 펼친다. 스크린샷 `01-export-panel.jpg`.
- **준비 상태.** `[data-server-export-readiness]` 는 `checking` 으로 시작한다. 최대 30초 기다린 값이 `ready`.
- **xlsx.** `getByRole("button", { name: /Excel 표 양식/ })` 클릭, `download` 이벤트의 파일을 `downloads/` 에 저장. 크기>0, 첫 2바이트 `PK`.
- **hwp.** `/한글 표 양식/` 클릭 → 저장. 첫 4바이트 `d0cf11e0`.
- **PDF.** `context.waitForEvent("page")` 를 걸고 「PDF(브라우저 인쇄)」 클릭 → 팝업이 잡힌다. 팝업 제목이 「SafeClaw PDF 준비 중」을 벗어나 문서명이 되고 팝업의 `__verifyPrintCalls >= 1`(60초 내). 팝업 스크린샷 `pdf-popup.jpg`.
- **HWPX 베타.** 「베타 형식」 접힘 상자를 펼치고 `/hwpx/i` 클릭 → 저장(150초, rhwp wasm 첫 로드), 첫 2바이트 `PK`.
- **증거.** `downloads/` 의 파일 3개(xlsx·hwp·hwpx)와 `pdf-popup.jpg`·`export-done.jpg`, 콘솔 오류 0. 명령: `… drive --feature export-formats [--base URL]`.

## Gotchas

- 단추가 비활성이면 `data-server-export-readiness` 값을 그대로 적고 FAIL 로 둔다. 기준을 낮추지 않는다(이 경로가 inventory 「닫힘(운영) 미확인 = 내보내기 4형식」을 닫는 유일한 증거다).
- 「Excel 생성 중」·「한글 표 생성 중」은 생성 중 문구다. 단추 이름 정규식은 양쪽을 다 잡는 `/Excel 표 양식|Excel 생성 중/` 이 아니라 **준비 상태의 이름**으로 잡고, 생성 중이면 기다린다.
- 파일 이름은 입력 현장의 회사명 접두사를 쓴다. 이름이 아니라 머리 바이트로 형식을 판정한다.
- PDF 는 파일이 아니라 **팝업 창 + 브라우저 인쇄**다. 다운로드 이벤트를 기다리면 영원히 안 오고, 원래 페이지의 `window.print` 를 세면 0 이다(팝업에서 부른다). 팝업이 막히면 앱은 HTML 내려받기로 대체한다 — 그때는 `download` 이벤트가 온다.
- 베타 HWPX 단추 이름은 「.hwpx 텍스트 초안」(소문자)이다. `/HWPX/`(대문자만)로 잡으면 못 찾는다. 261027 운영 실측에서 wasm 포함 수십 초 걸렸다.
- 운영에서 내려받기는 Vercel 함수 시간을 쓴다. 한 번에 한 형식씩, 재시도는 1회.
