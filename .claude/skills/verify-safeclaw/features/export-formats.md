# 내보내기 4형식

결과에서 「위험성평가표 편집」을 누르면 편집기가 열리고, 접힘 상자 「내보내기」에서 Excel 표 양식(.xlsx)·한글 표 양식(.hwp)을 내려받거나 PDF(브라우저 인쇄)를 띄울 수 있다. 「베타 형식」 아래에 HWPX 제출형 초안·XLS(구형 호환)·DOC·TXT·JSON·CSV·HTML·JPG 가 더 있다.

## Sub-features

- `export-ready` 패널의 `data-server-export-readiness` 가 `ready`(아니면 xlsx·hwp 단추가 비활성).
- `export-xlsx` 「Excel 표 양식(.xlsx)」 → 내려받은 파일 머리가 `PK`(OOXML).
- `export-hwp` 「한글 표 양식(.hwp)」 → 머리가 `D0CF11E0`(OLE, HWP 5).
- `export-pdf-print` 「PDF(브라우저 인쇄)」 → `window.print` 가 정확히 1회 불린다.
- `export-hwpx-beta` 베타 「HWPX 제출형 초안」 → 머리 `PK`.

## How to get to it (user POV)

- 결과 화면의 「위험성평가표 편집」 단추 → 편집기 → 「내보내기」 접힘 상자.
- 「문서 깊게 보기」 안 문서별 조종석의 다운로드(이 지도에서는 위 경로만 구동).

## Driving it with verify.mts

Preconditions:

- `doctor` OK. 익명 컨텍스트. 생성이 끝난 작업공간(`/workspace?q=<합성>`).
- 브라우저 컨텍스트가 `acceptDownloads: true`. `window.print` 는 페이지 로드 전에 호출 수를 세는 스텁으로 바꿔 둔다(실제 인쇄 대화상자는 헤드리스에서 막힌다).

- **편집기 열기.** 「위험성평가표 편집」 클릭 → `data-testid=editor-export-panel` 이 보인다. summary 클릭으로 펼친다. 스크린샷 `01-export-panel.jpg`.
- **준비 상태.** `[data-server-export-readiness]` 속성값을 읽는다. 기대 `ready`.
- **xlsx.** `getByRole("button", { name: /Excel 표 양식/ })` 클릭, `download` 이벤트의 파일을 `downloads/` 에 저장. 크기>0, 첫 2바이트 `PK`.
- **hwp.** `/한글 표 양식/` 클릭 → 저장. 첫 4바이트 `d0cf11e0`.
- **PDF.** 「PDF(브라우저 인쇄)」 클릭 → `__verifyPrintCalls === 1`.
- **HWPX 베타.** 「베타 형식」 접힘 상자를 펼치고 `/HWPX/` 클릭 → 저장, 첫 2바이트 `PK`.
- **증거.** `downloads/` 의 파일 3개와 `02-export-done.jpg`, 콘솔 오류 0. 명령: `… drive --feature export-formats [--base URL]`.

## Gotchas

- 단추가 비활성이면 `data-server-export-readiness` 값을 그대로 적고 FAIL 로 둔다. 기준을 낮추지 않는다(이 경로가 inventory 「닫힘(운영) 미확인 = 내보내기 4형식」을 닫는 유일한 증거다).
- 「Excel 생성 중」·「한글 표 생성 중」은 생성 중 문구다. 단추 이름 정규식은 양쪽을 다 잡는 `/Excel 표 양식|Excel 생성 중/` 이 아니라 **준비 상태의 이름**으로 잡고, 생성 중이면 기다린다.
- 파일 이름은 입력 현장의 회사명 접두사를 쓴다. 이름이 아니라 머리 바이트로 형식을 판정한다.
- PDF 는 파일이 아니라 브라우저 인쇄다. 다운로드 이벤트를 기다리면 영원히 안 온다.
- 운영에서 내려받기는 Vercel 함수 시간을 쓴다. 한 번에 한 형식씩, 재시도는 1회.
