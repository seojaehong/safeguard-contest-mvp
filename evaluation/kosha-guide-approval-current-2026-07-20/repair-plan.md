# KOSHA Guide Repair Plan

Generated at: 2026-07-20T07:43:38.242Z

## Decision

`approval_required_before_mutation_or_embedding`

This plan is a read-only repair queue. It does not authorize DB mutation, upload, embedding generation, or vector enablement.

## Workstreams

| Workstream | Count | Mutation allowed | Action | Count semantics | Exit criteria |
| --- | ---: | --- | --- | --- | --- |
| `provenance_and_status_backfill_dry_run` | 1,040 | no | Backfill official URL, file ID, published date, current/retired status, and content hash. | - | All active KOSHA Guide rows have official provenance or are quarantined outside active retrieval. |
| `body_hydration_or_ocr_review` | 818 | no | Hydrate source PDF text or attach reviewed OCR body. | - | Every launch row has non-empty source-grounded body text or is excluded from active retrieval. |
| `summary_regeneration` | 822 | no | Replace fallback or reused summaries with source-grounded summaries. | - | Fallback-template summaries are zero for active KOSHA Guide retrieval rows. |
| `version_state_reconciliation` | 8 | no | Review official version updates and retired local rows. | - | Version update/retire dry-run is approved item by item before mutation. |
| `control_causality_review` | 71 | no | Review heuristic-delta and cross-domain operational controls against source bodies. | - | Controls are source-derived, task-relevant, and cross-domain contamination fixtures pass. |
| `retrieval_branch_observation` | 8 | no | Observe ranked and hybrid production retrieval branches with document reflection checks. | scenario-branch pairs, not unique branch names | KOSHA evidence and task-specific controls are reflected into documents without generic prose-only matches. |

## Evidence Coverage

| Workstream | Coverage | Count | Row-level evidence available | Reason |
| --- | --- | ---: | --- | --- |
| `provenance_and_status_backfill_dry_run` | count_only | 1,040 | no | The current audit records missing official provenance counts, but does not include all 1040 row identifiers in the evaluation artifact. |
| `body_hydration_or_ocr_review` | count_only | 818 | no | The current audit records empty-body counts and parse accounting, but does not include all 818 row identifiers in the evaluation artifact. |
| `summary_regeneration` | group_sample | 822 | no | The current audit includes duplicate summary groups and sample IDs, not a complete 822-row manifest. |
| `version_state_reconciliation` | row_level_complete | 8 | yes | The current audit includes every official version mismatch and retired local row. |
| `control_causality_review` | row_level_complete | 71 | yes | The current audit includes every operational review-required row and remaining secondary candidate row. |
| `retrieval_branch_observation` | scenario_branch_level_complete | 8 | yes | The current audit includes every untested retrieval scenario-branch pair. |

## Version Updates

| Stable key | Local | Official | Local path |
| --- | --- | --- | --- |
| `B-M-7` | `B-M-7-2026` | `B-M-7-2025` | B-M-7-2026 양중기 일반 안전에 관한 기술지원규정.pdf |
| `M-91` | `M-91-2011` | `M-91-2012` | M-91-2011 타워크레인의 지지.pdf |
| `A-46` | `A-46-2018` | `A-46-2021` | A-46-2018 요오드에 대한 작업환경측정·분석 기술지침.pdf |
| `A-48` | `A-48-2018` | `A-48-2021` | A-48-2018 오산화바나듐에 대한 작업환경측정·분석 기술지침.pdf |
| `W-26` | `W-26-2022` | `W-26-2023` | W-26-2022 단체급식시설 환기에 관한 기술지침.pdf |
| `C-C-83` | `C-C-83-2026` | `C-C-83-2020` | C-C-83-2026 가스폭발 예방을 위한 폭연방출구 설치에 관한 기술지원규정.pdf |
| `D-61` | `D-61-2017` | `D-61-2018` | D-61-2017 플레어시스템의 역화방지설비 설계 및 설치에 관한 기술지침.pdf |

## Retired Local Rows

| Stable key | Local | Local path | Official retired |
| --- | --- | --- | --- |
| `W-14` | `W-14-2022` | W-14-2022_경고표지 작성 지침.pdf | yes |

## Control Causality Review Samples

| Row | Title | Flags |
| --- | --- | --- |
| `technical-support-01-0033-c-59-2022-지붕공사-안전보건작업-기술지침` | C-59-2022 지붕공사 안전보건작업 기술지침 | ["fall-control-cross-task"] |
| `technical-support-01-0067-d-c-15-2026-콘크리트-단순-슬래브-포함-안전작업에-관한-기술지원규정` | D-C-15-2026 콘크리트(단순 슬래브 포함) 안전작업에 관한 기술지원규정 | ["forklift-control-cross-task"] |
| `technical-support-01-0070-d-c-4-2025-굴착기-안전보건작업-기술지원규정` | D-C-4-2025 굴착기 안전보건작업 기술지원규정 | ["forklift-control-cross-task"] |
| `technical-support-02-0010-b-m-16-2026-기계식-주차장치의-안전에-관한-기술지원규정` | B-M-16-2026 기계식 주차장치의 안전에 관한 기술지원규정 | ["forklift-control-cross-task"] |
| `technical-support-02-0017-b-m-22-2026-생활폐기물-수거차량의-구조-등에-관한-기술지원규정` | B-M-22-2026 생활폐기물 수거차량의 구조 등에 관한 기술지원규정 | ["forklift-control-cross-task"] |
| `technical-support-02-0018-b-m-23-2026-송풍기의-유지보수에-관한-기술지원규정` | B-M-23-2026 송풍기의 유지보수에 관한 기술지원규정 | ["fire-chemical-control-cross-task"] |
| `technical-support-02-0024-b-m-29-2026-자동차-안전작업에-대한-기술지원규정` | B-M-29-2026 자동차 안전작업에 대한 기술지원규정 | ["forklift-control-cross-task"] |
| `technical-support-03-0008-x-36-2016-이삿짐운반용-리프트작업의-리스크-확인지침` | X-36-2016 이삿짐운반용 리프트작업의 리스크 확인지침 | ["forklift-control-cross-task"] |
| `technical-support-04-0010-h-147-2021-특별관리물질-취급-근로자의-작업환경관리-지침` | H-147-2021 특별관리물질 취급 근로자의 작업환경관리 지침 | ["fire-chemical-control-cross-task"] |
| `technical-support-04-0011-h-158-2021-물질안전보건자료-교육실시에-관한-지침` | H-158-2021 물질안전보건자료 교육실시에 관한 지침 | ["fire-chemical-control-cross-task"] |
| `technical-support-01-0018-c-27-2011-낙하물-방호선반-설치-지침` | C-27-2011 낙하물 방호선반 설치 지침 | ["machinery-control-cross-task"] |

## Retrieval Reflection Failures

| Scenario | Branch | Status | Failures |
| --- | --- | --- | --- |
| exterior-paint | rest | tested | missing-kosha-evidence:B-E-17-2026; missing-kosha-evidence:D-C-13-2026; missing-control-term:도료; missing-control-term:유기용제; missing-control-term:작업발판; missing-control-term:안전대 |
| exterior-paint | ranked | untested | branch-not-executed:ranked |
| exterior-paint | hybrid | untested | branch-not-executed:hybrid |
| confined-pump | rest | tested | missing-kosha-evidence:E-G-18-2026 |
| confined-pump | ranked | untested | branch-not-executed:ranked |
| confined-pump | hybrid | untested | branch-not-executed:hybrid |
| forklift-traffic | rest | tested | missing-kosha-evidence:B-M-11-2025; missing-control-term:보행자 |
| forklift-traffic | ranked | untested | branch-not-executed:ranked |
| forklift-traffic | hybrid | untested | branch-not-executed:hybrid |
| electrostatic-paint | rest | tested | missing-kosha-evidence:B-E-20-2026; missing-control-term:정전기; missing-control-term:접지; missing-control-term:방폭 |
| electrostatic-paint | ranked | untested | branch-not-executed:ranked |
| electrostatic-paint | hybrid | untested | branch-not-executed:hybrid |

## Approval Gate

- Mutation allowed by this run: false
- Required before mutation: explicit user approval after reviewed per-item dry-run
- Required before embedding: official provenance/body/control/retrieval branch blockers closed
- Required row evidence before approval: per-row provenance/status backfill manifest for all active rows; per-row body hydration/OCR review manifest for empty-body rows; per-row source-grounded summary regeneration manifest for fallback summary rows
- Row evidence manifest: `evaluation/kosha-guide-approval-current-2026-07-20/repair-row-evidence-manifest.json`
