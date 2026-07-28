# Dependency Security Remediation

Verdict: `PASS_LIVE_PRODUCTION_BOUNDED_DEPENDENCY_REMEDIATION_RESIDUALS_OPEN`

Product commit: `32431e341c0fe25340be3b5e143e12829b76ca3e`

Production marker: `32431e341c0fe25340be3b5e143e12829b76ca3e`

## Result

The lockfile audit moved from 19 vulnerable packages (14 high, 5 moderate) to 9 (9 high, 0 moderate). The production-only audit reports the same counts, so these were not dev-only findings.

- Next.js moved from 15.5.15 to 15.5.22. All 21 direct Next advisories disappeared.
- adm-zip moved from 0.5.18 to 0.6.0. `GHSA-xcpc-8h2w-3j85` disappeared.
- PostCSS is constrained to 8.5.23 with a same-major override. All three PostCSS advisories disappeared.
- `fast-uri` moved from 3.1.3 to 3.1.4 and its host-confusion advisory disappeared.
- `@hono/node-server` moved from 1.19.14 to 2.0.12. The MCP route contract suite and an actual unauthenticated route smoke verified the major override.
- Sharp moved from 0.34.5 to 0.35.3. A real Next image-optimizer conversion returned HTTP 200 `image/png`.
- UUID 8.3.2 and 9.0.1 transitives are constrained to 11.1.1. ExcelJS extended conditional-formatting serialization and gaxios multipart boundary generation both execute successfully against the CommonJS UUID path.
- MCP SDK remains at 1.26.0 because mcp-handler 1.1.0 requires that exact peer; only the verified transitive adapter is overridden.
- `npm audit fix --dry-run` proposed zero non-breaking changes.

## Residuals

This is not a zero-vulnerability or full security-scan claim.

- ExcelJS 4.4.0 is the latest release but retains the archive/glob chain. npm's proposed downgrade is not a safe remediation. Runtime SafeClaw code writes structured workbooks; reviewed runtime source does not read user-supplied XLSX.

## Verification

- MCP, legal-source, and Hermes-adjacent contracts: 13 files, 170 passed, 0 failed.
- UUID runtime override contract: 1 file, 3 passed, 0 failed.
- XLSX, export-integrity, localization, photo-vision, AI-provider, and public Ask adjacency: 7 files, 70 passed, 0 failed.
- Documents editor full run: 34 passed with one transient pre-existing mobile geometry assertion; the isolated assertion rerun passed. No dependency or UI source file was implicated.
- Northstar dependency contracts: 3 files, 52 passed, 0 failed.
- Strict TypeScript typecheck: `PASS`.
- Next.js 15.5.22 production build: `PASS`.
- Static pages: 28/28 generated.
- Local runtime compatibility: `/api/mcp/mcp` returned 401 `invalid_token`; Next image optimizer converted the generated PNG with HTTP 200 `image/png`.
- Live production checks: `/`, `/documents`, `/dispatch`, and `/.well-known/agent.json` returned HTTP 200; `/api/mcp/mcp` returned fail-closed HTTP 401 at marker `32431e34`.

## Boundary

Production and product source are aligned at `32431e34`. A full repository security scan was not performed by this bounded dependency wave, and 9 high-severity vulnerable-package findings in the ExcelJS archive chain remain open. No DB, Share, provider, embedding/vector, or KOSHA exact-registry mutation occurred. Provider persistence remains approval-gated and exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
