# SafeClaw Agent Architecture Strategy Review

Generated: 2026-07-09

Source document: `C:\Users\iceam\Downloads\SafeClaw_Agent_Architecture_Strategy.md`

## 결론

문서의 큰 방향, 즉 SafeClaw를 단순 LLM 호출 서비스가 아니라 근거 하네스와 작업 이력 메모리를 가진 agentic safety workbench로 키워야 한다는 판단은 채택한다.

다만 Hermes Agent를 SafeClaw의 즉시 production core로 내재화하는 제안은 현재 active plan에는 채택하지 않는다. 지금 제품의 중심은 Next.js/Supabase/MCP/DB Evidence Harness이며, OpenClaw, Codex, Hermes는 이 코어를 호출하는 외부 agent runtime consumer로 둔다.

## Adopt

- 현재 경량 에이전트 루프와 MCP 계층 진단은 맞다.
- 대규모 상업제품으로 가려면 세션, job 상태, retry, tenant boundary, 비용 통제, 데이터 격리가 필요하다.
- 외부 에이전트가 SafeClaw 도구를 호출하는 MCP 경로는 유지하고 강화한다.
- 공용 reference corpus와 tenant operation memory를 분리한다.
- `run_safeclaw_harness_agent` 결과를 외부 AI가 따르는 사실 경계로 고정한다.

## Defer

- Hermes Agent를 별도 Python/FastAPI worker로 띄우는 PoC.
- Hermes를 MCP client worker로 붙여 SafeClaw 도구 호출 parity를 확인하는 실험.
- 문서 생성/검수/전송을 queue 기반 async job layer로 분리하는 2차 구조.

## Reject For Active Plan

- Hermes를 SafeClaw production core engine으로 즉시 교체.
- `lib/claw-tools.ts` 또는 SafeClaw domain tool registry를 Python/Hermes 쪽으로 이관.
- 고객 작업 이력을 익명화만으로 공용 LLM Wiki에 자동 승격.
- 제품 문구에서 "자가 학습", "파인튜닝", "모델 학습"으로 현재 DB harness/embedding/operation memory를 설명.

## Development Plan Additions

### P0: Agent Runtime Boundary ADR

완료 산출물: `docs/adr/0001-agent-runtime-boundary.md`

SafeClaw core는 Next.js/Supabase/MCP/DB Evidence Harness로 유지한다. OpenClaw, Codex, Hermes는 agent runtime consumer다.

### P0: Tenant Learning Contract

추가 필요:

- public reference corpus
- tenant operation memory
- review/promotion queue
- blocked-by-default public corpus promotion

고객 작업 데이터는 같은 tenant의 Evidence Harness에만 들어가며, 공용 corpus 승격은 별도 검수와 승인 후에만 가능해야 한다.

### P0: Harness Packet Contract Tests

추가 필요:

- 외부 agent consumer가 packet 밖 근거를 만들지 않는 계약 테스트
- `run_safeclaw_harness_agent` 응답에 required evidence, missing evidence, tenant scope, generation contract가 포함되는지 검증
- 사용자-facing 문구에는 내부 계약 문자열을 노출하지 않는 display 테스트

### P1: Async Document Job Layer

추가 필요:

- job id
- idempotency key
- status
- retry count
- terminal error summary
- workpack id linkage

처음부터 Celery/Kafka로 가지 않고 Supabase/Vercel 친화적인 job table부터 설계한다.

### P2: Hermes MCP Client PoC

별도 branch 또는 separate service PoC로만 진행한다. PoC 승인 전 확인할 항목:

- license and redistribution
- secret boundary
- tenant scoped MCP token handling
- no domain tool migration
- no direct DB write path

## Terminology Decisions

- `학습`: 제품 안에서는 쓰지 않는다. `SIF/KOSHA corpus`, `embedding index`, `tenant operation memory`, `Evidence Harness`로 분리한다.
- `LLM Wiki`: `공용 안전 reference corpus`와 `tenant operation memory`로 분리한다.
- `agent`: OpenClaw/Codex/Hermes 같은 runtime consumer를 뜻한다. SafeClaw MCP tool 자체는 사실 경계와 도구 계약이다.
- `ontology`: 법령, 위험요인, 조치, 의무의 도메인 그래프다.
- `operation graph`: workpack, hazard, control, improvement, evidence, ack, dispatch event를 잇는 작업 이력 그래프다.

## Safety Gates

- DB migration, vector table, RPC, index, bulk upload: 명시 승인 전 금지.
- SIF embedding generation/upload: 비용 승인, upload 승인 플래그, service role 확인 전 금지.
- OpenClaw OAuth: `safeclaw` profile의 실제 OAuth 상태 확인 후 사용.
- MCP token: org/site scoped, plaintext token 저장/로그 금지.
- customer data learning: 공용 corpus 자동 승격 금지.
- secrets: `.env`, service role, OpenAI/Anthropic keys 출력/커밋 금지.

## Current Implementation Alignment

- `CONTEXT.md`에 Agent Runtime Consumer, Public Reference Corpus, Tenant Operation Memory, Operation Graph 용어를 추가했다.
- `docs/adr/0001-agent-runtime-boundary.md`로 현재 agent runtime boundary를 고정했다.
- 현재 코드 패치에서는 사용자-facing workspace에서 더미 작업자명, 개발자식 실패 아이콘, 내부 `naturalize_only` 표시를 제거하고 있다.
