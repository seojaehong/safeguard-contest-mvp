# SafeClaw Backend, Vision, Ontology Readiness Report

Generated: 2026-07-09

## 결론

이번 점검에서 확인된 상태는 다음과 같다.

- SIF 임베딩은 아직 DB 업로드까지 끝난 상태가 아니다.
- 6,032건 SIF 임베딩 코퍼스와 61개 배치 manifest는 준비되어 있고, 실제 임베딩 생성/DB 업로드는 승인 플래그 없이는 실행되지 않도록 막혀 있다.
- 3건 canary embedding은 실제 OpenAI `text-embedding-3-small`로 성공했다.
- 운영 DB에는 아직 `safety_reference_embeddings` table과 `match_safety_reference_embeddings` RPC가 없어 migration 승인이 먼저 필요하다.
- 로컬/Vercel `OPENAI_API_KEY` 설정 후 vision route는 실제 OpenAI vision 호출까지 성공했다.
- 모델이 JSON을 ```json 코드펜스로 감싸 반환해도 파서가 실패하지 않도록 보강했다.
- 온톨로지는 LangGraph 같은 실행 프레임워크 없이도 현재 요구한 리스트 + Obsidian식 map + hover card + MD/JSONL 운영 코퍼스 형태로 구현되어 있다.
- 전체 페이지는 워크스페이스 톤을 기준으로 재분류해야 한다. 상세 제안은 `page-taxonomy-and-density-audit.md`에 정리했다.

## SIF Embedding Approval Gate

권위 산출물:

- `evaluation/sif-embedding-gate/report.json`
- `evaluation/sif-embedding-gate/sif-embedding-corpus.jsonl`
- `evaluation/sif-embedding-gate/sif-embedding-batch-manifest.json`
- `evaluation/sif-embedding-gate/runtime-readiness-local.json`
- `evaluation/sif-embedding-gate/runtime-db-probe.json`
- `evaluation/sif-embedding-gate/sif-embedding-only-migration.sql`
- `evaluation/sif-embedding-gate/next-approval-gate-runtime-2026-07-09.md`
- `evaluation/sif-embedding-canary-2026-07-09/report.json`
- `evaluation/sif-embedding-canary-2026-07-09/sif-embedding-vectors.jsonl`

현재 수치:

- source item count: 6,033
- skipped count: 1
- corpus count: 6,032
- batch count: 61
- embedding model: `text-embedding-3-small`
- embedding dimensions: 1,536
- embedded count: 0
- uploaded count: 0
- canary embedded count: 3
- runtime DB probe: `migration-required`
- `safety_reference_embeddings`: table missing on target DB
- `match_safety_reference_embeddings`: RPC missing on target DB

승인 전 보류 상태:

- `dbMutationPerformed`: false
- `embeddingGenerated`: false
- `uploaded`: false
- 승인 후 실행 명령: `npm.cmd run knowledge:sif-embedding-corpus -- --embed --approved-embedding --upload --approved-upload`

개선:

- `scripts/sif_embedding_approval_preflight.mjs`가 기본적으로 `.env.local`을 읽어 현재 실행환경 준비 상태를 반영한다.
- 테스트에서는 `--no-env-file`을 사용해 비밀 파일에 영향받지 않는 고정 게이트 검증을 유지한다.
- `--env-file`로 별도 env 파일을 지정해 실행 준비 상태를 검증할 수 있다.
- `scripts/sif_embedding_runtime_probe.mjs`가 운영 DB를 read-only로 확인해 table/RPC 적용 여부와 uploaded row count를 검증한다.
- SIF-only migration proposal을 별도 산출물로 분리해, 공유/확인이력/개선사항 migration과 독립적으로 승인할 수 있게 했다.
- 승인 게이트에 `vector_feature_flag_stays_off_until_upload_verified` 체크를 추가했다. 업로드 row count 검증 전 `SAFETY_REFERENCE_VECTOR_SEARCH=1`이면 preflight가 실패한다.
- 2026-07-09 재실행한 `approval-preflight-report.json` 기준 corpus 6,032건, batch 61개, embedded/uploaded 0건, failedCheckIds 없음이다.

## Vision/OCR Route

권위 산출물:

- `evaluation/vision-runtime-smoke-2026-07-09/hazard-photo-smoke.png`
- `evaluation/vision-runtime-smoke-2026-07-09/hazard-photo-api-response.json`
- `evaluation/vision-runtime-smoke-2026-07-09/hazard-photo-api-response-after-parser-fix.json`

실제 route:

- `POST /api/input-photos/hazard-analysis`
- multipart `photos` 최대 10장
- OpenAI Responses API image input 사용
- 기본 모델: `gpt-4.1-mini`

런타임 smoke 결과:

- 최초 호출: OpenAI 응답이 ```json fenced JSON이라 parse 실패
- 파서 수정 후 재호출: `ok=true`, `status=analyzed`, `photoCount=1`, 후보 3개, OCR text 있음

제품 설계 판단:

- 사진 분석은 별도 카드가 아니라 입력창의 `+ 첨부` 액션으로 흡수한다.
- 사진을 첨부할 때마다 조용히 분석하고, 사용자는 후보별로 `추가`, `무시`, `자세히`를 선택한다.
- 장기적으로 PDF/HWPX/Excel/도면도 같은 첨부 메뉴를 사용한다.

2026-07-09 추가 구현:

- 입력 화면의 별도 사진 분석 카드/드롭존을 제거하고 `+ 사진` composer tray로 흡수했다.
- 사진은 최대 10장까지 첨부되며, 첨부 직후 `/api/input-photos/hazard-analysis`가 자동 호출된다.
- 분석 후보는 `추가`/`무시`로 나뉘며, 사용자가 `추가`한 후보만 문서 생성 payload에 반영된다.
- 후보를 추가해도 textarea 본문은 오염되지 않고, 생성 직전 하네스 입력에 별도 appendix로 붙는다.

## Ontology And Learning Corpus

검증 대상:

- `lib/ontology/operation-memory-visualization.ts`
- `components/OperationMemoryPreview.tsx`
- `lib/workpack-learning-export.ts`
- `lib/reporting-downloads.ts`
- `components/ReportsDownloadCenter.tsx`

확인된 표면:

- 작업팩 운영 그래프: Workpack, Evidence, Hazard, Control, Improvement, Ack
- 리스트 기반 온톨로지
- Obsidian식 map node/edge 좌표 모델
- hover card model
- `/ontology` 작업 이력 미리보기의 `MD 저장`, `JSONL 저장` 로컬 내보내기
- 기간별 운영 코퍼스 MD/JSONL
- 이벤트 타입: `period_summary`, `workpack`, `risk_row`, `improvement`, `classification_group`

2026-07-09 추가 구현:

- `/ontology`에서 샘플 또는 로컬 개선 후보를 Obsidian식 작업 이력 그래프와 리스트로 동시에 확인한다.
- 같은 작업 이력 표면을 Markdown/JSONL로 바로 내려받아 재생성 가능한 운영 코퍼스로 보존한다.
- 파일에는 작업, 위험요인, 조치, 개선, 근거, 확인 이력이 함께 기록된다.
- 사진 Before/After 개선 후보가 있으면 `visionStatus`, OCR, 반영 문서, 사진 첨부 여부가 함께 남는다.

2026-07-09 하네스 생성 경로 보강:

- 워크스페이스에서 저장한 로컬/DB 개선사항 후보를 `/api/ask`와 `/api/ask/stream` 요청의 `harnessMemory`로 함께 보낸다.
- 서버는 `parseHarnessMemoryInput`으로 이 값을 엄격히 정규화한 뒤 `runAsk`에 전달한다.
- `runAsk`는 safety reference DB 검색 결과와 작업 개선 이력을 같은 `DbHarnessPacket`에 넣고, `buildHarnessPromptContext`를 통해 AI 문서 생성 프롬프트에 제공한다.
- 최종 `AskResponse.dbHarness.packet.improvementMemory`와 `summary.improvementMemory`에도 같은 값이 남아 품질 패널과 운영 코퍼스가 같은 하네스 계약을 본다.
- 즉 사진/개선 후보는 단순 textarea 부록만이 아니라 DB 기반 하네스 계약의 일부로 문서 생성 전에 고정된다.
- 문서 화면 인용 근거 패널에는 `하네스 메모리` 항목이 노출되어, 개선 이력/과거 작업 이력이 해당 문서 생성에 반영됐는지 확인할 수 있다.

2026-07-09 보이는 판단문 보강:

- `/ask`와 문서 생성 응답의 최상단 `answer`는 이제 일반 LLM 산문이 아니라 `DbHarnessPacket`에서 만든 하네스 판단 요약으로 시작한다.
- 직접 근거, SIF/사고 사례, 개선 이력, 누락 항목이 먼저 고정되고, LLM 문장은 보조 산문으로만 뒤에 붙는다.
- `practicalPoints`도 하네스 기준으로 재구성해, 사용자가 위험성평가/TBM/공유 전파에 무엇을 반영해야 하는지 먼저 보게 했다.
- 내부 용어인 `fallback`, `OPENAI_API_KEY`, provider retry, timeout, 확률/점수 표현은 사용자 본문에 드러내지 않는 기존 표시 정책을 유지한다.
- 검증 명령:
  - `npm.cmd test -- tests\commercial-harness.test.ts tests\answer-panel-display.test.ts tests\quality-contract.test.ts`
  - `npm.cmd run typecheck`
  - `npm.cmd run build`

판단:

- 현재 요구에는 Habermas machine 또는 LangGraph 구현이 필수는 아니다.
- 우선순위는 실행 프레임워크보다 “작업 이력 그래프를 사용자가 이해하고 재사용하는 표면”이다.
- 나중에 agent orchestration이 필요해지면 LangGraph류를 붙일 수 있지만, 지금은 DB harness + graph DTO + UI visualization이 더 직접적이다.

## UI/IA Design Gate

새 설계 산출물:

- `evaluation/ui-ux-browser-check-2026-07-09/page-taxonomy-and-density-audit.md`
- `evaluation/ui-ux-browser-check-2026-07-09/workspace-visual-metrics.json`
- `evaluation/ui-ux-browser-check-2026-07-09/workspace-night-input.png`
- `evaluation/ui-ux-browser-check-2026-07-09/workspace-day-mobile.png`
- `evaluation/ui-ux-browser-check-2026-07-09/workspace-composer-plus-day.png`
- `evaluation/ui-ux-browser-check-2026-07-09/workspace-composer-photo-candidates-day.png`
- `evaluation/ui-ux-browser-check-2026-07-09/workspace-composer-mobile-day.png`
- `evaluation/ui-ux-browser-check-2026-07-09/workspace-composer-attachment-metrics.json`
- `evaluation/ui-ux-browser-check-2026-07-09/workspace-typography-day.png`
- `evaluation/ui-ux-browser-check-2026-07-09/workspace-typography-night.png`
- `evaluation/ui-ux-browser-check-2026-07-09/workspace-typography-metrics.json`
- `evaluation/ui-ux-browser-check-2026-07-09/ontology-operation-memory-desktop.png`
- `evaluation/ui-ux-browser-check-2026-07-09/ontology-operation-memory-hover.png`
- `evaluation/ui-ux-browser-check-2026-07-09/ontology-operation-memory-mobile.png`
- `evaluation/ui-ux-browser-check-2026-07-09/ontology-operation-memory-metrics.json`
- `evaluation/ui-ux-browser-check-2026-07-09/ai-connect-sif-gate.png`
- `evaluation/ui-ux-browser-check-2026-07-09/ai-connect-sif-gate-metrics.json`
- `evaluation/ui-ux-browser-check-2026-07-09/ai-connect-sif-gate-api-metrics.json`
- `evaluation/ui-ux-browser-check-2026-07-09/ai-connect-login-gate-debug.png`
- `evaluation/ui-ux-browser-check-2026-07-09/ai-connect-login-gate-debug.json`
- `evaluation/ui-ux-browser-check-2026-07-09/ai-connect-workspace-style.png`
- `evaluation/ui-ux-browser-check-2026-07-09/ai-connect-workspace-style-metrics.json`
- `evaluation/ui-ux-browser-check-2026-07-09/ai-connect-workspace-style-mobile.png`
- `evaluation/ui-ux-browser-check-2026-07-09/ai-connect-workspace-style-mobile-metrics.json`
- `evaluation/ui-ux-browser-check-2026-07-09/module-nav-ai-connect-desktop.png`
- `evaluation/ui-ux-browser-check-2026-07-09/module-nav-ai-connect-desktop-metrics.json`
- `evaluation/ui-ux-browser-check-2026-07-09/module-nav-ai-connect-mobile.png`
- `evaluation/ui-ux-browser-check-2026-07-09/module-nav-ai-connect-mobile-metrics.json`
- `evaluation/ui-ux-browser-check-2026-07-09/module-nav-ontology-desktop.png`
- `evaluation/ui-ux-browser-check-2026-07-09/module-nav-ontology-desktop-metrics.json`
- `evaluation/ui-ux-browser-check-2026-07-09/unified-page-ask-desktop.png`
- `evaluation/ui-ux-browser-check-2026-07-09/unified-page-ask-desktop-metrics.json`
- `evaluation/ui-ux-browser-check-2026-07-09/unified-page-search-desktop.png`
- `evaluation/ui-ux-browser-check-2026-07-09/unified-page-search-desktop-metrics.json`
- `evaluation/ui-ux-browser-check-2026-07-09/unified-page-preview-mobile.png`
- `evaluation/ui-ux-browser-check-2026-07-09/unified-page-preview-mobile-metrics.json`
- `evaluation/ui-ux-browser-check-2026-07-09/unified-page-trust-mobile.png`
- `evaluation/ui-ux-browser-check-2026-07-09/unified-page-trust-mobile-metrics.json`
- `evaluation/ui-ux-browser-check-2026-07-09/unified-page-roadmap-desktop.png`
- `evaluation/ui-ux-browser-check-2026-07-09/unified-page-roadmap-desktop-metrics.json`
- `evaluation/ui-ux-browser-check-2026-07-09/unified-page-knowledge-detail-desktop.png`
- `evaluation/ui-ux-browser-check-2026-07-09/unified-page-knowledge-detail-desktop-metrics.json`

핵심 권고:

- 앱 내부 1급 메뉴는 6개로 축소: 작업공간, 문서, 리포트, 근거, 이력, 설정
- `/workers`, `/dispatch`, `/tbm`은 1급 메뉴가 아니라 작업공간/문서 하위 흐름으로 흡수
- `/knowledge`, `/ontology`, `/ops/api`, `/settings/ai-connect`는 근거/설정 하위로 이동
- `/ask`, `/search`, `/preview`, `/trust`, `/roadmap`, `/knowledge/[section]/[slug]`는 공통 `SafeClawModuleShell`로 흡수
- 사용자 본문에는 `fallback`, `OPENAI_API_KEY`, `AI_MODE`, `timeout`, provider retry 같은 내부 운영 문구를 노출하지 않음
- 워크스페이스 첫 화면도 사진 분석 카드, 근거 레일, 예시 목록, 고급 설정을 더 접는다.

브라우저 메트릭:

- desktop `/workspace?theme=night`: topbar position `relative`, side nav/heading overlap 없음
- mobile `/workspace?theme=day`: horizontal overflow 없음
- composer before photo: `+사진` tray 있음, 사진 패널 없음, horizontal overflow 없음
- composer after photo: `1/10장 첨부`, 후보 2개, `1개 반영`, textarea에 `사진 후보` 문자열 없음
- composer mobile: viewport 390px, scrollWidth 390px, horizontal overflow 없음
- workspace typography: day/night H1 `Pretendard`, 58px, weight 860, horizontal overflow 없음
- ontology desktop: 작업 이력 미리보기 노출, memory map node 7개, edge 7개, list row 7개, hover card 7개
- ontology export actions: `최근 후보 다시 읽기`, `MD 저장`, `JSONL 저장`
- ontology published graph: graph node 32개, list row 166개
- ontology mobile: viewport 390px, scrollWidth 390px, horizontal overflow 없음
- ai-connect SIF gate: dummy public Supabase env와 fake local session으로 UI 렌더만 검수, 비밀값/DB 권한 사용 없음
- ai-connect SIF gate UI: `Vector 검색 잠금`, 업로드 `0 / 6,032건`, 승인 순서 4단계, `Preflight 자동 점검 통과`, horizontal overflow 없음
- ai-connect SIF status API: HTTP 200, `ok: true`, `vectorGuard.status: locked`, failed check 0건
- 로컬 worktree 기본 `.env.local`에는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 없어 로그인 후 패널 검수는 dummy public env로 별도 수행함
- ai-connect workspace style: 공통 `SafeClawModuleShell` 기본 variant를 workspace/document 계열로 전환, rail subtitle을 `현장 안전 문서팩`으로 변경
- ai-connect workspace style desktop: 탭 background `rgba(108, 111, 247, 0.12)`, yellow tab fill 없음, vector guard 노출, horizontal overflow 없음
- ai-connect workspace style mobile: viewport 390px, 탭 1열(`390px`), horizontal overflow 없음
- module shell navigation: 공통 앱 내부 1급 메뉴를 15개 노출에서 6개(`작업공간`, `문서`, `리포트`, `근거`, `이력`, `설정`)로 축소
- module shell navigation desktop `/settings/ai-connect`: primary 6개, secondary 1개, active primary `설정`, horizontal overflow 없음
- module shell navigation mobile `/settings/ai-connect`: viewport 390px, scrollWidth 390px, primary 2열(`177px 177px`), secondary 1열(`358px`), horizontal overflow 없음
- module shell navigation desktop `/ontology`: primary 6개, secondary 3개, active primary `근거`, active secondary `온톨로지`, horizontal overflow 없음
- unified module pages `/ask`, `/search`, `/preview`, `/trust`, `/roadmap`, `/knowledge/forms/risk-assessment`: 공통 module shell 사용, legacy `v2-shell`/`hero grid` 없음
- unified module pages: desktop/mobile 모두 horizontal overflow 없음
- unified module pages: `/ask` visible body에서 내부 진단 문구 없음
- unified module pages: H1 font size desktop 52px, mobile 34px, letter-spacing `normal`
- 남은 디자인 과제: 각 개별 페이지 본문 컴포넌트의 과도한 표/카드 밀도는 계속 워크스페이스 문서형 패턴으로 덜어내야 함

## Tests Run

- `npm.cmd test -- tests/sif-embedding-gate-status.test.ts tests/sif-embedding-preflight.test.ts`
  - 2 files, 6 tests passed
- `npm.cmd test -- tests/sif-embedding-gate-status.test.ts tests/sif-embedding-preflight.test.ts tests/photo-vision-analysis.test.ts tests/operation-memory-visualization.test.ts tests/reporting-downloads.test.ts`
  - 5 files, 21 tests passed
- `npm.cmd test -- tests/sif-embedding-preflight.test.ts tests/sif-embedding-gate-status.test.ts`
  - 2 files, 5 tests passed
- `npm.cmd test -- tests/sif-embedding-preflight.test.ts tests/sif-embedding-gate-status.test.ts tests/sif-embedding-runtime-probe.test.ts`
  - 3 files, 7 tests passed
- `npm.cmd test -- tests/module-shell-navigation.test.ts tests/sif-embedding-gate-status.test.ts tests/sif-embedding-preflight.test.ts`
  - 3 files, 9 tests passed
- `npm.cmd test -- tests/answer-panel-display.test.ts tests/module-shell-navigation.test.ts tests/sif-embedding-gate-status.test.ts tests/sif-embedding-preflight.test.ts`
  - 4 files, 13 tests passed
- `npm.cmd test -- tests/photo-vision-analysis.test.ts`
  - 1 file, 11 tests passed
- `npm.cmd test -- tests/operation-memory-visualization.test.ts tests/ontology-operation-memory.test.ts tests/reporting-downloads.test.ts tests/workspace-pages.test.ts`
  - 4 files, 14 tests passed
- `npm.cmd test -- tests/operation-memory-visualization.test.ts tests/ontology-operation-memory.test.ts tests/commercial-harness.test.ts`
  - 3 files, 12 tests passed
- `npm.cmd test -- tests/commercial-harness.test.ts tests/ai-deliverables-prompts.test.ts tests/quality-contract.test.ts`
  - 3 files, 26 tests passed
- `npm.cmd test -- tests/workspace-layout-regression.test.ts`
  - 1 file, 1 test passed
- `npm.cmd test -- tests/operation-improvements.test.ts tests/photo-vision-analysis.test.ts`
  - 2 files, 18 tests passed
- `npm.cmd run typecheck`
  - passed
- `npm.cmd run build`
  - passed, Next.js generated 27 static pages and compiled `/api/input-photos/hazard-analysis`, `/api/sif-embedding-gate/status`

## Remaining Approval Gates

1. DB schema/migration and bulk embedding upload still require explicit approval.
2. Vector search should be enabled only after uploaded row count equals 6,032 and RPC smoke passes.
3. Full page body density reduction can continue without schema changes, but migration, published ontology promotion, and bulk DB writes still require approval.
