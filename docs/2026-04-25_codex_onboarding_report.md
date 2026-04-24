# Safeguard Contest MVP Onboarding Report

- Date: 2026-04-25
- Repository: `https://github.com/seojaehong/safeguard-contest-mvp`
- Local path: `C:\Users\iceam\OneDrive\5.산업안전\문서\Playground\safeguard-contest-mvp`
- Branch: `master`
- Commit: `1a6184268db67e6ee8a70fee1b2ab411f202f53f`

## Summary

This repository is a Next.js App Router MVP for industrial safety legal/copilot flows.

Current product shape:

- landing/demo page at `/`
- question flow at `/ask`
- search flow at `/search`
- detail pages for:
  - `/law/[id]`
  - `/precedent/[id]`
  - `/interpretation/[id]`
- API routes:
  - `/api/search`
  - `/api/ask`

## Stack

- Next.js `15.3.0`
- React `19.0.0`
- TypeScript
- `korean-law-mcp`
- OpenAI SDK

## Key Structure

- `app/`
  - App Router pages and API routes
- `components/`
  - `AnswerPanel.tsx`
  - `CitationList.tsx`
  - `ResultCard.tsx`
  - `SearchBox.tsx`
- `lib/`
  - `search.ts`: main search / ask orchestration
  - `legal-sources.ts`: source aggregation
  - `lawgo.ts`: Law.go adapter
  - `korean-law-mcp.ts`: MCP augmentation
  - `ai.ts`: answer generation
  - `mock-data.ts`: fallback demo data
- `docs/`
  - product and pitch materials

## Verification

Executed successfully:

- `npm.cmd install`
- `npm.cmd run typecheck`
- `npm.cmd run build`

Build result summary:

- build passed
- static/dynamic routes generated successfully
- no TypeScript errors detected

## Environment Notes

Relevant `.env.example` flags:

- `LAWGO_MOCK_MODE=true`
- `KOREAN_LAW_MCP_ENABLED=false`
- `OPENAI_API_KEY=`
- `OPENAI_MODEL=gpt-4.1-mini`

Practical interpretation:

- default mode is demo/mock friendly
- enabling live augmentation requires MCP/Law.go credentials
- enabling real answer generation requires OpenAI key

## Risks / Attention Points

1. `next@15.3.0` prints a security warning during install and should be upgraded to a patched release before public deployment.
2. There is currently no local `.env.local` in this onboarding step, so runtime behavior will stay in mock/default mode unless configured later.
3. `package.json` still includes shell-script entries like `./scripts/run_daily_dryrun.sh`, which may need Windows-compatible handling if we use them locally.

## Recommended Next Step

Best immediate next task:

- review feature gaps or contest readiness in this repo
- then patch one concrete area at a time:
  - security/version bump
  - Windows run compatibility
  - citation quality
  - demo UX refinement
  - dryrun automation stabilization
