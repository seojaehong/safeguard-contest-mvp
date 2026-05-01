# Vercel deployment note

Generated: 2026-04-27

## Result
- `vercel.cmd deploy --yes --prod` was attempted from `C:\Users\iceam\dev\safeguard-contest-mvp`.
- Deployment did not start because the local Vercel CLI has no stored credentials.

## Blocking message
`Error: No existing credentials found. Please run vercel login or pass --token`

## Needed from user
- Either run `vercel login` locally, or provide a `VERCEL_TOKEN` for CLI deployment.
- Vercel project env must include the same live keys used in local `.env.local`: `DATA_GO_KR_SERVICE_KEY`, `WORK24_AUTH_KEY`, `LAWGO_OC`, `GEMINI_API_KEY`, and n8n values if workflow dispatch should work from deployment.
