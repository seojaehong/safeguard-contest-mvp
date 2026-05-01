# Gemini key rotation note

Generated: 2026-04-27

## Result
- Local `.env.local` was rotated to the newly provided Gemini key. The key is ignored and was not committed.
- Gemini smoke succeeded with `gemini-2.5-flash`, `gemini-flash-latest`, and `gemini-2.5-flash-lite`.
- `gemini-2.0-flash` and `gemini-2.0-flash-lite` returned 404 for this key, so they were removed from the default fallback chain.
- Vercel production env was updated for `GEMINI_API_KEY` and `GEMINI_FALLBACK_MODELS`.

## Verification
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed.
