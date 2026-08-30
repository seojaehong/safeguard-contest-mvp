# Current-source security resource budget remediation

Verdict: `PASS_CURRENT_SOURCE_APPROVAL_FREE_SECURITY_RESOURCE_BUDGETS_LIVE_PENDING`

Product commit: `7addc82eda83ec3668a055d0f6dc2cbc26c5d47c`

Production marker at verification: `fc438249d75da3b2079c3329eeefab9f4eb7ac02`

## Scope

This wave closes the five approval-free resource-budget findings from the fixed-revision security evidence at `fc438249`: operator parsers, learning export collections, read-scoped MCP provider work, public ontology graph work, and final MCP result size.

The immutable original 18-finding baseline is preserved. The source scan's canonical files exist and were sealed, but its durable workbench completion status is `failed`; this report therefore uses those findings as remediation input and does not present that scan as a successful rescan closure.

## Implemented controls

- Operator parsers reject oversized input before hashing or parser allocation and enforce time, text, worksheet, row, and cell budgets.
- Learning exports use deterministic limited queries, overflow detection, and a 1 MiB final UTF-8 ceiling.
- MCP harness, weather, and accident reads share weighted provider admission with generation. Redis TTL cannot be shortened by a shorter read lease, and cancellation reaches HTTP and Hermes provider calls.
- The public ontology graph uses admitted deadlines, exact-count 1,000-row pagination, row/body/output ceilings, and fail-closed range validation.
- Every MCP `CallToolResult` is bounded to 256 KiB after serialization.

## Verification

- Python: 159/159 tests passed.
- TypeScript resource regressions: 14 files, 174/174 tests passed.
- Documents and Share UI regressions: 3 files, 60/60 tests passed.
- Strict typecheck: PASS.
- Next.js 15.5.22 production build: PASS, 28/28 static pages.
- `git diff --check`: PASS.
- Staged secret-pattern scan: 0 matches.

## Boundaries

No database, provider dispatch, Share-session, vector/embedding, wiki, or KOSHA exact-registry mutation was performed. The remaining RLS, workflow-write, and atomic MCP-token quota findings require their separate approval path. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.

This is current-source proof only. Live verification must wait until production reaches the product commit.
