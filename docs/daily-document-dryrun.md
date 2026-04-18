# SafetyGuard daily document dry-run

## What it does
- builds contest-mvp
- starts local Next server on port 3021 by default
- runs 10 document-output dry-run cases daily through `/api/ask`
- checks whether real document-style outputs are returned
- writes report artifacts under `logs/dryrun-documents/<timestamp>/`

## Target outputs
- 위험성평가 초안
- TBM 일지
- 작업계획서
- 협력업체 투입 체크리스트
- 화기작업 허가 검토 포인트
- 추락위험 브리핑
- 사고 초동보고
- 안전교육 기록
- 현장 순회점검 보고서
- 비상대응 점검표

## Main files
- `scripts/dryrun_document_cases.json`
- `scripts/dryrun_document_runner.mjs`
- `scripts/run_daily_document_dryrun.sh`

## Output artifacts
- `build.log`
- `server.log`
- `runner.log`
- `summary.json`
- `details.json`
- `report.md`

## Pass condition
- `failCount = 0`
- all 10 cases produce `answerLength >= 80`

## Run manually
```bash
cd /home/ubuntu/.openclaw/workspace/contest-mvp
npm run dryrun:documents
```
