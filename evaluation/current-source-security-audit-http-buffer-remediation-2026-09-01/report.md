# Current-source integrity audit HTTP budget remediation

## Verdict

`PASS_CURRENT_SOURCE_INTEGRITY_AUDIT_HTTP_BUDGET_LIVE_PENDING_RESCAN_REQUIRED`

Product commit `aae3f467` routes all three direct parent `/api/ask` calls in `final_output_integrity_audit.mjs` through the existing operator smoke HTTP budget. Each request now has a 30-second deadline and an 8 MiB response ceiling enforced both from declared `Content-Length` and from actual streamed bytes. Over-budget streams are canceled, upstream aborts propagate, and the deadline remains active until the response body is consumed.

The response is decoded with `TextDecoder`, preserving the prior `Response.text()` handling of UTF-8 BOM-prefixed JSON. Existing HTTP-status, empty-body, parse-failure, preview, and fail-fast behavior remains unchanged.

## Verification

| Check | Result |
| --- | --- |
| Operator HTTP budget and adjacent parser safety | 2 files, 10 tests PASS |
| Header-declared oversized body | fail closed |
| Undeclared oversized stream | fail closed |
| Request stalled before headers | timeout fail closed |
| Response body stalled after headers | timeout fail closed |
| Integration wiring and raw `fetch()` absence | PASS |
| Node syntax check | PASS |
| Strict TypeScript check | PASS |
| Next production build | PASS, 29/29 static pages |

The independent reviewer reported three gaps in the first patch: missing undeclared-stream and body-stall coverage, an import-only wiring assertion, and a UTF-8 BOM compatibility regression. All three were corrected before the product commit.

## Boundaries

- This is current-source evidence. Live deployment and a fresh full security rescan remain required.
- Neither the sealed 16-finding scan nor the immutable original 18-finding baseline is rewritten or reclassified by this receipt.
- The provider-backed output integrity audit was not executed; the source-level resource invariant and helper behavior were verified without provider work.
- No database, provider dispatch, Share-session, embedding/vector, Wiki, or KOSHA registry mutation occurred.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`, and approval-gated findings remain open.
