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
| ADR-PA-002 | Runtime path | Hermes/OpenClaw/SafeClaw-specific fork remains isolated behind a versioned `EngineAdapter`; Phase A authorizes no runtime experiment or wholesale core replacement. |
| ADR-PA-003 | Evidence and obligations | Operational grounding is SIF -> KOSHA -> current law; obligation classification remains a separate four-value boundary. |
| ADR-PA-004 | Generation and gates | `naturalize_only`, existing provider fallback, human confirmation, share, and publication gates remain. |
| ADR-PA-005 | Authentication | A representative GPT OAuth PoC is a future Phase B step 6 only, after the Phase B entry gate and separate explicit approval; later commercial traffic requires service authentication. |

## Required Boundary Coverage

| Requirement | ADR section | Status |
| --- | --- | --- |
| Reconcile deferred core replacement with long-term fork runtime | Context and Reconciliation | Passed |
| Preserve SafeClaw fact/effect authority | ADR-PA-001 | Passed |
| Keep runtime experimental and out of provider policy | ADR-PA-002, ADR-PA-004 | Passed |
| Preserve provider fallback | ADR-PA-004 | Passed |
| Preserve grounded generation and human gates | ADR-PA-003, ADR-PA-004 | Passed |
| Prohibit direct DB writes and ontology publication | ADR-PA-001 | Passed |
| Keep OAuth execution out of Phase A and require service auth later | ADR-PA-005, Phase B Relationship, Explicit Non-Goals | Passed |
| Explain defer reasons and reopen evidence | Deferred and Reopen sections | Passed |
| Define rollback and kill switches | Rollback and Kill-Switch Boundaries | Passed |
| Relate Phase A to Phase B | Phase B Relationship | Passed |
| State explicit non-goals and no live Hermes claim | Explicit Non-Goals | Passed |

## Verification

| Check | Command category | Status |
| --- | --- | --- |
| JSON syntax | PowerShell `ConvertFrom-Json` | Passed: 5 decisions and 5 verification entries parsed |
| Markdown local links | PowerShell local-link regex count | Passed: 28 local links |
| Phase B execution gate | PowerShell content assertions | Passed: Phase B step 6, entry gate, and separate explicit approval are required before any OAuth PoC |
| Owned-path-only diff | `git diff --name-only 02295b5` compared with the assigned file list | Passed: 3 changed files, all assigned paths |
| Whitespace/errors | `git diff --check 02295b5` and `git diff --check 02295b5..HEAD` | Passed: base-to-worktree and committed-range checks exited 0 |

No live endpoint, remote Hermes process, OAuth account, or production traffic
was probed for this ADR.
