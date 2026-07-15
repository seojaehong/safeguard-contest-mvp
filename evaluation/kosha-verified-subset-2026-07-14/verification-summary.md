# KOSHA Verified Subset Verification Summary

Date: 2026-07-15 KST

## Artifact Boundary

- Source snapshot: `976068bc0f060e177be0392323a2853cd43f145c6d294e7759bcb6374f411282`
- Subset snapshot: `5bf504758c61683d9b5c5d2c92b27b55b02278bb69e45dc4346d51927d969618`
- Generator source SHA-256: `82dcdceef394b11af2c823f3baa0e5041405a8f0f62470cc36e6a40c495d9e5b`
- Generation policy SHA-256: `3c214a3d520a9425bce22328375c4a4ef6a547c9d94234ee69f9e7ed7edc94ce`
- Source identity SHA-256: `1db732ff3843adc12f1aa42130b82c45f4fe3497229aecd41b9be6a12fe5bc3d`
- Empty trust registry SHA-256: `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`
- Trusted official metadata SHA-256: `null`
- Counts: source `1040`, candidates `234`, out of scope `806`, accepted `0`, rejected `234`
- Launch ready: `false`

## Commands And Results

`python -m unittest -v scripts.tests.test_build_kosha_verified_subset`

Result: `6 passed`.

`npm.cmd test -- --run tests/kosha-current-review-lifecycle.test.ts tests/kosha-current-review-photo-storage.test.ts tests/kosha-current-review-provenance.test.ts tests/kosha-current-review-run-ask.test.ts tests/kosha-grounding-fail-closed.test.ts tests/kosha-guide-corpus-audit.test.ts tests/kosha-guide-offline-harness-expanded.test.ts tests/kosha-guide-offline-harness.test.ts tests/kosha-guide-provenance-gate.test.ts tests/kosha-guide-supporting-row-relevance.test.ts tests/kosha-verified-subset-gate.test.ts`

Result: `196 passed across 11 files`.

`npm.cmd run typecheck`

Result: passed.

`npm.cmd run build`

Result: passed with Next.js `15.5.20`.

`Draft202012Validator current.json + manifest.json + items/chunks/failures JSONL`

Result: `236 records passed`.

Function trace result: `/api/safety-reference/search` `1,219,504` bytes across `55` files; `/api/ask` `2,891,364` bytes across `71` files. The subset is not traced by either function.

Raw command output: `verification.log`
Schema result: `schema-validation.log`
Function trace result: `function-size.log`
