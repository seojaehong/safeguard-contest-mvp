# Share Recipient Portal Current Recheck

## Scope

Verified base: `f8d711c0affe7dfdb5c768950cd48aeeb3454563` + working patch before commit

This checkpoint reconciles the read-only delegation that reported no recipient portal with current master, then applies a bounded recipient-portal hydration fix. No database schema or Supabase data was changed.

## Current Findings

- Current master contains `app/share/[sessionId]/page.tsx`.
- Current master contains `app/api/share-sessions/[sessionId]/route.ts`.
- The recipient page supports invited-worker lookup with `workerId`, language-aware chrome, compact three-document review, and a read-confirmation button.
- The public share API resolves recipients from the server-side session snapshot and rejects forged worker fields before writing confirmations.
- The manager share panel exposes the worker portal as a secondary "작업자 화면 미리보기" action, not as the primary send CTA.
- The manager share panel still keeps provider delivery fail-closed when persistent idempotency or channel capability is unavailable.
- Production smoke on `https://www.safeclaw.kr/share/not-a-session?lang=vi` rendered Vietnamese chrome at 390px with horizontal overflow 0, but exposed a React hydration error.
- The hydration mismatch came from reading `window.location.search` in the initial `useState` value. The patch changes the initial language to server-stable `ko` and applies query language after mount.
- The browser test guard now requires both `.next/BUILD_ID` and `.next/prerender-manifest.json`, so a failed partial local build cannot accidentally start a broken production harness.

## Commands

```powershell
npm.cmd test -- tests\share-recipient-portal-browser.test.ts tests\workpack-share-authority-routes.test.ts --maxWorkers=1 --fileParallelism=false
npm.cmd test -- tests\share-recipient-portal-browser.test.ts tests\workpack-share-authority-routes.test.ts tests\workspace-share-simplification.test.ts tests\workflow-share-panel-behavior.test.ts --maxWorkers=1 --fileParallelism=false
npm.cmd run typecheck
```

## Evidence

- Initial route/API Vitest: 1 file PASS / 1 file skipped; 34 PASS / 4 skipped
- Focused share Vitest after hydration patch: 3 files PASS / 1 skipped; 52 PASS / 4 skipped
- Typecheck: PASS
- Production deployment for patch commit `5c954af4`: success (`https://safeguard-contest-6a7qlpkk8-seojaehongs-projects.vercel.app`)
- Production smoke after patch: `https://www.safeclaw.kr/share/not-a-session?lang=vi`, 390x844, HTTP 200, Vietnamese chrome present, Korean chrome absent, horizontal overflow 0, page errors 0
- Skipped browser cases require a successful local `.next/BUILD_ID`.
- Local Windows `npm.cmd run build` remains blocked by the existing `/404` prerender issue (`<Html> should not be imported outside of pages/_document`), while the same commit family passed remote GitHub Actions build.

## Decision

The current master does have a recipient portal implementation. The patch removes the observed query-language hydration mismatch and stabilizes the local browser-test gate. The remaining gap is not "route absent"; it is "full recipient portal confirmation against a deployed build with a real share session."

The previous read-only report should be treated as stale for current master. Future work should focus on:

- live/deployed recipient portal verification with an actual share session
- copy parity between provider dispatch and worker portal preview
- foreign-language body completeness in delivered messages
- one clear video path: create workpack → select workers → send/preview → open worker page → confirm
