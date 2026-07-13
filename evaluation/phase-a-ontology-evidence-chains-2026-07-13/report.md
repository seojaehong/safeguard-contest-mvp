# Phase A ontology evidence chains remediation report

- Date: 2026-07-13 (Asia/Seoul)
- Branch: `fix/phase-a-ontology-review`
- Base: `02295b5a7d2b068eb5ea560f4cc9a34392fd7c21`
- Contract: `phase-a-evidence-chains/1.3.0`
- Status: citation-boundary P2 remediated, awaiting re-review
- Runtime/DB publication: not performed
- Schema, migration, Supabase data, generated core seed: unchanged

## Corrected scope

Phase A remains a versioned code-owned evidence registry and result DTO over the existing published graph. It preserves exactly seven node kinds, seven edge relations, the existing `cited_uids` parser namespaces, and the `draft | verified | published` review states.

The pipeline remains:

`input -> exact canonical Task/alias -> published subgraph -> SIF/KOSHA/law pack -> naturalize_only -> passed quality check -> human confirm`

The resolver and generation tool now expose the actual authority sequence separately:

`Task/published graph -> SIF/Accident -> KOSHA guidance -> current law validation -> generated-document materialization inspection`

| Chain | Canonical Task | Hazard | SIF | Active chunks | Review-only chunks | Current law | Controls |
|---|---|---|---:|---:|---:|---|---:|
| 고소작업 -> 추락 | `Task_work_at_height` | 추락 | 2 | 3 | 1 | 42, 43, 44 | 3 |
| 차량계·기계 인접작업 -> 끼임 | `Task_forklift_loading` | 끼임 | 2 | 0 | 4 | 172 | 1 |
| 전기작업 -> 감전 | `Task_electrical_work` | 감전 | 3 | 5 | 0 | 301, 302, 319, 321, 323 | 5 |

`건설기계 인접 작업` is no longer an alias for `Task_forklift_loading`. Without a distinct published construction-machinery Task and graph path it fails closed as `not_registered`. Article 200 and the maintenance Article 92 control were removed from this forklift chain.

## Exact KOSHA matrix

Every production row below exists with production status `ready`. Every local body item remains `current-unverified`. The persistent production-row-to-local-chunk bridge is absent, so each record remains `draft + unresolved`, and all production and local identifiers are kept separately. Mapped records enter active `guidance`; unsupported/scope/control-mismatch records enter `reviewOnlyGuidance` only.

| Guide | Production row | Local item | Chunk / page | Direct Phase A mapping |
|---|---|---|---|---|
| C-74 | `technical-support-01-0043-c-74-2015-건설공사의-고소작업대-안전보건작업지침` | `kosha-a3c8a491f835c6eaf5109705` | `kosha-chunk-470a9a64364fcf013b0127ff` p11 | review-only: aerial-platform rail/door only (`direct_support_missing`) |
| D-C-7 | `technical-support-01-0073-d-c-7-2026-비계-구조-및-안전작업에-관한-기술지원규정` | `kosha-07e82640daba8e37ebb73cdb` | `kosha-chunk-784b7f55fa7a16fe52255cec` p19 | `fall-work-platform` |
| D-C-7 | same production/local item | same | `kosha-chunk-dd07e81d5176bd73484f685e` p58 | `fall-anchor` |
| A-G-1 | `technical-support-06-0001-a-g-1-2025-추락방호망-설치-기술지원규정-수직형-추락방망-설치` | `kosha-1cad3b4b264aa96277dcfae8` | `kosha-chunk-57c50cf2248cf860969982a4` p7 | `fall-work-platform`, `fall-opening-guard` |
| C-48 | `technical-support-01-0024-c-48-2022-건설기계-안전보건작업지침` | `kosha-2817664393f505499a71d63d` | `kosha-chunk-1602e569f8fbe9c789d06cbc` p4 | review-only: construction machinery is outside the forklift Task (`task_scope_mismatch`) |
| D-C-4 | `technical-support-01-0070-d-c-4-2025-굴착기-안전보건작업-기술지원규정` | `kosha-32d7faa3ac4ef74e48d959d4` | `kosha-chunk-318945791a391ef2ab83fc8b` p20 | review-only: excavator scope (`task_scope_mismatch`) |
| B-M-37 | `technical-support-02-0033-b-m-37-2026-회전기계-등의-끼임-절단재해-예방을-위한-기술지원규정` | `kosha-c6bba4fd3e9a9305c1edce41` | `kosha-chunk-9a5c5df7fc303f229134ead0` p15 | review-only: guarding Control absent (`registry_control_missing`) |
| B-M-37 | same production/local item | same | `kosha-chunk-6f5898c423e8425d84201656` p40 | review-only: conveyor LOTO is outside forklift loading (`task_scope_mismatch`) |
| B-E-10 | `technical-support-09-0002-b-e-10-2026-정전전로-및-그-인근에서의-전기작업에-관한-기술지원규정` | `kosha-7161ec0c8b05f2cccbe519b3` | `kosha-chunk-c300b03bbb724268225a73f7` p9 | `electrical-deenergized-isolation` |
| B-E-11 | `technical-support-09-0003-b-e-11-2026-충전전로-및-그-인근에서의-전기작업에-관한-기술지원규정` | `kosha-a8a1ea385da644ac8f48149f` | `kosha-chunk-7f40eb9fd888ee9a78bde37e` p7 | `electrical-live-part-guarding` |
| B-E-11 | same production/local item | same | `kosha-chunk-ddd57dc246a2ae6e93f5aa14` p15 | `electrical-live-part-guarding`, `electrical-live-work-distance` |
| B-E-11 | same production/local item | same | `kosha-chunk-1828d0072421b7434a65cdba` p16 | `electrical-live-work-distance`, `electrical-insulating-ppe` |
| B-E-9 | `technical-support-09-0022-b-e-9-2026-접지설비에-관한-기술지원규정` | `kosha-7e511f17893129148a46714c` | `kosha-chunk-77d92b287dac21705c7eff74` p10 | `electrical-grounding` |

The KOSHA corpus gate remains dominant: `launchReady=false`, `bodyMissingCount=1`, download provenance `incomplete`, and production/local bridge `absent`. Caller overrides cannot promote these records to verified/published/resolved or produce `statutory_mandate_with_guidance`.

Local recovery `snapshotItemId`, `chunkId`, page/location, and exact SHA-256 are structured provenance only. They are not `cited_uids`; the citation resolver emits no machine-extracted `manual:*` citation. Active production citations use `ref:safety_reference_items:technical-support-*` only. Review-only guidance is excluded from active citations and from the naturalizer fixed pack, while remaining available in the separate operator-review list.

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

- `resolveEvidenceChain` itself returns `resolved=false`, `published=false`, `inferenceState=review_required`, and `reason=evidence_chain_review_required` while the bridge/corpus gate is unresolved. `graphPublicationState=published` separately records that all required graph nodes and edges passed.
- Resolution requires published endpoints and correctly directed published edges for `Task-entailsHazard-Hazard`, `Hazard-mitigatedBy-Control`, and `Control-mandatedBy-Article`.
- Missing, draft, wrong-direction, or missing-endpoint variants fail closed with explicit reasons.
- Article 44 applies only at a height of at least 2 metres when the worker is made to wear a safety belt.
- Naturalization deep-clones and recursively freezes the active fixed pack. `reviewOnlyGuidance` is removed from that packet and preserved separately for operator review. Mutation of the source pack after confirmation does not alter the confirmed pack.
- Human confirmation rejects both pending and failed quality checks; only `passed` quality can be confirmed.
- Existing provider fallback and DB harness `naturalize_only` behavior are unchanged.
- MCP `provenance` remains the backward-compatible `법제처 검증 시드 v1`; the layered pack is returned separately in `evidenceContract`, with `evidenceChainState=review_required` while the KOSHA bridge is unresolved.
- Planning remains deterministic: 9 controls create 18 risk-assessment/TBM targets and retain production item UID, local item ID, local chunk ID, exact SHA-256, page/location, and unresolved bridge state without inventing a chunk citation.
- Planned targets are `materializationTargets`; they are not completion claims. `verifiedRecords` are created only after exact inspection of a generated risk-assessment/TBM line containing both the Control label and a Control-scoped current-law Article UID or verified KOSHA technical-guidance UID.
- Evidence UIDs must appear as complete, Unicode-aware citation tokens. Ordinary ASCII/Korean punctuation and quotes may delimit a UID; Unicode letters, marks, numbers, Hangul, `_`, `-`, and `/` remain continuation characters. A colon is punctuation only when it is not joined to another continuation character. Article `제172조` still does not match `제172조의2`, and KOSHA UID prefix/suffix collisions do not materialize a Control.
- SIF evidence remains `hazard_priority_only` and can never materialize a Control, even when a SIF UID appears on the same generated line as the Control label. Wrong-source and different-line citations also produce no record.
- `review_required`, unverified, unpublished, unmatched, or Control-level `review_required` output always produces zero verified materialization records. Human confirmation remains pending in the tool result.

## Reviewer remediation

| Finding | Remediation |
|---|---|
| P1-1 Article 200 used for forklift | Replaced with published graph Article 172 and its exact access-control/guide-person Control; removed 200, 92, and maintenance control from the forklift chain. |
| P1-2 KOSHA chunks over-mapped | Re-read exact chunks; introduced chunk-level records; mapped D-C-7, A-G-1, B-E-9/10/11 only to directly supported Controls; kept C-74/C-48/D-C-4/B-M-37 unmapped with explicit reasons. |
| P1-3 graph validation incomplete | Added endpoint and directed-edge validation with missing/draft/reverse negative tests for all three required relations. |
| P1-4 corpus gate overrideable | Made launch/body/provenance/bridge gate dominate malicious caller overrides and exposed unresolved MCP state. |
| P1-5 dishonest cited UIDs | `ref:safety_reference_items` uses exact `technical-support-*` production IDs; local recovery identifiers and SHA are structured provenance only and do not enter `cited_uids`. |
| P1-6 quality and mutability | Confirmation requires passed quality; fixed packs are cloned and recursively frozen; mutation isolation is tested. |
| P2-7 fifth classification | Removed `neither`; compile-time test locks the exact four-state union; SIF-only is `review_required`. |
| P2-8 Article 44 overgeneralized | Condition now includes height at least 2 metres and actual safety-belt wearing. |
| P2-9 MCP provenance regression | Restored original `provenance` semantics and retained the evidence-chain DTO as a separate field. |

## Second review remediation

| Finding | Remediation |
|---|---|
| R2-1 core resolver reported resolved | Core resolver now fails closed as `review_required`; published graph state is separate and hostile overrides cannot change the assembled-chain outcome. |
| R2-2 machine chunks used `manual:*` | Removed chunk `manual:*` citations. Local item/chunk/page/location/SHA are structured unresolved provenance only. |
| R2-3 unmapped guidance was active | Split mapped `guidance` from `reviewOnlyGuidance`; active citations and naturalizer fixed pack exclude C-74/C-48/D-C-4/B-M-37 review-only records. |

## Independent Phase A review remediation

| Finding | Remediation |
|---|---|
| A-1 resolver was law-first | Reordered actual operations to published Task/graph, SIF/Accident, KOSHA, then current law. `assemblyTrace` and fail-closed tests prove later layers are not consulted after graph failure. |
| A-2 plans were reported as materialized | Renamed the resolver output to `materializationTargets`. The MCP generation path now resolves the evidence pack before `runAsk`, inspects the actual generated document instance afterward, and emits separate `verifiedRecords` with document key, line number, excerpt, Control, and exact cited UIDs. |
| A-3 Article 172 used an obsolete surface | Updated the registry and tests to the official `2026-03-02` Article 172 surface at `lsJoLnkSeq=1016700327`. |

## Fresh review remediation

| Finding | Remediation |
|---|---|
| F-1 SIF UID could materialize a Control | The verifier now derives allowed UIDs from the matched Control's classified evidence. Only current-law mandate evidence or verified KOSHA technical guidance can create a record; SIF is excluded as hazard-priority evidence. |
| F-2 QA label normalization damaged ontology aliases | The production handler now resolves the original task/question through the ontology's exact canonical/alias registry before querying knowledge. `고소 작업대 작업`, `차량계 하역운반기계 인접 작업`, and `전기 설비 작업` retain their three canonical Tasks. |
| F-3 coverage stopped below the production handler | Added full production-shaped handler tests proving all three aliases expose `evidenceContract`, verified-record gating, and pending human confirmation, plus positive law/KOSHA and unresolved paths. |
| F-4 report artifact state contradicted Git | `report.json` now records the report and logs as committed branch artifacts, matching this report. |

## Final corrections

| Finding | Remediation |
|---|---|
| C-1 citation matching accepted UID substrings | Replaced citation `includes` matching with NFC-normalized extraction that requires explicit token boundaries on both sides. Law `제172조` versus `제172조의2` and both KOSHA prefix/suffix collisions fail closed while same-line Control and source-role gates remain unchanged. |
| C-2 exact punctuated vehicle alias lacked handler coverage | Added `차량계·기계 인접작업` to the actual production handler matrix and verified it resolves to `지게차 상하차` with the existing pending-confirmation semantics. |

## Citation boundary P2 remediation

| Finding | Remediation |
|---|---|
| CB-P2 fixed delimiter whitelist rejected ordinary punctuation | Replaced the punctuation whitelist with exact UID matching plus Unicode-aware continuation classification. Periods, commas, semicolons, terminal colons, brackets, ASCII/smart quotes, `，`, `。`, and `、` delimit citations; Unicode letters/marks/numbers, Hangul, ASCII alphanumerics, `_-/`, joined colons, and non-punctuation symbols remain non-boundaries. |

## Phase A generation grounding remediation

| Finding | Remediation |
|---|---|
| P1-G `handleGenerateSafetyDocpack` resolved the ontology pack but called `runAsk` with only question and mode | The actual handler now passes a structured `phaseAGrounding` object containing the exact pack, allowed Task/Hazard/Control content, exact cited UIDs and source roles, obligation classifications, materialization targets, and `generationPolicy.llmRole=naturalize_only`. |
| P1-G provider prompts could draft before seeing the fixed pack | Both the answer provider and all full-mode document provider prompts now begin with a one-line JSON-serialized untrusted evidence block, followed by fixed naturalization instructions, before the existing persona and context. Labels containing quotes, newlines, or delimiter text remain escaped JSON data. |
| P1-G unresolved or missing evidence could look grounded | Demo generation continues, but the MCP docpack explicitly reports `review_required_draft` or `missing_evidence_draft`; citation allow-lists and deterministic verified records remain empty and human confirmation remains pending. Missing Tasks receive no pack, allowed content, citation, or target fallback. |

This remediation intentionally preserves the template fast path (no provider call), enhanced-mode deterministic document bodies, and the existing Anthropic/Vertex/OpenAI fallback order. When those modes invoke an answer provider, its prompt receives the same Phase A block. Full mode also binds the block into every document provider prompt. Deterministic document-location inspection remains post-generation and does not infer materialization from prompt inclusion.

## Official law verification

The current `산업안전보건기준에 관한 규칙` was checked as effective `2026-03-02` under 고용노동부령 제450호.

- [Article 42](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024005275)
- [Article 43](https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1028063341)
- [Article 44](https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1016700539)
- [Article 172](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1016700327)
- [Article 301](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024005221)
- [Article 302](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1030668033)
- [Articles 319, 321, 323 current page](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029038625)
- [Current full text](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=153999)

The Article 172 direct surface identifies `접촉의 방지`: paragraph 1 prohibits worker entry into contact-risk areas during vehicle-type material handling unless a work director or guide person is assigned, and paragraph 2 requires the operator to follow that direction. The same official surface states the instrument is effective `2026-03-02`.

## Verification

- TDD RED after independent review: 17 focused failures reproduced the original defects.
- Sidecar reconciliation RED: 7 failures reproduced missing chunk-level mappings; bridge/status RED added 4 further focused failures before implementation.
- Second-review TDD RED: 22 failures reproduced unsafe core state and unsplit/fake-citation provenance before implementation.
- Independent-review TDD RED: 10 failing assertions were observed across three RED cycles for sequence, fail-closed behavior, materialization separation, Control-level review gating, MCP output, and Article 172.
- Fresh-review TDD RED: 8 tests failed and 48 passed in one 56-test RED run, covering source-role leakage and the missing production handler seam.
- Fresh-review targeted GREEN: 2 files passed, 59 tests passed, including handler-level SIF, line-location, KOSHA, law, alias, and pending-confirmation cases.
- Final-correction TDD RED: 3 tests failed and 60 passed in one 63-test RED run for Article suffix and KOSHA prefix/suffix collisions.
- Final-correction targeted GREEN: 2 files passed, 63 tests passed, including the exact `차량계·기계 인접작업` handler alias.
- Citation-boundary P2 TDD RED cycle 1: 8 punctuation tests failed and 86 tests passed in a 94-test run; all original continuation negatives remained green.
- Citation-boundary P2 TDD RED cycle 2: 2 broad-symbol boundary tests failed and 94 tests passed in a 96-test run.
- Citation-boundary P2 targeted GREEN: 2 files passed, 96 tests passed.
- Phase A generation-grounding TDD RED: 8 tests failed and 11 passed in one 19-test serial run, covering handler payload binding, provider prompt order, resolved/review-required/missing states, and zero-record unsupported citations.
- Focused ontology/generation/MCP/commercial/DB harness plus production/provider handlers and fallback compatibility, serial: 11 files passed, 203 tests passed. This includes all prior 169 focused tests.
- Strict TypeScript: passed.
- Previous full suite is informational only and was not rerun for this remediation: 125 files passed, 7 failed, 5 skipped; 1229 tests passed, 7 failed, 22 skipped. Failures were outside owned ontology/MCP/test/report files.
- Full-suite failed suites: `knowledge-page-layout`, `product-module-shell`, and `reports-download-center` due missing `.next/prerender-manifest.json` or hook timeout during concurrent dev-server tests.
- Full-suite failed tests: `frontend-route-coverage` 1, `module-shell-design-regression` 1, `reports-wave1-publish-support` 2 timeouts, and `workspace-layout-regression` 3.
- Serial isolation was interrupted by user after independently reproducing the 3 workspace layout failures, 1 module-shell mobile layout failure, and 1 frontend evidence-row failure. No ontology/MCP failure appeared.
- `git diff --check`: run immediately before commit.

Logs:

- `evaluation/phase-a-ontology-evidence-chains-2026-07-13/focused-tests.log`
- `evaluation/phase-a-ontology-evidence-chains-2026-07-13/typecheck.log`

This report, `report.json`, and both verification logs are tracked artifacts committed on this branch.

No DB publication, migration, schema change, Supabase mutation, generated seed change, or UI change is included. This remediation does not self-approve; fresh independent re-review remains required.
