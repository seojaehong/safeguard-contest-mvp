# Share v2 test isolation incident

Two large Vitest runs overlapped in this worktree. The observed process trees included npm PIDs `11628` and `42560`, Vitest PIDs `4552` and `41672`, and temporary Next server PIDs `7264` and `40216`. Worker PIDs `49500` and `33132` also remained after the interruption.

Both overlapping runs are invalid evidence. They are counted as neither PASS nor authoritative RED because timing, resource use, temporary servers, and generated PNG writes were race-contaminated. No contaminated stdout is promoted into the final gate.

The four lingering Vitest/worker processes were terminated and the Share-owned Vitest/Next count was confirmed as zero before sequential verification resumed. The valid replacement runs are the isolated post-commit unit run (`22` files, `230` passed, `128` skipped, exit `0`) and the single isolated post-commit browser run (`130/130`, `128/128` rows, exit `0`).

The final process check is stored in `logs/process-isolation-final.log`. Generated tracked PNGs were restored and are separately hash-checked in `generated-artifact-restoration.json`.
