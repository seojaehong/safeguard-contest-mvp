# 12-document authoring geometry

## Verdict

`PASS_LIVE_PRODUCTION_12_DOCUMENT_AUTHORING_GEOMETRY`

The bounded authoring wave removes the duplicated foreign-worker briefing cockpit and contains every non-risk document cockpit inside a local scroll region. The product commit is `4e75b69d509cda6206aff69737d4dc0d6b0d167d`.

## Before and after

| Evidence | Source | Pass | Fail | Verdict |
| --- | --- | ---: | ---: | --- |
| Before live | `e4de2f86` | 4 | 44 | `RED_LIVE_PRODUCTION_12_DOCUMENT_AUTHORING_GEOMETRY` |
| After local | `4e75b69d` | 48 | 0 | `PASS_CURRENT_SOURCE_LOCAL_12_DOCUMENT_AUTHORING_GEOMETRY` |
| After live | `006090ff` | 48 | 0 | `PASS_LIVE_PRODUCTION_12_DOCUMENT_AUTHORING_GEOMETRY` |

The 48 rows cover 12 canonical documents across Day/Night and 1440x723/390x723 viewports. The after-local maximum shell ratio is 2.69, the lowest remaining first-action margin is 4px (`719/723`), and the body is at most 5px taller than the viewport. Desktop cockpits are capped at 260px; mobile cockpits are 88px, with the foreign-worker briefing compact cockpit at 76px.

## Contract

- Exactly one selected document editor is visible.
- Risk assessment uses its structured row editor; every other document exposes exactly one role-specific cockpit.
- The cockpit owns long-form scrolling instead of extending the page body.
- The first document action remains inside the 723px viewport.
- Raw/source editors remain hidden until explicitly opened.
- Shell ratio stays at or below 3.0 with no horizontal overflow.

## Verification

- `tests/documents-editor-layout.test.ts`: 35/35 PASS.
- Strict typecheck: PASS.
- Next.js 15.5.22 production build: PASS, 28/28 static pages.

## Boundary

The live source and production marker both resolve to `006090ff588e6423917ad8b0b8bf00db35e7414f`. No DB mutation, provider dispatch, or Share session creation occurred. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; this wave does not close human wording review or approval-gated DB, provider, vector, wiki, and KOSHA registry work.
