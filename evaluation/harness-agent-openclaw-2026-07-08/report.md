# SafeClaw Harness Agent / OpenClaw OAuth 연결 보고

생성 시각: 2026-07-08 17:20 KST

## 결론

OpenClaw/Codex가 일반 문서 생성 도구를 바로 호출하지 않도록 `run_safeclaw_harness_agent` 전용 MCP 도구를 추가했다. 이 도구는 먼저 SafeClaw DB 근거를 고정하고, 반환 패킷에 `db_harness_first`, `naturalize_only`, `fallbackChainAllowed: false` 계약을 포함한다.

시연 구조는 아래처럼 분리한다.

- OpenClaw 모델 사용: 로컬 `safeclaw` profile의 OpenAI OAuth
- SafeClaw 데이터 접근: `/settings/ai-connect`에서 발급한 MCP 토큰
- 우선 호출 도구: `run_safeclaw_harness_agent`
- 후속 역할: OpenClaw는 패킷 안의 근거·작업 이력·개선 이력만 문장화/검토

## 구현 범위

- MCP 서버에 `run_safeclaw_harness_agent` 추가
- 내부 Claw agent tool 목록에도 같은 도구 추가
- `/settings/ai-connect`에 `Harness Agent` 탭 추가
- OpenClaw OAuth 로그인, 모델 상태 확인, MCP 연결, 하네스 시연 명령을 한 번에 제공
- SIF embedding corpus 생성 스크립트 dry-run 검증
- Before/After 개선 사진 분석은 개선사항 API에 optional vision adapter로 연결

## DB 활용 방식

1차는 schema 변경 없이 읽기 중심으로 연결한다.

- `safety_reference_items`: 직접 근거, SIF 사례, 보조 근거 검색
- `workpacks`: 같은 현장의 최근 작업 이력 로드
- `workpack_improvements`: 2차 migration 적용 후 개선 이력 로드. 미적용 DB에서는 실패를 로그로 남기고 빈 이력으로 degrade

## SIF 코퍼스 Dry-Run

명령:

```powershell
npm.cmd run knowledge:sif-embedding-corpus -- --limit 25
```

결과:

- 입력 SIF 후보: 25건
- 스프레드시트 헤더 제외: 1건 (`sif-아카이브-건설업-00001`)
- 코퍼스 생성: 24건
- 실제 embedding/upload: 실행하지 않음

산출물:

- `evaluation/sif-embedding-gate/report.json`
- `evaluation/sif-embedding-gate/sif-embedding-corpus.jsonl`
- `evaluation/sif-embedding-gate/sif-embedding-corpus.md`

## 검증

```powershell
npm.cmd test -- tests/mcp-tools.test.ts tests/agent-loop.test.ts tests/mcp-token-service.test.ts tests/commercial-harness.test.ts tests/photo-vision-analysis.test.ts tests/workpack-commercial.test.ts tests/commercial-migration.test.ts
npm.cmd run typecheck
```

결과:

- 테스트: 7 files / 73 tests passed
- TypeScript: passed

## 남은 승인 게이트

- `010_commercial_operations.sql` migration 적용은 별도 승인 필요
- SIF embedding 실제 업로드는 migration 적용과 API key 확인 후 별도 승인 필요
- OpenClaw live OAuth/profile 검증은 사용자 로컬 device-code 승인 후 실행 가능
