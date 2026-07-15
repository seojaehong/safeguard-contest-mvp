# KOSHA local full-body corpus recovery

- status: **DONE_WITH_CONCERNS**
- launch-ready: **false**
- snapshot_elapsed_seconds: 1674.635
- elapsed_semantics: `snapshot_build_wall_time`
- source PDF inventory / completed: 1040 / 1040
- native body success: 1039
- body missing boundary / hard failure: 1 / 0
- OCR candidate items / pages: 128 / 798
- chunks: 20536
- raw / normalized-text duplicate rows: 0 / 1
- reproducibility hash: `935340ef3f74078c36168666650164c43511daced84efa3eda849833ad8d6844`
- manifest SHA256 / bytes: `ab77251d0c95ce81d86470f1dbe19cdc18778dc5f6b32cde1b2d4f77bc427ab8` / 5041
- manifest-declared output hashes: matched
- local snapshot: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\northstar-kosha-official-metadata-20260715\output\kobr26\corpus\snapshots\935340ef3f74078c36168666650164c43511daced84efa3eda849833ad8d6844`

## Boundaries

- Local ZIP/PDF bytes were read only. No DB write, migration, upload, network request, OCR, embedding, or external API call was performed.
- Launch readiness remains false: body_missing=1; item download URLs were absent from the offline audit artifact.
- OCR candidates are boundaries only. No OCR result is represented as recovered text.

## Artifact sizes

- `manifest.json`: 5041 bytes
- `items.jsonl`: 37821615 bytes
- `chunks.jsonl`: 41737946 bytes
- `failures.jsonl`: 581 bytes
- `checkpoint.json`: 141987 bytes
