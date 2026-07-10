# C7 Module Shell Hardening QA

## Scope

- Day/Night chrome repaint를 rail/top-nav theme-keyed remount와 명시적 theme surface로 고정했다.
- worker rows, document controls, badges, labels의 Day/Night 대비와 8px 이하 surface radius를 정리했다.
- 900px breakpoint, 모바일 44px touch target, skip link/main landmark, bounded overflow를 검증했다.

## Verification

- `npm.cmd test -- tests/product-module-shell.test.ts`: 3/3 passed.
- `npm.cmd test -- tests/module-shell-design-regression.test.ts`: 3/3 passed.
- `npm.cmd test -- tests/documents-editor-layout.test.ts`: 3/3 passed.
- `npm.cmd run typecheck`: passed.
- Browser matrix: `/home`, `/documents`, `/workers`, `/evidence`, `/knowledge`, `/settings`, `/reports`, `/tbm`, `/archive`, `/ops/api`, `/ask`, `/dispatch`; desktop/mobile, Day/Night.
- Screenshot pixel audit: desktop Documents Night, desktop TBM Day, mobile TBM Night, mobile TBM Day의 rail/nav/main surface를 두 연속 frame에서 확인했다.

## Artifacts

- `output/playwright/2026-07-10/module-shell-hardening/`: 16 PNG files.
- 직접 확인 결과: Documents Night rail text/logo, desktop/mobile TBM Day/Night chrome, workers Day/Night rows 모두 stale backplate 없이 표시됐다.
