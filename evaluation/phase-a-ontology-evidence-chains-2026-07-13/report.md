# Phase A ontology evidence chains report

- Date: 2026-07-13 (Asia/Seoul)
- Branch: `feat/phase-a-ontology-evidence-chains`
- Base: `b39f8135e784f69aac12d947cf6a734aa429a3c5`
- Contract: `phase-a-evidence-chains/1.0.0`
- Runtime publication: not performed
- DB/Supabase mutation: not performed

## Implemented scope

Phase A adds a versioned, code-owned evidence-chain registry and resolver without changing the generated core seed, ontology schema, migrations, or Supabase data. The existing seven node kinds, seven edge relations, `cited_uids` parser, and `draft | verified | published` states remain unchanged.

The runtime flow is:

`input -> canonical Task/alias -> published subgraph -> SIF/KOSHA/law evidence pack -> naturalize_only -> quality check -> human confirm`

An exact published canonical Task, Hazard, or registry law Article marked `published_graph` must exist or resolution fails closed. The 제92조/제200조 records are official-current law overlays because those Article nodes are absent from the generated core seed; they do not alter seed source accounting.

## Canonical chains

| Chain | Canonical published Task | Hazard | Selected SIF | KOSHA | Current law |
|---|---|---|---:|---:|---|
| 고소작업 -> 추락 | `Task_work_at_height` | 추락 | 2 | 2 | 42, 43, 44 |
| 차량계·기계 인접작업 -> 끼임 | `Task_forklift_loading` | 끼임 | 2 | 3 | 92, 200 |
| 전기작업 -> 감전 | `Task_electrical_work` | 감전 | 3 | 2 | 301, 302, 319, 321, 323 |

`sif-아카이브-건설업-01985` is retained as `draft`, review-only, and `autoConfirm=false`. `kosha-60492776122f8b433994fc10` is explicitly excluded because its body is missing.

## Evidence authority

- SIF ranks hazard priority only. It does not create a legal duty or technical-guidance classification.
- KOSHA remains a separate `technical_guidance_only` layer and never becomes an Article or `mandatedBy` relation.
- Current law is the only source that validates `mandatedBy` duties.
- Field history and weather are stored as `scope_only` applicability context.
- The LLM receives a fixed pack under `naturalize_only`; quality review and explicit human confirmation remain required.
- Existing provider fallback code was not changed. The contract records `preserve_current_provider_fallback`.
- `fulfillsDuty` remains partial evidence under the existing `dutiesNote`; it is not treated as complete duty fulfillment.

All seven selected KOSHA records remain `draft + unresolved`. The corpus is `launchReady=false`, has `bodyMissingCount=1`, and incomplete download provenance, so every selected runtime control is `review_required` until a verified/published resolution override is supplied. No categorical legal-duty wording is emitted in that state.

The SIF corpus is prepared only. Embedding, upload, and ontology promotion were not performed.

## Materialization

Nine controls produce deterministic mappings to 18 targets: one risk-assessment row/section and one TBM row/section per control. Each mapping carries separate law, guidance, and SIF cited UIDs plus the condition-specific applicability statement. 제92조 is limited to maintenance/cleaning/inspection/repair/adjustment work; 제200조 is limited to vehicle-equipment contact risk.

## Official law verification

The current `산업안전보건기준에 관한 규칙` version was verified on 2026-07-13 as effective `2026-03-02` (`고용노동부령 제450호`). Official links:

- [제42조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024005275)
- [제43조](https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1028063341)
- [제44조](https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1016700539)
- [제92조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0092&lsiSeq=273603&urlMode=lsScJoRltInfoR)
- [제200조](https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=1000727229)
- [제301조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024005221)
- [제302조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1030668033)
- [제319조·제321조·제323조 current page](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029038625)
- [Current full-text cross-check](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=153999)

The supplied direct 제200조 link displays the `2025-09-01` version. The current full-text page displays `2026-03-02` and contains the same 제200조 contact-prevention text; both facts are preserved here rather than presenting the older direct surface as the current-version page.

## Verification

- Requested five-file baseline command: 5 files passed, 41 tests passed. The stated 68-test baseline was not reproduced at base `b39f813`.
- TDD RED: missing evidence-chain module and old law-only provenance failed as expected.
- TDD RED: removing published Article 301 failed to close the chain; the new gate was then implemented.
- Focused evidence-chain/knowledge: 2 files passed, 31 tests passed.
- Final combined Phase A gate: 4 files passed, 88 tests passed.
- Ontology regression: 10 files passed, 1 skipped; 83 tests passed, 1 skipped.
- MCP transform regression: 1 file passed, 26 tests passed.
- DB harness regression: 1 file passed, 31 tests passed.
- Strict TypeScript: passed.
- `git diff --check`: passed.
- Full suite: 129 files passed, 5 skipped; 1231 tests passed, 7 skipped; 3 UI-only files failed with 5 tests.

Fresh logs:

- `evaluation/phase-a-ontology-evidence-chains-2026-07-13/focused-tests.log`
- `evaluation/phase-a-ontology-evidence-chains-2026-07-13/typecheck.log`

Full-suite failures are outside this worktree's ownership and no UI files were changed:

- `tests/workspace-layout-regression.test.ts`: 3 layout assertions.
- `tests/frontend-route-coverage.test.ts`: 1 missing Day evidence row.
- `tests/module-shell-design-regression.test.ts`: 1 mobile content-position assertion.

Phase A targeted behavior is green. The repository-wide suite is not fully green because of the five unrelated UI failures above.
