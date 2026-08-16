# Document Editorial Review Cockpit Evidence

- Verdict: `PASS_LIVE_PRODUCTION_DOCUMENT_EDITORIAL_REVIEW_COCKPIT`
- Source: `50f62c7884ade697ee1e6375bdde8497b12d4d7c`
- Production: `50f62c7884ade697ee1e6375bdde8497b12d4d7c`
- Scope: 12-document human review cockpit geometry, keyboard access, browser-local state, and source/live isolation
- Verification: Documents browser 40/40, focused review flow 1/1, strict typecheck PASS, Next 15.5.22 build PASS (28 static pages)
- Human boundary: this automated probe does not complete human wording review or create approval evidence.
- Mutation boundary: no DB/provider/Share/vector/wiki/KOSHA registry mutation; exact saved Share remains `MISSING_EVIDENCE`.

| Theme | Viewport | Body/Viewport | Zones | Documents | Checks | Arrow navigation | Escape focus restore | Current workpack unchanged | API calls | Verdict |
|---|---|---:|---:|---:|---:|---|---|---|---:|---|
| day | desktop-short-1440x723 | 723/723 | 3 | 12 | 5 | yes | yes | yes | 0 | PASS |
| night | desktop-short-1440x723 | 723/723 | 3 | 12 | 5 | yes | yes | yes | 0 | PASS |
| day | mobile-short-390x723 | 723/723 | 1 | 12 | 5 | yes | yes | yes | 0 | PASS |
| night | mobile-short-390x723 | 723/723 | 1 | 12 | 5 | yes | yes | yes | 0 | PASS |

The default Documents page remains viewport-contained. Long document text and the checklist are exposed only inside the modal workbench's local scroll regions. The dialog uses a roving tab contract, a labelled tabpanel, and deterministic focus entry and restoration.
