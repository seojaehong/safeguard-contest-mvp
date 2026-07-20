# Live Generation Grounding Comparison

Checked at: 2026-07-20 KST

## Verdict

Live production generation still shows a clear quality and grounding difference between `template` and `enhanced` on the current deployed product line.

The `enhanced` path is not merely changing UI labels. It returns a ready quality contract, DB-harness-first generation evidence, structured risk rows, KOSHA guide references, KOSHA OpenAPI evidence, KOSHA accident-case signals, knowledge DB matches, and Supabase catalog matches. This supports the North Star direction: SafeClaw should be judged by evidence-grounded risk/TBM output, not by document count.

## Production Build

- Endpoint: `https://www.safeclaw.kr/api/ask`
- Build info source: `https://www.safeclaw.kr/api/build-info`
- Commit: `ac304c7446e3d998c3f68d983430626b3f1cd7cf`
- Branch: `master`
- Environment: `production`

## Scenario

> 서울 성수동 외벽 도장 작업, 이동식 비계 사용, 작업자 5명, 신규 작업자 1명, 오후 강풍 예보. 추락, 비계 전도, 지게차 자재 양중 동선 충돌을 반영해서 위험성평가표와 TBM을 작성해줘.

## Result Summary

| Mode | HTTP | Elapsed | Quality | Structured rows | References | KOSHA signal | SIF / serious-risk signal |
| --- | ---: | ---: | --- | ---: | ---: | --- | --- |
| `template` | 200 | 698ms | blocked | 0 | 4 | yes | yes |
| `enhanced` | 200 | 20,013ms | ready | 5 | 6 | yes | yes |

## Enhanced Evidence Observed

The enhanced status detail explicitly reported:

- Law.go live legal grounding.
- KMA current/forecast/special-weather checks, with non-critical weather subfeeds surfaced as connection-review items when unavailable.
- Work24 training connection.
- KOSHA education portal metadata.
- KOSHA/MOEL official material URLs and form hints applied to risk assessment, TBM, and education records.
- KOSHA detailed OpenAPI evidence.
- KOSHA accident-case live call and TBM/education reflection.
- Knowledge DB matches.
- Supabase catalog matches with `hybrid-local-supabase` retrieval.
- Structured risk rows as DB-harness deterministic output.
- TBM-risk links and deterministic TBM assembly from risk rows.

The DB harness summary for the enhanced response reported:

- `mode`: `db_harness_first`
- `llmRole`: `naturalize_only`
- `directEvidence`: 2
- `sifCases`: 3
- `supportingEvidence`: 2
- `missingEvidence`: 0
- `documentCoverage`: 3 / 3 core documents covered
- `ontologyStatus`: `ready`

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

The live harness quality probe also passed the explicit DB-harness contract:

- `api_response`: PASS
- `generation_evidence_sealed`: PASS
- `db_harness_first`: PASS
- `evidence_sets_present`: PASS
- `structured_risk_tbm_links`: PASS
- `scenario_controls_present`: PASS
- `irrelevant_controls_absent`: PASS
- `quality_state_ready`: PASS
- `ontology_state_ready`: PASS
- `no_db_mutation`: PASS

## Interpretation

This confirms the product direction that the higher-quality path is the evidence harness path:

- `template` is fast and useful for offline fallback, but it remains blocked for quality because it does not produce structured grounded rows or fixed DB evidence.
- `enhanced` takes longer, but it produces the workbench-grade output SafeClaw needs for risk assessment/TBM: structured rows, KOSHA guide grounding, accident-case signals, and deterministic TBM linkage.

## Evidence

- Raw comparison summary: `evaluation/live-generation-grounding-comparison-2026-07-20/comparison.json`
- Runner: `evaluation/live-generation-grounding-comparison-2026-07-20/run-live-generation-grounding-comparison.mjs`
- Contract probe: `evaluation/live-harness-quality-probe-current-2026-07-20/report.md`
- Contract probe summary: `evaluation/live-harness-quality-probe-current-2026-07-20/summary.json`

Raw full API payloads were intentionally not committed. The runner can write them locally only when `SAFECLAW_WRITE_LIVE_RAW=1` is set.
