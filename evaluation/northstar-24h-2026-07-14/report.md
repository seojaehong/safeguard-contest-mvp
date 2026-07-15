# SafeClaw North Star 24h current-state gate

## Authority

- Integration branch: `feat/phase-a-evidence-integration`
- Verified product source: `087589fa75f072cf876fc431ef9f1d5a2bf3cdd9`
- Evidence head at gate start: `01ba1c924e5ab19803bdb86527fce9eccfc1ab60`
- Pull request: `#72`, Draft, base `feat/phase-a-release-integration-v2`
- Production: `https://www.safeclaw.kr`

## Live product facts

The values below were collected from production APIs on 2026-07-14. They are
not inferred from local fixtures.

| Surface | Current fact | Gate interpretation |
| --- | --- | --- |
| Safety reference catalog | 9,920 items across 1,063 sources | Connected |
| SIF cases | 6,033 source items | Connected |
| KOSHA technical corpus | 1,040 records: 803 guidelines and 237 support regulations | Connected; query relevance remediation still in review |
| Published ontology | 166 nodes and 169 edges | Connected |
| SIF embedding corpus | 6,032 usable records, 61 batches | Prepared only |
| SIF embeddings | 0 generated, 0 uploaded | Not executed |
| SIF vector DB gate | table and RPC absent | Explicit migration approval required |

## Product gate

### Completed and live

- The three-step workspace and simplified Share presentation are deployed.
- A generated workpack can inspect Share blockers without bypassing them.
- Actual dispatch remains disabled while quality or evidence readiness is not
  satisfied.
- Mobile Share at 391x844 has no horizontal overflow, interactive overlap, or
  visible control below 44px.
- Foreign-language preview no longer prepends Korean metadata labels.

### Frontend contract refresh

- Current static contract: 32 pages, 23 product components, 0 coverage issues,
  and 0 violations.
- The first 108-row browser rerun exposed one real Reports heading-tracking
  regression on all three viewports.
- The Reports route now restores the canonical page-title tracking token.
- Final browser rerun: 108/108 rows passed, 0 findings, 0 recovered rows.
- Audit production build: 27/27 pages and exactly one audit-only boundary
  marker.
- Normal production build: 27/27 pages and 0 audit boundary markers.
- Focused frontend-route and Knowledge layout rerun: 2 files, 41 tests passed.
- Audit bundle regression suite: 1 file, 5 tests passed.
- The full serial baseline completed 140 files. It passed 1,405 tests and
  reported the stale audit identity plus two accumulated browser timeouts;
  all three affected contracts passed in the focused rerun after evidence
  refresh.

### Active remediation

- KOSHA mixed-hazard parent selection and direct-evidence filtering must fail
  closed before the latest candidate can be integrated.
- Phase A ontology chains must prove SIF, KOSHA guidance, statutory mandate,
  and document-row materialization together.
- Document review and edit surfaces still need provenance compression and
  document-specific editing structure.
- Knowledge promotion must remain human reviewed; Hermes may propose but may
  not publish or mutate product facts.
- Hermes/OpenClaw must remain versioned `EngineAdapter` consumers of the
  SafeClaw MCP/DB Evidence Harness.

### Approval boundary

No database migration, embedding generation, or upload was performed. The SIF
vector path remains intentionally held until explicit approval for the
SIF-only migration.

## Evidence

- `live-safety-reference-status.json`
- `live-sif-gate-status.json`
- `live-ontology-graph.json`
- `full-test-option-error.log` records the unsupported Vitest option attempt.
- `full-test.log` records the supported serial baseline rerun.
- `frontend-static-audit-after-reports-fix.log`
- `frontend-audit-build-reports-fix.log`
- `frontend-audit-bundle-contract-reports-fix.log`
- `frontend-browser-audit-reports-fix.log`
- `focused-browser-contracts-after-audit.log`
- `frontend-normal-build-after-audit-fix.log`
- `frontend-normal-bundle-contract.log`
