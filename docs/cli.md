# SafeClaw CLI — 에이전트·자동화 만능 어댑터

`safeclaw`는 SafeClaw MCP 도구 계층(`docs/mcp-server.md`)을 그대로 재사용하는
커맨드라인 클라이언트다. bash형 에이전트(OpenClaw류)·cron·쉘 스크립트처럼
MCP 클라이언트를 붙일 수 없는 자동화가 SafeClaw를 "쓰기만 하면 되는" 도구로
만드는 게 목적이다. REST를 새로 만들지 않고 `POST /api/mcp/mcp` JSON-RPC 계약
하나만 재사용한다 — 도구 계약이 하나로 유지된다.

- 위치: `cli/` (독립 npm 패키지, 루트 워크스페이스와 분리)
- 의존성: 0개 (Node 18+ 내장 `fetch`만 사용, 순수 ESM `.mjs`, 빌드 파이프라인 없음)
- 진입점: `cli/safeclaw.mjs` (실행 스크립트) + `cli/lib.mjs` (인자 파싱·출력 포맷·전송 로직, 테스트 가능한 순수 함수)

## 설치 / 실행

npm에는 아직 배포하지 않았다(`npm publish`는 추후). 지금은 저장소를 clone한
뒤 Node로 직접 실행한다.

```bash
git clone https://github.com/seojaehong/safeguard-contest-mvp.git
cd safeguard-contest-mvp
export SAFECLAW_TOKEN=sc2_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

node cli/safeclaw.mjs --help
node cli/safeclaw.mjs weather 서울
```

전역 명령처럼 쓰고 싶다면 셸 alias를 걸어도 된다:

```bash
alias safeclaw="node $(pwd)/cli/safeclaw.mjs"
```

npm 배포 후에는 `npx safeclaw <command>`로 바로 쓸 수 있게 될 예정이다.

## 인증 · 설정

| 환경변수 | 필수 | 기본값 | 설명 |
|----------|------|--------|------|
| `SAFECLAW_TOKEN` | 예 | — | SafeClaw MCP 토큰과 동일한 풀. 없으면 CLI가 exit 1로 명확히 안내하고 종료한다. |
| `SAFECLAW_BASE` | 아니오 | `https://www.safeclaw.kr` | 로컬 dev 서버 등으로 바꾸고 싶을 때(`http://localhost:3000`). |

토큰이 없을 때:

```
$ safeclaw weather 서울
오류: SAFECLAW_TOKEN 환경변수가 설정되지 않았습니다.
  예: SAFECLAW_TOKEN=sc2_xxxxx safeclaw weather 서울
  토큰은 SafeClaw MCP 토큰과 동일한 풀을 사용합니다 (docs/mcp-server.md 참고).
$ echo $?
1
```

## 명령

| 명령 | MCP 도구 | 타임아웃 | 설명 |
|------|----------|----------|------|
| `safeclaw docpack "<질문>" [--mode full\|enhanced\|template] [--json]` | `generate_safety_docpack` | 300s | 안전 문서팩 생성. 사람이 읽기 좋은 요약(시나리오·기상·문서 목록·증빙 라벨) 또는 `--json` 원본. |
| `safeclaw weather <지역>` | `get_weather_signals` | 60s | 현장 기상 신호(실황·특보·대응 조치). 지원 지역: 서울/인천/안산/부산/광주/대구/창원(그 외는 서울로 폴백, 응답에 표시됨). |
| `safeclaw validate <파일\|->` | `validate_safety_citations` | 60s | 텍스트(파일 또는 stdin `-`)의 법령 조문 인용을 검증하고 미검증 조문을 제거·치환. **제거된 조문이 있으면 exit 1** (자동화 파이프라인에서 게이트로 쓰기 위함). |
| `safeclaw cases <키워드>` | `search_accident_cases` | 60s | KOSHA 유사 재해사례 검색. |
| `safeclaw evidence [docType]` | `get_evidence_mapping` | 60s | 중대재해처벌법 시행령 제4조 증빙 매핑. `docType` 생략 시 전체 테이블. |

공통 옵션:

- `--json` — 사람이 읽기 좋은 요약 대신 도구가 반환한 JSON 원본을 그대로 출력.
- `--help`, `-h` — 도움말 (전역: `safeclaw --help`, 명령별: `safeclaw docpack --help`).
- `--version`, `-v` — 버전 출력.

Exit code 규율: **0**=성공, **1**=런타임 오류(인증 401·요청 제한 429·MCP 비활성 501·네트워크·타임아웃·`validate`에서 인용 제거 발생), **2**=사용법 오류(인자 누락·잘못된 값·알 수 없는 명령/옵션).

## 예시

```bash
# 기상 신호 — 사람이 읽기 좋은 요약
SAFECLAW_TOKEN=sc2_xxx safeclaw weather 서울

# 문서팩 — JSON 원본 (자동화 파이프라인에서 jq로 후처리할 때)
SAFECLAW_TOKEN=sc2_xxx safeclaw docpack "3층 외벽 비계 해체 작업" --mode full --json

# 초안 파일을 인용 게이트로 검증 — 제거된 조문이 있으면 파이프라인 실패시키기
SAFECLAW_TOKEN=sc2_xxx safeclaw validate ./draft.txt || echo "검증 실패: 미검증 조문 제거됨"

# stdin으로도 검증 가능
cat draft.txt | SAFECLAW_TOKEN=sc2_xxx safeclaw validate -

# 재해사례 검색
SAFECLAW_TOKEN=sc2_xxx safeclaw cases "지게차 충돌"

# 증빙 매핑 — 단건 / 전체
SAFECLAW_TOKEN=sc2_xxx safeclaw evidence riskAssessment
SAFECLAW_TOKEN=sc2_xxx safeclaw evidence
```

## 에이전트 연동 예시 (OpenClaw류 bash 에이전트)

MCP 클라이언트 프로토콜을 직접 구현하지 못하는 bash형 에이전트도 `--help`
출력만 읽으면 SafeClaw를 도구로 쓸 수 있다. 예를 들어 OpenClaw가 셸 도구
호출 능력만 가지고 있을 때, 시스템 프롬프트에 다음과 같이 등록하면 된다:

```
당신은 현장 안전관리자 에이전트입니다. 다음 셸 명령으로 SafeClaw 안전 도구를
쓸 수 있습니다 (SAFECLAW_TOKEN은 이미 환경변수로 설정되어 있습니다):

  node /opt/safeguard-contest-mvp/cli/safeclaw.mjs docpack "<오늘 작업 한 줄 설명>" --json
  node /opt/safeguard-contest-mvp/cli/safeclaw.mjs weather <현장 지역>
  node /opt/safeguard-contest-mvp/cli/safeclaw.mjs validate <초안 파일 경로>

작업 지시를 받으면: 1) weather로 기상을 확인하고, 2) docpack으로 문서 초안을
생성한 뒤, 3) 초안을 파일로 저장해 validate로 법령 인용을 검증하고, exit code가
1이면(미검증 조문 제거됨) 초안을 다시 다듬어 재검증하세요. 자세한 옵션은
`node cli/safeclaw.mjs --help`를 참고하세요.
```

에이전트는 매 스텝마다 exit code와 stdout/stderr만 보고 다음 행동을 결정하면
되므로, MCP 프로토콜(JSON-RPC/SSE)을 전혀 몰라도 SafeClaw 도구 계층 전체를
쓸 수 있다. cron이 같은 방식으로 `safeclaw weather 인천 --json | jq ...`를
정기 실행해 기상 신호를 파일로 적재하는 것도 동일한 패턴이다.

## 검증

- 순수 로직(인자 파싱·SSE/JSON-RPC 파싱·출력 포맷·exit code 결정)은
  `cli/lib.mjs`에 있고 `tests/cli.test.ts`(루트 vitest)에서 유닛 테스트한다.
  네트워크는 `fetchImpl` 주입으로 모킹한다. `--help` 프로세스 스모크 테스트도
  포함한다(`node:child_process`로 실제 실행).
- 실동작은 prod(`https://www.safeclaw.kr`)에 대해 `weather`·`validate`·`cases`·
  `evidence`를 실제 토큰으로 실행해 확인했다(위 예시 출력 참고).
