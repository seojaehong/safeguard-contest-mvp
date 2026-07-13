# Share v2 Product Contract Amendment

Status: `AUTHORITATIVE_ADDITIVE_ERRATUM`

Amendment ID: `workpack-share-v2-product-2026-07-14`

이 문서는 `evaluation/workpack-share-v2-2026-07-13`의 target-ready spec과 review evidence를 수정하거나 다시 쓰지 않습니다. 해당 파일은 역사적 근거로 보존하며, 이 amendment가 Share v2 product/browser evidence의 selected mobile viewport와 text-scaling delivery authority만 대체합니다.

## Immutable Authority

| Role | Commit | Path | Git blob |
|---|---|---|---|
| source base | `f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5` | n/a | n/a |
| target-ready spec | `c590cf184df352d5d319fae64cca087e77a31ba8` | `evaluation/workpack-share-v2-2026-07-13/spec.md` | `82290bc98c21342665d87c706c648143e3c7c6b3` |
| target-ready spec | `c590cf184df352d5d319fae64cca087e77a31ba8` | `evaluation/workpack-share-v2-2026-07-13/spec.json` | `80f0d9672e87c992f194bf598768d5a7d0d48d84` |
| target-ready validator | `c590cf184df352d5d319fae64cca087e77a31ba8` | `evaluation/workpack-share-v2-2026-07-13/validate-spec.cjs` | `327556f49837bc012edf790ffda0f9f0f0af1d86` |
| review evidence | `f45bba17bcce0d8ebb2690f82d014dbe42ae8191` | `evaluation/workpack-share-v2-2026-07-13/review-evidence.json` | `1bca7b1c78d046fc68082022f5f12a3d1fc33c82` |

Product branch exact base: `f45bba17bcce0d8ebb2690f82d014dbe42ae8191`.

## Superseded Tokens

다음 값은 위 historical files 안에서만 유효한 과거 기록이며 현재 product/browser authority가 아닙니다.

- Selected mobile viewport: `391x844`
- Scaled delivery: `computed_text_200 per-node/leaf fontSize/lineHeight mutation`

## Replacement Authority

- Selected mobile viewport는 정확히 `390x844` CSS px입니다.
- Baseline mode는 `normal_100`, scaled mode는 `owning_root_text_200`입니다.
- baseline은 어떤 mutation보다 먼저 캡처합니다.
- 제품이 소유한 `[data-share-root]`의 `data-share-text-scale` 속성을 `100`에서 `200`으로 정확히 한 번 변경합니다.
- root attribute mutation count는 `1`입니다.
- descendant style mutation count와 direct leaf inline mutation count는 각각 `0`입니다.
- CSS cascade, `::before`/`::after`, media/layout reflow, localized text wrap/growth, 44x44 CSS px button hit area, horizontal overflow, unintended overlap, nested vertical scroll을 실제 DOM에서 측정합니다.
- transform, CSS zoom, viewport mutation, device scale mutation은 delivery로 인정하지 않습니다.
- scaled case는 서로 다른 production fixture DOM에서 두 번 실행합니다.

## Census Remap

Case ID는 `{environmentId}:{fixtureId}:{scaleModeId}`입니다. 환경 4개, fixture state 16개, scale mode 2개를 다시 곱하면 `4 * 16 * 2 = 128`입니다. 이 수는 구 128을 고정한 결과가 아니라, mobile viewport와 scaled mode가 각각 일대일로 교체되어 축 cardinality가 `4`, `16`, `2`로 유지된 결과입니다.

- Day/Night desktop: `1440x1000`
- Day/Night mobile: `390x844`
- Scale modes: `normal_100`, `owning_root_text_200`
- 16 fixture states와 12 language authority loop는 그대로 유지합니다.

## Fail-Closed Validation

`validate-contract-amendment.cjs`는 amendment 누락, stale candidate/evidence SHA, stale blob, 모든 depth의 unknown key, active product에서의 `391x844` 재등장, descendant/leaf font mutation delivery 재등장을 거부합니다. 최종 product/browser evidence는 이 amendment가 추가된 commit SHA를 별도로 기록해야 하며 fresh independent review 전에는 통합하지 않습니다.
