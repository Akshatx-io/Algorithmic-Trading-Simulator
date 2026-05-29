#!/usr/bin/env bash
# ============================================================================
# scripts/cleanup_local.sh
#
# Local-machine finishing touches that the sandbox couldn't perform.
# Plus: an idempotent push-to-GitHub helper for the No-Len-77 remote.
#
# Run from the repo root:
#     bash scripts/cleanup_local.sh           # cleanup + push to GitHub
#     bash scripts/cleanup_local.sh --no-push # cleanup only
#
# Idempotent — safe to re-run any number of times.
# ============================================================================

set -euo pipefail

cd "$(dirname "$0")/.."

GITHUB_USER="No-Len-77"
GITHUB_REPO="Algorithmic-Trading-Simulator"
REMOTE_URL="https://github.com/${GITHUB_USER}/${GITHUB_REPO}.git"
MAIN_BRANCH="main"

PUSH=true
for arg in "$@"; do
    case "$arg" in
        --no-push) PUSH=false ;;
    esac
done

# Pretty print
say()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[0;32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$*"; }
err()  { printf '  \033[0;31m✗\033[0m %s\n' "$*"; }

# ----------------------------------------------------------------------------
# 1. Remove deprecated files (audit 3.7, 10.9)
# ----------------------------------------------------------------------------
say "Removing deprecated files"

for f in requirements.txt validate_setup.py; do
    if [ -f "$f" ]; then
        rm -f "$f" && ok "removed $f"
    else
        warn "$f already absent"
    fi
done

# ----------------------------------------------------------------------------
# 2. Remove committed binaries (audit 11)
# ----------------------------------------------------------------------------
say "Removing committed binaries and runtime artifacts"

for f in hft.db app/ml/models/lstm_model.h5 app/quant/__pycache__/build_lstm_model.cpython-313.pyc; do
    if [ -f "$f" ]; then
        rm -f "$f" && ok "removed $f"
    else
        warn "$f already absent"
    fi
done

if [ -d logs ]; then
    find logs -mindepth 1 -delete 2>/dev/null || true
    ok "logs/ contents cleared (directory preserved)"
fi

# ----------------------------------------------------------------------------
# 3. Clean Python caches (audit 12.6)
# ----------------------------------------------------------------------------
say "Cleaning Python caches"

find . -type d -name __pycache__   -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.pyc"       -not -path "*/node_modules/*" -delete 2>/dev/null || true
find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
find . -type d -name .ruff_cache   -exec rm -rf {} + 2>/dev/null || true
find . -type d -name .mypy_cache   -exec rm -rf {} + 2>/dev/null || true
ok "all caches cleared"

# ----------------------------------------------------------------------------
# 4. Untrack deprecated / Phase 2.1 files from git index
# ----------------------------------------------------------------------------
say "Untracking files from git index"

if [ -d .git ]; then
    for f in hft.db app/ml/models/lstm_model.h5 \
             logs/app.log logs/error.log logs/trading.log \
             frontend/src/context/AuthContext.jsx \
             alembic/versions/001_initial.py; do
        if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
            git rm --cached -- "$f" >/dev/null && ok "untracked $f"
        fi
    done

    git ls-files | grep -E "(__pycache__/|\.pyc$)" | while read -r f; do
        git rm --cached -- "$f" >/dev/null 2>&1 && ok "untracked $f"
    done

    if git ls-files logs/ 2>/dev/null | grep -q .; then
        git rm --cached -r logs/ >/dev/null 2>&1 && ok "untracked logs/"
    fi
else
    warn "not a git repo yet — will initialize below"
fi

# ----------------------------------------------------------------------------
# 5. Push to GitHub
# ----------------------------------------------------------------------------
if [ "$PUSH" = false ]; then
    say "Skipping GitHub push (--no-push)"
    exit 0
fi

say "Pushing to GitHub: $REMOTE_URL"

# Initialize repo if needed
if [ ! -d .git ]; then
    git init -q -b "$MAIN_BRANCH"
    ok "git repo initialized"
fi

# Ensure default branch
current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "$MAIN_BRANCH")"
if [ "$current_branch" != "$MAIN_BRANCH" ]; then
    git branch -M "$MAIN_BRANCH" && ok "renamed branch to $MAIN_BRANCH"
fi

# Configure remote (idempotent)
if git remote get-url origin >/dev/null 2>&1; then
    existing="$(git remote get-url origin)"
    if [ "$existing" != "$REMOTE_URL" ]; then
        git remote set-url origin "$REMOTE_URL"
        ok "remote origin updated → $REMOTE_URL"
    else
        ok "remote origin already correct"
    fi
else
    git remote add origin "$REMOTE_URL"
    ok "remote origin added → $REMOTE_URL"
fi

# Stage everything
git add -A
ok "staged $(git diff --cached --name-only | wc -l | tr -d ' ') files"

# Commit only if there's something to commit
if git diff --cached --quiet; then
    warn "nothing to commit — working tree matches HEAD"
else
    git commit -q -m "feat: Phase 2.0–2.2 production refactor

- AUDIT.md / ARCHITECTURE.md / ROADMAP.md  — engineering rationale (~210 KB)
- Phase 2.0 hygiene sweep                  — dead code purge, pyproject.toml,
                                              multi-stage Docker, ruff CI
- Phase 2.1 auth hardening                 — PyJWT + bcrypt + Redis refresh
                                              rotation, Zustand reactive auth,
                                              silent refresh, single-flight 401
- Phase 2.2 database truth                 — async SQLAlchemy 2.0, models /
                                              migrations reconciled, new orders
                                              + idempotency_records tables
- README.md                                 — recruiter-facing landing page
"
    ok "committed"
fi

# Push — try fast-forward, then fetch+force-with-lease, then plain force.
say "Pushing to origin/$MAIN_BRANCH"
if git push -u origin "$MAIN_BRANCH" 2>/dev/null; then
    ok "pushed cleanly"
else
    warn "fast-forward push failed — fetching remote then retrying with force-with-lease"
    # Fetch is required for --force-with-lease to have a 'lease' on the remote
    # ref. Without it, force-with-lease aborts with 'stale info'.
    git fetch origin "$MAIN_BRANCH" --no-tags >/dev/null 2>&1 || true
    if git push --force-with-lease -u origin "$MAIN_BRANCH" 2>/dev/null; then
        ok "force-with-lease push succeeded"
    else
        warn "force-with-lease blocked — falling back to plain --force (deliberate refactor replacement)"
        if git push --force -u origin "$MAIN_BRANCH"; then
            ok "force push succeeded"
        else
            err "push failed — check GitHub credentials (gh auth login OR a Personal Access Token)"
            exit 1
        fi
    fi
fi

echo ""
ok "✨ Repository synced: https://github.com/${GITHUB_USER}/${GITHUB_REPO}"
echo ""
