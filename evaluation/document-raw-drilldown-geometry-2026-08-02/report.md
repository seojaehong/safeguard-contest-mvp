# Document Raw Drilldown Geometry

Verdict: `PASS_CURRENT_SOURCE_LOCAL_12_DOCUMENT_RAW_DRILLDOWN_GEOMETRY_LIVE_PENDING`

Product commit: `419f9e7bb2ceac8ec20af591f0526d78c661e866`

## Result

The explicit `원문` drilldown was measured for all 12 canonical documents in Day and Night themes at desktop-short `1440x723` and mobile-short `390x723`.

| Stage | Pass | Fail | Max shell ratio | Max source bottom | Source height | Scroll ownership |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Live before (`1d01810b`) | 0/48 | 48 | 2.83 | 1096px | 460px | 0 auto / 48 hidden |
| Current-source local after (`419f9e7b`) | 48/48 | 0 | 2.25 | 721px | 258px | 48 auto / 0 hidden |

The source editor is now the first task in source mode, remains selected-only, owns long-form scrolling locally, and stays inside the short viewport. Structured editing remains the default when a different document is selected.

## Verification

- `tests/documents-editor-layout.test.ts`: 1 file / 36 tests PASS
- `npm.cmd run typecheck`: PASS
- `npm.cmd run build`: PASS, Next.js 15.5.22, 28/28 static pages
- `git diff --check`: PASS

## Boundaries

- Live after-deployment evidence is still pending.
- No database, provider, Share-session, embedding, vector, wiki, or KOSHA registry mutation was performed.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
- Route splitting alone is not accepted as the UX fix; the contract is a viewport-first cockpit with bounded internal drilldowns.
- This geometry gate does not replace broad human wording review.
