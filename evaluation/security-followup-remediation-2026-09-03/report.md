# Security follow-up remediation

- Source: `27c3d37008a75caafb1c5a1edc228b2bb10b6738`
- Scan: `cfc74160-9955-478f-a437-6fa389dbf3c2`
- Verdict: `PARTIAL_SECURITY_REMEDIATION_XLSX_HARD_ISOLATION_AND_DB_APPROVAL_REMAIN`

## Completed

- Legacy HTML-as-XLS cells are forced to text format.
- CLI bearer-token requests require HTTPS, except explicitly enabled loopback HTTP, and redirects fail closed.
- Ask ontology QA propagates request cancellation through review and rereview.
- Download ZIP and ingestion ZIP/HWPX/PPTX paths preflight central-directory member size, compression ratio, and aggregate expansion on the same file handle.
- The transitive `qs` dependency is updated from 6.15.3 to 6.16.0; `npm audit` reports zero vulnerabilities.

## Remaining

- Both XLSX paths now perform same-handle archive admission, but OpenPyXL initialization still needs a resource-limited subprocess for a hard timeout and memory cap.
- Worker cross-site upsert and MCP token quota races require transactional database changes and remain approval-gated.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.

## Verification

- Focused TypeScript: 3 files / 42 tests PASS.
- Adjacent cancellation: 5 files / 49 tests PASS.
- Python archive safety: 6 tests PASS.
- Python operator parser budgets: 13 tests PASS.
- Python compile, strict typecheck, production build (29 static pages), diff check, and targeted secret scan PASS.
- No DB, provider, share-session, embedding/vector, wiki, or KOSHA registry mutation was performed.
