# Live Generation Grounding Comparison

Checked at: 2026-07-20 KST

## Verdict

Live production generation shows a clear quality and grounding difference between `template` and `enhanced`.

The `enhanced` path is not merely changing UI labels. It returns a ready quality contract, structured risk rows, KOSHA guide references, KOSHA OpenAPI evidence, KOSHA accident-case signals, knowledge DB matches, and Supabase catalog matches. This supports the North Star direction: SafeClaw should be judged by evidence-grounded risk/TBM output, not by document count.

## Production Build

- Endpoint: `https://www.safeclaw.kr/api/ask`
- Build info source: `https://www.safeclaw.kr/api/build-info`
- Commit: `ae4a8f6cc440d1aac3d43e6e70e58db4f7326563`
- Branch: `master`
- Environment: `production`

## Scenario

> 서울 성수동 외벽 도장 작업, 이동식 비계 사용, 작업자 5명, 신규 작업자 1명, 오후 강풍 예보. 추락, 비계 전도, 지게차 자재 양중 동선 충돌을 반영해서 위험성평가표와 TBM을 작성해줘.

## Result Summary

| Mode | HTTP | Elapsed | Quality | Structured rows | References | KOSHA signal | SIF / serious-risk signal |
| --- | ---: | ---: | --- | ---: | ---: | --- | --- |
| `template` | 200 | 254ms | blocked | 0 | 4 | yes | yes |
| `enhanced` | 200 | 18,704ms | ready | 5 | 6 | yes | yes |

## Enhanced Evidence Observed

The enhanced status detail explicitly reported:

- Law.go live legal grounding.
- KMA forecast/special-weather checks, with some weather subfeeds fail-closed as unavailable.
- Work24 training connection.
- KOSHA education portal metadata.
- KOSHA/MOEL official material URLs and form hints applied to risk assessment, TBM, and education records.
- KOSHA detailed OpenAPI evidence.
- KOSHA accident-case live call and TBM/education reflection.
- Knowledge DB matches.
- Supabase catalog matches.
- Structured risk rows as DB-harness deterministic output.
- TBM-risk links and deterministic TBM assembly from risk rows.

## Row Sample From Enhanced

The enhanced response produced five structured risk rows. Representative evidence refs included:

- `DB 하네스 직접근거`
- `KOSHA 공식자료`
- `D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정`
- `D-C-7-2026 비계 구조 및 안전작업에 관한 기술지원규정`
- `고위험요인 사례`
- `KOSHA 위험성평가`
- `MSDS`
- `TBM 기록`

## Interpretation

This confirms the product direction that the higher-quality path is the evidence harness path:

- `template` is fast and useful for offline fallback, but it remains blocked for quality because it does not produce structured grounded rows.
- `enhanced` takes longer, but it produces the workbench-grade output SafeClaw needs for risk assessment/TBM: structured rows, KOSHA guide grounding, accident-case signals, and deterministic TBM linkage.

## Evidence

- Raw comparison summary: `evaluation/live-generation-grounding-comparison-2026-07-20/comparison.json`
- Runner: `evaluation/live-generation-grounding-comparison-2026-07-20/run-live-generation-grounding-comparison.mjs`

Raw full API payloads were intentionally not committed. The runner can write them locally only when `SAFECLAW_WRITE_LIVE_RAW=1` is set.
