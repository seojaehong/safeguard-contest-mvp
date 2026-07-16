# Launch per-recipient localization contract

## Scope

- Authoritative base: `d42e143575c636fcc6e698b9c9eb35609c70b156`
- Isolated branch: `codex/launch-recipient-localization`
- Initial candidate: `16804c3b0f3e7e8b1a30ab97add224381d6568ba`
- Owned runtime files: `components/WorkflowSharePanel.tsx`, `app/api/workflow/dispatch/route.ts`, `lib/workflow-share-client.ts`
- No provider transport, database schema, migration, or readiness-file changes.

## Contract

- The manager language selector remains a preview-only control.
- UI and server share one pure canonical message policy.
- The server derives allowed keys from the owned stored workpack: exactly `ko` plus stored `foreignWorkerLanguages[].code`.
- Every client `messageVariants` value must be byte-equivalent to the server-derived canonical value.
- The active share-session recipient snapshot remains authoritative for each recipient language and contact.
- The relay payload declares `recipientMessageContract: saved-worker-language-v1` and contains only variants used by server-authoritative recipients.
- Provider recipient DTOs contain only `workerId`, channel-required contact, `dispatchLanguageCode`, and `message`.
- Foreign recipient DTOs exclude Korean labels, job/education fields, display names, and unrelated contacts.
- Missing, malformed, unknown, mismatched, or Korean-leaking foreign variants fail closed with `providerCalled: false` before provider dispatch.
- Legacy global `messageTarget` and `message` requests are rejected.
- Existing tenant ownership, active-session, contact, privacy, and provider idempotency gates remain in the route.

## Remediation TDD evidence

1. Preview-independent canonical policy RED: `buildCanonicalRecipientMessageVariants is not a function`.
2. Minimal recipient DTO RED: old builder attempted `recipients.flatMap` on the new policy input.
3. Forged body RED: expected HTTP `409`, received `200`.
4. Unknown language RED: expected HTTP `409`, received `200`.
5. Korean leakage RED: expected HTTP `409`, received `200`.
6. Malformed stored language RED: validator exception escaped instead of returning a fail-closed result.
7. Each RED passed after its corresponding minimal implementation step.

## Verification

- Focused share/client/route suite: 4 files, 50 tests passed.
- Mobile browser contract: desktop/mobile x day/night passed with one visible primary CTA and no clipping or overflow.
- `npm.cmd run typecheck`: passed.
- `git diff --check`: passed.
