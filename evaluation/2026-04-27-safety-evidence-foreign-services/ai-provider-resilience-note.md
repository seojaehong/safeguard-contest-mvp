# AI provider resilience note

Generated: 2026-04-27

## Why this patch exists
- Production smoke showed public-data integrations were live, but Gemini returned a transient `503 high demand` response.
- The app now tries `GEMINI_MODEL` first, then `GEMINI_FALLBACK_MODELS` in order.
- If an OpenAI key is configured, the chain can fall back to OpenAI after Gemini model exhaustion.

## Default model chain
- `gemini-2.5-flash`
- `gemini-2.0-flash`
- `gemini-2.0-flash-lite`
- `gemini-flash-latest`

## Verification
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed.
