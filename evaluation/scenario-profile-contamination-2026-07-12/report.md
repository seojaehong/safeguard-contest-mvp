# Scenario profile token-boundary remediation

## Status

- Status: `review_pending`
- Starting HEAD: `6ce31d17f3bb212a542da0c9a9fe873315812585`
- Runtime file: `lib/mock-data.ts`
- Regression file: `tests/scenario-inference.test.ts`
- Database, schema, environment, and UI changes: none
- A fresh review is required before changing this status.

## RED / GREEN

RED ran before the runtime edit. The scenario test executed 26 cases: 22 passed and the four new embedded-region company cases failed for the intended reasons.

- `안산건설 굴착 작업`: company survived, but the site was replaced with `경기 안산`
- `하남산단관리 굴착 작업`: company survived, but the site was replaced with `광주 하남산단`
- `강원상사 굴착 작업`: company identity was lost
- `제주개발 굴착 작업`: company identity was lost
- All five standalone location cases already preserved their region during RED
- RED log: `evaluation/scenario-profile-contamination-2026-07-12/red-token-boundary-final.log`

GREEN covered scenario inference and accident selection: 2 files, 31 passed, 0 failed.

- GREEN log: `evaluation/scenario-profile-contamination-2026-07-12/green-token-boundary-final.log`

## Remediation

- Region recognition now uses exact normalized standalone-token sets.
- Specific locations use explicit token-sequence aliases such as `광주` + `하남산단`.
- Company tokens containing a region substring remain company identities.
- No company-specific negative list was added.
- Existing excavation identity, work-descriptor rejection, canonical cleaning-site, and accident leakage contracts remain in the focused suite.

## Verification

- Focused baseline plus new tests: 6 files, 72 passed (existing 63 plus 9 new), 0 failed
- Focused log: `evaluation/scenario-profile-contamination-2026-07-12/focused63-plus9.log`
- Strict typecheck: exit 0
- Typecheck log: `evaluation/scenario-profile-contamination-2026-07-12/typecheck-final.log`
- Diff check: exit 0; LF-to-CRLF conversion notices only
- Diff-check log: `evaluation/scenario-profile-contamination-2026-07-12/diff-check-final.log`

## Build Provenance

- Build runs: exactly 1
- CWD: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\scenario-profile-contamination`
- Source HEAD: `6ce31d17f3bb212a542da0c9a9fe873315812585`
- Command: `npm.cmd run build`
- Started: `2026-07-12T03:01:34.4698216Z`
- Finished: `2026-07-12T03:02:48.7529379Z`
- Next build process count before/after: `0` / `0`
- Same-worktree build process count before/after: `0` / `0`
- Exit code: `0`
- Compile: `Compiled successfully in 12.7s`
- Static generation: `27/27`
- Build log: `evaluation/scenario-profile-contamination-2026-07-12/build27.log`
