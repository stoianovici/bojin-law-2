#!/bin/bash
# Setup scanned documents feature
# 1. Runs database migration to add skip_reason column
# 2. Re-runs duplicate detection to populate skip_reason
#
# Usage:
#   ./scripts/setup-scanned-docs.sh <sessionId>
#
# Example:
#   ./scripts/setup-scanned-docs.sh 8267942a-3721-4956-b866-3aad8e56a1bb

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION_ID="$1"

if [ -z "$SESSION_ID" ]; then
    echo "Usage: ./scripts/setup-scanned-docs.sh <sessionId>"
    echo ""
    echo "Example:"
    echo "  ./scripts/setup-scanned-docs.sh 8267942a-3721-4956-b866-3aad8e56a1bb"
    exit 1
fi

echo "=== Scanned Documents Setup ==="
echo "Session ID: $SESSION_ID"
echo ""

# Step 1: Run migration
echo "Step 1: Running database migration..."
"${SCRIPT_DIR}/migrations/run-migration.sh" 001-add-skip-reason.sql

# Step 2: Run duplicate/scanned detection
echo ""
echo "Step 2: Running duplicate & scanned document detection..."
cd "${SCRIPT_DIR}/.."
node scripts/detect-duplicates.cjs "$SESSION_ID"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "The categorization UI now shows two tabs:"
echo "  - Documente Email: Regular email-extracted documents"
echo "  - Documente Scanate: Image-only PDFs (skip_reason = 'Scanned')"
echo ""
echo "Duplicates (skip_reason = 'Duplicate') are grouped with email documents."
