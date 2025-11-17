# Migration Checklist: Azure → Render.com

**Purpose:** This checklist guides the migration from Azure AKS/Kubernetes infrastructure to Render.com PaaS platform.

**Migration Type:** Greenfield (no existing production data to migrate)

**Estimated Total Time:** 15-20 hours over 5-7 days

**Last Updated:** 2025-11-17

---

## Pre-Migration Checklist

Complete these items before starting the migration:

### 1. Render Account Setup (Time: 30 minutes)

- [ ] Create Render account at https://render.com
- [ ] Verify email address
- [ ] Set up billing information (credit card required)
- [ ] Enable two-factor authentication (2FA) for security
- [ ] Invite team members to Render account with appropriate roles
  - Admin: Platform operators
  - Developer: Engineering team
  - Viewer: QA team
- [ ] Set up billing alerts:
  - Warning: $230/month (110% of estimate)
  - Critical: $250/month (120% of estimate)

**Time Estimate:** 30 minutes
**Blockers:** Requires billing information (credit card)
**Success Criteria:** All team members have Render access and billing alerts configured

---

### 2. GitHub Integration (Time: 15 minutes)

- [ ] Connect GitHub repository to Render account
- [ ] Grant Render access to repository permissions:
  - Read access to code
  - Write access for commit status checks
  - Webhook management for auto-deploy
- [ ] Configure branch access:
  - `main` → Production environment
  - `develop` → Staging environment
- [ ] Verify webhook creation in GitHub repository settings

**Time Estimate:** 15 minutes
**Blockers:** Requires GitHub admin access
**Success Criteria:** Render appears in GitHub repository integrations

---

### 3. Environment Variables Preparation (Time: 1-2 hours)

- [ ] Generate production secrets:
  - [ ] `JWT_SECRET` (256-bit random string)
  - [ ] `SESSION_SECRET` (256-bit random string)
  - [ ] `ENCRYPTION_KEY` (AES-256 key)
- [ ] Collect third-party API keys:
  - [ ] `ANTHROPIC_API_KEY` (Claude AI - primary)
  - [ ] `GROK_API_KEY` (xAI Grok - fallback, optional)
  - [ ] Storage provider credentials (Cloudflare R2 or AWS S3)
  - [ ] SMTP credentials (SendGrid recommended, 12K free emails/month)
- [ ] Set up Cloudflare R2 storage (recommended):
  - [ ] Create R2 bucket for document storage
  - [ ] Generate R2 API tokens
  - [ ] Configure CORS policy for web access
- [ ] Prepare environment variable files:
  - [ ] Copy `infrastructure/render/environment-template.yaml`
  - [ ] Fill in all required values
  - [ ] Validate no placeholder values remain
  - [ ] Store securely (1Password, LastPass, or encrypted file)
- [ ] Review `infrastructure/ENVIRONMENT_VARIABLES.md` for complete list

**Time Estimate:** 1-2 hours
**Blockers:** Requires API key signups, storage provider setup
**Success Criteria:** All environment variables documented and ready to deploy

---

### 4. Database Planning (Time: 30 minutes)

- [ ] Review database schema in `docs/architecture/database-schema.md`
- [ ] Confirm PostgreSQL version compatibility (Render uses PostgreSQL 16)
- [ ] Verify pgvector extension availability (included in Render PostgreSQL)
- [ ] Plan database size:
  - Staging: 10GB (Standard plan, $25/month)
  - Production: 25GB (Standard plan, $25/month)
- [ ] Review backup strategy:
  - Render automatic daily backups (7-day retention on Standard plan)
  - Manual backup before critical operations
- [ ] Prepare database initialization scripts:
  - [ ] Schema creation (DDL)
  - [ ] Seed data (if any)
  - [ ] pgvector extension installation

**Time Estimate:** 30 minutes
**Blockers:** None
**Success Criteria:** Database plan documented and migration scripts ready

---

### 5. Infrastructure Configuration Review (Time: 1 hour)

- [ ] Review `render.yaml` configuration:
  - [ ] All 7 services defined (web, gateway, 5 microservices)
  - [ ] PostgreSQL database configured
  - [ ] Redis keyvalue store configured
  - [ ] Health check paths correct
  - [ ] Environment variable references correct
  - [ ] Auto-deploy triggers configured
  - [ ] Instance sizes appropriate (2×4GB web/gateway, 1×2GB services)
- [ ] Review Dockerfiles:
  - [ ] `infrastructure/docker/Dockerfile.web` optimized
  - [ ] `infrastructure/docker/Dockerfile.gateway` optimized
  - [ ] `infrastructure/docker/Dockerfile.service` optimized
  - [ ] Health check endpoints implemented
  - [ ] Non-root user configured
- [ ] Review `.dockerignore` and `.renderignore` files
- [ ] Test Docker builds locally:
  ```bash
  docker build -f infrastructure/docker/Dockerfile.web -t test-web .
  docker build -f infrastructure/docker/Dockerfile.gateway -t test-gateway .
  docker build -f infrastructure/docker/Dockerfile.service -t test-service .
  ```

**Time Estimate:** 1 hour
**Blockers:** Docker must be running locally
**Success Criteria:** All Docker images build successfully without errors

---

### 6. CI/CD Pipeline Validation (Time: 30 minutes)

- [ ] Review `.github/workflows/build-publish.yml`:
  - [ ] Render Deploy Hooks configured
  - [ ] Pre-deployment checks enabled
  - [ ] Staging and production jobs separated
- [ ] Review `.github/workflows/pr-validation.yml`:
  - [ ] All test jobs present
  - [ ] Docker build validation enabled
  - [ ] Security scanning enabled
- [ ] Configure GitHub Secrets:
  - [ ] `RENDER_DEPLOY_HOOK_STAGING` (from Render dashboard)
  - [ ] `RENDER_DEPLOY_HOOK_PRODUCTION` (from Render dashboard)
  - [ ] `RENDER_API_KEY` (for CLI operations)
- [ ] Configure GitHub Environment Variables:
  - [ ] `STAGING_URL` (will be set after staging deployment)
  - [ ] `PRODUCTION_URL` (will be set after production deployment)

**Time Estimate:** 30 minutes
**Blockers:** Requires Render services created to get Deploy Hooks
**Success Criteria:** All GitHub secrets configured and workflows validated

---

### 7. Team Training (Time: 2-3 hours)

- [ ] Schedule training session with all team members
- [ ] Review Render platform overview:
  - [ ] Dashboard navigation
  - [ ] Service management
  - [ ] Environment variables
  - [ ] Logs and metrics
  - [ ] Deployment workflows
- [ ] Walk through deployment procedures:
  - [ ] Git-based deployments (push to main/develop)
  - [ ] Manual deployments via dashboard
  - [ ] Rollback procedures
- [ ] Review operational runbook:
  - [ ] Daily health checks
  - [ ] Incident response
  - [ ] Scaling procedures
  - [ ] Cost monitoring
- [ ] Hands-on practice:
  - [ ] Deploy to staging
  - [ ] View logs
  - [ ] Open shell in service
  - [ ] Update environment variables
- [ ] Q&A session

**Time Estimate:** 2-3 hours
**Blockers:** Requires all team members available
**Success Criteria:** All team members comfortable with Render platform

---

### 8. Documentation Review (Time: 1 hour)

- [ ] Review all infrastructure documentation:
  - [ ] `infrastructure/README.md`
  - [ ] `infrastructure/DEPLOYMENT_GUIDE.md`
  - [ ] `infrastructure/OPERATIONS_RUNBOOK.md`
  - [ ] `infrastructure/COST_ESTIMATION.md`
  - [ ] `infrastructure/ENVIRONMENT_VARIABLES.md`
  - [ ] `infrastructure/LOCAL_DEVELOPMENT.md`
- [ ] Verify all Azure references removed
- [ ] Confirm all Render procedures documented
- [ ] Test sample commands from documentation
- [ ] Update any outdated information

**Time Estimate:** 1 hour
**Blockers:** None
**Success Criteria:** All documentation accurate and current

---

### 9. Local Development Testing (Time: 1-2 hours)

- [ ] Test local Docker Compose stack:
  ```bash
  cd infrastructure/docker
  docker-compose up -d
  docker-compose ps  # verify all services running
  docker-compose logs web  # check for errors
  ```
- [ ] Verify all services healthy:
  - [ ] Web (Next.js) - http://localhost:3000
  - [ ] Gateway (GraphQL API) - http://localhost:4000
  - [ ] Document Service - http://localhost:5001/health
  - [ ] AI Service - http://localhost:5002/health
  - [ ] Task Service - http://localhost:5003/health
  - [ ] Integration Service - http://localhost:5004/health
  - [ ] Notification Service - http://localhost:5005/health
  - [ ] PostgreSQL - Port 5432
  - [ ] Redis - Port 6379
- [ ] Run database migrations locally:
  ```bash
  npm run db:migrate
  ```
- [ ] Run integration tests:
  ```bash
  npm run test:integration
  ```
- [ ] Clean up:
  ```bash
  docker-compose down -v
  ```

**Time Estimate:** 1-2 hours
**Blockers:** Docker must be running, all dependencies installed
**Success Criteria:** All services start successfully and tests pass

---

### 10. Stakeholder Communication (Time: 30 minutes)

- [ ] Notify stakeholders of migration plan:
  - [ ] Executive team (cost savings, timeline)
  - [ ] Product team (deployment changes)
  - [ ] Development team (workflow changes)
  - [ ] QA team (testing environments)
- [ ] Schedule maintenance windows:
  - [ ] Staging deployment: [DATE/TIME]
  - [ ] Production deployment: [DATE/TIME]
- [ ] Prepare status update template
- [ ] Set up communication channels:
  - [ ] Slack/Discord migration channel
  - [ ] Email distribution list
  - [ ] Incident escalation contacts

**Time Estimate:** 30 minutes
**Blockers:** None
**Success Criteria:** All stakeholders informed and aligned

---

## Pre-Migration Checklist Summary

**Total Estimated Time:** 8-12 hours
**Critical Path Items:**

1. Render account setup (blocks everything)
2. GitHub integration (blocks deployments)
3. Environment variables (blocks service startup)

**Go/No-Go Decision Criteria:**

- ✅ All checklist items completed
- ✅ Local development environment tested successfully
- ✅ All team members trained
- ✅ All documentation reviewed
- ✅ Stakeholders informed

**If No-Go:** Defer migration and address blockers before proceeding.

---

## Migration Steps

### Stage 1: Create Staging Environment (Time: 2-3 hours)

#### Step 1.1: Create Render Services from Dashboard (Time: 1 hour)

**Option A: Using render.yaml (Recommended)**

- [ ] Push `render.yaml` to `develop` branch:
  ```bash
  git checkout develop
  git pull origin develop
  ```
- [ ] In Render Dashboard, click "New" → "Blueprint"
- [ ] Select repository and branch (`develop`)
- [ ] Review detected services from `render.yaml`:
  - 7 web services
  - 1 PostgreSQL database
  - 1 Redis instance
- [ ] Confirm service plan sizes:
  - Web/Gateway: Starter (2GB RAM, $15/month each for staging)
  - Microservices: Starter (2GB RAM, $15/month each)
  - PostgreSQL: Standard 10GB ($25/month)
  - Redis: 1GB ($10/month)
- [ ] Click "Apply" to create all services

**Option B: Manual Creation (Alternative)**

- [ ] Create PostgreSQL database:
  - Name: `bojin-law-db-staging`
  - Plan: Standard 10GB ($25/month)
  - Region: Oregon (us-west-2) or closest to team
  - Wait for database to provision (~5 minutes)
- [ ] Create Redis instance:
  - Name: `bojin-law-redis-staging`
  - Plan: 1GB ($10/month)
  - Region: Same as database
- [ ] Create Web Service:
  - Name: `bojin-law-web-staging`
  - Repository: [your-repo]
  - Branch: `develop`
  - Build Command: `npm install && npm run build --workspace=apps/web`
  - Start Command: `npm run start --workspace=apps/web`
  - Dockerfile: `infrastructure/docker/Dockerfile.web`
  - Plan: Starter (2GB RAM, $15/month)
  - Health Check: `/health`
- [ ] Create Gateway Service:
  - Name: `bojin-law-gateway-staging`
  - Repository: [your-repo]
  - Branch: `develop`
  - Dockerfile: `infrastructure/docker/Dockerfile.gateway`
  - Plan: Starter (2GB RAM, $15/month)
  - Health Check: `/api/health`
- [ ] Repeat for 5 microservices (document, ai, task, integration, notification)

**Time Estimate:** 1 hour
**Blockers:** None
**Success Criteria:** All services created and in "Building" state

---

#### Step 1.2: Configure Environment Variables (Time: 30 minutes)

- [ ] For each service, set environment variables via Render Dashboard:
  - Navigate to service → Environment tab
  - Add all required variables from `infrastructure/render/environment-template.yaml`
  - Render auto-injects:
    - `DATABASE_URL` (from database connection)
    - `REDIS_URL` (from Redis connection)
    - `RENDER_SERVICE_NAME`
    - `RENDER_EXTERNAL_URL`
    - `RENDER_GIT_COMMIT`
  - Set manually:
    - `NODE_ENV=staging`
    - `JWT_SECRET=[generated-secret]`
    - `SESSION_SECRET=[generated-secret]`
    - `NEXT_PUBLIC_API_URL=https://bojin-law-gateway-staging.onrender.com`
    - `NEXT_PUBLIC_APP_URL=https://bojin-law-web-staging.onrender.com`
    - `ANTHROPIC_API_KEY=[your-key]`
    - `GROK_API_KEY=[your-key]` (optional)
    - `AI_PROVIDER=anthropic`
    - `ANTHROPIC_USE_PROMPT_CACHING=true`
    - `ANTHROPIC_USE_BATCHING=true`
    - Storage provider variables (Cloudflare R2 or S3)
    - SMTP credentials (SendGrid or other)

**Alternative: Use Render CLI**

```bash
# Install Render CLI
npm install -g @render/cli
render login

# Set environment variables from file
render env set --service bojin-law-web-staging --env-file .env.staging
```

**Time Estimate:** 30 minutes
**Blockers:** Requires all API keys and secrets ready
**Success Criteria:** All services have environment variables configured

---

#### Step 1.3: Initialize Database (Time: 30 minutes)

- [ ] Connect to staging PostgreSQL database:

  ```bash
  # Get database URL from Render Dashboard
  export DATABASE_URL="postgresql://..."

  # Or use Render shell
  render shell --service bojin-law-db-staging
  ```

- [ ] Install pgvector extension:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
- [ ] Run database migrations:

  ```bash
  # From local machine or CI/CD
  npm run db:migrate

  # Or from Render service shell
  render shell --service bojin-law-gateway-staging
  npm run db:migrate
  ```

- [ ] Verify schema created:
  ```sql
  \dt  -- list tables
  \d users  -- describe users table
  ```
- [ ] Seed initial data (if any):
  ```bash
  npm run db:seed
  ```

**Time Estimate:** 30 minutes
**Blockers:** Database must be running, migrations must be prepared
**Success Criteria:** Database schema created and pgvector extension installed

---

#### Step 1.4: Verify Staging Deployment (Time: 30 minutes)

- [ ] Wait for all services to deploy (5-10 minutes):
  - Check Render Dashboard for deployment status
  - All services should show "Live" status
- [ ] Check service health:
  ```bash
  curl https://bojin-law-web-staging.onrender.com/health
  curl https://bojin-law-gateway-staging.onrender.com/api/health
  curl https://bojin-law-document-service-staging.onrender.com/health
  curl https://bojin-law-ai-service-staging.onrender.com/health
  curl https://bojin-law-task-service-staging.onrender.com/health
  curl https://bojin-law-integration-service-staging.onrender.com/health
  curl https://bojin-law-notification-service-staging.onrender.com/health
  ```
- [ ] Review service logs:
  ```bash
  render logs --service bojin-law-web-staging --tail
  render logs --service bojin-law-gateway-staging --tail
  ```
- [ ] Check for errors or warnings:
  - Database connection issues
  - Redis connection issues
  - Missing environment variables
  - Service startup failures
- [ ] Access staging web app:
  - Navigate to `https://bojin-law-web-staging.onrender.com`
  - Verify homepage loads
  - Check browser console for errors

**Time Estimate:** 30 minutes
**Blockers:** Services must finish building
**Success Criteria:** All services healthy and accessible

---

#### Step 1.5: Run Integration Tests Against Staging (Time: 30 minutes)

- [ ] Configure test environment:
  ```bash
  export TEST_API_URL=https://bojin-law-gateway-staging.onrender.com
  export TEST_WEB_URL=https://bojin-law-web-staging.onrender.com
  ```
- [ ] Run integration test suite:
  ```bash
  npm run test:integration
  ```
- [ ] Verify test results:
  - [ ] Health checks pass (all services respond)
  - [ ] Database connectivity passes
  - [ ] Redis connectivity passes
  - [ ] Service communication passes
  - [ ] Environment variables validated
  - [ ] File storage working (upload/download)
- [ ] Review test failures (if any):
  - Check service logs
  - Verify environment variables
  - Check network connectivity

**Time Estimate:** 30 minutes
**Blockers:** Integration tests must be implemented (Task 20)
**Success Criteria:** All integration tests pass

---

#### Step 1.6: Load Testing (Time: 30 minutes)

- [ ] Run load test against staging:
  ```bash
  # Using Artillery, k6, or similar
  npm run test:load -- --target https://bojin-law-web-staging.onrender.com
  ```
- [ ] Simulate 100 concurrent users:
  - Browse pages
  - Login/logout
  - Create/read/update operations
  - File uploads/downloads
- [ ] Monitor Render metrics:
  - CPU usage
  - Memory usage
  - Request latency
  - Error rate
- [ ] Review performance:
  - [ ] Response times <2s (p95)
  - [ ] Error rate <1%
  - [ ] Memory usage <80%
  - [ ] CPU usage <80%

**Time Estimate:** 30 minutes
**Blockers:** Load testing tools must be set up
**Success Criteria:** Performance meets SLAs under load

---

### Stage 2: Create Production Environment (Time: 2-3 hours)

#### Step 2.1: Create Production Services (Time: 1 hour)

Follow the same process as staging (Step 1.1), but:

- [ ] Use `main` branch instead of `develop`
- [ ] Use production service names (remove `-staging` suffix)
- [ ] Use production-sized instances:
  - Web/Gateway: Standard (4GB RAM, $25/month each) - 2 instances each
  - Microservices: Starter (2GB RAM, $15/month each) - 1 instance each
  - PostgreSQL: Standard 25GB ($25/month)
  - Redis: 1GB ($10/month)

**Expected Monthly Cost:** $207

**Time Estimate:** 1 hour
**Success Criteria:** All production services created

---

#### Step 2.2: Configure Production Environment Variables (Time: 30 minutes)

- [ ] Set production environment variables (similar to staging):
  - Use production secrets (different from staging)
  - Use production API URLs
  - Use production third-party credentials
- [ ] Verify all required variables set
- [ ] Double-check sensitive values (API keys, secrets)

**Time Estimate:** 30 minutes
**Success Criteria:** All production environment variables configured

---

#### Step 2.3: Initialize Production Database (Time: 30 minutes)

- [ ] Run migrations on production database (same as Step 1.3)
- [ ] Verify schema matches staging
- [ ] Do NOT seed test data in production
- [ ] Create production admin user (if applicable)

**Time Estimate:** 30 minutes
**Success Criteria:** Production database initialized

---

#### Step 2.4: Verify Production Deployment (Time: 30 minutes)

- [ ] Check all service health endpoints
- [ ] Review production logs for errors
- [ ] Access production web app
- [ ] Test critical user flows:
  - [ ] User login/logout
  - [ ] Create case
  - [ ] Upload document
  - [ ] View dashboard
  - [ ] Generate report

**Time Estimate:** 30 minutes
**Success Criteria:** All production services healthy and functional

---

### Stage 3: DNS and Domain Configuration (Time: 1-2 hours)

#### Step 3.1: Configure Custom Domains (Time: 30 minutes)

- [ ] Purchase domain (if not already owned):
  - Example: `bojinlaw.com`
- [ ] In Render Dashboard, add custom domains:
  - Web service: `app.bojinlaw.com`
  - Gateway service: `api.bojinlaw.com`
- [ ] Configure DNS records (in domain registrar):
  - [ ] Add CNAME for `app.bojinlaw.com` → `bojin-law-web.onrender.com`
  - [ ] Add CNAME for `api.bojinlaw.com` → `bojin-law-gateway.onrender.com`
  - [ ] Wait for DNS propagation (5-60 minutes)
- [ ] Verify DNS resolution:
  ```bash
  dig app.bojinlaw.com
  dig api.bojinlaw.com
  ```

**Time Estimate:** 30 minutes + DNS propagation
**Blockers:** Requires domain ownership
**Success Criteria:** Custom domains resolve correctly

---

#### Step 3.2: Configure SSL/TLS (Time: 15 minutes)

- [ ] Render automatically provisions Let's Encrypt certificates
- [ ] Verify SSL certificates active:
  ```bash
  curl -vI https://app.bojinlaw.com
  ```
- [ ] Update environment variables with custom domains:
  - `NEXT_PUBLIC_APP_URL=https://app.bojinlaw.com`
  - `NEXT_PUBLIC_API_URL=https://api.bojinlaw.com`
- [ ] Redeploy services to pick up new URLs

**Time Estimate:** 15 minutes
**Blockers:** DNS must be configured first
**Success Criteria:** HTTPS working on all custom domains

---

#### Step 3.3: Update GitHub Actions (Time: 15 minutes)

- [ ] Add Deploy Hook URLs to GitHub Secrets:
  - Get Deploy Hooks from Render Dashboard (each service has one)
  - `RENDER_DEPLOY_HOOK_STAGING` = staging deploy hook
  - `RENDER_DEPLOY_HOOK_PRODUCTION` = production deploy hook
- [ ] Update GitHub Environment Variables:
  - `STAGING_URL=https://bojin-law-web-staging.onrender.com`
  - `PRODUCTION_URL=https://app.bojinlaw.com`
- [ ] Test deployment workflow:
  - Push to `develop` → should trigger staging deployment
  - Push to `main` → should trigger production deployment

**Time Estimate:** 15 minutes
**Success Criteria:** GitHub Actions triggering deployments correctly

---

### Stage 4: Monitoring and Alerting (Time: 2-3 hours)

#### Step 4.1: Configure Render Monitoring (Time: 30 minutes)

- [ ] Enable Render metrics for all services:
  - CPU monitoring
  - Memory monitoring
  - Request count
  - Error rate
- [ ] Configure Render alerts:
  - CPU >80% for 5 minutes → Email + Slack
  - Memory >85% for 5 minutes → Email + Slack
  - Service down → Email + Slack + SMS
- [ ] Set up notification channels:
  - Email: ops@company.com
  - Slack: #infrastructure-alerts
  - SMS: On-call engineer

**Time Estimate:** 30 minutes
**Success Criteria:** Alerts configured and tested

---

#### Step 4.2: Configure New Relic (Optional, Recommended) (Time: 1-2 hours)

- [ ] Sign up for New Relic account (100GB/month free tier)
- [ ] Create New Relic applications:
  - Web (Next.js)
  - Gateway (Node.js)
  - Each microservice
- [ ] Install New Relic APM:
  - Add `newrelic` npm package to services
  - Configure `newrelic.js` in each service
  - Add `NEW_RELIC_LICENSE_KEY` environment variable
  - Add `NEW_RELIC_APP_NAME` for each service
- [ ] Verify data flowing:
  - Check New Relic dashboard for incoming metrics
  - Verify transactions captured
  - Check error tracking working
- [ ] Configure New Relic alerts:
  - Error rate >5% → Critical
  - Response time >2s (p95) → Warning
  - Throughput drop >50% → Warning
  - Apdex score <0.7 → Warning
- [ ] Create custom dashboards:
  - Application health overview
  - Database performance
  - AI service usage and costs
  - Error tracking

**Time Estimate:** 1-2 hours
**Blockers:** Requires New Relic account
**Success Criteria:** New Relic receiving data and alerts working

---

#### Step 4.3: Configure Uptime Monitoring (Time: 30 minutes)

**Option A: Use Render Built-in**

- Already included, monitors health check endpoints

**Option B: External Monitoring (UptimeRobot, Pingdom, etc.)**

- [ ] Sign up for uptime monitoring service
- [ ] Add monitors:
  - `https://app.bojinlaw.com/health` (every 5 minutes)
  - `https://api.bojinlaw.com/api/health` (every 5 minutes)
- [ ] Configure alerts:
  - Service down → Email + Slack + SMS
  - Response time >5s → Email + Slack
- [ ] Set up status page (optional):
  - Public status page for customers
  - Incident history

**Time Estimate:** 30 minutes
**Success Criteria:** Uptime monitoring active and alerting

---

### Stage 5: Final Validation and Go-Live (Time: 2-3 hours)

#### Step 5.1: Run Full Test Suite (Time: 1 hour)

- [ ] Run all tests against production:
  ```bash
  export TEST_ENV=production
  npm run test:unit
  npm run test:integration
  npm run test:e2e
  ```
- [ ] Verify all tests pass:
  - [ ] Unit tests: 100% pass
  - [ ] Integration tests: 100% pass
  - [ ] E2E tests: 100% pass
- [ ] Manual smoke testing:
  - [ ] User registration/login
  - [ ] Case creation and management
  - [ ] Document upload/download
  - [ ] Time tracking
  - [ ] Report generation
  - [ ] Dashboard widgets
  - [ ] Search functionality
- [ ] Performance testing:
  - [ ] Page load times <2s
  - [ ] API response times <500ms
  - [ ] No memory leaks
  - [ ] No console errors

**Time Estimate:** 1 hour
**Success Criteria:** All tests pass and manual testing confirms functionality

---

#### Step 5.2: Security Review (Time: 30 minutes)

- [ ] Verify all sensitive data encrypted:
  - Database connections use SSL
  - Redis connections use TLS
  - All external API calls use HTTPS
- [ ] Verify secrets management:
  - No secrets in code
  - All secrets in Render environment variables
  - Secret rotation plan documented
- [ ] Verify authentication:
  - JWT tokens working
  - Session management secure
  - CSRF protection enabled
- [ ] Verify authorization:
  - Role-based access control working
  - API endpoints protected
  - File access restricted by ownership
- [ ] Run security scan:
  ```bash
  npm audit
  npm run test:security
  ```

**Time Estimate:** 30 minutes
**Success Criteria:** No critical security issues found

---

#### Step 5.3: Backup Verification (Time: 30 minutes)

- [ ] Verify Render automatic backups enabled:
  - Database: Daily backups with 7-day retention
  - Review backup schedule
- [ ] Test manual backup:
  ```bash
  render db backup --database bojin-law-db
  ```
- [ ] Verify backup exists in Render dashboard
- [ ] Document backup restoration procedure
- [ ] Test backup restoration on staging:
  ```bash
  render db restore --database bojin-law-db-staging --backup [backup-id]
  ```

**Time Estimate:** 30 minutes
**Success Criteria:** Backups working and restoration tested

---

#### Step 5.4: Documentation Final Review (Time: 30 minutes)

- [ ] Update all documentation with production URLs
- [ ] Verify runbook procedures against production
- [ ] Update README with production deployment status
- [ ] Document any production-specific configurations
- [ ] Create post-migration report (see Task 26)

**Time Estimate:** 30 minutes
**Success Criteria:** All documentation current and accurate

---

## Post-Migration Checklist

### Day 1: Immediate Monitoring (Time: 2-4 hours)

- [ ] Monitor production for first 4-6 hours:
  - Check logs every 30 minutes
  - Review error rates
  - Monitor performance metrics
  - Check database connection pool
  - Verify caching working
- [ ] Verify all scheduled tasks running:
  - Background jobs
  - Email notifications
  - Report generation
  - Data synchronization
- [ ] Test critical user flows:
  - User login
  - Case creation
  - Document upload
  - Report generation
- [ ] Monitor costs:
  - Check Render billing dashboard
  - Verify usage within expected ranges

**Success Criteria:** No critical issues in first 6 hours

---

### Day 2-7: Daily Health Checks (Time: 30 minutes/day)

- [ ] Daily morning check (15 minutes):
  - [ ] Review overnight logs for errors
  - [ ] Check service health status
  - [ ] Review New Relic dashboard
  - [ ] Check uptime monitoring reports
  - [ ] Verify backups completed successfully
- [ ] Daily evening check (15 minutes):
  - [ ] Review day's performance metrics
  - [ ] Check for any alerts or incidents
  - [ ] Verify costs tracking to estimate
  - [ ] Review user feedback (if any)

**Success Criteria:** No major issues for 7 consecutive days

---

### Week 2: Stabilization (Time: 4-6 hours)

- [ ] Performance optimization:
  - [ ] Analyze slow queries in database
  - [ ] Review API response times
  - [ ] Optimize caching strategy
  - [ ] Adjust instance sizes if needed
- [ ] Cost optimization:
  - [ ] Review actual costs vs. estimates
  - [ ] Right-size instances based on usage
  - [ ] Optimize database queries to reduce load
  - [ ] Review New Relic data ingestion (stay within free tier)
- [ ] Documentation updates:
  - [ ] Document any production issues encountered
  - [ ] Update runbook with production learnings
  - [ ] Add FAQ based on team questions
- [ ] Team retrospective:
  - What went well?
  - What could be improved?
  - Any unexpected issues?
  - Lessons learned

**Success Criteria:** Performance stable, costs within budget

---

### Month 1: Azure Decommissioning (Time: 3-4 hours)

⚠️ **IMPORTANT:** Only proceed if production is stable for 30+ days with zero critical incidents.

- [ ] Verify production stability:
  - [ ] 30+ days uptime
  - [ ] Zero critical incidents
  - [ ] Performance meeting SLAs
  - [ ] Costs within budget
  - [ ] Team comfortable with Render
- [ ] Export Azure resources for historical reference:
  - [ ] Export all configuration (Terraform state, K8s manifests)
  - [ ] Export monitoring dashboards and alerts
  - [ ] Export logs (last 90 days)
  - [ ] Take screenshots of Azure portal configurations
  - [ ] Store in `infrastructure/archive/azure-export/`
- [ ] Azure resource deletion (see Task 25):
  - ⚠️ Double-check no production data will be lost
  - [ ] Create final Azure backup
  - [ ] Delete test/dev resources first
  - [ ] Wait 7 days
  - [ ] Delete production resources
  - [ ] Verify all resources deleted
  - [ ] Cancel Azure subscriptions
  - [ ] Request final invoice
- [ ] Update billing alerts:
  - [ ] Remove Azure cost alerts
  - [ ] Confirm Render cost alerts active
  - [ ] Set up quarterly cost reviews

**Success Criteria:** Azure resources decommissioned, all data preserved

---

### Month 3: Final Review (Time: 2-3 hours)

- [ ] Create final migration report (see Task 26):
  - [ ] Actual vs. projected costs
  - [ ] Actual vs. estimated timeline
  - [ ] Issues encountered and resolutions
  - [ ] Team feedback
  - [ ] Lessons learned
  - [ ] Recommendations for future
- [ ] Share report with stakeholders:
  - Executive team (ROI achieved)
  - Product team (deployment velocity)
  - Engineering team (operational improvements)
- [ ] Celebrate success! 🎉
  - 83% cost reduction achieved
  - DevOps overhead reduced from 20 to 5 hours/month
  - Deployment time reduced from 6-8 weeks to 3-5 days

**Success Criteria:** Migration complete, ROI validated

---

## Rollback Procedures

### When to Rollback

Rollback if any of these occur:

- **Critical:** Service unavailable for >15 minutes
- **Critical:** Data loss or corruption detected
- **Critical:** Security breach or vulnerability discovered
- **High:** Error rate >10% for >10 minutes
- **High:** Performance degradation >50% for >10 minutes
- **High:** Cost exceeding budget by >50%

### Rollback Options

#### Option 1: Rollback to Previous Deployment (Fast, <5 minutes)

Render keeps previous deployments for quick rollback:

1. **Via Render Dashboard:**
   - Navigate to service
   - Click "Deploys" tab
   - Find last successful deploy
   - Click "Rollback to this deploy"
   - Confirm rollback
   - Monitor service health

2. **Via Render CLI:**
   ```bash
   render rollback --service bojin-law-web --to-deploy [deploy-id]
   ```

**Time to Rollback:** <5 minutes
**Data Loss Risk:** None (database unchanged)

---

#### Option 2: Rollback Database Migration (Medium, 10-30 minutes)

If database migration caused issues:

1. **Identify migration to rollback:**

   ```bash
   npm run db:migrate:status
   ```

2. **Rollback migration:**

   ```bash
   npm run db:migrate:undo
   ```

3. **Verify database state:**

   ```sql
   SELECT * FROM migration_history ORDER BY executed_at DESC LIMIT 5;
   ```

4. **Redeploy services with previous code:**
   - Follow Option 1 to rollback service code

**Time to Rollback:** 10-30 minutes
**Data Loss Risk:** Medium (depends on migration)

---

#### Option 3: Full Rollback to Azure (Slow, 1-2 weeks)

⚠️ **Only use if Render is completely unsuitable and cannot be fixed.**

This is a complex rollback that requires:

1. **Prerequisites:**
   - Azure infrastructure files still in git history
   - Azure account still active
   - Team still has Azure expertise

2. **Steps:**
   - Restore infrastructure/terraform/ from git
   - Restore infrastructure/kubernetes/ from git
   - Deploy Azure infrastructure (6-8 weeks normally)
   - Export data from Render database
   - Import data to Azure database
   - Update DNS to point to Azure
   - Monitor Azure deployment

3. **Considerations:**
   - Cost: Will incur both Render and Azure costs during transition
   - Time: 1-2 weeks minimum
   - Risk: High complexity, many failure points
   - Recommendation: Exhaust all other options first

**Time to Rollback:** 1-2 weeks
**Data Loss Risk:** High (complex data migration)
**Cost Impact:** High (dual infrastructure costs)

---

## Emergency Contacts

| Role             | Name       | Contact            | Availability      |
| ---------------- | ---------- | ------------------ | ----------------- |
| Platform Lead    | [TBD]      | [email/phone]      | 24/7              |
| DevOps Engineer  | [TBD]      | [email/phone]      | Business hours    |
| On-Call Engineer | [Rotation] | [PagerDuty/phone]  | 24/7              |
| Render Support   | Render.com | support@render.com | 24/7 (Enterprise) |
| Database Admin   | [TBD]      | [email/phone]      | Business hours    |

---

## Migration Risk Assessment

| Risk                            | Likelihood | Impact   | Mitigation                                    |
| ------------------------------- | ---------- | -------- | --------------------------------------------- |
| Service deployment fails        | Medium     | High     | Test locally first, use staging environment   |
| Database migration fails        | Low        | Critical | Test on staging, have rollback plan ready     |
| Environment variables incorrect | Medium     | High     | Use template, validate before deploy          |
| Cost exceeds budget             | Low        | Medium   | Monitor daily, set budget alerts              |
| Performance degradation         | Low        | High     | Load test staging, monitor production closely |
| Team not trained                | Medium     | Medium   | Mandatory training before migration           |
| DNS propagation delays          | Medium     | Low      | Allow extra time, use temporary URLs          |
| Third-party API issues          | Low        | Medium   | Test API keys before production deploy        |

---

## Success Metrics

Track these metrics to validate migration success:

### Cost Metrics

- **Monthly Infrastructure Cost:** Target $207/month (±10%)
- **3-Year TCO:** Target $27,108 (vs. $114,804 on Azure)
- **Cost per User:** Track as user base grows

### Performance Metrics

- **Service Uptime:** >99.9% (Render SLA is 99.95%)
- **API Response Time:** <500ms (p95)
- **Page Load Time:** <2s (p95)
- **Error Rate:** <1%

### Operational Metrics

- **Deployment Frequency:** >10/week (vs. <1/week on Azure)
- **Deployment Duration:** <5 minutes (vs. 30+ minutes on Azure)
- **DevOps Time:** <5 hours/month (vs. 20 hours/month on Azure)
- **Incident Response Time:** <15 minutes to rollback

### Team Metrics

- **Team Training Time:** <2 hours to proficiency
- **Team Satisfaction:** Survey after 30 days
- **Deployment Confidence:** Can all engineers deploy independently?

---

## Appendix: Useful Commands

### Render CLI

```bash
# Installation
npm install -g @render/cli

# Login
render login

# List services
render services

# View logs
render logs --service [service-name] --tail

# Open shell in service
render shell --service [service-name]

# Trigger deployment
render deploy --service [service-name]

# Rollback deployment
render rollback --service [service-name] --to-deploy [deploy-id]

# Manage environment variables
render env set KEY=value --service [service-name]
render env get KEY --service [service-name]
render env delete KEY --service [service-name]

# Database operations
render db backup --database [db-name]
render db restore --database [db-name] --backup [backup-id]
render db shell --database [db-name]
```

### Database Operations

```bash
# Connect to database
psql $DATABASE_URL

# Run migrations
npm run db:migrate

# Rollback migration
npm run db:migrate:undo

# Seed database
npm run db:seed

# Database backup (manual)
pg_dump $DATABASE_URL > backup.sql

# Database restore
psql $DATABASE_URL < backup.sql
```

### Health Checks

```bash
# Check all service health
curl https://app.bojinlaw.com/health
curl https://api.bojinlaw.com/api/health

# Check service status
render services --format json | jq '.[] | {name, status}'

# Monitor logs for errors
render logs --service bojin-law-web --tail | grep -i error
```

---

**Document Version:** 1.0
**Last Updated:** 2025-11-17
**Maintained By:** Platform Team
**Review Frequency:** After each migration, update with lessons learned
