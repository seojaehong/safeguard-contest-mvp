# 12-document authoring geometry

## Verdict

`PASS_LIVE_PRODUCTION_12_DOCUMENT_AUTHORING_GEOMETRY`

The bounded authoring wave removes the duplicated foreign-worker briefing cockpit, contains every non-risk document cockpit inside a local scroll region, and preserves a 32px minimum margin below the first document action. The current product commit is `f426ab4fc269e6fa23e3ca35a5e759a45f693527`.

## Before and after

| Evidence | Source | Pass | Fail | Verdict |
| --- | --- | ---: | ---: | --- |
| Before live | `e4de2f86` | 4 | 44 | `RED_LIVE_PRODUCTION_12_DOCUMENT_AUTHORING_GEOMETRY` |
| After local | `4e75b69d` | 48 | 0 | `PASS_CURRENT_SOURCE_LOCAL_12_DOCUMENT_AUTHORING_GEOMETRY` |
| After live | `f426ab4f` | 48 | 0 | `PASS_LIVE_PRODUCTION_12_DOCUMENT_AUTHORING_GEOMETRY` |

The 48 rows cover 12 canonical documents across Day/Night and 1440x723/390x723 viewports. Current live evidence keeps the maximum shell ratio at 2.36 and the minimum first-action-to-pane-bottom margin at 32px. Desktop cockpits are capped at 260px, while mobile authoring remains contained inside the selected editor shell.

## Contract

- Exactly one selected document editor is visible.
- Risk assessment uses its structured row editor; every other document exposes exactly one role-specific cockpit.
- The cockpit owns long-form scrolling instead of extending the page body.
- The first document action remains inside the 723px viewport.
- The first document action remains at least 32px above the editor pane bottom.
- Raw/source editors remain hidden until explicitly opened.
- Shell ratio stays at or below 3.0 with no horizontal overflow.

## Verification

- `tests/documents-editor-layout.test.ts`: 38/38 PASS.
- Strict typecheck: PASS.
- Next.js 15.5.22 production build: PASS, 28/28 static pages.

## Boundary

The live source and production marker both resolve to `f426ab4fc269e6fa23e3ca35a5e759a45f693527`. No DB mutation, provider dispatch, or Share session creation occurred. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; this wave does not close human wording review or approval-gated DB, provider, vector, wiki, and KOSHA registry work.
