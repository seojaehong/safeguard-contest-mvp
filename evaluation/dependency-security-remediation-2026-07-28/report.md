# Dependency Security Remediation

Verdict: `PASS_LIVE_PRODUCTION_DEPENDENCY_AUDIT_ZERO_FULL_SECURITY_SCAN_OPEN`

Product commit: `99321fd8b4fc815915c694853db5565d2758e5e1`

Production marker: `99321fd8b4fc815915c694853db5565d2758e5e1`

## Result

The lockfile audit moved from 19 vulnerable packages (14 high, 5 moderate) to 0. The production-only audit also reports 0, and `npm audit fix --dry-run` proposes no changes.

- Next.js moved from 15.5.15 to 15.5.22. All 21 direct Next advisories disappeared.
- adm-zip moved from 0.5.18 to 0.6.0. `GHSA-xcpc-8h2w-3j85` disappeared.
- PostCSS is constrained to 8.5.23 with a same-major override. All three PostCSS advisories disappeared.
- `fast-uri` moved from 3.1.3 to 3.1.4 and its host-confusion advisory disappeared.
- `@hono/node-server` moved from 1.19.14 to 2.0.12. The MCP route contract suite and an actual unauthenticated route smoke verified the major override.
- Sharp moved from 0.34.5 to 0.35.3. A real Next image-optimizer conversion returned HTTP 200 `image/png`.
- UUID 8.3.2 and 9.0.1 transitives are constrained to 11.1.1. ExcelJS extended conditional-formatting serialization and gaxios multipart boundary generation both execute successfully against the CommonJS UUID path.
- ExcelJS remains at 4.4.0 while its archive writer is constrained from archiver 5.3.2 to 8.0.0.
- Unzipper is constrained from 0.10.14 to 0.12.1. This removes the deprecated fstream chain without introducing the static AWS SDK import present from unzipper 0.12.2 onward.
- MCP SDK remains at 1.26.0 because mcp-handler 1.1.0 requires that exact peer; only the verified transitive adapter is overridden.
- `npm audit fix --dry-run` proposed zero non-breaking changes.

## Residuals

The npm runtime dependency audit has no remaining findings. This is not a full repository security scan or a zero-risk product claim.

## Verification

- MCP, legal-source, and Hermes-adjacent contracts: 13 files, 170 passed, 0 failed.
- UUID runtime override contract: 1 file, 3 passed, 0 failed.
- Archive writer/reader and XLSX export contracts: 4 files, 23 passed, 0 failed.
- XLSX, export-integrity, localization, photo-vision, AI-provider, and public Ask adjacency: 7 files, 70 passed, 0 failed.
- Documents editor full run: 34 passed with one transient pre-existing mobile geometry assertion; the isolated assertion rerun passed. No dependency or UI source file was implicated.
- Northstar dependency contracts: 3 files, 52 passed, 0 failed.
- Strict TypeScript typecheck: `PASS`.
- Next.js 15.5.22 production build: `PASS`.
- Static pages: 28/28 generated.
- Local runtime compatibility: `/api/mcp/mcp` returned 401 `invalid_token`; Next image optimizer converted the generated PNG with HTTP 200 `image/png`.
- Live production checks: `/`, `/documents`, `/dispatch`, and `/.well-known/agent.json` returned HTTP 200; `/api/mcp/mcp` returned fail-closed HTTP 401 at marker `99321fd8`.
- Live `/api/export/xlsx` returned HTTP 200 with an 8,086-byte workbook. The current ExcelJS reader reopened one worksheet and recovered the sentinel value.
- The isolated Documents Next dev harness became unresponsive during the broad browser run. This is recorded as inconclusive infrastructure evidence, not hidden or used in place of the direct XLSX contracts.

## Boundary

Production and product source are aligned at `99321fd8`. The npm full and production-only dependency audits are both zero, but a full repository security scan was not performed by this dependency wave. No DB, Share, provider, embedding/vector, or KOSHA exact-registry mutation occurred. Provider persistence remains approval-gated and exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
