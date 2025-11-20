# Production Database Migration Runbook

**Version:** 1.0
**Last Updated:** 2025-11-20
**Owner:** DevOps Team
**Status:** Active

## Overview

This runbook provides step-by-step procedures for safely executing database migrations in production environments. It includes pre-migration preparation, execution steps, verification procedures, and rollback instructions.

---

## Table of Contents

1. [Pre-Migration Checklist](#pre-migration-checklist)
2. [Migration Execution Steps](#migration-execution-steps)
3. [Post-Migration Verification](#post-migration-verification)
4. [Rollback Procedure](#rollback-procedure)
5. [Monitoring and Alerting](#monitoring-and-alerting)
6. [Troubleshooting](#troubleshooting)
7. [Migration Timeline Template](#migration-timeline-template)

---

## Pre-Migration Checklist

Complete ALL items before executing production migration:

### 1. Testing and Validation
- [ ] Migration tested on local development database (zero errors)
- [ ] Migration tested on staging environment (zero errors)
- [ ] Full test suite passes on staging post-migration (100% pass rate)
- [ ] Manual smoke tests completed on staging
- [ ] Performance impact assessed (query execution time, index creation time)
- [ ] Migration reviewed by another developer (peer review completed)

### 2. Backup and Safety
- [ ] Manual backup created: `pnpm db:backup` or `render db backup --database bojin-law-db`
- [ ] Backup verified (file size consistent, not corrupted)
- [ ] Safety backup stored securely (encrypted, off-site)
- [ ] Rollback procedure documented and tested on staging
- [ ] DOWN migration SQL prepared (if applicable)

### 3. Communication and Coordination
- [ ] Stakeholders notified 24 hours in advance
- [ ] Migration announcement sent (see [Migration Communication Template](../templates/migration-announcement-template.md))
- [ ] Maintenance window scheduled (low-traffic period identified)
- [ ] On-call engineer assigned and available
- [ ] Incident response team on standby
- [ ] Customer support team notified

### 4. Environment Preparation
- [ ] Migration SQL reviewed and validated
- [ ] Database connection credentials verified
- [ ] Render CLI authenticated (if using Render)
- [ ] Migration scripts accessible
- [ ] Rollback scripts ready
- [ ] Access to production database confirmed

### 5. Risk Assessment
- [ ] Migration risk level assessed (see [Migration Risk Assessment](migration-risk-assessment.md))
- [ ] Downtime estimate calculated
- [ ] Affected features documented
- [ ] Rollback deadline determined
- [ ] Contingency plan prepared

---

## Migration Execution Steps

### Timeline Overview

| Time | Step | Duration | Description |
|------|------|----------|-------------|
| T-0  | Announcement | 2 min | Post maintenance start notification |
| T+0  | Backup | 5 min | Create pre-migration backup |
| T+5  | Stop Services | 3 min | Scale down services (if downtime required) |
| T+8  | Execute Migration | 5-10 min | Apply database migration |
| T+18 | Verify | 5 min | Verify migration success |
| T+23 | Restart Services | 5 min | Scale up services |
| T+28 | Monitor | 30 min | Monitor application health |
| T+58 | Announcement | 2 min | Post completion notification |

**Total Estimated Time:** 60 minutes (1 hour maintenance window)

---

### Step 1: Announce Maintenance Start (T-0)

**Duration:** 2 minutes

```bash
# Post in #engineering Slack channel
"🚨 Database migration starting now
Purpose: [Brief description]
Estimated downtime: [X minutes]
Expected completion: [TIME]
Status updates: Every 15 minutes"
```

Update status page (if applicable):
- Status: Maintenance in Progress
- Affected Services: [List services]
- ETA: [Completion time]

---

### Step 2: Create Pre-Migration Backup (T+0 to T+5)

**Duration:** 5 minutes

#### Option A: Using Render CLI (Recommended for Render databases)

```bash
# Authenticate with Render
render auth login

# Create backup
render db backup --database bojin-law-db

# Verify backup created
render db backups --database bojin-law-db | head -n 5
```

**Expected Output:**
```
Backup ID: backup-abc123
Status: Completed
Size: 1.2 GB
Created: 2025-11-20 14:00:00 UTC
```

#### Option B: Using pg_dump (Alternative)

```bash
# Create backup directory
mkdir -p backups

# Create timestamped backup
pg_dump $DATABASE_URL | gzip > backups/backup-pre-migration-$(date +%Y%m%d-%H%M%S).sql.gz

# Verify backup size (should be consistent with database size)
ls -lh backups/
```

**Verification:**
- [ ] Backup completed successfully
- [ ] Backup ID or file path documented
- [ ] Backup size reasonable (not 0 bytes, not unexpectedly large)

---

### Step 3: Stop Application Services (T+5 to T+8)

**Duration:** 3 minutes

**Note:** Only required if migration requires downtime (see zero-downtime patterns for alternatives)

```bash
# Scale down web service
render scale --service bojin-law-web --replicas 0

# Scale down gateway service
render scale --service bojin-law-gateway --replicas 0

# Verify services stopped
render services status
```

**Expected State:**
- bojin-law-web: 0/0 replicas
- bojin-law-gateway: 0/0 replicas

**Verification:**
- [ ] All services scaled to 0
- [ ] No active connections to database (check connection pool)

---

### Step 4: Apply Database Migration (T+8 to T+18)

**Duration:** 5-10 minutes (depends on migration complexity)

#### Option A: Using Prisma Migrate (Recommended)

```bash
# SSH into Render service or use local terminal with production DATABASE_URL
render shell --service bojin-law-gateway

# Apply migration
npm run db:migrate:deploy

# Alternative: Use Prisma CLI directly
npx prisma migrate deploy --schema=./packages/database/prisma/schema.prisma
```

**Expected Output:**
```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL

1 migration found
Applying migration `20250120_add_user_authentication`
Migration applied successfully (15.2s)
```

#### Option B: Using Custom SQL Migration

```bash
# Execute SQL file
psql $DATABASE_URL -f packages/database/migrations/003_new_migration.sql
```

**Monitoring During Migration:**
- Watch for SQL errors
- Monitor execution time
- Check database locks (shouldn't block for >30 seconds)

**Verification:**
- [ ] Migration executed without errors
- [ ] No SQL exceptions in output
- [ ] Execution time within expected range (<10 minutes)

---

### Step 5: Verify Migration Success (T+18 to T+23)

**Duration:** 5 minutes

#### Check Migration Status

```bash
# Verify migration applied
npm run db:migrate:status

# Expected output should show migration as applied
```

#### Verify Schema Changes

```bash
# Connect to database
psql $DATABASE_URL

# Verify new tables/columns exist
\d users  # Example: check users table structure
\d+ users # Detailed view with indexes

# Verify data integrity (example queries)
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM _prisma_migrations WHERE migration_name LIKE '%20250120%';
```

#### Run Data Integrity Checks

```bash
# Run validation script
npm run db:validate

# Example validation script should check:
# - Foreign key constraints valid
# - No orphaned records
# - Indexes created correctly
# - Data types match schema
```

**Verification Checklist:**
- [ ] Migration marked as applied in `_prisma_migrations`
- [ ] Schema changes present in database
- [ ] Data integrity checks pass
- [ ] No constraint violations
- [ ] Indexes created successfully

---

### Step 6: Restart Application Services (T+23 to T+28)

**Duration:** 5 minutes

```bash
# Scale up web service
render scale --service bojin-law-web --replicas 2

# Scale up gateway service
render scale --service bojin-law-gateway --replicas 2

# Wait for services to become healthy
render services status

# Check service health endpoints
curl https://bojin-law-web.onrender.com/health
curl https://bojin-law-gateway.onrender.com/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "latency": 15
}
```

**Verification:**
- [ ] All services scaled to target replicas
- [ ] Health checks passing (200 OK)
- [ ] Database connection pool healthy (<80% utilization)

---

### Step 7: Post-Migration Monitoring (T+28 to T+58)

**Duration:** 30 minutes

#### Monitor Application Health

**Metrics to Watch:**

| Metric | Threshold | Action if Exceeded |
|--------|-----------|-------------------|
| Error rate | >10% for >5 minutes | Initiate rollback |
| Response time (p95) | >1000ms | Investigate, consider rollback |
| Database connections | >90% pool utilization | Scale up connections or rollback |
| Failed requests | >5% for >5 minutes | Initiate rollback |

#### Check Application Logs

```bash
# View recent logs for errors
render logs --service bojin-law-web --tail 100 | grep -i error
render logs --service bojin-law-gateway --tail 100 | grep -i error

# Monitor database connection errors
render logs --service bojin-law-gateway --tail 100 | grep -i "database"
```

#### Test Critical Workflows

Manually test (or use automated smoke tests):
- [ ] User login
- [ ] Case creation
- [ ] Document upload
- [ ] Search functionality
- [ ] Dashboard rendering

**Verification:**
- [ ] Error rate <1%
- [ ] Response time p95 <500ms
- [ ] Database connections <80% pool
- [ ] Critical workflows functional

---

### Step 8: Announce Migration Complete (T+58)

**Duration:** 2 minutes

```bash
# Post in #engineering Slack channel
"✅ Database migration completed successfully
Duration: [Actual time]
Downtime: [Actual downtime]
Status: All systems operational
Monitoring: Continuing for next 24 hours
Thanks for your patience!"
```

Update status page:
- Status: Operational
- Message: "Database migration completed successfully"

---

## Post-Migration Verification

### Extended Monitoring (24 hours)

Continue monitoring for:
- Error rates trending up
- Performance degradation
- Database query slow log entries
- User-reported issues

### Metrics Review (48 hours post-migration)

- [ ] Compare error rates pre/post migration
- [ ] Compare response times pre/post migration
- [ ] Review database query performance
- [ ] Analyze any spike in support tickets
- [ ] Document any anomalies

---

## Rollback Procedure

### Rollback Criteria

Initiate rollback immediately if ANY of these occur:

- Migration fails to apply (SQL error)
- Database schema in inconsistent state
- Application error rate >10% for >5 minutes
- Database connection failures >5% for >5 minutes
- Data integrity violations detected
- Critical functionality broken (user login, case creation, etc.)

### Rollback Steps

#### 1. Announce Rollback Decision (Immediate)

```bash
# Post in #engineering Slack
"🚨 Initiating migration rollback
Reason: [Brief description]
ETA: 15 minutes"
```

#### 2. Stop Application Services

```bash
render scale --service bojin-law-web --replicas 0
render scale --service bojin-law-gateway --replicas 0
```

#### 3. Restore from Pre-Migration Backup

##### Option A: Render Backup Restore

```bash
# List backups to find pre-migration backup
render db backups --database bojin-law-db

# Restore (replace [backup-id] with pre-migration backup ID)
render db restore --database bojin-law-db --backup [backup-id]

# Wait for restore to complete (5-15 minutes)
render db status --database bojin-law-db
```

##### Option B: pg_dump Restore

```bash
# Drop and recreate database
dropdb bojin_law_prod
createdb bojin_law_prod

# Restore from backup
gunzip -c backups/backup-pre-migration-20250120-140000.sql.gz | psql $DATABASE_URL
```

#### 4. Verify Rollback Success

```bash
# Verify migration NOT applied
npm run db:migrate:status

# Verify data integrity
npm run db:validate
```

#### 5. Restart Services with Previous Code Version

```bash
# Rollback code deployment first
render rollback --service bojin-law-web --to-deploy [previous-deploy-id]
render rollback --service bojin-law-gateway --to-deploy [previous-deploy-id]

# Scale services back up
render scale --service bojin-law-web --replicas 2
render scale --service bojin-law-gateway --replicas 2
```

#### 6. Verify Application Functionality

- [ ] Health checks passing
- [ ] Error rates returned to normal
- [ ] Critical workflows functional
- [ ] Monitor for 15 minutes

#### 7. Post-Rollback Investigation

- Root cause analysis of migration failure
- Document lessons learned
- Fix migration issues before retry
- Update runbook with learnings

---

## Monitoring and Alerting

### Key Metrics

| Metric | Tool | Alert Threshold |
|--------|------|----------------|
| Error rate | New Relic / Render Metrics | >5% for >5 min |
| Response time (p95) | New Relic | >1000ms |
| Database connections | PostgreSQL | >90% pool |
| Database latency | New Relic | >100ms p95 |
| Failed migrations | Logs | Any failure |

### Alert Channels

- #engineering Slack channel
- PagerDuty (for critical alerts)
- Email to DevOps team

---

## Troubleshooting

### Common Issues

#### Issue: Migration Fails with Foreign Key Constraint Violation

**Symptoms:**
```
ERROR: insert or update on table violates foreign key constraint
```

**Resolution:**
1. Check data integrity before migration
2. Ensure parent records exist before creating child records
3. Consider adding foreign key with `NOT VALID` first, then validating separately

---

#### Issue: Migration Times Out

**Symptoms:**
```
ERROR: timeout exceeded
```

**Resolution:**
1. Increase statement timeout: `SET statement_timeout = '600000'` (10 minutes)
2. Break migration into smaller batches
3. Run large data migrations as background jobs
4. Consider zero-downtime pattern (expand-contract)

---

#### Issue: Application Can't Connect to Database After Migration

**Symptoms:**
```
ERROR: connection refused / connection pool exhausted
```

**Resolution:**
1. Check database is running: `render db status`
2. Verify connection string correct
3. Check connection pool not exhausted
4. Restart services: `render restart --service bojin-law-gateway`

---

#### Issue: New Columns/Tables Not Visible

**Symptoms:**
```
ERROR: column "new_column" does not exist
```

**Resolution:**
1. Verify migration applied: `npm run db:migrate:status`
2. Clear Prisma Client cache: `npx prisma generate`
3. Redeploy application with updated Prisma Client
4. Check schema cache not stale

---

## Migration Timeline Template

Use this template for planning migrations:

```markdown
### Migration: [Migration Name]
**Date:** [YYYY-MM-DD]
**Time:** [HH:MM timezone]
**Risk Level:** [Low / Medium / High]
**Estimated Downtime:** [X minutes or Zero]

#### Timeline
- **T-24h:** Send migration announcement
- **T-1h:** Final verification on staging
- **T-30m:** Team standup, final go/no-go decision
- **T-0:** Begin maintenance window
- **T+0:** Create backup
- **T+5:** Stop services (if required)
- **T+8:** Execute migration
- **T+18:** Verify success
- **T+23:** Restart services
- **T+28:** Monitor (30 min)
- **T+58:** Complete, send announcement

#### Rollback Deadline
If issues detected within [X hours], rollback immediately.

#### Team Assignments
- **Migration Executor:** [Name]
- **On-call Engineer:** [Name]
- **Backup Support:** [Name]
```

---

## References

- [Migration Risk Assessment Checklist](migration-risk-assessment.md)
- [Migration Communication Template](../templates/migration-announcement-template.md)
- [Zero-Downtime Migration Patterns](../architecture/database-migration-patterns.md)
- [Operations Runbook](../../infrastructure/OPERATIONS_RUNBOOK.md)
- [Deployment Guide](../../infrastructure/DEPLOYMENT_GUIDE.md)

---

**Document Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-20 | Dev Agent | Initial creation |
