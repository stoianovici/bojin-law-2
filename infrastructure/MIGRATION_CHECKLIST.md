# Render Migration Checklist

Complete checklist for migrating from Azure to Render.com infrastructure.

**Migration Overview:**

- **From:** Azure AKS/Kubernetes (planned, not deployed)
- **To:** Render.com PaaS
- **Strategy:** Greenfield deployment (no existing infrastructure to migrate)
- **Timeline:** 2-3 weeks
- **Risk:** Low (no production data, pre-deployment pivot)

---

## Pre-Migration Checklist

Complete these tasks before beginning the migration.

### 1. Render Account Setup

- [ ] Create Render account (https://render.com/signup)
- [ ] Verify email and complete account setup
- [ ] Add payment method to Render account
- [ ] Enable billing for production deployments
- [ ] Invite team members to Render organization
- [ ] Set up two-factor authentication (2FA)
- [ ] Review Render pricing and understand costs ($207/month expected)

**Time Estimate:** 30 minutes
**Owner:** Platform Operator
**Documentation:** https://render.com/docs/getting-started

### 2. GitHub Integration

- [ ] Connect GitHub repository to Render
- [ ] Authorize Render to access repository
- [ ] Verify Render can read repository content
- [ ] Test webhook connectivity (optional preview)
- [ ] Configure branch permissions (main = production, develop = staging)

**Time Estimate:** 15 minutes
**Owner:** Platform Operator
**Documentation:** https://render.com/docs/github

### 3. Environment Variables Preparation

- [ ] Review `infrastructure/ENVIRONMENT_VARIABLES.md`
- [ ] Prepare all required environment variables
- [ ] Generate JWT_SECRET (use: `openssl rand -base64 32`)
- [ ] Obtain third-party API keys (OpenAI, SMTP, etc.)
- [ ] Create separate variable files for staging and production
- [ ] Document secret rotation schedule (90 days)
- [ ] Set up secure password manager for secrets

**Time Estimate:** 2 hours
**Owner:** Platform Operator + Team Lead
**Documentation:** `infrastructure/ENVIRONMENT_VARIABLES.md`

### 4. render.yaml Validation

- [ ] Review `render.yaml` in project root
- [ ] Verify all 7 services are defined correctly
- [ ] Confirm database and Redis configurations
- [ ] Validate health check paths (/health, /api/health)
- [ ] Check resource allocations (2×4GB web/gateway, 1×2GB services)
- [ ] Verify auto-deploy triggers (commit on main/develop)
- [ ] Test render.yaml syntax (optional: Render CLI validation)

**Time Estimate:** 30 minutes
**Owner:** Developer
**Documentation:** https://render.com/docs/yaml-spec

### 5. Database Migration Plan

- [ ] Design database schema (Prisma migrations)
- [ ] Prepare seed data for staging environment
- [ ] Create database backup strategy
- [ ] Plan zero-downtime migration approach (if needed)
- [ ] Document rollback procedures
- [ ] Test migrations in local Docker environment

**Time Estimate:** 4 hours
**Owner:** Developer
**Documentation:** `infrastructure/DEPLOYMENT_GUIDE.md`

### 6. Team Training

- [ ] Share Render documentation with team
- [ ] Review `infrastructure/DEPLOYMENT_GUIDE.md` with team
- [ ] Review `infrastructure/OPERATIONS_RUNBOOK.md` with team
- [ ] Demo Render dashboard features
- [ ] Practice deployment using `scripts/render/` helpers
- [ ] Assign on-call rotation for migration week
- [ ] Create team communication channel (Slack/Discord)

**Time Estimate:** 3 hours
**Owner:** Team Lead
**Documentation:** `infrastructure/DEPLOYMENT_GUIDE.md`

### 7. Pre-Flight Checks

- [ ] All GitHub Actions workflows passing
- [ ] All unit and integration tests passing
- [ ] Docker images build successfully
- [ ] `render.yaml` validated
- [ ] Environment variables documented
- [ ] Team trained and ready
- [ ] Backup plan documented
- [ ] Rollback procedures documented

**Time Estimate:** 1 hour
**Owner:** Team Lead
**Sign-off Required:** Yes

---

## Migration Steps

Execute these steps in order to complete the migration.

### Phase 1: Staging Environment Deployment (Day 1-2)

#### Step 1: Create Render Services (Staging)

**Time:** 30 minutes

- [ ] Log in to Render dashboard (https://dashboard.render.com)
- [ ] Click "New" → "Blueprint" (if using render.yaml)
  - OR manually create each service from dashboard
- [ ] Select GitHub repository
- [ ] Select `develop` branch for staging
- [ ] Review service configurations
- [ ] Confirm resource allocations
- [ ] Click "Apply" to create all services

**Expected Result:** 9 services created (7 web services, 1 database, 1 Redis)

**Rollback:** Delete all services from Render dashboard

#### Step 2: Configure Environment Variables (Staging)

**Time:** 1 hour

For each service:

- [ ] Navigate to service in Render dashboard
- [ ] Go to "Environment" tab
- [ ] Add all required environment variables
- [ ] Verify Render auto-injected variables (DATABASE_URL, REDIS_URL)
- [ ] Save changes
- [ ] Repeat for all 7 services

**Shortcut:** Use `scripts/render/env-sync.sh` with staging .env file

**Expected Result:** All services have required environment variables

**Rollback:** Update environment variables, redeploy services

#### Step 3: Initial Deployment (Staging)

**Time:** 15 minutes (build time)

- [ ] Trigger deployment (automatic if webhook connected)
  - OR click "Manual Deploy" for each service
- [ ] Monitor deployment logs in Render dashboard
- [ ] Verify all services deploy successfully
- [ ] Check service health status (should be "Live")

**Expected Result:** All 7 services show "Live" status

**Rollback:** Delete services and restart from Step 1

#### Step 4: Database Initialization (Staging)

**Time:** 30 minutes

- [ ] Open shell in gateway service: `npm run shell gateway`
- [ ] Run database migrations: `npx prisma migrate deploy`
- [ ] Verify migrations applied: `npx prisma migrate status`
- [ ] Seed staging data: `npm run db:seed` (if applicable)
- [ ] Verify database connectivity from all services

**Expected Result:** Database schema created, seed data loaded

**Rollback:** Drop database, re-create, run migrations again

#### Step 5: Smoke Tests (Staging)

**Time:** 1 hour

- [ ] Test web app loads: Visit staging URL
- [ ] Test API gateway: `curl https://gateway-staging.onrender.com/api/health`
- [ ] Test authentication flow (if implemented)
- [ ] Test database reads/writes
- [ ] Test Redis connectivity
- [ ] Test file uploads (if applicable)
- [ ] Test inter-service communication
- [ ] Review logs for errors: `npm run logs:web`

**Expected Result:** All smoke tests pass, no critical errors

**Rollback:** Review logs, fix issues, redeploy

#### Step 6: Integration Tests (Staging)

**Time:** 2 hours

- [ ] Run integration test suite against staging
- [ ] Test API endpoints
- [ ] Test database operations
- [ ] Test service-to-service communication
- [ ] Verify environment variables
- [ ] Check monitoring data collection (if enabled)

**Expected Result:** All integration tests pass

**Rollback:** Fix failing tests, redeploy

#### Step 7: Load Testing (Staging)

**Time:** 2 hours

- [ ] Run load tests (100 concurrent users)
- [ ] Monitor CPU/memory usage in Render dashboard
- [ ] Verify auto-scaling triggers (if enabled)
- [ ] Check response times (p95 < 2s)
- [ ] Monitor error rates (<1%)
- [ ] Verify database connection pooling

**Expected Result:** System handles expected load without issues

**Rollback:** Adjust resource allocations, redeploy

#### Step 8: Staging Approval

**Time:** 30 minutes

- [ ] Demo staging environment to team
- [ ] Review all test results
- [ ] Review Render dashboard metrics
- [ ] Review logs for any warnings
- [ ] Get sign-off from team lead
- [ ] Document any issues found and resolutions

**Expected Result:** Staging approved for production deployment

**Decision Point:** Proceed to production OR fix issues

---

### Phase 2: Production Environment Deployment (Day 3-5)

#### Step 9: Pre-Production Backup

**Time:** 30 minutes

- [ ] Backup staging database: `npm run db-backup staging`
- [ ] Export staging environment variables as backup
- [ ] Backup current git state: `git tag v1.0.0-pre-render`
- [ ] Document current state for rollback

**Expected Result:** All backups completed and verified

#### Step 10: Create Production Services

**Time:** 30 minutes

- [ ] Log in to Render dashboard
- [ ] Click "New" → "Blueprint" (if using render.yaml)
- [ ] Select GitHub repository
- [ ] Select `main` branch for production
- [ ] Review service configurations
- [ ] **Use higher resource allocations:**
  - Web: 2× 4GB instances ($50/month)
  - Gateway: 2× 4GB instances ($50/month)
  - Services: 1× 2GB each ($15/month each)
  - PostgreSQL: Standard 25GB ($25/month)
  - Redis: 1GB ($10/month)
- [ ] Click "Apply" to create all services

**Expected Result:** 9 production services created

**Rollback:** Delete production services, continue using staging

#### Step 11: Configure Production Environment Variables

**Time:** 1 hour

For each production service:

- [ ] Navigate to service in Render dashboard
- [ ] Go to "Environment" tab
- [ ] Add all production environment variables
- [ ] Use production secrets (different from staging)
- [ ] Verify Render auto-injected variables
- [ ] Double-check all values (no staging URLs)
- [ ] Save changes

**CRITICAL:** Verify JWT_SECRET, database credentials, API keys are production values

**Expected Result:** All production services configured correctly

**Rollback:** Fix environment variables, redeploy

#### Step 12: Production Deployment

**Time:** 15 minutes (build time)

- [ ] Trigger production deployment
- [ ] Monitor deployment logs closely
- [ ] Verify all services deploy successfully
- [ ] Check service health status (should be "Live")
- [ ] Monitor for any startup errors

**Expected Result:** All services deployed and healthy

**Rollback:** Rollback deployment in Render dashboard

#### Step 13: Production Database Setup

**Time:** 30 minutes

- [ ] Open shell in production gateway: `npm run shell gateway --env production`
- [ ] Run database migrations: `npx prisma migrate deploy`
- [ ] Verify migrations: `npx prisma migrate status`
- [ ] DO NOT seed with test data (production is empty initially)
- [ ] Verify database connectivity from all services

**Expected Result:** Production database schema created

**Rollback:** Drop database, re-create, run migrations

#### Step 14: DNS Configuration

**Time:** 1 hour (plus DNS propagation time: 24-48 hours)

- [ ] Add custom domain in Render dashboard
- [ ] Get DNS records from Render (A/CNAME records)
- [ ] Update DNS records in domain registrar
- [ ] Configure `www` subdomain redirect (if applicable)
- [ ] Wait for DNS propagation (check with `dig yourapp.com`)
- [ ] Verify HTTPS certificate issued by Render (Let's Encrypt)
- [ ] Test domain access: https://yourapp.com

**Expected Result:** Domain points to Render production, HTTPS works

**Rollback:** Revert DNS records

#### Step 15: Production Smoke Tests

**Time:** 2 hours

- [ ] Test web app loads: Visit production URL
- [ ] Test API gateway health endpoint
- [ ] Test user registration/authentication
- [ ] Test database operations
- [ ] Test all critical user flows
- [ ] Verify email sending works
- [ ] Check monitoring data collection
- [ ] Review production logs for errors

**Expected Result:** All critical flows work, no errors

**Rollback:** Take production offline, fix issues

#### Step 16: Production Monitoring Setup

**Time:** 1 hour

See Task 23 for detailed monitoring setup. Quick checklist:

- [ ] Configure Render native monitoring
- [ ] Set up uptime monitoring
- [ ] Configure alert channels (email, Slack)
- [ ] Set up error tracking (optional: Sentry)
- [ ] Configure CPU/memory alerts
- [ ] Test alert delivery

**Expected Result:** Monitoring active, alerts configured

---

### Phase 3: Cutover and Verification (Day 6-7)

#### Step 17: Production Launch

**Time:** 30 minutes

- [ ] Announce production deployment to team
- [ ] Share production URL with team
- [ ] Begin 48-hour monitoring period
- [ ] Assign on-call engineer for first week
- [ ] Monitor Render dashboard continuously

**Expected Result:** Production live and stable

#### Step 18: Post-Launch Monitoring (48 hours)

**Time:** Continuous for 48 hours

- [ ] Monitor CPU/memory usage (should be <60% average)
- [ ] Monitor error rates (should be <0.1%)
- [ ] Monitor response times (p95 <2s)
- [ ] Check database connection pool
- [ ] Verify auto-scaling works (if triggered)
- [ ] Review logs every 4 hours
- [ ] Respond to alerts immediately

**Expected Result:** No critical issues, system stable

**Escalation:** If critical issues, roll back immediately

#### Step 19: User Acceptance Testing

**Time:** 4 hours

- [ ] Invite select users to test production
- [ ] Gather feedback on performance
- [ ] Monitor user sessions in production logs
- [ ] Document any issues reported
- [ ] Fix any critical bugs immediately

**Expected Result:** Users can use production successfully

#### Step 20: Cost Validation

**Time:** 30 minutes

- [ ] Review Render billing dashboard
- [ ] Verify costs match estimates ($207/month ±10%)
- [ ] Check for unexpected charges
- [ ] Set up budget alerts ($230/month warning)
- [ ] Document actual vs estimated costs

**Expected Result:** Costs within budget

---

## Post-Migration Checklist

Complete these tasks after production is stable.

### Immediate (Day 8-10)

- [ ] **Verify Production Health**
  - All services running without errors
  - Response times acceptable
  - Error rates below threshold
  - Monitoring data being collected

- [ ] **Document Issues**
  - Create list of all issues encountered
  - Document resolutions
  - Update runbooks with learnings

- [ ] **Update Team Documentation**
  - Share production URLs with team
  - Update README with production links
  - Update internal wiki/docs

- [ ] **Enable Full Monitoring**
  - Complete Task 23 (Configure Monitoring)
  - Set up alerts for all critical metrics
  - Test alert delivery

### Week 2

- [ ] **48-Hour Stability Check**
  - Review all logs from first 48 hours
  - Verify no critical issues
  - Confirm costs within budget
  - Validate monitoring accuracy

- [ ] **Performance Baseline**
  - Document baseline performance metrics
  - Set up performance budgets
  - Configure performance alerts

- [ ] **Team Training**
  - Complete Task 24 (Team Training and Handoff)
  - Ensure all team members can deploy
  - Practice incident response scenarios

### Week 3-4

- [ ] **Decommission Azure (If Any Resources Exist)**
  - Complete Task 25 (Decommission Azure Resources)
  - Verify no Azure costs
  - Archive Azure documentation

- [ ] **Final Migration Report**
  - Complete Task 26 (Create Final Migration Report)
  - Share with stakeholders
  - Celebrate success! 🎉

---

## Rollback Procedures

### Immediate Rollback (If Critical Issues During Migration)

**Scenario:** Critical issues discovered during or immediately after deployment

**Steps:**

1. **Stop deployments:** Disable auto-deploy in Render dashboard
2. **Roll back service:** Click "Rollback" in Render dashboard for affected service
3. **Verify rollback:** Check service is running previous version
4. **Communicate:** Notify team of rollback
5. **Investigate:** Review logs to identify issue
6. **Fix:** Correct issue in code
7. **Redeploy:** Deploy fix to staging, test, then production

**Time:** 15 minutes

### Full Rollback (If Migration Needs to be Aborted)

**Scenario:** Major issues requiring complete migration abort

**Steps:**

1. **Take production offline:** Disable all Render services
2. **Preserve data:** Backup Render database if any data exists
3. **Notify stakeholders:** Send communication about rollback
4. **Review issues:** Conduct post-mortem meeting
5. **Plan remediation:** Create action plan to fix issues
6. **Retry migration:** Schedule new migration date

**Time:** 2 hours

**Note:** Since this is a greenfield deployment (no existing production), full rollback simply means not proceeding with Render and reconsidering infrastructure options.

---

## Emergency Contacts

**Render Support:**

- Email: support@render.com
- Dashboard: https://dashboard.render.com/support
- Status Page: https://status.render.com

**Team Contacts:**

- **Platform Operator:** [Name] - [Phone] - [Email]
- **Team Lead:** [Name] - [Phone] - [Email]
- **On-Call Engineer:** [Name] - [Phone] - [Email]

**Escalation Path:**

1. On-Call Engineer (first 15 minutes)
2. Team Lead (after 15 minutes)
3. Platform Operator (after 30 minutes)
4. Render Support (if platform issue)

---

## Success Criteria

Migration is considered successful when:

- ✅ All 7 services deployed and healthy
- ✅ Database migrations completed successfully
- ✅ All smoke tests passing
- ✅ All integration tests passing
- ✅ Production accessible via custom domain
- ✅ HTTPS working correctly
- ✅ Monitoring active and collecting data
- ✅ 48 hours of stable operation
- ✅ Costs within budget ($207/month ±10%)
- ✅ Team trained and able to operate platform
- ✅ No critical issues reported

**Total Estimated Time:** 2-3 weeks (depending on team availability and issue resolution)

**Cost During Migration:** ~$100 (staging + production for 2 weeks)

---

## Appendix

### Useful Commands

```bash
# Setup Render CLI
./scripts/render/setup.sh

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production

# View logs
npm run logs:web
npm run logs:api

# Check status
npm run render:status

# Database backup
./scripts/render/db-backup.sh --env production

# Database restore
./scripts/render/db-restore.sh [backup-id] --env production
```

### Related Documentation

- **Deployment Guide:** `infrastructure/DEPLOYMENT_GUIDE.md`
- **Operations Runbook:** `infrastructure/OPERATIONS_RUNBOOK.md`
- **Environment Variables:** `infrastructure/ENVIRONMENT_VARIABLES.md`
- **Cost Estimation:** `infrastructure/COST_ESTIMATION.md`
- **Render Documentation:** https://render.com/docs

---

**Checklist Version:** 1.0
**Last Updated:** 2025-11-17
**Author:** James (Developer)
**Approved By:** [Pending]
