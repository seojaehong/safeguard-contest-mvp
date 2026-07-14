# KOSHA Commercial Contract Remediation v4 Evidence

## Status

- Local remediation status: GREEN for the requested focused gates.
- Independent review status: pending.
- Integration status: blocked until a fresh independent reviewer accepts this series.
- No integration, self-approval, deployment, build, or full-suite claim is made.

## Commit Identity And Ancestry

- Branch: `fix/kosha-commercial-contract-remediation`
- Clean pushed v3 baseline: `2a2326951b4b2d030af11f4615f7cf6b9bafa334`
- Intentional RED contract commit: `2b3144f72f51baf9ee4808fd7ba804078ce43d23`
- Product GREEN commit: `e0a67f6e1953d421e58549666d1d44402435dfeb`
- Product tree: `6e17fb552ce34c6a07e981c917b1e01c8616506d`
- Authoritative main: `920c7f360688352156de4854b4957a9f2f1f0e43`
- Exact ancestry: `2a232695 -> 2b3144f7 -> e0a67f6e -> evidence commit containing this report`.

The evidence commit SHA is intentionally not self-embedded because a commit cannot contain its own final SHA. Resolve it with `git log -1 --format=%H -- evaluation/kosha-commercial-contract-remediation-2026-07-14/report.json` after checkout.

## TDD RED Before GREEN

Commit `2b3144f7` adds only the v4 regression contracts and their raw RED evidence. On baseline `2a232695`, the focused command exited 1 with three failed files, five failed attacks, two passing positive controls, and 81 skipped tests. The raw transcript is `red-v4-independent-review.log`. Its RED-time Windows worktree-byte SHA-256 is `58b35e8b2fc4db316992db84516c601fcccec038ca0caafb70466ba0ca4236ef`; the normalized Git blob SHA-256 is recorded separately in `evidence-integrity-v4.log`.

The first local product candidate, `f90562cf`, passed the new v4 attacks but exposed one existing focused55 regression: 54 passed and one failed. That self-recorded intermediate transcript is preserved as `baseline-v4-focused55-first-product-red.log`. The candidate was amended before push after restricting generated-document appendices to parent-ready KOSHA rows. It is not part of the final ancestry and is not presented as independently captured evidence.

## Product Remediation

### P1-A Row Relevance

- `hasRelevantKoshaParent` now requires a deterministic recognized hazard-family intersection in addition to strong row overlap.
- Canonical variants such as `충돌` and `차량 충돌` resolve to the same collision family.
- Empty tags cannot bypass conflicting title, summary, category, keyword, or risk-tag semantics.
- Shared equipment or domain text alone is insufficient when hazard families differ.
- Same-hazard forklift collision positives and the existing corpus remain covered.

### P1-B Provider Narrative

- When any technical KOSHA row lacks a relevant parent, provider-authored deliverable bodies are discarded structurally.
- The response uses the deterministic pre-provider baseline rather than retained provider narrative allowlists.
- All attacked response and AI narrative surfaces are serialized and checked for provider markers.
- Parentless KOSHA identity remains review-required, but its title is excluded from generated-document appendices unless parent-ready.
- Safe non-KOSHA provider behavior remains available.

### P1-C MCP Surface

- `lib/mcp-tools.ts` now returns `buildPublicDbHarnessPacket(...)`, not the raw internal packet.
- The MCP packet and prompt use the same sanitized object.
- Unique parentless KOSHA summary, body, control, action, and evidence-reference markers are absent from packet, prompt, citations, and deliverables.

`naturalize_only`, SIF -> KOSHA -> law ordering, and KOSHA guidance-only mandate separation are preserved.

## Verification

All commands used `--maxWorkers=1 --no-file-parallelism` and ran sequentially.

| Gate | Result | Log |
| --- | ---: | --- |
| v4 attacks and positive controls | 7 passed, 81 skipped | `green-v4-focused-attacks.log` |
| MCP tool file | 27 passed | `green-v4-mcp-tools.log` |
| Existing focused contract | 55 passed, 6 skipped v4 tests | `baseline-v4-focused55.log` |
| Existing group B | 26 passed, 3 skipped v4 tests | `green-v4-group-b.log` |
| Existing group C | 22 passed | `green-v4-group-c.log` |
| Existing group D | 130 passed | `green-v4-group-d.log` |
| Existing group E | 84 passed, 3 skipped v4 tests | `green-v4-group-e.log` |
| Existing B/C/D/E aggregate | 262 passed across 12 unique files | four group logs above |
| Strict TypeScript typecheck | passed | `green-v4-typecheck.log` |
| Scope, no-added-`any`, ancestry, and diff check | passed | `green-v4-diff-check.log` |

## Main Overlap And Merge Tree

- Merge base with authoritative main: `3a74107e3d8363f437815b877533f7342fd02c45`.
- Authoritative main changed paths from merge base: 3.
- v4 RED+product changed paths through `e0a67f6e`: 8; exact main-path overlap: 0.
- Pre-evidence product branch through `e0a67f6e` changed paths from merge base: 37; exact main-path overlap: 0.
- `git merge-tree --write-tree 920c7f... e0a67f...` exited 0 and produced tree `be4b872a66eddab705c9415417ba0933be3c8f54`.

These are conflict and path-overlap observations only. They do not approve integration. Full path sets and the raw merge-tree output are in `green-v4-merge-tree-main-overlap.log`.

## Historical Evidence Correction

The v3 report's description of `integrated-kosha-group-d.log` as an "immutable log" is withdrawn. The file is a historical self-recorded command transcript. Its Windows worktree bytes are preserved in Git from commit `049debe47cf6d18e923bb5c91e5fafd8d07c885b`, with SHA-256 `7f0c0ae1905a62bbaf3b74973e0c62e58eee78d776539008ed6c6b630bbed008`; the normalized Git blob hash is recorded in the v4 manifest. No independent runner, signed attestation, or external immutable capture was established. It must not be treated as independently immutable evidence.

## Scope Integrity

- RED commit files: three tightly related tests and two v4 RED evidence files.
- Product commit files: `lib/db-harness.ts`, `lib/search.ts`, and `lib/mcp-tools.ts` only.
- Evidence commit files are confined to `evaluation/kosha-commercial-contract-remediation-2026-07-14/`.
- No DB, schema, migration, data, package, lockfile, dependency, `.env`, build artifact, or unrelated file was changed.
- `green-v4-diff-check.log` records zero scope mismatches, zero added `any` matches, zero tracked product worktree changes, and a clean `git diff --check`.
- `evidence-integrity-v4.log` is a generated Git-index-blob SHA-256 manifest for the v4 reports and raw transcripts; it deliberately excludes itself.

## Review Gate

Fresh independent review remains required. Do not integrate or treat this report as self-approval.
