# Post Harness Control Fix Build Gate (2026-07-18)

## Verdict

PASS.

## Command

```powershell
npm.cmd run build
```

## Result

- Next.js production build completed successfully.
- Static generation: 28/28 pages.
- `/api/ask` is present in the production route manifest.
- `/share/[sessionId]` is present in the production route manifest.

## Notes

This build gate was run after commit `5c4604ba` (`fix: normalize harness control surfaces`). Live harness quality must still be rerun after the deployment containing this commit is available.
