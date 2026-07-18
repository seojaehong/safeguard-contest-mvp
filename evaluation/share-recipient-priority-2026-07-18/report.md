# Share Recipient Priority Remediation

Date: 2026-07-18
Worktree: `kosha-wave2-main-integration-20260718`

## Summary

The recipient portal at `/share/[sessionId]` is now optimized around the worker's primary job:

1. read the worker-language safety notice,
2. leave the read confirmation,
3. optionally expand the three core documents.

Before this change, the three document previews appeared before the confirmation action, which made the mobile worker flow longer than necessary. The document bodies are now collapsed by default under 44px touch-safe summaries, while preserving the document data and the read-confirmation contract.

## Changed Scope

- `app/share/[sessionId]/page.tsx`
- `app/globals.css`
- `tests/share-recipient-portal-browser.test.ts`

No DB schema changes, migrations, data mutations, or environment changes were made.

## Browser Contract

`tests/share-recipient-portal-browser.test.ts` now verifies:

- mobile width has no horizontal overflow,
- controls are at least 44px high,
- document summaries are at least 44px high,
- the `열람 확인` action appears before the document pack details,
- the three document details are collapsed by default,
- invited worker confirmation stores only the worker identity from the session.

## Verification

Focused recipient portal:

```text
npm.cmd test -- tests/share-recipient-portal-browser.test.ts --maxWorkers=1 --fileParallelism=false
Test Files  1 passed (1)
Tests       1 passed (1)
```

Share and foreign dispatch regression set:

```text
npm.cmd test -- tests/workpack-share-authority-routes.test.ts tests/workflow-share-client.test.ts tests/workspace-share-mobile-browser.test.ts tests/share-recipient-portal-browser.test.ts --maxWorkers=1 --fileParallelism=false
Test Files  4 passed (4)
Tests       65 passed (65)
```

Typecheck:

```text
npm.cmd run typecheck
PASS
```

Production build:

```text
npm.cmd run build
PASS
Generated static pages: 28/28
```
