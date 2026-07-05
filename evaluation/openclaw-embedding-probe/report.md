# OpenClaw OAuth + SafeClaw MCP Embedding Probe

## Verdict

OpenClaw OAuth 경로와 SafeClaw MCP 연결은 서로 같은 `safeclaw` 프로필에서 정상 작동했다. 이번 검증은 `/api/ask` 서버 AI 모드가 아니라, 외부 AI(OpenClaw/Codex)가 사용자 OpenAI OAuth 인증으로 SafeClaw MCP 도구를 호출하는 경로를 확인한 것이다.

결과 품질은 `/api/ask` 템플릿 호출과 다르다. OpenClaw 경로는 전체 문서 패키지 생성보다, 현장 질문에 대해 도구 호출 근거를 붙여 짧고 상황적인 판단을 만드는 쪽에 강하다.

## Auth And Tool Evidence

- OpenClaw profile: `safeclaw`
- Default model: `openai/gpt-5.5`
- OpenAI OAuth: usable
- SafeClaw MCP probe: 8 tools
- Actual tool call observed: `mcp__safeclaw.get_weather_signals(region="안산")`

## Agent Output

`	ext
[plugins] plugins.allow is empty; discovered non-bundled plugins may auto-load: codex (C:\Users\iceam\.openclaw-safeclaw\npm\projects\openclaw-codex-8902d781d4\node_modules\@openclaw\codex\dist\index.js). To trust them explicitly, set plugins.allow in openclaw.json (e.g. "plugins": { "allow": ["codex"] }). Run 'openclaw plugins list --enabled --verbose' or 'openclaw plugins inspect codex' to confirm plugin ids.
[plugins] plugins.allow is empty; discovered non-bundled plugins may auto-load: codex (C:\Users\iceam\.openclaw-safeclaw\npm\projects\openclaw-codex-8902d781d4\node_modules\@openclaw\codex\dist\index.js). To trust them explicitly, set plugins.allow in openclaw.json (e.g. "plugins": { "allow": ["codex"] }). Run 'openclaw plugins list --enabled --verbose' or 'openclaw plugins inspect codex' to confirm plugin ids.
[agent/embedded] failed to read mirrored session history for codex harness hooks
[agent/embedded] codex app-server one-shot cleanup retired shared client
**호출한 도구명**

`mcp__safeclaw.get_weather_signals(region="안산")`

**확인한 실측 기상값**

- 초단기실황: 현재 강수 없음
- 기온: 24.4℃
- 풍속: 0.2 m/s
- 1시간 강수량: 0 mm
- 참고 예보: 흐림, 단기 풍속 1~1.8 m/s, 강수확률 30%
- 특보 확인: 2026-07-05 10:00 기준 폭염주의보 해제 이력, 영향예보 보건 관심

**오늘 옥외 용접 작업 TBM 포인트 3가지**

1. **화재 감시 강화**
   비는 없고 바람도 약해 작업은 가능해 보이지만, 옥외 용접은 불티 비산이 핵심 위험입니다. 작업 반경 내 가연물 제거, 불티받이 설치, 소화기 배치, 작업 후 잔불 확인을 TBM에서 재확인하세요.

2. **흐림·약풍 조건에서 용접흄 체류 주의**
   풍속이 0.2 m/s로 매우 약해 용접흄이 작업자 호흡구역에 머물 수 있습니다. 작업자는 바람을 등지지 않도록 위치를 잡고, 방진마스크·보안면 착용 상태를 확인하세요.

3. **폭염 해제 후에도 온열질환 관리 유지**
   현재 24.4℃로 심한 폭염은 아니지만 보건 영향예보가 관심 단계입니다. 용접복·보안면 착용으로 체감 열부하가 커질 수 있으니 물 섭취, 그늘 휴식, 어지럼·두통 증상 보고를 작업 전 공유하세요.
[agent] run ce12c6fc-c159-408d-899c-0a3f21642256 ended with stopReason=stop
```

## Interpretation

- `/api/ask aiMode=full`: SafeClaw 서버가 AI와 공공 API를 결합해 위험성평가, TBM, 교육기록 등 문서 묶음을 생성한다.
- `OpenClaw OAuth + SafeClaw MCP`: 외부 AI가 SafeClaw 도구를 호출해 실측/조회값을 근거로 현장형 답변을 만든다.
- 이번 OpenClaw 답변은 기온, 풍속, 강수량, 특보/영향예보를 직접 근거로 삼아 TBM 포인트를 제시했으므로 “도구 임베딩으로 품질이 달라지는지”에 대해서는 Yes로 판정한다.

## Local Evidence Path

- `C:\Users\iceam\safeclaw-openclaw-poc\evaluation\openclaw-embedding-probe\openclaw-agent-local-main.txt`

