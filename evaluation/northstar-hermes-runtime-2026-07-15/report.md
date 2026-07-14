# Northstar Hermes Runtime Attestation Remediation

## Scope

- Reviewed candidate: `223cca10f97f9f5f5bd05cc6dcf3568539eb4ceb`
- Base: `dc608c8d7f7f854270669e05789cad88816d0f43`
- Branch: `fix/northstar-hermes-runtime-20260715`
- Route: `/api/agent/chat`
- No secrets, database changes, migrations, or provider fallback changes.

## Result

Hermes no longer attaches arbitrary OpenClaw prose to a verified packet. The adapter derives a deterministic allowlist of packet-backed control claims and citations, binds it to the canonical packet SHA-256 digest, and gives OpenClaw only a JSON selection contract. The adapter rejects malformed JSON, a wrong digest, an unknown claim, an unknown citation, duplicate selections, mutable packet clones, and packet identity changes. It renders the final text itself from exact allowlisted packet controls and citation labels.

The existing organization/site binding, local-only OpenClaw boundary, exact tool-free policy, OpenAI OAuth attestation, Evidence Harness preload, `naturalize_only` role, no mutation/publication authority, and human-confirmation requirement remain unchanged. Vertex and Anthropic fallback code was not changed.

## KOSHA Fixture Boundary

The previous synthetic `a...`/`b...` hashes and fake file ID were removed. The focused fixture now pins the current official provenance values for `D-C-13-2026`: official file `CTC2026012914371557826167`, PDF SHA-256 `790a823a3fceae0328ba3c2692486c057f33a036a2ea1fa672e94a626c481179`, and body SHA-256 `ea8bb93a3e03a40873222ab385d257e1a5946cb4d28e5c65951353731b0a5919`.

This fixture is admitted only through an explicitly named `testOnlyTrustedKoshaReference` injection that exact-matches the pinned body, URL, body hash, PDF hash, and file ID. Negative tests mutate the body, PDF hash, and file ID independently and verify planner execution never starts.

This is not a production-readiness claim. `PRODUCTION_TRUSTED_OFFICIAL_METADATA_SHA256` remains empty, so production KOSHA corpus loading remains blocked until an official metadata snapshot is promoted through the existing trust contract.

## TDD And Verification

| Phase | Command | Result |
| --- | --- | --- |
| RED | `npm.cmd test -- --run tests/hermes-engine-adapter.test.ts -t "rejects arbitrary OpenClaw text" --reporter=dot` | Exit 1; 1 selected test failed because arbitrary text resolved and emitted. |
| GREEN focused | `npm.cmd test -- --run tests/hermes-engine-adapter.test.ts tests/openclaw-chat.test.ts tests/claw-chat-route.test.ts tests/engine-adapter.test.ts --reporter=dot` | Exit 0; 4 files, 86 tests passed. |
| Strict typecheck | `npm.cmd run typecheck` | Exit 0. |
| Normal build | `npm.cmd run build` | Exit 0; Next.js 15.5.20 compiled successfully and generated `.next/BUILD_ID` `-sLfhxzNcmE3d5_RwKvvB`. |
| Diff check | `git diff --check` | Exit 0. |

The focused count includes three unknown-attestation attacks, three KOSHA provenance mismatch attacks, arbitrary prose rejection, and a valid structured OpenClaw selection rendered solely from packet content.

## Remaining Runtime Blockers

- The production KOSHA trusted official metadata registry is empty; production grounding remains fail-closed until promotion.
- The installed OpenClaw CLI `2026.6.5` rejects config written by `2026.6.11`.
- The `safeclaw` profile lacks the required explicit `agents.list` tool-free policy entry.
- Organization and site binding environment values were not configured for a live verification.
- Local Hermes remains intentionally disabled on Vercel, and no live answer was executed.
