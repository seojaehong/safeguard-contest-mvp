# SafeGuard LLM Wiki 운영 계획

## 결론

SafeGuard의 안전지식 wiki는 `LLM API`나 `Obsidian`이 없어도 작동해야 한다. 제출·운영 기준의 핵심은 LLM이 아니라 `공식 출처 기반 seed DB`, `문서 반영 위치`, `원문 URL`, `검증 리포트`다.

LLM API와 Obsidian은 필수 런타임 의존성이 아니라 선택적 운영 도구로 둔다.

- LLM API: 자료 요약, wiki 갱신 제안, 충돌 감지, 문서 반영 문구 후보 생성에 사용한다.
- Obsidian: 사람이 wiki를 읽고 편집하는 지식관리 UI로만 사용한다.
- 제품 런타임: JSON seed DB와 markdown wiki를 읽어 deterministic하게 근거를 매칭한다.

## 왜 LLM API 없이도 되어야 하나

실제 현장 문서 생성에서 매 요청마다 LLM이 wiki 전체를 다시 읽고 판단하면 다음 문제가 생긴다.

- 응답 속도가 느려진다.
- 같은 입력에서도 근거 선택이 흔들릴 수 있다.
- 법령·KOSHA 근거가 “요약 문장”으로만 남으면 출처 신뢰가 약해진다.
- API 장애 시 제품이 멈춘다.

따라서 안전지식 레이어는 먼저 DB처럼 작동해야 한다.

```text
질문 입력
  -> 위험 키워드 추출
  -> data/safety-knowledge/*.json 매칭
  -> 원문 URL + 통제대책 + 문서 반영 위치 반환
  -> 필요 시 LLM이 문서 문장으로 자연화
```

## 현재 seed DB의 역할

현재 추가된 `data/safety-knowledge/`는 SafeGuard의 1차 안전지식 원천이다.

```text
data/safety-knowledge/
  manifest.json          전체 생성 정보와 정책
  hazards.json           위험요인별 키워드, 통제대책, 문서 반영 위치
  legal-map.json         법령 근거 초안 매핑
  kosha-resources.json   KOSHA/MOEL/법제처 공식 출처
  accident-cases.json    유사 재해사례 seed
  training-map.json      교육 추천 seed
  templates.json         서식별 필수 섹션
  live-supplements.json  KOSHA OpenAPI live 수집 시도 결과
```

이 DB는 다음 질문에 답한다.

- 이 작업에서 어떤 위험요인이 중요한가?
- 어떤 공식자료를 근거로 붙일 수 있는가?
- 위험성평가, TBM, 안전교육 중 어디에 반영해야 하는가?
- 어떤 통제대책을 기본값으로 제안해야 하는가?
- 어떤 후속 교육이나 외국인 안내가 필요한가?

## markdown wiki의 역할

`knowledge/wiki/`는 사람이 읽는 운영 지식층이다.

```text
knowledge/wiki/
  index.md
  hazards/*.md
  forms/*.md
```

사용 목적:

- 발표/심사 때 “공식자료 기반 지식층이 있다”는 증거
- 팀 내부에서 위험요인별 기준을 빠르게 확인
- 추후 LLM이 wiki 갱신 제안을 만들 때 비교 대상
- Obsidian으로 열어 문서 관계를 탐색

중요한 점은, 제품 런타임은 markdown을 원문처럼 믿지 않는다. 런타임은 JSON seed DB를 우선 사용하고, markdown은 설명·운영·검수용이다.

## Obsidian 연동 필요 여부

필수는 아니다.

### 지금은 없어도 됨

- 현재 repo 안에서 markdown으로 이미 관리 가능하다.
- Git diff로 변경 이력을 추적할 수 있다.
- `knowledge/SCHEMA.md`, `knowledge/log.md`가 있으므로 운영 규칙도 남는다.

### 붙이면 좋은 경우

- 안전자료가 수백 개 이상으로 늘어난다.
- 위험요인, 법령, 재해사례, 서식 사이의 링크를 사람이 시각적으로 보고 싶다.
- 발표자료나 내부 검수 때 그래프 뷰를 쓰고 싶다.

### 권장 방식

Obsidian vault를 별도로 만들지 말고, repo의 `knowledge/` 폴더를 그대로 Obsidian에서 연다.

```text
Obsidian Vault = C:\Users\iceam\dev\safeguard-contest-mvp\knowledge
```

별도 동기화나 플러그인은 지금 필요 없다.

## LLM API 사용 위치

LLM API는 런타임 필수 조건이 아니라 운영 보조로 둔다.

### 1. 수집 후 정리

공식자료 원문 또는 API 응답을 받아 아래 필드로 정리한다.

```json
{
  "title": "...",
  "sourceUrl": "...",
  "appliesTo": ["riskAssessment", "tbmBriefing"],
  "summary": "...",
  "controls": ["..."],
  "caution": "원문 확인 후 사용"
}
```

### 2. wiki 갱신 제안

LLM이 직접 파일을 덮어쓰지 않고, 제안 diff를 만든다.

```text
input: raw source + existing wiki page
output: proposed patch + reason + source URL
```

### 3. 문서 문장 자연화

seed DB의 통제대책을 현장 문서 문장으로 바꾼다.

예:

```text
seed: 강풍·우천 시 작업중지 판단자 지정
문서 문장: 관리감독자는 작업 전 풍속과 강수 상태를 확인하고, 강풍 또는 미끄럼 위험이 높으면 작업중지 여부를 판단한다.
```

### 4. 충돌 감지

새로 수집한 자료가 기존 wiki와 다를 때 “확인 필요”로 표시한다.

```text
기존: TBM 기록을 교육 증빙으로 활용 가능
신규: 특정 조건에서만 인정
결론: 단정 문구를 피하고 조건부 문구로 유지
```

## 런타임 설계

### Step 1. 질문에서 위험요인 후보 추출

`lib/safety-knowledge.ts`의 `findSafetyKnowledgeHazards(question)`을 사용한다.

```ts
const hazards = findSafetyKnowledgeHazards(question);
```

### Step 2. 공식 출처 매핑

각 hazard의 `sourceIds`를 `kosha-resources.json`과 연결한다.

```text
hazard.sourceIds
  -> kosha-resources.json
  -> title, url, summary, appliesTo
```

### Step 3. 문서 반영 위치 결정

`primaryDocuments`를 기준으로 위험성평가, TBM, 교육기록, 외국인 안내문 중 어디에 반영할지 결정한다.

### Step 4. LLM에게 넘길 context 최소화

LLM에는 전체 wiki가 아니라 매칭된 항목만 넘긴다.

```json
{
  "matchedHazards": ["fall-scaffold", "forklift-traffic"],
  "controls": ["...", "..."],
  "sources": [{"title": "...", "url": "..."}],
  "templates": ["risk-assessment", "tbm"]
}
```

### Step 5. 결과에 원문 URL 보존

LLM이 만든 문장도 최종 UI에서는 원문 URL과 함께 표시한다.

## 구현 단계

### Phase 1. 조회 레이어 연결

- `/api/ask`에서 `findSafetyKnowledgeHazards(question)` 호출
- `AskResponse.externalData.safetyKnowledge` 추가
- 근거 UI에 `공식자료 기반 seed` 섹션 추가
- 문서팩 생성 프롬프트에 matched hazards와 controls 추가

### Phase 2. wiki 갱신 스크립트

- `npm.cmd run knowledge:seed` 유지
- `npm.cmd run knowledge:audit` 추가
- 품질 게이트:
  - source URL 있음
  - appliesTo 있음
  - controls 있음
  - caution 있음
  - secret 미포함

### Phase 3. LLM 보조 갱신

- `npm.cmd run knowledge:propose` 추가
- LLM이 새 공식자료를 기존 wiki와 비교
- 자동 반영하지 않고 `evaluation/safety-knowledge-seed/proposals/`에 patch 후보 저장

### Phase 4. Obsidian 선택 연동

- `knowledge/` 폴더를 vault로 열기
- wiki 문서 사이에 내부 링크 추가
- 그래프 뷰로 위험요인-법령-서식 관계 확인

## 제품 표현 방식

사용자에게는 “LLM wiki”라고 말하지 않는다. 더 신뢰감 있는 표현은 아래다.

- 공식자료 기반 안전지식 베이스
- KOSHA·법령·재해사례 seed 근거
- 위험요인별 문서 반영 기준
- 현장 검토 후 사용하는 안전 문서 초안

## 제출 기준에서의 메시지

발표에서는 이렇게 말한다.

> SafeGuard는 실시간 API만 호출하는 서비스가 아니라, KOSHA·법제처·고용노동 자료를 위험요인과 서식별로 정리한 안전지식 베이스를 함께 사용합니다. 그래서 API가 느리거나 일부 자료가 비어 있어도, 공식 출처 기반의 일관된 위험성평가·TBM·교육 문서 초안을 유지할 수 있습니다.

## 최종 판단

- LLM API는 있으면 좋지만 필수는 아니다.
- Obsidian은 있으면 좋지만 필수는 아니다.
- 필수는 `공식 출처 보존`, `문서 반영 위치`, `품질 게이트`, `재생성 가능한 seed DB`다.
- 지금 단계에서는 JSON seed DB를 런타임에 연결하는 것이 가장 중요하다.
