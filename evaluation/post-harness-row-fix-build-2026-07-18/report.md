# Post Harness Row Fix Build Gate (2026-07-18)

## Verdict

PASS.

## Command

```powershell
npm.cmd run build
```

## Result

- Next.js production build completed successfully.
- Static generation: 28/28 pages.
- `/share/[sessionId]` is present in the production route manifest.
- `/api/share-sessions/[sessionId]` is present in the production route manifest.
- `/api/ask` is present in the production route manifest.

## Notes

This build gate was run after commit `37417548` (`fix: keep harness rows with parent evidence`). Live harness quality must still be rerun after the deployment containing that commit is available.
