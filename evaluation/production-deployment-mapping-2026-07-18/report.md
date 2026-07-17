# SafeClaw Production Deployment Mapping

Generated: 2026-07-18 KST

## Summary

The latest confirmed successful GitHub production deployment maps `www.safeclaw.kr` to commit:

`f6c6b5ce471f442be0209e3e508fdf8f98e47fb9`

That commit is `docs: record production deployment mapping`. It is documentation/evaluation-only and sits on top of the product-code live harness pass commit `62cccafbdeb5a87e045c9f9bd7c43619029ddd17`.

The current local/pushed `master` HEAD is:

`f6c6b5ce471f442be0209e3e508fdf8f98e47fb9`

The current HEAD only adds reconciliation/deployment documentation under `evaluation/` after `62cccafb`; it does not change product runtime code. Therefore the current production product surface is aligned with the latest product-code state that matters for the imminent demo.

## Evidence

GitHub Deployments API:

- Environment: `Production`
- Deployment SHA: `f6c6b5ce471f442be0209e3e508fdf8f98e47fb9`
- State: `success`
- Description: `Deployment has completed`
- Target URL: `https://safeguard-contest-ym5dy3vhi-seojaehongs-projects.vercel.app`
- Created at: `2026-07-17T20:22:27Z`

Live response headers from `https://www.safeclaw.kr`:

- `Server: Vercel`
- `X-Matched-Path: /`
- `X-Vercel-Cache: MISS`
- `X-Vercel-Id: icn1::icn1::xdhrm-1784319599123-3b84e75bbaad`

## Current CI State

At the time of the latest mapping check:

- `f6c6b5ce` CI: in progress, with typecheck completed and the full test step running.

This report does not claim CI completion. It records the deployment mapping and the product-code equivalence of the current doc-only HEAD.

## Practical Demo Decision

Use `https://www.safeclaw.kr` for the demo path:

1. `/workspace` generation.
2. document review.
3. share session creation.
4. `작업자 화면 미리보기`.
5. `/share/[sessionId]?workerId=...` recipient confirmation surface.

Keep email/SMS/Kakao as preview-only until persistent idempotency and provider dry-run evidence are added.
