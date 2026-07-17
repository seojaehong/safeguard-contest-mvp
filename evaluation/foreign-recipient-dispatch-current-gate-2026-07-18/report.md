# Foreign Recipient Dispatch Current Gate

Date: 2026-07-18
Base HEAD before artifact: c3f560d3

## Scope

This gate revalidated the current foreign worker distribution contract after the manager share copy alignment.

The checked surface is the demo-critical flow:

1. Manager selects target workers.
2. Manager previews a language-specific message.
3. The authenticated dispatch request carries server-authoritative per-recipient message variants.
4. Worker recipient portal can display the saved language body and confirmation UI.

## Verification

Command:

```powershell
npm.cmd test -- tests\workflow-share-client.test.ts tests\workpack-share-authority-routes.test.ts tests\workspace-share-simplification.test.ts tests\workspace-share-mobile-browser.test.ts tests\foreign-worker-languages.test.ts
```

Result:

- 5 files passed
- 80 tests passed

## Contract Confirmed

- The manager language selector remains preview-only.
- Dispatch uses canonical per-recipient message variants, not an arbitrary UI preview payload.
- Unknown, duplicated, malformed, missing, or Korean-leaking foreign variants fail closed before provider dispatch.
- Provider DTOs preserve each recipient-specific message and message target.
- The mobile share preview renders Vietnamese paragraphs without clipping or horizontal overflow.
- The share panel no longer says the worker link is merely a future separately approved portal.

## Non-goals

- No provider idempotency migration.
- No DB schema change.
- No anonymous public share mode.
- No live provider send was executed.
