# SafeClaw Live Provider Readiness

Checked at: 2026-07-18 KST  
Authoritative local HEAD at check time: `e3b64681f3ad295676d9a237f0ba8534cb092622`  
Target: `https://www.safeclaw.kr`

## Summary

The live environment has OpenAI vision readiness for input-photo hazard analysis, but provider dispatch is still preview-only and the KOSHA local corpus readiness endpoint is fail-closed.

## Live GET Checks

| Endpoint | HTTP | Result |
| --- | ---: | --- |
| `/api/input-photos/hazard-analysis` | 200 | Ready. Provider `openai`, model `gpt-4.1-mini`, `apiKeyPresent=true`, `maxInputPhotos=10`. |
| `/api/workflow/dispatch` | 200 | Preview-only. Email, SMS, and Kakao dispatch are unavailable because persistent idempotency is unavailable. |
| `/api/safety-reference/status` | 503 | Degraded. Supabase catalog is connected, but the KOSHA local corpus is unconfigured. |
| `/api/sif-embedding-gate/status` | 200 | Ready for approval. SIF corpus prepared; embedding generation and DB upload remain held before approval. |

## KOSHA Detail

The live `/api/safety-reference/status` body shows:

- `items=9920`
- `technicalTotal=1040`
- `technicalSupportRegulations=237`
- `technicalGuidelines=803`
- `technicalSplitOk=true`
- `catalogSearchOk=true`
- `searchReady=false`
- `localCorpus.status=unconfigured`

The route intentionally returns 503 unless both the Supabase catalog and the verified local KOSHA corpus are ready. Current live behavior is therefore fail-closed rather than silently treating an incomplete local corpus as ready.

The committed subset at `evaluation/kosha-verified-subset-2026-07-14/subset` is not a deployable search corpus. Its manifest records `launch_ready=false`, `accepted_count=0`, `success=0`, `chunks=0`, and blockers including `verified-subset-empty` and `official-metadata-artifact-missing`.

## Product Implication

- Photo hazard analysis can be demonstrated in the live environment if authentication/storage prerequisites are met.
- Foreign-language dispatch can be previewed, but real provider sending is not live-ready.
- KOSHA-backed retrieval should be described carefully: Supabase catalog and exact trusted references are present, but the local KOSHA corpus readiness gate is not live-ready.
- SIF embedding remains approval-held, so it should not be described as uploaded or active in DB search.

## Next Action

1. Decide whether production needs the verified local KOSHA corpus bundled with the deployment or mounted/configured through a private runtime artifact.
2. If bundling, add only a launch-ready corpus, not the empty verified-subset failure artifact.
3. If configuring externally, set `KOSHA_GUIDE_CORPUS_DIR` in the production runtime and prove `/api/safety-reference/status` returns ready.
4. Keep SIF embedding and DB upload behind explicit approval.
