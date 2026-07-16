# ADR 0002: Knowledge Promotion and Provenance Boundary

Date: 2026-07-14

## Status

Accepted for the current stored human-review slice. No database schema, migration,
backfill, or bulk data change is approved or applied by this ADR.

## Context

SafeClaw already stores raw `knowledge_events`, can assemble regeneration bundles,
and exposes a published ontology graph. Those surfaces did not make the boundary
between an event, an LLM proposal, human review, and published knowledge explicit.
The existing `POST /api/knowledge/regenerate` route could also insert an LLM output
into `knowledge_regeneration_runs`, allowing the generator and product persistence
boundary to collapse into one operation.

The product also combines several evidence families that must not inherit each
other's authority:

| Evidence family | Authority | Scope | Legal-duty role |
| --- | --- | --- | --- |
| SIF | incident and control evidence | public reference | non-statutory reference |
| KOSHA Guide | technical guidance | public reference | non-statutory reference |
| Current law | statutory source | public reference | current text and effective date must be checked |
| Organization history | operation memory | organization-private | operational evidence only |
| Site history | operation memory | site-private | operational evidence only |
| Hermes / LLM | none | candidate only | no authority |

## Decision

The product contract has four explicit states:

1. `knowledge_event`: a product-owned raw event with source, capture time, payload,
   and tenant context preserved by the existing ingest path.
2. `candidate`: an unpublished proposal assembled by SafeClaw and optionally
   rewritten by Hermes or another LLM. A candidate may be stored only by the
   SafeClaw prepare route after all tenant and event checks pass.
3. `human_review`: a mandatory review gate. The existing approve candidate,
   keep site-only, and reject actions record a receipt but never publish.
4. `published_ontology`: the existing `review_state=published` ontology subgraph,
   treated as a separate read-only system-of-record surface.

`POST /api/knowledge/regenerate` is now stateless. It returns
`storageMode: "stateless_candidate"`, `savedRunId: null`, and a versioned candidate
DTO with `dbMutationAllowed`, `dbMutationPerformed`, and `publishAllowed` all set
to `false`. Missing, non-array, or empty `rawEvents` fail closed before generation,
and every accepted request must carry an explicit organization/site tenant context.
Candidate v2 provenance binds that context to a SHA-256 event snapshot reference
and a SHA-256 payload digest. Only bounded allowlisted review metadata is returned;
raw event titles, URLs, and private payload fields are excluded from both the LLM
prompt and the API response. `GET
/api/knowledge/governance` and the `/knowledge` workspace surface expose the same
shared stage and authority contract.

The POST handler receives a mutation gateway as a dependency. Production injects
a fail-closed gateway whose write method throws, while the stateless candidate
path never invokes it. Tests execute the real handler with an observable gateway
and require zero write calls, replacing source-text scanning as the no-write proof.

`POST /api/knowledge/review/prepare` is the only stored candidate preparation
path in this slice. It requires an authenticated organization owner and an existing
`draft` `knowledge_regeneration_runs` row. Before generation it verifies the run's
organization and site, a non-empty bounded list of unique pending event IDs, exact
event membership, tenant equality, and absence of any other actionable run sharing
an event. Missing, duplicate, cross-tenant, cross-site, shared, or invalid rows fail
before the update call. Candidate generation is injected as a capability with no
database gateway. Empty, failed, oversized, or policy-invalid output cannot become
reviewable.

SafeClaw persists one bounded candidate envelope in the existing
`generated_output` column and changes the guarded draft row to `review_required`.
The envelope also stores a SafeClaw-computed source snapshot containing the exact
ordered event IDs, tenant context, and immutable event and payload digests. The
prepare path compares candidate provenance to that snapshot before its single
update. Every review action reloads the currently scoped events, recomputes the
snapshot, and requires exact count, ID, tenant, and digest equality. Empty,
foreign, or stale provenance fails with no mutation.

Service-role reads are tenant constrained in the database query as well as after
the read: owned site IDs constrain run queries, and organization plus site IDs
constrain event queries. Prepare and review POST routes reject non-canonical UUID
v4 run IDs before creating a database client. Only `review_required` runs with a
schema-valid source-bound candidate can begin a new decision. Finalized runs may
only enter the existing compensation path when their receipt matches the exact
operation and their stored candidate remains source-bound.

The envelope fixes `publicationState=unpublished`, `ontologyPublished=false`,
`publishPerformed=false`, `migrationPerformed=false`, and `legalConfirmed=false`.
The prepare response omits stored provenance and tenant
identifiers, and the UI allowlists only the candidate question, generated text,
hazard IDs, provider label, event count, and unpublished state. Stored run questions
are not reused in the prompt or UI because ingest titles can contain personal data;
the prepare path substitutes a generic event-count question. Raw payloads, URLs,
photos, signatures, and event titles are not rendered in the candidate inbox.
The browser inbox API uses a presentation DTO rather than serialized storage
rows. It exposes only a run ID, safe labels, status, source and hazard counts,
bounded candidate text, and an optional provider label. It never includes event
titles or source IDs, the original run question or raw event IDs, tenant context,
the full generated output, or provenance.

The existing authenticated `/api/knowledge/ingest` path remains product-owned and
may persist raw events and draft run records under its current RLS policy. It is
not an LLM-owned mutation path and it does not publish ontology nodes.

## Provenance Classification

The current `KnowledgeRawEvent` DTO is retained. Its structured `payload` is used
only when it contains an explicit discriminator:

- `source: "kosha-accident"` is generic incident evidence by default. It is SIF
  only when `payload.item_type` or `payload.itemType` equals `sif-case`.
- `source: "manual"` is unscoped operation memory by default. It becomes
  organization- or site-private only when `payload.provenanceScope` explicitly
  names that scope.
- KOSHA guidance and Law.go events preserve their own technical-guidance and
  statutory-source classifications. Their presence never gives the generated
  candidate authority of its own.

## Deferred Migration Proposal

A future publication workflow will need explicit legal confirmation, approved
ontology node and edge identifiers, tenant-promotion scope, rollback references,
and an atomic database transaction or RPC. Candidate v2's content-addressed
snapshot and the current human-review receipt do not replace those fields. They
require a separately approved migration and RLS review. No publish endpoint is
added by this slice.

## Consequences

- Hermes and other LLM runtimes can generate candidates without owning facts,
  tenant state, or publication.
- SIF, KOSHA, law, organization history, and site history remain distinguishable
  in both the API contract and the workspace UI.
- Candidate review can verify a bounded event snapshot without receiving sensitive
  raw event text.
- `/knowledge` contains an authenticated review inbox for candidate preparation and
  the three existing human decisions. Signed-out visitors do not call review APIs.
- Approval means only that the candidate receipt was recorded. It remains
  unpublished, is not legal-confirmed, and causes zero ontology node or edge writes.
- Existing callers that expected `regenerate` to save a run must move persistence
  to a future human-review workflow; there is no in-repository runtime caller in
  the current authoritative base.
- Human review is writable through existing tables and actions; published promotion
  remains intentionally unavailable.
