# Landing Mobile Density Current Gate

Checked at: 2026-07-20 KST

## Verdict

`PASS` for the previously recorded P3 mobile landing density issue.

The production-critical routes were already clear of P1/P2 UI blockers. The remaining home-page P3 was that `/` mobile was too long for a launch/demo entry surface. This patch keeps the desktop landing intact and compresses only the mobile landing into a front-door flow:

- hero / main CTA
- core 3-step value summary
- sample-start terminal
- footer

The hidden mobile sections remain available on desktop. Mobile no longer exposes jump navigation to sections that are hidden at that breakpoint.

## Changes

- `app/globals.css`
  - At `max-width: 720px`, removed the replay console, second hero paragraph, positioning line, and secondary landing sections from the default mobile landing surface.
  - Kept desktop sections and navigation intact.
  - Changed mobile landing navigation to `display: none` so it cannot jump to hidden sections.
  - Reduced hero and terminal minimum heights on mobile.
  - Fixed two existing design-contract tuple gaps in `/documents` mobile CSS while validating the focused frontend contract.

## Verification

Production build-info after deploy:

- Commit: `042859ccd2da59c1f6afe4b0915eeba0e07cf5b2`
- Branch: `master`
- Environment: `production`

### Design Contract

Command:

```powershell
npm.cmd test -- tests\frontend-design-contract.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- Test files: 1 passed / 1
- Tests: 22 passed / 22

### Production Build

Command:

```powershell
npm.cmd run build
```

Result:

- Build: PASS
- Static pages: 28 / 28 generated

### Local Production Geometry

Server:

```powershell
$env:PORT='3020'; npm.cmd run start -- --hostname 127.0.0.1
```

Probe:

- Browser: Playwright Chromium
- Route: `http://127.0.0.1:3020/`

Results:

| Viewport | Document height | Ratio | Horizontal overflow | Mobile nav |
| --- | ---: | ---: | --- | --- |
| 390x844 | 2,785px | 3.30x | false | hidden |
| 1440x900 | 5,604px | 6.23x | false | visible |

Evidence:

- `evaluation/landing-mobile-density-current-2026-07-20/geometry.json`
- `evaluation/landing-mobile-density-current-2026-07-20/mobile-root-final.png`
- `evaluation/landing-mobile-density-current-2026-07-20/desktop-root-final.png`

### Live Production Geometry

Route:

```text
https://www.safeclaw.kr/
```

Results:

| Viewport | Document height | Ratio | Horizontal overflow | Mobile nav |
| --- | ---: | ---: | --- | --- |
| 390x844 | 2,785px | 3.30x | false | hidden |
| 1440x900 | 5,604px | 6.23x | false | visible |

Evidence:

- `evaluation/landing-mobile-density-current-2026-07-20/live-geometry.json`
- `evaluation/landing-mobile-density-current-2026-07-20/mobile-live-root-final.png`
- `evaluation/landing-mobile-density-current-2026-07-20/desktop-live-root-final.png`

## Boundary

- This is a mobile density remediation, not a homepage redesign.
- No DB schema, data, API, or routing change was made.
- Desktop landing content remains visible.
- The broader North Star goal remains active.
