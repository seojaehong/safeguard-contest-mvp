# Workspace Share Draft Check

Date: 2026-07-10

## Scope

Checked the `/workspace` share step after document generation for the issue where sharing looked empty or unfinished before server storage was connected.

## Fix Summary

- Replaced ambiguous waiting copy such as `저장 ID 대기` with `저장 전 후보`.
- Added a display-only target fallback: `현장관리자` + `작업자 그룹 n명`.
- Kept real worker snapshots authoritative when available.
- Used the same display target basis for share cards, acknowledgment ledger, dispatch confirmation, and dispatch log labels.
- Fixed the share session grid so warning copy no longer pushes the four share cards into a narrow left column.
- Added responsive override so mobile share cards render as a single readable column.

## Verification

Commands:

- `npm.cmd test -- tests\workspace-workers.test.ts tests\briefing.test.ts`
- `npm.cmd run typecheck`
- `npm.cmd run build`

Browser checks on local production build:

- Desktop `1440x900`: `share-page-desktop-final.png`, `share-page-desktop-final.json`
- Mobile `390x844`: `share-page-mobile-final.png`, `share-page-mobile-final.json`

Final browser metrics:

- Desktop share card widths: 344px each.
- Mobile share card widths: 298px each.
- `저장 ID 대기`: not present.
- Draft candidate copy: present.
- Worker snapshot copy: present.
- Horizontal scroll: none on desktop and mobile.

## Related SIF Check

The linked SIF source usage review is in:

`evaluation/northstar-72h-2026-07-10/sif-source-usage-check/report.md`

