# SafeClaw Backend Release Integration Final Gate

## Release Identity

- Source SHA: `514b2d9a3c884c1a18ecf725285dde0e8a95b6cd`
- Source identity: `cf3acf32f236a5c6ecdca5cf0b244ef16bd36c1ff8ecfa6b063e522a2ed723ac`
- Branch: `feat/backend-release-integration-v2`
- Verification date: `2026-07-13`
- Verification status: pass
- Launch readiness: blocked by the separately listed RLS and production-provenance gates
- Database/schema/data mutation: none
- Protected screenshot changes committed: none

## User-Reported Workspace Regression

The empty-input residue and desktop rail-height regressions are closed in the integrated source.

- Empty textarea value: `0` characters
- Empty placeholder: none
- Empty restore action count: `0`
- Empty auto-recognition chip row count: `0`
- Empty current-work/source-status blocks: `0 / 0`
- Filled `1560x700` sidebar/main bottom delta: `0px`
- Cleared `1560x700` sidebar/main bottom delta: `0px`
- Independent sidebar scrolling: disabled on the reported desktop geometry
- Horizontal overflow: none
- Example state transition: second example -> edit -> restore exact second example -> clear

Evidence: `evaluation/workspace-empty-rail-hotfix-2026-07-13/`.

## Integrated Test Gates

- Full serial suite: `132` files passed, `5` skipped; `1,282` tests passed, `7` skipped.
- Full suite command: `npm.cmd test -- --maxWorkers=1 --no-file-parallelism`.
- Full suite duration: `893.81s`.
- Strict TypeScript typecheck: passed.
- PDF focused gate: `2` files, `22` tests passed.
- Isolated browser-harness remediation: `1` file, `3` tests passed.
- Frontend browser audit: `108/108` rows passed.

The authoritative source gate is `final-full-tests-514b2d9.log`. Earlier source logs are superseded.

## Frontend Evidence Gate

- Static audit: `32` page files, `23` product component files, `0` coverage issues, `0` violations.
- Normal production build: `27/27`, build ID `GZHsLnN8pBcRAUWz5FMu1`, audit marker `0`.
- Audit production build: `27/27`, build ID `KWLW3gxAjtwayCo6QPlnx`, audit marker exactly `1`.
- Browser rows: `96` route + `6` workspace theme + `4` special surface + `2` generated surface = `108`.
- Browser result: `108/108` successes.
- Failed rows, findings, recovered rows: `0 / 0 / 0`.
- Canonical source identity: `cf3acf32f236a5c6ecdca5cf0b244ef16bd36c1ff8ecfa6b063e522a2ed723ac`.
- Source identity normalizes CRLF and LF before hashing; the same committed source now has one Windows/Linux identity.
- Forbidden local/worktree path scan: `0` matches after evidence sanitization.

The normal build was repeated from a clean `.next` after the full suite because browser tests replace build artifacts. The post-test build completed `27/27` and the bundle contract again returned marker `0`.

## PDF Runtime Gate

- Direct production POST: HTTP `200`.
- Content type: `application/pdf`.
- Content disposition: attachment with UTF-8 filename.
- Cache control: `no-store`.
- Output size: `20,507 bytes`, below `1 MiB`.
- PDF magic: `%PDF-`.
- Combined TBM fixture: `32` linked risk-assessment rows + `32` TBM delivery rows.
- Long-form render: `2` pages; first and last pages are `1190x1684` with `108,261 / 74,114` non-white pixels.
- Extracted text length: `2,616`; title, risk sentinel, TBM sentinel/detail, both provenance labels, approval line, and disclaimer are present.
- NFT: `57` traced files; Noto Sans KR Regular `1`, Bold `1`, OFL license `1`.
- Missing/invalid font controlled error, non-font rethrow, pagination, row merging, and export budgets: covered by `22/22` focused tests.
- TBM exports preserve both `riskRows` and TBM-specific `rows`; neither source silently replaces the other.
- Fail-closed resource budgets: request `262,144` bytes, input rows `128`, string field `4,000` Unicode characters, render lines `512`, PDF pages `8`.
- Over-limit requests return deterministic HTTP `413` with `PDF_EXPORT_LIMIT_EXCEEDED`; content is not silently truncated.
- Direct POST provenance records source SHA, source identity, build ID, exact request artifact and SHA-256, and response SHA-256.

## Browser Harness Reliability

- The isolated Next.js harness probes a bounded loopback range and now retries server startup on `EADDRINUSE` or `EACCES`.
- A regression test claims the selected port after probe but before Next starts, verifies the failed attempt is cleaned, and verifies the second port starts successfully.
- This closes the probe/start time-of-check-to-time-of-use race without weakening the serial full-suite gate.

## Phase A Ontology

- Canonical chains: work at height/fall, forklift-machine adjacency/entrapment, electrical work/electric shock.
- Controls: `9`; SIF references: `7`; KOSHA production documents: `9`.
- KOSHA local chunks: `13` (`8` active, `5` review-only).
- Direct control mappings: `11`; law articles: `9`; materialization targets: `18`.
- Review-only SIF evidence is excluded from active citations, naturalization, and MCP evidence contracts.
- A failed quality contract invalidates a prior human confirmation and returns it to pending.
- Core resolver state: `resolved=false`, `published=false`, `graphPublicationState=published`, `inferenceState=review_required`.
- Reason: persistent production-row/local-chunk provenance bridge and corpus launch gate are not ready.
- KOSHA remains technical guidance, SIF remains risk-priority evidence, and only current law supplies statutory mandate evidence.
- No ontology publication, seed promotion, migration, or Supabase mutation occurred.

## RLS And Phase B Boundaries

- The read-only RLS audit is integrated; its reported security findings remain open engineering work, not silently fixed claims.
- Effective GRANTs and authenticated cross-tenant mutation behavior remain live-unverified.
- Phase B organization knowledge, billing, and EngineAdapter design is recorded only in `docs/phase-b-organization-knowledge-and-engine-plan.md`.
- No Phase B migration, billing schema, tenant worker pool, or organization publication flow was implemented.

## Working Tree Boundary

Sixteen pre-existing `output/playwright/2026-07-10/module-shell-hardening/*.png` changes remain unstaged and are excluded from every release commit. Final evaluation artifacts are path-sanitized and contain no local username or worktree path.

## Primary Evidence

- `final-full-tests-514b2d9.log`
- `final-evidence-validation-514b2d9.json`
- `final-typecheck-514b2d9.log`
- `final-pdf-focused-514b2d9.log`
- `final-isolated-harness-remediation-514b2d9.log`
- `final-static-audit-514b2d9.log`
- `final-build-normal-514b2d9.log`
- `final-build-audit-514b2d9.log`
- `final-browser-audit-108-514b2d9.log`
- `final-build-post-tests-514b2d9.log`
- `final-bundle-normal-post-tests-514b2d9.log`
- `final-pdf-nft-514b2d9.json`
- `final-direct-post-514b2d9-request.json`
- `final-direct-post-514b2d9.json`
- `final-direct-post-514b2d9-render.json`
- `final-direct-post-514b2d9-first.png`
- `final-direct-post-514b2d9-last.png`
