# Local Development Setup

This guide explains how to set up and run the Legal Platform locally using Docker Compose, mirroring the Render.com production environment as closely as possible.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Environment Configuration](#environment-configuration)
4. [Running Services](#running-services)
5. [Development Workflow](#development-workflow)
6. [Troubleshooting](#troubleshooting)
7. [Testing](#testing)

---

## Prerequisites

### Required Software

- **Docker Desktop** 4.20+ (includes Docker Compose)
- **Node.js** 20.0.0+ LTS
- **pnpm** 9.0+
- **Git** 2.40+
- **VS Code** (recommended) with recommended extensions

### Install Prerequisites (macOS)

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js via nvm (recommended for version management)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Install pnpm
npm install -g pnpm

# Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop
```

### Verify Installation

```bash
docker --version          # Should show 24.0+
docker-compose --version  # Should show 2.20+
node --version            # Should show 20.x.x
pnpm --version            # Should show 9.x.x
```

---

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/your-org/legal-platform.git
cd legal-platform
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
pnpm install

# This will install dependencies for:
# - apps/web
# - services/gateway
# - All other services
# - Shared packages
```

### 3. Configure Environment

```bash
# Copy environment example files
cp .env.example .env
cp apps/web/.env.example apps/web/.env
cp services/gateway/.env.example services/gateway/.env

# For all services
for service in document-service ai-service task-service integration-service notification-service; do
  cp services/$service/.env.example services/$service/.env
done
```

### 4. Start Docker Compose Stack

```bash
cd infrastructure/docker

# Start all services
docker-compose up -d

# Wait for services to be ready (~2 minutes)
docker-compose ps

# Expected output:
# NAME                STATUS       PORTS
# postgres            running      5432:5432
# redis               running      6379:6379
# web                 running      3000:3000
# gateway             running      4000:4000
# document-service    running      5000:5000
# ai-service          running      5001:5001
# task-service        running      5002:5002
# integration-service running      5003:5003
# notification-service running     5004:5004
```

### 5. Verify Setup

```bash
# Check web app
curl http://localhost:3000/api/health
# Expected: {"status":"healthy"}

# Check GraphQL gateway
curl http://localhost:4000/health
# Expected: {"status":"healthy"}

# Open in browser
open http://localhost:3000
```

---

## Environment Configuration

### Root .env File

**Mirror Render Environment Variables**

```bash
# .env.local

# Node Environment
NODE_ENV=development

# Database (matches Render format)
DATABASE_URL=postgresql://postgres:password@localhost:5432/legaldb

# Redis (matches Render format)
REDIS_URL=redis://localhost:6379

# JWT Authentication (generate with: openssl rand -base64 32)
JWT_SECRET=your-local-jwt-secret-here

# API URLs (local)
API_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000/graphql
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Storage (Cloudflare R2 or local filesystem)
STORAGE_PROVIDER=local  # Use 'cloudflare-r2' for production-like
STORAGE_PATH=./uploads  # Local filesystem path
# STORAGE_BUCKET=legal-platform-documents  # Uncomment for R2
# STORAGE_ACCESS_KEY=  # R2 access key
# STORAGE_SECRET_KEY=  # R2 secret key

# Claude AI (required for AI features - use your own key)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...your-key-here...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_SKILLS_ENABLED=false  # Set to true when Skills API access is available

# Grok AI (optional fallback provider)
# XAI_API_KEY=xai-...your-key-here...
# XAI_MODEL=grok-2-1212

# Email/Notifications (SendGrid or local SMTP)
SMTP_HOST=localhost
SMTP_PORT=1025  # MailHog for local testing
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=dev@legal-platform.local

# Feature Flags
ENABLE_AI_FEATURES=true
ENABLE_DOCUMENT_PREVIEW=true
ENABLE_NOTIFICATIONS=true

# Logging
LOG_LEVEL=debug
```

**Note:** These environment variables mirror the Render production setup. See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for complete reference.

### Web App .env File

```bash
# apps/web/.env.local

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:4000/graphql
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Feature Flags
NEXT_PUBLIC_ENABLE_AI_FEATURES=true
NEXT_PUBLIC_ENABLE_DOCUMENT_PREVIEW=true
```

### Gateway .env File

```bash
# services/gateway/.env

PORT=4000
NODE_ENV=development

# Service URLs (internal)
DOCUMENT_SERVICE_URL=http://localhost:5000
AI_SERVICE_URL=http://localhost:5001
TASK_SERVICE_URL=http://localhost:5002
INTEGRATION_SERVICE_URL=http://localhost:5003
NOTIFICATION_SERVICE_URL=http://localhost:5004
```

---

## Running Services

### Development Mode (Hot Reload)

For active development with hot reload:

```bash
# Terminal 1: Start databases only
cd infrastructure/docker
docker-compose up postgres redis

# Terminal 2: Run web app with hot reload
cd apps/web
pnpm dev

# Terminal 3: Run gateway with hot reload
cd services/gateway
pnpm dev

# Terminal 4: Run specific microservice
cd services/document-service
pnpm dev
```

### Full Stack with Docker

Run everything in Docker containers:

```bash
cd infrastructure/docker

# Start all services
docker-compose up

# Or run in background
docker-compose up -d

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f web
```

### Production-like Environment

Test with production-like Docker images:

```bash
cd infrastructure/docker

# Build production images
docker-compose -f docker-compose.prod.yml build

# Run production stack
docker-compose -f docker-compose.prod.yml up
```

### Testing Environment

Run with test configuration:

```bash
cd infrastructure/docker

# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Run tests
cd ../..
pnpm test
pnpm test:e2e
```

---

## Development Workflow

### Daily Development

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install new dependencies (if package.json changed)
pnpm install

# 3. Start Docker services
cd infrastructure/docker
docker-compose up -d postgres redis

# 4. Run app in development mode
cd ../../apps/web
pnpm dev

# 5. Make changes and see live reload
# Open http://localhost:3000 in browser
```

### Database Migrations

```bash
# Generate migration
cd services/gateway
pnpm migration:generate --name add_users_table

# Run migrations
pnpm migration:run

# Rollback migration
pnpm migration:rollback
```

### Seed Database

```bash
# Seed with sample data
cd services/gateway
pnpm db:seed

# Reset database and reseed
pnpm db:reset
```

### Code Quality Checks

```bash
# Lint all code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Type check
pnpm type-check

# Format code
pnpm format

# Run all checks (lint + type + test)
pnpm validate
```

### Running Tests

```bash
# Unit tests (all packages)
pnpm test

# Unit tests with coverage
pnpm test:coverage

# Watch mode for development
pnpm test:watch

# E2E tests
pnpm test:e2e

# Specific service tests
cd services/gateway
pnpm test
```

---

## Troubleshooting

### Port Already in Use

**Problem:** `Error: Port 3000 is already allocated`

**Solution:**

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

### Database Connection Failed

**Problem:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution:**

```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Restart PostgreSQL
docker-compose restart postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Verify connection string in .env
echo $DATABASE_URL
```

### Redis Connection Failed

**Problem:** `Error: Redis connection to localhost:6379 failed`

**Solution:**

```bash
# Verify Redis is running
docker-compose ps redis

# Restart Redis
docker-compose restart redis

# Test Redis connection
docker-compose exec redis redis-cli PING
# Expected: PONG
```

### Slow Build Times

**Problem:** `pnpm build` takes too long

**Solution:**

```bash
# Clear Turbo cache
pnpm turbo clean

# Clear node_modules and reinstall
rm -rf node_modules
pnpm install

# Use Turbo's parallel builds
pnpm build --parallel
```

### Docker Out of Space

**Problem:** `Error: no space left on device`

**Solution:**

```bash
# Clean up Docker resources
docker system prune -a --volumes

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune
```

### Hot Reload Not Working

**Problem:** Changes not reflecting in browser

**Solution:**

```bash
# For Next.js on macOS
# Add to next.config.js:
module.exports = {
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    }
    return config
  },
}

# Restart dev server
pnpm dev
```

---

## Testing

### Running Full Test Suite

```bash
# All tests
pnpm test:all

# Expected output:
# ✓ Unit tests passed (450 tests)
# ✓ Integration tests passed (120 tests)
# ✓ E2E tests passed (45 tests)
```

### Testing Specific Components

```bash
# Web app tests
cd apps/web
pnpm test

# Gateway tests
cd services/gateway
pnpm test

# Test specific file
pnpm test src/services/auth.test.ts

# Test with coverage
pnpm test:coverage
```

### E2E Testing

```bash
# Start test environment
cd infrastructure/docker
docker-compose -f docker-compose.test.yml up -d

# Run E2E tests
cd ../..
pnpm test:e2e

# Run specific E2E test
pnpm test:e2e tests/e2e/login.spec.ts

# Run in UI mode (interactive)
pnpm test:e2e --ui
```

### Testing with Production Build

```bash
# Build production
pnpm build

# Start production build locally
cd apps/web
pnpm start

# Test production build
curl http://localhost:3000/api/health
```

---

## VS Code Setup

### Recommended Extensions

Install these extensions for optimal development experience:

- **ESLint** (dbaeumer.vscode-eslint)
- **Prettier** (esbenp.prettier-vscode)
- **TypeScript** (ms-vscode.vscode-typescript-next)
- **Docker** (ms-azuretools.vscode-docker)
- **GitLens** (eamodio.gitlens)
- **Tailwind CSS IntelliSense** (bradlc.vscode-tailwindcss)
- **GraphQL** (graphql.vscode-graphql)
- **Prisma** (prisma.prisma) (if using Prisma)

### Workspace Settings

Create `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

### Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "cwd": "${workspaceFolder}/apps/web",
      "port": 9229
    },
    {
      "name": "Gateway: debug",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "cwd": "${workspaceFolder}/services/gateway",
      "port": 9230
    }
  ]
}
```

---

## Matching Production (Render)

### Replicate Render Environment Locally

To ensure local development matches the Render production environment:

**1. Use Same Environment Variables**

```bash
# Copy production environment structure (not values!)
# See infrastructure/render/environment-template.yaml

# Match DATABASE_URL format
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# Match REDIS_URL format
REDIS_URL=redis://localhost:6379

# Match service URLs
DOCUMENT_SERVICE_URL=http://localhost:5001
AI_SERVICE_URL=http://localhost:5002
```

**2. Use Same Node.js Version**

```bash
# Check Render Node.js version (from Dockerfile)
cat infrastructure/docker/Dockerfile.web | grep "FROM node"
# Output: FROM node:20-alpine

# Use same version locally
nvm install 20
nvm use 20
node --version  # Should match 20.x.x
```

**3. Use Same Database Version**

```bash
# infrastructure/docker/docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine  # Matches Render PostgreSQL 16
    environment:
      POSTGRES_DB: legaldb
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
```

**4. Test with Production Build**

```bash
# Build production images locally
docker build -f infrastructure/docker/Dockerfile.web -t legal-web:local .
docker build -f infrastructure/docker/Dockerfile.gateway -t legal-gateway:local .

# Run production build
docker run -p 3000:3000 --env-file .env.production legal-web:local

# Verify health
curl http://localhost:3000/health
```

---

### Use Database Snapshots from Render

**Download Production Database Snapshot:**

```bash
# 1. Create manual backup on Render
render db backup --database postgres

# 2. List backups
render db list-backups --database postgres

# 3. Export backup
render db export \
  --database postgres \
  --backup-id bkp-xxxxx \
  --output production-snapshot.sql

# 4. Load into local database
docker-compose exec postgres psql -U postgres -d legaldb < production-snapshot.sql

# 5. Anonymize sensitive data (IMPORTANT!)
docker-compose exec postgres psql -U postgres -d legaldb

UPDATE users SET email = 'user' || id || '@example.com', phone = NULL;
UPDATE cases SET client_email = 'client' || id || '@example.com';
\q
```

**Schedule Weekly Snapshot Refresh:**

```bash
# scripts/local/refresh-db-snapshot.sh

#!/bin/bash
echo "📦 Downloading production database snapshot..."

# Download latest backup
render db export \
  --database postgres \
  --output ./data/production-snapshot-$(date +%Y-%m-%d).sql

# Load into local database
docker-compose down
docker-compose up -d postgres
sleep 5  # Wait for PostgreSQL to start

docker-compose exec -T postgres psql -U postgres -d legaldb < ./data/production-snapshot-$(date +%Y-%m-%d).sql

# Anonymize
docker-compose exec -T postgres psql -U postgres -d legaldb -c "
UPDATE users SET email = 'user' || id || '@example.com', phone = NULL;
UPDATE cases SET client_email = 'client' || id || '@example.com';
"

echo "✅ Database snapshot loaded and anonymized"

# Clean up old snapshots (keep last 7 days)
find ./data -name "production-snapshot-*.sql" -mtime +7 -delete
```

---

### Common Development Workflows

**Starting the Project:**

```bash
# Quick start (most common)
pnpm dev

# Or step-by-step:
# 1. Start databases
docker-compose up -d postgres redis

# 2. Run migrations
pnpm db:migrate

# 3. Start development servers
pnpm dev
```

**Running Database Migrations:**

```bash
# Create new migration
pnpm db:migrate:create --name add_case_tags

# Run pending migrations
pnpm db:migrate

# Rollback last migration
pnpm db:migrate:rollback

# Check migration status
pnpm db:migrate:status
```

**Viewing Logs:**

```bash
# Application logs (stdout)
pnpm dev  # Already shows logs

# Docker container logs
docker-compose logs -f postgres
docker-compose logs -f redis

# Database query logs
docker-compose exec postgres tail -f /var/log/postgresql/postgresql-16-main.log

# Enable query logging in PostgreSQL
docker-compose exec postgres psql -U postgres -c "ALTER SYSTEM SET log_statement = 'all';"
docker-compose restart postgres
```

**Hot Reloading:**

```bash
# Next.js (web app) - automatic hot reload
cd apps/web
pnpm dev
# Changes to .tsx files reload instantly

# Gateway (Express/Apollo) - with nodemon
cd services/gateway
pnpm dev  # Uses nodemon for auto-restart

# Microservices - with nodemon
cd services/document-service
pnpm dev  # Auto-restarts on file changes
```

**Database Inspection:**

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d legaldb

# Common queries
\dt                      # List all tables
\d users                 # Describe users table
\di                      # List indexes
\dx                      # List extensions

SELECT * FROM users LIMIT 10;
SELECT count(*) FROM cases;

# Check database size
SELECT pg_size_pretty(pg_database_size('legaldb'));

# Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

\q
```

---

## Additional Resources

- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Deploy to Render.com
- **[Operations Runbook](OPERATIONS_RUNBOOK.md)** - Daily operations and incident response
- **[Environment Variables](ENVIRONMENT_VARIABLES.md)** - Complete environment variable reference
- **[Cost Estimation](COST_ESTIMATION.md)** - Infrastructure costs and optimization
- **[Docker Documentation](docker/README.md)** - Docker configuration details
- **[Coding Standards](../docs/architecture/coding-standards.md)** - Project coding standards
- **[Tech Stack Documentation](../docs/architecture/tech-stack.md)** - Technology decisions

---

## Getting Help

**Issues with local setup:**

- Check [Troubleshooting](#troubleshooting) section above
- Search existing GitHub issues
- Create new issue with [bug report template](../.github/ISSUE_TEMPLATE/bug_report.md)

**Questions:**

- Slack: #legal-platform-dev
- Email: dev-team@legal-platform.com
