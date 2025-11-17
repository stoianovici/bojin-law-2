# Deployment Guide - Render.com

**Platform:** Render.com
**Deployment Model:** Git-based continuous deployment
**Documentation:** https://render.com/docs

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Database Initialization](#database-initialization)
4. [Secret Management](#secret-management)
5. [Standard Deployment Process](#standard-deployment-process)
6. [Environment Management](#environment-management)
7. [Database Migrations](#database-migrations)
8. [Monitoring Deployments](#monitoring-deployments)
9. [Preview Environments](#preview-environments)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### 1. Render Account Setup

**Create Account:**

1. Go to https://render.com
2. Click "Get Started"
3. Sign up with GitHub (recommended) or email
4. Verify email address

**Add Billing:**

1. Navigate to Account → Billing: https://dashboard.render.com/billing
2. Add credit card (required even for free tier)
3. No charges until you deploy paid services

**Connect GitHub:**

1. Account → Settings → GitHub: https://dashboard.render.com/settings/github
2. Click "Connect GitHub Account"
3. Authorize Render to access repositories
4. Grant access to `legal-platform` repository

### 2. Environment Variables Preparation

**Prepare Required Environment Variables:**

Create `.env.production` file (DO NOT COMMIT):

```bash
# Database (auto-injected by Render)
# DATABASE_URL=postgresql://...
# REDIS_URL=redis://...

# Application
NODE_ENV=production
JWT_SECRET=<generate-with-openssl-rand-base64-32>
API_URL=https://legal-platform.onrender.com

# Frontend
NEXT_PUBLIC_API_URL=https://api.legal-platform.onrender.com
NEXT_PUBLIC_APP_URL=https://legal-platform.onrender.com

# Document Service
STORAGE_PROVIDER=cloudflare-r2
STORAGE_BUCKET=legal-platform-documents
STORAGE_ACCESS_KEY=<cloudflare-r2-access-key>
STORAGE_SECRET_KEY=<cloudflare-r2-secret-key>

# AI Service
OPENAI_API_KEY=<openai-api-key>
AI_MODEL=gpt-4-turbo-preview
OPENAI_ORG_ID=<openai-org-id>

# Notification Service
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<sendgrid-api-key>
EMAIL_FROM=noreply@legal-platform.com

# Integration Service
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
MICROSOFT_CLIENT_ID=<microsoft-client-id>
MICROSOFT_CLIENT_SECRET=<microsoft-client-secret>
```

**Generate Secrets:**

```bash
# JWT Secret (256-bit)
openssl rand -base64 32

# Example output: 8xKj2Qp9Lm4Hn6Vb3Cz5Rt7Yf1Sd8Aq0

# Session Secret (256-bit)
openssl rand -base64 32
```

See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for complete reference.

### 3. Domain Configuration (Optional)

**If using custom domain:**

1. Purchase domain (e.g., legal-platform.com)
2. Have DNS access ready (Cloudflare, Route53, etc.)
3. Prepare SSL certificate (or use Render's free Let's Encrypt)

Render provides free `.onrender.com` subdomain if no custom domain.

### 4. Third-Party Service Setup

**Required:**

- ✅ Cloudflare R2 account (document storage) or AWS S3
- ✅ OpenAI API key (AI service)
- ✅ SendGrid account (email notifications) or SMTP credentials

**Optional:**

- New Relic account (APM monitoring, free tier)
- PagerDuty account (incident management)
- Slack webhook (deployment notifications)

---

## Initial Setup

### Option 1: Deploy via Render Dashboard (Recommended)

**Step 1: Create New Blueprint**

1. Log in to Render Dashboard: https://dashboard.render.com
2. Click **"New +"** → **"Blueprint"**
3. Connect repository: Select `legal-platform` from GitHub
4. Render automatically detects `render.yaml` in repository root
5. Click **"Apply"**

**Step 2: Configure Services**

Render creates all services defined in `render.yaml`:

- ✅ web (Next.js frontend)
- ✅ gateway (GraphQL API)
- ✅ document-service
- ✅ ai-service
- ✅ task-service
- ✅ integration-service
- ✅ notification-service
- ✅ postgres (PostgreSQL database)
- ✅ redis (Redis cache)

**Step 3: Review Configuration**

1. Review service settings (instance type, environment, region)
2. Verify environment variables are set (see Step 4)
3. Check health check paths (`/health`, `/api/health`)
4. Confirm auto-deploy is enabled for `main` branch

**Step 4: Add Environment Variables**

For each service:

1. Navigate to service → **Environment**
2. Add environment variables from `.env.production`
3. Use **Environment Groups** for shared variables (see [Secret Management](#secret-management))
4. Mark sensitive values as **Secret** (encrypted at rest)

**Step 5: Deploy**

1. Click **"Manual Deploy"** → **"Deploy latest commit"**
2. Render pulls code from GitHub
3. Builds Docker images
4. Deploys all services
5. Runs health checks
6. Service becomes live at `https://<service-name>.onrender.com`

**Initial deployment takes ~10-15 minutes** (database provisioning, Docker builds, health checks).

---

### Option 2: Deploy via Render CLI

**Step 1: Install Render CLI**

```bash
# Install globally
npm install -g @render/cli

# Or use via npx (no install)
npx @render/cli --version
```

**Step 2: Login to Render**

```bash
# Login with API key
render login

# Or set API key environment variable
export RENDER_API_KEY=<your-api-key>

# Get API key from: https://dashboard.render.com/u/settings/api
```

**Step 3: Validate render.yaml**

```bash
# Validate configuration
render blueprint validate --file render.yaml

# Expected output:
# ✅ render.yaml is valid
```

**Step 4: Deploy Blueprint**

```bash
# Deploy to production (main branch)
render blueprint deploy \
  --repo legal-platform \
  --branch main \
  --file render.yaml

# Deploy to staging (develop branch)
render blueprint deploy \
  --repo legal-platform \
  --branch develop \
  --file render.yaml
```

**Step 5: Monitor Deployment**

```bash
# Check deployment status
render services list

# View logs
render logs --service web --tail

# Check service health
render services get --service web
```

---

### Option 3: Automatic Git-based Deployment (Production)

**How it Works:**

1. Push to `develop` branch → Auto-deploys to **staging**
2. Push to `main` branch → Auto-deploys to **production**

**Configuration (Already Set Up):**

GitHub Actions workflow (`.github/workflows/build-publish.yml`) triggers Render Deploy Hooks:

```yaml
- name: Deploy to Staging
  if: github.ref == 'refs/heads/develop'
  run: curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK_STAGING }}

- name: Deploy to Production
  if: github.ref == 'refs/heads/main'
  run: curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK_PRODUCTION }}
```

**Required GitHub Secrets:**

Add to repository: Settings → Secrets → Actions

```
RENDER_DEPLOY_HOOK_STAGING=https://api.render.com/deploy/srv-xxxxx?key=xxxxx
RENDER_DEPLOY_HOOK_PRODUCTION=https://api.render.com/deploy/srv-yyyyy?key=yyyyy
```

Get Deploy Hook URLs from:

1. Render Dashboard → Service → Settings
2. Scroll to **Deploy Hook**
3. Copy URL

See [.github/RENDER_DEPLOYMENT_SETUP.md](../.github/RENDER_DEPLOYMENT_SETUP.md) for detailed setup.

---

## Database Initialization

### Step 1: Create Database

Render automatically provisions PostgreSQL when deploying blueprint.

**Verify Database:**

```bash
# Check database status
render db status --database postgres

# Expected output:
# Name: postgres
# Status: available
# Plan: Standard
# Size: 25GB
# Connections: 100
```

### Step 2: Run Initial Migrations

**Option A: Via Render Shell**

```bash
# Open shell in gateway service
render shell --service gateway

# Run migrations
pnpm db:migrate

# Verify migrations
pnpm db:migrate:status

# Exit shell
exit
```

**Option B: Via One-Off Job**

```bash
# Run migration job
render jobs run \
  --service gateway \
  --command "pnpm db:migrate"

# View job logs
render jobs logs --job <job-id>
```

**Option C: Automated in Deployment**

Add to `render.yaml` (optional):

```yaml
services:
  - type: web
    name: gateway
    # ... other config
    preDeployCommand: pnpm db:migrate
```

This runs migrations automatically before each deployment.

### Step 3: Seed Initial Data

```bash
# Open shell in gateway service
render shell --service gateway

# Run seed script
pnpm db:seed

# Verify seed data
psql $DATABASE_URL

# Query test data
SELECT * FROM users LIMIT 5;
\q

exit
```

### Step 4: Enable Extensions

PostgreSQL extensions (e.g., pgvector for semantic search):

```bash
# Connect to database
psql $DATABASE_URL

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify
\dx

-- Should show:
--   Name   | Version | Schema |  Description
-- ---------+---------+--------+---------------
--  vector  | 0.5.1   | public | vector data type

\q
```

---

## Secret Management

### Option 1: Render Dashboard (Recommended for Small Teams)

**Add Environment Variables:**

1. Navigate to service → **Environment**
2. Click **"Add Environment Variable"**
3. Enter:
   - **Key:** `OPENAI_API_KEY`
   - **Value:** `sk-...`
   - **Secret:** ☑️ (check to encrypt)
4. Click **"Save Changes"**
5. Service auto-redeploys with new variable

**Shared Variables (Environment Groups):**

1. Account → Environment Groups: https://dashboard.render.com/env-groups
2. Click **"New Environment Group"**
3. Name: `shared-production`
4. Add variables:
   ```
   NODE_ENV=production
   JWT_SECRET=<secret>
   DATABASE_URL=${DATABASE_URL}  # Reference from Render
   REDIS_URL=${REDIS_URL}        # Reference from Render
   ```
5. Link group to services:
   - Service → Environment → **"Add from Environment Group"**
   - Select `shared-production`

**Benefits:**

- ✅ Single source of truth for shared variables
- ✅ Update once, applies to all linked services
- ✅ Automatic redeployment on changes

---

### Option 2: render.yaml (Infrastructure as Code)

**Define in `render.yaml`:**

```yaml
services:
  - type: web
    name: web
    env: production
    envVars:
      - key: NODE_ENV
        value: production
      - key: NEXT_PUBLIC_API_URL
        value: https://api.legal-platform.onrender.com
      - key: JWT_SECRET
        sync: false # Manual entry in dashboard (secret)
```

**Secrets in render.yaml:**

Render does NOT support secrets in `render.yaml` (security best practice).

Secrets must be added via:

- Dashboard (manual entry)
- Render CLI (`render env set`)
- Environment Groups

---

### Option 3: Render CLI (Automation Scripts)

**Set Environment Variables:**

```bash
# Set single variable
render env set \
  --service web \
  --key OPENAI_API_KEY \
  --value sk-xxxxx

# Set from .env file
cat .env.production | while read line; do
  key=$(echo $line | cut -d'=' -f1)
  value=$(echo $line | cut -d'=' -f2-)
  render env set --service web --key $key --value "$value"
done

# List environment variables
render env list --service web

# Delete environment variable
render env delete --service web --key OLD_VAR
```

**Bulk Update Script:**

```bash
#!/bin/bash
# scripts/render/env-sync.sh

services=("web" "gateway" "document-service" "ai-service" "task-service" "integration-service" "notification-service")

for service in "${services[@]}"; do
  echo "Updating $service..."
  render env set --service $service --key NODE_ENV --value production
  render env set --service $service --key JWT_SECRET --value "$JWT_SECRET"
done

echo "✅ Environment variables updated"
```

---

### Secret Rotation Strategy

**Quarterly Rotation Schedule:**

| Secret                      | Rotation Frequency | Method                                  |
| --------------------------- | ------------------ | --------------------------------------- |
| JWT_SECRET                  | 90 days            | Generate new → Update Render → Redeploy |
| Database Password           | 90 days            | Render auto-rotates (managed DB)        |
| API Keys (OpenAI, SendGrid) | 90 days            | Rotate in provider → Update Render      |
| OAuth Credentials           | 180 days           | Rotate in provider → Update Render      |
| SSL Certificates            | Auto               | Render auto-renews Let's Encrypt        |

**Rotation Procedure:**

1. Generate new secret
2. Add as `NEW_JWT_SECRET` environment variable
3. Update application to accept both old and new (grace period)
4. Deploy with dual-secret support
5. After 24 hours, remove old secret
6. Update `JWT_SECRET` to new value
7. Redeploy

---

## Standard Deployment Process

### Automatic Deployment (Recommended)

**Workflow:**

```bash
# 1. Make changes locally
git checkout -b feature/new-feature
# ... make changes ...
git commit -m "feat: add new feature"

# 2. Push to GitHub
git push origin feature/new-feature

# 3. Create Pull Request
# GitHub → Pull Requests → New PR

# 4. PR validation runs (tests, lints, builds)
# See .github/workflows/pr-validation.yml

# 5. Merge to develop (deploys to staging)
# GitHub → Merge Pull Request

# 6. Verify on staging
# https://legal-platform-staging.onrender.com

# 7. Merge develop to main (deploys to production)
git checkout main
git merge develop
git push origin main

# 8. Production deploys automatically
# https://legal-platform.onrender.com
```

**Deployment Timeline:**

- PR validation: 5-8 minutes
- Staging deployment: 2-3 minutes
- Production deployment: 2-3 minutes

---

### Manual Deployment

**Via Render Dashboard:**

1. Navigate to service: https://dashboard.render.com/web/<service-id>
2. Click **"Manual Deploy"** (top right)
3. Select:
   - **"Deploy latest commit"** (deploys HEAD of branch)
   - **"Clear build cache & deploy"** (if dependencies changed)
4. Click **"Deploy"**
5. Monitor deployment in real-time

**Via Render CLI:**

```bash
# Deploy specific service
render deploy --service web

# Deploy with clear cache
render deploy --service web --clear-cache

# Deploy all services
for service in web gateway document-service ai-service task-service integration-service notification-service; do
  render deploy --service $service
done
```

**Via Deploy Hook (curl):**

```bash
# Trigger staging deployment
curl -X POST $RENDER_DEPLOY_HOOK_STAGING

# Trigger production deployment
curl -X POST $RENDER_DEPLOY_HOOK_PRODUCTION

# Get Deploy Hook URL from:
# Render Dashboard → Service → Settings → Deploy Hook
```

**Via Helper Script:**

```bash
# Deploy to staging
./scripts/render/deploy.sh staging

# Deploy to production
./scripts/render/deploy.sh production

# Deploy specific service
./scripts/render/deploy.sh production web
```

---

### Rollback Procedure

**Rollback to Previous Deployment:**

1. Navigate to service → **Deploys**
2. Find previous successful deployment
3. Click **"Redeploy"** on that specific deploy
4. Confirm rollback
5. Service rolls back in ~2 minutes

**Rollback via CLI:**

```bash
# List recent deploys
render deploys list --service web

# Expected output:
# ID          Status    Commit     Created
# dpl-xxxxx   live      abc123f    2 hours ago
# dpl-yyyyy   success   def456a    1 day ago  ← Rollback to this

# Rollback to specific deploy
render deploys redeploy --deploy dpl-yyyyy
```

**Rollback via Git:**

```bash
# Revert last commit
git revert HEAD
git push origin main

# Or reset to specific commit (destructive)
git reset --hard def456a
git push origin main --force-with-lease

# Automatic deployment triggers
```

---

## Environment Management

### Creating New Environment

**Scenario:** Create `qa` environment for QA testing.

**Step 1: Duplicate render.yaml**

Create `render.qa.yaml`:

```yaml
# Copy from render.yaml and modify:
services:
  - type: web
    name: web-qa
    env: qa
    branch: qa # Deploy from qa branch
    plan: free # Use free tier for QA
    # ... rest of config
```

**Step 2: Deploy QA Environment**

```bash
# Deploy QA blueprint
render blueprint deploy \
  --file render.qa.yaml \
  --branch qa
```

**Step 3: Configure QA Variables**

```bash
# Set QA-specific variables
render env set --service web-qa --key NODE_ENV --value qa
render env set --service web-qa --key API_URL --value https://api-qa.legal-platform.com
```

**Step 4: Access QA Environment**

- URL: `https://web-qa.onrender.com`
- Database: Shared staging DB or dedicated QA DB
- Cost: ~$20/month (free tier + small DB)

---

### Promoting Staging to Production

**Workflow:**

```bash
# 1. Verify staging is stable
curl https://legal-platform-staging.onrender.com/health
# Expected: {"status": "healthy"}

# 2. Run integration tests against staging
pnpm test:integration --env=staging

# 3. Manual QA testing on staging
# ... test critical user flows ...

# 4. Merge develop to main (triggers production deploy)
git checkout main
git merge develop --no-ff -m "chore: promote staging to production"
git push origin main

# 5. Monitor production deployment
./scripts/render/status.sh

# 6. Verify production health
curl https://legal-platform.onrender.com/health

# 7. Monitor for 30 minutes
# Check logs, metrics, error rates
```

**Rollback if Issues:**

```bash
# Immediate rollback
git revert HEAD
git push origin main
```

---

### Environment Comparison

| Environment       | Branch  | URL                  | Database             | Cost    | Purpose             |
| ----------------- | ------- | -------------------- | -------------------- | ------- | ------------------- |
| **Local**         | N/A     | localhost:3000       | Docker Postgres      | Free    | Development         |
| **Staging**       | develop | staging.onrender.com | Render Starter 10GB  | $52/mo  | Integration testing |
| **Production**    | main    | legal-platform.com   | Render Standard 25GB | $207/mo | Live users          |
| **QA** (Optional) | qa      | qa.onrender.com      | Shared staging       | +$20/mo | QA team testing     |

---

## Database Migrations

### Running Migrations on Render

**Option 1: Automated (Recommended)**

Configure `preDeployCommand` in `render.yaml`:

```yaml
services:
  - type: web
    name: gateway
    # ... other config
    preDeployCommand: pnpm db:migrate
```

Migrations run automatically before each deployment.

**Pros:**

- ✅ Zero manual intervention
- ✅ Migrations always run before code deploy
- ✅ Consistent across all deployments

**Cons:**

- ⚠️ Deployment fails if migration fails
- ⚠️ No rollback mechanism for migrations

---

**Option 2: Manual via Render Shell**

```bash
# Open shell in gateway service
render shell --service gateway

# Run migrations
pnpm db:migrate

# Verify migrations applied
pnpm db:migrate:status

# Example output:
# ✅ 001_create_users_table.sql (applied)
# ✅ 002_create_cases_table.sql (applied)
# ✅ 003_add_user_roles.sql (applied)
# ⏳ 004_add_case_tags.sql (pending)

# Exit
exit
```

---

**Option 3: One-Off Job**

```bash
# Run migration job (doesn't interrupt running service)
render jobs run \
  --service gateway \
  --command "pnpm db:migrate"

# Monitor job
render jobs logs --job <job-id>

# Verify success
echo $?  # 0 = success
```

---

### Zero-Downtime Migration Strategy

**Challenge:** Running migrations while service is live can cause errors.

**Solution:** Blue-Green Deployment with Migration Phases

**Phase 1: Backward-Compatible Migration (Safe)**

```sql
-- Add new column with NULL (safe)
ALTER TABLE users ADD COLUMN phone_number VARCHAR(20);

-- Add new index (safe, background on PostgreSQL)
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- Rename column (requires code change)
-- Step 1: Add new column
ALTER TABLE users ADD COLUMN full_name VARCHAR(255);

-- Step 2: Copy data (background job)
UPDATE users SET full_name = first_name || ' ' || last_name;

-- Step 3: Deploy code using full_name
-- Step 4: Drop old columns (next migration)
```

**Phase 2: Deploy Code**

Code supports both old and new schema:

```typescript
// Read from new column, fallback to old
const fullName = user.full_name || `${user.first_name} ${user.last_name}`;
```

**Phase 3: Remove Old Schema**

```sql
-- Safe to drop after all code deployed
ALTER TABLE users DROP COLUMN first_name;
ALTER TABLE users DROP COLUMN last_name;
```

---

### Migration Rollback

**If Migration Fails:**

```bash
# 1. Check migration error logs
render logs --service gateway --tail

# 2. Fix migration SQL
# Edit migration file locally

# 3. Test migration locally
docker-compose up -d postgres
pnpm db:migrate

# 4. If migration cannot be fixed, rollback code
git revert HEAD
git push origin main

# 5. Redeploy (skips failed migration)
render deploy --service gateway --clear-cache

# 6. Apply corrected migration manually
render shell --service gateway
pnpm db:migrate:rollback --steps=1
pnpm db:migrate
exit
```

---

## Monitoring Deployments

### Viewing Deployment Status

**Render Dashboard:**

1. Navigate to service: https://dashboard.render.com/web/<service-id>
2. Click **"Deploys"** tab
3. View deployment timeline:
   - 🟢 **Live** - Currently running
   - ✅ **Success** - Deployment succeeded
   - ⏳ **Building** - Docker image building
   - 🚀 **Deploying** - Rolling out to instances
   - ❌ **Failed** - Deployment failed

**Real-Time Logs:**

```bash
# Stream deployment logs
render logs --service web --tail

# Filter by log level
render logs --service web --tail --level error

# Filter by time
render logs --service web --since 1h
```

---

### Health Checks

**Render automatically monitors health checks:**

Configured in `render.yaml`:

```yaml
services:
  - type: web
    name: web
    healthCheckPath: /health
```

**Health Check Behavior:**

- Render sends HTTP GET to `/health` every 30 seconds
- Service must respond with `200 OK` within 5 seconds
- If 3 consecutive failures → Service marked unhealthy
- Unhealthy service triggers:
  - Alert notifications (email, Slack)
  - Automatic restart attempt
  - Rollback to previous deployment (if enabled)

**Implement Health Check Endpoint:**

```typescript
// apps/web/src/pages/api/health.ts
import { NextApiRequest, NextApiResponse } from 'next';

export default async function healthCheck(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Check database connection
    await db.query('SELECT 1');

    // Check Redis connection
    await redis.ping();

    // Return healthy status
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.RENDER_GIT_COMMIT?.substring(0, 7),
    });
  } catch (error) {
    // Return unhealthy status
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
}
```

---

### Monitoring Metrics

**Render Native Metrics:**

1. Service → **Metrics** tab
2. View:
   - CPU usage (%)
   - Memory usage (MB)
   - Request rate (req/s)
   - Response time (ms, p50/p95/p99)
   - HTTP status codes (2xx, 4xx, 5xx)

**Export Metrics (API):**

```bash
# Get service metrics via API
curl -H "Authorization: Bearer $RENDER_API_KEY" \
  https://api.render.com/v1/services/<service-id>/metrics

# Response:
{
  "cpu": {"avg": 45, "max": 78},
  "memory": {"avg": 512, "max": 896},
  "requests": {"count": 15420, "rate": 10.5}
}
```

**New Relic Integration (Recommended):**

See [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md#monitoring-setup) for setup.

---

### Deployment Notifications

**Slack Integration:**

1. Create Slack webhook: https://api.slack.com/messaging/webhooks
2. Add webhook to GitHub repository secrets: `SLACK_WEBHOOK_URL`
3. Update `.github/workflows/build-publish.yml`:

```yaml
- name: Notify Slack
  if: always()
  run: |
    curl -X POST ${{ secrets.SLACK_WEBHOOK_URL }} \
      -H 'Content-Type: application/json' \
      -d '{
        "text": "🚀 Deployment to ${{ github.ref }} completed",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Status:* ${{ job.status }}\n*Commit:* ${{ github.sha }}\n*Author:* ${{ github.actor }}"
            }
          }
        ]
      }'
```

---

## Preview Environments

### Automatic PR Previews

**How it Works:**

1. Open Pull Request on GitHub
2. GitHub Actions triggers Render preview environment
3. Render deploys PR branch to isolated environment
4. Preview URL added as PR comment
5. Preview environment auto-deleted when PR closed

**Configuration:**

Update `.github/workflows/pr-validation.yml`:

```yaml
preview-environment:
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request'
  steps:
    - name: Create Render Preview
      run: |
        curl -X POST https://api.render.com/v1/services \
          -H "Authorization: Bearer ${{ secrets.RENDER_API_KEY }}" \
          -H "Content-Type: application/json" \
          -d '{
            "type": "web",
            "name": "web-pr-${{ github.event.pull_request.number }}",
            "env": "preview",
            "branch": "${{ github.head_ref }}",
            "autoDeploy": "yes"
          }'

    - name: Comment Preview URL
      uses: actions/github-script@v6
      with:
        script: |
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: '🚀 Preview environment: https://web-pr-${{ github.event.pull_request.number }}.onrender.com'
          })
```

---

### Cost Implications

**Preview Environment Costs:**

- Web + Gateway: ~$14/month per preview
- Shared staging database: $0 (use staging DB)
- **Total per PR: ~$14/month**

**Cost Management:**

1. **Auto-destroy after 7 days:**

   ```yaml
   - name: Schedule Preview Cleanup
     run: |
       # Add cron job to delete previews older than 7 days
       render services delete --service web-pr-${{ github.event.pull_request.number }}
   ```

2. **Manual preview creation:**
   - Disable auto-preview
   - Add manual workflow trigger
   - Only create previews for complex features

3. **Use free tier for previews:**
   ```yaml
   plan: free # Spins down after 15 min inactivity
   ```

**Recommended Strategy:**

- Enable auto-previews for `feature/*` branches only
- Disable for `fix/*`, `chore/*` branches
- Limit to 3 active previews at a time

---

## Troubleshooting

### Deployment Failures

#### Issue: Build Failing

**Symptoms:**

```
Error: Failed to build Docker image
npm ERR! code ENOENT
npm ERR! syscall open
```

**Solutions:**

1. **Check Dockerfile:**

   ```bash
   # Build locally to reproduce
   docker build -f infrastructure/docker/Dockerfile.web .

   # Common issues:
   # - Missing dependencies in package.json
   # - Incorrect COPY paths
   # - Missing .dockerignore (huge build context)
   ```

2. **Clear Render cache:**

   ```bash
   # Dashboard: Manual Deploy → Clear build cache & deploy
   # Or CLI:
   render deploy --service web --clear-cache
   ```

3. **Check build logs:**

   ```bash
   render logs --service web --build

   # Look for:
   # - npm install errors
   # - TypeScript compilation errors
   # - Missing environment variables during build
   ```

---

#### Issue: Health Check Failing

**Symptoms:**

```
Service failed to respond to health check at /health
Deployment failed after 10 minutes
```

**Solutions:**

1. **Test health endpoint locally:**

   ```bash
   # Start service locally
   pnpm dev

   # Test health check
   curl http://localhost:3000/health

   # Expected: {"status": "healthy"}
   ```

2. **Check health check path in render.yaml:**

   ```yaml
   healthCheckPath: /health # Ensure this matches actual endpoint
   ```

3. **Increase health check timeout:**

   ```yaml
   healthCheckPath: /health
   healthCheckGracePeriodSeconds: 60 # Increase from default 30s
   ```

4. **View service logs during startup:**

   ```bash
   render logs --service web --tail

   # Look for:
   # - Port binding errors
   # - Database connection errors
   # - Missing environment variables
   ```

---

#### Issue: Service Crashing

**Symptoms:**

```
Service crashed with exit code 1
Restarting service...
```

**Solutions:**

1. **Check application logs:**

   ```bash
   render logs --service web --level error --tail

   # Look for:
   # - Unhandled exceptions
   # - Database connection failures
   # - Out of memory errors
   ```

2. **Check resource limits:**

   ```bash
   # If memory usage > 95%, scale up
   render metrics --service web

   # Upgrade plan:
   # Dashboard → Service → Settings → Instance Type → Select larger plan
   ```

3. **Check environment variables:**

   ```bash
   render env list --service web | grep -i database

   # Ensure DATABASE_URL is set
   # Ensure REDIS_URL is set
   ```

---

### Database Connection Issues

**Symptoms:**

```
Error: connect ECONNREFUSED
```

**Solutions:**

1. **Verify DATABASE_URL is set:**

   ```bash
   render env list --service web | grep DATABASE_URL
   ```

2. **Check database is healthy:**

   ```bash
   render db status --database postgres

   # Expected: Status: available
   ```

3. **Test database connection:**

   ```bash
   render shell --service gateway
   psql $DATABASE_URL
   \conninfo
   \q
   exit
   ```

4. **Check connection pool settings:**

   ```typescript
   // Ensure pool doesn't exceed database limit (100 connections)
   max: 20,  // 7 services * 20 = 140 > 100 (too high!)
   min: 5,

   // Reduce to:
   max: 10,  // 7 services * 10 = 70 < 100 (safe)
   ```

---

### Slow Deployments

**Symptoms:**

```
Deployment taking > 10 minutes
```

**Solutions:**

1. **Optimize Docker build:**

   ```dockerfile
   # Use layer caching effectively
   COPY package*.json ./
   RUN npm ci  # Install dependencies (cached)

   COPY . .  # Copy source (not cached)
   RUN npm run build
   ```

2. **Reduce build context:**

   ```bash
   # Check .dockerignore includes:
   node_modules/
   .git/
   docs/
   *.md
   tests/
   ```

3. **Use smaller base image:**
   ```dockerfile
   # Instead of node:20 (1GB)
   FROM node:20-alpine  # 150MB
   ```

---

### Getting Help

**Render Support:**

- 📚 Documentation: https://render.com/docs
- 💬 Community Forum: https://community.render.com
- 📧 Support Email: support@render.com (paid plans)
- 📊 Status Page: https://status.render.com

**Team Support:**

- 📖 See [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md)
- 🚨 PagerDuty: On-call escalation

**Useful Commands:**

```bash
# View logs
./scripts/render/logs.sh web

# Check service status
./scripts/render/status.sh

# Open shell in service
./scripts/render/shell.sh gateway

# Trigger manual deployment
./scripts/render/deploy.sh production web
```

---

## Quick Reference

### Common Commands

```bash
# Deploy
render deploy --service web
./scripts/render/deploy.sh production

# Logs
render logs --service web --tail
./scripts/render/logs.sh web

# Shell
render shell --service web
./scripts/render/shell.sh web

# Status
render services list
./scripts/render/status.sh

# Rollback
render deploys redeploy --deploy <deploy-id>

# Database
render db status --database postgres
./scripts/render/db-backup.sh

# Environment variables
render env list --service web
render env set --service web --key KEY --value value
```

---

**Next Steps:**

1. Complete initial setup (Prerequisites)
2. Deploy to staging (validate costs)
3. Run integration tests
4. Deploy to production
5. Monitor for 48 hours
6. Implement cost optimizations

**Need Help?** Contact DevOps team or see [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md).
