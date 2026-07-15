# Exact-trusted KOSHA grounding remediation

## Scope

- Parent candidate: `52861c24eff21208b5ee542c4112026e8ba26322`
- Branch: `fix/exact-trusted-kosha-grounding-20260715`
- Database migration or mutation: none
- Authority: `technical_guidance_only`; no law or statutory-mandate promotion
- Asset boundary: one normalized D-C-13 body JSON; no PDF and no broad corpus

## Corrected contract

The production trust decision now requires every pinned identity and provenance field: item/source/type/title, stable key, version/current version, normalized body SHA, PDF SHA, official URL, official file ID, publication date, lifecycle, review state, native body kind, human confirmation, and non-tampered state. Missing values fail closed. Conflicting values across `payload` and `metadata` fail closed.

When the local KOSHA corpus is unavailable or blocked, only a production exact-trusted KOSHA row survives the KOSHA gate. General verified KOSHA rows are not retained. Non-KOSHA rows such as SIF remain unaffected.

The current 2,582-character Supabase D-C-13 body is never trusted. For relevant exterior-wall painting/repair queries, it is replaced at the server search boundary by the immutable bundled official normalized body. If the database later supplies the exact pinned body, the database row wins and the bundle is not duplicated.

## Official body asset

- Path: `data/safety-knowledge/exact-kosha/d-c-13-2026.json`
- Normalized body: 19,058 characters
- UTF-8 JSON size: 48,671 bytes
- Body SHA-256: `ea8bb93a3e03a40873222ab385d257e1a5946cb4d28e5c65951353731b0a5919`
- Official PDF SHA-256: `790a823a3fceae0328ba3c2692486c057f33a036a2ea1fa672e94a626c481179`
- Official URL: `https://portal.kosha.or.kr/openapi/v1/file/down/CTC2026012914371557826167/1`
- Extraction snapshot: `976068bc0f060e177be0392323a2853cd43f145c6d294e7759bcb6374f411282`
- The PDF and the full KOSHA corpus are not committed.

## TDD and regression evidence

- RED: missing bundle and optional metadata acceptance produced 2 failures.
- RED: missing loader and broad general-KOSHA retention produced 2 failures.
- RED: conflicting boolean metadata was accepted and produced 1 failure.
- Focused final: 6 files / 162 tests passed.
- Strict typecheck: passed after `npm.cmd install`; `package.json` and `package-lock.json` diff remained empty.
- Normal production build: 28/28 pages generated.
- NFT trace: the safety-reference search route includes the D-C-13 JSON; PDF entries are zero. Sixteen server traces include the bounded JSON.
- Diff check: passed; no new TypeScript `any`.

Focused command:

```powershell
npm.cmd test -- tests/kosha-grounding-fail-closed.test.ts tests/commercial-harness.test.ts tests/grounded-generation-contract.test.ts tests/hermes-engine-adapter.test.ts tests/kosha-guide-supporting-row-relevance.test.ts tests/exact-trusted-kosha-grounding.test.ts
```

## Verdict

Implementation verification passes for the bounded remediation. This report supersedes the rejected PASS claim for `52861c24`. Live preview verification remains a post-integration gate and is not claimed here.
