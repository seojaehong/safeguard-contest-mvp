# Exact-trusted KOSHA grounding remediation

## Scope

- Superseded candidate: `44ffa57f6b08f1a4b5622e8a88b5c41134d9902c`
- Branch: `fix/exact-trusted-kosha-grounding-20260715`
- Database migration or mutation: none
- Authority: `technical_guidance_only`; no law or statutory-mandate promotion
- Asset boundary: one normalized D-C-13 body JSON; no PDF and no broad corpus

## Corrected contract

The production trust decision now requires every pinned identity and provenance field: item/source/type/title, stable key, version/current version, normalized body SHA, PDF SHA, official URL, official file ID, publication date, lifecycle, review state, native body kind, human confirmation, and non-tampered state. Missing values fail closed. Conflicting values across `payload` and `metadata` fail closed.

When the local KOSHA corpus is unavailable or blocked, only a production exact-trusted KOSHA row survives the KOSHA gate. General verified KOSHA rows are not retained. Non-KOSHA rows such as SIF remain unaffected.

The current 2,582-character Supabase D-C-13 body is never trusted. For relevant exterior-wall painting/repair queries, it is replaced at the server search boundary by the immutable bundled official normalized body. If the database later supplies the exact pinned body, the database row wins and the bundle is not duplicated.

The exact gate remains active when the public search API supplies `sourceId`, `riskTag`, or `evidenceRole`. Filters are preserved: the bundle is included only when its source, risk tag, item type, and semantic evidence role satisfy the request. The exact trust decision makes D-C-13 eligible for `direct`; it is not duplicated in `supporting`. General or partial KOSHA rows never inherit that promotion.

Query matching is bounded to exterior-wall work token groups. It accepts contextual variants such as exterior-wall paint, apartment suspended-scaffold/rope work, and gondola exterior-wall work. Generic paint storage, rope training/purchase, and unrelated gondola inspection do not activate the bundle.

## Official body asset

- Path: `data/safety-knowledge/exact-kosha/d-c-13-2026.json`
- Normalized body: 19,058 characters
- Tracked UTF-8 JSON size: 48,670 bytes
- Body SHA-256: `ea8bb93a3e03a40873222ab385d257e1a5946cb4d28e5c65951353731b0a5919`
- Official PDF SHA-256: `790a823a3fceae0328ba3c2692486c057f33a036a2ea1fa672e94a626c481179`
- Official URL: `https://portal.kosha.or.kr/openapi/v1/file/down/CTC2026012914371557826167/1`
- Extraction snapshot: `976068bc0f060e177be0392323a2853cd43f145c6d294e7759bcb6374f411282`
- The PDF and the full KOSHA corpus are not committed.

## TDD and regression evidence

- Prior RED: missing bundle, optional metadata, broad general-KOSHA retention, and conflicting metadata were rejected by the first remediation suite.
- Fresh RED: public `sourceId`/`riskTag` bypass and missing bounded synonym coverage produced 3 failures.
- Fresh RED: `evidenceRole=direct` omitted the exact direct-eligible bundle and produced 1 failure.
- Focused final: 6 files / 166 tests passed.
- Strict typecheck: passed after `npm.cmd install`; `package.json` and `package-lock.json` diff remained empty.
- Normal production build: 28/28 pages generated.
- NFT trace: `.next/server/app/api/safety-reference/search/route.js.nft.json` includes the D-C-13 JSON and contains zero PDF entries. This build produced 77 NFT files and 75 included the globally traced asset; the total is observed evidence, not a stable contract.
- Diff check: passed; no new TypeScript `any`.

Focused command:

```powershell
npm.cmd test -- tests/kosha-grounding-fail-closed.test.ts tests/commercial-harness.test.ts tests/grounded-generation-contract.test.ts tests/hermes-engine-adapter.test.ts tests/kosha-guide-supporting-row-relevance.test.ts tests/exact-trusted-kosha-grounding.test.ts
```

## Verdict

Implementation verification and fresh independent re-review pass for exact source HEAD `dd6b9e56` with no P0-P3 findings. The approved series maps onto the North Star integration branch as `b60aea9` -> `fad0fc6` -> `5dbdda3`.

Post-integration verification at `5dbdda3` passed the same focused 6 files / 166 tests, strict typecheck, and a sequential production build with 28/28 static pages. Live preview generation remains a post-push gate and is not claimed here.
