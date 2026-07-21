# KOSHA Current North Star Regression Gate

- Checked at: 2026-07-21T23:36:09+09:00
- Source HEAD before commit: 9ea5a19dbf26619c2beb4395f155606e8171ae8f
- Branch: chore/recipient-foreign-live-gate-20260720
- DB/schema/Supabase writes: none
- Embedding generation/upload: none

## Verdict

PASS for the current exact trusted KOSHA and structured materialization regression gate.

This gate confirms that the current north-star branch still preserves the SIF -> KOSHA -> law -> LLM naturalization boundary after the latest UI cockpit work. The exact trusted KOSHA pins remain test-covered, and the trusted evidence keys still materialize into structured deliverables rather than staying hidden in harness metadata.

## Covered Contracts

Exact trusted KOSHA pins:

- `D-C-13-2026`: exterior-wall painting / scaffold and work-platform guidance
- `D-C-7-2026`: mobile scaffold assembly guidance
- `B-E-10-2026`: electrical inspection / de-energized circuit guidance

Structured materialization:

- `riskAssessmentRows` evidenceRefs must include exact trusted KOSHA keys where relevant.
- `tbmRiskLinks` evidenceRefs must preserve the same stable KOSHA keys.
- Grounded generation and live harness quality tests continue to reject weak or decorative-only evidence.

## Verification

```powershell
npm.cmd test -- tests\kosha-materialization-matrix.test.ts tests\grounded-generation-contract.test.ts tests\live-harness-quality-probe.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: PASS, 3 files / 50 tests, duration 5.67s.

```powershell
npm.cmd test -- tests\exact-trusted-kosha-grounding.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\kosha-grounding-fail-closed.test.ts tests\kosha-current-review-run-ask.test.ts tests\kosha-guide-corpus-audit.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: PASS, 5 files / 173 tests, duration 23.24s.

```powershell
npm.cmd test -- tests\kosha-current-live-gate.test.ts --maxWorkers=1 --fileParallelism=false --testTimeout=60000
```

Result: PASS, 1 file / 3 tests, duration 2.44s.

```powershell
npm.cmd run typecheck
```

Result: PASS.

## Boundaries

This does not claim:

- every KOSHA guide in the broader corpus is exact-published production evidence;
- SIF vector retrieval is production-active;
- any DB migration, Supabase write, embedding generation, or vector upload;
- live provider dispatch.

Those remain separate approval-gated workstreams.
