# Phase A ontology evidence chains remediation report

- Date: 2026-07-13 (Asia/Seoul)
- Branch: `feat/phase-a-ontology-evidence-chains`
- Base: `b39f8135e784f69aac12d947cf6a734aa429a3c5`
- Rejected commit remediated: `8e6cf05e501edb4ecccce7a8c92e87b9ec7fb88d`
- Contract: `phase-a-evidence-chains/1.1.0`
- Status: remediated, awaiting fresh independent review
- Runtime/DB publication: not performed
- Schema, migration, Supabase data, generated core seed: unchanged

## Corrected scope

Phase A remains a versioned code-owned evidence registry and result DTO over the existing published graph. It preserves exactly seven node kinds, seven edge relations, the existing `cited_uids` parser namespaces, and the `draft | verified | published` review states.

The pipeline remains:

`input -> exact canonical Task/alias -> published subgraph -> SIF/KOSHA/law pack -> naturalize_only -> passed quality check -> human confirm`

| Chain | Canonical Task | Hazard | SIF | KOSHA production docs / local chunks | Current law | Controls |
|---|---|---|---:|---:|---|---:|
| 고소작업 -> 추락 | `Task_work_at_height` | 추락 | 2 | 3 / 4 | 42, 43, 44 | 3 |
| 차량계·기계 인접작업 -> 끼임 | `Task_forklift_loading` | 끼임 | 2 | 3 / 4 | 172 | 1 |
| 전기작업 -> 감전 | `Task_electrical_work` | 감전 | 3 | 3 / 5 | 301, 302, 319, 321, 323 | 5 |

`건설기계 인접 작업` is no longer an alias for `Task_forklift_loading`. Without a distinct published construction-machinery Task and graph path it fails closed as `not_registered`. Article 200 and the maintenance Article 92 control were removed from this forklift chain.

## Exact KOSHA matrix

Every production row below exists with production status `ready`. Every local body item remains `current-unverified`. The persistent production-row-to-local-chunk bridge is absent, so each record remains `draft + unresolved`, and all production and local identifiers are kept separately.

| Guide | Production row | Local item | Chunk / page | Direct Phase A mapping |
|---|---|---|---|---|
| C-74 | `technical-support-01-0043-c-74-2015-건설공사의-고소작업대-안전보건작업지침` | `kosha-a3c8a491f835c6eaf5109705` | `kosha-chunk-470a9a64364fcf013b0127ff` p11 | none: aerial-platform rail/door only (`direct_support_missing`) |
| D-C-7 | `technical-support-01-0073-d-c-7-2026-비계-구조-및-안전작업에-관한-기술지원규정` | `kosha-07e82640daba8e37ebb73cdb` | `kosha-chunk-784b7f55fa7a16fe52255cec` p19 | `fall-work-platform` |
| D-C-7 | same production/local item | same | `kosha-chunk-dd07e81d5176bd73484f685e` p58 | `fall-anchor` |
| A-G-1 | `technical-support-06-0001-a-g-1-2025-추락방호망-설치-기술지원규정-수직형-추락방망-설치` | `kosha-1cad3b4b264aa96277dcfae8` | `kosha-chunk-57c50cf2248cf860969982a4` p7 | `fall-work-platform`, `fall-opening-guard` |
| C-48 | `technical-support-01-0024-c-48-2022-건설기계-안전보건작업지침` | `kosha-2817664393f505499a71d63d` | `kosha-chunk-1602e569f8fbe9c789d06cbc` p4 | none: construction machinery is outside the forklift Task (`task_scope_mismatch`) |
| D-C-4 | `technical-support-01-0070-d-c-4-2025-굴착기-안전보건작업-기술지원규정` | `kosha-32d7faa3ac4ef74e48d959d4` | `kosha-chunk-318945791a391ef2ab83fc8b` p20 | none: excavator scope (`task_scope_mismatch`) |
| B-M-37 | `technical-support-02-0033-b-m-37-2026-회전기계-등의-끼임-절단재해-예방을-위한-기술지원규정` | `kosha-c6bba4fd3e9a9305c1edce41` | `kosha-chunk-9a5c5df7fc303f229134ead0` p15 | none: guarding Control absent (`registry_control_missing`) |
| B-M-37 | same production/local item | same | `kosha-chunk-6f5898c423e8425d84201656` p40 | none: conveyor LOTO is outside forklift loading (`task_scope_mismatch`) |
| B-E-10 | `technical-support-09-0002-b-e-10-2026-정전전로-및-그-인근에서의-전기작업에-관한-기술지원규정` | `kosha-7161ec0c8b05f2cccbe519b3` | `kosha-chunk-c300b03bbb724268225a73f7` p9 | `electrical-deenergized-isolation` |
| B-E-11 | `technical-support-09-0003-b-e-11-2026-충전전로-및-그-인근에서의-전기작업에-관한-기술지원규정` | `kosha-a8a1ea385da644ac8f48149f` | `kosha-chunk-7f40eb9fd888ee9a78bde37e` p7 | `electrical-live-part-guarding` |
| B-E-11 | same production/local item | same | `kosha-chunk-ddd57dc246a2ae6e93f5aa14` p15 | `electrical-live-part-guarding`, `electrical-live-work-distance` |
| B-E-11 | same production/local item | same | `kosha-chunk-1828d0072421b7434a65cdba` p16 | `electrical-live-work-distance`, `electrical-insulating-ppe` |
| B-E-9 | `technical-support-09-0022-b-e-9-2026-접지설비에-관한-기술지원규정` | `kosha-7e511f17893129148a46714c` | `kosha-chunk-77d92b287dac21705c7eff74` p10 | `electrical-grounding` |

The KOSHA corpus gate remains dominant: `launchReady=false`, `bodyMissingCount=1`, download provenance `incomplete`, and production/local bridge `absent`. Caller overrides cannot promote these records to verified/published/resolved or produce `statutory_mandate_with_guidance`.

## Authority and classification

- SIF ranks hazard priority only. It never creates legal duty or technical guidance. The SIF corpus is prepared, but embedding, upload, and ontology promotion were not performed.
- KOSHA remains technical guidance only and never becomes an Article or `mandatedBy` source.
- Only a published current-law `Control-mandatedBy-Article` graph path supports statutory duty wording.
- Field history and weather remain `scope_only` applicability context.
- `fulfillsDuty` remains partial evidence only.
- `sif-아카이브-건설업-01985` remains draft, review-only, and `autoConfirm=false`.
- Empty-body `kosha-60492776122f8b433994fc10` remains excluded.

The public obligation union has exactly four states:

1. `statutory_mandate`
2. `technical_guidance_only`
3. `statutory_mandate_with_guidance`
4. `review_required`

SIF-only evidence returns `review_required`; there is no fifth `neither` state.

## Fail-closed and pipeline gates

- Resolution requires published endpoints and correctly directed published edges for `Task-entailsHazard-Hazard`, `Hazard-mitigatedBy-Control`, and `Control-mandatedBy-Article`.
- Missing, draft, wrong-direction, or missing-endpoint variants fail closed with explicit reasons.
- Article 44 applies only at a height of at least 2 metres when the worker is made to wear a safety belt.
- Naturalization deep-clones and recursively freezes the fixed pack. Mutation of the source pack after confirmation does not alter the confirmed pack.
- Human confirmation rejects both pending and failed quality checks; only `passed` quality can be confirmed.
- Existing provider fallback and DB harness `naturalize_only` behavior are unchanged.
- MCP `provenance` remains the backward-compatible `법제처 검증 시드 v1`; the layered pack is returned separately in `evidenceContract`, with `evidenceChainState=review_required` while the KOSHA bridge is unresolved.
- Materialization remains deterministic: 9 controls create 18 risk-assessment/TBM targets and retain production item UID, local item ID, local chunk ID, page/location, and unresolved bridge state.

## Reviewer remediation

| Finding | Remediation |
|---|---|
| P1-1 Article 200 used for forklift | Replaced with published graph Article 172 and its exact access-control/guide-person Control; removed 200, 92, and maintenance control from the forklift chain. |
| P1-2 KOSHA chunks over-mapped | Re-read exact chunks; introduced chunk-level records; mapped D-C-7, A-G-1, B-E-9/10/11 only to directly supported Controls; kept C-74/C-48/D-C-4/B-M-37 unmapped with explicit reasons. |
| P1-3 graph validation incomplete | Added endpoint and directed-edge validation with missing/draft/reverse negative tests for all three required relations. |
| P1-4 corpus gate overrideable | Made launch/body/provenance/bridge gate dominate malicious caller overrides and exposed unresolved MCP state. |
| P1-5 dishonest cited UIDs | `ref:safety_reference_items` now uses exact `technical-support-*` production IDs; local chunks use the existing `manual:kosha-body-recovery-2026-07-12-v3/...` namespace and remain unresolved. |
| P1-6 quality and mutability | Confirmation requires passed quality; fixed packs are cloned and recursively frozen; mutation isolation is tested. |
| P2-7 fifth classification | Removed `neither`; compile-time test locks the exact four-state union; SIF-only is `review_required`. |
| P2-8 Article 44 overgeneralized | Condition now includes height at least 2 metres and actual safety-belt wearing. |
| P2-9 MCP provenance regression | Restored original `provenance` semantics and retained the evidence-chain DTO as a separate field. |

## Official law verification

The current `산업안전보건기준에 관한 규칙` was checked as effective `2026-03-02` under 고용노동부령 제450호.

- [Article 42](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024005275)
- [Article 43](https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1028063341)
- [Article 44](https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1016700539)
- [Article 172](https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=1000727233)
- [Article 301](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024005221)
- [Article 302](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1030668033)
- [Articles 319, 321, 323 current page](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029038625)
- [Current full text](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=153999)

The Article 172 direct surface identifies the correct vehicle-type material-handling provision; the current full-text surface supplies the instrument-wide `2026-03-02` effective date.

## Verification

- TDD RED after independent review: 17 focused failures reproduced the original defects.
- Sidecar reconciliation RED: 7 failures reproduced missing chunk-level mappings; bridge/status RED added 4 further focused failures before implementation.
- Focused ontology/MCP/DB harness, serial: 4 files passed, 103 tests passed.
- Strict TypeScript: passed.
- Full suite: 125 files passed, 7 failed, 5 skipped; 1229 tests passed, 7 failed, 22 skipped. Failures were outside owned ontology/MCP/test/report files.
- Full-suite failed suites: `knowledge-page-layout`, `product-module-shell`, and `reports-download-center` due missing `.next/prerender-manifest.json` or hook timeout during concurrent dev-server tests.
- Full-suite failed tests: `frontend-route-coverage` 1, `module-shell-design-regression` 1, `reports-wave1-publish-support` 2 timeouts, and `workspace-layout-regression` 3.
- Serial isolation was interrupted by user after independently reproducing the 3 workspace layout failures, 1 module-shell mobile layout failure, and 1 frontend evidence-row failure. No ontology/MCP failure appeared.
- `git diff --check`: run immediately before commit.

Logs:

- `evaluation/phase-a-ontology-evidence-chains-2026-07-13/focused-tests.log`
- `evaluation/phase-a-ontology-evidence-chains-2026-07-13/typecheck.log`

No DB publication, migration, schema change, Supabase mutation, generated seed change, or UI/output artifact is included. This remediation does not self-approve; fresh independent review remains required.
