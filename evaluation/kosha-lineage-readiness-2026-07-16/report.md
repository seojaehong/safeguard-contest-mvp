# KOSHA corpus lineage readiness

## Verdict

Production-wide KOSHA trust expansion is not ready. The repository proves three different populations that must not be presented as one completed corpus.

- Historical technical corpus: 1,040 PDFs (`803` technical guidelines and `237` technical-support regulations).
- Promotion candidates: 234 current, native-body technical-support regulations selected by the verified-subset filter.
- Production trust registry: 1 exact pinned item (`D-C-13-2026`).

The single production pin does not mean only one official KOSHA document exists. It means the verified promotion result has not yet been connected to a deployable, fail-closed production registry.

## Reproducibility boundary

Tracked manifests preserve final snapshot identities, hashes, replacement URLs, and the 22 official PDF replacement hashes. They can validate a supplied final snapshot, but the repository cannot recreate the final 234-item body corpus byte-for-byte by itself because the following inputs are absent:

- final 234-row official metadata output;
- final item and chunk JSONL bodies;
- source and repacked ZIP archives;
- 22 replacement PDF blobs;
- a pinned Python extraction dependency manifest for the recorded extraction run.

The read-only Supabase catalog is a secondary comparison surface, not an independent official oracle: historical rows include missing bodies and do not provide the complete official file identity required by the production trust contract.

## Fail-closed next gate

1. Require an externally supplied final snapshot to match the tracked snapshot and metadata SHA-256 values before processing.
2. Build a compact 234-item ledger containing stable identity, version, official URL, PDF hash, and normalized body hash.
3. Keep network rehydration opt-in, GET-only, KOSHA-host allowlisted, timed out, and retried once.
4. Pin the extraction dependency and compare official PDF hash, normalized body hash, and read-only DB body independently.
5. Classify unavailable DB bodies as `unverifiable`; do not promote them.
6. Trace only the compact ledger and separately approved normalized bodies into Vercel. Do not bundle the full PDF corpus.
7. Expand the production registry only after per-item review receipts; no DB migration or data mutation is part of this gate.

## Claims prohibited until the gate passes

- all 234 candidates are human-reviewed or production-trusted;
- tracked Git files can recreate the final 234 bodies;
- the configured Supabase project is proven to be the deployed production project;
- the current official files still match the 2026-07-15 snapshot;
- the full 234/1,040 corpus is included in the deployed function bundle.

## Evidence roots

- `data/safety-knowledge/kosha-guide-audit-manifest.json`
- `scripts/build_kosha_verified_subset.py`
- `scripts/promote_kosha_official_metadata.py`
- `lib/production-kosha-trust.ts`
- `data/safety-knowledge/exact-kosha/d-c-13-2026.json`
- `evaluation/kosha-official-body-recovery-2026-07-15/verification.json`

