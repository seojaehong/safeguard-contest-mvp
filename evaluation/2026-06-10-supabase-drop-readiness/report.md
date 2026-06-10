# Supabase Drop Readiness Check

- generatedAt: 2026-06-10
- target: SafeClaw Supabase migration from `labor_money` to `yellow-envelope-law`
- verdict: blocked_after_vercel_cutover

## Conclusion

Do not drop the existing `labor_money` Supabase project yet.

The data-level clone is reported as complete, including `admin_users`, server1 verified that Vercel Production Supabase env values now point to `yellow-envelope-law` (`mewqgevgdgghhatqtuos`), and the Codex-machine `.env.local` cutover now also points to `yellow-envelope-law`. The remaining blockers are an authenticated end-to-end smoke and the 24-hour observation window.

## Evidence Checked

| Area | Result | Note |
| --- | --- | --- |
| Data parity | pass | User-provided final check says 15/15 tables and 11,020 rows match. |
| Current local Supabase ref | pass | Codex-machine `.env.local` now resolves all 4 Supabase values to `mewqgevgdgghhatqtuos`; old ref `pleyuknjnprsckssxvrh` is absent. |
| Historical project mapping | blocked | `evaluation/supabase-migration-check/supabase-migration-auth-blocked.json` maps `pleyuknjnprsckssxvrh` to `labor_money`. |
| App code dependency on `admin_users` | pass | Current app routes use Supabase Auth `auth.getUser(token)`, not an `admin_users` query. |
| `admin_users` availability | pass | Latest user verification says `yellow-envelope-law` now has 1 publisher row. |
| Vercel Production env | pass | Server1 decoded JWT payloads and confirmed all 4 Supabase env values point to `mewqgevgdgghhatqtuos` (`yellow-envelope-law`). |
| Vercel Preview env | not required | Preview did not have Supabase URL keys originally; Production is the contest runtime. |
| Local live table check | pass | 15 tables are reachable from the Codex machine through the new project ref. |

## Why Drop Is Blocked

The old Supabase can be dropped only after every active runtime points to `yellow-envelope-law` and a live authenticated smoke passes.

Vercel Production and this Codex machine are now verified as cut over. The old ref is retained only as historical evidence:

- old ref: `pleyuknjnprsckssxvrh`
- old project name from prior repo evidence: `labor_money`

If `labor_money` is dropped before authenticated smoke and the observation window, rollback proof will be weaker.

## Required Gates Before Drop

1. Run an authenticated smoke against the deployed app:
   - save workpack
   - reopen workpack
   - list archive
   - save dispatch logs
   - search safety reference catalog
2. Monitor Production for 24 hours.
3. Keep `labor_money` read-only or paused during that rollback window before final deletion.

## Safe Current Decision

`yellow-envelope-law` appears data-complete, Vercel Production is reported as fully cut over, and this Codex machine now points to the new project. `labor_money` should still not be dropped until an authenticated smoke passes and the 24-hour observation window is complete.

## Latest Local Cutover Evidence

- `evaluation/2026-06-10-local-env-cutover-check/report.md`
- `evaluation/2026-06-10-local-env-cutover-check/local-env-cutover-check.json`
