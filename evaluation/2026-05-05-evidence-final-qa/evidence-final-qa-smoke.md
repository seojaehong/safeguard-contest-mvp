# Evidence/Knowledge/Remediate Final QA Smoke

- Base URL: http://127.0.0.1:3072
- Started: 2026-05-05T11:54:23.7581699+09:00
- Finished: 2026-05-05T11:54:56.3557109+09:00

| target | status | ok | role label | reflection label | elapsedMs |
| --- | ---: | --- | --- | --- | ---: |
| GET /knowledge | 200 | True | True | True | 8450 |
| GET /evidence | 200 | True | True | True | 5588 |
| POST /api/workpack/remediate | 200 | True | True | True | 14203 |
| GET /api/safety-reference/status/search?q=%EC%A7%80%EA%B2%8C%EC%B0%A8%20TBM%20%EC%9C%84%ED%97%98%EC%84%B1%ED%8F%89%EA%B0%80&limit=3 | 200 | True | True | True | 4268 |
