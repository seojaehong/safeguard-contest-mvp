# Launch per-recipient localization contract

## Scope

- Authoritative base: `d42e143575c636fcc6e698b9c9eb35609c70b156`
- Isolated branch: `codex/launch-recipient-localization`
- Owned runtime files: `components/WorkflowSharePanel.tsx`, `app/api/workflow/dispatch/route.ts`
- No provider transport, database schema, migration, or readiness-file changes.

## Contract

- The manager language selector remains a preview-only control.
- Dispatch requests use `messageVariants`, keyed by the selected workers' saved language codes.
- The server binds each active share-session recipient snapshot to `dispatchLanguageCode` and `message`.
- The relay payload declares `recipientMessageContract: saved-worker-language-v1` and contains only variants used by server-authoritative recipients.
- Missing recipient language bodies fail closed with `providerCalled: false` before provider dispatch.
- Legacy global `messageTarget` and `message` requests are rejected.
- Existing tenant ownership, active-session, contact, privacy, and provider idempotency gates remain in the route.

## TDD evidence

1. Recipient binding RED: `buildLocalizedDispatchRecipients is not a function`.
2. Missing-language RED: expected HTTP `409`, received `400` before the new contract was accepted.
3. Fixture contract RED: the old global-message payload builder rejected the new request.
4. Legacy contract RED: expected HTTP `400`, received idempotency gate HTTP `409` while compatibility remained.
5. Canonical payload RED: unused `en` variant remained in a `vi`-only recipient payload.
6. Each case passed after its focused implementation step.

## Verification

- `npm.cmd test -- tests/workflow-share-panel-behavior.test.ts tests/workspace-share-simplification.test.ts tests/workpack-share-authority-routes.test.ts`: 22 passed.
- Share/dispatch regression set including mobile browser coverage: 63 passed.
- `npm.cmd run typecheck`: passed.
- Full `npm.cmd test`: 168 test files passed, 8 failed, 8 skipped; 2042 tests passed, 10 failed, 29 skipped.

The full-suite failures are outside the owned runtime surface: browser harness and page navigation timeouts, KOSHA fixture process output failures, reports git-fixture timeouts, and stale frontend source-identity evidence. Readiness and generated evidence files were intentionally not edited.
