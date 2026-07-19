# Workspace Documents / Share Geometry Check

검증 일시: 2026-07-20 KST  
검증 대상: production `https://www.safeclaw.kr/workspace?theme=day`  
Production build marker: `86259b3cb1417ec4764d7ae49984ee12aa6a99f3`  
Authoritative worktree HEAD: `86259b3cb1417ec4764d7ae49984ee12aa6a99f3`  
시나리오: "서울 성수동 외벽 도장 작업, 이동식 비계 사용, 작업자 5명, 신규 1명, 베트남 작업자 1명, 오후 강풍 예보" 입력 후 실제 production 생성 플로우로 `12/12` 완료 상태까지 대기

## Verdict

`PARTIALLY FIXED`

- Share desktop은 이전의 단일 narrow mobile-card 형태에서는 벗어났다. 1440px에서 대상/채널/언어 카드 3열 + 하단 메시지 미리보기로 렌더된다.
- Documents review는 이전 2.9x viewport 수준보다는 줄었지만, 아직 화면 전체가 1.38x viewport이고 한 화면 안에서 문서 선택, 근거, 미리보기, 작업 이력이 모두 이어진다.
- Documents edit와 mobile share/documents는 여전히 launch UX blocker에 가깝다. 특히 mobile edit는 편집기가 화면 위로 밀린 상태에서 열리고, 구조화 편집 body가 매우 길다.

따라서 사용자가 stale 화면을 본 것이 아니라, production authoritative HEAD에서도 일부 문제가 남아 있다.

## Geometry Summary

| Surface | Viewport | Document height | Ratio | Main step rect | Key finding |
|---|---:|---:|---:|---|---|
| Documents review | 1440x900 | 1240 | 1.38x | y=164, h=956 | 12/12 완료 후에도 한 화면을 넘김 |
| Documents edit | 1440x900 | 1444 | 1.60x | y=-9, h=1152 | editor sidebar is sticky; edit surface still scroll-heavy |
| Share | 1440x900 | 1268 | 1.41x | y=172, h=976 | desktop composition exists, but still taller than first viewport |
| Share | 390x844 | 1984 | 2.35x | y=268, h=1611 | mobile share remains long |
| Documents review | 390x844 | 1603 | 1.90x | y=300, h=1198 | useful preview begins near bottom of first viewport |
| Documents edit | 390x844 | 1894 | 2.24x | y=-130, h=1489 | editor opens with page scrolled; nested long structured body remains |

Horizontal overflow: `0` on all measured surfaces.

## Evidence Files

- `metrics-final.json`
- `desktop-doc-review-final-ish.png`
- `desktop-doc-edit-final-ish.png`
- `desktop-share-final.png`
- `mobile-share-final.png`
- `mobile-doc-review-final.png`
- `mobile-doc-edit-final.png`

## Interpretation

The user is probably not seeing a stale local server/cache/deployment for these two issues. Production and local authoritative HEAD both resolve to `86259b3c`.

Share desktop is partially corrected: it is not a pure mobile panel anymore. However, it still lives inside a 968px workbench column and has 1268px total page height, so it is acceptable for a demo capture but not fully resolved as a desktop-grade final surface.

Documents is not fully corrected. The review state is improved, but the page is still longer than one viewport, and the edit state is still dense. Mobile remains the clearest blocker because the first useful document preview starts at y=815 on a 844px viewport, and the edit body extends far beyond the visible editor area.

## Recommended Bounded Remediation

1. Documents review: collapse default evidence/readiness/status blocks into a single compact trigger and keep the 3-document selector + preview above the fold.
2. Documents edit: remove the extra default "운영 체크" and keep provenance/export/graph closed behind one utility row. On mobile, open the selected editor at top without negative scroll offsets.
3. Share desktop: keep the current 3-card composition, but reduce body height by truncating message preview with expand control and keep the primary CTA visible within the first viewport.
4. Share mobile: keep target/channel/language order, but cap preview height and move the send CTA before long preview details.

## Patch Verification

Bounded patch applied in `fix/northstar-share-recipient-20260720`:

- Document review chrome was compacted.
- Mobile core document selector changed from three stacked cards to a three-column segmented row.
- Editor focus hides the pilot checklist and prevents closed operation tools from occupying layout space.
- Recipient portal no longer exposes server-provided Korean error text or indefinite loading copy on foreign-language failed session loads.
- Share message preview remains fully visible without an internal scroll so the existing foreign-language delivery contract stays intact.

Fresh local production measurement after the first patch pass (`http://127.0.0.1:3019`, same scenario) showed the direction of travel:

| Surface | Before | After | Delta |
|---|---:|---:|---:|
| Desktop documents review height | 1240 | 1190 | -50 |
| Desktop documents review step bottom | 1120 | 962 | -158 |
| Mobile documents review height | 1603 | 1429 | -174 |
| Mobile documents preview top | 815 | 657 | -158 |

Final post-build contract verification after reverting the share preview cap:

- `tests/north-star-document-ux.test.ts`: 4/4 PASS. Review nested scroll is `0` on desktop and 390px mobile; editor horizontal overflow is `0`.
- `tests/workspace-share-mobile-browser.test.ts`: 1/1 PASS. Vietnamese preview paragraphs remain fully visible before the CTA.
- `tests/share-recipient-portal-browser.test.ts`: 5/5 PASS. Failed recipient session loads show localized generic errors and do not leak Korean server messages.
- `tests/workspace-share-simplification.test.ts`, `tests/workflow-share-client.test.ts`, `tests/workflow-share-panel-behavior.test.ts`, `tests/workpack-share-authority-routes.test.ts`: 86/86 PASS.
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run build`: PASS, 28/28 static pages.

Remaining known issue:

- Documents edit is still long. The active editor itself is visible within the first viewport and the final contract has no nested scroll, overlap, clipped controls, sub-44 controls, or horizontal overflow, but the structured risk rows remain dense. This needs a deeper editor IA pass and should not be claimed as fully solved.

Patch evidence files:

- `metrics-patched-final.json`
- `patched-desktop-doc-review.png`
- `patched-desktop-doc-edit.png`
- `patched-desktop-share.png`
- `patched-mobile-share.png`
- `patched-mobile-doc-review.png`
- `patched-mobile-doc-edit.png`
