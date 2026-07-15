# KOSHA local full-body corpus recovery

- status: **DONE_WITH_CONCERNS**
- launch-ready: **false**
- elapsed_seconds: 1493.727
- source PDF inventory / completed: 1040 / 1040
- native body success: 1039
- body missing boundary / hard failure: 1 / 0
- OCR candidate items / pages: 130 / 840
- chunks: 20520
- raw / normalized-text duplicate rows: 0 / 1
- reproducibility hash: `14ba2304ad721f420e33b785835378f270164befe71e9de4032a8c43eb35737d`
- manifest SHA256 / bytes: `fc5fd713eab0875c08e7da380ac3a3e041e049075718ed982868b6a281633845` / 4252
- manifest-declared output hashes: matched
- local output: `C:\Users\iceam\dev\safeclaw-local-artifacts\kosha-corpus-body-recovery-2026-07-11\corpus`

## Boundaries

- Local ZIP/PDF bytes were read only. No DB write, migration, upload, network request, OCR, embedding, or external API call was performed.
- Launch readiness remains false: body_missing=1; item download URLs were absent from the offline audit artifact.
- OCR candidates are boundaries only. No OCR result is represented as recovered text.

## Artifact sizes

- `manifest.json`: 4252 bytes
- `items.jsonl`: 37724736 bytes
- `chunks.jsonl`: 41665957 bytes
- `failures.jsonl`: 581 bytes
- `checkpoint.json`: 138612 bytes
