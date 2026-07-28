# Dependency Security Remediation

Verdict: `PASS_LIVE_PRODUCTION_BOUNDED_DEPENDENCY_REMEDIATION_RESIDUALS_OPEN`

Product commit: `73855ccca0b7bd62e9c913a6ece4d363e7db6143`

Production marker: `73855ccca0b7bd62e9c913a6ece4d363e7db6143`

## Result

The lockfile audit moved from 19 vulnerable packages (14 high, 5 moderate) to 11 (9 high, 2 moderate). The production-only audit reports the same counts, so these were not dev-only findings.

- Next.js moved from 15.5.15 to 15.5.22. All 21 direct Next advisories disappeared.
- adm-zip moved from 0.5.18 to 0.6.0. `GHSA-xcpc-8h2w-3j85` disappeared.
- PostCSS is constrained to 8.5.23 with a same-major override. All three PostCSS advisories disappeared.
- `fast-uri` moved from 3.1.3 to 3.1.4 and its host-confusion advisory disappeared.
- `@hono/node-server` moved from 1.19.14 to 2.0.12. The MCP route contract suite and an actual unauthenticated route smoke verified the major override.
- Sharp moved from 0.34.5 to 0.35.3. A real Next image-optimizer conversion returned HTTP 200 `image/png`.
- MCP SDK remains at 1.26.0 because mcp-handler 1.1.0 requires that exact peer; only the verified transitive adapter is overridden.
- `npm audit fix --dry-run` proposed zero non-breaking changes.

## Residuals

This is not a zero-vulnerability or full security-scan claim.

- ExcelJS 4.4.0 is the latest release but retains the archive/glob/UUID chain. npm's proposed 3.4.0 downgrade is not a safe remediation. Runtime SafeClaw code writes structured workbooks; reviewed runtime source does not read user-supplied XLSX.
- UUID remains through ExcelJS and the Google auth `gaxios` chain. The patched UUID major is outside their pinned ranges; no direct vulnerable v3/v5/v6 buffer API call was found in SafeClaw source.

## Verification

- MCP, legal-source, and Hermes-adjacent contracts: 13 files, 170 passed, 0 failed.
- Northstar dependency contracts: 2 files, 49 passed, 0 failed.
- Strict TypeScript typecheck: `PASS`.
- Next.js 15.5.22 production build: `PASS`.
- Static pages: 28/28 generated.
- Local runtime compatibility: `/api/mcp/mcp` returned 401 `invalid_token`; Next image optimizer converted the generated PNG with HTTP 200 `image/png`.
- Live production checks: `/`, `/documents`, `/dispatch`, and `/.well-known/agent.json` returned HTTP 200; `/api/mcp/mcp` returned fail-closed HTTP 401 at marker `73855ccc`.

## Boundary

Production and product source are aligned at `73855ccc`. A full repository security scan was not performed by this bounded dependency wave, and 11 vulnerable-package findings remain open. No DB, Share, provider, embedding/vector, or KOSHA exact-registry mutation occurred. Provider persistence remains approval-gated and exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
