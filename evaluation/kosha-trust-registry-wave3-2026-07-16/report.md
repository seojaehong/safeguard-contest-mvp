# KOSHA exact registry wave 3 evaluation

- Base: `530efbfafb30c6145c1536172b260ff644845846`
- Target: `B-E-10-2026 정전전로 및 그 인근에서의 전기작업에 관한 기술지원규정`
- Registry: 2 exact items -> 3 exact items
- Acquisition: verified local corpus and receipt assets only; no network fetch
- Mutations: no DB, schema, or production data mutation

## Immutable pins

- Body characters: `15,049`
- Exact body SHA-256: `6fe137a8f788914b0f9804fbd81e8f9fa987dd108ce6edb2fd47eda9bee9b121`
- Corpus whitespace-normalized body SHA-256: `36d16c70c54669d0a8b57d346d7b2f85ab0c491ff8fc1202e4c717f868042e4d`
- PDF SHA-256: `0a44548411eb5402761934de46fd70393064dca22c56b7b8a27967c3cab4eb23`
- Provenance SHA-256: `976068bc0f060e177be0392323a2853cd43f145c6d294e7759bcb6374f411282`
- Official file: `CTC2026012913263450093332`
- Published: `2026-01-30`

## Gates

- Focused Vitest: 6 files, 134 tests passed
- Strict TypeScript: passed
- Production build: passed, 28 static pages
- NFT: 78 manifests, 16 complete consumers, 0 partial consumers
- Diff check: passed
- Applicability: outage, LOTO, voltage-absence verification, and electrical work only
- Commercial and announcement queries: blocked
- Controls: 3 controls and 3 anchors are exact substrings of the pinned body
- Prompt grounding: query-relevant body anchors replace blind first-window grounding when anchors exist
