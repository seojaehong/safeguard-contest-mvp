# Northstar 24h Knowledge Candidate P1-P3 Remediation

Date: 2026-07-14

Authoritative base: `01ba1c924e5ab19803bdb86527fce9eccfc1ab60`

Remediation base: `9dc8e65b5e564c31d2052d82eaec6ca93f974441`

Branch: `feat/northstar-24h-knowledge-round`

## Result

Knowledge candidate generation now fails closed unless `rawEvents` is a
non-empty array of valid events and an explicit organization/site tenant context
is present. Candidate v2 preserves a tenant-bound, content-addressed event
reference and bounded review metadata without returning raw event titles, URLs,
or private payload values.

The stateless POST implementation is constructed with a mutation gateway.
Behavioral tests execute the real handler with an observable gateway and verify
zero write calls. SIF, KOSHA Guide, current-law, organization-history, and
site-history authority classifications remain separate. The candidate still has
no authority and cannot write or publish.

## Remediation Counts

| Item | Count |
| --- | ---: |
| Product/test/contract files | 7 |
| Evaluation evidence files | 10 |
| Total remediation files | 17 |
| Fail-closed raw-event cases | 4 |
| Fail-closed tenant-context cases | 3 |
| Promotion stages preserved | 4 |
| Authority lanes preserved | 6 |
| Mutation gateway write calls | 0 |
| Database schema changes | 0 |
| Migration files | 0 |
| Database/data mutations | 0 |
| Publish controls/endpoints added | 0 |

## TDD Evidence

RED was captured before each implementation slice:

- `remediation-red-p1.log`: missing, non-array, and empty `rawEvents` each
  returned `200` instead of fail-closed `400`.
- `remediation-red-p1-builder.log`: the candidate builder accepted an empty
  event list instead of refusing candidate creation.
- `remediation-red-p2-tenant.log`: missing and partial tenant contexts each
  returned `200`.
- `remediation-red-p2-provenance.log`: the response still used candidate v1 and
  lacked tenant-bound immutable provenance.
- `remediation-red-p3.log`: no injectable mutation gateway boundary existed.

GREEN verification:

- Focused Vitest/Playwright: 4 files, 24 tests passed, 0 failed.
- TypeScript strict check: passed with exit 0.
- Browser viewports retained: 1440x900 and 390x844.
- Direct mutation behavior: injected gateway `write` called 0 times on a
  successful generated-candidate request.
- Sensitive-event behavior: raw title, private URL token, and private payload
  marker appeared 0 times in the complete response and LLM prompt.
- Diff check: passed with exit 0.

## Provenance Contract

- Candidate contract: `knowledge-candidate.v2`.
- Event and payload digests: canonical SHA-256 hexadecimal values.
- Review metadata: allowlisted top-level scalar fields only, at most 8 fields,
  with string values bounded to 96 characters.
- Tenant binding: organization ID and site ID are required and copied to both
  candidate and event provenance.
- Raw title, URL, and non-allowlisted payload values are not projected to the
  candidate response or generation prompt.

## Boundaries

- Existing authenticated `/api/knowledge/ingest` remains the product-owned raw
  event storage path.
- `/api/knowledge/regenerate` remains stateless and does not call its injected
  mutation gateway.
- Human review remains mandatory; ontology publication remains unavailable.
- No DB schema, migration, data, package, or lockfile change was made.

## Evidence Files

- `remediation-red-p1.log`
- `remediation-red-p1-builder.log`
- `remediation-red-p2-tenant.log`
- `remediation-red-p2-provenance.log`
- `remediation-red-p3.log`
- `remediation-green.log`
- `remediation-typecheck.log`
- `remediation-diff-check.log`
- `docs/adr/0002-knowledge-promotion-provenance-boundary.md`
- `docs/knowledge_internal_api_schema.md`
