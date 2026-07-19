# SafeClaw KOSHA Exact Trust Current Evidence

- Generated: 2026-07-19T07:16:30Z
- Production URL: `https://www.safeclaw.kr`
- Production build-info at probe: see `status.json`

## Verdict

PASS for the current KOSHA evidence harness gate.

The product now has two separate KOSHA layers:

1. Broad KOSHA technical corpus for retrieval and review-required supporting evidence.
2. Exact-trusted KOSHA registry for direct body grounding and fail-closed citation use.

## Live Status API

`GET /api/safety-reference/status` returned:

- `ok`: true
- `status`: `ready`
- `searchReady`: true
- Total safety reference items: 9,920
- SIF cases: 6,033
- KOSHA technical total: 1,040
- Technical guidelines: 803
- Technical support regulations: 237
- Technical split check: true
- Local corpus:
  - status: ready
  - inventory/items/chunks: 234 / 234 / 7,127
  - failures: 0
- Exact trust registry:
  - status: ready
  - loaded items: 3
  - stable keys: `D-C-13`, `D-C-7`, `B-E-10`
  - versions: `D-C-13-2026`, `D-C-7-2026`, `B-E-10-2026`

## Exact Trusted Documents

- `D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정`
- `D-C-7-2026 비계 구조 및 안전작업에 관한 기술지원규정`
- `B-E-10-2026 정전전로 및 그 인근에서의 전기작업에 관한 기술지원규정`

Each exact-trusted document reports immutable `bodySha256`, `pdfSha256`, and `provenanceSha256` in the live status payload. Broad remote KOSHA rows that are not lifecycle-current remain `review_required` and are not treated as direct evidence.

## Verification

- Command: `npm.cmd test -- tests\exact-trusted-kosha-grounding.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\exact-trusted-kosha-registry-wave3.test.ts tests\exact-kosha-applicability-policy.test.ts tests\kosha-grounding-fail-closed.test.ts tests\safety-reference-status-route.test.ts --maxWorkers=1 --fileParallelism=false`
- Result: 6 files / 88 tests PASS.

## Product Meaning

This evidence supports the current North Star direction: SIF and broad KOSHA retrieval can propose hazard/control candidates, while only exact-trusted KOSHA documents may provide direct grounded excerpts. Unverified or lifecycle-stale KOSHA rows stay review-required instead of being promoted as authoritative citations.
