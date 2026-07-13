# Phase A ontology evidence chains remediation report

- Date: 2026-07-13 (Asia/Seoul)
- Branch: `fix/phase-a-ontology-review`
- Base: `02295b5a7d2b068eb5ea560f4cc9a34392fd7c21`
- Contract: `phase-a-evidence-chains/1.3.0`
- Status: Whole-candidate authority remediation, awaiting fresh independent review
- Generated: `2026-07-14T02:52:54.7954556+09:00`, after focused, typecheck, and frontend-route probe logs completed
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
- Standalone `query_safety_knowledge` no longer returns the fixed `법제처 검증 시드 v1` provenance or the internal evidence pack. It returns candidate-marked controls/articles/duties, actual SIF/KOSHA/law cited-UID provenance, `authority=review_required`, and `evidenceChainState=review_required`.
- Planning remains deterministic: 9 controls create 18 risk-assessment/TBM targets and retain production item UID, local item ID, local chunk ID, exact SHA-256, page/location, and unresolved bridge state without inventing a chunk citation.
- Planned targets are `materializationTargets`; they are not completion claims. `verifiedRecords` are created only after exact inspection of a generated risk-assessment/TBM line containing the Control label and the source roles required by that Control classification. `statutory_mandate` requires current law, `technical_guidance_only` requires KOSHA, and `statutory_mandate_with_guidance` requires both at that document location.
- Authority requires the complete unique planned stableKey set. A partial `1/N` result remains `review_required`, duplicate document hits cannot inflate coverage, and `PhaseAReview` carries expected, materialized, and unresolved stableKey lists plus exact counts.
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
| P2-9 MCP provenance regression | Superseded by the external candidate-only projection: provenance is assembled from the resolved SIF/KOSHA/law references, while authority remains `review_required` until the complete Phase A materialization contract and human confirmation are satisfied. |

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
| P1-G provider prompts could draft before seeing the fixed pack | Both the answer provider and all full-mode document provider prompts receive the fixed pack and exact allow-list before drafting. Labels containing quotes, newlines, or delimiter text remain escaped JSON data. |
| P1-G unresolved or missing evidence could look grounded | Demo generation continues, but the MCP docpack explicitly reports `review_required_draft` or `missing_evidence_draft`; citation allow-lists and deterministic verified records remain empty and human confirmation remains pending. Missing Tasks receive no pack, allowed content, citation, or target fallback. |

This remediation intentionally preserves the template fast path (no provider call), enhanced-mode deterministic document bodies, and the existing Anthropic/Vertex/OpenAI fallback order. When those modes invoke an answer provider, its prompt receives the same Phase A block. Full mode also binds the block into every document provider prompt. Deterministic document-location inspection remains post-generation and does not infer materialization from prompt inclusion.

## Closed generation harness remediation

| Finding | Remediation |
|---|---|
| P1-H untrusted text could escape the grounding boundary | Every grounded answer/document provider prompt now starts with the immutable `naturalize_only` security policy, followed by exactly one delimited JSON block. The original question, search context, scenario, Task/Control/source labels, and follow-on risk rows remain JSON data and are never appended raw after the boundary. Boundary characters inside JSON strings are Unicode-escaped, so injection-shaped delimiter text cannot create or duplicate a boundary while `JSON.parse` still restores the exact input. |
| P1-H generic persona instructions could request outside citations | Grounded persona, schema, emergency, legal, and KOSHA instructions now require the Phase A allow-list or `현장 확인 필요`; the legacy generic citation instructions remain only on ungrounded paths. The optional raw legal-citation mapper is skipped when Phase A grounding is present. |
| P1-H QA verdict could conflict with grounding state | Legacy QA is retained only as a nested diagnostic and is never authoritative. Top-level reviewed status additionally requires resolved grounding, passing coverage/quality, complete unique planned stableKey materialization, and completed human confirmation. The current pending flow therefore remains `검토 필요` and not verified. |
| P1-H ontology lookup failure aborted generation | Lookup exceptions are logged without exception text or secrets and become explicit missing Phase A grounding. Template mode stays deterministic and provider-free; enhanced/full provider fallback remains reachable, but the returned docpack is marked review-required and unverified. No published ontology fallback is synthesized. |
| P1-H the provider pack was not mutation-proof | The complete grounding object, including the pack, allowed evidence, citation UIDs, and materialization targets, is structured-cloned and recursively frozen before `runAsk`. A handler-seam mutation test verifies that source and frozen-object mutation attempts cannot alter either the provider prompt or deterministic post-check. |
| P1-H Claw generation bypassed the grounded handler | Both reviewed and plain Claw document tools now call the same production grounding handler, including the ontology-failure behavior and reconciled reviewed status. |

Chosen compatibility behavior: unresolved or unavailable Phase A evidence does not stop demo generation in enhanced/full modes. Those modes may call the existing provider fallback, but their output is explicitly a review-required, unverified draft with no verified materialization records and pending human confirmation. Template mode never calls a provider, including when ontology lookup fails.

## Fresh release HOLD candidate

| Finding | Candidate change awaiting independent review |
|---|---|
| HOLD-1 public/general `runAsk` callers bypassed Phase A | Enumerated every production invocation. JSON ask, SSE ask, the `/ask` page call path, and briefing now use one grounded wrapper; MCP continues through its grounded handler. The wrapper resolves ontology before `runAsk`, converts lookup failure or an unmatched Task to explicit missing grounding without leaking error text, and `runAsk` itself also defaults omitted grounding to the secured missing object. The legacy raw citation-mapping branch was removed. |
| HOLD-1 provider/template compatibility | Enhanced/full generation remains reachable through the fixed policy and one JSON boundary. Template remains provider-free. Every public `AskResponse` carries `phaseAReview` with `검토 필요`, `verified=false`, zero verified records, and human confirmation pending. JSON/SSE and briefing are exercised through actual handlers; the App Router page is covered by a source call-site contract because this Vitest configuration preserves TSX. |
| HOLD-2 legacy QA could become authoritative | `qa.authoritative` is always false. Passing legacy QA alone cannot produce a top-level pass. The gate requires resolved grounding, complete unique planned stableKey materialization, and completed human confirmation in addition to coverage/quality. Tests cover complete records with human pending, partial/zero records, and duplicate records; all remain `검토 필요` unless the full authority contract is met. |
| HOLD-3 draft SIF could enter a resolved allow-list | `hazard_priority_only` retains its limited role but now also requires `verified|published` and exact `resolved` state. With a test-only ready KOSHA gate and unchanged draft SIF registry data, the actual resolver returns `review_required`; allowed evidence and verified materialization remain empty. A caller-forced resolved state is downgraded before post-check. |

This is a review candidate, not a release-completion claim. `launchReady` remains false and no production SIF or KOSHA registry record was promoted.

## Integration HOLD remediation

| Finding | Candidate change awaiting independent review |
|---|---|
| Integration-1 pending Phase A did not gate readiness/share | A single Phase A authority check now requires resolved grounding, `verified=true`, complete unique planned stableKey materialization, and completed human confirmation. `qualityContract`, workpack readiness, command-center status, and share controls all consume that result; legacy coverage QA remains diagnostic and cannot produce ready/pass/shareable state. |
| Integration-2 briefing and storage lost pending semantics | Briefing email, dispatch payload, and workpack persistence retain `phaseAReview`, zero verified records, and human-pending state. Automatic briefing dispatch fails closed. Pending law/KOSHA/KOSHA-education/accident results are empty in authoritative evidence fields and remain only under an explicitly non-authoritative diagnostic block. |
| Integration-3 ontology lookup could hang | Pure `lib/ontology-deadline-policy.ts` owns ontology-only budgets. Grounding preflight and Supabase graph fetch use bounded `AbortSignal` deadlines, never inherit Vertex/deliverables timeout environment variables, and log only fixed error type/code. Template/enhanced/full continue with explicit missing, unverified, human-pending grounding after timeout. |
| Integration-4 one request loaded changing graphs repeatedly | Successful public, MCP, and Claw requests load one published graph snapshot and pass the exact object through generation and post-generation QA. A failed preflight passes an explicit `null` snapshot sentinel, so QA does not issue a second graph load. |
| Integration-5 report authority/order drift | The actual prompt order is fixed `naturalize_only` security policy first, then one JSON-serialized untrusted block, then conditioned persona/context. This report now records legacy QA as diagnostic only. |

This remains an Integration HOLD candidate. No launch or integration completion is claimed before a new independent review.

## Fresh authority-leak remediation

| Finding | Candidate change awaiting independent review |
|---|---|
| P1-1 standalone legacy QA exposed an authoritative-looking pass | Both the MCP route and direct Claw tool now wrap the complete legacy coverage result under `qa.authority=diagnostic_only`. The external result has no top-level legacy `verdict`; its `reviewStatus` is always `review_required`, `검토 필요`, `verified=false`, `authoritative=false`, and human-confirmation `pending`. Tool descriptions also direct authority-seeking consumers to `generate_reviewed_safety_docpack` plus human confirmation. |
| P1-2 ask and reused citation UI promoted pending evidence | `AnswerPanel`, `CitationList`, `FieldOperationsWorkspace`, `CurrentWorkpackModules`, and the workpack editor evidence panel consume the same Phase A authority projection. Pending, review-required, or missing state preserves every citation/link while labeling it `근거 검토 필요`, `연결 후보`, `보조 후보`, or `법제처 확인 후보`. Answer summary/status notes, DB harness counts, citation locations, and TBM/education locations also remain candidate-only. `근거 연결됨`, `직접 근거`, and `법제처 인용` appear only when resolved grounding, verified output, complete planned stableKey materialization, and completed human confirmation all hold. |

This change does not make standalone coverage QA authoritative and does not infer per-citation materialization from raw law/KOSHA retrieval. It changes authority copy/state wiring only. `launchReady` remains false, and another fresh independent review is required before integration.

## Full materialization and knowledge-tool remediation

| Finding | Candidate change awaiting independent review |
|---|---|
| P1-1 partial materialization could authorize output | `PhaseAReview.materializationCoverage` now records the exact unique planned stableKey set, materialized set, unresolved set, and counts. Authority, quality readiness, workpack sharing, reviewed MCP output, and UI copy require complete set equality; `1/N`, malformed counts, extra keys, and duplicate keys fail closed. |
| P1-1 mandate-plus-guidance accepted one source role | Deterministic document inspection now checks the classification-specific role set on the same Control line. A combined mandate/guidance Control requires both current-law `mandatedBy` evidence and verified KOSHA technical guidance. SIF remains hazard priority only. |
| P1-2 fallback document text used live retrieval as authority | `runAsk` attaches deterministic materialization coverage before quality evaluation and reconciles every generated summary to the Phase A authority result. Pending/missing summaries say `법령 근거: 검토 필요`; the same text reaches `CurrentWorkpackModules`, `WorkpackEditor`, briefing email, and dispatch documents. |
| P1-3 standalone knowledge query looked validated | MCP and Claw now project query results through a candidate-only DTO. Controls, articles, and duties are marked candidate; provenance is built from actual SIF/KOSHA/law UIDs; the internal evidence pack is not exposed; found and not-found outputs both remain `review_required`. Agent instructions and descriptors no longer call this output law.go.kr-validated or direct authority. |
| P1-4 prior authority fixes regressed | Focused tests retain nested `diagnostic_only` standalone QA, pending citation labels, unresolved-SIF gating, timeout/snapshot reuse, and public grounding boundaries. |

Scope accounting is explicit: the independent review observed 59 branch-diff files at `c51c6c1`, and the rejected whole candidate `a5ae9f7` contained 61. The current `02295b5..candidate` diff contains 66 files. Relative to `a5ae9f7`, the five additions are the HWP/PDF/XLSX export authority paths, `tests/phase-a-document-authority.test.ts`, and the preserved frontend-route probe log. The serial focused command contains 29 test files; that number is not a branch-diff count.

This remains a HOLD candidate. It is not an integration or launch completion claim.

## Whole-candidate remediation

| Finding | Candidate change awaiting independent review |
|---|---|
| WC-1 client/DTO could shrink the expected plan | The authority gate derives the complete ordered stableKey set from the immutable server registry plan and checks the canonical `planDigest` and `chainId`. Singleton, reordered, duplicate, shrunk, and forged plans fail closed. A confirmed review must carry a nonblank reviewer ID and strict ISO confirmation time bound to that exact chain and digest. Persisted state is parsed from `unknown` with structural guards. |
| WC-2 source roles were not fully revalidated | Resolved grounding revalidates ready SIF priority evidence, ready KOSHA guidance, and current-law mandate evidence at each exact Control. Combined mandate-plus-guidance requires both law and KOSHA; unresolved/draft SIF or KOSHA and pending Control review remain `review_required`. |
| WC-3 another document section could satisfy a target | Inspection requires exactly one `[rowOrSection]` heading for each planned document target, then requires the Control label and classification-specific citations on one line inside that section. Wrong, missing, and duplicate sections do not materialize a stableKey. |
| WC-4 pending body/export copy could look authoritative | Pending risk assessment, TBM, briefing, mobile preview, editor, TXT/JSON, HWP/PDF, and structured XLSX surfaces inject `법령 근거: 검토 필요` plus `공식자료 연결 후보`. Misleading `공식자료 기반` copy is downgraded on the rendered/exported copy while the editable stored body remains unchanged. |
| WC-5 raw evidence pack escaped externally | MCP, Claw, and reviewed docpack responses use a typed candidate-only public projection containing safe SIF/KOSHA/law provenance and review state. Raw packs, graph/task/hazard/article node IDs, runtime IDs, raw input, and internal references are excluded. |
| WC-6 provider inputs were assembled through side channels | One deterministic recursively frozen snapshot is built before the first answer/document provider call. It orders SIF, KOSHA, and current law, then carries site/history/weather/legal-search/training/accident/reference context with typed provenance and per-input digests. Provider prompts naturalize only that snapshot through the fixed policy and single JSON boundary. |
| WC-7 query DTO compatibility risk | `query_safety_knowledge/v2` retains `compatibilityVersion=v1-candidate`, `coreProvenance`, and top-level string article/duty aliases. Rich candidate annotations remain nested, and unknown/unresolved queries stay neutral, non-authoritative candidates. |
| WC-8 false-green coverage | New or corrected tests reject shrunk/singleton plans, SIF-only and unresolved-KOSHA resolution, wrong/duplicate sections, marker-less pending TBM/XLSX/export bodies, private pack fields, non-string v1 aliases, and incomplete provider snapshots. |

Integration was not performed. The target remains `77d8641` with merge base `02295b5a7d2b068eb5ea560f4cc9a34392fd7c21`. The three-way preview reports both files changed but no overlapping textual conflict:

- `components/FieldOperationsWorkspace.tsx`: candidate authority hunks at `+31`, `+573`, `585-586`, `611`, and `630`; target editor/sidebar hunks at `851`, `1243-1278`, `1280`, `1295`, `1309`, and `1311-1319`. A later selective integration must preserve both the Phase A labels/CitationList state and the target's `editor` surface plus collapsible operations sidebar.
- `components/SafeGuardCommandCenter.tsx`: candidate authority hunks at `+56`, `454-459`, `475-503`, `527-551`, `611-637`, and `700-826`; target input hunk at `2346`. A later selective integration must preserve the authority/readiness gates and `surface="editor"`.

The frontend route probe intentionally remains RED at `tests/frontend-route-coverage.test.ts:693` because its tracked browser-audit `sourceIdentity` is stale. This remediation does not regenerate or claim that integration evidence.

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
- Closed-harness TDD RED: 16 failures were reproduced across five narrow runs: 10/56 at answer/document/MCP/handler seams, 2/2 at the actual Claw tool seam, 1/3 for grounded raw-citation mapping, 1/8 for a remaining generic legal instruction, and 2/11 for literal delimiter-token duplication inside serialized malicious input.
- Fresh release-HOLD TDD RED: 8 product failures across five runs: omitted grounding 1/4, JSON/SSE call sites 3/4, QA authority 2/31, KOSHA-ready plus draft SIF resolver 1/1, and forced-resolved SIF post-check 1/2. A separate App Router TSX import-analysis limitation was corrected to the repo's source-contract test style and is not counted as a product RED.
- Integration-HOLD TDD RED: 35 product assertions failed across 12 narrow contract runs, plus one missing-policy-module RED suite. These covered quality/readiness/UI/share, briefing/dispatch/storage, bounded fallback, exact snapshot reuse, MCP/Claw wiring, pending KOSHA diagnostics, and failed-preflight no-reload behavior.
- Fresh authority-leak TDD RED: 11 product assertions failed across five narrow runs: standalone MCP/Claw authority 2/13, pending/ready/missing shared citation UI and call-site wiring 4/4, Claw tool-schema authority copy 1/18, AnswerPanel detail/location copy 3/8, and AnswerPanel top-level summary 1/4. A TSX direct-import parser limitation and one test-regex formatting mismatch were test-harness issues and are not counted as product RED.
- Full-materialization representative RED: 5 product tests failed and 92 passed in a 97-test serial run, reproducing one-sided mandate/guidance materialization, duplicate stableKey inflation, and partial/duplicate authority acceptance.
- Expanded authority/tool RED: 18 product assertions failed and 191 passed across 12 files; one TSX direct-import parser suite error was a test-harness issue and was replaced with the repo's source-contract style. Additional fail-closed candidate and editor-copy runs each reproduced 1 expected failure.
- Whole-candidate RED: 25 product assertions failed across five non-overlapping runs (`9/116`, `7/57`, `2/6`, `6/127`, and `1/5`); a sixth `2/2` Claw isolation run repeated failures already counted in the `7/57` run. The `6/127` run also had one suite-initialization RED until the canonical plan helper existed.
- Whole-candidate intermediate GREEN: 29 files/351 tests, then 12 files/201 tests and 6 files/145 tests passed while false-green fixtures were tightened; the actual structured XLSX regression moved from `1 failed, 4 passed` to `5 passed`.
- Focused ontology/generation/MCP/commercial/DB harness plus quality/readiness/UI, briefing/storage, deadline, snapshot, production/provider/Claw/public handlers, exports, and fallback compatibility, serial: 29 files passed, 360 tests passed.
- Additional frontend evidence probe: 36 tests passed and 1 provenance assertion failed because the separately tracked browser-audit `sourceIdentity` predates these owned TSX label changes. That external browser audit bundle was not regenerated outside this remediation artifact scope.
- Strict TypeScript: passed.
- Previous full suite is informational only and was not rerun for this remediation: 125 files passed, 7 failed, 5 skipped; 1229 tests passed, 7 failed, 22 skipped. Failures were outside owned ontology/MCP/test/report files.
- Full-suite failed suites: `knowledge-page-layout`, `product-module-shell`, and `reports-download-center` due missing `.next/prerender-manifest.json` or hook timeout during concurrent dev-server tests.
- Full-suite failed tests: `frontend-route-coverage` 1, `module-shell-design-regression` 1, `reports-wave1-publish-support` 2 timeouts, and `workspace-layout-regression` 3.
- Serial isolation was interrupted by user after independently reproducing the 3 workspace layout failures, 1 module-shell mobile layout failure, and 1 frontend evidence-row failure. No ontology/MCP failure appeared.
- `git diff --check`: run immediately before commit.

Logs:

- `evaluation/phase-a-ontology-evidence-chains-2026-07-13/focused-tests.log`
- `evaluation/phase-a-ontology-evidence-chains-2026-07-13/typecheck.log`
- `evaluation/phase-a-ontology-evidence-chains-2026-07-13/frontend-route-probe.log`

Log provenance: focused log finalized `2026-07-13T17:51:17.2657895Z`; typecheck log finalized `2026-07-13T17:51:17.2707983Z`; frontend-route probe log finalized `2026-07-13T17:51:17.2747995Z` with 36 passes and the single stale-identity RED at line 693. This report was generated afterward.

This report, `report.json`, and all three verification logs are candidate commit artifacts on this branch.

No DB publication, migration, schema change, Supabase mutation, or generated seed change is included. The authority UI changes only expose Phase A state and replace authority-looking labels; citation data and links remain available. This remediation does not self-approve; fresh independent re-review remains required.
