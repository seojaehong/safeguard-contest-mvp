# rhwp 기반 한글 렌더링 전략

## 결론

`rhwp`는 SafeClaw에 계속 붙이는 것이 맞다. 다만 지금 제출 기준에서 주장해야 할 강점은 `공공기관 원본 HWPX 셀 단위 완전 복제`가 아니라 `rhwp 기반 한글 문서 생성·표 렌더링 가능성`과 `HWPX 제출형 초안 생성`이다.

현재 SafeClaw의 HWPX 출력은 `@rhwp/core`를 사용하지만, 구현은 `insertText -> exportHwpx` 수준이다. 그래서 한글 파일은 생성되지만 표, 결재란, 셀 병합, 발주처 지정 양식까지 재현하는 단계는 아니다.

## grill-me 판정

### 1. rhwp를 붙이는가

붙인다. 이미 `@rhwp/core`가 설치되어 있고, SafeClaw의 HWPX 다운로드도 rhwp를 사용한다. 문제는 도입 여부가 아니라 사용 깊이다.

### 2. 지금 바로 강화할 수 있는가

가능하다. `@rhwp/core` 타입 정의와 로컬 스모크 기준으로 다음 API가 확인된다.

- `createTable`: 표 생성
- `insertTextInCell`: 표 셀에 한글 텍스트 삽입
- `exportControlHtml`: 표 컨트롤 HTML 미리보기 생성
- `exportHwp`: HWP 바이너리 생성
- `exportHwpx`: HWPX 패키지 생성
- `renderPageHtml`: 페이지 HTML 렌더링

이번 스모크는 `HWP 표/셀 생성`과 `HWPX 한글 제출형 초안`을 분리해서 검증했다.

### 3. 무엇을 제품에서 말해야 하는가

말해도 되는 것:

- SafeClaw는 rhwp 기반으로 한글 문서 제출형 초안을 생성한다.
- HWP 표/셀 기반 렌더링 가능성을 검증했다.
- 위험성평가표, TBM일지, 작업계획서 등은 문서별 구조를 가진 제출 보조 문서로 출력한다.

말하면 안 되는 것:

- 발주처 원본 HWPX 서식을 1:1로 복제한다.
- 공공기관 제출 양식을 자동으로 완성한다.
- 한컴오피스에서 모든 셀 병합·도장란·페이지 나눔이 원본과 픽셀 단위로 같다.

### 4. 다운로드 가능한 고성능 모델을 붙여야 하는가

이번 제출 기준에서는 우선순위가 낮다. DeepSeek, GLM, Gemma, Nemotron 같은 다운로드 가능 모델은 장기적으로 `온프레미스/보안형 고객`에게 의미가 있지만, 지금의 한글 렌더링 문제를 직접 해결하지 않는다.

권장 구조는 다음이다.

1. Gemini/OpenAI: 입력 정제, 위험요인 구조화, 문서별 작성 계획, 보완 문구 생성.
2. SafeClaw deterministic renderer: 위험성평가표, TBM일지, 작업계획서, 허가서의 고정 서식 렌더링.
3. rhwp: HWP/HWPX 생성 및 한글 문서 렌더링.
4. 추후 로컬 모델: 보안 고객용 사내 설치 옵션.

즉, 고성능 모델은 문서 판단과 구조화에 쓰고, 한글 출력은 rhwp와 deterministic renderer가 맡는다.

## 로컬 검증 결과

검증 명령:

```powershell
npm.cmd run hwpx:capability
```

생성 산출물:

- `evaluation/2026-05-06-rhwp-rendering-grill/rhwp-structured-table.hwp`
- `evaluation/2026-05-06-rhwp-rendering-grill/rhwp-table-preview.html`
- `evaluation/2026-05-06-rhwp-rendering-grill/rhwp-text-submit-draft.hwpx`
- `evaluation/2026-05-06-rhwp-rendering-grill/rhwp-rendering-capability-report.json`

검증 요약:

- HWP 표/셀 문서 생성 성공.
- 표 셀에 한글 안전 문구 삽입 성공.
- 표 컨트롤 HTML 미리보기 생성 성공.
- HWP export self-verify 성공.
- HWPX 패키지 안에 한글 본문과 확인/서명란 포함 확인.

## SafeClaw 적용 계획

### 제출 전 기준

- UI 문구는 `HWPX(rhwp)` 또는 `HWPX 제출형 초안`으로 유지한다.
- 다운로드 설명에는 `원본 한글 서식 1:1 복제 아님`을 유지한다.
- 심사 자료에는 `rhwp 기반 한글 렌더링 검증` 산출물을 별도 근거로 제시한다.

### 상용 SaaS v1 기준

- 위험성평가표, TBM일지, 작업계획서, 허가/점검 문서는 문서별 table schema를 만든다.
- HWP export는 표/셀 기반 제출형 문서 증거로 사용한다.
- HWPX export는 한글 파일 교환용 초안으로 사용한다.

### v1.1 기준

- 고객사 원본 HWPX/XLSX 업로드.
- 필드 매핑 프로파일 생성.
- 셀 단위 QA와 한컴오피스 호환성 리포트.
- verified template만 `고객사 서식 렌더링`으로 표시.

## 추천 카피

제품 UI:

> HWPX 제출형 초안. 원본 서식 복제 전, 현장 검토 후 사용하세요.

심사 설명:

> SafeClaw는 rhwp 기반으로 한글 문서 출력 경로를 확보했습니다. 현재는 제출 보조 초안과 표 기반 HWP 렌더링을 검증했고, 고객사 원본 서식은 온보딩 단계에서 필드 매핑 후 반복 렌더링하는 구조로 확장합니다.

