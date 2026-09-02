# Security follow-up remediation

- Source: `10b73e39`
- Scan: `cfc74160-9955-478f-a437-6fa389dbf3c2`
- Verdict: `PASS_APPROVAL_FREE_SECURITY_REMEDIATION_DB_APPROVAL_GATES_REMAIN`

## Completed

- Legacy HTML-as-XLS cells are forced to text format.
- CLI bearer-token requests require HTTPS, except explicitly enabled loopback HTTP, and redirects fail closed.
- Ask ontology QA propagates request cancellation through review and rereview.
- Download ZIP and ingestion ZIP/HWPX/PPTX paths preflight central-directory member size, compression ratio, and aggregate expansion on the same file handle.
- Download and ingestion XLSX paths now pass the admitted same-handle snapshot to a disposable worker with digest binding, hard timeout, bounded output, and OS memory limits.
- The transitive `qs` dependency is updated from 6.15.3 to 6.16.0; `npm audit` reports zero vulnerabilities.
- The transitive `@xmldom/xmldom` dependency is updated from 0.9.10 to 0.9.12.

## Remaining

- Worker cross-site upsert and MCP token quota races require transactional database changes and remain approval-gated.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.

## Verification

- Focused TypeScript: 3 files / 42 tests PASS.
- Adjacent cancellation: 5 files / 49 tests PASS.
- Python archive safety: 6 tests PASS.
- Python operator parser budgets: 15 tests PASS.
- XLSX worker: 4 tests PASS; existing PDF worker regression: 19 tests PASS.
- Python compile, strict typecheck, production build (29 static pages), diff check, and targeted secret scan PASS.
- No DB, provider, share-session, embedding/vector, wiki, or KOSHA registry mutation was performed.
