#!/usr/bin/env bash
# T6 history rewrite — run on a FRESH MIRROR clone only.
# Agent stops before force-push; Pedro reviews then pushes.
#
#   git clone --mirror <remote-url> /tmp/pith-mirror.git
#   cd /tmp/pith-mirror.git
#   bash /path/to/pith/tools/prepare-history-rewrite.sh
#
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

echo "=== BEFORE ==="
echo "commits=$(git rev-list --all --count)"
du -sh . | awk '{print "dot_git_or_mirror_size="$1}'

if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "install git-filter-repo first" >&2
  exit 1
fi

# Remove junk paths from all history (D1a). --invert-paths = drop listed paths.
# Optional size pass: also add --path fixtures-normalizacion to land under ~10MB
# (large PDFs dominate pack size). Confirm with Pedro first — that deletes tip trees too.
git filter-repo --force --invert-paths \
  --path node_modules \
  --path .cursor \
  --path .specify \
  --path cursor-tests \
  --path deep-dives \
  --path audit \
  --path test-material.txt \
  --path-glob '*:Zone.Identifier'

echo "=== AFTER filter-repo ==="
echo "commits=$(git rev-list --all --count)"
du -sh . | awk '{print "dot_git_or_mirror_size="$1}'

echo "=== Verify removed paths absent ==="
if git log --all --name-only --pretty=format: | \
  grep -E '^(node_modules/|\.cursor/|\.specify/|cursor-tests/|deep-dives/|audit/|test-material\.txt|.+:Zone\.Identifier)' \
  | head -20 | grep -q .; then
  echo "FAIL: stripped paths still present" >&2
  exit 1
fi
echo "ok: stripped paths gone"

echo "=== Authors ==="
git log --all --format='%an <%ae>' | sort | uniq -c | sort -rn

echo "=== Emails in blob text (sample) ==="
# Cheap scan of tip trees only after rewrite; full history needs git rev-list | git grep
git grep -I -E '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' $(git rev-list --all | head -1) 2>/dev/null \
  | head -40 || true

echo "=== Secret scan ==="
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --source . -v
else
  echo "WARN: gitleaks not installed — install and re-run before force-push"
fi

echo
echo "STOP. Review, then Pedro: git push --force. Re-clone all working copies."
echo "Do NOT force-push from the agent."
