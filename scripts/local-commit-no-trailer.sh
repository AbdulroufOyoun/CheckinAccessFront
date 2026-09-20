#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
MSG_FILE="${TEMP:-/tmp}/ca-front-local-commit-msg.txt"
cat > "$MSG_FILE" <<'EOF'
WIP: tenant admin visitors UI, user unlocks page, and add-visitor dialog.

Local work in progress; routes and API wiring may still be incomplete. Not pushed to remote.
EOF
git add -A
git reset HEAD -- src/app/apiEndpoints.ts.working 2>/dev/null || true
if git diff --cached --quiet; then
  echo "Nothing staged to commit."
  exit 1
fi
tree=$(git write-tree)
parent=$(git rev-parse HEAD)
export GIT_AUTHOR_NAME='Abdulrouf'
export GIT_AUTHOR_EMAIL='abdulroufoyoun@gmail.com'
export GIT_COMMITTER_NAME='Abdulrouf'
export GIT_COMMITTER_EMAIL='abdulroufoyoun@gmail.com'
new=$(git commit-tree "$tree" -p "$parent" -F "$MSG_FILE")
git reset --hard "$new"
git log -1 --format='%h %an <%ae>%n%s%n%n%B'
