# Document export capability truth

Verdict: `PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_DOCUMENT_EXPORT_CAPABILITY_TRUTH_LIVE_PENDING`

Current source `8389302c29ba8383b494554179f4ec461b57eeef` now exposes the production document-export admission state without exposing credentials. When distributed admission is unavailable, the Documents workbench disables server-only XLSX/HWP actions and keeps browser PDF plus client-side compatibility formats available.

## Local production evidence

- `GET /api/export/pdf`: 200, `ready=false`, `mode=unavailable`, `reason=distributed_limiter_unavailable`.
- A guarded POST remains fail-closed at 503 before export work.
- Desktop 1440x723: body 723, no horizontal overflow, XLSX/HWP disabled, browser PDF and legacy XLS enabled.
- Mobile 390x723: body 723, no horizontal overflow, the same capability split remains visible.
- Focused regression: 4 files / 64 tests PASS.
- Strict typecheck PASS.
- Next.js 15.5.22 build PASS, 28 static pages.

## Boundary

This is product-capability truth, not distributed admission activation. Production deployment and a fresh live GET/browser check remain required. No database, provider, Share-session, vector, wiki, or KOSHA registry mutation occurred. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`, and fully automated launch remains forbidden.
