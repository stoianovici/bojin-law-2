# Operations Runbook - Render.com

**Platform:** Render.com
**Last Updated:** 2025-11-17
**On-Call Rotation:** See [Emergency Contacts](#emergency-contacts)

---

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Incident Response](#incident-response)
3. [Backup & Recovery](#backup--recovery)
4. [Scaling Operations](#scaling-operations)
5. [Security Operations](#security-operations)
6. [Cost Management](#cost-management)
7. [Maintenance Windows](#maintenance-windows)
8. [Common Tasks](#common-tasks)
9. [Emergency Contacts](#emergency-contacts)

---

## Daily Operations

### Morning Health Check Routine (15 minutes)

**Run daily at 9:00 AM local time**

```bash
# 1. Check all service status
./scripts/render/status.sh

# Expected output:
# ✅ web: live (2 instances)
# ✅ gateway: live (2 instances)
# ✅ document-service: live (1 instance)
# ✅ ai-service: live (1 instance)
# ✅ task-service: live (1 instance)
# ✅ integration-service: live (1 instance)
# ✅ notification-service: live (1 instance)
# ✅ postgres: available
# ✅ redis: available

# 2. Check for failed deployments (last 24 hours)
render deploys list --status failed --since 24h

# 3. Review error logs (last 24 hours)
for service in web gateway document-service ai-service task-service integration-service notification-service; do
  echo "=== $service errors ==="
  render logs --service $service --level error --since 24h | head -20
done

# 4. Check database health
render db status --database postgres

# Expected:
# Status: available
# Connections: < 80/100
# Storage: < 20GB/25GB
# CPU: < 70%

# 5. Check Redis health
render shell --service web
redis-cli -u $REDIS_URL INFO stats | grep total_connections_received
redis-cli -u $REDIS_URL INFO memory | grep used_memory_human
exit

# 6. Review resource usage
render metrics --service web --since 24h

# Alert if:
# - CPU > 80% sustained
# - Memory > 85% sustained
# - Response time p95 > 2s
# - Error rate > 2%
```

**Action Items from Health Check:**

| Finding               | Severity    | Action                          | Timeline |
| --------------------- | ----------- | ------------------------------- | -------- |
| Service down          | 🔴 Critical | Immediate incident response     | < 5 min  |
| High error rate (>5%) | 🟠 High     | Investigate logs, create ticket | < 1 hour |
| High CPU/memory       | 🟡 Medium   | Schedule scaling operation      | < 1 day  |
| High database usage   | 🟡 Medium   | Review slow queries, optimize   | < 3 days |
| Failed deployment     | 🟢 Low      | Review deploy logs, fix code    | < 1 week |

---

### Log Monitoring

**Real-Time Monitoring:**

```bash
# Stream logs from all services (use tmux/screen)
tmux new-session -s render-logs

# Split panes for each service
tmux split-window -h
tmux split-window -v
tmux select-pane -t 0
tmux split-window -v

# Pane 1: Web logs
render logs --service web --tail

# Pane 2: Gateway logs
render logs --service gateway --tail

# Pane 3: Database errors
render logs --service gateway --tail | grep -i "database error"

# Pane 4: Application errors
render logs --service web --level error --tail
```

**Log Aggregation (New Relic):**

```bash
# View logs in New Relic (if configured)
# https://one.newrelic.com

# Search for errors
query: error OR exception
service: web
timerange: last 1 hour

# Common searches:
- "database connection refused"
- "ECONNREFUSED"
- "Internal Server Error"
- "timeout"
- "rate limit exceeded"
```

**Log Retention:**

- Render: 30 days (free)
- New Relic: 90 days (free tier)
- Archive critical logs to S3 for long-term retention

---

### Performance Review (Weekly)

**Run every Monday at 10:00 AM**

```bash
# 1. Generate weekly performance report
./scripts/render/weekly-report.sh

# 2. Review key metrics
cat weekly-report-$(date +%Y-%m-%d).md

# Key metrics:
- Average response time (target: < 500ms p95)
- Error rate (target: < 1%)
- Uptime (target: 99.9%)
- Deployment frequency (target: 10+ per week)
- Deployment success rate (target: 95%+)

# 3. Identify performance regressions
# Compare week-over-week:
- Response time increased > 20% → Investigate
- Error rate increased > 50% → Investigate
- Uptime < 99.9% → Root cause analysis

# 4. Review slow endpoints
render metrics --service gateway --since 7d | grep "p95 > 1000"

# 5. Database query performance
render shell --service gateway
psql $DATABASE_URL

SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE mean_time > 100  -- Queries slower than 100ms
ORDER BY total_time DESC
LIMIT 10;

\q
exit

# 6. Create action items
# - Optimize slow queries
# - Add database indexes
# - Implement caching
# - Scale services if needed
```

---

## Incident Response

### Severity Levels

| Level             | Definition                                | Response Time | Escalation                 |
| ----------------- | ----------------------------------------- | ------------- | -------------------------- |
| **P0 - Critical** | Production down, all users affected       | < 5 minutes   | Page on-call + DevOps lead |
| **P1 - High**     | Major feature broken, >50% users affected | < 30 minutes  | Notify on-call             |
| **P2 - Medium**   | Minor feature broken, <50% users affected | < 2 hours     | Create ticket              |
| **P3 - Low**      | Cosmetic issue, no functionality impact   | < 1 day       | Create ticket              |

---

### Incident Response Process

**Step 1: Detection**

Incidents detected via:

- ✅ Render health check failure email
- ✅ New Relic alert
- ✅ PagerDuty alert
- ✅ User-reported issue
- ✅ Daily health check

**Step 2: Initial Response (5 minutes)**

```bash
# 1. Acknowledge incident
# - PagerDuty: Click "Acknowledge"
# - Slack: Post in #incidents channel

# 2. Quick triage
./scripts/render/status.sh

# 3. Check recent deployments
render deploys list --limit 5

# 4. Check service logs
render logs --service <affected-service> --level error --tail

# 5. Determine severity (P0-P3)
```

**Step 3: Immediate Mitigation (15 minutes)**

**Option A: Rollback Deployment (if recent deploy caused issue)**

```bash
# Rollback to last successful deployment
render deploys list --service <affected-service>

# Get ID of last successful deploy
render deploys redeploy --deploy <previous-deploy-id>

# Monitor rollback
render logs --service <affected-service> --tail
```

**Option B: Restart Service (if service crashed)**

```bash
# Restart service
render services restart --service <affected-service>

# Monitor restart
render logs --service <affected-service> --tail
```

**Option C: Scale Up (if resource exhaustion)**

```bash
# Temporarily scale up
render services update \
  --service <affected-service> \
  --plan standard-plus  # 8GB RAM

# Or add instances
render services update \
  --service <affected-service> \
  --num-instances 4
```

**Step 4: Root Cause Analysis (30-60 minutes)**

```bash
# 1. Collect logs around incident time
render logs --service <affected-service> \
  --since 1h --level error > incident-logs.txt

# 2. Check database for issues
render shell --service gateway
psql $DATABASE_URL

-- Check for long-running queries
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '1 minute';

-- Check connection count
SELECT count(*) FROM pg_stat_activity;

-- Check database size
SELECT pg_database_size(current_database()) / 1024 / 1024 AS size_mb;

\q
exit

# 3. Check external dependencies
curl -I https://api.openai.com/v1/models  # AI service
curl -I https://api.sendgrid.com/v3/mail/send  # Email service

# 4. Review metrics during incident
render metrics --service <affected-service> --since 2h

# 5. Document findings
```

**Step 5: Resolution & Follow-up**

```bash
# 1. Verify service is healthy
./scripts/render/status.sh
curl https://legal-platform.onrender.com/health

# 2. Update incident ticket
# - Root cause identified
# - Mitigation applied
# - Service restored

# 3. Schedule post-mortem (within 48 hours)
# - What happened?
# - What was the impact?
# - What was the root cause?
# - How was it resolved?
# - How do we prevent recurrence?

# 4. Implement preventive measures
# - Add monitoring
# - Add alerting
# - Update runbook
# - Fix underlying issue
```

---

### Common Incidents & Solutions

#### Incident: Service Unavailable (503)

**Symptoms:** Users cannot access website, 503 Service Unavailable

**Causes:**

1. Service crashed
2. Health check failing
3. All instances down
4. Database connection exhausted

**Solution:**

```bash
# 1. Check service status
render services get --service web

# 2. Check logs for crash
render logs --service web --level error --tail

# 3. Common fixes:
# - Restart service
render services restart --service web

# - Scale up if resource exhaustion
render services update --service web --num-instances 3

# - Rollback if recent deployment
render deploys redeploy --deploy <previous-deploy-id>

# 4. Monitor recovery
render logs --service web --tail
curl https://legal-platform.onrender.com/health
```

---

#### Incident: Database Connection Refused

**Symptoms:** Application errors: "connect ECONNREFUSED"

**Causes:**

1. Database is down
2. Connection pool exhausted
3. Firewall blocking connections
4. DATABASE_URL incorrect

**Solution:**

```bash
# 1. Check database status
render db status --database postgres

# 2. Check connection count
render shell --service gateway
psql $DATABASE_URL

SELECT count(*), state FROM pg_stat_activity GROUP BY state;

-- If connections > 90:
-- Kill idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle' AND now() - state_change > interval '10 minutes';

\q
exit

# 3. Reduce connection pool in services
# Edit packages/database/src/pool.ts
max: 10,  # Reduce from 20

# Deploy fix
git add .
git commit -m "fix: reduce database connection pool size"
git push origin main

# 4. If database is down, contact Render support
# https://render.com/docs/support
```

---

#### Incident: High Memory Usage (OOM Kills)

**Symptoms:** Service crashes with "out of memory" error

**Causes:**

1. Memory leak in application
2. Large request payloads
3. Insufficient instance size

**Solution:**

```bash
# 1. Check memory usage
render metrics --service web

# 2. Immediate mitigation: Scale up
render services update --service web --plan standard-plus  # 8GB

# 3. Investigate memory leak
render logs --service web | grep "out of memory"

# 4. Profile memory usage locally
node --inspect apps/web/server.js
# Open chrome://inspect
# Take heap snapshots
# Identify memory leaks

# 5. Long-term fix
# - Fix memory leak in code
# - Optimize large data structures
# - Implement pagination
# - Add memory limits to queries
```

---

#### Incident: Slow Response Times

**Symptoms:** p95 response time > 2 seconds

**Causes:**

1. Slow database queries
2. N+1 queries
3. Missing indexes
4. High CPU usage
5. External API latency

**Solution:**

```bash
# 1. Identify slow endpoints
render metrics --service gateway --since 1h

# 2. Check database slow queries
render shell --service gateway
psql $DATABASE_URL

SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

# 3. Add missing indexes
CREATE INDEX CONCURRENTLY idx_cases_user_id ON cases(user_id);
CREATE INDEX CONCURRENTLY idx_tasks_case_id ON tasks(case_id);

\q
exit

# 4. Implement caching
# Add Redis caching for frequently accessed data

# 5. Optimize queries
# - Use SELECT specific columns (not SELECT *)
# - Add LIMIT to queries
# - Use database joins instead of N+1

# 6. Monitor external APIs
curl -w "@curl-format.txt" -o /dev/null -s https://api.openai.com/v1/models
```

---

## Backup & Recovery

### Database Backup Verification

**Render automatically backs up PostgreSQL daily.**

**Verify Backups:**

```bash
# List available backups
render db list-backups --database postgres

# Expected output:
# ID              Created              Size    Status
# bkp-xxxxx      2025-11-17 03:00     2.3GB   completed
# bkp-yyyyy      2025-11-16 03:00     2.1GB   completed
# bkp-zzzzz      2025-11-15 03:00     2.0GB   completed

# Verify backup size is growing (indicates data growth)
# Alert if backup size decreased > 10% (possible data loss)

# Test backup restoration (monthly)
# 1. Create test database
render db create --name postgres-test --plan starter

# 2. Restore backup to test database
render db restore \
  --database postgres-test \
  --backup-id bkp-xxxxx

# 3. Verify data
render shell --service gateway
psql postgresql://postgres-test...

SELECT count(*) FROM users;
SELECT count(*) FROM cases;
\q
exit

# 4. Delete test database
render db delete --database postgres-test
```

**Backup Schedule:**

| Backup Type | Frequency            | Retention | Location              |
| ----------- | -------------------- | --------- | --------------------- |
| Automated   | Daily at 3:00 AM UTC | 7 days    | Render                |
| Manual      | On-demand            | 30 days   | Render                |
| Export      | Weekly               | 90 days   | S3-compatible storage |

---

### Manual Backup

**Trigger manual backup before major changes:**

```bash
# Using new backup script (recommended)
cd packages/database
pnpm db:backup

# This script:
# - Detects Render vs local database
# - Creates timestamped backup
# - Compresses backup file
# - Provides safety reminders

# Alternative: Render CLI
render db backup --database bojin-law-db

# Verify backup created
render db backups --database bojin-law-db | head -5

# Export production data for development (with anonymization)
pnpm db:export  # Export to backups/ directory
```

**Backup Storage:**
- Local backups stored in: `packages/database/backups/`
- Render backups managed automatically
- External storage recommended for critical backups

**See also:**
- [Database Quick Start Guide](../docs/runbooks/database-quick-start.md)
- [Database Migration Runbook](../docs/runbooks/database-migration-runbook.md)

### Database Restore

**Restore from backup using the restore script:**

```bash
# Using new restore script (recommended)
cd packages/database
pnpm db:restore

# This script:
# - Prompts for backup file or Render backup ID
# - Creates safety backup before restore
# - Provides production safety checks
# - Verifies restore completion

# Alternative: Manual Render restore
render db backups --database bojin-law-db  # List backups
render db restore --database bojin-law-db --backup [backup-id]
```

**Restore Workflow:**
1. Stop all application services
2. Create safety backup of current state
3. Restore from backup file/Render backup
4. Verify data integrity
5. Restart application services
6. Monitor for issues

**See also:**
- [Database Restore Script](../packages/database/scripts/restore-database.sh)
- [Database Migration Runbook](../docs/runbooks/database-migration-runbook.md) (Rollback section)

---

### Point-in-Time Recovery

**Render PostgreSQL supports point-in-time recovery (PITR).**

**Restore to specific timestamp:**

```bash
# Example: Restore database to 2 hours ago

# 1. Create new database for recovery
render db create --name postgres-recovery --plan standard

# 2. Restore to point in time
render db restore \
  --database postgres-recovery \
  --timestamp "2025-11-17T10:00:00Z"

# 3. Verify recovered data
render shell --service gateway
psql postgresql://postgres-recovery...

SELECT * FROM users WHERE created_at < '2025-11-17 10:00:00';
\q
exit

# 4. If data is correct, swap databases
# a. Update DATABASE_URL to point to postgres-recovery
render env set --service web --key DATABASE_URL --value "postgresql://postgres-recovery..."
render env set --service gateway --key DATABASE_URL --value "postgresql://postgres-recovery..."

# b. Redeploy services
for service in web gateway document-service ai-service task-service integration-service notification-service; do
  render deploy --service $service
done

# c. Rename databases (optional)
render db rename --database postgres --new-name postgres-old
render db rename --database postgres-recovery --new-name postgres

# d. Delete old database after verification (48 hours)
render db delete --database postgres-old
```

---

### Disaster Recovery

**Scenario: Complete region outage**

**RTO (Recovery Time Objective):** 30 minutes
**RPO (Recovery Point Objective):** 24 hours (last backup)

**Recovery Steps:**

```bash
# 1. Verify Render region is down
curl https://status.render.com

# 2. Create new environment in different region
# Edit render.yaml:
region: oregon  # Switch from singapore

# 3. Deploy to new region
render blueprint deploy --file render.yaml --branch main

# 4. Restore latest backup
render db restore \
  --database postgres \
  --backup-id <latest-backup-id>

# 5. Update DNS to point to new region
# Cloudflare: Update A record
# Route53: Update ALIAS record

# 6. Verify services are live
./scripts/render/status.sh
curl https://legal-platform.com/health

# 7. Monitor for 24 hours
# Expected downtime: 20-30 minutes
```

---

## Scaling Operations

### Horizontal Scaling (Add Instances)

**When to Scale Horizontally:**

- Request rate increasing
- Need higher availability
- CPU usage > 70% sustained across all instances

**Scale Web Service:**

```bash
# Check current instance count
render services get --service web

# Current: 2 instances

# Scale up to 3 instances
render services update --service web --num-instances 3

# Monitor scaling
render logs --service web --tail

# Verify new instance is healthy
./scripts/render/status.sh

# Expected downtime: 0 seconds (rolling deployment)
```

**Auto-Scaling (Render Pro+ only):**

```yaml
# Add to render.yaml
services:
  - type: web
    name: web
    autoscaling:
      enabled: true
      minInstances: 2
      maxInstances: 10
      targetCPUPercent: 70
```

---

### Vertical Scaling (Increase RAM/CPU)

**When to Scale Vertically:**

- Memory usage > 80% sustained
- CPU usage > 80% sustained on single instance
- OOM (Out of Memory) errors

**Scale Up:**

```bash
# Current plan: Standard (4GB RAM, 2 vCPU)

# Scale up to Standard Plus (8GB RAM, 4 vCPU)
render services update --service web --plan standard-plus

# Monitor scaling
render logs --service web --tail

# Expected downtime: 0 seconds (rolling upgrade)

# Verify resource usage decreased
render metrics --service web

# If scaling up doesn't help, investigate:
# - Memory leaks
# - Inefficient code
# - Large data structures
```

**Scale Down (Cost Optimization):**

```bash
# If CPU < 40% and memory < 50% for 7+ days

# Scale down to Starter (2GB RAM, 1 vCPU)
render services update --service web --plan starter

# Savings: $10/month per instance
```

---

### Database Scaling

**When to Scale Database:**

- Storage > 80% capacity
- Connection count > 80 of limit
- CPU > 70% sustained

**Scale Storage:**

```bash
# Current: 25GB Standard

# Scale to 50GB
render db update --database postgres --plan standard-50gb

# Verify scaling
render db status --database postgres

# Expected downtime: 0 seconds (online scaling)
```

**Add Read Replicas (Heavy Read Workloads):**

```bash
# Create read replica
render db create-replica \
  --database postgres \
  --name postgres-replica \
  --region oregon

# Update application to use replica for reads
# packages/database/src/pool.ts
const readPool = new Pool({
  connectionString: process.env.DATABASE_REPLICA_URL
})

export const readQuery = (text, params) => readPool.query(text, params)
export const writeQuery = (text, params) => pool.query(text, params)

# Usage in application
// Read operations
const users = await readQuery('SELECT * FROM users')

// Write operations
const result = await writeQuery('INSERT INTO users (...) VALUES (...)')
```

---

## Security Operations

### Secret Rotation (Quarterly)

**JWT Secret Rotation:**

```bash
# 1. Generate new secret
NEW_JWT_SECRET=$(openssl rand -base64 32)

# 2. Add as environment variable (don't replace old yet)
render env set --service web --key NEW_JWT_SECRET --value "$NEW_JWT_SECRET"
render env set --service gateway --key NEW_JWT_SECRET --value "$NEW_JWT_SECRET"

# 3. Update application to accept both secrets (grace period)
# apps/web/src/lib/auth.ts
const JWT_SECRETS = [
  process.env.JWT_SECRET,      // Old secret
  process.env.NEW_JWT_SECRET   // New secret
]

export function verifyToken(token: string) {
  for (const secret of JWT_SECRETS) {
    try {
      return jwt.verify(token, secret)
    } catch (e) {
      continue
    }
  }
  throw new Error('Invalid token')
}

# 4. Deploy with dual-secret support
git add .
git commit -m "feat: support dual JWT secrets for rotation"
git push origin main

# 5. Wait 24 hours (all old tokens expire)

# 6. Replace JWT_SECRET with NEW_JWT_SECRET
render env set --service web --key JWT_SECRET --value "$NEW_JWT_SECRET"
render env set --service gateway --key JWT_SECRET --value "$NEW_JWT_SECRET"

# 7. Remove NEW_JWT_SECRET
render env delete --service web --key NEW_JWT_SECRET
render env delete --service gateway --key NEW_JWT_SECRET

# 8. Deploy final version
git revert <dual-secret-commit>
git push origin main
```

**Database Password Rotation:**

Render auto-rotates managed database passwords (no manual action required).

**API Key Rotation:**

```bash
# Anthropic API Key
# 1. Generate new key in Anthropic Console
# 2. Add new key to Render
render env set --service ai-service --key ANTHROPIC_API_KEY --value "sk-ant-new..."

# 3. Verify new key works
render logs --service ai-service --tail

# 4. Delete old key in OpenAI dashboard

# SendGrid API Key
# 1. Generate new key in SendGrid dashboard
# 2. Add new key to Render
render env set --service notification-service --key SMTP_PASS --value "SG.new..."

# 3. Verify emails are sending
render logs --service notification-service --tail

# 4. Delete old key in SendGrid dashboard
```

---

### SSL/TLS Management

**Render auto-manages SSL/TLS certificates (Let's Encrypt).**

**Verify SSL:**

```bash
# Check certificate expiration
echo | openssl s_client -servername legal-platform.com -connect legal-platform.com:443 2>/dev/null | openssl x509 -noout -dates

# Expected:
# notBefore=Nov 15 00:00:00 2025 GMT
# notAfter=Feb 13 23:59:59 2026 GMT  ← Should be > 30 days

# Render auto-renews 30 days before expiration
```

**Custom SSL Certificate (Optional):**

```bash
# 1. Upload certificate in Render dashboard
# Service → Settings → Custom Domain → Upload Certificate

# 2. Or use Cloudflare (recommended)
# - Cloudflare proxies SSL for you
# - Free SSL certificate
# - DDoS protection included
```

---

### Security Updates

**Operating System Updates:**

Render automatically applies security patches to base OS. No action required.

**Dependency Updates:**

```bash
# Weekly dependency update check (every Monday)

# 1. Check for vulnerabilities
npm audit

# 2. Fix vulnerabilities
npm audit fix

# 3. Check for outdated dependencies
npm outdated

# 4. Update critical security dependencies
npm update <package-name>

# 5. Test locally
pnpm test

# 6. Deploy
git add package.json package-lock.json
git commit -m "chore: update dependencies for security"
git push origin main
```

**Node.js Version Updates:**

```bash
# Update Node.js version in Dockerfiles

# infrastructure/docker/Dockerfile.web
FROM node:20-alpine  # Update to latest LTS

# Build and test
docker build -f infrastructure/docker/Dockerfile.web .

# Deploy
git add infrastructure/docker/Dockerfile.web
git commit -m "chore: update Node.js to 20.x LTS"
git push origin main
```

---

## Cost Management

### Weekly Cost Review (Every Monday)

```bash
# 1. Check current month spending
render billing current-month

# Expected: ~$207/month for production

# 2. Compare to budget
BUDGET=207
ACTUAL=$(render billing current-month --format json | jq '.total')

if [ "$ACTUAL" -gt "$((BUDGET * 110 / 100))" ]; then
  echo "⚠️ ALERT: Spending $ACTUAL > budget $BUDGET (110%)"
  # Send alert to Slack
  curl -X POST $SLACK_WEBHOOK_URL -d "{'text': '⚠️ Infrastructure costs exceed budget'}"
fi

# 3. Service-by-service breakdown
render billing breakdown --services

# Expected output:
# Service              Cost
# web                  $50
# gateway              $50
# document-service     $15
# ai-service           $15
# task-service         $15
# integration-service  $15
# notification-service $15
# postgres             $25
# redis                $10
# TOTAL                $207

# 4. Identify cost anomalies
# - Any service > 20% higher than baseline?
# - Preview environments still running?
# - Database storage growing faster than expected?

# 5. Cost optimization opportunities
# See COST_ESTIMATION.md → Cost Optimization Tips
```

---

### Usage Optimization

**Right-Size Instances:**

```bash
# 1. Check resource utilization (last 7 days)
for service in web gateway document-service ai-service task-service integration-service notification-service; do
  echo "=== $service ==="
  render metrics --service $service --since 7d | grep -E "cpu|memory"
done

# 2. If CPU < 40% AND memory < 50% for 7 days, scale down
# Example: document-service using 25% CPU, 40% memory
render services update --service document-service --plan free

# Savings: $15/month

# 3. If CPU > 80% OR memory > 85%, scale up
render services update --service web --plan standard-plus

# Cost increase: $25/month per instance (but prevents crashes)
```

**Database Query Optimization:**

```bash
# 1. Identify slow queries
render shell --service gateway
psql $DATABASE_URL

SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY total_time DESC
LIMIT 10;

# 2. Add indexes to speed up queries
CREATE INDEX CONCURRENTLY idx_cases_user_id_status ON cases(user_id, status);

# 3. Verify query performance improved
SELECT mean_time FROM pg_stat_statements WHERE query LIKE '%cases%';

# 4. Reduces database load → Delays scaling → Saves $20-40/month
```

---

### Anomaly Detection

**Set Up Cost Alerts:**

```bash
# Render Dashboard → Billing → Budget Alerts

# Alert 1: Warning at 110% of budget
Threshold: $228/month ($207 * 1.1)
Action: Email DevOps team
Frequency: Daily

# Alert 2: Critical at 125% of budget
Threshold: $259/month ($207 * 1.25)
Action: Email + Slack + SMS
Frequency: Immediate

# Alert 3: Emergency at 150% of budget
Threshold: $310/month ($207 * 1.5)
Action: Email + Slack + SMS + PagerDuty
Frequency: Immediate
```

**Common Cost Anomalies:**

| Anomaly                | Cause                             | Solution                    |
| ---------------------- | --------------------------------- | --------------------------- |
| Sudden 50% increase    | Preview environments not deleted  | Delete old preview envs     |
| Database cost doubled  | Storage grew beyond plan          | Archive old data, scale up  |
| Service cost increased | Accidentally scaled to large plan | Scale back down             |
| Redis cost increased   | Memory usage grew                 | Clear cache, optimize usage |

---

## Maintenance Windows

### Scheduling Maintenance

**Preferred Maintenance Windows:**

- **Day:** Sunday 2:00 AM - 6:00 AM UTC
- **Frequency:** Monthly (first Sunday of month)
- **Duration:** < 2 hours

**Notify Users (48 hours in advance):**

```bash
# 1. Create maintenance banner in application
# apps/web/src/components/MaintenanceBanner.tsx

export function MaintenanceBanner() {
  return (
    <div className="bg-yellow-100 border-b border-yellow-400 px-4 py-3">
      <p className="text-sm text-yellow-800">
        🔧 Scheduled maintenance: Sunday Nov 19, 2:00 AM - 4:00 AM UTC
        <br />
        Expected downtime: < 10 minutes
      </p>
    </div>
  )
}

# 2. Send email notification
# Subject: Scheduled Maintenance - Sunday Nov 19
# Body: We'll be performing scheduled maintenance...

# 3. Post on status page (if using statuspage.io)
```

---

### Zero-Downtime Deployments

**Render deployments are zero-downtime by default (rolling updates).**

**How Rolling Updates Work:**

1. Render spins up new instance with updated code
2. New instance passes health check
3. Render routes traffic to new instance
4. Old instance is shut down
5. Repeat for all instances

**Typical downtime: 0 seconds**

**Verify Zero-Downtime:**

```bash
# 1. Monitor health during deployment
while true; do
  curl -s https://legal-platform.com/health | jq '.status'
  sleep 1
done

# Expected: "healthy" throughout deployment

# 2. If health check fails during deployment, deployment is rolled back automatically
```

---

### Database Maintenance

**Render performs automatic database maintenance:**

- ✅ VACUUM (weekly, automatic)
- ✅ ANALYZE (daily, automatic)
- ✅ Index maintenance (automatic)

**Manual Maintenance (if performance degrades):**

```bash
# 1. Connect to database
render shell --service gateway
psql $DATABASE_URL

# 2. Run VACUUM ANALYZE
VACUUM ANALYZE;

# 3. Reindex tables (if queries slow)
REINDEX TABLE cases;
REINDEX TABLE users;

# 4. Check for bloat
SELECT schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

\q
exit
```

---

## Common Tasks

### Adding a New Service

```bash
# 1. Add service to render.yaml
services:
  - type: web
    name: analytics-service
    env: production
    buildCommand: pnpm build:analytics
    startCommand: pnpm start:analytics
    plan: starter
    region: oregon
    envVars:
      - key: NODE_ENV
        value: production

# 2. Commit and push
git add render.yaml
git commit -m "feat: add analytics service"
git push origin main

# 3. Render auto-creates new service

# 4. Add environment variables
render env set --service analytics-service --key DATABASE_URL --value "$DATABASE_URL"

# 5. Verify service is healthy
render services get --service analytics-service
render logs --service analytics-service --tail
```

---

### Updating Environment Variables

```bash
# Single service
render env set --service web --key API_KEY --value "new-value"

# Multiple services (shared variable)
for service in web gateway document-service ai-service task-service integration-service notification-service; do
  render env set --service $service --key JWT_SECRET --value "new-secret"
done

# Or use Environment Group (recommended)
render env-group update --group shared-production --key JWT_SECRET --value "new-secret"
```

---

### Viewing Logs

```bash
# Real-time logs
render logs --service web --tail

# Logs from last hour
render logs --service web --since 1h

# Error logs only
render logs --service web --level error

# Search logs
render logs --service web --since 24h | grep "database error"

# Export logs
render logs --service web --since 7d > web-logs-7days.txt
```

---

### Running One-Off Jobs

```bash
# Database migration
render jobs run --service gateway --command "pnpm db:migrate"

# Data seed
render jobs run --service gateway --command "pnpm db:seed"

# Database backup
render jobs run --service gateway --command "pg_dump $DATABASE_URL > backup.sql"

# Run script
render jobs run --service gateway --command "node scripts/fix-data.js"

# View job logs
render jobs logs --job <job-id>
```

---

## Emergency Contacts

### On-Call Rotation

| Week         | Primary On-Call | Secondary On-Call | Escalation  |
| ------------ | --------------- | ----------------- | ----------- |
| Nov 18-24    | John Doe        | Jane Smith        | DevOps Lead |
| Nov 25-Dec 1 | Jane Smith      | John Doe          | DevOps Lead |
| Dec 2-8      | John Doe        | Jane Smith        | DevOps Lead |

**On-Call Responsibilities:**

- Respond to P0/P1 incidents within 5 minutes
- Acknowledge PagerDuty alerts within 5 minutes
- Escalate to secondary if unable to resolve within 30 minutes
- Document incident in runbook

---

### Support Contacts

**Render Support:**

- 📧 Email: support@render.com (paid plans only)
- 💬 Community: https://community.render.com (free)
- 📚 Docs: https://render.com/docs
- 📊 Status: https://status.render.com
- 🐦 Twitter: @render (outage updates)

**Internal Team:**

- 📧 DevOps Lead: devops-lead@legal-platform.com
- 💬 Slack: #infrastructure-alerts
- 📞 PagerDuty: https://legal-platform.pagerduty.com
- 🗂️ Incident Management: https://legal-platform.atlassian.net/incidents

**Third-Party Services:**

- OpenAI Support: https://help.openai.com
- SendGrid Support: https://support.sendgrid.com
- Cloudflare Support: https://support.cloudflare.com
- New Relic Support: https://support.newrelic.com

---

### Escalation Path

**Level 1: On-Call Engineer (< 5 min)**

- Acknowledge incident
- Initial triage
- Attempt immediate mitigation

**Level 2: Secondary On-Call (< 30 min)**

- If primary unable to resolve in 30 minutes
- Provide additional expertise
- Coordinate with primary

**Level 3: DevOps Lead (< 1 hour)**

- If L1/L2 unable to resolve
- Make architectural decisions
- Coordinate with external vendors (Render support)

**Level 4: CTO (> 2 hours or critical business impact)**

- Extended outage (> 2 hours)
- Data loss or security incident
- Customer-facing communication required

---

## Quick Reference

### Critical Commands

```bash
# Status check
./scripts/render/status.sh

# View logs
./scripts/render/logs.sh <service>

# Deploy
./scripts/render/deploy.sh production

# Rollback
render deploys redeploy --deploy <deploy-id>

# Restart service
render services restart --service <service>

# Database backup
./scripts/render/db-backup.sh

# Open shell
./scripts/render/shell.sh <service>
```

---

**Last Updated:** 2025-11-17
**Next Review:** 2025-12-17 (monthly review)
**Maintainer:** DevOps Team

**Feedback:** If you find this runbook outdated or incomplete, please submit a PR or create an issue.
