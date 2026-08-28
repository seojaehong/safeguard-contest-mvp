# CI Supply-Chain Pinning Evidence

## Verdict

`PASS_GITHUB_CI_PINNED_ACTIONS_MINIMUM_TOKEN_PERMISSIONS_WITH_EXISTING_SUITE_RED`

The CI workflow now pins every third-party action to a full immutable commit SHA and grants the workflow token only `contents: read`. The pinned actions executed successfully on GitHub. The full repository test step remains RED for five pre-existing frontend and provider-contract tests, so this report does not claim that the complete CI pipeline is green.

## Repository Control

- Source commit: `61ef347a0dd0e1bc6685d1e85ab557027e8bf0f6`
- Workflow: `.github/workflows/ci.yml`
- `actions/checkout` release `v4.2.2`: `11bd71901bbe5b1630ceea73d27597364c9af683`
- `actions/setup-node` release `v4.4.0`: `49933ea5288caeca8642d1e84afbd3f7d6820020`
- Both release-to-SHA mappings were verified against the official repositories with `git ls-remote`.
- Workflow default permission: `contents: read`
- A regression test requires full 40-character SHAs, exact approved SHAs, and release comments.

## Verification

- Focused contract: 1 file / 2 tests PASS.
- TypeScript strict typecheck: PASS.
- PyYAML workflow parse and permission assertion: PASS.
- `git diff --check`: PASS.
- GitHub Actions run: [33193730452](https://github.com/seojaehong/safeguard-contest-mvp/actions/runs/33193730452)
- Pinned checkout step: PASS.
- Pinned setup-node step: PASS.
- GitHub typecheck step: PASS.
- Full tests: 3,098 passed, 5 failed, 26 skipped across 267 files.
- Build: skipped after the test failure.

The observed RED groups are the frontend evidence digest, dispatch spacing residuals, Knowledge/Ops API mobile overflow, and two Work24 fallback-message contracts. None reads or depends on `.github/workflows/ci.yml` or `tests/ci-workflow-security.test.ts`; the immutable action execution itself succeeded.

## Boundary

This evidence remediates only `supply-chain.mutable-ci-actions` from immutable scan baseline `c5175a50-038b-402e-9fd3-6af9eec6582b` targeting `c9e24f31b7c9e9db5896bd221401bcef3e35ed24`. It does not rewrite that baseline, close other findings, claim complete repository CI success, or claim security completion.

No DB, provider dispatch, Share session, vector/embedding, wiki, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`. A production runtime marker is not required for this repository-only CI control.
