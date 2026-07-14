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

## Honest boundary

The final post-compression mobile browser rerun was not completed before the submission hotfix commit. Source-level responsive rules, focused behavior tests, strict typecheck, static audit, and production build are green. A final deployed mobile screenshot remains a post-push check.
