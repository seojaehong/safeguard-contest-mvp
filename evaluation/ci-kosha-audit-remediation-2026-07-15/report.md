# SafeClaw CI evidence remediation

- Date: 2026-07-15 KST
- Base HEAD: `a61cb6f73837b2197936fb39a23640da4d83fd48`
- Scope: KOSHA runAsk test isolation, exact-evidence comparison expectations, fail-closed quality expectations, frontend audit evidence refresh

## Root cause

The KOSHA runAsk test mocked `safety-reference-catalog` after production had moved the search boundary to `safety-reference-catalog-server`. The real exact D-C-13 bundle therefore entered isolated fixtures and invalidated eleven assertions without demonstrating a production leak. The remaining two assertions described the previous evidence policy: comparison search now contains the current remote item plus the exact D-C-13 bundle, and a packet with no fixed DB evidence is blocked rather than degraded.

The frontend source identity also changed after the last checked-in browser evidence, so the existing 108-row report was stale.

## Remediation

- Mock the production server search boundary in the runAsk test.
- Preserve the server-excluded stale D-C-13 fixture explicitly.
- Assert that both comparison-only references remain outside the generation graph.
- Assert fail-closed `blocked` status when required SIF removal leaves no fixed DB evidence.
- Regenerate static and browser audit evidence from the current frontend identity.

## Verification

- Focused CI regression set: 4 files, 74 tests passed.
- KOSHA runAsk isolation: 28 tests passed within the focused set.
- Strict TypeScript check: passed.
- Frontend static audit: 32 pages, 23 product components, 0 coverage issues, 0 violations.
- Audit production build: 28/28 static pages generated.
- Browser audit: 32 routes, 108/108 rows passed, 0 failed rows, 0 findings, 0 recovered rows.
- Product source changes: none.

## Preserved boundaries

- Exact D-C-13 remains bounded to its approved exterior-wall task signals.
- Fresh comparison evidence remains explicitly `comparison_only` and `not_used_for_generation`.
- Missing fixed evidence remains fail-closed.
- Existing unrelated module-shell screenshots were not staged or modified by this remediation commit.
