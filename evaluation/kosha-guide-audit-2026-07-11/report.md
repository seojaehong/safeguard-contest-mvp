# KOSHA GUIDE corpus / harness audit

- generatedAt: 2026-07-11T09:05:30.571Z
- readOnly: true
- dbMutationPerformed: false
- uploadPerformed: false
- elapsedSeconds: 69.52

## 결론

**NOT launch-ready for authoritative KOSHA-guide grounding.** 로컬 ZIP과 current live Supabase의 1,040행 count/hash parity는 같은 corpus snapshot을 읽었다는 사실만 증명한다. authoritative 본문, item-level provenance, control causality, 공식 version/current-state 적합성은 증명하지 않는다.

로컬 ZIP 10개에는 PDF 1,040건이 있으며 production status도 KOSHA GUIDE 1,040건을 노출한다. 공식 KOSHA 현행 목록은 1,039건이다. 로컬은 현행 stable key를 모두 포함하지만 version 불일치 7건과 공식 폐지 1건을 포함한다.

Production status는 fresh MISS 응답이다. Current live full-row 1,040건과 canonical hash `8f068e0be64e8b16145da7dc5a25450c81f13944773cb5873f3df6a504df93e0`를 직접 검증했다. 로컬 parsed hash와 live hash의 parity도 별도 check로 확인했다.

## Severity-ranked blockers

| rank | severity | blocker | rows | evidence | release condition |
|---:|---|---|---:|---|---|
| 1 | BLOCKER | `authoritative-body-empty` | 818 | 818 rows have no parsed body; count/hash parity cannot ground answers in missing text | source PDF text or reviewed OCR body is non-empty and hash/provenance linked |
| 2 | BLOCKER | `item-provenance-missing` | 1,040 | item URL column schema-absent; payload URL/file ID/published/status missing 1040/1040/1040/1040 | every launch row resolves to official item URL, file ID, publication date, and current/retired state |
| 3 | HIGH | `operational-control-calibrated-candidate` | 1 | 71 initial rows; 70 fully cleared false positives; 71 flags removed; 1 calibrated candidate rows remain | remaining controls are re-derived from source body and cross-domain fixtures pass |
| 4 | HIGH | `official-version-or-state-drift` | 8 | 7 current version mismatches and 1 officially retired local row | official current version replaces stale version and retired rows are excluded after approval |
| 5 | HIGH | `summary-not-source-grounded` | 822 | 818 fallback-template rows plus 4 non-template reused summaries; not identical full-content count | source-grounded summaries replace fallback and bullet-only values |
| 6 | MEDIUM | `production-retrieval-branch-unobserved` | 2 | observed modes rest-ilike; vector states disabled | ranked and hybrid production branches are observed with KOSHA evidence reflection |

## 정확한 건수

| 항목 | count |
|---|---:|
| 로컬 ZIP | 10 |
| 로컬 PDF | 1040 |
| 로컬 기술지원규정 | 237 |
| 로컬 기술지침 | 803 |
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
| raw-control alias-cleared false-positive rows | 73 |
| raw-control alias-removed flags | 74 |
| raw-control calibrated candidates | 0 |
| operational initial heuristic rows | 71 |
| operational alias-cleared false-positive rows | 70 |
| operational alias-removed flags | 71 |
| operational calibrated candidates | 1 |

## Snapshot manifest gate (not readiness)

이 gate는 측정된 shape/count/hash snapshot의 재현성만 확인한다. launch readiness는 위 blocker table과 전체 checks에서 별도로 판정한다.

- local entry hash: `164ef50791bc6f3581420efa5cdcbbd675681e96ab0d83b848eb680151beeb5c`
- local parsed row hash: `8f068e0be64e8b16145da7dc5a25450c81f13944773cb5873f3df6a504df93e0`
- current live row hash: `8f068e0be64e8b16145da7dc5a25450c81f13944773cb5873f3df6a504df93e0`
- official current hash: `4ccd2d3a8e72ebaf3666882533df0b3f4f2ec04403a6458f3d72d62c07a99156`
- official retired hash: `28dce36e21ed4a6caa261146cd79bbd2e24f5011b9e2b95def9dc8934e24a56f`
- snapshot manifest failures: 없음 (shape/count/hash only; readiness blockers remain)

## Metadata / provenance

- source ID: `kosha-technical-support-regulations-2025`
- item types: `technical-support-regulation`, `technical-guideline`
- local source publishedAt: 2025-01-01
- local source originUrl: 없음
- previous Supabase source createdAt: 2026-05-02T04:24:41.700198+00:00
- previous Supabase source updatedAt: 2026-05-02T04:24:41.700198+00:00
- official published range: 2010-08-31 ~ 2026-01-30
- current live full-row created/updated range: created 2026-05-02T04:24:55.971033+00:00 ~ 2026-05-02T04:24:57.2222+00:00 / updated 2026-05-02T04:24:55.971033+00:00 ~ 2026-05-02T04:24:57.2222+00:00
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

## Representative calibrated contamination candidates

아래는 alias calibration 후에도 deterministic rule이 cross-task로 표시한 operational control 사례다. initial heuristic 71행 중 70행은 legitimate alias로 완전히 해소되었고 71개 flag가 제거되었다. 남은 1행도 launch 전 source text 기반 재검토가 필요하며, 이 표 자체를 문서 내용의 최종 의미 판정으로 사용하지 않는다.

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

Production search가 관측한 mode: rest-ilike. Vector 상태는 disabled다. 실제 production ranked/hybrid branch는 관측되지 않았고, 현재 production에서 받은 KOSHA 행을 동일한 DB harness에 넣어 rest/ranked/hybrid downstream reflection 계약을 결정적으로 재실행했다.

| scenario | branch | selected evidence | failures |
|---|---|---:|---:|
| exterior-paint | rest | 39 | 0 |
| exterior-paint | ranked | 39 | 0 |
| exterior-paint | hybrid | 39 | 0 |
| confined-pump | rest | 27 | 0 |
| confined-pump | ranked | 27 | 0 |
| confined-pump | hybrid | 27 | 0 |
| forklift-traffic | rest | 16 | 0 |
| forklift-traffic | ranked | 16 | 0 |
| forklift-traffic | hybrid | 16 | 0 |
| electrostatic-paint | rest | 38 | 0 |
| electrostatic-paint | ranked | 38 | 0 |
| electrostatic-paint | hybrid | 38 | 0 |

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
6. fallback/non-template summary 822건을 source-grounded abstract 후보로 교체하고 calibrated operational candidate 1건의 controls를 본문 근거로 재도출한다.
7. representative high-risk retrieval을 rest/ranked/hybrid로 다시 실행해 KOSHA title, source URL, source-grounded control, document reflection이 모두 있는지 확인한다.
8. **Approval gate 2:** zero mutation dry-run artifact와 focused tests 승인 후에만 별도 작업에서 incremental mutation을 허용한다. 본 audit 실행은 계속 read-only다.

## Checks

| check | status | count | detail |
|---|---|---:|---|
| `manifest-gate` | pass | 0 | snapshot shape/count/hash manifest matched; readiness evaluated separately |
| `local-empty-pdf` | pass | 0 | zero-byte PDF archive entries |
| `local-duplicate-content` | pass | 0 | same CRC32 and byte length candidates |
| `operational-audit-deterministic` | pass | 0 | 3b67ac9f3f80a86d2e451e59693216caec6d4e0c1722d3280504f4cf652cfeec / 3b67ac9f3f80a86d2e451e59693216caec6d4e0c1722d3280504f4cf652cfeec |
| `source-mutation` | pass | 0 | derive operational metadata must not mutate source rows |
| `empty-body` | fail | 818 | local ingest-equivalent rows with empty body |
| `duplicate-summary` | fail | 822 | 11 normalized-summary groups; 818 fallback rows; not an identical full-content count |
| `missing-source-url` | fail | 1,040 | item URL column is schema-absent; rows lack official URL provenance in payload aliases |
| `missing-official-file-id` | fail | 1,040 | rows without official file provenance |
| `missing-official-published-at` | fail | 1,040 | rows without official publication date |
| `missing-official-status` | fail | 1,040 | rows without current or retired state |
| `raw-tag-control-alias` | pass | 0 | raw risk tag emitted as a standalone control |
| `raw-control-initial-heuristic` | boundary | 73 | pre-calibration candidate rows; not a launch blocker count |
| `raw-control-alias-false-positive` | pass | 73 | 74 initial flags removed by legitimate aliases |
| `raw-control-contamination` | pass | 0 | calibrated raw-control cross-domain candidates |
| `operational-control-initial-heuristic` | boundary | 71 | pre-calibration candidate rows; not a launch blocker count |
| `operational-control-alias-false-positive` | pass | 70 | 71 initial flags removed by legitimate aliases |
| `operational-control-contamination` | fail | 1 | calibrated cross-domain candidates remain after operational derivation |
| `official-current-stable-key-parity` | pass | 0 | 1039/1039 current stable keys found locally |
| `official-version-mismatch` | fail | 7 | stable key matched but canonical version code differed |
| `retired-local-row` | fail | 1 | local rows absent from current and present in retired list |
| `official-url-representative` | pass | 0 | 5/5 representative PDF HEAD probes passed |
| `retrieval-document-reflection` | pass | 0 | KOSHA title, controls, and document labels surfaced |
| `supabase-visible-parity` | pass | 0 | production status and direct full-row snapshot matched |
| `local-live-canonical-parity` | pass | 0 | 8f068e0be64e8b16145da7dc5a25450c81f13944773cb5873f3df6a504df93e0 / 8f068e0be64e8b16145da7dc5a25450c81f13944773cb5873f3df6a504df93e0 |
| `current-live-full-row-hash` | pass | 0 | 8f068e0be64e8b16145da7dc5a25450c81f13944773cb5873f3df6a504df93e0 |
| `production-ranked-branch` | boundary | 1 | observed modes: rest-ilike |
| `production-hybrid-branch` | boundary | 1 | observed vector states: disabled |

## 접근 경계

- Current live full-row Supabase snapshot was available.
- Production status remained visible through https://safeguard-contest-mvp.vercel.app/api/safety-reference/status.
- Production retrieval modes observed: rest-ilike; vector states: disabled.
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
