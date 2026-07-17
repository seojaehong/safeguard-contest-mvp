# Runtime architecture documentation canonicalization

## Finding

`docs/ARCHITECTURE_DECISIONS.md` duplicated an older 2026-07-09 decision set.
It described Hermes as rejected without the later `EngineAdapter` promotion
boundary and treated the LLM Wiki path as a generic deferred PoC. The canonical
root ADR and numbered ADRs already contain the reviewed Phase A/Phase B split.

## Change

The duplicate document is now a compatibility index that points only to the
canonical decision records. It explicitly preserves these boundaries:

- SafeClaw MCP, DB, and Evidence Harness own facts and effects.
- Hermes is not a model-provider branch and cannot replace the product core in
  the active plan.
- Hermes may later become the primary planner runtime only behind
  `EngineAdapter` and after the recorded promotion gates.
- LLM Wiki output is candidate-only until human review and never publishes
  ontology directly.
- Evidence order starts with SIF and KOSHA Guide, with law as the mandate layer.

## Verification

- No application code, schema, migration, or data changed.
- All five canonical links resolve to tracked files.
- The superseded index contains no independent implementation authorization.
