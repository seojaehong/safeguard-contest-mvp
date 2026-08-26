# Document Editorial Review Cockpit Evidence

- Verdict: `PASS_LIVE_PRODUCTION_DOCUMENT_EDITORIAL_REVIEW_COCKPIT`
- Source: `1e7ae8249b67e833d8cc035d3339bb3ff4b417bb`
- Production: `1e7ae8249b67e833d8cc035d3339bb3ff4b417bb`
- Scope: 12-document human review cockpit geometry, keyboard access, browser-local state, and source/live isolation
- Verification: Documents browser 43/43, Korean copy 8/8, focused storage flows 2/2, Northstar 157/157, strict typecheck PASS, Next 15.5.22 build PASS (28 static pages)
- Storage lifecycle: four viewport rows prove `empty -> saved -> restored`; reviewer hydration preserves the stored self-attested name.
- Storage failure probe: `PASS`, visible=`true`, status=`error`.
- Human boundary: this automated probe does not complete human wording review or create approval evidence.
- Mutation boundary: no DB/provider/Share/vector/wiki/KOSHA registry mutation; exact saved Share remains `MISSING_EVIDENCE`.

| Theme | Viewport | Body/Viewport | Zones | Documents | Checks | Storage lifecycle | Arrow navigation | Escape focus restore | Current workpack unchanged | API calls | Verdict |
|---|---|---:|---:|---:|---:|---|---|---|---|---:|---|
| day | desktop-short-1440x723 | 723/723 | 3 | 12 | 5 | empty->saved->restored | yes | yes | yes | 0 | PASS |
| night | desktop-short-1440x723 | 723/723 | 3 | 12 | 5 | empty->saved->restored | yes | yes | yes | 0 | PASS |
| day | mobile-short-390x723 | 723/723 | 1 | 12 | 5 | empty->saved->restored | yes | yes | yes | 0 | PASS |
| night | mobile-short-390x723 | 723/723 | 1 | 12 | 5 | empty->saved->restored | yes | yes | yes | 0 | PASS |

The default Documents page remains viewport-contained. Long document text and the checklist are exposed only inside the modal workbench's local scroll regions. The dialog uses a roving tab contract, a labelled tabpanel, deterministic focus entry and restoration, and a fail-visible browser-storage boundary.
