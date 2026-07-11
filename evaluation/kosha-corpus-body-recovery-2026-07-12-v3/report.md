# KOSHA local full-body corpus recovery

- status: **DONE_WITH_CONCERNS**
- launch-ready: **false**
- snapshot_elapsed_seconds: 2629.494
- invocation_elapsed_seconds: 3.668
- elapsed_semantics: `preserved_snapshot_build_wall_time`
- source PDF inventory / completed: 1040 / 1040
- native body success: 1039
- body missing boundary / hard failure: 1 / 0
- OCR candidate items / pages: 130 / 840
- chunks: 20520
- raw / normalized-text duplicate rows: 0 / 1
- reproducibility hash: `bb8dd542a0d8dc1ac37e330944bc24fcbfef6eea72e4afb106f96a9c19e63d51`
- manifest SHA256 / bytes: `f90262fc98c190243d80124b5e8711866d3372b3affef7d294c881ed194806d2` / 4989
- manifest-declared output hashes: matched
- local snapshot: `C:\Users\iceam\dev\safeclaw-local-artifacts\kosha-corpus-body-recovery-2026-07-12-v3\snapshots\bb8dd542a0d8dc1ac37e330944bc24fcbfef6eea72e4afb106f96a9c19e63d51`

## Boundaries

- Local ZIP/PDF bytes were read only. No DB write, migration, upload, network request, OCR, embedding, or external API call was performed.
- Launch readiness remains false: body_missing=1; item download URLs were absent from the offline audit artifact.
- OCR candidates are boundaries only. No OCR result is represented as recovered text.

## Artifact sizes

- `manifest.json`: 4989 bytes
- `items.jsonl`: 37758053 bytes
- `chunks.jsonl`: 41665957 bytes
- `failures.jsonl`: 581 bytes
- `checkpoint.json`: 141935 bytes
