# Supabase Drop Readiness Check

- generatedAt: 2026-06-10
- target: SafeClaw Supabase migration from `labor_money` to `yellow-envelope-law`
- verdict: blocked_after_vercel_cutover

## Conclusion

Do not drop the existing `labor_money` Supabase project yet.

The data-level clone is reported as complete, including `admin_users`, and server1 verified that Vercel Production Supabase env values now point to `yellow-envelope-law` (`mewqgevgdgghhatqtuos`). The remaining blockers are local Codex-machine env cleanup and an authenticated end-to-end smoke.

## Evidence Checked

| Area | Result | Note |
| --- | --- | --- |
| Data parity | pass | User-provided final check says 15/15 tables and 11,020 rows match. |
| Current local Supabase ref | blocked | Codex-machine local live check still points to `pleyuknjnprsckssxvrh`; server1 repo has no `.env.local`, so this is a Codex local cleanup issue. |
| Historical project mapping | blocked | `evaluation/supabase-migration-check/supabase-migration-auth-blocked.json` maps `pleyuknjnprsckssxvrh` to `labor_money`. |
| App code dependency on `admin_users` | pass | Current app routes use Supabase Auth `auth.getUser(token)`, not an `admin_users` query. |
| `admin_users` availability | pass | Latest user verification says `yellow-envelope-law` now has 1 publisher row. |
| Vercel Production env | pass | Server1 decoded JWT payloads and confirmed all 4 Supabase env values point to `mewqgevgdgghhatqtuos` (`yellow-envelope-law`). |
| Vercel Preview env | not required | Preview did not have Supabase URL keys originally; Production is the contest runtime. |

## Why Drop Is Blocked

The old Supabase can be dropped only after every active runtime points to `yellow-envelope-law` and a live authenticated smoke passes.

Right now, Vercel Production is verified as cut over, but this Codex machine still has local evidence pointing to the old project ref:

- old ref: `pleyuknjnprsckssxvrh`
- old project name from prior repo evidence: `labor_money`

If `labor_money` is dropped before local env cleanup and authenticated smoke, local admin workflows may fail and rollback proof will be weaker.

## Required Gates Before Drop

1. Update local `.env.local` Supabase values to the `yellow-envelope-law` project.
2. Run the live table check again and confirm the active project ref is `mewqgevgdgghhatqtuos`, not `pleyuknjnprsckssxvrh`.
3. Run an authenticated smoke against the deployed app:
   - save workpack
   - reopen workpack
   - list archive
   - save dispatch logs
   - search safety reference catalog
4. Monitor Production for 24 hours.
5. Keep `labor_money` read-only or paused during that rollback window before final deletion.

## Safe Current Decision

`yellow-envelope-law` appears data-complete and Vercel Production is reported as fully cut over. `labor_money` should still not be dropped until this Codex machine env is cleaned up, an authenticated smoke passes, and the 24-hour observation window is complete.
