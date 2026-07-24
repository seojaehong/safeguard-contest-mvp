# Share Recipient Long-Content Fixture Gate

Checked at: `2026-07-24T17:26:27.619Z`

Base URL: `https://www.safeclaw.kr`

Source HEAD: `421024036b18929354e2399f1342154db682c82b`

Production commit: `421024036b18929354e2399f1342154db682c82b`

Verdict: `PASS_LIVE_PRODUCTION_LONG_CONTENT_FIXTURE_EXACT_SAVED_MISSING`

Exact saved/generated session: `MISSING_EVIDENCE`

## Scope

This gate loads the deployed recipient page and replaces only the Share-session GET response with a route-controlled long-content fixture. Non-GET Share-session requests are blocked. It measures layout resilience without creating a Share session, writing to the DB, confirming receipt, or dispatching a provider message.

| Theme | Viewport | Overall | Page ratio | Root width ratio | Root height ratio | X regions | Confirm bottom | Contained previews | Collapsed docs | Outside cards | OverflowX |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| day | desktop-short-1440x723 | PASS_SCOPED | 1.55 | 0.84 | 1.21 | 2 | 529 | 4 | 3 | 0 | false |
| day | desktop-1440x900 | PASS_SCOPED | 1.25 | 0.84 | 0.97 | 2 | 529 | 4 | 3 | 0 | false |
| day | mobile-390x723 | PASS_SCOPED | 2.87 | 1 | 2.2 | 1 | 707 | 4 | 3 | 0 | false |
| night | desktop-short-1440x723 | PASS_SCOPED | 1.55 | 0.84 | 1.21 | 2 | 529 | 4 | 3 | 0 | false |
| night | desktop-1440x900 | PASS_SCOPED | 1.25 | 0.84 | 0.97 | 2 | 529 | 4 | 3 | 0 | false |
| night | mobile-390x723 | PASS_SCOPED | 2.87 | 1 | 2.2 | 1 | 707 | 4 | 3 | 0 | false |

## Fixture Profile

- Documents: 3
- Recipients/languages: 4
- Question characters: 599
- Recipient-message characters: 2069
- Document body characters: 1248, 1244, 1246

## Evidence Boundary

- Allowed: The deployed recipient UI contains a route-controlled maximum-content fixture in the expected desktop/mobile workbench geometry.
- Forbidden: A concrete saved/generated production share session was reproduced or persisted.
- Next exact proof: Provide an existing production /share/[sessionId]?workerId=... URL or approve the DB-backed share-session creation flow.
- DB mutation performed: `false`
- Share session created: `false`
- Provider dispatch claimed: `false`
