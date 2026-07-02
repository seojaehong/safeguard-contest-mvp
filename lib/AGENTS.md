# lib/ 작업 규칙

- 타입 규율: `any` 금지. 외부 데이터는 `unknown` + type guard(isRecord, readString) 패턴.
- 정책/결정 로직(타임아웃 예산, 모델 체인, 재시도 규칙 등)은 순수 함수로 `lib/*-policy.ts`에 분리하고 `tests/`에 vitest 단위 테스트를 붙인다. 예: `ai-deliverables-policy.ts`.
- AI 타임아웃 env는 경로별로 분리되어 있다:
  - `GEMINI_TIMEOUT_MS` → `lib/ai.ts` (/api/ask 본문 답변 경로, 기본 25s)
  - `GEMINI_DELIVERABLES_TIMEOUT_MS` → `lib/ai-deliverables.ts` (구조화 문서 7-way 병렬, 기본 45s)
  - deliverables가 `GEMINI_TIMEOUT_MS`를 상속하게 만들지 말 것 — prod에서 20s로 물려받아 전 문서 타임아웃된 이력 있음 (2026-07-02).
- Vertex 호출은 `lib/vertex/client.ts` `generateWithVertex(model, prompt, {generationConfig, timeoutMs})` 경유. Promise.race 타임아웃 내장.
- 외부 연동은 전부 `mode: mock|live|fallback` + `status.detail` 문자열 패턴 (lib/types.ts AskResponse).
- 검증 명령 (Windows Git Bash): `npm.cmd test` / `npm.cmd run typecheck` / `npm.cmd run build`.
