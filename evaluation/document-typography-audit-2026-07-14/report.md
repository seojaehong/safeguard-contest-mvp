# Document Typography Audit Evidence

## Verification Target

- Authoritative base: `785f328e2804ba472a1d659d83ef4c3c89acf342`
- Product commit: `4989f1ecc33cc7e6bf574590f9b8fce86442c8f4`
- Product source identity: `e99e8204105a1ab4f50270636acff0c9958ae9e712f29521c3c5c84dd6413afe`
- Branch: `fix/document-typography-audit-20260714`
- This report, the static audit, and the verification summary are carried by a follow-up evidence-only commit. That commit changes no product files.

## Durable Evidence

- Parent RED was independently reproduced in a detached worktree at `785f328`: static audit exit 1 with 6 violations; focused tests exit 1 with 4 failed files, 4 failed tests, and 26 passed tests.
- Product GREEN was freshly verified at `4989f1e`: static audit exit 0 with 0 violations and 0 coverage issues; focused tests exit 0 with 4 passed files and 30 passed tests.
- Strict typecheck exited 0.
- Product diff-check for `785f328..4989f1e` exited 0.
- `static-audit-final.json` is directly attributed to product commit `4989f1e`, not its parent.

Exact commands, exit codes, counts, source SHAs, and source identities are tracked in `verification-summary.json`. This report does not depend on ignored log files.
