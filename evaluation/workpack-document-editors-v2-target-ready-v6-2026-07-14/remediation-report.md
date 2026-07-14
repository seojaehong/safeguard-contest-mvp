# Document Editors v6 Contract Remediation Report

## Boundary

This remediation changes evaluation artifacts only. Product, editor, browser, build, export, DB, schema, migration, package, and lock executions or mutations remain zero. Implementation remains blocked pending explicit user approval of the exact external DB authority transaction or RPC.

The author evidence is reproducible but untrusted. It does not establish an independent PASS and must be returned for a fresh read-only parent review.

## Rejected Source

- Rejected candidate: `106eef7c609e937dbebfe06c3affb89d63f550d5`
- Rejected evidence: `82ff4a11b664b55c5ea9d7f6bdd815c72f6f460c`
- Immutable source base: `f45bba17bcce0d8ebb2690f82d014dbe42ae8191`
- Prior declared authority: `ea7aa7223a056c884d5b0ba55563d602af328451`
- Current fetched authority: `67d2c9e28e7278c58f46b46c2512c7133d88d1d3`
- Authority ref: `refs/remotes/origin/feat/phase-a-evidence-integration`

The current authority is fetched and resolved live. Any stale ea7 declaration fails closed and cannot produce new GREEN evidence.

## TDD Evidence

The RED run executed one focused hostile-test process containing 63 cases. Ten attacks were accepted: missing external nonce authority, same-receipt replay, coherent whole-context forgery, reversed JSONL, absent full-log digest/order/count bindings, stale replay clock reuse, dirty worktree, and future mtime.

The GREEN run executed one focused hostile-test process containing 62 cases. All 62 were rejected. This is a case count inside one process, not 62 independent processes.

During evidence capture, the validator separately spawns all 29 declared deliberate attacks twice, producing 58 deliberate-attack process records. Two focused harness processes are also recorded. The complete evidence plan contains 70 ordered process records.

## Contract Changes

- Photo confirmation defaults to `PHOTO_AUTHORITY_UNIMPLEMENTED` and remains blocked without an approved external authority.
- An evaluation-only authority model specifies atomic compare-and-consume semantics. It rejects a second use of the same receipt and a coherently re-digested whole-context forgery absent from trusted authority state.
- The model is explicitly not product implementation and returns `productReady: false`.
- Evidence self-check retains the recorded command arguments but replaces only the value following `--validation-time` with the fresh self-check clock during replay.
- The evidence manifest binds the complete LF-only JSONL digest, exact row count, and ordered record IDs. Reversing rows rejects even if the attacker recomputes the full-log binding.
- Missing or duplicate records and logs, wrong args, wrong row or full-log digests, and arbitrary log content execute as hostile tests and reject.
- Live `git status --porcelain=v1 --untracked-files=all` cleanliness and candidate/evidence mtimes are enforced by the CLI gates.
- The generated Markdown identifies v6, separates immutable f45 from current moving authority 67d2c9e, and preserves the rejected v6 pair as remediation ancestry.

## Expected Evidence

- Candidate artifacts: 8 evaluation files
- Evidence artifacts: `execution-log.jsonl` and `review-evidence.json`
- Structured process records: 70
- Deliberate attack processes: 58
- Focused harness processes: 2
- Hostile cases per focused process: 62
- Unknown-key matrix: 331 closed objects, 2 passes, 662 attacks and rejections per run
- Current normative mutation matrix: 2203 cases, all required to reject
- Product/browser/editor/DB executions: 0

The candidate and evidence SHAs are intentionally not self-embedded. The containing commits and exact review command are reported after commit creation.
