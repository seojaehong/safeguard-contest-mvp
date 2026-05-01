# Accident resilience checklist verification

Generated: 2026-04-27

## Local static verification
- `npm.cmd run typecheck`: passed before the PR fix commit.
- `npm.cmd run build`: passed before the PR fix commit.
- `fetchWithTimeout` uses `AbortController` and calls `controller.abort()` at the configured timeout, so the underlying request is cancelled rather than only racing a timer.

## Fix 1: latency separation
- `runAsk` now starts `fetchAccidentCases` separately from the main law/weather/training/KOSHA reference `Promise.all`.
- `/api/ask` uses `requestTimeoutMs: 5000`, `retryCount: 0`, and `budgetLabel: KOSHA accident case enrichment budget` for accident-case enrichment.
- Direct KOSHA accident API latency samples: 8/8 succeeded, average 797ms, max 1943ms, so the 5s budget is not tight for the current live endpoint.

## Fix 2: parser and live-failure distinction
- Invalid public-data key smoke was run against a separate local production server on port 3024.
- Result: `accidentMode=fallback`, `accidentDetail=KOSHA 국내재해사례 fallback: KOSHA accident case enrichment budget: Unauthorized`.
- This confirms key/auth failure is surfaced in detail and no longer looks like a normal empty result.

## Evidence files
- `evaluation/2026-04-27-accident-resilience-negative/invalid-key-smoke.json`
- `evaluation/2026-04-27-accident-resilience-negative/kosha-latency-summary.json`
- `evaluation/2026-04-27-accident-resilience-negative/kosha-latency-samples.json`
