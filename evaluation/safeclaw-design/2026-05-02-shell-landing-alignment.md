# SafeClaw Shell / Landing Alignment

Date: 2026-05-02

## Scope

- Applied the frozen SafeClaw handoff direction to the public landing surface.
- Removed customer-facing A/B, prototype, screen-count style wording from the product-facing surfaces touched in this pass.
- Tightened the shell and product map language so it reads like a product, not a design review canvas.
- Preserved the existing `/workspace` engine and downstream product routes.

## Changed Surfaces

- `/`: public SafeClaw landing.
- `/prototype`: internal product structure map, now framed as product IA rather than prototype screens.
- Shared product module shell used by `/documents`, `/evidence`, `/workers`, `/dispatch`, `/archive`, `/knowledge`, `/ops/api`, `/settings`.

## Copy Decisions

- Brand lockup: `safeclaw/os`.
- Hero headline: `오늘 작업을 / 안전 문서팩으로 / 준비합니다.`
- Primary CTA: `작업 시작`.
- Product navigation: `대시보드`, `작업공간`, `문서`, `근거`, `작업자`, `전파`, `이력`, `지식DB`, `API`, `설정`.
- Status labels: `바로 사용`, `부분 연결`, `연결 예정`.

## Visual Fixes

- Reduced landing topbar and hero vertical pressure.
- Prevented hero headline clipping and horizontal overflow.
- Rebalanced the product map rail from wide prototype rail to a 232px product IA rail.
- Reduced oversized product map headline scale and topbar height.
- Added `safeclaw/os` module-shell lockup styling.

## Verification

- `npm.cmd run build`: passed.
- `npm.cmd run typecheck`: passed after build generated `.next/types`.
- Local HTTP smoke on port 3077:
  - `/`: 200.
  - `/prototype`: 200.
  - `/documents`: 200.
- Chrome/Playwright visual smoke using installed Chrome:
  - Desktop 1440x1100: `/`, `/prototype`, `/documents` had `overflow=0`, required copy present, no banned visible wording.
  - Mobile 390x900: `/`, `/prototype` had `overflow=0`, no banned visible wording.

## Notes

- Playwright bundled browser was not installed, so the visual smoke used the local Chrome executable at `C:/Program Files/Google/Chrome/Application/chrome.exe`.
- The current pass is a shell/landing/product-copy alignment pass. Full pixel-perfect migration of all 14 product screens should continue after the designer finalizes the route-by-route screen spec.
