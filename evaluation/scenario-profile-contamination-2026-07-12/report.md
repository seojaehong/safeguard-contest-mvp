# Scenario profile contamination remediation

## Status

- Status: `review_pending`
- Starting HEAD: `e6ffbcfe5f3ef59590fd7b842ec82cd38cfc38a0`
- Runtime file: `lib/mock-data.ts`
- Regression file: `tests/scenario-inference.test.ts`
- Database, schema, environment, and UI changes: none
- A fresh review is required before changing this status.

## TDD Evidence

The Gwangju excavation test was strengthened before runtime edits. It required the excavation site name to preserve `광주 하남산단`, rejected `굴착공사` as `companyName` or a site-name prefix, and retained the exact canonical cleaning site `광주 하남산단 청소 현장`.

- Initial RED: 1 file, 14 tests, 13 passed, 1 failed
- Failure: `companyName` was `굴착공사`
- Initial RED log: `evaluation/scenario-profile-contamination-2026-07-12/red-location-company.log`
- Expanded RED: 1 file, 17 tests, 13 passed, 4 failed
- Expanded failures: `굴착공사`, `보수공사`, `세종`, and `광주 하남산단` boundaries
- Expanded RED log: `evaluation/scenario-profile-contamination-2026-07-12/red-location-company-expanded.log`
- GREEN: 2 files, 22 tests passed, 0 failed
- GREEN log: `evaluation/scenario-profile-contamination-2026-07-12/green-location-company.log`

## Remediation

- Company inference rejects the bounded work descriptors `굴착공사`, `보수공사`, `굴착보수공사`, `열수송관굴착공사`, and `도로굴착보수공사`.
- Genuine names ending in `공사` remain valid; the exact launch question still infers `도시가스공사`.
- Excavation site inference preserves the six existing specific location rules and the 17 top-level regions, including `광주 하남산단` and `세종`.
- Excavation location preservation emits only the location prefix plus the excavation label. It does not reuse cleaning, logistics, manufacturing, facility-management, or warehouse labels.
- Canonical cleaning remains exactly `광주 하남산단 청소 현장`.
- Closed accident leakage and excavation intent classification behavior remain covered by the focused suite.

## AskResponse Contract

For the exact `도시가스공사 열수송관 굴착공사...` launch question:

- `scenario.companyName`: `도시가스공사`
- `scenario.companyType`: `건설업`
- inferred profile: `construction-excavation`
- `scenario.siteName`: `도시가스공사 열수송관 굴착공사 현장`
- risk-assessment output contains `굴착면 붕괴` and excludes `화학세제`
- fallback accident cases exclude `화학`, `세척`, and `세제`

## Verification

- Focused baseline plus new tests: 6 files, 63 passed (existing 60 plus 3 new), 0 failed
- Focused log: `evaluation/scenario-profile-contamination-2026-07-12/focused60-plus3.log`
- Strict typecheck: passed
- Typecheck log: `evaluation/scenario-profile-contamination-2026-07-12/typecheck.log`
- Sequential production build: passed, static pages `27/27`
- Build log: `evaluation/scenario-profile-contamination-2026-07-12/build27.log`
- Diff check: passed; Git emitted LF-to-CRLF conversion notices only
- Diff-check log: `evaluation/scenario-profile-contamination-2026-07-12/diff-check.log`
