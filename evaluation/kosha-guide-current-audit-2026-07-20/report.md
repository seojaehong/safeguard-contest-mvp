# KOSHA GUIDE corpus / harness audit

- generatedAt: 2026-07-19T19:51:21.449Z
- readOnly: true
- dbMutationPerformed: false
- uploadPerformed: false
- elapsedSeconds: 80.696

## 결론

**NOT launch-ready for authoritative KOSHA-guide grounding.** 로컬 ZIP과 env-configured Supabase snapshot의 1,040행 count/hash parity는 corpus content parity만 증명한다. production deployment identity, authoritative 본문, item-level provenance, control causality, 공식 version/current-state 적합성은 증명하지 않는다.

로컬 ZIP 10개에는 PDF 1,040건이 있으며 production status도 KOSHA GUIDE 1,040건을 노출한다. 공식 KOSHA 현행 목록은 1,039건이다. 로컬은 현행 stable key를 모두 포함하지만 version 불일치 7건과 공식 폐지 1건을 포함한다.

Production status는 fresh MISS 응답이다. Env-configured Supabase snapshot 1,040건과 canonical hash `8f068e0be64e8b16145da7dc5a25450c81f13944773cb5873f3df6a504df93e0`를 직접 검증했다. production deployment와 같은 project라는 identity는 직접 증명되지 않았다.

## Severity-ranked blockers

| rank | severity | blocker | rows | evidence | release condition |
|---:|---|---|---:|---|---|
| 1 | BLOCKER | `authoritative-body-empty` | 818 | 818 rows have no parsed body, including 15 attempted empty outputs and 803 non-attempted guideline rows; count/hash parity cannot ground answers in missing text | source PDF text or reviewed OCR body is non-empty and hash/provenance linked |
| 2 | BLOCKER | `item-provenance-missing` | 1,040 | item URL column schema-absent; payload URL/file ID/published/status missing 1040/1040/1040/1040 | every launch row resolves to official item URL, file ID, publication date, and current/retired state |
| 4 | HIGH | `operational-control-ground-truth-review` | 70 | 70 heuristic-delta rows lack explicit labels; 0 rows explicitly cleared | every heuristic delta receives explicit reviewed ground-truth labels |
| 5 | HIGH | `operational-control-cross-domain-candidate` | 1 | 1 cross-domain candidate rows remain after the second heuristic | remaining controls are re-derived from source body and cross-domain fixtures pass |
| 6 | HIGH | `official-version-or-state-drift` | 8 | 7 current version mismatches and 1 officially retired local row | official current version replaces stale version and retired rows are excluded after approval |
| 7 | HIGH | `summary-not-source-grounded` | 822 | 818 fallback-template rows plus 4 non-template reused summaries; not identical full-content count | source-grounded summaries replace fallback and bullet-only values |
| 8 | MEDIUM | `production-retrieval-branch-unobserved` | 2 | observed modes hybrid-local-supabase, rest-ilike, local-hybrid; vector states disabled | ranked and hybrid production branches are observed with KOSHA evidence reflection |

## 정확한 건수

| 항목 | count |
|---|---:|
| 로컬 ZIP | 10 |
| 로컬 PDF | 1040 |
| 로컬 기술지원규정 | 237 |
| 로컬 기술지침 | 803 |
| PDF parse attempted | 237 |
| usable nonempty parse success | 222 |
| empty_output / OCR-required boundary | 15 |
| hard parse failure | 0 |
| parse not attempted | 803 |
| production visible | 1040 |
| 공식 현행 | 1039 |
| 공식 폐지 | 679 |
| version 불일치 | 7 |
| 폐지 local row | 1 |
| 빈 body | 818 |
| normalized exact-summary reuse group / rows | 11 / 822 |
| fallback summary group / rows | 10 / 818 |
| non-template duplicate summary group / rows | 1 / 4 |
| non-empty exact-body duplicate candidates group / rows | 1 / 4 |
| ZIP CRC32+size duplicate candidates group / rows | 0 / 0 |
| raw-control initial heuristic rows | 73 |
| raw-control ground-truth-cleared rows | 0 |
| raw-control review-required heuristic rows | 73 |
| raw-control heuristic delta flags | 74 |
| raw-control secondary-heuristic candidates | 0 |
| operational initial heuristic rows | 71 |
| operational ground-truth-cleared rows | 0 |
| operational review-required heuristic rows | 70 |
| operational heuristic delta flags | 71 |
| operational secondary-heuristic candidates | 1 |

## Snapshot manifest gate (not readiness)

이 gate는 측정된 shape/count/hash와 parse accounting snapshot의 재현성을 확인한다. empty_output은 성공이 아닌 boundary이며, launch readiness는 위 blocker table과 전체 checks에서 별도로 판정한다.

- local entry hash: `164ef50791bc6f3581420efa5cdcbbd675681e96ab0d83b848eb680151beeb5c`
- local parsed row hash: `8f068e0be64e8b16145da7dc5a25450c81f13944773cb5873f3df6a504df93e0`
- local parse accounting: 237 attempted = 222 usable + 15 empty_output + 0 hard failure
- env-configured Supabase row hash: `8f068e0be64e8b16145da7dc5a25450c81f13944773cb5873f3df6a504df93e0`
- official current hash: `4ccd2d3a8e72ebaf3666882533df0b3f4f2ec04403a6458f3d72d62c07a99156`
- official retired hash: `28dce36e21ed4a6caa261146cd79bbd2e24f5011b9e2b95def9dc8934e24a56f`
- snapshot manifest failures: 없음 (shape/count/hash/parse accounting matched; readiness blockers remain)

## Metadata / provenance

- source ID: `kosha-technical-support-regulations-2025`
- item types: `technical-support-regulation`, `technical-guideline`
- local source publishedAt: 2025-01-01
- local source originUrl: 없음
- previous Supabase source createdAt: 2026-05-02T04:24:41.700198+00:00
- previous Supabase source updatedAt: 2026-05-02T04:24:41.700198+00:00
- official published range: 2010-08-31 ~ 2026-01-30
- env-configured Supabase created/updated range: created 2026-05-02T04:24:55.971033+00:00 ~ 2026-05-02T04:24:57.2222+00:00 / updated 2026-05-02T04:24:55.971033+00:00 ~ 2026-05-02T04:24:57.2222+00:00
- DB item URL column: schema-absent; payload official URL provenance missing: 1040
- DB item official file ID/published/status missing: 1040 / 1040 / 1040
- representative official PDF URL probes: 5/5

## Duplicate-summary interpretation

822건은 normalized summary 문자열 재사용 수치이며 identical PDF 또는 identical full-content 수치가 아니다. 이 중 818건은 body가 비어 있는 category fallback template 10개이고, 나머지 4건은 non-template summary 재사용이다. non-empty extracted body의 exact-duplicate 후보는 4건이며, ZIP binary 수준 CRC32+size duplicate 후보는 0건이다.

| rows | classification | non-empty body rows | normalized summary |
|---:|---|---:|---|
| 170 | fallback template | 0 | 산업위생분야 분야의 KOSHA 기술지원규정 또는 안전보건 기술지침 자료입니다. |
| 140 | fallback template | 0 | 화학안전분야 분야의 KOSHA 기술지원규정 또는 안전보건 기술지침 자료입니다. |
| 106 | fallback template | 0 | 기계안전분야 분야의 KOSHA 기술지원규정 또는 안전보건 기술지침 자료입니다. |
| 4 | non-template | 4 | ㆍ |

## Representative secondary-heuristic candidates

아래는 두 heuristic 간 비교 후에도 cross-task 후보로 남은 operational control 사례다. initial heuristic 71행에서 사라진 delta 중 명시 ground-truth로 cleared된 행은 0건이고, 라벨이 없어 review-required인 행은 70건이다. heuristic 차이만으로 contamination pass나 false-positive 판정을 내리지 않는다.

| row | title | flags | matched operational controls |
|---|---|---|---|
| `technical-support-01-0018-c-27-2011-낙하물-방호선반-설치-지침` | C-27-2011 낙하물 방호선반 설치 지침 | `machinery-control-cross-task` | 가동부 방호덮개 설치 및 비상정지장치 작동 확인 |

## Version mismatch

| stable key | official | local |
|---|---|---|
| `B-M-7` | `B-M-7-2025` | `B-M-7-2026` |
| `M-91` | `M-91-2012` | `M-91-2011` |
| `A-46` | `A-46-2021` | `A-46-2018` |
| `A-48` | `A-48-2021` | `A-48-2018` |
| `W-26` | `W-26-2023` | `W-26-2022` |
| `C-C-83` | `C-C-83-2020` | `C-C-83-2026` |
| `D-61` | `D-61-2018` | `D-61-2017` |

폐지 local row: `W-14-2022 W-14-2022_경고표지 작성 지침.pdf`

## Retrieval / reflection

Production search가 관측한 mode: hybrid-local-supabase, rest-ilike, local-hybrid. Vector 상태는 disabled다. 실제 관측 mode에 해당하는 branch만 tested이며, 나머지 ranked/vector/hybrid branch는 untested boundary다.

| scenario | branch | execution | selected evidence | failures |
|---|---|---|---:|---:|
| exterior-paint | rest | tested | 0 | 6 |
| exterior-paint | ranked | untested | 0 | 1 |
| exterior-paint | hybrid | untested | 0 | 1 |
| confined-pump | rest | tested | 5 | 1 |
| confined-pump | ranked | untested | 0 | 1 |
| confined-pump | hybrid | untested | 0 | 1 |
| forklift-traffic | rest | tested | 5 | 2 |
| forklift-traffic | ranked | untested | 0 | 1 |
| forklift-traffic | hybrid | untested | 0 | 1 |
| electrostatic-paint | rest | tested | 1 | 4 |
| electrostatic-paint | ranked | untested | 0 | 1 |
| electrostatic-paint | hybrid | untested | 0 | 1 |

각 downstream record에는 selected title, prompt context, deterministic answer, document reflection label이 JSON 보고서에 보존된다. KOSHA code/title과 task-specific control이 함께 있어야 통과하며 generic prose만 있는 경우 실패한다.

## Refresh plan

현재 identity dry-run은 DB를 쓰지 않고 다음 diff를 산출했다.

| insert | update | retire | unchanged |
|---:|---:|---:|---:|
| 0 | 7 | 1 | 1032 |

1. **Approval gate 1:** 이 보고서와 per-item dry-run을 승인하기 전에는 DB update/retire/upload를 수행하지 않는다. schema 변경도 하지 않는다.
2. category + current/retired + page shard로 공식 목록을 증분 조회하고, publishedAt checkpoint와 stable key/version key를 함께 reconciliation한다.
3. empty page, 빈 file ID/seq, zero-byte 또는 empty-response 다운로드는 저장 후보에서 제외하고 shard failure로 기록한다.
4. identity diff 0/7/1/1032를 검토하고, update 7건과 retire 1건의 공식 URL/hash를 개별 확인한다.
5. body가 빈 818건을 shard별 HEAD/download/hash/text/OCR dry-run 대상으로 만들고, item-level URL/file ID/published/status 1040건을 기존 필드에 backfill할 후보 JSON으로만 산출한다.
6. fallback/non-template summary 822건을 source-grounded abstract 후보로 교체하고 secondary-heuristic operational candidate 1건의 controls를 본문 근거로 재도출한다.
7. representative high-risk retrieval을 rest/ranked/hybrid로 다시 실행해 KOSHA title, source URL, source-grounded control, document reflection이 모두 있는지 확인한다.
8. **Approval gate 2:** zero mutation dry-run artifact와 focused tests 승인 후에만 별도 작업에서 incremental mutation을 허용한다. 본 audit 실행은 계속 read-only다.

## Checks

| check | status | count | detail |
|---|---|---:|---|
| `manifest-gate` | pass | 0 | snapshot shape/count/hash manifest matched; readiness evaluated separately |
| `local-empty-pdf` | pass | 0 | zero-byte PDF archive entries |
| `local-duplicate-content` | pass | 0 | same CRC32 and byte length candidates |
| `local-parse-accounting` | pass | 0 | 1040 returned; 237 attempted; 222 usable nonempty; 15 empty output; 0 hard failed |
| `local-pdf-empty-output` | boundary | 15 | attempted PDF parses with no usable nonempty body; OCR or extraction review required |
| `local-pdf-parse-failure` | pass | 0 | per-PDF parser exceptions; empty outputs are tracked as a separate boundary |
| `operational-audit-deterministic` | pass | 0 | a01aae777ca702f0827f4774fc1d13ad31201762f135f9e9b3d3fe5398d70785 / a01aae777ca702f0827f4774fc1d13ad31201762f135f9e9b3d3fe5398d70785 |
| `source-mutation` | pass | 0 | derive operational metadata must not mutate source rows |
| `empty-body` | fail | 818 | local ingest-equivalent rows with empty body |
| `duplicate-summary` | fail | 822 | 11 normalized-summary groups; 818 fallback rows; not an identical full-content count |
| `missing-source-url` | fail | 1,040 | item URL column is schema-absent; rows lack official URL provenance in payload aliases |
| `missing-official-file-id` | fail | 1,040 | rows without official file provenance |
| `missing-official-published-at` | fail | 1,040 | rows without official publication date |
| `missing-official-status` | fail | 1,040 | rows without current or retired state |
| `raw-tag-control-alias` | pass | 0 | raw risk tag emitted as a standalone control |
| `raw-control-initial-heuristic` | boundary | 73 | pre-calibration candidate rows; not a launch blocker count |
| `raw-control-ground-truth-clearance` | boundary | 73 | 0 explicitly cleared rows; 74 heuristic delta flags |
| `raw-control-secondary-heuristic` | boundary | 0 | secondary-heuristic candidate rows; not a contamination verdict |
| `operational-control-initial-heuristic` | boundary | 71 | pre-calibration candidate rows; not a launch blocker count |
| `operational-control-ground-truth-clearance` | boundary | 70 | 0 explicitly cleared rows; 71 heuristic delta flags |
| `operational-control-secondary-heuristic` | boundary | 1 | secondary-heuristic candidate rows; not a contamination verdict |
| `official-current-stable-key-parity` | pass | 0 | 1039/1039 current stable keys found locally |
| `official-version-mismatch` | fail | 7 | stable key matched but canonical version code differed |
| `retired-local-row` | fail | 1 | local rows absent from current and present in retired list |
| `official-url-representative` | pass | 0 | 5/5 representative PDF HEAD probes passed |
| `retrieval-document-reflection` | fail | 13 | exterior-paint/rest:missing-kosha-evidence:B-E-17-2026, exterior-paint/rest:missing-kosha-evidence:D-C-13-2026, exterior-paint/rest:missing-control-term:도료, exterior-paint/rest:missing-control-term:유기용제, exterior-paint/rest:missing-control-term:작업발판, exterior-paint/rest:missing-control-term:안전대, confined-pump/rest:missing-kosha-evidence:E-G-18-2026, forklift-traffic/rest:missing-kosha-evidence:B-M-11-2025, forklift-traffic/rest:missing-control-term:보행자, electrostatic-paint/rest:missing-kosha-evidence:B-E-20-2026, electrostatic-paint/rest:missing-control-term:정전기, electrostatic-paint/rest:missing-control-term:접지, electrostatic-paint/rest:missing-control-term:방폭 |
| `supabase-visible-parity` | pass | 0 | production status counts and env-configured Supabase snapshot counts matched; deployment identity unproven |
| `local-env-supabase-canonical-parity` | pass | 0 | 8f068e0be64e8b16145da7dc5a25450c81f13944773cb5873f3df6a504df93e0 / 8f068e0be64e8b16145da7dc5a25450c81f13944773cb5873f3df6a504df93e0 |
| `env-configured-supabase-full-row-hash` | pass | 0 | 8f068e0be64e8b16145da7dc5a25450c81f13944773cb5873f3df6a504df93e0 |
| `deployment-supabase-identity` | boundary | 1 | deployment-project-identity-unverified |
| `production-ranked-branch` | boundary | 1 | observed modes: hybrid-local-supabase, rest-ilike, local-hybrid |
| `production-hybrid-branch` | boundary | 1 | observed vector states: disabled |

## 접근 경계

- Env-configured Supabase snapshot was available; deployment/project identity was not directly proven.
- Production status remained visible through https://safeguard-contest-mvp.vercel.app/api/safety-reference/status.
- Production retrieval modes observed: hybrid-local-supabase, rest-ilike, local-hybrid; vector states: disabled.
- The official list probe read 1039 current and 679 retired rows; only 5 representative PDF URLs received HEAD probes.
- No DB schema change, upload, embedding generation, or data mutation was performed.

## 증거 URL

- 공식 목록: https://portal.kosha.or.kr/archive/resources/tech-support/search/all?page=1&rowsPerPage=10
- 공식 목록 API: https://portal.kosha.or.kr/api/portal24/bizV/p/VCPDG08009/selectList
- production status: https://safeguard-contest-mvp.vercel.app/api/safety-reference/status

## Commands

`npm.cmd run audit:kosha-guides`

`npm.cmd test -- tests/kosha-guide-corpus-audit.test.ts`

`python -m unittest scripts.tests.test_snapshot_kosha_guide_corpus scripts.tests.test_ingest_safety_reference_catalog`
