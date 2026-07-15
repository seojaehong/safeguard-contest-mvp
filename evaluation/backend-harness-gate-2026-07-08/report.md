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
- 완료: `evaluation/sif-embedding-gate/sif-embedding-batch-manifest.json` 생성
- 완료: 100건 단위 61개 batch로 embedding/upload 전 승인 manifest 고정
- 완료: `scripts/prepare_sif_embedding_corpus.mjs`의 `--upload --approved-upload` 가드
- 완료: `scripts/prepare_sif_embedding_corpus.mjs`의 `--batch-size` 기반 OpenAI embedding / Supabase upsert batch 처리
- 완료: `010_commercial_operations.sql` 초안에 `match_safety_reference_embeddings` RPC 계약과 HNSW cosine index 추가
- 완료: `searchSafetyReferences()`에 feature-flag 기반 vector+ranked hybrid retrieval 경계 추가
- 기본값: `SAFETY_REFERENCE_VECTOR_SEARCH=1`이 없으면 vector 검색은 호출하지 않고 기존 ranked RPC / REST 검색으로 fallback
- 미완료: embedding 생성, DB 업로드, 운영 DB migration 적용, production runtime vector 활성화
- 승인 필요: `010_commercial_operations.sql` 적용 또는 embedding-only migration 분리

SIF vector gate 산출물:

- 코드: `lib/safety-reference-catalog.ts`
- SQL 초안: `supabase/migrations/010_commercial_operations.sql`
- 테스트: `tests/safety-reference-hybrid.test.ts`
- Batch manifest: `evaluation/sif-embedding-gate/sif-embedding-batch-manifest.json`
- Verification: `evaluation/sif-embedding-gate/batch-manifest-verification.json`
- Corpus hash: `2712c6eafd24962588293749bb12d249cf761972dcdea7b249f16efea76b8f3e`
- 적용 조건: `OPENAI_API_KEY`, `safety_reference_embeddings` 업로드, `match_safety_reference_embeddings` RPC 적용
- 주의: 이번 작업에서 DB schema 적용, embedding 생성, embedding 업로드는 실행하지 않았다.

### Vision / OCR

- 서버 경로 존재: `app/api/workpacks/[id]/improvements/route.ts`
- 모델 어댑터 존재: `lib/photo-vision-analysis.ts`
- 동작: Before/After 파일이 모두 있고 `OPENAI_API_KEY`가 있으면 OpenAI Responses API에 이미지 2장을 전달
- 결과 저장 위치: `workpack_improvements.analysis_payload`
- 보강: 하네스 메모리와 learning export가 `summary`, `detectedHazards`, `observedImprovement`, `ocrText`, `reflectedDocuments`를 회수
- 보강: 사용자-facing `/workspace` 개선 캡처 패널이 문서팩 DB 저장 후 `/api/workpacks/:id/improvements` multipart API로 Before/After 사진과 메모를 전달
- 보강: 최근 개선사항 카드에 사진 기반 위험요인, 관찰 개선, OCR을 표시
- 보강: 로그인/DB/migration 미연결 시 기존 localStorage 후보로 fallback해 현장 메모를 버리지 않음
- 보강: learning export가 `visionStatus`, `visionProvider`, `visionModel`, `visionErrorMessage`를 보존해 분석됨/키 없음/실패 상태를 MD/JSONL에 남김
- 보강: learning export에서 OCR/관찰 결과를 120자 UI 요약 길이로 자르지 않고 최대 4,000자까지 보존
- 산출물: `evaluation/backend-harness-gate-2026-07-08/vision-ocr-memory-contract-report.json`
- 산출물: `evaluation/backend-harness-gate-2026-07-08/vision-ocr-learning-export-contract-report.json`
- 검증: `npm.cmd test -- tests/photo-vision-analysis.test.ts tests/commercial-harness.test.ts tests/operation-improvement-history.test.ts tests/workpack-commercial.test.ts tests/reporting-downloads.test.ts` → 5 files / 20 tests passed
- 최신 검증: `npm.cmd test -- tests/commercial-harness.test.ts tests/photo-vision-analysis.test.ts tests/operation-improvement-history.test.ts tests/workpack-commercial.test.ts tests/reporting-downloads.test.ts` → 5 files / 21 tests passed
- 최신 검증: `npm.cmd run build` → passed
- 최신 검증: `npm.cmd run typecheck` → passed
- 주의: 이번 검증에서 실제 DB write나 사진 업로드는 실행하지 않았다.

### 온톨로지

- 현재 `/ontology`는 published graph를 list + hover card로 보여준다.
- 보강: `/ontology`에 published graph 기반 Obsidian식 노드-엣지 맵을 추가했다. 연결도가 높은 노드를 deterministic layout으로 먼저 배치하고, 노드 hover/focus 시 관계 카드가 열린다.
- LangGraph/Habermas Machine 구현은 이번 게이트의 필수 조건이 아니다. 지금은 agent orchestration보다 검수된 published graph를 사용자가 읽고 탐색하는 표면이 우선이다.
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
- vision status/model/provider/error, vision summary, detected hazards, observed improvement, OCR text
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

- `app/api/agent/chat`는 OpenClaw OpenAI OAuth 경로로 고정했다.
- `CLAW_CHAT_PROVIDER=anthropic` 같은 예전 플래그가 환경에 남아 있어도 라우트가 501로 막히지 않고 OpenClaw route를 탄다.
- 기본 실행은 `openclaw --profile safeclaw agent --agent main --local -m <prompt>` 형태다. Windows Node runtime에서는 npm shim을 shell로 호출하지 않고 `node <openclaw.mjs>`로 안전하게 우회한다.
- prompt에는 `run_safeclaw_harness_agent` 우선 호출과 DB harness packet 밖 근거 생성 금지 원칙을 주입한다.
- Vercel 서버에서 이 경로를 쓰려면 OpenClaw runtime/Gateway가 해당 서버 환경에도 있어야 한다. 로컬 사용자 OAuth profile은 Vercel 함수가 자동으로 읽을 수 없다.
- provider lock 산출물: `evaluation/backend-harness-gate-2026-07-08/claw-chat-openclaw-oauth-route-report.json`
- route contract 테스트: `npm.cmd test -- tests/openclaw-chat.test.ts tests/claw-chat-route.test.ts tests/agent-loop.test.ts` → 3 files / 23 tests passed
- 로컬 route smoke: `evaluation/backend-harness-gate-2026-07-08/local-openclaw-chat-route-smoke.json`
  - 대상: `http://127.0.0.1:3111/api/agent/chat`
  - 결과: HTTP 200, OpenClaw OAuth start/ok 이벤트, `final` 이벤트, error 없음
  - 응답 preview: `OpenClaw OAuth route OK`

## 기본 생성 모드 변경

- `runAsk()`의 모드 생략 기본값을 `template`에서 `enhanced`로 바꿨다.
- 명시적으로 `template`을 보내는 테스트/데모 경로는 계속 유지한다.
- 잘못된 mode 값이 들어오면 `template`이 아니라 `enhanced`로 떨어진다.
- 목적: 워크스페이스 버튼뿐 아니라 `/api/ask`, `/api/ask/stream`, `/ask` 등 서버 호출자가 mode를 생략해도 DB/KOSHA/SIF 하네스 경로가 기본이 되게 한다.

## DB 하네스 생성 계약

- 웹 `runAsk()` 응답에도 `dbHarness.packet`, `dbHarness.promptContext`, `dbHarness.summary`를 추가했다.
- `enhanced/full` 문서 생성 프롬프트에는 `[DB 하네스 계약]` 섹션이 들어가며, LLM 역할을 `naturalize_only`로 고정한다.
- 품질 계약에는 `DB 하네스 계약` 항목을 추가했다. 템플릿 모드는 blocked, DB 근거가 고정된 live/enhanced 응답은 ready/degraded로 판정한다.
- 산출물: `evaluation/backend-harness-gate-2026-07-08/db-harness-web-generation-contract-report.json`
- 검증: `npm.cmd test -- tests/quality-contract.test.ts tests/ai-deliverables-prompts.test.ts tests/commercial-harness.test.ts tests/run-ask-mode.test.ts` → 4 files / 26 tests passed

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

## SIF 임베딩 다음 게이트 Preflight

- 추가 명령: `npm.cmd run knowledge:sif-embedding-preflight`
- 산출물: `evaluation/sif-embedding-gate/approval-preflight-report.json`
- 판정: corpus/manifest/report/JSONL/SQL/RLS/upload guard 모두 통과
- DB mutation, OpenAI embedding 생성, Supabase upload는 계속 미실행
- 현재 실행 환경에는 Supabase URL/service role은 있으나 `OPENAI_API_KEY`가 없어, 승인 후 embedding 생성 전 실행 환경 정렬이 필요하다.
- 승인 후에도 바로 vector runtime을 켜지 않고, 업로드 row count 6,032 검증과 RPC smoke test 이후 `SAFETY_REFERENCE_VECTOR_SEARCH=1`을 켠다.

검증:

- `npm.cmd run knowledge:sif-embedding-preflight` → ok
- `npm.cmd test -- tests/sif-embedding-preflight.test.ts tests/commercial-harness.test.ts tests/commercial-migration.test.ts tests/safety-reference-hybrid.test.ts` → 4 files / 14 tests passed
- `npm.cmd run build` → passed
- `npm.cmd run typecheck` → passed

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

## 워크스페이스 폰트 / 메뉴 밀도 보정

- 첫 화면 헤드라인 `오늘 작업은 무엇인가요?`는 한글 우선 폰트 스택과 더 단단한 weight로 보정했다.
- 데스크톱 헤드라인은 고정 56px / weight 800 / line-height 1.16으로 맞췄고, viewport width 기반 폰트 스케일링은 추가하지 않았다.
- 사이드 메뉴 버튼은 데스크톱 기준 50px 높이와 넓은 gap으로 조정해 메뉴와 메뉴 사이가 덜 붙어 보이게 했다.
- 입력 도움말, 자동 인식 칩, textarea의 행간도 소폭 넓혀 장문 입력 시 답답함을 줄였다.
- 브라우저 산출물:
  - `evaluation/backend-harness-gate-2026-07-08/design-polish/day-desktop.png`
  - `evaluation/backend-harness-gate-2026-07-08/design-polish/night-desktop.png`
  - `evaluation/backend-harness-gate-2026-07-08/design-polish/day-mobile.png`
  - `evaluation/backend-harness-gate-2026-07-08/design-polish/night-mobile.png`
  - `evaluation/backend-harness-gate-2026-07-08/design-polish/workspace-typography-polish-report.json`

검증:

- `npm.cmd test -- tests/workspace-layout-regression.test.ts` → 1 file / 1 test passed
- `npm.cmd test -- tests/workspace-layout-regression.test.ts tests/openclaw-chat.test.ts tests/claw-chat-route.test.ts` → 3 files / 6 tests passed
- `npm.cmd run build` → passed
- `npm.cmd run typecheck` → passed
