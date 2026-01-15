#!/bin/bash

# =============================================================================
# Push to Production Script
# Pushes CODE to production via git (triggers Render deploy)
# NO database data is synced - only code and schema migrations
# Usage: pnpm push:prod [--confirm] [--dry-run]
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Parse arguments
CONFIRM=false
DRY_RUN=false

for arg in "$@"; do
    case $arg in
        --confirm)
            CONFIRM=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
    esac
done

echo ""
echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║                    Push to Production                        ║${NC}"
echo -e "${BLUE}${BOLD}║                                                              ║${NC}"
echo -e "${BLUE}${BOLD}║  Code + Migrations only. Database data stays untouched.     ║${NC}"
echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# =============================================================================
# Step 1: Check git status
# =============================================================================
echo -e "${YELLOW}[1/4] Checking git status...${NC}"

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo -e "${RED}ERROR: You have uncommitted changes${NC}"
    echo ""
    git status --short
    echo ""
    echo "Please commit or stash your changes first."
    echo "  Run: /commit"
    exit 1
fi

# Check for untracked files (warning only)
UNTRACKED=$(git ls-files --others --exclude-standard | wc -l | tr -d ' ')
if [ "$UNTRACKED" -gt 0 ]; then
    echo -e "${YELLOW}Warning: $UNTRACKED untracked files (won't be pushed)${NC}"
fi

echo -e "${GREEN}✓ Working tree clean${NC}"

# =============================================================================
# Step 2: Check branch
# =============================================================================
echo ""
echo -e "${YELLOW}[2/4] Checking branch...${NC}"

CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}Warning: You're on '$CURRENT_BRANCH', not 'main'${NC}"
    echo ""
    if [ "$CONFIRM" != true ]; then
        read -p "Push to $CURRENT_BRANCH anyway? (y/N) " branch_confirm
        if [ "$branch_confirm" != "y" ] && [ "$branch_confirm" != "Y" ]; then
            echo "Aborted."
            exit 0
        fi
    fi
else
    echo -e "${GREEN}✓ On main branch${NC}"
fi

# =============================================================================
# Step 3: Show commits to push
# =============================================================================
echo ""
echo -e "${YELLOW}[3/4] Commits to push...${NC}"

# Fetch to ensure we have latest remote state
git fetch origin "$CURRENT_BRANCH" --quiet 2>/dev/null || true

# Get commits not yet pushed
COMMITS=$(git log "origin/$CURRENT_BRANCH..$CURRENT_BRANCH" --oneline 2>/dev/null || git log --oneline -5)
COMMIT_COUNT=$(echo "$COMMITS" | grep -c . || echo "0")

if [ -z "$COMMITS" ] || [ "$COMMIT_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}No new commits to push${NC}"
    echo ""
    echo "Your branch is up to date with origin/$CURRENT_BRANCH"
    exit 0
fi

echo ""
echo -e "${BOLD}$COMMIT_COUNT commit(s) to push:${NC}"
echo "$COMMITS" | head -10
if [ "$COMMIT_COUNT" -gt 10 ]; then
    echo "  ... and $((COMMIT_COUNT - 10)) more"
fi
echo ""

# =============================================================================
# Step 4: Dry run check
# =============================================================================
if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}DRY RUN - No changes will be made${NC}"
    echo ""
    echo "Would execute:"
    echo "  git push origin $CURRENT_BRANCH"
    echo ""
    echo "After push, Render will:"
    echo "  1. Build Docker image with new code"
    echo "  2. Run migrations on container start"
    echo "  3. Deploy new containers"
    echo ""
    exit 0
fi

# =============================================================================
# Step 5: Confirm and push
# =============================================================================
if [ "$CONFIRM" != true ]; then
    echo -e "${YELLOW}This will push to origin/$CURRENT_BRANCH and trigger a deploy.${NC}"
    echo ""
    read -p "Continue? (y/N) " push_confirm
    if [ "$push_confirm" != "y" ] && [ "$push_confirm" != "Y" ]; then
        echo "Aborted."
        exit 0
    fi
fi

echo ""
echo -e "${YELLOW}Pushing to origin/$CURRENT_BRANCH...${NC}"

if git push origin "$CURRENT_BRANCH"; then
    echo ""
    echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}${BOLD}║                      Push Complete                           ║${NC}"
    echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}Pushed:${NC} $COMMIT_COUNT commit(s) to origin/$CURRENT_BRANCH"
    echo ""
    echo -e "${BOLD}What happens next:${NC}"
    echo "  1. Render detects the push and starts building"
    echo "  2. Docker image built with new code"
    echo "  3. Migrations run automatically on container start"
    echo "  4. New containers replace old ones (zero-downtime)"
    echo ""
    echo -e "${BOLD}Monitor:${NC}"
    echo "  Dashboard: https://dashboard.render.com"
    echo "  Health:    https://legal-platform-gateway.onrender.com/health"
    echo ""
else
    echo -e "${RED}ERROR: Push failed${NC}"
    exit 1
fi
