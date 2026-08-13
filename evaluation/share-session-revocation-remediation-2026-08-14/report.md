# Share session revocation remediation

## Verdict

`PASS_CURRENT_SOURCE_OWNER_SHARE_SESSION_REVOCATION_LIVE_PENDING`

Current source commit `809f1feb` adds the missing operator revocation path for a saved Share session without changing the existing schema. The authenticated manager action uses `DELETE /api/workpacks/[id]/share-sessions?sessionId=[uuid]`, reloads the owned workpack context, and scopes the update by session, workpack, organization, and site before persisting `status=revoked`. The returned `updated_at` value is the durable audit timestamp.

The workspace Share cockpit exposes `공유 세션 중지` only for an active authenticated session and asks for confirmation before invoking the endpoint. Revoked sessions are excluded by the existing active-session policy and public saved-session loader.

## Verification

- Focused route, client, and UI contract: 3 files / 92 tests PASS.
- Workspace Share desktop/mobile browser geometry: 1 file / 4 tests PASS.
- Strict TypeScript typecheck: PASS.
- Next.js 15.5.22 production build: PASS, 28 static pages.
- Diff check: PASS.

## Boundaries

- Production marker was still `f10210a3` when this report was created, so live deployment of `809f1feb` is pending.
- No production Share session was created or revoked for evidence, and no database mutation occurred.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
- Share storage/creation, provider dispatch, RLS, vector, wiki, and KOSHA registry operations remain approval-gated.
- The immutable scan finding remains visible until a fresh post-remediation security scan reclassifies it.
