# Supabase Drop Readiness Check

- generatedAt: 2026-06-10
- target: SafeClaw Supabase migration from `labor_money` to `yellow-envelope-law`
- verdict: blocked

## Conclusion

Do not drop the existing `labor_money` Supabase project yet.

The data-level clone is reported as complete, including `admin_users`, but the runtime cutover is not fully proven from this workspace. The local app environment still resolves to project ref `pleyuknjnprsckssxvrh`, which prior evidence in this repo identifies as `labor_money`.

## Evidence Checked

| Area | Result | Note |
| --- | --- | --- |
| Data parity | pass | User-provided final check says 15/15 tables and 11,020 rows match. |
| Current local Supabase ref | blocked | Current local live check points to `pleyuknjnprsckssxvrh`. |
| Historical project mapping | blocked | `evaluation/supabase-migration-check/supabase-migration-auth-blocked.json` maps `pleyuknjnprsckssxvrh` to `labor_money`. |
| App code dependency on `admin_users` | pass | Current app routes use Supabase Auth `auth.getUser(token)`, not an `admin_users` query. |
| `admin_users` availability | pass | Latest user verification says `yellow-envelope-law` now has 1 publisher row. |
| Vercel Production env | unverified | `vercel env ls` and `vercel env pull` failed because no local Vercel credentials/token were available. |

## Why Drop Is Blocked

The old Supabase can be dropped only after every runtime points to `yellow-envelope-law`.

Right now, this workspace has direct evidence that at least the local runtime still points to the old project ref:

- old ref: `pleyuknjnprsckssxvrh`
- old project name from prior repo evidence: `labor_money`

If `labor_money` is dropped before `.env.local`, Vercel Production, Preview, and any automation secrets are repointed, the app may lose archive, workpack, worker, education record, dispatch log, and safety reference DB access.

## Required Gates Before Drop

1. Update local `.env.local` Supabase values to the `yellow-envelope-law` project.
2. Update Vercel Production and Preview env values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - any auth smoke variables that depend on the old project
3. Redeploy Vercel after env update.
4. Run the live table check again and confirm the active project ref is the new `yellow-envelope-law` ref, not `pleyuknjnprsckssxvrh`.
5. Run an authenticated smoke against the deployed app:
   - save workpack
   - reopen workpack
   - list archive
   - save dispatch logs
   - search safety reference catalog
6. Keep `labor_money` read-only or paused for a short rollback window before final deletion.

## Safe Current Decision

`yellow-envelope-law` appears data-complete, but `labor_money` should not be dropped yet because runtime cutover is not proven. The next safe step is env cutover and post-deploy smoke, not deletion.
