#!/bin/bash
# Dead Code Cleanup Script
# Generated from codebase audit on 2026-01-12
# Updated after testing to remove files that are actually imported by live services
#
# Run with: ./scripts/cleanup-dead-code.sh
# Dry run:  ./scripts/cleanup-dead-code.sh --dry-run

DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "=== DRY RUN MODE - No files will be deleted ==="
  echo ""
fi

DELETED_COUNT=0

delete_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    if $DRY_RUN; then
      echo "[DRY RUN] Would delete: $file"
    else
      rm "$file"
      echo "Deleted: $file"
    fi
    DELETED_COUNT=$((DELETED_COUNT + 1))
  else
    echo "Already gone: $file"
  fi
}

echo "=================================="
echo "BACKEND SERVICES (5 files)"
echo "=================================="

# Unused services (verified not imported anywhere)
delete_file "services/gateway/src/services/action-executor.service.ts"
delete_file "services/gateway/src/services/deadline-warning.service.ts"
delete_file "services/gateway/src/services/email-privacy.service.ts"
delete_file "services/gateway/src/services/pdf-attachment-parser.service.ts"
delete_file "services/gateway/src/services/task-warning.service.ts"

echo ""
echo "=================================="
echo "BACKEND WORKERS (11 files)"
echo "=================================="

# Unused workers (verified not imported anywhere)
delete_file "services/gateway/src/workers/bulk-communication.worker.ts"
delete_file "services/gateway/src/workers/communication-intelligence.worker.ts"
delete_file "services/gateway/src/workers/deadline-events.worker.ts"
delete_file "services/gateway/src/workers/document-sync.worker.ts"
delete_file "services/gateway/src/workers/lock-cleanup.worker.ts"
delete_file "services/gateway/src/workers/monthly-intelligence-report.worker.ts"
delete_file "services/gateway/src/workers/morning-briefing.worker.ts"
delete_file "services/gateway/src/workers/notification-processor.worker.ts"
delete_file "services/gateway/src/workers/subscription-renewal.worker.ts"
delete_file "services/gateway/src/workers/suggestion-cleanup.worker.ts"
delete_file "services/gateway/src/workers/suggestion-pattern-analysis.worker.ts"

echo ""
echo "=================================="
echo "BACKEND MIDDLEWARE (1 file)"
echo "=================================="

delete_file "services/gateway/src/middleware/token-refresh.middleware.ts"

echo ""
echo "=================================="
echo "FRONTEND COMPONENTS (3 files)"
echo "=================================="

delete_file "apps/web/src/components/forms/fields/DateTimeField.tsx"
delete_file "apps/web/src/components/calendar/OverflowTaskCard.tsx"
delete_file "apps/web/src/components/calendar/EventDetailsPanel.tsx"

echo ""
echo "=================================="
echo "FRONTEND HOOKS (2 files)"
echo "=================================="

delete_file "apps/web/src/hooks/useCalendarDragDrop.ts"
delete_file "apps/web/src/hooks/useTemplateFromDocument.ts"

echo ""
echo "=================================="
echo "SUMMARY"
echo "=================================="
if $DRY_RUN; then
  echo "Would delete $DELETED_COUNT files"
  echo ""
  echo "Run without --dry-run to actually delete files"
else
  echo "Deleted $DELETED_COUNT files"
  echo ""
  echo "Next steps:"
  echo "1. Run: pnpm --filter gateway exec tsc --noEmit"
  echo "2. Run: pnpm --filter web exec tsc --noEmit"
  echo "3. If clean, commit: git add -A && git commit -m 'chore: remove unused dead code'"
fi
