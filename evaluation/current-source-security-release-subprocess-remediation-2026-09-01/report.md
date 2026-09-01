# Current-source release subprocess remediation

## Verdict

`PASS_LIVE_DEPLOYED_RELEASE_SUBPROCESS_BUDGET_RESCAN_REQUIRED`

Product commit `665761db` replaces the unbounded release and Reports Wave 1 publication subprocesses with a shared asynchronous budget. Release and publication steps now have a 10-minute deadline and a combined 20 MiB stdout/stderr ceiling. The five transitive Git identity calls have a 30-second deadline and an 8 MiB output ceiling.

On Windows, the helper records the descendant tree, terminates the root to stop new child creation, records the tree again, and terminates the union leaf-first. It retains a `taskkill /T` fallback. On non-Windows systems, the child is placed in a detached process group and the group is killed. The publisher continues forwarding stdout and stderr as chunks arrive instead of hiding progress until completion.

Budget errors fail closed regardless of the observed numeric exit status. The regression suite covers a late-spawned grandchild at timeout, output overflow with a live parent, and output overflow observed after the parent has exited while pipes are still draining.

Production `/api/build-info` reports product commit `665761dbe7d22ece85a7d86d063d5d1244ce98f7` on `master`, so the bounded release subprocess implementation is live deployed. Evidence commit `6e1bf3b7` is recorded separately and does not change runtime behavior.

## Verification

| Check | Result |
| --- | --- |
| Subprocess budget and Reports Wave 1 support | 2 files, 23 tests PASS |
| Windows deadline tree cleanup | PASS |
| Windows output-ceiling tree cleanup | PASS |
| Exited-parent pipe-drain cleanup | PASS |
| Live stdout/stderr forwarding | PASS |
| Four Node syntax checks | PASS |
| Strict TypeScript check | PASS |
| Next production build | PASS, 29/29 static pages |

Independent investigation and iterative bypass review produced five actionable findings. All five were resolved, and the final reviewer verdict was clean.

## Boundaries

- This is source/live-aligned product evidence. A fresh full security rescan remains required.
- Neither the sealed 16-finding scan nor the immutable original 18-finding baseline is rewritten or reclassified.
- The full release closeout and Reports Wave 1 publication workflow were not executed; their subprocess invariants were verified with isolated, non-publication tests.
- No database, provider dispatch, Share-session, embedding/vector, Wiki publication, or KOSHA registry mutation occurred.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`, and approval-gated findings remain open.
