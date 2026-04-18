#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

npm run dryrun:documents

git add data/dryrun app/page.tsx app/dryrun/page.tsx app/globals.css lib/dryrun-status.ts scripts/dryrun_document_cases.json scripts/dryrun_document_runner.mjs scripts/publish_document_dryrun_snapshot.mjs scripts/run_daily_document_dryrun.sh docs/daily-document-dryrun.md package.json .gitignore

if git diff --cached --quiet; then
  echo "No changes to commit"
  exit 0
fi

STAMP="$(date -u +%Y-%m-%d)"
git commit -m "chore: publish SafetyGuard daily dry-run snapshot ${STAMP}"

echo "Committed. Push with subtree command if needed:"
echo "git subtree push --prefix contest-mvp contest-mvp-origin master"
