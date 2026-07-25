# Live Share Recipient Viewport IA Geometry

Checked at: `2026-07-25T06:35:37.366Z`

Base URL: `https://www.safeclaw.kr`

Source HEAD: `c7621c9dcbd04443c81456d248df73790de64490`

Live commit: `c7621c9dcbd04443c81456d248df73790de64490`

Expected live commit: `c7621c9dcbd04443c81456d248df73790de64490`

Verdict: `PASS_LIVE_PRODUCTION_SCOPED_INVITED_FIXTURE_SHARE_GEOMETRY_EXACT_SAVED_MISSING`

## Boundary

- This measures live production page assets from Vercel after PR #90 reached production.
- The `/api/share-sessions` read is fulfilled with the bounded invited-worker fixture from the PR #90 browser contract.
- No confirmation click, provider dispatch, DB write, exact share creation, or saved share-session mutation was performed.
- Exact saved user `/share/[sessionId]` evidence remains `MISSING_EVIDENCE`.
- This scoped fixture proof does not close the exact saved user-session complaint.

## Geometry

| Viewport | Verdict | Root width | Width ratio | X regions | Confirm bottom | Root/viewport height | Overflow | Sticky overlap | Mutations |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| desktop-1440x723 | PASS_SCOPED_INVITED_FIXTURE_SHARE_GEOMETRY | 1204 | 0.84 | 2 | 529 | 713/723 | false | 0 | 0 |
| desktop-1024x768 | PASS_SCOPED_INVITED_FIXTURE_SHARE_GEOMETRY | 976 | 0.95 | 2 | 529 | 713/768 | false | 0 | 0 |
| mobile-390x723 | PASS_SCOPED_INVITED_FIXTURE_SHARE_GEOMETRY | 390 | 1 | 0 | 707 | 1010/723 | false | 0 | 0 |

## Screenshots

- desktop-1440x723: `evaluation/live-share-recipient-viewport-ia-2026-07-25/screenshots/share-recipient-fixture-desktop-1440x723.png`
- desktop-1024x768: `evaluation/live-share-recipient-viewport-ia-2026-07-25/screenshots/share-recipient-fixture-desktop-1024x768.png`
- mobile-390x723: `evaluation/live-share-recipient-viewport-ia-2026-07-25/screenshots/share-recipient-fixture-mobile-390x723.png`
