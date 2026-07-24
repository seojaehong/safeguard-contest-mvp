# Share Recipient Long-Content Fixture Gate

Checked at: `2026-07-24T17:46:07.845Z`

Base URL: `http://127.0.0.1:3082`

Source HEAD: `78f341e0529f9455632f7b48e3d46281a0dc3313`

Production commit: `unknown`

Verdict: `PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_LONG_CONTENT_FIXTURE_EXACT_SAVED_MISSING`

Exact saved/generated session: `MISSING_EVIDENCE`

## Scope

This gate loads the current-source local production recipient page and replaces only the Share-session GET response with a route-controlled long-content fixture. Non-GET Share-session requests are blocked. It measures layout resilience without creating a Share session, writing to the DB, confirming receipt, or dispatching a provider message.

Route split alone accepted as the fix: `false`

Accepted structure: first-viewport confirmation cockpit plus desktop multi-region workbench plus bounded internal task/message preview and collapsed document drilldown

| Theme | Viewport | Overall | Page ratio | Root width ratio | Root height ratio | X regions | Confirm bottom | Task contained | Contained previews | Collapsed docs | Outside cards | OverflowX |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| day | desktop-short-1440x723 | PASS_SCOPED | 1.33 | 0.84 | 0.99 | 2 | 529 | true | 4 | 3 | 0 | false |
| day | desktop-1440x900 | PASS_SCOPED | 1.07 | 0.84 | 0.79 | 2 | 529 | true | 4 | 3 | 0 | false |
| day | mobile-390x723 | PASS_SCOPED | 2.07 | 1 | 1.4 | 1 | 707 | true | 4 | 3 | 0 | false |
| night | desktop-short-1440x723 | PASS_SCOPED | 1.33 | 0.84 | 0.99 | 2 | 529 | true | 4 | 3 | 0 | false |
| night | desktop-1440x900 | PASS_SCOPED | 1.07 | 0.84 | 0.79 | 2 | 529 | true | 4 | 3 | 0 | false |
| night | mobile-390x723 | PASS_SCOPED | 2.07 | 1 | 1.4 | 1 | 707 | true | 4 | 3 | 0 | false |

## Fixture Profile

- Documents: 3
- Recipients/languages: 4
- Question characters: 599
- Recipient-message characters: 2069
- Document body characters: 1248, 1244, 1246

## Evidence Boundary

- Allowed: The current-source local production recipient UI contains a route-controlled maximum-content fixture in the expected desktop/mobile workbench geometry.
- Forbidden: A concrete saved/generated production share session was reproduced or persisted.
- Next exact proof: Provide an existing production /share/[sessionId]?workerId=... URL or approve the DB-backed share-session creation flow.
- DB mutation performed: `false`
- Share session created: `false`
- Provider dispatch claimed: `false`
