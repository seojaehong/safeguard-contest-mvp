# KOSHA Offline Harness Remediation Report

- Date: 2026-07-12
- Branch: `feat/kosha-offline-harness`
- Review base: `84c04cd98c05b16f207e37be848d57de852f9509`
- Head before remediation: `2a8c68a318d12266189cc79d44ed2fd58acdeebd`
- Read-only v3 JSONL total: 79,424,591 bytes

## Remediation

- The hybrid merge now deduplicates by ID, reserves/interleaves successful Supabase results under the requested limit, and reports `hybrid-local-supabase` when both sources contribute.
- Canonical SIF labels, domain controls, aliases, relevance, and operational metadata are shared by `lib/safety-reference-policy.ts`; the client boundary contains no server IO.
- Local KOSHA evidence preserves `evidence_role`, `directEligible`, page anchors, and local retrieval provenance through search and the DB harness. Supporting KOSHA is never classified as direct DB evidence.
- Local corpus retrieval applies exact technical `itemType` matching. `sif-case` receives no local KOSHA and regulations never receive guidelines.
- The loader checks the opened descriptor's size before and after each streamed chunk, rejecting post-open growth beyond 48 MiB.
- Default test fixtures are synthetic temporary snapshots. The real v3 test remains conditional, read-only, and corpus-independent by default.

## Verification

The earlier default-parallel expanded Vitest invocation was interrupted because this worktree has a known OOM risk. It is invalidated and is not evidence. Only the following serial runs count:

| Gate | Command mode | Result |
| --- | --- | --- |
| original | `--maxWorkers=1 --no-file-parallelism` | 8 passed, exit 0 |
| expanded | same, one Vitest process per file | 113 passed, exit 0 |
| corpus audit | same | 34 passed, exit 0 |
| typecheck | `npm.cmd run typecheck` | exit 0 |

The expanded total is `8 + 19 + 43 + 5 + 31 + 3 + 3 + 1 = 113`.

## Build Status

Exactly one `npm.cmd run build` was launched. `Compiled successfully` was observed and `BUILD_ID`, routes manifest, and build manifest were created after its processes exited. The execution channel did not return the final exit-code line, so this is artifact/process evidence only, not an asserted build exit-code PASS. No second build was launched.
