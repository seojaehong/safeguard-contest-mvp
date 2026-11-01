# MCP 위험성평가표

외부 에이전트가 SafeClaw MCP(`/api/mcp/mcp`, Bearer)의 `generate_risk_assessment` 도구에 작업 설명 한 줄을 넣으면, 위험성평가 본표 행(세부작업·유해·위험요인·재해유형·가능성·중대성·위험성·감소대책·근거)과 확인 필요 목록, 시행규칙 제37조의4 기재 항목 충족 검사, 생성에 쓰인 SIF 유사사례(제목·사고개요·출처·기준연도), 웹 「위험성평가표 편집 → 내보내기」와 같은 서식 파일(Excel 표 양식 .xlsx 또는 한글 표 양식 .hwp, base64)을 한 번에 돌려받는다. 작업공간에는 저장하지 않는다.

## Sub-features

- `tool-listed` `tools/list` 에 `generate_risk_assessment` 가 있고 입력은 `question`(필수)·`mode`(template·enhanced·full, 기본 enhanced)·`format`(xlsx·hwp, 기본 xlsx).
- `risk-rows` 결과 `status` 가 `ok`, `riskAssessment.headers` 13칸(번호…잔여 위험성), `rowCount` ≥ 1, `approvalLabels` = 작성·검토·승인.
- `review-list` 「검토 필요:」 행은 본표에 없고 `reviewItems` 로 따로 온다. 파일에도 「확인 필요 목록(본표에 넣지 않음)」 절이 있다.
- `record-items` `recordItemsCheck` 가 시행규칙 제37조의4① 기재 항목 8개(실시 시기·담당자·참여 근로자·근로자대표·유해·위험요인·위험성 수준 결정·개선대책 수립·이행 결과)를 채움/일부/빈칸으로 돌려준다. 머리 기록란 4개는 생성 직후 빈칸(현장 기재)이 정상이다.
- `responsibility` `responsibilityNote` = 초안 작성 보조, 실시·최종 판단 책임은 사업주.
- `sif-cases` enhanced·full 은 `sif.cases[]` 에 DB 사례(`source.id` 가 `safeclaw-offline-sif-cases` 가 아님)와 `source.agency`·`title`·`publishedAt`·`baseYear`. 0건이면 `sif.reason` 이 있다(template 은 항상 0건 + 「template 모드는 … 조회하지 않습니다」).
- `export-parity` `file.base64` 를 풀어 만든 파일이 같은 행으로 웹 라우트 `/api/export/{xlsx|hwp}` 에 편집기 모양 본문을 보낸 파일과 같다 — xlsx 는 칸 글자·서식·병합·열 너비, hwp 는 바이트.
- `no-rows` 작업 유형을 확인하지 못하면 `status=review_required`, `file=null`, `fileUnavailableReason` 이 있다.

## How to get to it (user POV)

- MCP 클라이언트(Claude Code·OpenClaw 등)에 `https://<host>/api/mcp/mcp` 를 Bearer 토큰과 함께 등록하고 도구 `generate_risk_assessment` 를 부른다.
- 토큰은 `/settings/ai-connect`(로그인)에서 발급한 DB 토큰, 로컬은 env `SAFECLAW_MCP_TOKENS` 레거시 토큰(사이트 귀속 없음).

## Driving it with verify.mts

Preconditions:

- 이 기능은 브라우저가 아니라 MCP 클라이언트로 구동한다. `verify.mts` 에 아직 드라이버가 없다 — 아래 스크립트를 쓴다.
- 로컬 dev 인스턴스(이 실행이 띄운 것)에 `SAFECLAW_MCP_TOKENS=<로컬 시험 토큰>` 을 env 로 준다. 운영 토큰·실제 고객 자료 금지, 가상 작업 설명만.
- enhanced·full 은 안전 지식 DB(Supabase 읽기)와 AI 답변 생성(enhanced 는 답변 1회, full 은 문서 본문까지)을 쓴다. 운영에서 full 금지.

- **서버.** 토큰 파일 하나를 만들고 같은 값을 `SAFECLAW_MCP_TOKENS` 로 준 채 `npm.cmd run dev -- -p <port> -H 127.0.0.1`.
- **명령.** `node scripts/mcp_risk_assessment_live_check.mjs <repoRoot> http://127.0.0.1:<port> <outDir> <tokenFile>` — 시나리오 4개(SIF 있는 밀폐공간 enhanced / template 지게차 / 화재·폭발 enhanced / 작업 유형 확인 불가)를 부른다. S1~S3 은 형식 2개씩.
- **기대 종료 상태.** `<outDir>/summary.json` 의 S1~S3 행에서 `status=ok`, `magic` 이 xlsx `PK`·hwp `d0cf11e0`, `webStatus=200`, xlsx `cellParity=true`·`headersPresent=true`·`approvalPresent=true`, hwp `bytesIdentical=true`·`textParity=true`, `responseBytes < 262144`, `recordItems` 8항목(시행규칙 제37조의4①), `responsibilityNote` 있음. S1 `sifCount ≥ 1` + `sifSources` 에 기관·기준일 + `sifKept` 마다 `matchedWork` 1개 이상(`sifExcluded` 는 이유가 붙은 뺀 사례), S2 `sifCount=0` + `sifReason`, S3 `reviewCount ≥ 1`, S4 `status=review_required`·`fileUnavailableReason` 있음.
- **증거.** `<outDir>/<시나리오>/mcp-*.xlsx|hwp`(MCP 파일)·`web-*`(웹 라우트 파일)·`*-result.json`(base64 생략)·`tools-list.json`·`summary.json`.

## Gotchas

- 결과 상한은 256KB(`MCP_TOOL_RESULT_MAX_BYTES`)다. 형식은 한 번에 하나만 받는다. 넘으면 `MCP_TOOL_RESULT_TOO_LARGE` 오류가 온다.
- xlsx 는 생성 시각(`docProps/core.xml`)이 매번 달라 바이트가 같을 수 없다. 칸 값·서식·병합·열 너비로 대조한다. hwp(rhwp)는 시각 도장이 없어 바이트가 같다.
- 웹 익명 생성은 template 로 내려간다. enhanced 결과를 웹과 대조할 때는 `/api/ask` 를 다시 부르지 말고 도구가 돌려준 `riskAssessment.structuredRows`·`reviewItems.structuredRows` 로 편집기 모양 본문을 만들어 내보내기 라우트에 보낸다(생성은 매번 같지 않다).
- 로컬 레거시 토큰은 사이트 귀속이 없어 다른 생성 도구도 작업공간에 저장하지 않는다. DB 토큰으로 운영을 구동할 때도 이 도구는 저장하지 않는다.
- 「검토 필요:」 행은 안전 지식 DB 근거 상태에 따라 생긴다. 시나리오 3 에서 0건이면 FAIL 로 적지 말고 입력과 근거 수를 적는다.
