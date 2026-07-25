# KOSHA Exact Official PDF Audit

- Verdict: `PASS_OFFICIAL_PDF_AUTHENTICITY_BODY_PAIR_REVIEW_STILL_REQUIRED`
- Source HEAD: `47aa94a969beebbf71d938e82133165b1f13682b`
- Candidates: `8`
- Machine verified: `8`
- Failed: `0`
- Temporary PDFs retained: `0`
- Exact promotion performed: `false`

| Stable key | HTTP | Bytes | PDF SHA-256 | Body SHA-256 | Machine audit |
| --- | ---: | ---: | --- | --- | --- |
| D-C-10 | 200 | 2365433 | MATCH | MATCH | PASS |
| D-C-11 | 200 | 991466 | MATCH | MATCH | PASS |
| A-G-1 | 200 | 607811 | MATCH | MATCH | PASS |
| A-G-15 | 200 | 6228205 | MATCH | MATCH | PASS |
| B-E-11 | 200 | 588666 | MATCH | MATCH | PASS |
| B-E-9 | 200 | 967061 | MATCH | MATCH | PASS |
| D-C-4 | 200 | 1701260 | MATCH | MATCH | PASS |
| E-G-4 | 200 | 779364 | MATCH | MATCH | PASS |

## Review Boundary

This audit re-downloads each official KOSHA PDF, checks the official URL and response,
matches the packet PDF SHA-256, re-extracts the native body, and matches the packet body
SHA-256 plus the immutable metadata/body-corpus provenance.

It does **not** complete the operator lifecycle/current-status judgment, reviewer identity,
reviewedAt, humanConfirmed, or the separate exact-trust promotion approval. No DB, Share,
provider, embedding, vector, or exact-trust registry mutation is performed.
