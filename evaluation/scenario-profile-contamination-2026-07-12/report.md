# Scenario profile contamination remediation

## Scope

- Base commit: `4c2a35ec24a3be4ddb54cfe839c22fd779e55075`
- Input: `도시가스공사 열수송관 굴착공사...외국인 근로자 2명...`
- Changed runtime: `lib/mock-data.ts`
- Regression contract: `tests/scenario-inference.test.ts`
- Database schema or data mutation: none

## Reproduction

Before the change, the launch-readiness input selected the `cleaning-chemical` sample because the shared worker attribute `외국인` contributed to profile identity scoring. The resulting scenario was internally inconsistent:

- company: `도시가스공사`
- industry: `서비스업`
- site: `광주 하남산단 공장 세척 구역`
- condition: `실내 환기 제한, 화학물질 노출과 미끄럼 위험 동시 관리`

The regression test was added first and failed with `expected 서비스업 to be 건설업`.

## Remediation

- Worker-context keywords (`외국인`, `신규`, `고령`, `숙련`) no longer select a sample profile by themselves.
- Excavation identity terms (`굴착`, `터파기`, `열수송관`) route to a dedicated construction profile.
- The dedicated profile supplies excavation-specific site, process, collapse/burial, underground-utility, heavy-equipment, control, TBM, and education content.
- The existing chemical-cleaning profile remains selected when chemical-cleaning work identity terms are present.

## Result

The exact launch-readiness input now resolves to:

- company: `도시가스공사`
- industry: `건설업`
- site: `도시가스공사 열수송관 굴착공사 현장`
- document contract: the risk-assessment draft contains `굴착면 붕괴` and does not contain `화학세제`

## Verification

- `npm.cmd test -- tests/scenario-inference.test.ts tests/pump-confined-scenario.test.ts tests/commercial-harness.test.ts --maxWorkers=1 --no-file-parallelism`
  - 3 files, 40 tests passed
- `npm.cmd run typecheck`
  - passed
- `git diff --check`
  - passed

Independent code review and current-main integration remain required before this change is launch-authoritative.
