# SafeClaw C7 Batch 1 Module Shell QA

## Scope

- Shared product shell: `components/SafeClawModuleShell.tsx`
- Module navigation contract: `lib/module-navigation.ts`
- Workspace-consistent shell styling: `app/globals.css`
- Focused browser matrix: `tests/product-module-shell.test.ts`
- Root landing page and page-specific business logic were not changed.

## Automated Verification

Command:

```powershell
npm.cmd test -- tests/product-module-shell.test.ts --reporter=verbose
```

Result: 1 file passed, 2 tests passed.

- Desktop matrix: 1440 x 900
- Mobile matrix: 390 x 844
- Routes: `/home`, `/documents`, `/workers`, `/evidence`, `/knowledge`, `/settings`
- Contract checks: one `h1`, one principal command, no viewport overflow, no shell-region overlap, card radius at or below 8px, shell/rail/card text contrast, Day/Night state change, mobile menu open/close, and one-column mobile knowledge status cards.
- Harness isolation: dedicated `.next-c7-module-shell/<pid>` output, per-route retry, server diagnostics on failure, per-test 90-second cap, and process-tree/dist cleanup.

Type verification:

```powershell
npm.cmd run typecheck
```

## Screenshots

Desktop:

- `output/playwright/c7-batch1-module-shell/desktop-home.png`
- `output/playwright/c7-batch1-module-shell/desktop-documents.png`
- `output/playwright/c7-batch1-module-shell/desktop-workers.png`
- `output/playwright/c7-batch1-module-shell/desktop-evidence.png`
- `output/playwright/c7-batch1-module-shell/desktop-knowledge.png`
- `output/playwright/c7-batch1-module-shell/desktop-settings.png`

Mobile:

- `output/playwright/c7-batch1-module-shell/mobile-home.png`
- `output/playwright/c7-batch1-module-shell/mobile-documents.png`
- `output/playwright/c7-batch1-module-shell/mobile-workers.png`
- `output/playwright/c7-batch1-module-shell/mobile-evidence.png`
- `output/playwright/c7-batch1-module-shell/mobile-knowledge.png`
- `output/playwright/c7-batch1-module-shell/mobile-settings.png`

The screenshots capture the Day surface after the test switches to Night and back to Day. Theme state and canvas change are asserted in both viewport matrices.

## Residual Page-Specific Work

- Document and settings modules retain their existing dense business-content typography and information hierarchy. This batch only normalizes their shared shell.
- Page-level secondary action groups inside module content remain owned by their respective feature workers; the shared decision header exposes exactly one principal command.
- The circular Next.js development indicator is visible in local screenshots and is not part of the product shell.
