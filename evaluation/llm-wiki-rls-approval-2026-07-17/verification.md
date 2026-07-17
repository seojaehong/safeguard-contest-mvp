# Verification Log

Date: 2026-07-17
Audited source: `de4103db20be6ca2be738748143fb6a6fbd26693`
HOLD remediation base: `a4c4004acccdccfb2f8f2a328d3cc63fe7da71a7`
Packet commit: resolve after commit with
`git log -1 --format=%H -- evaluation/llm-wiki-rls-approval-2026-07-17/report.json`.

## Commands

1. `npm.cmd test -- --run tests/supabase-tenant-isolation-harness.test.ts tests/llm-wiki-rls-approval-packet.test.ts`
   - Final result after HOLD correction: 2 files, 31 tests passed, 0 failed.
2. `npm.cmd run typecheck`
   - Initial run was blocked because declared local dependencies `pdf-lib` and
     `@pdf-lib/fontkit` were absent from `node_modules`.
   - `npm.cmd install --ignore-scripts --no-audit --no-fund` restored declared
     dependencies without changing `package.json` or `package-lock.json`.
   - Final result: strict TypeScript check passed.
3. `node scripts/supabase_tenant_isolation_harness.mjs`
   - Result: exit 1, RED, `executionStatus=not_executed`,
     `launchProven=false`, 224 manifest scenarios, 0 requests.
4. `git diff --check`
   - Result: no whitespace errors.
5. `git diff -- supabase/migrations`
   - Result: empty; no migration was added or edited.

## Evidence classification

- Network-free contract test: executed.
- Strict typecheck: executed.
- Supabase connection: not executed.
- Tenant A-to-B live assertions: 0.
- Tenant B-to-A live assertions: 0.
- Storage live assertions: 0.
- Database/schema/data/publication mutation: none.

No fake adapter result is accepted as live tenant-isolation proof.

## TDD correction evidence

- P1 RED: caller-supplied `live-reviewed` plus fake hooks produced `ok=true`.
- P1 GREEN: the same request is blocked before hooks; `launchProven=false`.
- P2 RED: positive IDs retained cross-tenant direction text.
- P2 GREEN: positive IDs use only `a_to_a` or `b_to_b`.
- P2 RED: report had one short `baseCommit` and no packet identity semantics.
- P2 GREEN: full audited/remediation SHAs and nullable containing-commit semantics
  are contract-tested.
