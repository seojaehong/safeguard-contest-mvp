# Agent D Evidence/Knowledge/AI Mapping Smoke

- Base URL: http://127.0.0.1:3068
- Started: 2026-05-05T10:12:07.8285614+09:00
- Finished: 2026-05-05T10:12:48.3364009+09:00
- Note: /api/safety-reference/status/search is not a defined route in this repo; /status and /search were smoked separately.

| endpoint | status | ok | expected unavailable | elapsedMs |
| --- | ---: | --- | --- | ---: |
| GET /api/knowledge/match?question=%EC%A7%80%EA%B2%8C%EC%B0%A8%20TBM%20%EC%9C%84%ED%97%98%EC%84%B1%ED%8F%89%EA%B0%80&limit=2 | 200 | True | False | 2939 |
| POST /api/workpack/remediate | 200 | True | False | 15499 |
| GET /api/safety-reference/status | 200 | True | False | 15769 |
| GET /api/safety-reference/search?q=%EC%A7%80%EA%B2%8C%EC%B0%A8%20TBM%20%EC%9C%84%ED%97%98%EC%84%B1%ED%8F%89%EA%B0%80&limit=3 | 200 | True | False | 3885 |
| GET /api/safety-reference/status/search?q=%EC%A7%80%EA%B2%8C%EC%B0%A8&limit=1 | 404 | False | True | 2355 |
