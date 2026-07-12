# Phase A Hermes Architecture Decision Verification

Date: 2026-07-13
Artifact: [`ARCHITECTURE_DECISIONS.md`](../../ARCHITECTURE_DECISIONS.md)
Status: Verified

## Scope

This work records architecture decisions only. It includes no code/provider
implementation, database change, migration, data mutation, deployment, or live
Hermes proof.

## Recorded Decisions

| ID | Decision | Recorded result |
| --- | --- | --- |
| ADR-PA-001 | Product authority | SafeClaw MCP/DB Evidence Harness remains system of record and effect authority. |
| ADR-PA-002 | Runtime path | Hermes/OpenClaw/SafeClaw-specific fork remains isolated behind a versioned `EngineAdapter`; no wholesale core replacement. |
| ADR-PA-003 | Evidence and obligations | Operational grounding is SIF -> KOSHA -> current law; obligation classification remains a separate four-value boundary. |
| ADR-PA-004 | Generation and gates | `naturalize_only`, existing provider fallback, human confirmation, share, and publication gates remain. |
| ADR-PA-005 | Authentication | A representative local GPT OAuth PoC is bounded; later commercial traffic requires service authentication. |

## Required Boundary Coverage

| Requirement | ADR section | Status |
| --- | --- | --- |
| Reconcile deferred core replacement with long-term fork runtime | Context and Reconciliation | Passed |
| Preserve SafeClaw fact/effect authority | ADR-PA-001 | Passed |
| Keep runtime experimental and out of provider policy | ADR-PA-002, ADR-PA-004 | Passed |
| Preserve provider fallback | ADR-PA-004 | Passed |
| Preserve grounded generation and human gates | ADR-PA-003, ADR-PA-004 | Passed |
| Prohibit direct DB writes and ontology publication | ADR-PA-001 | Passed |
| Bound local OAuth and require service auth later | ADR-PA-005 | Passed |
| Explain defer reasons and reopen evidence | Deferred and Reopen sections | Passed |
| Define rollback and kill switches | Rollback and Kill-Switch Boundaries | Passed |
| Relate Phase A to Phase B | Phase B Relationship | Passed |
| State explicit non-goals and no live Hermes claim | Explicit Non-Goals | Passed |

## Verification

| Check | Command category | Status |
| --- | --- | --- |
| JSON syntax | PowerShell `ConvertFrom-Json` | Passed: 5 decisions, 5 checks |
| Markdown local links and paths | PowerShell path and line-range assertion | Passed: 29 links |
| Required decision phrases | PowerShell content assertions | Passed: 28 assertions |
| Owned-path-only diff | final commit-range assertion | Passed: 3 files across 2 owned roots |
| Whitespace/errors | `git diff --cached --check` | Passed |

No live endpoint, remote Hermes process, OAuth account, or production traffic
was probed for this ADR.
