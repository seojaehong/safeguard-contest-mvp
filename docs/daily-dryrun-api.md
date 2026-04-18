# SafetyGuard daily API dry-run

## What it does
- builds contest-mvp
- starts local Next server on port 3021 by default
- runs 100 dry-run API requests daily
- alternates `/api/search` and `/api/ask`
- stores result logs under `logs/dryrun-api/<timestamp>/`

## Main files
- `scripts/run_daily_dryrun.sh`
- `scripts/dryrun_api_runner.mjs`

## Output artifacts
- `build.log`
- `server.log`
- `runner.log`
- `summary.json`
- `details.json`

## Pass condition
- `failCount = 0`
- `successRate = 1`

## Notes
- `OPENAI_API_KEY` is optional. If unset, `/api/ask` falls back to mock answer mode.
- `LAWGO_MOCK_MODE=true` or demo defaults still allow dry-run validation.
- This is intended as a real API exercise without external side effects.
