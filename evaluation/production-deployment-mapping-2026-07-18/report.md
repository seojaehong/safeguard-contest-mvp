# SafeClaw Production Deployment Mapping

Generated: 2026-07-18 KST

## Summary

The latest confirmed successful GitHub production deployment maps `www.safeclaw.kr` to product commit:

`62cccafbdeb5a87e045c9f9bd7c43619029ddd17`

That commit is `docs: record live harness quality pass`, which records the passing live DB/SIF/KOSHA harness probe after the structured-row and control-surface fixes.

The current local/pushed `master` HEAD is:

`d137bc5184b16bbd68973f049840898656c4bc29`

`d137bc51` only adds reconciliation documentation under `evaluation/`; it does not change product runtime code. Therefore the current production product surface is aligned with the latest product-code state that matters for the imminent demo.

## Evidence

GitHub Deployments API:

- Environment: `Production`
- Deployment SHA: `62cccafbdeb5a87e045c9f9bd7c43619029ddd17`
- State: `success`
- Description: `Deployment has completed`
- Target URL: `https://safeguard-contest-rlwyjidew-seojaehongs-projects.vercel.app`
- Created at: `2026-07-17T20:16:46Z`

Live response headers from `https://www.safeclaw.kr`:

- `Server: Vercel`
- `X-Matched-Path: /`
- `X-Vercel-Cache: MISS`
- `X-Vercel-Id: icn1::icn1::xdhrm-1784319599123-3b84e75bbaad`

## Current CI State

At the time of this mapping check:

- `d137bc51` CI: in progress.
- `62cccafb` CI: in progress, with typecheck already completed and full test step running.

This report does not claim CI completion. It records the deployment mapping and the product-code equivalence of the current doc-only HEAD.

## Practical Demo Decision

Use `https://www.safeclaw.kr` for the demo path:

1. `/workspace` generation.
2. document review.
3. share session creation.
4. `작업자 화면 미리보기`.
5. `/share/[sessionId]?workerId=...` recipient confirmation surface.

Keep email/SMS/Kakao as preview-only until persistent idempotency and provider dry-run evidence are added.
