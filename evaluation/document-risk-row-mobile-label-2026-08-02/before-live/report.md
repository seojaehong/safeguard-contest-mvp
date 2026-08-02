# Document Risk Row Mobile Label Evidence

- Verdict: `RED_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_MOBILE_LABEL`
- Source: `e150bfcc280c215e6392b16491dfe49ac1fd1881`
- Production: `e150bfcc280c215e6392b16491dfe49ac1fd1881`
- Scope: risk-row selector readability only
- Boundary: no DB/provider/Share mutation; exact saved Share remains `MISSING_EVIDENCE`

| Theme | Viewport | Body/Viewport | Shell ratio | Distinct compact labels | Visible selector text | Verdict |
|---|---|---:|---:|---:|---|---|
| day | desktop-short-1440x723 | 723/723 | 1.75 | 0 | 01 이동식 비계 승·하강 및 작업발판 이동 중 추락 / 02 강풍 시 비계 전도와 공구·자재 낙하 / 03 지게차 동선 인접 구간에서 작업자 충돌 | PASS |
| night | desktop-short-1440x723 | 723/723 | 1.75 | 0 | 01 이동식 비계 승·하강 및 작업발판 이동 중 추락 / 02 강풍 시 비계 전도와 공구·자재 낙하 / 03 지게차 동선 인접 구간에서 작업자 충돌 | PASS |
| day | mobile-short-390x723 | 728/723 | 2.11 | 0 | 01 이동식 비계 승·하강 및 작업발판 이동 중 추락 / 02 강풍 시 비계 전도와 공구·자재 낙하 / 03 지게차 동선 인접 구간에서 작업자 충돌 | RED |
| night | mobile-short-390x723 | 728/723 | 2.11 | 0 | 01 이동식 비계 승·하강 및 작업발판 이동 중 추락 / 02 강풍 시 비계 전도와 공구·자재 낙하 / 03 지게차 동선 인접 구간에서 작업자 충돌 | RED |

Desktop keeps full hazard labels. Mobile shows unclipped accident-type labels while full hazard text remains in each selector's accessible name and title.
