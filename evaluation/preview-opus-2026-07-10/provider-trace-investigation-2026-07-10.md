# SafeClaw preview provider/model trace investigation

작성일: 2026-07-10
대상 저장소: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\backend-harness-gate`

## 결론

`evaluation/preview-opus-2026-07-10/response-opus.json` 만으로는 "Anthropic Opus(`claude-opus-4-8`)가 실제 호출됐다"는 것을 입증할 수 없다.

오히려 현재 파일 조합이 보여주는 것은 아래에 가깝다.

1. 요청은 `aiMode: "enhanced"`였다.
2. `enhanced` 모드에서는 `ai-deliverables`의 Anthropic/Vertex 문서 생성 경로가 아니라 DB 하네스 row-first 조립 경로가 우선이다.
3. 응답의 `status.detail` 과 `status.policyNote` 는 자유서술 answer 경로에서 `OpenAI`가 사용됐다는 흔적을 직접 남긴다.
4. `generationEvidence` 는 DB 하네스 packet 무결성은 봉인하지만 provider/model은 봉인하지 않는다.

따라서 현재 증거로는 "Opus 호출 성공"이 아니라, "OpenAI answer + DB harness deterministic structured output"이 더 강하게 읽힌다.

## 조사 입력

- `evaluation/preview-opus-2026-07-10/request.json`
- `evaluation/preview-opus-2026-07-10/response-opus.json`
- `evaluation/preview-opus-2026-07-10/report.json`
- `app/api/ask/route.ts`
- `lib/search.ts`
- `lib/ai.ts`
- `lib/ai-provider-policy.ts`
- `lib/ai-deliverables.ts`
- `lib/ai-deliverables-policy.ts`
- `lib/generation-evidence.ts`
- `lib/run-ask-mode.ts`

## 증거 체인

### 1. 요청 자체가 `enhanced`

`evaluation/preview-opus-2026-07-10/request.json`:

```json
{
  "question": "...",
  "aiMode": "enhanced"
}
```

이 값은 `lib/run-ask-mode.ts` 기본값(`enhanced`)과도 일치한다.

- `lib/run-ask-mode.ts:5-10`

## 2. `/api/ask` 는 `runAsk()` 결과에 generation evidence만 덧씌운다

- `app/api/ask/route.ts:28-33`

즉 `/api/ask` 라우트는 provider/model을 새로 계산하거나 별도 기록하지 않고:

1. `runAsk(question, { aiMode, harnessMemory })`
2. `attachGenerationEvidence(result, ...)`
3. `NextResponse.json(sealed)`

순서로 끝난다.

## 3. `enhanced` 와 `full` 은 생성 파이프라인이 다르다

`lib/search.ts` 에서 `deliverablesPromise` 는 `aiMode === "full"` 일 때만 돈다.

- `lib/search.ts:1540`

그리고 결과 요약 문자열도 분기한다.

- `lib/search.ts:1751-1766`

핵심 문구:

- `enhanced`: `AI_MODE=enhanced (DB 하네스 row-first: 위험성평가 row 확정, TBM 구조 deterministic 조립)`
- `full`: `Gemini 본문 ... 채움`

즉 이번처럼 `enhanced` 요청이면 `AI_DELIVERABLES_PROVIDER=claude` / `ANTHROPIC_MODEL=claude-opus-4-8` 가 설정돼 있어도, 그 설정이 핵심 문서 생성 success evidence로 바로 연결되지 않는다.

## 4. `response-opus.json` 이 스스로 말하는 것은 OpenAI answer 경로다

`response-opus.json` 에는 아래 값이 들어 있다.

- `generationMode: "enhanced"`
- `status.detail`: `Law.go와 OpenAI 응답을 결합했습니다. ... / AI_MODE=enhanced ...`
- `status.policyNote`: `OpenAI 응답은 timeout 20000ms, retry 없음, 실패 시 graceful fallback 정책을 따릅니다.`

이 문구는 `lib/ai.ts` 의 자유서술 answer 경로에서 만들어진다.

- `lib/ai.ts:11`
- `lib/ai.ts:62-85`
- `lib/ai.ts:263-296`

특히:

- `providerLabel: "OpenAI"` (`lib/ai.ts:84`)
- `Law.go와 ${response.providerLabel} 응답을 결합했습니다.` (`lib/ai.ts:287`)

따라서 현재 응답 파일은 Opus 호출 증명보다 OpenAI answer 사용의 간접 증거로 읽힌다.

## 5. Anthropic provider/model 설정은 `ai-deliverables` 경로에만 연결된다

Anthropic 전환 플래그는 `lib/ai-provider-policy.ts` 에서만 결정된다.

- `lib/ai-provider-policy.ts:16-27`

규칙:

- `AI_DELIVERABLES_PROVIDER=claude|anthropic`
- `ANTHROPIC_API_KEY` 존재
- 그때만 `provider: "anthropic"`
- 모델은 `ANTHROPIC_MODEL` 없으면 기본 `claude-sonnet-5`

실제 호출은 `lib/ai-deliverables.ts` 의 `callGemini()` 안에서 분기한다.

- `lib/ai-deliverables.ts:46-51`
- `lib/ai-deliverables.ts:92-104`

즉 이 설정은 "structured deliverables generation" 경로용이다. 이번 `enhanced` 요청의 answer 경로를 바꾸지 않는다.

## 6. `full` 이어도 성공 응답만으로는 provider/model 봉인이 안 된다

`generateAllDeliverablesWithDiagnostics()` 는 아래 진단만 반환한다.

- `geminiAvailable`
- `groupResults[]`
- `filledKeys[]`

- `lib/ai-deliverables.ts:1031-1113`

여기에 provider/model 필드는 없다.

또 `generationEvidence` 스냅샷도 아래만 봉인한다.

- `question`
- `scenario`
- `dbHarnessPacket`
- `responseContentDigest`
- `generatedAt`

- `lib/generation-evidence.ts:113-146`

즉 성공한 `full` 응답이라도 현재 계약상:

- 어떤 provider를 썼는지
- 어떤 model이었는지
- Anthropic -> Vertex fallback이 있었는지

를 HMAC 봉인된 authoritative metadata로 남기지 않는다.

## 7. heavy docs 는 Opus가 아니라 Haiku로 강제 라우팅될 수 있다

`foreign`, `free` 같은 heavy output 문서는 Anthropic configured model이 Opus여도 `claude-haiku-4-5` 로 바뀐다.

- `lib/ai-deliverables-policy.ts:108`
- `lib/ai-deliverables-policy.ts:116-117`

따라서 나중에 `full` 모드에서 Opus 증명을 하더라도 "모든 문서가 Opus였다"는 식의 해석은 틀릴 수 있다. 문서별 model map이 필요하다.

## 8. 현재 로그는 실패 쪽만 비교적 보인다

현재 코드상 provider/model이 로그에 남는 지점은 주로 실패/경고다.

- `lib/ai-deliverables.ts:104`
  - `Anthropic deliverables (${anthropicModel}) failed; falling back to Vertex`
- `lib/ai-deliverables.ts:132`
  - `Vertex AI deliverables (${model}) failed`
- `lib/anthropic-client.ts`
  - `max_tokens` truncation warning only

반대로 "성공적으로 Anthropic model X를 사용했다"는 성공 로그는 없다.

즉 Vercel function logs를 열 수 있더라도, 현재 코드만으로는 success positive proof가 약하다.

## 9. Vercel preview 자체도 현재는 보호돼 있고, 로컬 CLI credential도 없다

`evaluation/preview-opus-2026-07-10/report.json` 에 이미 preview deployment 보호 상태가 기록돼 있다.

- `HTTP 401`
- `Protected deployment`
- `vercel_auth_enabled: true`

추가로 2026-07-10 현재 로컬 확인:

```text
vercel --version -> 50.32.3
vercel env ls -> Error: No existing credentials found. Please run `vercel login` or pass "--token"
```

즉 지금 이 워크트리에서 바로 Vercel logs/env를 열어 실증하는 경로도 막혀 있다.

## `response-opus.json` 단독 판정

### 가능한 판정

- DB 하네스 packet이 응답 내용과 함께 HMAC 봉인되었다.
- 요청이 `enhanced` 였다.
- 응답은 live law/weather/work24/kosha 데이터를 포함한다.
- answer 경로 설명 문자열은 `OpenAI` 기반 free-text answer 흔적을 남긴다.
- structured risk/TBM은 deterministic row-first 조립 결과로 보인다.

### 불가능한 판정

- `claude-opus-4-8` 가 실제로 호출됐는지
- Anthropic이 성공했는지 실패 후 Vertex로 fallback했는지
- 어떤 문서가 Anthropic이었고 어떤 문서가 Haiku였는지
- preview deployment env 에 `AI_DELIVERABLES_PROVIDER=claude` 와 `ANTHROPIC_MODEL=claude-opus-4-8` 가 실제로 설정돼 있었는지

## 안전하게 노출 가능한 최소 메타데이터 제안

### 제안 A. 응답 봉인 스냅샷에 runtime trace 최소 필드 추가

추가 위치:

- `lib/types.ts` 의 `GenerationEvidenceSnapshot`
- `lib/generation-evidence.ts` 의 `attachGenerationEvidence()`

권장 필드:

```ts
runtime: {
  askMode: "template" | "enhanced" | "full";
  answerProvider: "openai" | "vertex" | "mock";
  answerModel: string | null;
  deliverablesAttempted: boolean;
  deliverablesProvider: "anthropic" | "vertex" | null;
  deliverablesConfiguredModel: string | null;
  deliverablesDocModels?: Record<string, string>;
  deliverablesFallbackUsed?: boolean;
}
```

이 정도는 secret/token/prompt/raw completion을 노출하지 않고도 충분히 안전하다.
특히 `deliverablesDocModels` 가 있어야 `free`/`foreign` 의 Haiku 강등도 설명 가능하다.

### 제안 B. top-level 공개 필드는 더 작게

사용자/preview surface 에는 아래 정도면 충분하다.

```json
{
  "generationTrace": {
    "askMode": "enhanced",
    "answerProvider": "openai",
    "answerModel": "gpt-4.1-mini",
    "deliverablesAttempted": false
  }
}
```

`full` 일 때만:

```json
{
  "generationTrace": {
    "askMode": "full",
    "answerProvider": "openai",
    "answerModel": "gpt-4.1-mini",
    "deliverablesAttempted": true,
    "deliverablesProvider": "anthropic",
    "deliverablesConfiguredModel": "claude-opus-4-8"
  }
}
```

세부 문서별 model map은 `generationEvidence.snapshot.runtime` 안에만 넣고, 공개 응답에는 생략해도 된다.

## 로그 검증 방식 제안

### 제안 C. 성공 로그를 request-correlated structured log로 남기기

추가 위치:

- `lib/ai.ts` `generateWithOpenAI()` / `generateWithGeminiModel()`
- `lib/ai-deliverables.ts` `callGemini()`
- `app/api/ask/route.ts` `POST()`

권장 로그 payload:

```json
{
  "event": "safeclaw_generation_trace",
  "generatedAt": "2026-07-10T10:39:58.087Z",
  "askMode": "enhanced",
  "answerProvider": "openai",
  "answerModel": "gpt-4.1-mini",
  "deliverablesAttempted": false,
  "requestId": "<x-vercel-id or generated trace id>"
}
```

`full` + Anthropic 성공 시:

```json
{
  "event": "safeclaw_deliverables_trace",
  "group": "riskAssessment",
  "provider": "anthropic",
  "model": "claude-opus-4-8",
  "fallbackUsed": false,
  "requestId": "<same trace id>"
}
```

이 방식의 장점:

- prompt/raw output/token 같은 민감한 내용이 없다.
- provider/model/fallback 여부만 남긴다.
- Vercel 로그 검색 키가 생긴다.
- 나중에 `response-opus.json` 의 `generatedAt` 또는 공개 `traceId` 와 1:1 대조할 수 있다.

## 실무 판정 요약

### 지금 당장 말할 수 있는 것

- `response-opus.json` 은 Opus 성공 증거가 아니다.
- 현재 샘플은 `enhanced` 요청이라 deliverables Anthropic 증명 파일로도 부적합하다.
- 현재 응답만 보면 OpenAI answer 경로 흔적이 더 직접적이다.

### Opus 호출을 진짜 입증하려면 필요한 것

1. `aiMode: "full"` 요청
2. 성공 시 provider/model을 남기는 sealed runtime metadata 또는 success log
3. preview/prod deployment 의 Vercel credential 접근 또는 로그 export
4. 가능하면 request-level trace id

그 전까지는 `AI_DELIVERABLES_PROVIDER=claude`, `ANTHROPIC_MODEL=claude-opus-4-8` 는 "설정 의도" 또는 "코드상 가능 경로"일 뿐, 실제 호출 증거가 아니다.
