# Infrastructure

This directory contains all Infrastructure as Code (IaC), containerization, and deployment configurations for the Legal Platform.

## Overview

**We use [Render.com](https://render.com) for all infrastructure.**

Render is a Platform-as-a-Service (PaaS) that provides:

- ✅ **Simple Deployment:** Git push to deploy (no Kubernetes/Terraform complexity)
- ✅ **Cost-Effective:** $207/month production vs $1,189/month on Azure (83% savings)
- ✅ **Auto-Scaling:** Automatic horizontal and vertical scaling
- ✅ **Managed Services:** PostgreSQL, Redis, monitoring, SSL/TLS included
- ✅ **Developer-Friendly:** Preview environments, zero-downtime deploys, excellent logs

**Cost Comparison (3-Year TCO):**

- Render: $40,200 (infrastructure + DevOps)
- Azure: $114,804 (infrastructure + DevOps)
- **Savings: $74,604 over 3 years**

See [COST_ESTIMATION.md](./COST_ESTIMATION.md) for detailed breakdown.

## Architecture

### High-Level Architecture

```
┌─────────────┐
│   GitHub    │
│  (develop)  │──────▶ Render Staging Environment
└─────────────┘

┌─────────────┐
│   GitHub    │
│   (main)    │──────▶ Render Production Environment
└─────────────┘
```

### Service Architecture

```
                    ┌──────────────────┐
                    │   Users/Browser  │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   Web (Next.js)  │
                    │  2× 4GB instances │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  Gateway (GraphQL)│
                    │  2× 4GB instances │
                    └────────┬─────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐         ┌─────▼─────┐       ┌─────▼─────┐
   │Document │         │    AI     │       │   Task    │
   │Service  │         │  Service  │       │  Service  │
   │1× 2GB   │         │  1× 2GB   │       │  1× 2GB   │
   └─────────┘         └───────────┘       └───────────┘

   ┌────────────┐      ┌────────────┐
   │Integration │      │Notification│
   │  Service   │      │  Service   │
   │  1× 2GB    │      │  1× 2GB    │
   └────────────┘      └────────────┘

        │                    │
   ┌────▼────────────────────▼─────┐
   │    PostgreSQL (25GB)          │
   │    Redis (1GB)                │
   └───────────────────────────────┘
```

All services communicate via private internal networking on Render.

## Quick Start

### Prerequisites

1. **Render Account:** Sign up at https://render.com
2. **GitHub Connected:** Connect your GitHub account to Render
3. **Billing Configured:** Add payment method (free trial available)

### Local Development

```bash
# Clone repository
git clone https://github.com/your-org/legal-platform.git
cd legal-platform

# Install dependencies
pnpm install

# Start local environment (Docker Compose)
cd infrastructure/docker
docker-compose up -d

# Run database migrations
pnpm db:migrate

# Start development servers
pnpm dev
```

See [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) for detailed setup.

### Deploy to Render

**Option 1: Deploy via Render Dashboard**

1. Log in to Render Dashboard: https://dashboard.render.com
2. Click "New +" → "Blueprint"
3. Connect repository: `your-org/legal-platform`
4. Select branch: `develop` (staging) or `main` (production)
5. Render reads `render.yaml` and creates all services
6. Configure environment variables (see [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md))
7. Click "Apply" to deploy

**Option 2: Deploy via Render CLI**

```bash
# Install Render CLI
npm install -g @render/cli

# Login
render login

# Deploy from render.yaml
render blueprint deploy --branch main
```

**Option 3: Automatic Git-based Deployment (Recommended)**

1. Push to `develop` branch → Auto-deploys to staging
2. Push to `main` branch → Auto-deploys to production

GitHub Actions automatically triggers Render deployments via Deploy Hooks.

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed procedures.

## Environments

### Production

- **Branch:** `main`
- **URL:** https://legal-platform.onrender.com (or custom domain)
- **Instances:** 11 services (2× web, 2× gateway, 1× each microservice)
- **Database:** PostgreSQL Standard 25GB with daily backups
- **Redis:** 1GB with persistence
- **Cost:** $207/month
- **Auto-Deploy:** Enabled on push to `main`

### Staging

- **Branch:** `develop`
- **URL:** https://legal-platform-staging.onrender.com
- **Instances:** 7 services (1× each, smaller sizes)
- **Database:** PostgreSQL Starter 10GB with daily backups
- **Redis:** 512MB
- **Cost:** $52/month
- **Auto-Deploy:** Enabled on push to `develop`

### Local Development

- **Environment:** Docker Compose
- **Services:** All 7 microservices + PostgreSQL + Redis
- **URL:** http://localhost:3000 (web), http://localhost:4000 (gateway)
- **Database:** PostgreSQL 16 with pgvector extension
- **Cost:** Free (runs on your machine)

See [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) for setup instructions.

## Services

All services are defined in [`/render.yaml`](../render.yaml) at the project root.

### Frontend Services

| Service | Type        | Instances | RAM | Port | Cost   | Description                  |
| ------- | ----------- | --------- | --- | ---- | ------ | ---------------------------- |
| **web** | Web Service | 2×        | 4GB | 3000 | $50/mo | Next.js frontend application |

### API Gateway

| Service     | Type        | Instances | RAM | Port | Cost   | Description                         |
| ----------- | ----------- | --------- | --- | ---- | ------ | ----------------------------------- |
| **gateway** | Web Service | 2×        | 4GB | 4000 | $50/mo | GraphQL API Gateway (Apollo Server) |

### Microservices

| Service                  | Type        | Instances | RAM | Port | Cost   | Description                                |
| ------------------------ | ----------- | --------- | --- | ---- | ------ | ------------------------------------------ |
| **document-service**     | Web Service | 1×        | 2GB | 5001 | $15/mo | Document management and storage            |
| **ai-service**           | Web Service | 1×        | 2GB | 5002 | $15/mo | AI/ML processing (OpenAI integration)      |
| **task-service**         | Web Service | 1×        | 2GB | 5003 | $15/mo | Task and deadline management               |
| **integration-service**  | Web Service | 1×        | 2GB | 5004 | $15/mo | Third-party integrations (email, calendar) |
| **notification-service** | Web Service | 1×        | 2GB | 5005 | $15/mo | Email and push notifications               |

### Databases

| Service      | Type       | Size | Cost   | Description                                          |
| ------------ | ---------- | ---- | ------ | ---------------------------------------------------- |
| **postgres** | PostgreSQL | 25GB | $25/mo | PostgreSQL 16 with pgvector extension, daily backups |
| **redis**    | Redis      | 1GB  | $10/mo | Redis 7 for caching and session management           |

**Total Production Cost:** $207/month

## Database & Cache

### PostgreSQL Database

- **Provider:** Render Managed PostgreSQL
- **Version:** PostgreSQL 16
- **Extensions:** pgvector 0.5+ (for semantic search)
- **Size:** 25GB Standard (production), 10GB Starter (staging)
- **Connection:** Auto-injected as `DATABASE_URL` environment variable
- **Backups:** Daily automated backups with 7-day retention
- **High Availability:** Automatic failover on Standard plan
- **SSL:** Enforced for all connections

**Connection String Format:**

```
postgresql://user:password@host:5432/dbname?sslmode=require
```

**Manual Backup:**

```bash
# Using Render CLI
render db backup --database postgres

# Using scripts
./scripts/render/db-backup.sh
```

**Restore from Backup:**

```bash
# List backups
render db list-backups --database postgres

# Restore specific backup
render db restore --database postgres --backup-id <backup-id>

# Or use script
./scripts/render/db-restore.sh <backup-id>
```

**Migrations:**

```bash
# Run migrations on Render
render shell --service gateway
pnpm db:migrate

# Or use one-off job
render jobs run --service gateway --command "pnpm db:migrate"
```

### Redis Cache

- **Provider:** Render Managed Redis
- **Version:** Redis 7.x
- **Size:** 1GB (production), 512MB (staging)
- **Connection:** Auto-injected as `REDIS_URL` environment variable
- **Persistence:** RDB snapshots enabled
- **Eviction Policy:** allkeys-lru (Least Recently Used)
- **Use Cases:** Session storage, API response caching, rate limiting

**Connection String Format:**

```
redis://red-xxxxx:6379
```

**Monitoring Redis:**

```bash
# Connect via CLI
redis-cli -u $REDIS_URL

# Check memory usage
redis-cli -u $REDIS_URL INFO memory

# Monitor commands in real-time
redis-cli -u $REDIS_URL MONITOR
```

### Backup Strategy

| Component         | Frequency       | Retention  | Recovery Time |
| ----------------- | --------------- | ---------- | ------------- |
| PostgreSQL        | Daily automated | 7 days     | < 1 hour      |
| PostgreSQL Manual | On-demand       | 30 days    | < 1 hour      |
| Redis             | RDB snapshots   | Continuous | < 5 minutes   |
| Application State | Not backed up   | N/A        | N/A           |

**Disaster Recovery Plan:**

1. **Database Failure:** Render auto-fails over to standby replica (< 60s downtime)
2. **Data Corruption:** Restore from most recent backup (< 1 hour)
3. **Complete Service Failure:** Redeploy from `render.yaml` (< 15 minutes)
4. **Region Outage:** Manual failover to new region (requires DNS update, < 30 minutes)

See [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md) for detailed procedures.

## Monitoring

### Render Native Monitoring

**Included with all Render services (no additional cost):**

- **Metrics:** CPU, memory, disk, network, request rate, response time
- **Logs:** 30-day retention, real-time streaming, search and filter
- **Uptime Monitoring:** HTTP health checks every 30 seconds
- **Deployment History:** All deployments, rollbacks, and failures
- **Alerts:** Email and Slack notifications for service failures

**Access Monitoring:**

```bash
# View logs
render logs --service web --tail

# View metrics
render metrics --service web

# View service status
./scripts/render/status.sh
```

**Render Dashboard:** https://dashboard.render.com

### New Relic APM (Recommended)

**Free Tier:** 100GB/month data ingestion

**Features:**

- Application Performance Monitoring (APM)
- Distributed tracing across microservices
- Error tracking with stack traces
- Custom dashboards and alerts
- Database query performance
- Real User Monitoring (RUM) for frontend

**Setup:**

1. Sign up at https://newrelic.com (free tier)
2. Get license key from New Relic dashboard
3. Set `NEW_RELIC_LICENSE_KEY` environment variable in Render
4. Deploy services (New Relic agent auto-instruments)

**Access:** https://one.newrelic.com

See [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md#monitoring-setup) for detailed setup.

### Alerts Configuration

**Critical Alerts (PagerDuty/SMS):**

- Service down (no health check response for 2 minutes)
- Error rate > 5%
- Database connections exhausted (>90% pool usage)
- Disk space > 90%

**Warning Alerts (Email/Slack):**

- Response time p95 > 2 seconds
- CPU usage > 80% for 5 minutes
- Memory usage > 85% for 5 minutes
- Failed deployments

## Cost Breakdown

### Production Environment ($207/month)

| Component                  | Quantity    | Unit Cost | Total       |
| -------------------------- | ----------- | --------- | ----------- |
| Web Service (4GB)          | 2 instances | $25/mo    | $50         |
| Gateway Service (4GB)      | 2 instances | $25/mo    | $50         |
| Document Service (2GB)     | 1 instance  | $15/mo    | $15         |
| AI Service (2GB)           | 1 instance  | $15/mo    | $15         |
| Task Service (2GB)         | 1 instance  | $15/mo    | $15         |
| Integration Service (2GB)  | 1 instance  | $15/mo    | $15         |
| Notification Service (2GB) | 1 instance  | $15/mo    | $15         |
| PostgreSQL Standard (25GB) | 1 database  | $25/mo    | $25         |
| Redis (1GB)                | 1 instance  | $10/mo    | $10         |
| **Total**                  |             |           | **$207/mo** |

### Staging Environment ($52/month)

| Component                    | Quantity   | Unit Cost | Total      |
| ---------------------------- | ---------- | --------- | ---------- |
| Web Service (1GB)            | 1 instance | $7/mo     | $7         |
| Gateway Service (1GB)        | 1 instance | $7/mo     | $7         |
| Document Service (512MB)     | 1 instance | $7/mo     | $7         |
| AI Service (512MB)           | 1 instance | $7/mo     | $7         |
| Task Service (512MB)         | 1 instance | $7/mo     | $7         |
| Integration Service (512MB)  | 1 instance | $7/mo     | $7         |
| Notification Service (512MB) | 1 instance | $7/mo     | $7         |
| PostgreSQL Starter (10GB)    | 1 database | $7/mo     | $7         |
| Redis (512MB)                | 1 instance | $7/mo     | $7         |
| **Total**                    |            |           | **$52/mo** |

### Annual Cost Summary

- **Staging:** $52/mo × 12 = $624/year
- **Production:** $207/mo × 12 = $2,484/year
- **Total:** $3,108/year

**Comparison to Azure:**

- Azure: $14,268/year (infrastructure only)
- Render: $2,484/year (infrastructure only)
- **Savings: $11,784/year (83% reduction)**

### Cost Optimization Tips

1. **Right-size instances:** Monitor CPU/memory and scale down unused capacity
2. **Use preview environments sparingly:** Each PR preview costs ~$5/month
3. **Optimize database queries:** Avoid scaling database by improving query performance
4. **Stay within New Relic free tier:** Monitor data ingestion (100GB/month limit)
5. **Review monthly:** Use Render's cost dashboard to identify optimization opportunities

See [COST_ESTIMATION.md](./COST_ESTIMATION.md) for detailed analysis and projections.

## Scaling Strategy

### When to Scale

**Scale Up (Vertical Scaling) when:**

- CPU usage consistently > 70%
- Memory usage consistently > 80%
- Response time p95 > 1.5 seconds
- Database connections > 75% of pool

**Scale Out (Horizontal Scaling) when:**

- Request rate increasing (add more instances)
- Need higher availability (add redundancy)
- Single instance CPU/memory maxed out
- Geographic distribution needed

### How to Scale on Render

**Vertical Scaling (Increase RAM/CPU):**

```bash
# Via Dashboard
1. Go to Service → Settings → Instance Type
2. Select larger plan (e.g., 4GB → 8GB)
3. Click "Save Changes" → Auto-redeploys

# Via render.yaml
Update plan in render.yaml and push to GitHub:
  plan: standard-plus  # 8GB RAM
```

**Horizontal Scaling (Add Instances):**

```bash
# Via Dashboard
1. Go to Service → Settings → Scaling
2. Increase instance count (e.g., 1 → 2)
3. Click "Save Changes" → Spins up new instances

# Via render.yaml
Update numInstances in render.yaml and push:
  numInstances: 3
```

**Auto-Scaling (Render Pro+):**

Render automatically scales instances based on:

- CPU usage
- Memory usage
- Request rate
- Custom metrics

**Database Scaling:**

```bash
# Vertical Scaling (increase storage)
1. Go to Database → Settings → Plan
2. Select larger plan (e.g., 25GB → 50GB)
3. Click "Save Changes" → Scales with zero downtime

# Read Replicas (for heavy read workloads)
1. Go to Database → Replicas
2. Click "Add Read Replica"
3. Update application to use read replica for queries
```

### Expected Growth Path

| User Count   | Services                                          | Database | Monthly Cost | Notes           |
| ------------ | ------------------------------------------------- | -------- | ------------ | --------------- |
| 0-500        | Current setup (2×4GB web/gateway, 1×2GB services) | 25GB     | $207         | Baseline        |
| 500-1,000    | Scale web/gateway to 3 instances                  | 25GB     | $280         | +$73/mo         |
| 1,000-2,500  | Scale services to 2×2GB each                      | 50GB     | $400         | +$120/mo        |
| 2,500-5,000  | Scale web/gateway to 4×4GB                        | 100GB    | $650         | +$250/mo        |
| 5,000-10,000 | Scale all services to 2-4 instances               | 200GB    | $1,000       | +$350/mo        |
| 10,000+      | Consider migration to Kubernetes                  | 500GB+   | $1,500+      | Time to migrate |

**Timeline to outgrow Render:** 2-5 years for most legal SaaS platforms.

## Migration Path

### When to Stay on Render

✅ **Stay on Render if:**

- User count < 10,000 daily active users
- Single-region deployment acceptable
- Standard networking requirements
- Database < 500GB
- Budget-conscious (want to minimize DevOps overhead)
- Team size < 20 engineers

### When to Migrate from Render

⚠️ **Consider migration if:**

- 10,000+ daily active users with high concurrency
- Multi-region latency requirements (< 100ms globally)
- Custom networking (VPN, VPC peering, IP whitelisting)
- Database > 500GB (Render max is 1TB)
- Compliance requires specific cloud provider (Azure GovCloud, AWS GovCloud)
- Need Kubernetes features (custom schedulers, sidecars, operators)
- Cost becomes cheaper to self-manage ($1,500+/month on Render)

### Migration Options

**Option 1: Migrate to Azure Kubernetes Service (AKS)**

- All IaC archived in `infrastructure/archive/`
- Estimated effort: 3-4 weeks
- Cost: $1,189/month + DevOps overhead
- Use case: Enterprise requirements, Azure compliance

**Option 2: Migrate to AWS EKS**

- Leverage existing Docker images
- Estimated effort: 4-6 weeks
- Cost: $1,450/month + DevOps overhead
- Use case: AWS ecosystem, multi-region

**Option 3: Migrate to DigitalOcean + Coolify**

- Kubernetes management platform
- Estimated effort: 2-3 weeks
- Cost: $389/month + DevOps overhead
- Use case: More control than Render, less cost than AWS

**Option 4: Stay on Render with Optimizations**

- Use read replicas for database
- Optimize queries and caching
- Use CDN for static assets
- Estimated cost at scale: $1,000-1,500/month
- Use case: Avoid migration complexity

See `infrastructure/archive/` for Azure Kubernetes/Terraform configurations.

## Troubleshooting

### Common Issues

#### Service Won't Start

**Symptoms:** Service status "Deploy failed" in Render dashboard

**Causes & Solutions:**

1. **Missing environment variables**

   ```bash
   # Check logs for missing env vars
   render logs --service web --tail

   # Add missing variables in Render dashboard
   Service → Environment → Add Environment Variable
   ```

2. **Docker build failure**

   ```bash
   # Test Docker build locally
   docker build -f infrastructure/docker/Dockerfile.web .

   # Check .dockerignore and .renderignore
   # Ensure all dependencies in package.json
   ```

3. **Port binding issue**
   ```bash
   # Ensure service listens on process.env.PORT (Render injects this)
   # In Next.js: next start -p $PORT
   # In Express: app.listen(process.env.PORT || 4000)
   ```

#### Database Connection Refused

**Symptoms:** `ECONNREFUSED` or `could not connect to server` errors

**Solutions:**

1. **Check DATABASE_URL is set**

   ```bash
   render env list --service web | grep DATABASE_URL
   ```

2. **Verify database is healthy**

   ```bash
   render db status --database postgres
   ```

3. **Check connection pooling**
   ```typescript
   // Ensure proper connection pool config
   max: 20,  // Don't exceed database connection limit (100)
   min: 5,
   idle: 10000
   ```

#### Slow Performance

**Symptoms:** Response time > 2 seconds, timeouts

**Solutions:**

1. **Check CPU/Memory usage**

   ```bash
   render metrics --service web

   # If CPU > 80%, scale up
   # If memory > 85%, scale up
   ```

2. **Analyze slow queries**

   ```bash
   # Enable slow query logging
   render shell --service gateway
   psql $DATABASE_URL

   SELECT query, calls, total_time, mean_time
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 10;
   ```

3. **Add caching**
   ```typescript
   // Use Redis for frequently accessed data
   await redis.setex(`user:${userId}`, 3600, JSON.stringify(user));
   ```

#### Deployment Stuck

**Symptoms:** Deployment running > 10 minutes

**Solutions:**

1. **Cancel and retry**

   ```bash
   # Cancel via dashboard or CLI
   render deploy cancel --service web

   # Retry
   git push origin main --force-with-lease
   ```

2. **Check build logs**

   ```bash
   render logs --service web --build
   ```

3. **Verify GitHub Actions**
   ```bash
   # Check GitHub Actions workflow
   # Ensure Deploy Hook is configured correctly
   ```

#### High Costs

**Symptoms:** Monthly bill higher than expected

**Solutions:**

1. **Review service instances**

   ```bash
   render services list

   # Check for unused preview environments
   # Check for over-provisioned instances
   ```

2. **Optimize database**

   ```bash
   # Check database size
   render db status --database postgres

   # Vacuum and analyze
   render shell --service gateway
   psql $DATABASE_URL
   VACUUM ANALYZE;
   ```

3. **Set budget alerts**
   ```bash
   # In Render Dashboard → Billing → Budget Alerts
   # Set alert at $230/month (110% of estimate)
   ```

### Getting Help

**Render Support:**

- Documentation: https://render.com/docs
- Community Forum: https://community.render.com
- Support (Pro+): support@render.com
- Status Page: https://status.render.com

**Team Contacts:**

- DevOps Lead: See [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md)
- On-Call Engineer: PagerDuty escalation

**Debugging Commands:**

```bash
# View real-time logs
./scripts/render/logs.sh web

# Check service status
./scripts/render/status.sh

# Open shell in service
./scripts/render/shell.sh gateway

# Trigger manual deployment
./scripts/render/deploy.sh production
```

## Directory Structure

```
infrastructure/
├── archive/                   # Archived Azure/Kubernetes documentation
│   ├── README.md             # Explanation of archived files
│   ├── DEPLOYMENT_GUIDE_AZURE.md
│   ├── ROLLBACK_GUIDE_AZURE.md
│   ├── OPERATIONS_RUNBOOK_AZURE.md
│   └── ARCHITECTURE_DIAGRAMS_AZURE.md
├── docker/                    # Docker configurations
│   ├── Dockerfile.web        # Optimized for Render
│   ├── Dockerfile.gateway    # Optimized for Render
│   ├── Dockerfile.service    # Generic service template
│   ├── docker-compose.yml    # Local development
│   ├── docker-compose.test.yml  # CI testing
│   └── README.md
├── render/                    # Render-specific configuration
│   └── environment-template.yaml  # Environment variable templates
├── README.md                  # This file
├── COST_ESTIMATION.md         # Cost analysis and projections
├── DEPLOYMENT_GUIDE.md        # Deployment procedures
├── OPERATIONS_RUNBOOK.md      # Operations and maintenance
├── ENVIRONMENT_VARIABLES.md   # Environment variable documentation
├── LOCAL_DEVELOPMENT.md       # Local development setup
└── MIGRATION_CHECKLIST.md     # Migration procedures
```

## Additional Documentation

- **[COST_ESTIMATION.md](./COST_ESTIMATION.md)** - Detailed cost analysis and projections
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Step-by-step deployment procedures
- **[OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md)** - Daily operations and incident response
- **[ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)** - Complete environment variable reference
- **[LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)** - Local development environment setup
- **[MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md)** - Migration procedures and checklists

## Monorepo Overview

The Legal Platform follows a monorepo architecture using Turborepo for build orchestration and pnpm workspaces for dependency management.

### Root Structure

```
legal-platform/
├── .github/           # GitHub Actions CI workflows
├── apps/              # Deployable applications
│   ├── web/          # Next.js frontend application
│   └── admin/        # Admin dashboard application
├── services/          # Backend microservices
│   ├── gateway/      # GraphQL API Gateway
│   ├── document-service/
│   ├── task-service/
│   ├── ai-service/
│   ├── integration-service/
│   └── notification-service/
├── packages/          # Shared packages and libraries
│   ├── ui/           # UI component library
│   ├── shared/       # Shared types and utilities
│   ├── database/     # Database client and repositories
│   ├── logger/       # Logging utilities
│   └── config/       # Shared configurations (ESLint, Prettier, TypeScript)
├── infrastructure/    # Infrastructure as Code (this directory)
├── scripts/          # Build and deployment scripts
│   └── render/       # Render helper scripts
├── docs/             # Documentation
└── tests/            # E2E and integration tests
```

### Workspace Configuration

The monorepo uses:

- **Package Manager:** pnpm 9.0+ with workspaces
- **Build Tool:** Turborepo 2.3+ for parallel task execution and caching
- **Node Version:** 20.0.0+ LTS

### Turborepo Tasks

Configured in `/turbo.json`:

- `build` - Build all apps and services with dependency ordering
- `dev` - Run development servers (no cache, persistent)
- `lint` - Lint all packages with ESLint
- `test` - Run Jest unit tests with coverage
- `clean` - Clean build artifacts

### pnpm Workspaces

Configured in `/pnpm-workspace.yaml`:

- `apps/*` - Frontend applications
- `packages/*` - Shared packages
- `packages/shared/*` - Shared types and utilities
- `services/*` - Backend microservices

---

**Need Help?** See [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md) or contact the DevOps team.
