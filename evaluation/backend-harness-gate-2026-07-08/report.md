# SafeClaw Backend Harness Gate Review

작성일: 2026-07-08

## 결론

SIF 임베딩은 완료된 단계가 아니라 승인 게이트에 들어온 상태다. 현재 완료된 것은 `safety_reference_items` 기반 SIF 코퍼스 정제와 업로드 가드이며, 실제 OpenAI embedding 생성, `safety_reference_embeddings` 업로드, vector 검색 RPC 연결은 아직 실행하지 않았다.

이번 작업은 DB schema 변경 없이 아래 표면을 보강했다.

- 작업팩 학습/메모리 export API 추가: `/api/workpacks/[id]/learning-export`
- MD/JSONL export가 `workpack`, `reference`, `improvement`, `ack` 이벤트를 보존
- Before/After vision 분석 결과 중 `summary`, `ocrText`를 하네스 프롬프트와 export에 포함
- 작업팩 operation context에 실제 `created_at`을 포함해 “언제 한 작업인지”를 export에 반영
- `/workspace` 기본 테마를 Day로 전환하고, Linear식 구조와 현장용 화이트 가독성 사이의 중간안을 적용
- 관리자 저장 후 `개선 메모리 MD`, `운영 JSONL` 다운로드 버튼을 이력 카드에 노출

## 현재 상태 판정

### SIF / 임베딩

- 완료: `safety_reference_items.item_type = "sif-case"` 조회 및 코퍼스 생성
- 완료: `evaluation/sif-embedding-gate/report.json` 기준 SIF 6,033건 중 header 1건 제외, corpus 6,032건
- 완료: `scripts/prepare_sif_embedding_corpus.mjs`의 `--upload --approved-upload` 가드
- 미완료: embedding 생성, DB 업로드, vector RPC, runtime hybrid retrieval
- 승인 필요: `010_commercial_operations.sql` 적용 또는 embedding-only migration 분리

### Vision / OCR

- 서버 경로 존재: `app/api/workpacks/[id]/improvements/route.ts`
- 모델 어댑터 존재: `lib/photo-vision-analysis.ts`
- 동작: Before/After 파일이 모두 있고 `OPENAI_API_KEY`가 있으면 OpenAI Responses API에 이미지 2장을 전달
- 결과 저장 위치: `workpack_improvements.analysis_payload`
- 보강: 하네스 메모리와 learning export가 `analysis_payload.summary`, `analysis_payload.ocrText`를 회수
- 남은 일: 사용자-facing `/workspace` localStorage UI를 실제 workpack 개선사항 API로 연결

### 온톨로지

- 현재 `/ontology`는 published graph를 list + hover card로 보여준다.
- LangGraph/Habermas Machine 구현은 이번 게이트의 필수 조건이 아니다.
- 지금 병목은 agent orchestration보다 DB 근거 고정, 개선 이력 회수, 승인된 지식 승격이다.
- 다음 UI 후보는 Obsidian식 hover card + 리스트 기반 탐색을 유지하면서 작업팩 하네스 패킷과 연결하는 것이다.

### 당일 작업 메모리

새 API:

```text
GET /api/workpacks/:id/learning-export?format=markdown
GET /api/workpacks/:id/learning-export?format=jsonl
```

포함 데이터:

- 작업팩 id, 생성시각, 입력문
- safety reference / SIF / KOSHA 근거
- 개선사항 후보, 반영 문서, source type
- vision summary, OCR text
- 작업자 열람 확인 이력

이 export는 제품 안에서 “학습”이라는 표현 대신 “현장 개선 이력 메모리”, “운영 지식 베이스 갱신 후보”로 취급한다.

## 기능 테스트: 결과값 변화

같은 입력값으로 배포 버전 `https://www.safeclaw.kr/api/ask`를 직접 비교했다.

입력:

```text
세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보. 추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘.
```

산출물:

- `evaluation/backend-harness-gate-2026-07-08/live-output-comparison.json`
- `evaluation/backend-harness-gate-2026-07-08/live-functional-probe-report.json`
- `evaluation/backend-harness-gate-2026-07-08/live-enhanced-functional-probe-report.json`
- `evaluation/backend-harness-gate-2026-07-08/functional-probe-report.json`

판정:

- 실제 결과값은 달라졌다. `template`과 `enhanced`의 주요 문서 4종은 모두 hash가 달라졌고, 위험성평가표는 1,158자, TBM 브리핑은 799자, TBM 기록은 1,639자, 안전보건교육 기록은 1,194자 늘었다.
- `template`은 `mode: mock`, `AI_MODE=template`, 안전지식 DB 근거 0건이다.
- `enhanced`는 `mode: live`, `safetyReference.mode: live`, Supabase 안전 지식 DB 8건을 runtime context에 넣었다.
- `enhanced` 근거 예시는 `D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정`, `B-E-17-2026 도장 공정에서의 화재·폭발위험방지에 관한 기술지원규정`, `G-67-2011 건물 외벽 청소 작업에 관한 기술지침`, SIF 마감공사 사례다.
- 다만 현재 변화는 “임베딩/vector retrieval” 결과가 아니다. 현재 runtime은 Supabase/KOSHA/SIF 텍스트·태그 검색과 하네스 컨텍스트 주입으로 바뀐 것이다.
- 문서 본문에는 KOSHA 코드와 작업중지·비계·안전대 문구가 더 강하게 반영되지만, `내부 안전지식 DB 반영` appendix 문자열은 이번 라이브 응답에서 별도 섹션으로 노출되지 않았다. 즉 UX에는 “근거/품질 패널”로 보여주는 편이 더 적합하다.
- 로컬 worktree는 `.env.local`이 없고, 메인 repo `.env.local` 기준 Supabase key가 현재 API와 맞지 않아 `/api/safety-reference/search`가 503/401로 떨어졌다. 로컬에서 DB 반영 품질을 재현하려면 배포와 같은 Supabase credential 동기화가 먼저 필요하다.

시연 멘트 기준:

```text
현재 1차는 임베딩 검색이 아니라 DB 하네스 검색 단계입니다. 같은 입력에서도 template은 고정 문서, enhanced는 KOSHA/SIF/Supabase 근거 8건을 먼저 고정한 뒤 문서화해 결과가 실제로 달라집니다. 임베딩은 2차 승인 게이트로 분리돼 있습니다.
```

## 모델 전환 테스트

산출물:

- `evaluation/backend-harness-gate-2026-07-08/model-switch-check.json`

판정:

- 구조화 문서 생성 경로는 `AI_DELIVERABLES_PROVIDER=claude` 또는 `anthropic`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-opus-4-8` 조합을 받도록 열려 있다.
- 기본 Anthropic 모델은 `claude-sonnet-5`다.
- `foreign`, `free`처럼 긴 산출물은 예산상 `claude-haiku-4-5`로 라우팅된다. 따라서 Opus 전환 효과는 위험성평가/TBM/교육기록 같은 핵심 structured 문서에서 먼저 비교해야 한다.
- 현재 확인된 로컬 env에는 `ANTHROPIC_API_KEY`, `AI_DELIVERABLES_PROVIDER`, `ANTHROPIC_MODEL`이 없어 실제 Opus 호출 smoke는 수행하지 않았다.
- Claw chat route는 이제 Anthropic SDK 필수 경로가 아니라 OpenClaw `safeclaw` profile을 우선 호출한다. 이 경로는 로컬/시연 runtime의 OpenAI OAuth 세션을 사용한다.
- Anthropic/Opus 설정은 구조화 문서 생성 품질 비교용 옵션으로 남고, 제품 안의 “클로 채팅” 기본 경로와는 분리된다.

시연 전 권장 smoke:

```powershell
$env:AI_DELIVERABLES_PROVIDER='claude'
$env:ANTHROPIC_MODEL='claude-opus-4-8'
npm.cmd test -- tests/ai-provider-policy.test.ts tests/ai-doc-budget.test.ts
```

실제 API 품질 비교는 Anthropic key가 있는 환경에서 동일 입력 1회만 수행한다. 지연시간과 provider 지원 여부가 먼저 확인되어야 한다. 단, 이 비교는 Claw chat이 아니라 문서 생성 provider 비교다.

Vercel env 확인:

- 메인 repo에는 Vercel project link가 있다.
- 현재 로컬 Vercel CLI 세션에는 credential이 없어 `vercel env ls`는 `No existing credentials found`로 실패했다.
- Vercel dashboard에 `ANTHROPIC_API_KEY`가 이미 있어도, 구조화 문서 생성을 Claude/Opus로 돌리려면 `AI_DELIVERABLES_PROVIDER=claude`와 `ANTHROPIC_MODEL=claude-opus-4-8` 설정이 추가로 필요하다.
- 제품 내 Claw chat route는 이 Anthropic 설정을 쓰지 않고 OpenClaw/OpenAI OAuth를 기본으로 사용한다.

## OpenClaw OAuth 확인

산출물:

- `evaluation/backend-harness-gate-2026-07-08/openclaw-oauth-check.json`

확인 명령:

```powershell
openclaw --profile safeclaw models status
openclaw --profile safeclaw mcp probe safeclaw
```

판정:

- `safeclaw` profile에서 OpenClaw CLI가 동작한다.
- OpenAI OAuth는 usable 상태다.
- `safeclaw` MCP probe는 4 tools를 반환했다.
- 단, config는 2026.6.11로 작성됐고 현재 command는 2026.6.5로 실행되어 version warning이 있다. 시연 전에는 PATH/Gateway version을 맞추는 것이 좋다.

Claw chat route 변경:

- `app/api/agent/chat` 기본 provider는 `openclaw`다.
- 기본 실행은 `openclaw --profile safeclaw agent --agent main --local -m <prompt>` 형태다. Windows Node runtime에서는 npm shim을 shell로 호출하지 않고 `node <openclaw.mjs>`로 안전하게 우회한다.
- prompt에는 `run_safeclaw_harness_agent` 우선 호출과 DB harness packet 밖 근거 생성 금지 원칙을 주입한다.
- Vercel 서버에서 이 경로를 쓰려면 OpenClaw runtime/Gateway가 해당 서버 환경에도 있어야 한다. 로컬 사용자 OAuth profile은 Vercel 함수가 자동으로 읽을 수 없다.
- 로컬 route smoke: `evaluation/backend-harness-gate-2026-07-08/local-openclaw-chat-route-smoke.json`
  - 대상: `http://127.0.0.1:3111/api/agent/chat`
  - 결과: HTTP 200, OpenClaw OAuth start/ok 이벤트, `final` 이벤트, error 없음
  - 응답 preview: `OpenClaw OAuth route OK`

## 기본 생성 모드 변경

- `runAsk()`의 모드 생략 기본값을 `template`에서 `enhanced`로 바꿨다.
- 명시적으로 `template`을 보내는 테스트/데모 경로는 계속 유지한다.
- 잘못된 mode 값이 들어오면 `template`이 아니라 `enhanced`로 떨어진다.
- 목적: 워크스페이스 버튼뿐 아니라 `/api/ask`, `/api/ask/stream`, `/ask` 등 서버 호출자가 mode를 생략해도 DB/KOSHA/SIF 하네스 경로가 기본이 되게 한다.

### UI / UX 중간안

- 기본 `/workspace`는 화이트 Day 테마로 진입한다.
- `?theme=night`는 리니어 다크 감성 확인용 보조 테마로 남겼다.
- 사이드 메뉴는 얇은 선만 있는 영역이 아니라 카드형 그룹으로 묶어, 메뉴 간격과 가시성을 개선했다.
- 입력 칩은 연한 블루/회색 텍스트를 줄이고, 화이트 화면에서 읽히는 진회색 계열로 정리했다.
- 문서/공유/개선 표면은 같은 워크스페이스 토큰을 따라 “작업 문서”처럼 보이도록 맞췄다.
- 모바일에서는 사이드바와 본문을 1열로 접어 가로 스크롤 없이 입력 화면을 확인한다.

브라우저 검수 산출물:

- `evaluation/backend-harness-gate-2026-07-08/screenshots/workspace-desktop-day.png`
- `evaluation/backend-harness-gate-2026-07-08/screenshots/workspace-mobile-day.png`
- `evaluation/backend-harness-gate-2026-07-08/screenshots/workspace-desktop-night.png`
- `evaluation/backend-harness-gate-2026-07-08/screenshots/workspace-desktop-night-scrolled.png`
- `evaluation/backend-harness-gate-2026-07-08/screenshots/workspace-visual-check.json`

회귀 수정:

- Night 테마에서 상단 workbench topbar가 sticky 상태로 본문과 사이드 메뉴를 덮던 문제를 제거했다.
- `tests/workspace-layout-regression.test.ts`를 추가해 `/workspace?theme=night` 스크롤 후 topbar가 viewport 밖으로 올라가 메뉴와 본문을 가리지 않는지 검증한다.
- 스크롤 캡처 기준 topbar는 `top -222 / bottom -162`로 화면 밖에 위치한다.

## 다음 승인 게이트

승인 전 실행 금지:

```powershell
npm.cmd run knowledge:sif-embedding-corpus -- --embed --upload --approved-upload
```

승인 시 필요한 결정:

- `010_commercial_operations.sql` 전체 적용 vs embedding-only migration 분리
- `safety_reference_embeddings`에 HNSW/IVFFLAT vector index 추가
- query embedding RPC 추가
- `searchSafetyReferences()`의 embedding-first 또는 hybrid retrieval 전략
- OpenAI key / Supabase service role / migration 적용 순서

## 검증

```powershell
npm.cmd test -- tests/commercial-harness.test.ts tests/photo-vision-analysis.test.ts tests/workpack-commercial.test.ts tests/commercial-migration.test.ts tests/mcp-tools.test.ts tests/ai-provider-policy.test.ts tests/ai-doc-budget.test.ts
npm.cmd test -- tests/run-ask-mode.test.ts tests/openclaw-chat.test.ts tests/agent-loop.test.ts tests/mcp-token-service.test.ts tests/mcp-tools.test.ts tests/commercial-harness.test.ts tests/ai-provider-policy.test.ts tests/ai-doc-budget.test.ts
npm.cmd test -- tests/workspace-layout-regression.test.ts
npm.cmd run typecheck
npm.cmd run build
```

결과:

- commercial/model test files: 7 passed
- commercial/model tests: 55 passed
- OpenClaw/default-mode related test files: 8 passed
- OpenClaw/default-mode related tests: 88 passed
- final focused test files: 9 passed
- final focused tests: 90 passed
- layout regression test file: 1 passed
- layout regression tests: 1 passed
- workspace layout regression test passed
- typecheck passed
- build passed
- Playwright visual check passed: desktop/mobile Day, desktop Night, no horizontal overflow
