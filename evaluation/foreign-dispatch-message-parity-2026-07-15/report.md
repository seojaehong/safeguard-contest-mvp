# Foreign Message Preview-to-Dispatch Parity

## Scope

- Baseline: `75bacbc7dc405fe0cc6fb917ece95dfa743a94a7`
- Owned path: language/message preview selection -> authenticated dispatch command -> validated provider webhook payload
- No database, schema, recipient snapshot, authority, public-link, or anonymous-access changes

## Contract

1. `WorkflowSharePanel` sends the exact `selectedMessageTarget` and `selectedMessage` shown in the preview.
2. The authenticated client preserves both values without rewriting them.
3. The server accepts only `manager` or a bounded `foreign:<language-code>` target.
4. The message must be non-empty, no longer than 4,000 characters, and free of disallowed control characters and internal diagnostics such as `qualityContract`, `ontologyQa`, `directEvidence`, `DB 하네스`, or `하네스 JSONL`.
5. The validated values are copied unchanged into the provider webhook payload together with the server-owned recipient snapshot and workpack.

## TDD Evidence

RED before implementation:

- client request omitted `messageTarget` and `message`
- panel did not pass the selected preview values
- server rejected the two fields as unsupported
- provider payload builder did not exist
- oversized/internal messages reached the request boundary

GREEN after implementation:

- `npm.cmd test -- tests/workflow-share-client.test.ts tests/workpack-share-authority-routes.test.ts tests/workspace-share-simplification.test.ts`
  - 3 files, 37 tests passed
- `npm.cmd test -- tests/workflow-share-panel-behavior.test.ts tests/workflow-share-client.test.ts tests/workspace-share-simplification.test.ts tests/workpack-share-authority.test.ts tests/workpack-share-authority-routes.test.ts`
  - 5 files, 50 tests passed
- `npm.cmd run typecheck`
  - passed with strict TypeScript, no emitted files
- `git diff --check`
  - passed; Windows line-ending warnings only

## Security And Authority Preservation

- Recipient data still comes only from the active server share-session snapshot.
- Workpack data still comes only from the owned server workpack context.
- The request allowlist still rejects forged `workpack` and `recipients` fields.
- Authentication, ownership, share readiness, contact validation, session expiry, and provider idempotency gates remain unchanged.
- No public or anonymous share path was added.

## Operational Boundary

The route still fails closed for live provider calls while persistent provider idempotency support is disabled. This change proves and preserves the exact payload that will be relayed when that existing safety gate is enabled; fixture mode remains explicitly non-delivery.
