#!/bin/bash
# Run EmailCaseLink cleanup against production database
# OPS-186: Remove incorrect email-case links
#
# Usage:
#   ./scripts/run-cleanup-prod.sh              # Dry run
#   ./scripts/run-cleanup-prod.sh --execute    # Actually delete

set -e

echo "========================================"
echo "EmailCaseLink Cleanup - Production"
echo "========================================"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL not set."
  echo ""
  echo "Get it from Render Dashboard:"
  echo "  1. Go to: https://dashboard.render.com"
  echo "  2. Click: legal-platform-db"
  echo "  3. Click: Connect tab"
  echo "  4. Copy: External Database URL"
  echo ""
  read -p "Paste DATABASE_URL: " DATABASE_URL
  export DATABASE_URL
fi

echo ""
echo "Using database: ${DATABASE_URL:0:50}..."
echo ""

# Pass through all arguments to the script
pnpm exec tsx scripts/cleanup-email-case-links.ts "$@"
