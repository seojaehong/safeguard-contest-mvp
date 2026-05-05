# SafeClaw SaaS v1 Shell / Brand Alignment Audit

## Scope

- Reviewed and patched only product shell, navigation, landing/prototype copy, CSS, and this evaluation note.
- Did not touch `/workspace` engine logic, API orchestration, document generation, or Supabase data paths.
- Used `docs/safeclaw_brand_design_guide.md` as the available SafeClaw guide source.

## Findings

- No dedicated logo image asset was found under `public/`; the app currently relies on text/CSS marks.
- The guide requires a black square brand mark with yellow `SC`. The landing mark was circular, and the module shell mark used a yellow square with black text.
- The operational rail used labels that drifted from the real product menu shown on the landing page: `문서팩`, `근거 라이브러리`, `작업자·교육`, `현장 전파`, `지식베이스`, `연결 상태`, `운영 설정`.
- The prototype map component contained implementation-facing labels such as component names and a legacy `SafeGuard` reference. `/prototype` currently redirects to `/workspace`, but the component was still cleaned so it does not leak if re-enabled.
- The module shell background still used a decorative grid gradient. The guide says gradients are not for core product surfaces.

## Patch Summary

- Aligned the module rail labels to the product menu: `대시보드`, `작업공간`, `문서`, `근거`, `작업자`, `전파`, `이력`, `지식 DB`, `API 상태`, `설정`, with `TBM 회의` and `작업자 안내` as support routes.
- Updated landing and module `SC` marks to the guide-aligned black square with yellow lettering.
- Removed the module shell background grid gradient so operational routes read as a flatter field OS surface.
- Cleaned prototype-map copy away from implementation names and legacy SafeGuard wording.

## Verification

- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: compiled successfully, then failed during Next page-data collection for `/api/weather` with `Cannot find module for page: /api/weather/route`.
- Local dev server smoke: `http://127.0.0.1:3000/` returned HTTP 200.
- Screenshots captured:
  - `evaluation/design-refactor/screenshots-2026-05-05/landing-desktop.png`
  - `evaluation/design-refactor/screenshots-2026-05-05/documents-desktop.png`
  - `evaluation/design-refactor/screenshots-2026-05-05/api-mobile.png`
- Dev server log: `evaluation/design-refactor/shell-brand-dev-server-2026-05-05.log`.

## Remaining Design Blockers

- No source logo/brand image asset is available in the repo, so this pass can only align CSS/text marks against the guide.
- The landing page intentionally remains a stronger dark marketing/product entry page; a later pass should decide whether it must follow the same no-gradient rule as core operational surfaces.
- Legacy CSS is still concentrated in `app/globals.css`; this patch narrows the visible mismatch but does not split the stylesheet into maintainable layers.
- Production build remains blocked by the existing `/api/weather` page-data collection issue, outside this shell-only patch scope.
