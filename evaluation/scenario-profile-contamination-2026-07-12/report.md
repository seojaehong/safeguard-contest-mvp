# Scenario profile contamination remediation

## Scope

- Rejected commit remediated: `ac728ed9c452a9843e3a4ac417b060f35603cb1e`
- Runtime files: `lib/mock-data.ts`, `lib/accident-cases.ts`
- Regression files: `tests/scenario-inference.test.ts`, `tests/accident-cases.test.ts`
- Database, schema, environment, and UI changes: none

## Observed RED

Tests were added before the runtime edits in this remediation. This command was then run:

`npm.cmd test -- tests/scenario-inference.test.ts tests/accident-cases.test.ts --maxWorkers=1 --no-file-parallelism`

- 2 test files executed
- 19 tests executed
- 5 tests failed and 14 passed
- Failures reproduced all three reviewer findings:
  - the exact launch question included a chemical-cleaning fallback accident case because `외국인` selected that accident identity;
  - `굴착기 정비 작업` and `열수송관 밸브 점검 작업` selected the excavation profile;
  - `광주 하남산단 열수송관 굴착공사` received the cleaning site label.

## Root Cause And Remediation

- Excavation classification previously used bare token inclusion. It now requires an explicit excavation work phrase: `굴착공사`, `굴착 작업`, `굴착 보수 작업`, `터파기 작업`, or the same spacing variants covered by the focused patterns.
- Equipment and service mentions remain maintenance when no excavation work phrase is present.
- Excavation profiles keep their work-specific fallback site label before generic location labels are applied.
- Accident fallback selection no longer treats worker attributes as work identity. Chemical-cleaning accidents still require `세척`, `화학`, or `청소`.

## Full AskResponse Contract

Exact launch question:

`도시가스공사 열수송관 굴착공사. 작업자 7명, 외국인 근로자 2명, 신규 투입자 1명, 이동식 크레인과 굴착기 사용, 매설물 확인 필요. 오늘 작업 전 문서팩을 만들어줘.`

- `scenario.companyName`: `도시가스공사`
- `scenario.companyType`: `건설업`
- inferred profile: `construction-excavation`
- `scenario.siteName`: `도시가스공사 열수송관 굴착공사 현장`
- profile work name contains `굴착`
- profile hazards include collapse/burial and underground-utility hazards
- weather note excludes chemical exposure wording
- risk-assessment draft contains `굴착면 붕괴` and excludes `화학세제`
- `externalData.accidentCases` is inspected as part of the full response and excludes `화학`, `세척`, and `세제`
- fallback accident titles are the general fall, forklift collision, and welding fire cases; no chemical-cleaning case is present

Classification matrix:

- Non-excavation: `굴착기 정비 작업`, `열수송관 밸브 점검 작업`
- Excavation: `열수송관 굴착공사`, `굴착 작업`, `도로 굴착 보수 작업`, `터파기 작업`
- Location: `광주 하남산단 열수송관 굴착공사` keeps an excavation label; the canonical cleaning input remains `광주 하남산단 청소 현장`
- Accident identity: `외국인`, `신규`, `고령`, `숙련` alone do not select a chemical-cleaning accident; real chemical-cleaning input still does

## Verification

- Focused tests: 6 files, 60 tests passed, 0 failed
- Strict typecheck: `npm.cmd run typecheck` passed
- Sequential production build: `npm.cmd run build` passed after confirming no same-worktree build process was running
- Diff check: `git diff --check` passed; Git emitted line-ending conversion notices only

History qualification: this report records commands and outcomes directly observed during this remediation. It does not claim independent verification of the test or commit ordering from the earlier rejected commit.
