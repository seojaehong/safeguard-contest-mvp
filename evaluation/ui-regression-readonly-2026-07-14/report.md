# SafeClaw workspace read-only UI regression check

- generatedAt: 2026-07-14T04:44:26.694Z
- baseUrl: http://127.0.0.1:3087
- testedSourceSha: `e1e3c02056f8e77cdb1bf38fd13dd6a34620754b`
- product files changed: `0`
- verdict: **PASS** for example-clear residue, desktop rail/main alignment, and mobile stack boundary

The later web-presentation integration does not touch the workspace component or layout CSS, so these measurements remain the bounded evidence for the two reported regressions. Final product-head browser gates will rerun the same checks.

Focused regression command on the current integration worktree: **1 file / 3 tests PASS** with 21 unrelated tests skipped. Log: `focused-tests.log`.

## desktop-day
- selectedExample: 인천 물류 · 우천 · 숙련자 중심
- loaded textarea: y=424.59, h=152, scrollHeight=150, valueLength=123, placeholder="", before=none, after=none
- cleared textarea: y=424.59, h=152, scrollHeight=150, valueLength=0, placeholder="", before=none, after=none
- layout loaded: sideNav(y=117.05, h=1131.13), main(y=117.05, h=1131.13), sideOverflow=visible, sideCanScroll=false, mainOverflow=visible, mainCanScroll=false, bottomDeltaAfterWindowMax=0
- screenshots: C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\phase-a-evidence-integration\evaluation\ui-regression-readonly-2026-07-14\desktop-day-loaded.png
- screenshots: C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\phase-a-evidence-integration\evaluation\ui-regression-readonly-2026-07-14\desktop-day-cleared.png

## desktop-night
- selectedExample: 인천 물류 · 우천 · 숙련자 중심
- loaded textarea: y=424.59, h=152, scrollHeight=150, valueLength=123, placeholder="", before=none, after=none
- cleared textarea: y=424.59, h=152, scrollHeight=150, valueLength=0, placeholder="", before=none, after=none
- layout loaded: sideNav(y=117.05, h=1131.13), main(y=117.05, h=1131.13), sideOverflow=visible, sideCanScroll=false, mainOverflow=visible, mainCanScroll=false, bottomDeltaAfterWindowMax=0
- screenshots: C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\phase-a-evidence-integration\evaluation\ui-regression-readonly-2026-07-14\desktop-night-loaded.png
- screenshots: C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\phase-a-evidence-integration\evaluation\ui-regression-readonly-2026-07-14\desktop-night-cleared.png

## mobile-day
- selectedExample: 인천 물류 · 우천 · 숙련자 중심
- loaded textarea: y=404.84, h=142, scrollHeight=183, valueLength=123, placeholder="", before=none, after=none
- cleared textarea: y=404.84, h=142, scrollHeight=140, valueLength=0, placeholder="", before=none, after=none
- layout loaded: sideNav(y=157.05, h=103), main(y=260.05, h=1380.98), sideOverflow=visible, sideCanScroll=false, mainOverflow=visible, mainCanScroll=false, bottomDeltaAfterWindowMax=-1380.98
- screenshots: C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\phase-a-evidence-integration\evaluation\ui-regression-readonly-2026-07-14\mobile-day-loaded.png
- screenshots: C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\phase-a-evidence-integration\evaluation\ui-regression-readonly-2026-07-14\mobile-day-cleared.png

## mobile-night
- selectedExample: 인천 물류 · 우천 · 숙련자 중심
- loaded textarea: y=404.84, h=142, scrollHeight=183, valueLength=123, placeholder="", before=none, after=none
- cleared textarea: y=404.84, h=142, scrollHeight=140, valueLength=0, placeholder="", before=none, after=none
- layout loaded: sideNav(y=157.05, h=103), main(y=260.05, h=1380.98), sideOverflow=visible, sideCanScroll=false, mainOverflow=visible, mainCanScroll=false, bottomDeltaAfterWindowMax=-1380.98
- screenshots: C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\phase-a-evidence-integration\evaluation\ui-regression-readonly-2026-07-14\mobile-night-loaded.png
- screenshots: C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\phase-a-evidence-integration\evaluation\ui-regression-readonly-2026-07-14\mobile-night-cleared.png
