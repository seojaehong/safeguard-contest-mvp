# SafeGuard 검증 로그

| run_id | mode | scenario | risk_level | api_ok | api_fail | notes |
|---|---|---|---|---:|---:|---|
| 20260329T112421Z-live | live | scenario-01-seoul-outdoor-wind.json | medium | 10 | 2 | weather_current, legal_search |
| 20260329T112521Z-dry-run | dry-run | scenario-01-seoul-outdoor-wind.json | high | 0 | 0 | ok |
| 20260329T114849Z-live | live | scenario-01-seoul-outdoor-wind.json | medium | 11 | 1 | warning_list |
