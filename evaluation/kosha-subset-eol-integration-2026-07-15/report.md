# KOSHA subset checkout byte-identity integration

## Scope

- Integrated KOSHA subset series: `e2020ca -> b5dbeb0`.
- Windows checkout initially converted the tracked rejection ledger from LF to CRLF.
- The conversion changed `failures.jsonl` from the manifest hash `9ec1feef...c7fe` to `98d9813c...5620` and correctly caused the corpus loader to fail closed with `hash:outputs`.

## Remediation

- Added a repository attribute that forces every immutable KOSHA subset JSONL artifact to use LF:
  `evaluation/kosha-verified-subset-*/subset/**/*.jsonl text eol=lf`.
- No corpus contents, readiness decision, database record, environment variable, migration, or Supabase data were changed.

## Clean-checkout verification

- Verification worktree: `kosha-eol-verification-20260715` at `1e7b9eb`.
- Git EOL state: `i/lf w/lf attr/text eol=lf`.
- Actual rejection-ledger SHA-256: `9ec1feefe9306f65529c3221382a1f7847f9a167c7a35a806504727b8384c7fe`.
- KOSHA focused suite: 11 files, 196 tests passed.
- The verified subset remains intentionally blocked: accepted 0, rejected 234, `launch_ready=false`.

## Honest boundary

The authoritative worktree was already checked out before the attribute existed, so its existing working copy retained CRLF. The clean verification worktree proves the behavior that CI, Vercel, and every fresh deployment checkout receive.
