# Current-source XLSX materialization remediation

## Verdict

`PASS_LIVE_DEPLOYED_XLSX_MATERIALIZATION_ISOLATED_RESCAN_REQUIRED`

Product commit `dbc65fb4` keeps the existing ZIP admission budgets, reads the admitted XLSX once, and passes that immutable byte snapshot to an isolated Worker. ExcelJS workbook materialization now runs under a 256 MiB old-generation heap limit, a 32 MiB young-generation limit, a 4 MiB stack limit, a 15-second external deadline, and a bounded result channel.

The parent no longer materializes the workbook. A compact worksheet containing a full-grid merge cannot block or exhaust the parent parser, and replacing the source path after admission cannot change the bytes parsed by the Worker. The Worker does not inherit parent Node execution arguments, preserving use from ordinary scripts, test runners, and stdin/eval module callers.

Production `/api/build-info` now reports product commit `dbc65fb49cef5f3d196a58ba01faac932683d599` on `master`, deployment `safeguard-contest-1dkgnhj2v-seojaehongs-projects.vercel.app`. Evidence commit `756e026f` is recorded separately and does not change runtime behavior.

## Verification

| Check | Result |
| --- | --- |
| Parser and shared resource-budget suite | 2 files, 19 tests PASS |
| Compact full-grid merge containment | PASS |
| External Worker deadline | PASS |
| Immutable admission snapshot under path replacement | PASS |
| Korean, merged, formula, rich-text, and multi-sheet compatibility | PASS |
| Node syntax | PASS |
| Strict TypeScript check | PASS |
| Next production build | PASS, 29/29 static pages |

Independent pre-patch investigation confirmed that ExcelJS could materialize a huge merge range before row and cell checks ran. The independent candidate review then found a validation-to-use race caused by reopening the file path. The final patch passes the already validated byte snapshot to the Worker, and the new replacement regression proves the race no longer changes the parsed input.

## Boundaries

- This is source/live-aligned product evidence. The parser trigger remains an isolated operator-script verification rather than a production HTTP exploit replay.
- A fresh full repository security scan remains required before reclassifying the sealed finding.
- Neither the sealed 16-finding scan nor the immutable original 18-finding baseline is rewritten or reclassified.
- The full output-integrity audit was not executed because it performs remote ask calls and generates a broader artifact set; isolated parser behavior was tested instead.
- Other XLSX entry points were not silently reclassified by this bounded finding fix and remain subject to the fresh scan.
- No database, provider dispatch, Share-session, embedding/vector, Wiki publication, or KOSHA registry mutation occurred.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`, and approval-gated findings remain open.
