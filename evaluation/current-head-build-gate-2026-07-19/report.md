# Current HEAD Build Gate

Date: 2026-07-19
Source HEAD: `b4490919e91fb2810e7846a2260e67642acc6ce5`

## Command

```powershell
npm.cmd run build
```

## Result

PASS.

Build output summary:

- Next.js: 15.5.20
- Optimized production build compiled successfully.
- Static pages generated: 28 / 28
- `/share/[sessionId]`: dynamic route present
- `/workspace`: dynamic route present
- `/knowledge`: dynamic route present
- `/ontology`: dynamic route present
- `/api/workflow/dispatch`: dynamic route present
- `/api/share-sessions/[sessionId]`: dynamic route present

## Notes

This build gate was run after:

- `evaluation/northstar-integrated-focused-gate-2026-07-19/report.md`
- `evaluation/provider-dispatch-live-boundary-current-2026-07-19/report.md`
- `evaluation/document-quality-grounding-current-gate-2026-07-19/report.md`

It proves the latest source tree builds locally. It does not replace GitHub Actions or live deployment proof.
