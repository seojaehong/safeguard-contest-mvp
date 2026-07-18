# SafeClaw Live Provider Readiness

Checked at: 2026-07-19 KST  
Source HEAD at check time: `1f8d207e421aec50831a93cd1da07a9b4c1d35d4`  
Target: `https://www.safeclaw.kr`

## Summary

Live production now proves three important runtime facts:

- Deployment identity is mapped through `/api/build-info`.
- Input photo hazard analysis is ready for OpenAI vision/OCR execution with up to 10 photos.
- KOSHA retrieval is ready, including the verified local corpus and exact trust registry.

The remaining provider blocker is outbound dispatch. It is still intentionally preview-only because the server-side provider dispatch idempotency contract is locked off in code.

## Live GET Checks

| Endpoint | HTTP | Result |
| --- | ---: | --- |
| `/api/build-info` | 200 | Live commit is `1f8d207e421aec50831a93cd1da07a9b4c1d35d4`, branch `master`, environment `production`. |
| `/api/input-photos/hazard-analysis` | 200 | Ready. Provider `openai`, model `gpt-4.1-mini`, `apiKeyPresent=true`, `maxInputPhotos=10`, Before/After supported. |
| `/api/workflow/dispatch` | 200 | Preview-only. Email, SMS, and Kakao dispatch are unavailable because persistent provider idempotency is unavailable. |
| `/api/safety-reference/status` | 200 | Ready. Supabase catalog, local KOSHA corpus, and exact trust registry are all ready. |
| `/api/sif-embedding-gate/status` | 200 | Ready for approval. SIF corpus is prepared, but embedding generation, DB upload, and vector search remain approval-held. |

## KOSHA Detail

The live `/api/safety-reference/status` body proves:

- `items=9920`
- `technicalTotal=1040`
- `technicalSupportRegulations=237`
- `technicalGuidelines=803`
- `technicalSplitOk=true`
- `catalogSearchOk=true`
- `searchReady=true`
- `localCorpus.status=ready`
- `localCorpus.itemCount=234`
- `localCorpus.chunkCount=7127`
- `exactTrustRegistry.status=ready`
- exact stable keys: `D-C-13`, `D-C-7`, `B-E-10`

This closes the older 2026-07-18 live provider finding where the KOSHA local corpus was `unconfigured` and the endpoint returned 503.

## Dispatch Blocker

`/api/workflow/dispatch` still returns:

- `capability=false`
- `mode=preview_only`
- `reason=persistent_idempotency_unavailable`

This is not an environment-only issue. The current route keeps:

```ts
const PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED = false;
```

Therefore real outbound dispatch should not be presented as live-ready until the provider idempotency contract is implemented, tested, and intentionally unlocked.

## SIF Embedding Boundary

The SIF embedding gate remains correctly locked:

- SIF corpus count: `6032`
- canary embedding: performed, DB upload `0`
- runtime DB probe: migration required
- vector feature flag: off
- next gate: explicit SIF-only migration approval

No DB migration, full embedding generation, DB upload, or vector flag activation was performed in this check.

## Next Work

1. Keep KOSHA guide readiness as live-ready evidence, but do not treat SIF vector search as active.
2. Implement provider dispatch idempotency as a separate TDD workstream before enabling real sending.
3. Preserve preview-only dispatch until provider duplicate prevention, log persistence, and retry behavior are proven against the target environment.
