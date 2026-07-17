# Launch per-recipient localization contract

## Scope

- Authoritative base: `d42e143575c636fcc6e698b9c9eb35609c70b156`
- Isolated branch: `codex/launch-recipient-localization`
- Initial candidate: `16804c3b0f3e7e8b1a30ab97add224381d6568ba`
- Canonical remediation base: `c100002ed1488761b6eae9f38edd36a8d3ffa9c2`
- Owned runtime files: `components/WorkflowSharePanel.tsx`, `app/api/workflow/dispatch/route.ts`, `lib/workflow-share-client.ts`
- No provider transport, database schema, migration, or readiness-file changes.

## Contract

- The manager language selector remains a preview-only control.
- UI and server share one pure canonical message policy.
- The server derives allowed keys from the owned stored workpack: exactly `ko` plus stored `foreignWorkerLanguages[].code`.
- Every client `messageVariants` value must be byte-equivalent to the server-derived canonical value.
- The active share-session recipient snapshot remains authoritative for each recipient language and contact.
- The relay payload declares `recipientMessageContract: saved-worker-language-v1` and contains only variants used by server-authoritative recipients.
- Provider recipient DTOs contain only `workerId`, channel-required contact, `dispatchLanguageCode`, explicit per-recipient `messageTarget`, and `message`.
- Recipient DTOs are built only after preflight determines the final relay channels.
- Foreign recipient DTOs exclude Korean labels, job/education fields, display names, and unrelated contacts.
- Missing, malformed, unknown, mismatched, or Korean-leaking foreign variants fail closed with `providerCalled: false` before provider dispatch.
- Stored localization deliverables are parsed as `unknown`; the foreign language collection, each entry, and each string line are runtime-validated.
- Legacy global `messageTarget` and `message` requests are rejected.
- The public authenticated client sends only the `messageVariants` request contract.
- Existing tenant ownership, active-session, contact, privacy, and provider idempotency gates remain in the route.

## Remediation TDD evidence

1. Preview-independent canonical policy RED: `buildCanonicalRecipientMessageVariants is not a function`.
2. Minimal recipient DTO RED: old builder attempted `recipients.flatMap` on the new policy input.
3. Forged body RED: expected HTTP `409`, received `200`.
4. Unknown language RED: expected HTTP `409`, received `200`.
5. Korean leakage RED: expected HTTP `409`, received `200`.
6. Malformed stored language RED: validator exception escaped instead of returning a fail-closed result.
7. Each RED passed after its corresponding minimal implementation step.

## Final review remediation TDD evidence

1. Final-channel DTO RED: the email-only payload still contained the raw recipient and lacked canonical dispatch fields.
2. Preflight contact RED: email plus unavailable Kakao returned HTTP `409` because phone was validated before Kakao was removed; expected email fixture HTTP `200`.
3. Missing stored language collection RED: `getCanonicalDispatchLanguageCodes` threw on `undefined.map` instead of returning a fail-closed response.
4. Public client contract RED: the `messageVariants` request failed because the obsolete client still required `messageTarget` and `message`.
5. Non-array stored `lines` is covered by the same strict runtime parser and returns the exact malformed field path.
6. Route tests assert `providerCalled: false` and no webhook invocation for both malformed stored payload cases.

## Strict localization and relay remediation TDD evidence

1. Blank `nativeLabel` RED returned `409` without the exact malformed field classification.
2. Empty `lines` RED reached fixture dispatch with HTTP `200`; it now returns `409`, `providerCalled: false`, and no webhook invocation.
3. A whitespace-only line entry RED reached fixture dispatch with HTTP `200`; it now fails closed at the stored deliverable parser.
4. Duplicate language code RED reached fixture dispatch with HTTP `200`; the second code now returns the exact malformed field path.
5. The n8n template RED still consumed legacy `workpack.message`; SMS, SMTP, and provider webhook paths now consume each server-authoritative `recipient.message` independently.
6. `PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED` remains `false`; live provider dispatch remains RED pending approved persistent idempotency migration.

## Reserved language and relay wire remediation TDD evidence

1. A reserved `ko` entry inside `foreignWorkerLanguages` RED reached fixture dispatch with HTTP `200`; it now returns `409`, `providerCalled: false`, the exact malformed `.code` path, and no webhook invocation.
2. Exact provider DTO RED showed that `dispatchLanguageCode` did not provide the required explicit `messageTarget`; each recipient now carries both fields.
3. Provider webhook sandbox RED omitted top-level `messageTarget`; each per-recipient webhook body now carries `messageTarget` and `message` independently.
4. Solapi sandbox RED preserved only `text`; the actual HTTPS wire JSON now preserves the recipient's canonical `message` and `messageTarget` alongside the provider text.
5. SMTP sandbox RED omitted the target; the actual SMTP wire now includes `X-SafeClaw-Message-Target` and the recipient-specific message body.
6. Tenant ownership, active-session authority, canonical byte-equivalence, allowlist validation, and the persistent idempotency RED gate remain unchanged.
7. A non-empty Korean `operatorNote` RED contaminated Vietnamese webhook, Solapi, and SMTP bodies; the note remains audit metadata but provider text now contains only the canonical per-recipient message.
8. A 901-character SMS RED was silently truncated by the relay; SMS now fails closed above 900 characters before provider dispatch, while accepted Solapi bodies are sent byte-for-byte without relay truncation.

## Verification

- Focused share/client/route suite: 4 files, 66 tests passed on the integrated remediation.
- Mobile browser contract: 1 test passed across desktop/mobile x day/night with one visible primary CTA and no clipping or overflow.
- `npm.cmd run typecheck`: passed.
- `git diff --check`: passed.
- Final integrated full serial suite: 178 files passed, 8 skipped; 2,154 tests passed, 14 skipped; failures 0.
- Final production build: 28/28 static pages passed after eliminating concurrent `.next` writers.
- Final frontend evidence: static violations 0, normal marker 0, audit marker 1, browser rows 108/108 with findings 0.
- Actual provider dispatch remains intentionally blocked until the persistent idempotency migration receives explicit approval and passes its DB concurrency/RLS gates.
