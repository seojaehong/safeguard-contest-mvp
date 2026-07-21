# KOSHA Current North Star Regression Gate

- Checked at: 2026-07-22T00:30:02+09:00
- Source HEAD before commit: c72c7607f14879dd7f804e985e7f7c4133895d9a
- Branch: chore/recipient-foreign-live-gate-20260720
- DB/schema/Supabase writes: none
- Embedding generation/upload: none

## Verdict

PASS for the current exact trusted KOSHA and structured materialization regression gate.

This gate confirms that the current north-star branch still preserves the SIF -> KOSHA -> law -> LLM naturalization boundary after the latest UI cockpit work. The exact trusted KOSHA pins remain test-covered, the trusted evidence keys still materialize into structured deliverables rather than staying hidden in harness metadata, and the live production KOSHA status endpoint is current with this source evidence.

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

Result: PASS, 3 files / 50 tests, duration 6.15s.

```powershell
npm.cmd test -- tests\exact-trusted-kosha-grounding.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\kosha-grounding-fail-closed.test.ts tests\kosha-current-review-run-ask.test.ts tests\kosha-guide-corpus-audit.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: PASS, 5 files / 173 tests, duration 22.76s.

```powershell
npm.cmd test -- tests\kosha-current-live-gate.test.ts --maxWorkers=1 --fileParallelism=false --testTimeout=60000
```

Result: PASS, 1 file / 3 tests, duration 2.41s.

```powershell
node scripts\kosha_current_live_gate.mjs --output evaluation\kosha-current-live-gate-2026-07-20 --base-url https://www.safeclaw.kr
```

Result: PASS, verdict `pass_current_kosha_exact_trust_and_corpus_gate`, source/live `c72c7607f14879dd7f804e985e7f7c4133895d9a`, failed checks `[]`.

Live KOSHA evidence at `evaluation\kosha-current-live-gate-2026-07-20\report.json` records catalog `9,920` items, technical support split `803` guidelines / `237` technical support regulations, local corpus `234` items / `7,127` chunks / `0` failures, and exact trust registry versions `D-C-13-2026`, `D-C-7-2026`, `B-E-10-2026`.

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
