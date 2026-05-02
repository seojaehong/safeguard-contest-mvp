# SafeClaw route-function mapping pass

## Scope

This pass moves the product routes one step deeper from a prototype gallery into a product console shell. The stable `/workspace` engine was not changed. Instead, the connected feature routes now share a left product rail, a HUD-style status bar, route-specific product copy, and active navigation state.

## Routes aligned

| Route | Product role | Status |
| --- | --- | --- |
| `/home` | Daily operating dashboard | shell mapped |
| `/workspace` | Work input engine | preserved |
| `/documents` | Workpack editing and export | shell mapped |
| `/evidence` | Legal, KOSHA, accident, and knowledge evidence | shell mapped |
| `/workers` | Worker and education readiness | shell mapped |
| `/dispatch` | Email/SMS field broadcast | shell mapped |
| `/archive` | Workpack and dispatch history | shell mapped |
| `/knowledge` | Safety knowledge database | shell mapped |
| `/ops/api` | API and ingestion operations | shell mapped |
| `/settings` | Organization, site, and channel settings | shell mapped |
| `/worker` | Worker mobile candidate | shell mapped as field module |
| `/tbm` | TBM fullscreen candidate | shell mapped as field module |

## Product copy cleanup

- User-facing labels now use actual product modules instead of screen numbers.
- `A/B`, `보수안/과감안`, `16 screens`, and prototype wording were kept out of the checked operating routes.
- Menu groups are now `운영`, `실행`, and `시스템`.

## Verification

### Static checks

- `npm.cmd run build`: pass
- `npm.cmd run typecheck`: pass

### Local route smoke

Started `next start` on local port `3077` and checked the following routes with `Invoke-WebRequest`.

| Route | HTTP |
| --- | --- |
| `/` | 200 |
| `/documents` | 200 |
| `/evidence` | 200 |
| `/workers` | 200 |
| `/dispatch` | 200 |
| `/archive` | 200 |
| `/knowledge` | 200 |
| `/ops/api` | 200 |
| `/settings` | 200 |
| `/home` | 200 |
| `/worker` | 200 |
| `/tbm` | 200 |
| `/workspace` | 200 |

### Product-copy scan

Checked `/`, `/documents`, `/evidence`, `/workers`, `/dispatch`, `/archive`, `/knowledge`, `/ops/api`, `/settings`, `/home`, `/worker`, and `/tbm` for:

- `16 screens`
- `SCREENS`
- `A안`
- `B안`
- `보수안`
- `과감안`
- `프로토타입`

Result: no user-facing hits in checked routes.

### Smoke note

`npm.cmd run smoke:ui-local` timed out waiting for the previous `LLM 위키·지식 DB 확인` text. The existing snapshot was not updated. This route mapping pass therefore uses static checks plus explicit HTTP route smoke as the closing evidence.

## Remaining work

- Full pixel-perfect alignment per designer screen still needs a dedicated visual pass.
- The current pass connects routes and shell structure; it does not replace every inner feature component with the final designer layout.
- `/worker`, `/tbm`, `/settings`, and `/home` still need deeper real-function implementation beyond product shell alignment.
