# SafeClaw Share/UI Readiness Check

Generated: 2026-07-19 KST

## 기준

- Authoritative HEAD: `bfb4d110ba037994df536e54850bdc7499d8acf3`
- Branch: `chore/kosha-wave2-evidence-master-20260718`
- Live build-info: `bfb4d110ba037994df536e54850bdc7499d8acf3`
- DB schema/data mutation: none

## 확인 결과

### `/why` mobile overflow

Live `https://www.safeclaw.kr/why?theme=day` and `?theme=night` were checked at `390x844`.

- Day: document width `390`, scroll width `390`, overflow `0`, outside visible elements `0`, comparison table rect `left 29 / right 361 / width 332`
- Night: document width `390`, scroll width `390`, overflow `0`, outside visible elements `0`, comparison table rect `left 29 / right 361 / width 332`

The previous mobile comparison-table overflow finding is not reproduced on the current live commit.

### Share / foreign-worker delivery surface

Current HEAD includes the recipient portal route at `app/share/[sessionId]/page.tsx`.

Focused test result:

- `npm.cmd test -- tests\why-mobile-layout.test.ts tests\share-recipient-portal-browser.test.ts tests\workflow-share-client.test.ts tests\workspace-share-simplification.test.ts --maxWorkers=1 --fileParallelism=false`
- Result: 4 files / 49 tests PASS

Covered behaviors:

- Share recipient portal renders without mobile horizontal overflow.
- Core controls and document summaries maintain `>=44px` touch height.
- Vietnamese invited-worker chrome and confirmation button render.
- Korean admin/debug labels do not leak into the Vietnamese recipient portal fixture.
- Manager share UI keeps the simplified “targets / channel / language preview / single send action” contract.

### KOSHA wave2 side-channel status

The separate `feat/kosha-trust-registry-wave2` worktree is clean at `daee789a0f001fc6d7aca0d242f205bfcc6f338e`.

Its current evidence report already records the broad KOSHA corpus run honestly as unresolved RED:

- Focused Vitest: 5 files / 76 tests PASS
- Python acquisition: 19 tests PASS
- Strict TypeScript: PASS
- Production build: 28/28 static pages PASS
- Broad Vitest: 30 files PASS, 1 file FAIL, 3 files SKIP; 386 tests PASS, 3 FAIL, 4 SKIP

No schema migration or data mutation is included in that wave.

## Remaining caution

- GitHub Actions for the latest evidence commit was still running at the time of this report.
- Earlier historical CI failures on `f5eadcd4`, `3bfe9d80`, `0cc42c22`, and `9899e1f7` were caused by the pump/LOTO regression later fixed by `a7530006`; the product fix commit itself is green.
