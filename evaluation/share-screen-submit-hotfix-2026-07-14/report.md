# Share screen submit hotfix

## Scope

- Keep the existing dispatch authority, persistence, idempotency, and fail-closed readiness logic.
- Remove duplicate workspace-level Share introduction, settings summary, and Before/After improvement history from the Share page.
- Keep the default flow focused on recipients, channels, language preview, message preview, and one primary send action.
- Remove the four-card evidence ledger from the confirmation surface.
- Turn the unauthenticated primary action into a real `/login` link instead of a disabled login-labelled button.

## Verification

- TDD RED: `tests/workspace-share-simplification.test.ts` failed on the legacy duplicate surfaces.
- Focused GREEN: 2 files, 7 tests passed.
- Strict TypeScript: passed.
- Frontend static audit: 32 pages, 23 product components, 0 coverage issues, 0 violations, 0 important declarations.
- Production build: Next.js 15.5.20, 28 static pages generated, exit 0.
- Browser first pass at 1440x1000: horizontal overflow 0, controls below 44px 0, primary actions 1. The measured 1,888px panel was then reduced further by removing the duplicate delivery summary, login notice block, verbose channel helper copy, and four-card confirmation ledger.
- Final mobile browser pass at 390x844: horizontal overflow 0, controls below 44px 0, primary actions 1, and a 12px separation between the message preview and send actions.
- Vietnamese preview: localized heading and eight message lines rendered, with 0 residual Korean metadata labels (`현장`, `작업`, `핵심 위험`, `필수 조치`, `안전공지`).
- The mobile preview heading was shortened and stacked so it no longer collapses into narrow vertical words.
- The stale launch-CTA and visual-gap tests were aligned to the direct Share route: route contract 1/1 passed and visual/share contracts 14/14 passed.
- Screenshot: `output/playwright/share-screen-submit-hotfix-2026-07-14/mobile-vietnamese-final.png`.

## Honest boundary

The final mobile rerun used the current local product HEAD and a real generated sample workpack. The Vercel preview remains authentication-protected, so public deployed visual verification is still separate from this local product verification. Production `www.safeclaw.kr` was not changed in this pass.
