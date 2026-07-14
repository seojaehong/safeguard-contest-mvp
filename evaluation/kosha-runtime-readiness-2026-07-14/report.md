# KOSHA runtime readiness fail-closed diagnosis

## Scope

- Authoritative base: `a5ed356c28ebe5f7e19aee2bf65f9c8313dcc157`
- Branch: `fix/kosha-runtime-readiness-20260714`
- Database schema/data mutation: none
- Vercel environment mutation: none
- Remote unverified KOSHA fallback: not enabled

## Live reproduction

On 2026-07-14, the production status endpoint returned HTTP 200 with `status=ready`, `items=9920`, `technicalTotal=1040`, and `catalogSearchOk=true`. In the same deployment, searches for `q=전기` returned zero technical-support regulations and zero technical guidelines. The response excluded 9 regulation candidates and 12 guideline candidates because the local corpus was unconfigured.

## Root cause

1. `getSafetyReferenceStats()` checks Supabase counts, the 237/803 technical split, and a remote catalog sample. It does not call `loadKoshaGuideCorpus()`.
2. Runtime search does call `loadKoshaGuideCorpus()` and fails closed when `KOSHA_GUIDE_CORPUS_DIR` is absent or invalid. The production `unconfigured` message proves the variable resolved to no value; an inaccessible configured path would produce `blocked` with `load:root`.
3. No deployable corpus snapshot is tracked in the repository. The loader requires a directory containing `current.json` plus the manifest-declared snapshot files.
4. The available local external snapshots are about 79.6 MB and their existing evaluation evidence says `launchReady=false`. They were not copied or bundled because that would weaken the verified lifecycle gate.

## Fix

The status route now loads the same local corpus gate used by search. Every non-ready combination returns HTTP 503 with top-level `status=degraded` and `searchReady=false`, including when both the catalog and local corpus are unconfigured. It returns HTTP 200/ready only when `catalog.ok && localCorpus.status === "ready"`. The underlying `configured` and sanitized `localCorpus.status` fields preserve the cause without exposing absolute corpus paths.

## Required runtime shape

- Variable name: `KOSHA_GUIDE_CORPUS_DIR`
- Shape: an absolute runtime-readable directory, or a repository-relative directory resolved from the function working directory
- Required contents: `current.json` and the exact manifest/snapshot files referenced by it
- Gate: the snapshot must pass the existing hash, identity, count, reviewed-OCR binding, lifecycle, and path-safety checks before deployment

No Vercel environment value was read, printed, changed, or committed.

## Verification

- Focused KOSHA command: `npm.cmd test -- tests/safety-reference-status-route.test.ts tests/kosha-grounding-fail-closed.test.ts tests/kosha-guide-offline-harness.test.ts tests/kosha-guide-offline-harness-expanded.test.ts`
- Focused KOSHA result: 4 files, 44 tests passed, exit 0; log: `evaluation/kosha-runtime-readiness-2026-07-14/focused-tests.log`
- TypeScript command: `npm.cmd run typecheck`; exit 0; log: `evaluation/kosha-runtime-readiness-2026-07-14/typecheck.log`
- Production build command: `npm.cmd run build`; exit 0; log: `evaluation/kosha-runtime-readiness-2026-07-14/build.log`
- Full suite: not rerun for this remediation; no full-suite pass/fail count is claimed

## Runtime boundary

This commit changes repository behavior only. It does not deploy the branch, add a corpus artifact, or set Vercel environment configuration. Until a verified snapshot is packaged and configured, a deployment containing this fix should report 503/degraded instead of claiming search readiness. The current production deployment remains unchanged.
