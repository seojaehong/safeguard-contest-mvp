# KOSHA local full-body corpus recovery

- status: **DONE_WITH_CONCERNS**
- launch-ready: **false**
- elapsed_seconds: 8.701
- source PDF inventory / completed: 1040 / 1040
- native body success: 1038
- body missing boundary / hard failure: 1 / 1
- OCR candidate items / pages: 131 / 840
- chunks: 20504
- raw / normalized-text duplicate rows: 0 / 1
- reproducibility hash: `0b636415dc0ca9300a353d298cb807a498abab0242c51ef63cb1465671a9ef0a`
- manifest SHA256 / bytes: `64115952e63fdad2ea13e94ccb725770b260ce6654abf8156fbcb37ea3206d04` / 4989
- manifest-declared output hashes: matched
- local snapshot: `C:\Users\iceam\dev\safeclaw-local-artifacts\kosha-corpus-body-recovery-2026-07-12-v2\snapshots\0b636415dc0ca9300a353d298cb807a498abab0242c51ef63cb1465671a9ef0a`

## Boundaries

- Local ZIP/PDF bytes were read only. No DB write, migration, upload, network request, OCR, embedding, or external API call was performed.
- Launch readiness remains false: body_missing=2; item download URLs were absent from the offline audit artifact.
- OCR candidates are boundaries only. No OCR result is represented as recovered text.

## Artifact sizes

- `manifest.json`: 4989 bytes
- `items.jsonl`: 37726976 bytes
- `chunks.jsonl`: 41630953 bytes
- `failures.jsonl`: 1114 bytes
- `checkpoint.json`: 141936 bytes
