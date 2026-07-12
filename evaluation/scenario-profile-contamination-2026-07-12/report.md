# Scenario profile contamination remediation

## Status

- Status: `review_pending`
- Product SHA: `dd25e4f18e5db9ea7beed710fe9b2cd1ffa964d5`
- Product tree: `8d826a546050f230b1c8d3a104e4b6d3586ac6bb`
- Evidence SHA: `fc0f3c6f53968b6cb3158d6c3e12ed3e7ee9c50e`
- Evidence tree: `08991a63a80537357fd0203daf0c5a6ea8d17cc8`
- Database, schema, environment, UI, and unrelated changes: none
- Fresh review is required before changing this status.

## Behavior

- Genuine `세척` / `화학` / `청소` work identity is evaluated before logistics, manufacturing, or facility domain tokens.
- `물류센터 바닥 세척 작업. 화학세제 사용.` and the equivalent mechanical-room cleaning input select the chemical-cleaning accident first.
- Pure logistics/forklift and pure facility/mechanical-room inputs remain free of chemical-cleaning leakage.
- The launch scenario preserves `workerCount: 7` and records `외국인 근로자 2명`, `신규 투입자 1명` in `specialContext`.

## TDD

- Mixed cleaning RED: 1 file, 9 tests, 8 passed, 1 failed
- Mixed cleaning GREEN: 1 file, 9/9 passed
- Launch facts RED: 1 file, 26 tests, 25 passed, 1 failed; `workerCount === 7` already passed and counted subgroup facts failed
- Launch facts GREEN: 1 file, 26/26 passed
- RED/GREEN logs are included in the authoritative log set below.

## Verification

- Focused tests: 6 files, previous 74 plus 2 new, 76/76 passed
- Strict typecheck: exit 0
- Full product range: `git diff --check ac728ed9c452a9843e3a4ac417b060f35603cb1e..dd25e4f18e5db9ea7beed710fe9b2cd1ffa964d5`, zero failures
- Authoritative build: one invocation, compile success, static `27/27`, exit 0
- Global Next build counts before/during/after: `0 / 0 / 0`
- Global zero window before build: 180 seconds, 37 samples
- Build monitor samples: 96

## Evidence Hygiene

- Removed 16 superseded tracked logs from earlier review rounds.
- Current authoritative logs: 8
- Ambiguous stale PASS logs remaining: 0
- `red-mixed-cleaning-priority.log`
- `green-mixed-cleaning-priority.log`
- `red-launch-subgroup-facts.log`
- `green-launch-subgroup-facts.log`
- `current-focused-dd25e4f.log`
- `current-typecheck-dd25e4f.log`
- `current-full-range-diff-ac728ed-to-dd25e4f.log`
- `current-authoritative-build-final-dd25e4f.log`
