#!/bin/bash
# Monitor Noventa/Negrea email sync status

echo "=== Negrea c. Noventa Email Sync Monitor ==="
echo ""

while true; do
  clear
  echo "=== Negrea c. Noventa Email Sync Monitor ==="
  echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""

  # Historical sync job status
  echo "--- Historical Sync Job ---"
  PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d legal_platform -t -c "
    SELECT
      'Status: ' || status ||
      ' | Synced: ' || COALESCE(synced_emails::text, '0') || '/' || COALESCE(total_emails::text, '?') ||
      CASE WHEN error_message IS NOT NULL THEN ' | Error: ' || error_message ELSE '' END
    FROM historical_email_sync_jobs
    WHERE case_id = '3d2b4f2a-7cd5-4ad7-970c-3ef3652625f1';
  " 2>/dev/null

  # Email count for case
  echo ""
  echo "--- Emails in Case ---"
  PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d legal_platform -t -c "
    SELECT 'Total: ' || COUNT(*) || ' emails'
    FROM emails
    WHERE case_id = '3d2b4f2a-7cd5-4ad7-970c-3ef3652625f1';
  " 2>/dev/null

  # Recent emails
  echo ""
  echo "--- Recent Emails (last 5) ---"
  PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d legal_platform -t -c "
    SELECT
      to_char(received_date_time, 'MM-DD HH24:MI') || ' | ' ||
      LEFT(\"from\"::json->>'name', 15) || ' | ' ||
      LEFT(subject, 40)
    FROM emails
    WHERE case_id = '3d2b4f2a-7cd5-4ad7-970c-3ef3652625f1'
    ORDER BY received_date_time DESC
    LIMIT 5;
  " 2>/dev/null

  # User sync status
  echo ""
  echo "--- User Sync State ---"
  PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d legal_platform -t -c "
    SELECT
      'User: ' || u.email || ' | Status: ' || ess.sync_status ||
      ' | Last sync: ' || to_char(ess.last_sync_at, 'MM-DD HH24:MI')
    FROM email_sync_states ess
    JOIN users u ON ess.user_id = u.id
    WHERE u.firm_id = '51f2f797-3109-4b79-ac43-a57ecc07bb06';
  " 2>/dev/null

  # BullMQ queue status
  echo ""
  echo "--- Queue Status ---"
  echo -n "Historical sync waiting: "
  docker exec legal-redis redis-cli LLEN "bull:historical-email-sync:wait" 2>/dev/null
  echo -n "Historical sync active: "
  docker exec legal-redis redis-cli LLEN "bull:historical-email-sync:active" 2>/dev/null
  echo -n "Historical sync failed: "
  docker exec legal-redis redis-cli ZCARD "bull:historical-email-sync:failed" 2>/dev/null

  echo ""
  echo "Press Ctrl+C to exit. Refreshing in 10s..."
  sleep 10
done
