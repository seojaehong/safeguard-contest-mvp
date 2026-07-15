# ADR 0002: Knowledge Promotion and Provenance Boundary

Date: 2026-07-14

## Status

Accepted for the current read-only candidate slice. No database schema, migration,
or data change is approved or applied by this ADR.

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
2. `candidate`: an unpublished, in-memory proposal assembled by SafeClaw and
   optionally rewritten by Hermes or another LLM.
3. `human_review`: a mandatory review gate. This round exposes the state but adds
   no approve, reject, publish, or database mutation action.
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

A production review queue will eventually need reviewer identity, decision and
review timestamps, database-owned source-row references, candidate version and
idempotency key, approved ontology node/edge identifiers, tenant-promotion scope,
and rollback reference. Candidate v2's content-addressed snapshot reference does
not replace those persisted audit fields. They should be introduced by a separately
approved migration and RLS review. Until then, the UI remains read-only and no
publish endpoint is added.

## Consequences

- Hermes and other LLM runtimes can generate candidates without owning facts,
  tenant state, or publication.
- SIF, KOSHA, law, organization history, and site history remain distinguishable
  in both the API contract and the workspace UI.
- Candidate review can verify a bounded event snapshot without receiving sensitive
  raw event text.
- Existing callers that expected `regenerate` to save a run must move persistence
  to a future human-review workflow; there is no in-repository runtime caller in
  the current authoritative base.
- Human review and published promotion are modeled but intentionally not writable
  in this round.
