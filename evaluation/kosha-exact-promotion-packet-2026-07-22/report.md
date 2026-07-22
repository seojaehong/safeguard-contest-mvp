# KOSHA Exact Promotion Packet

Generated at: 2026-07-22T00:52:32.635Z

Verdict: `EXACT_PROMOTION_PACKET_READY_FOR_OPERATOR_REVIEW`

Source HEAD: `af31eea941856d70a5414a6cee753bebc1d9dfa6`

Live commit at packet generation: `262c77c71426487d471fc862a0c34858131fa895`

Scope: read-only bounded selection packet for future KOSHA exact-trust promotion review

Mutation performed: `false`

Exact promotion performed: `false`

Review checklist complete: `false`

## Selection Policy

- Source pool: `metadata-verified current native technical-support regulations`
- Selected stable keys: `D-C-10, D-C-11, A-G-1, A-G-15, B-E-11, B-E-9, D-C-4, E-G-4`
- Accepted structure: operator review packet only; no exact trust registry mutation
- Verified subset: 234 items / 7127 chunks / 0 failures

## Candidate Packet

| # | Stable key | Version | Title | Official file id | Body hash | PDF hash | Why this candidate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | D-C-10 | D-C-10-2026 | D-C-10-2026 건설장비(이동식크레인, 항타기 및 항발기, 타워크레인) 작업계획서 작성에 관한 기술지원규정 | CTC2026012914313984348485 | 1068fed72e7b | 085961d6b296 | construction equipment work-plan coverage for mobile crane, pile driver, and tower-crane scenarios |
| 2 | D-C-11 | D-C-11-2026 | D-C-11-2026 굴착 및 토공 안전작업에 관한 기술지원규정 | CTC2026012914341697414755 | b97b0cf1ac5e | 266aca072d42 | excavation and earthwork coverage for common civil/construction hazard inputs |
| 3 | A-G-1 | A-G-1-2025 | A-G-1-2025 추락방호망 설치 기술지원규정(수직형 추락방망 설치) | FL00021379766 | 55fa0e40cfd6 | adac02929d30 | fall-prevention net coverage that complements the current scaffold and exterior-paint exact pins |
| 4 | A-G-15 | A-G-15-2026 | A-G-15-2026 중소규모 사업장 비상조치계획 작성에 관한 기술지원규정 | CTC2026012909391077692640 | 53b410850420 | 71715efb34bf | emergency action planning coverage for first-screen stop/report/preserve document flows |
| 5 | B-E-11 | B-E-11-2026 | B-E-11-2026 충전전로 및 그 인근에서의 전기작업에 관한 기술지원규정 | CTC2026012913300640598489 | 96632acae68d | 4dbdee537bee | live electrical work coverage paired with the existing de-energized electrical exact pin |
| 6 | B-E-9 | B-E-9-2026 | B-E-9-2026 접지설비에 관한 기술지원규정 | CTC2026012913250472771281 | df5f9bc7ba40 | 5a1960844900 | grounding equipment coverage paired with electrical isolation and live-part controls |
| 7 | D-C-4 | D-C-4-2025 | D-C-4-2025 굴착기 안전보건작업 기술지원규정 | FL00021380674 | 60527e44d909 | b032b3347a6f | excavator task coverage for construction-equipment and work-plan hazard rows |
| 8 | E-G-4 | E-G-4-2025 | E-G-4-2025 근골격계질환 예방을 위한 업종직종별 기술지원규정 | FL00021380215 | 2b0478ccea84 | 63b2ec5e7c01 | musculoskeletal prevention coverage for manual handling and repetitive work evidence |

## Per-Candidate Review Checks

- official URL opens the expected KOSHA file for the selected stable key
- official file id, version, and publication date match metadata and body-corpus provenance
- body SHA-256 and PDF SHA-256 are rechecked against immutable acquisition evidence
- operator confirms lifecycle/current status and excludes stale superseded versions
- human confirmation is recorded before any exact-kosha registry JSON is created

## Review Required Before Promotion

- Review each official URL, file ID, version, publication date, body hash, and PDF hash against immutable acquisition evidence.
- Create exact-kosha JSON pins only after human review confirms the official body/PDF pair.
- Add fail-closed tests for stale version, hash mismatch, missing lifecycle, missing human confirmation, and metadata contradiction.
- Run exact-trusted grounding, KOSHA current live gate, North Star open-gate audit, and launch-readiness boundary tests after promotion.
- Keep SIF/KOSHA vector upload and provider dispatch separate approval-gated boundaries.

## Forbidden Claims

- These candidates are already exact production evidence.
- The exact-kosha registry was expanded by this packet.
- All KOSHA Guide rows are exact direct evidence.
- KOSHA vector retrieval or embeddings are production-active because of this packet.
