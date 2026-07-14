# PR #72 Vercel Preview Browser Smoke

## Scope

- Date: 2026-07-14
- Source: `920c7f360688352156de4854b4957a9f2f1f0e43`
- PR: `https://github.com/seojaehong/safeguard-contest-mvp/pull/72`
- Vercel deployment: `5uTJxFLBnWZSKCWBon3gTuy5YiMq`
- Preview: `https://safeguard-contest-mvp-git-feat-phas-44f988-seojaehongs-projects.vercel.app`
- Routes: `/workspace` input page, `/documents`, `/reports`
- Matrix: desktop `1440x1000`, mobile `390x844`, Day and Night
- Excluded: `/workspace` Share v2, submit/send/upload actions, DB writes

## Provenance

Preview provenance is confirmed.

1. PR #72 `headRefOid` equals the tested source SHA.
2. The SHA's GitHub `Vercel` status is `success` and targets deployment `5uTJxFLBnWZSKCWBon3gTuy5YiMq`.
3. The PR Vercel bot comment maps that deployment to the exact preview URL above.
4. Authenticated Chrome loaded all 12 requested URLs without redirect; every document response was HTTP `200` and every final URL retained the requested preview host and route.

## Verdict

- Tested rows: 12 of 12
- Screenshots: 12 bounded viewport PNGs
- Product hard-failure rows: 0
- Unresolved rows: 0
- `pass_with_observations`: 11 rows
- `pass`: 1 row
- Overall: `pass_with_observations`

The previously reported empty-input residue and rail-height defects are fixed on this preview. No horizontal overflow, header/content overlap, independent rail scroll, visible interaction clipping, or interactive overlap was found.

## Row Results

| Row | HTTP | Result | Content top Y | H overflow | <44 targets | Clip impact | Overlap | Rail |
|---|---:|---|---:|---:|---:|---:|---:|---|
| workspace-desktop-day | 200 | pass_with_observations | 116.65 | 0 | 5 | 0 | 0 | bottom delta 0px |
| workspace-desktop-night | 200 | pass_with_observations | 116.65 | 0 | 5 | 0 | 0 | bottom delta 0px |
| documents-desktop-day | 200 | pass_with_observations | 48.00 | 0 | 12 | 0 | 0 | n/a |
| documents-desktop-night | 200 | pass_with_observations | 48.00 | 0 | 12 | 0 | 0 | n/a |
| reports-desktop-day | 200 | pass_with_observations | 54.40 | 0 | 0 | 0 | 0 | n/a |
| reports-desktop-night | 200 | pass | 54.40 | 0 | 0 | 0 | 0 | n/a |
| workspace-mobile-day | 200 | pass_with_observations | 155.25 | 0 | 6 | 0 | 0 | stack gap 0px |
| workspace-mobile-night | 200 | pass_with_observations | 155.25 | 0 | 6 | 0 | 0 | stack gap 0px |
| documents-mobile-day | 200 | pass_with_observations | 123.20 | 0 | 4 | 0 | 0 | n/a |
| documents-mobile-night | 200 | pass_with_observations | 123.20 | 0 | 4 | 0 | 0 | n/a |
| reports-mobile-day | 200 | pass_with_observations | 127.20 | 0 | 0 | 0 | 0 | n/a |
| reports-mobile-night | 200 | pass_with_observations | 127.20 | 0 | 0 | 0 | 0 | n/a |

Every row was captured at `scrollY=0`. Independent rail scroll was `false` in all 12 rows.

## Regression Checks

All four `/workspace` rows were typed into and then cleared with keyboard input without submitting the form.

| Check | Desktop Day | Desktop Night | Mobile Day | Mobile Night |
|---|---|---|---|---|
| textarea value | empty | empty | empty | empty |
| placeholder attribute/property | empty | empty | empty | empty |
| `::before` / `::after` | `none` / `none` | `none` / `none` | `none` / `none` | `none` / `none` |
| rail independent scroll | false | false | false | false |
| rail/main bottom delta | 0px | 0px | n/a | n/a |
| mobile rail/main stack gap | n/a | n/a | 0px | 0px |

## Fetch 400 Reconciliation

The provisional seven failed rows were false product failures.

- The final initiator-aware capture reproduced the same preview-root `Fetch 400` as `OPTIONS /`.
- Every captured request stack resolves to `https://vercel.live/_next-live/feedback/feedback.js`.
- The browser console's matching `Failed to load resource` entry is the same Vercel feedback-toolbar request, not a second application error.
- No captured `400`, runtime exception, console error, or network failure was initiated by SafeClaw application code.
- The Vercel toolbar event remains an observation and is preserved in `fetch-400-provisional-raw.json` and `fetch-400-final-matrix-raw.json`.

## Control Inventory

After excluding hidden elements, disabled controls, descendants of closed `details`, SVG/icon internals, duplicate native inputs enclosed by labels, and labels associated with an existing control at least `44x44`, 54 tested control instances remained below 44px on at least one axis.

| Surface | Viewport | Per theme | Retained labels and geometry |
|---|---|---:|---|
| workspace | desktop | 5 | Day `50.31x36`; Night `61.96x36`; 현장 사진 첨부 `75.53x37.6`; 고급 설정 `77.61x18`; 예시 불러오기 `99.69x18` |
| workspace | mobile | 6 | SafeClaw 홈으로 이동 `329.6x28.05`; Day `50.31x36`; Night `61.96x36`; 현장 사진 첨부 `300x37.6`; 고급 설정 `77.61x18`; 예시 불러오기 `99.69x18` |
| documents | desktop | 12 | SafeClaw 홈 `93.56x24`; 메뉴 `40.96x36`; four secondary links `203.2x40`; Day/Night each `47.99x36`; 새 문서팩 만들기 `109.6x36`; 베타 형식 `93x42`; 사업장 서식 매핑 준비 `688x24`; 전체 문서팩 다운로드 `166.2x42` |
| documents | mobile | 4 | SafeClaw 홈 `93.56x24`; 베타 형식 `93x42`; 사업장 서식 매핑 준비 `234.4x24`; 전체 문서팩 다운로드 `166.2x42` |
| reports | desktop/mobile | 0 | none |

Every retained instance has its exact unique selector, label, own geometry, effective hit-target geometry, and below-width/below-height flags in `report.json` at `rows[].metrics.controls.genuineBelow44`. Excluded candidates and reasons are at `rows[].metrics.controls.excluded`.

## Overflow And Clipping

CSS overflow alone was not treated as failure.

- Workspace desktop had one raw `overflow:hidden` candidate: attachment helper text exceeded its client width by 6px. It is noninteractive text and had no interaction-boundary impact.
- Documents desktop had one raw candidate: an active document-tab description exceeded its client height by 6px. The clipped node is noninteractive descriptive text and had no interaction-boundary impact.
- Mobile rows had no raw overflow candidates after responsive layout and visibility filtering.
- Genuine visible interaction clipping: 0 rows.
- Interactive overlap: 0 rows.

Raw candidates, exact selectors, geometry, deltas, exclusion reason, and impact proof are retained under `rows[].metrics.clipping` in `report.json`.

## Artifacts

- `report.json`: complete provenance, row status/result, DOM/computed-style metrics, exact control and clipping inventories
- `fetch-400-provisional-raw.json`: original provisional error rows before initiator capture
- `fetch-400-raw.json`: fresh-tab 12-navigation reproduction probe
- `fetch-400-final-matrix-raw.json`: final initiator-aware network/error evidence
- `workspace-*.png`, `documents-*.png`, `reports-*.png`: 12 viewport-bounded screenshots

No product code, tests, database/schema/migrations, package metadata, or lockfiles were modified.
