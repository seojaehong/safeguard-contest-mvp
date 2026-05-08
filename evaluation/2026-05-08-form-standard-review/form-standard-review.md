# SafeClaw 서식 기준 재평가

Generated: 2026-05-08

## 판정

- 제출 데모 기준: pass_with_notice
- 유료 SaaS / 공공기관 제출 보조 기준: blocked
- 핵심 원인: Gemini가 개입하지 않은 것이 아니라, Gemini 결과가 구조화된 서식 데이터가 아니라 긴 자유 텍스트로 생성되고, export 단계에서 이를 다시 추정 파싱하고 있음.

## 확인 범위

- Production: https://www.safeclaw.kr
- Playwright 확인 라우트: `/`, `/workspace`, `/documents`, `/evidence`, `/knowledge`
- 코드 확인 파일:
  - `lib/ai-deliverables.ts`
  - `lib/hwp-table-builder.ts`
  - `lib/xlsx-builder.ts`
  - `app/api/export/pdf/route.ts`
  - `app/api/export/hwp/route.ts`
  - `lib/safety-document-rubric.ts`
  - `scripts/safeclaw_quality_matrix_runner.mjs`

## 주요 증거

### 1. Gemini는 사용 중이지만, 결과 스키마가 서식용이 아님

`lib/ai-deliverables.ts`는 Gemini 기본 모델을 사용하고, 위험성평가표, 작업계획서, TBM, 안전보건교육 기록을 생성한다. 그러나 반환 스키마는 `riskAssessmentDraft: string` 같은 문자열 중심이다.

이 구조에서는 위험성평가표의 단위작업, 유해위험요인, 가능성, 중대성, 위험성, 현재 조치, 추가 조치, 담당자, 기한, 확인자 같은 필드를 강제할 수 없다.

### 2. export는 공식 서식 행이 아니라 텍스트를 다시 표로 추정함

`app/api/export/pdf/route.ts`의 위험성평가 렌더러는 텍스트 행에서 키워드로 위험요인과 조치사항을 찾고, 4M과 위험성 값을 기본 문구로 채운다.

예: `Man/Machine/Media/Management`, `추락·충돌·전도 등`, `상/중/하`

즉, 새 입력에서 문서 품질이 떨어지는 이유는 입력 내용을 공식 위험성평가 row로 먼저 구조화하지 않기 때문이다.

### 3. HWP/XLS는 기술적으로 생성되지만, 서식 의미 구조가 얕음

`lib/hwp-table-builder.ts`는 문서 유형별 컬럼을 분리하지만 위험성평가표도 `구분 / 항목 / 내용 / 확인` 수준이다.

`lib/xlsx-builder.ts`는 더 나은 구조를 갖지만, 위험성평가 필수 컬럼이 아직 충분하지 않다. 현재 기준으로는 제출형 초안에 가깝고, 공공기관 안전서류 원본 수준이라고 보기 어렵다.

### 4. 현재 품질 게이트는 키워드 존재 검증에 가깝다

`lib/safety-document-rubric.ts`와 `scripts/safeclaw_quality_matrix_runner.mjs`는 문서에 필요한 키워드가 들어갔는지를 주로 확인한다. 실제 서식의 행 완결성, 위험성 산정 논리, 대책의 구체성, 담당/기한/확인 구조까지는 검증하지 못한다.

## 직접 답변

### "이 과정에 제미나이는 개입을 안 한 거냐?"

아니다. Gemini는 개입하고 있다. 다만 현재 역할은 "서식 데이터 생성기"가 아니라 "문서 초안 작성기"에 가깝다.

### "왜 이런 수준이 나오냐?"

현재 파이프라인은 다음 순서다.

1. 사용자가 자연어 입력
2. Gemini가 긴 텍스트 초안 생성
3. export 코드가 줄 단위 텍스트를 다시 표처럼 추정
4. HWP/XLS/PDF가 추정된 generic table로 생성

이 구조에서는 예시 입력은 그럴듯하게 보이지만, 실제 현장 문장에서는 데이터가 꼬이고 서식 품질이 떨어진다.

## 개선 방향

### P0. Canonical safety form schema 도입

위험성평가표는 문자열이 아니라 다음 같은 구조로 생성해야 한다.

```ts
type RiskAssessmentRow = {
  process: string;
  task: string;
  hazard: string;
  hazardType: "fall" | "caught" | "collision" | "fire" | "chemical" | "heat" | "other";
  fourM: {
    man: boolean;
    machine: boolean;
    media: boolean;
    management: boolean;
  };
  currentControls: string[];
  likelihood: 1 | 2 | 3 | 4 | 5;
  severity: 1 | 2 | 3 | 4 | 5;
  riskLevel: "low" | "medium" | "high";
  additionalControls: string[];
  owner: string;
  due: string;
  verification: string;
};
```

### P0. Gemini는 JSON row만 생성하게 제한

Gemini prompt는 더 이상 "본문을 작성하라"가 아니라 "검증 가능한 JSON rows를 반환하라"가 되어야 한다.

필수 row 수, 필수 컬럼, 금지 문구, 누락 시 error reason을 schema로 강제해야 한다.

### P0. 모든 출력은 같은 schema에서 파생

PDF/HWP/XLS/화면 미리보기는 모두 같은 `RiskAssessmentRow[]`, `TbmRow[]`, `PermitChecklistRow[]`에서 파생해야 한다.

현재처럼 화면은 텍스트, XLS는 파싱, HWP는 별도 generic row를 쓰면 계속 품질이 흔들린다.

### P1. 문서별 품질 게이트를 키워드가 아니라 row completeness로 변경

위험성평가표는 다음을 검사해야 한다.

- 위험요인 3개 이상
- 각 위험요인별 4M 매핑
- 가능성/중대성/위험성 산정
- 현재조치와 추가조치 구분
- 담당자/기한/확인 방식
- TBM/교육 반영 문장 연결

### P1. TBM은 위험성평가 row와 기상 API에서만 생성

TBM 일지는 위험성평가의 주요 위험요인과 기상 API 결과를 직접 참조해야 한다. 별도 자유 텍스트 생성으로 가면 문서 간 불일치가 생긴다.

## 결론

현재 SafeClaw는 공공데이터와 AI를 엮은 제출 데모로는 강하지만, "실제 사업장 서식으로 바로 쓰는 SaaS" 기준에서는 아직 blocked다.

가장 확실한 개선은 모델을 더 비싼 것으로 바꾸는 것이 아니라, 모델 출력 단위를 공식 서식 row schema로 바꾸는 것이다. 그 다음에 고급 모델을 초반 구조화 단계에 쓰면 효과가 난다.
