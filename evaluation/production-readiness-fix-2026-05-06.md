# SafeClaw production-readiness patch

Date: 2026-05-06

## Scope

This patch closes the production-readiness findings raised in the site audit:

- History links should not reset users into unstable anchors.
- Public operations pages should not expose internal endpoints, filesystem paths, or catalog implementation details.
- Knowledge snippets should be readable even when source documents are stored as long unwrapped text.
- The home dashboard should show current workpack state instead of placeholder cards.
- Safety document previews should remain usable in narrower desktop viewports.

## Changes

| Area | Result |
| --- | --- |
| Archive | Replaced `/workspace#history` fallback links with stable `/workspace` and `/documents` flows. Server workpacks still open through `/documents?workpackId=...` when available. |
| Knowledge DB | Removed user-facing internal paths/endpoints and normalized long KOSHA summaries into shorter readable snippets. |
| API Operations | Replaced raw endpoint links with product-level status copy and knowledge DB navigation. |
| Home Dashboard | Reads the current browser workpack and shows last saved time, document count, worker/dispatch snapshot, risk, weather, and next actions. |
| Document Preview | Added horizontal containment for safety-form previews so tables scroll inside the card instead of clipping the page. |

## Remaining notices

- Full server-side history browsing still depends on a valid Supabase session.
- Internal API endpoints remain available to the application, but are no longer advertised on public product pages.
- HWPX/PDF format quality is not changed by this patch.
