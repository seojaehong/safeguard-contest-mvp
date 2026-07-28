# Dependency Security Remediation

Verdict: `PASS_CURRENT_SOURCE_BOUNDED_DEPENDENCY_REMEDIATION_RESIDUALS_OPEN_LIVE_PENDING`

Product commit: `3da8ac30e4798630f6c46a411c24494f81b45c54`

Production marker at evidence creation: `f13abd3c09e70c672d38e5b1229a3c6ddcb30c5a`

## Result

The lockfile audit moved from 19 vulnerable packages (14 high, 5 moderate) to 17 (12 high, 5 moderate). The production-only audit reports the same counts, so these were not dev-only findings.

- Next.js moved from 15.5.15 to 15.5.22. All 21 direct Next advisories disappeared.
- adm-zip moved from 0.5.18 to 0.6.0. `GHSA-xcpc-8h2w-3j85` disappeared.
- PostCSS is constrained to 8.5.23 with a same-major override. All three PostCSS advisories disappeared.
- MCP SDK remains at 1.26.0 because mcp-handler 1.1.0 requires that exact peer. The attempted independent SDK update was reverted after it produced an invalid dependency graph.
- `npm audit fix --dry-run` proposed zero non-breaking changes.

## Residuals

This is not a zero-vulnerability or full security-scan claim.

- ExcelJS 4.4.0 is the latest release but retains the archive/glob/UUID chain. npm's proposed 3.4.0 downgrade is not a safe remediation. Runtime SafeClaw code writes structured workbooks; reviewed runtime source does not read user-supplied XLSX.
- Sharp 0.35.3 is patched but falls outside Next 15.5.22's declared `^0.34.3` range. No `next/image` import was found, but the optimizer surface was not proven globally unreachable.
- The Hono static path traversal is behind an MCP SDK dependency. Reviewed product source does not call `serveStatic`, but upgrading to Hono 2 requires crossing the mcp-handler peer boundary.
- fast-uri and UUID fixes require upstream major-range changes. No direct vulnerable API calls were found, but indirect reachability remains open.

## Verification

- MCP and export contracts: 10 files, 133 passed, 0 failed.
- Frontend route coverage: 1 file, 39 passed, 0 failed.
- Frontend consistency: 33 page files, 23 component files, 23,952 CSS lines, 0 coverage issues, 0 violations.
- Strict TypeScript typecheck: `PASS`.
- Next.js 15.5.22 production build: `PASS`.
- Static pages: 28/28 generated.

## Boundary

Live-after deployment verification is pending. A full repository security scan was not performed by this bounded dependency wave. No DB, Share, provider, embedding/vector, or KOSHA exact-registry mutation occurred. Provider persistence remains approval-gated and exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
