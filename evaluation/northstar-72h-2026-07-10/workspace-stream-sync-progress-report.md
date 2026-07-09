# Workspace Stream Sync Progress Check

Date: 2026-07-10

## Finding

Live `/api/ask/stream` does emit a final event, and the workspace UI applies that final payload. The earlier `3/12` concern was reproduced as a progress-UX problem rather than a final-state sync failure: enhanced generation can take about 70-80 seconds, while the previous progress summary stayed visually close to the initial `3/12` state until the final payload arrived.

## Fix

- Added `buildGenerationProgressState` so the document step progress is derived from live stream console events while generation is in flight.
- The progress summary now changes from fixed `3/12` to in-flight copy such as `7/12 · 실시간 검토 10건 · 진행 2건`.
- Early active stream lines also move the visible count, so the UI does not keep the first number at `3/12` while external generation is already working.
- The generation focus message now shows the latest meaningful stream activity, e.g. `AI 본문 초안 생성 확인됨`.
- Completion still requires the final generated payload; in-flight progress is capped below `12/12` until data is actually applied.

## Evidence

- Local early in-flight UI proof: `evaluation/northstar-72h-2026-07-10/stream-sync-local/workspace-enhanced-stream-early-progress-fixed.json`
- Local early in-flight screenshot: `evaluation/northstar-72h-2026-07-10/stream-sync-local/workspace-enhanced-stream-early-progress-fixed.png`
- Live final sync proof: `evaluation/northstar-72h-2026-07-10/stream-sync-live/workspace-enhanced-stream-live.json`
- Live final screenshot: `evaluation/northstar-72h-2026-07-10/stream-sync-live/workspace-enhanced-stream-live.png`

## Verification

- Direct live stream probe: final event arrived with `dbHarness` present.
- Live UI probe: `ok=true`, edit button visible, ready message visible, progress `12/12`.
- Local in-flight probe after 5 seconds: `progress="7/12실시간 검토 10건 · 진행 2건"`.
- `npm.cmd test -- tests\workspace-generation-progress.test.ts tests\agent-console-copy.test.ts tests\sse-client.test.ts` -> 24 passed.

## Remaining Risk

Enhanced mode can still take around a minute or longer depending on external model/API latency. This patch makes that wait understandable on screen; it does not shorten the generation pipeline itself.
