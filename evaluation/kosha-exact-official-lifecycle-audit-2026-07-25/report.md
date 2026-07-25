# KOSHA Exact Official Lifecycle Audit

- Verdict: `REVIEW_REQUIRED_OFFICIAL_CURRENT_LIFECYCLE_MACHINE_SUPPORTED_TITLE_VARIANTS_UNRESOLVED`
- Source HEAD: `654c24e7da59a6cacf56e31e373f64c1306384ca`
- Candidates: `8`
- Machine lifecycle supported: `8`
- Exact official title identity matches: `6`
- Title variants requiring human review: `2`
- Failed: `0`
- Exact promotion performed: `false`

| Stable key | Current version | Retired versions for stable key | Current file ID | Machine audit | Title finding |
| --- | --- | --- | --- | --- | --- |
| D-C-10 | D-C-10-2026 |  | CTC2026012914313984348485 | PASS |  |
| D-C-11 | D-C-11-2026 |  | CTC2026012914341697414755 | PASS |  |
| A-G-1 | A-G-1-2025 |  | FL00021379766 | PASS_WITH_TITLE_REVIEW | Packet: 추락방호망 설치 기술지원규정(수직형 추락방망 설치)<br>Official: 추락방호망 설치 기술지원규정(수직형 추락방망 설치 기술지원규정 포함) |
| A-G-15 | A-G-15-2026 |  | CTC2026012909391077692640 | PASS |  |
| B-E-11 | B-E-11-2026 |  | CTC2026012913300640598489 | PASS |  |
| B-E-9 | B-E-9-2026 |  | CTC2026012913250472771281 | PASS |  |
| D-C-4 | D-C-4-2025 |  | FL00021380674 | PASS |  |
| E-G-4 | E-G-4-2025 |  | FL00021380215 | PASS_WITH_TITLE_REVIEW | Packet: 근골격계질환 예방을 위한 업종직종별 기술지원규정<br>Official: 근골격계질환 예방을 위한 업종·직종별 기술지원규정 |

## Review Boundary

This audit queries the official KOSHA current and retired lists and reconciles the
bounded packet version, title, publication date, file ID, and download identity.
It records machine support for current/not-retired status only.

Operator lifecycle judgment, reviewer identity, reviewedAt, humanConfirmed, and
the separate exact-trust promotion approval remain incomplete. No DB, Share,
provider, embedding, vector, or exact-trust registry mutation is performed.
