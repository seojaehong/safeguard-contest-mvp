#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMMIT_APPROVED="${SAFETYGUARD_COMMIT_APPROVED:-0}"
AUTO_PUSH="${SAFETYGUARD_AUTO_PUSH:-0}"
PUSH_APPROVED="${SAFETYGUARD_PUSH_APPROVED:-0}"
EXPECTED_HEAD="${SAFETYGUARD_EXPECTED_HEAD:-}"
EXPECTED_REMOTE="${SAFETYGUARD_EXPECTED_REMOTE:-}"
EXPECTED_BRANCH="${SAFETYGUARD_EXPECTED_BRANCH:-}"
EXPECTED_PREFIX="${SAFETYGUARD_EXPECTED_PREFIX:-}"
readonly PUBLISH_REMOTE="contest-mvp-origin"
readonly PUBLISH_BRANCH="master"
readonly PUBLISH_PREFIX="contest-mvp"
readonly EXPECTED_PATHS=(
  "data/dryrun/latest-document-dryrun.json"
  "data/dryrun/latest-document-dryrun.md"
)

cd "$ROOT"

fail() {
  echo "publication aborted: $*" >&2
  exit 1
}

require_clean_tree() {
  [[ -z "$(git status --porcelain=v1 --untracked-files=all)" ]] \
    || fail "working tree must be clean before generating a publication snapshot"
}

is_expected_path() {
  local candidate="$1"
  local expected
  for expected in "${EXPECTED_PATHS[@]}"; do
    [[ "$candidate" == "$expected" ]] && return 0
  done
  return 1
}

collect_changed_paths() {
  {
    git diff --name-only -z
    git ls-files --others --exclude-standard -z
  }
}

assert_expected_changes_only() {
  local changed_count=0
  local candidate
  while IFS= read -r -d '' candidate; do
    is_expected_path "$candidate" || fail "unexpected generated path: $candidate"
    changed_count=$((changed_count + 1))
  done < <(collect_changed_paths)
  [[ "$changed_count" -gt 0 ]] || fail "dry-run generated no publishable snapshot changes"
}

assert_staged_changes_only() {
  local staged_count=0
  local candidate
  while IFS= read -r -d '' candidate; do
    is_expected_path "$candidate" || fail "unexpected staged path: $candidate"
    staged_count=$((staged_count + 1))
  done < <(git diff --cached --name-only -z)
  [[ "$staged_count" -gt 0 ]] || fail "no expected snapshot changes were staged"
  git diff --quiet || fail "unstaged tracked changes remain after staging the snapshot"
  [[ -z "$(git ls-files --others --exclude-standard)" ]] \
    || fail "untracked files remain after staging the snapshot"
}

assert_commit_contains_expected_paths_only() {
  local candidate
  while IFS= read -r -d '' candidate; do
    is_expected_path "$candidate" || fail "created commit contains unexpected path: $candidate"
  done < <(git diff-tree --no-commit-id --name-only -r -z HEAD)
}

STAGED_BY_SCRIPT=0
cleanup_staging() {
  if [[ "$STAGED_BY_SCRIPT" == "1" ]]; then
    git reset --quiet -- "${EXPECTED_PATHS[@]}" >/dev/null 2>&1 || true
  fi
}
trap cleanup_staging EXIT

require_clean_tree
START_HEAD="$(git rev-parse HEAD)"

npm run dryrun:documents

[[ "$(git rev-parse HEAD)" == "$START_HEAD" ]] \
  || fail "HEAD changed while the dry-run was executing"
assert_expected_changes_only

git add -- "${EXPECTED_PATHS[@]}"
STAGED_BY_SCRIPT=1
assert_staged_changes_only

if [[ "$COMMIT_APPROVED" != "1" ]]; then
  echo "Snapshot generated and verified. Commit is held until SAFETYGUARD_COMMIT_APPROVED=1."
  git diff --cached --stat
  exit 0
fi

[[ -n "$EXPECTED_HEAD" && "$EXPECTED_HEAD" == "$START_HEAD" ]] \
  || fail "SAFETYGUARD_EXPECTED_HEAD must equal the clean starting HEAD"

STAMP="$(date -u +%Y-%m-%d)"
git commit -m "chore: publish SafetyGuard daily dry-run snapshot ${STAMP}"
STAGED_BY_SCRIPT=0
assert_commit_contains_expected_paths_only
[[ -z "$(git status --porcelain=v1 --untracked-files=all)" ]] \
  || fail "working tree is not clean after the publication commit"

if [[ "$AUTO_PUSH" != "1" ]]; then
  echo "Committed. Push remains disabled."
  exit 0
fi

[[ "$PUSH_APPROVED" == "1" ]] \
  || fail "SAFETYGUARD_PUSH_APPROVED=1 is required for push"
[[ "$EXPECTED_REMOTE" == "$PUBLISH_REMOTE" ]] \
  || fail "SAFETYGUARD_EXPECTED_REMOTE must equal $PUBLISH_REMOTE"
[[ "$EXPECTED_BRANCH" == "$PUBLISH_BRANCH" ]] \
  || fail "SAFETYGUARD_EXPECTED_BRANCH must equal $PUBLISH_BRANCH"
[[ "$EXPECTED_PREFIX" == "$PUBLISH_PREFIX" ]] \
  || fail "SAFETYGUARD_EXPECTED_PREFIX must equal $PUBLISH_PREFIX"
git remote get-url "$PUBLISH_REMOTE" >/dev/null \
  || fail "publish remote is not configured"
[[ "$(git ls-tree -d --name-only HEAD "$PUBLISH_PREFIX")" == "$PUBLISH_PREFIX" ]] \
  || fail "publish prefix is not present at committed HEAD"

git subtree push --prefix "$PUBLISH_PREFIX" "$PUBLISH_REMOTE" "$PUBLISH_BRANCH"
