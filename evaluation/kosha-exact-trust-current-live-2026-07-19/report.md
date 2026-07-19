# KOSHA Exact Trust Current Live Gate

Date: 2026-07-19
Verified product base: `121d0952a48c79969a5ef9460db292f2f9d42547`
Live target: `https://www.safeclaw.kr/api/safety-reference/status`

## Summary

The current deployed SafeClaw runtime reports the KOSHA evidence harness as ready with the exact trusted KOSHA registry loaded from the runtime bundle. The direct-production exact set is three pinned references:

- `D-C-13-2026`
- `D-C-7-2026`
- `B-E-10-2026`

This confirms the current launch path is not relying on a stale two-reference Wave 2 narrative. `B-E-10-2026` is present as the current Wave 3 exact trust reference, while the remaining KOSHA corpus remains supporting or review-required unless separately exact-pinned.

## Live Runtime Probe

```text
GET https://www.safeclaw.kr/api/safety-reference/status
HTTP 200
ok: true
status: ready
searchReady: true
items: 9920
technicalGuidelines: 803
technicalSupportRegulations: 237
exactTrustRegistry.status: ready
exactTrustRegistry.integrityStatus: ready
exactTrustRegistry.count: 3
exactTrustRegistry.loadedItemCount: 3
stableDocumentKeys: D-C-13, D-C-7, B-E-10
versions: D-C-13-2026, D-C-7-2026, B-E-10-2026
```

## Local Verification

```powershell
npm.cmd test -- tests\exact-trusted-kosha-registry-wave3.test.ts tests\safety-reference-status-route.test.ts tests\safety-reference-status-bundled-corpus.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

```text
Test Files  4 passed (4)
Tests       50 passed (50)
```

## Integrity Boundary

- No database schema change was performed.
- No Supabase data mutation was performed.
- The exact trust registry is limited to immutable, pinned runtime bundle references.
- General KOSHA guide rows are not promoted to direct evidence unless they pass the exact trust gate.
- SIF/KOSHA remains the evidence-harness starting point; law is the mandate/validation layer, not the first retrieval layer.

## Decision

For launch evidence, use this current-live gate together with the existing runtime fail-closed report:

- `evaluation/kosha-exact-trust-runtime-status-2026-07-18/report.md`
- `evaluation/kosha-wave2-current-master-recheck-2026-07-18/report.md`

Older Wave 2-only wording that lists only `D-C-13` and `D-C-7` is stale for the current product base and should not be used as the final launch claim.
