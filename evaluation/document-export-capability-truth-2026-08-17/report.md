# Document export capability truth

Verdict: `PASS_LIVE_PRODUCTION_DOCUMENT_EXPORT_CAPABILITY_TRUTH`

Production `9a4a703b6b1ff370a362bfafee42dfff9141be31` includes product commit `f28ed068f76109453d9265314d406242badbe40c`. The live Documents workbench exposes the real server-export admission state without credentials: server-only XLSX/HWP actions are locked while browser PDF and client-side compatibility formats remain available.

The desktop/mobile geometry receipt remains from `62b8bb4a`; no governed Documents export UI path changed in the configuration-truth patch. The admission API and shared-limiter compatibility were re-probed on `9a4a703b`.

## Live production evidence

- `GET /api/export/pdf`: 200, `configurationState=absent`, `ready=false`, `mode=unavailable`, `reason=distributed_limiter_unavailable`.
- Desktop 1440x723: body 723, no horizontal overflow, panel 843px, primary export buttons 805px, beta buttons 191.25px.
- Mobile 390x723: body 723, no horizontal overflow, panel 262px, primary export buttons 236px, beta buttons 220px.
- XLSX/HWP are disabled; browser PDF, legacy XLS, and HWPX draft remain enabled.
- The narrow desktop panel widened from 206.25px to 843px; mobile widened from 129px to 262px.
- Focused regression: 4 files / 64 tests PASS. Frontend route coverage: 39/39 PASS.
- Frontend consistency audit: 33 page files, 24 component files, 0 violations. Strict typecheck and Next.js 15.5.22 build PASS, 28 static pages.
- Shared admission compatibility: 10 files / 67 tests PASS across export, photo analysis, public Ask/provider admission, cancellation, search, and safety-reference boundaries.

## Boundary

This proves product-capability truth and a usable fallback surface, not distributed server-export activation. Operator configuration is still required before XLSX/HWP server actions can be enabled. No database, provider, Share-session, vector, wiki, or KOSHA registry mutation occurred. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`, and fully automated launch remains forbidden.
