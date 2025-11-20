# Environment Variables

This document describes all environment variables used across the Legal Platform monorepo deployed on Render.com.

## Table of Contents

- [Environment Variable Management Strategy](#environment-variable-management-strategy)
- [Render Auto-Injected Variables](#render-auto-injected-variables)
- [Required Environment Variables](#required-environment-variables)
- [Optional Environment Variables](#optional-environment-variables)
- [Service-Specific Variables](#service-specific-variables)
- [Environment-Specific Values](#environment-specific-values)
- [Setting Environment Variables in Render](#setting-environment-variables-in-render)
- [Secret Rotation Strategy](#secret-rotation-strategy)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

## Environment Variable Management Strategy

### Local Development

- Environment variables are loaded from `.env` files using the `dotenv` package
- Each app and service has its own `.env` file
- Copy `.env.example` to `.env` and fill in the values
- Never commit `.env` files to version control

### Staging and Production (Render)

- Environment variables are managed through **Render Dashboard** or **render.yaml**
- Sensitive values (passwords, API keys) are set via Render Dashboard Environment tab
- Non-sensitive configuration can be defined in `render.yaml`
- Render automatically injects `DATABASE_URL` and `REDIS_URL` when services are linked
- Changes to environment variables trigger automatic redeployment

### CI/CD Pipeline

- GitHub Actions uses repository secrets for CI testing
- Render Deploy Hooks trigger deployments automatically on git push
- No manual environment variable management needed in CI/CD

## Render Auto-Injected Variables

Render automatically provides these environment variables to all services. **Do not set these manually.**

| Variable                | Description                         | Example                                          | Auto-Injected |
| ----------------------- | ----------------------------------- | ------------------------------------------------ | ------------- |
| `DATABASE_URL`          | PostgreSQL connection string        | `postgresql://user:pass@host.render.com:5432/db` | ✅ Yes        |
| `REDIS_URL`             | Redis connection string             | `redis://red-xxxxx:6379`                         | ✅ Yes        |
| `RENDER_SERVICE_NAME`   | Name of the current service         | `web`, `gateway`, `document-service`             | ✅ Yes        |
| `RENDER_EXTERNAL_URL`   | Public URL of the service           | `https://web-xyz123.onrender.com`                | ✅ Yes        |
| `RENDER_GIT_COMMIT`     | Deployed commit SHA                 | `a1b2c3d4e5f6...`                                | ✅ Yes        |
| `RENDER_INSTANCE_ID`    | Unique instance identifier          | `srv-xyz123-abc456`                              | ✅ Yes        |
| `PORT`                  | Port the service should listen on   | `10000` (default for Render web services)        | ✅ Yes        |
| `RENDER_DISCOVERY_HOST` | Internal service discovery hostname | For private service communication                | ✅ Yes        |
| `IS_PULL_REQUEST`       | Whether this is a preview env       | `true` or not set                                | ✅ Yes        |

**Documentation:** https://render.com/docs/environment-variables

## Required Environment Variables

These variables **must** be set for the platform to function. They are not auto-injected by Render.

### Global Variables (All Services)

| Variable         | Description                   | Example                  | Required | Sensitive | Set Where        |
| ---------------- | ----------------------------- | ------------------------ | -------- | --------- | ---------------- |
| `NODE_ENV`       | Runtime environment           | `production`, `staging`  | Yes      | No        | render.yaml      |
| `JWT_SECRET`     | Secret for signing JWT tokens | 64-char random string    | Yes      | Yes       | Render Dashboard |
| `JWT_EXPIRES_IN` | JWT token expiration          | `7d`                     | No       | No        | render.yaml      |
| `LOG_LEVEL`      | Logging verbosity             | `info`, `debug`, `error` | No       | No        | render.yaml      |

**JWT_SECRET Generation:**

```bash
# Generate a secure JWT secret (48 bytes base64 encoded = 64 characters)
openssl rand -base64 48
```

### Database Configuration

PostgreSQL database connection is auto-injected by Render via `DATABASE_URL`, but you can customize connection behavior with these variables:

| Variable                        | Description                           | Example  | Required | Sensitive | Set Where   |
| ------------------------------- | ------------------------------------- | -------- | -------- | --------- | ----------- |
| `DATABASE_MAX_CONNECTIONS`      | Max database connections              | `20`     | No       | No        | render.yaml |
| `DATABASE_POOL_SIZE`            | Connection pool size (per service)    | `10`     | No       | No        | render.yaml |
| `DATABASE_CONNECTION_TIMEOUT`   | Connection timeout in milliseconds    | `30000`  | No       | No        | render.yaml |
| `DATABASE_STATEMENT_TIMEOUT`    | Query statement timeout in ms         | `60000`  | No       | No        | render.yaml |
| `DATABASE_IDLE_TIMEOUT`         | Idle connection timeout in ms         | `10000`  | No       | No        | render.yaml |
| `DATABASE_SSL_MODE`             | SSL mode for database connection      | `require`| No       | No        | render.yaml |

**Database Details (Configured in render.yaml):**

- **Name:** `legal-platform-db`
- **Database:** `legal_platform_prod`
- **User:** `legal_platform_user`
- **Plan:** Standard (25GB storage)
- **Backups:** Daily automatic with 7-day retention
- **Region:** Oregon (US-West)
- **Extensions:** pgvector, uuid-ossp, pg_trgm

**Connection String Format:**

```
postgresql://legal_platform_user:<password>@dpg-xxxxx.oregon-postgres.render.com:5432/legal_platform_prod?ssl=true
```

### Redis Configuration

Redis cache connection is auto-injected by Render via `REDIS_URL`, but you can customize Redis client behavior:

| Variable                   | Description                      | Example | Required | Sensitive | Set Where   |
| -------------------------- | -------------------------------- | ------- | -------- | --------- | ----------- |
| `REDIS_MAX_RETRIES`        | Max reconnection attempts        | `3`     | No       | No        | render.yaml |
| `REDIS_CONNECT_TIMEOUT`    | Connection timeout in ms         | `5000`  | No       | No        | render.yaml |
| `REDIS_SESSION_TTL`        | Session expiration in seconds    | `86400` | No       | No        | render.yaml |
| `REDIS_CACHE_DEFAULT_TTL`  | Default cache TTL in seconds     | `300`   | No       | No        | render.yaml |

**Redis Details (Configured in render.yaml):**

- **Name:** `legal-platform-redis`
- **Plan:** Pro (1GB memory)
- **Region:** Oregon (US-West)
- **Eviction Policy:** allkeys-lru (Least Recently Used)
- **Persistence:** Yes (AOF with fsync every second)

**Connection String Format:**

```
redis://red-xxxxx:6379
```

### Frontend (apps/web)

| Variable                        | Description                            | Example                                  | Required | Sensitive | Set Where        |
| ------------------------------- | -------------------------------------- | ---------------------------------------- | -------- | --------- | ---------------- |
| `NEXT_PUBLIC_API_URL`           | GraphQL API endpoint (browser-exposed) | `https://api.legal-platform.com/graphql` | Yes      | No        | Render Dashboard |
| `NEXT_PUBLIC_APP_URL`           | Frontend application URL               | `https://app.legal-platform.com`         | Yes      | No        | Render Dashboard |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics ID (optional)         | `G-XXXXXXXXXX`                           | No       | No        | Render Dashboard |

**Important:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser and bundled into the client-side JavaScript. Never include sensitive data in these variables.

### API Gateway (services/gateway)

| Variable                   | Description                       | Example                                     | Required | Sensitive | Set Where   |
| -------------------------- | --------------------------------- | ------------------------------------------- | -------- | --------- | ----------- |
| `DOCUMENT_SERVICE_URL`     | Document service internal URL     | `https://document-service.onrender.com`     | Yes      | No        | render.yaml |
| `TASK_SERVICE_URL`         | Task service internal URL         | `https://task-service.onrender.com`         | Yes      | No        | render.yaml |
| `AI_SERVICE_URL`           | AI service internal URL           | `https://ai-service.onrender.com`           | Yes      | No        | render.yaml |
| `INTEGRATION_SERVICE_URL`  | Integration service internal URL  | `https://integration-service.onrender.com`  | Yes      | No        | render.yaml |
| `NOTIFICATION_SERVICE_URL` | Notification service internal URL | `https://notification-service.onrender.com` | Yes      | No        | render.yaml |

**Note:** Use Render's internal service URLs for private communication between services. These URLs are accessible only within your Render private network.

## Optional Environment Variables

These variables have sensible defaults but can be customized.

| Variable    | Description          | Default   | Example   | Set Where   |
| ----------- | -------------------- | --------- | --------- | ----------- |
| `LOG_LEVEL` | Logging verbosity    | `info`    | `debug`   | render.yaml |
| `API_HOST`  | Gateway bind address | `0.0.0.0` | `0.0.0.0` | render.yaml |
| `SMTP_PORT` | SMTP server port     | `587`     | `465`     | render.yaml |

## Service-Specific Variables

### Document Service (services/document-service)

#### Storage Configuration (Story 2.2)

The platform uses a hybrid storage strategy with OneDrive as primary storage and Cloudflare R2 as fallback.

| Variable                        | Description                           | Example                                    | Required | Sensitive |
| ------------------------------- | ------------------------------------- | ------------------------------------------ | -------- | --------- |
| `STORAGE_PROVIDER`              | Primary storage provider              | `onedrive`, `r2`, `local`                  | Yes      | No        |
| `STORAGE_BACKUP_ENABLED`        | Enable backup to R2                   | `true`, `false`                            | No       | No        |
| `STORAGE_BUCKET`                | Storage bucket name (for R2)          | `legal-platform-prod-documents`            | Yes\*    | No        |

**\*Required if `STORAGE_PROVIDER=r2` or `STORAGE_BACKUP_ENABLED=true`**

#### OneDrive Configuration (Microsoft Graph API)

| Variable                 | Description                       | Example                                | Required | Sensitive |
| ------------------------ | --------------------------------- | -------------------------------------- | -------- | --------- |
| `ONEDRIVE_CLIENT_ID`     | Azure App Client ID               | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | Yes\*    | No        |
| `ONEDRIVE_CLIENT_SECRET` | Azure App Client Secret           | `xxxxx~xxxxxxxxxxxxxxxxxxxxxxxxx`      | Yes\*    | Yes       |
| `ONEDRIVE_TENANT_ID`     | Azure Tenant ID                   | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | Yes\*    | No        |
| `ONEDRIVE_DRIVE_ID`      | OneDrive Drive ID (optional)      | `b!xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`      | No       | No        |

**\*Required if `STORAGE_PROVIDER=onedrive`**

**Setup Instructions:**

1. Go to https://portal.azure.com → App registrations
2. Create new app registration or use existing
3. Copy Application (client) ID → `ONEDRIVE_CLIENT_ID`
4. Copy Directory (tenant) ID → `ONEDRIVE_TENANT_ID`
5. Create new client secret → `ONEDRIVE_CLIENT_SECRET`
6. Add Microsoft Graph API permissions:
   - `Files.ReadWrite.All` (Application permission)
   - `Sites.ReadWrite.All` (Application permission)
7. Grant admin consent for the permissions

#### Cloudflare R2 Configuration

| Variable                        | Description                       | Example                                    | Required | Sensitive |
| ------------------------------- | --------------------------------- | ------------------------------------------ | -------- | --------- |
| `CLOUDFLARE_R2_ACCOUNT_ID`      | Cloudflare R2 Account ID          | `your-account-id`                          | Yes\*    | No        |
| `CLOUDFLARE_R2_ACCESS_KEY_ID`   | Cloudflare R2 Access Key          | `your-access-key-id`                       | Yes\*    | Yes       |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Cloudflare R2 Secret Access Key | `your-secret-key`                          | Yes\*    | Yes       |
| `CLOUDFLARE_R2_BUCKET_ENDPOINT` | Custom R2 endpoint (optional)     | `https://account.r2.cloudflarestorage.com` | No       | No        |

**\*Required if `STORAGE_PROVIDER=r2` or `STORAGE_BACKUP_ENABLED=true`**

**Setup Instructions:**

1. Go to https://dash.cloudflare.com → R2
2. Create R2 bucket: `legal-platform-prod-documents`
3. Generate API tokens → Create API token
4. Copy Account ID → `CLOUDFLARE_R2_ACCOUNT_ID`
5. Copy Access Key ID → `CLOUDFLARE_R2_ACCESS_KEY_ID`
6. Copy Secret Access Key → `CLOUDFLARE_R2_SECRET_ACCESS_KEY`

**Storage Provider Decision Matrix:**

| Scenario                              | Provider | Rationale                                        |
| ------------------------------------- | -------- | ------------------------------------------------ |
| User uploads document via web app     | OneDrive | Microsoft 365 integration, collaboration         |
| AI generates document from template   | OneDrive | User can edit in Office apps                     |
| Large files >100MB                    | R2       | OneDrive throttles, R2 has no egress fees        |
| Public documents (filed pleadings)    | R2       | Global CDN, no auth required, fast delivery      |
| Archived cases (>2 years old)         | R2       | Cost-effective long-term storage                 |

**Cost Comparison:**

- **OneDrive:** Included in Microsoft 365 license (no additional cost)
- **Cloudflare R2:** $0.015/GB storage + **$0/GB egress** (zero bandwidth charges)
- **AWS S3:** $0.023/GB storage + $0.09/GB egress (not recommended)

### AI Service (services/ai-service)

#### AI Provider Configuration

| Variable              | Description                                     | Example     | Required | Sensitive |
| --------------------- | ----------------------------------------------- | ----------- | -------- | --------- |
| `AI_PROVIDER`         | Primary AI provider (anthropic or grok)         | `anthropic` | No       | No        |
| `AI_FALLBACK_ENABLED` | Enable automatic fallback to secondary provider | `true`      | No       | No        |

**AI Provider Strategy:**

- **Primary:** Anthropic Claude (Haiku for simple, Sonnet for standard, Opus for complex tasks)
- **Fallback:** xAI Grok (automatic fallback if Claude fails or is unavailable)

#### Anthropic Claude Configuration (PRIMARY)

| Variable                       | Description                                | Example                         | Required | Sensitive |
| ------------------------------ | ------------------------------------------ | ------------------------------- | -------- | --------- |
| `ANTHROPIC_API_KEY`            | Anthropic API key for Claude models        | `sk-ant-api03-xxxxxxxxxxxxx...` | Yes      | Yes       |
| `ANTHROPIC_MODEL`              | Default Claude model                       | `claude-3-5-sonnet-20241022`    | No       | No        |
| `ANTHROPIC_MAX_TOKENS`         | Max output tokens per request              | `4096`                          | No       | No        |
| `ANTHROPIC_TEMPERATURE`        | Response randomness (0.0-1.0)              | `0.7`                           | No       | No        |
| `ANTHROPIC_USE_PROMPT_CACHING` | Enable Prompt Caching (90% cost reduction) | `true`                          | No       | No        |
| `ANTHROPIC_USE_BATCHING`       | Enable Batch API (50% cost reduction)      | `true`                          | No       | No        |
| `ANTHROPIC_SKILLS_ENABLED`     | Enable Skills API (70% token reduction)    | `true`                          | No       | No        |

**Get Anthropic API Key:** https://console.anthropic.com/settings/keys

**Model Selection Guide:**

- **Haiku** (`claude-3-5-haiku-20241022`): Simple tasks, $0.25/MTok input, $1.25/MTok output
- **Sonnet** (`claude-3-5-sonnet-20241022`): Standard tasks, $3/MTok input, $15/MTok output
- **Opus** (`claude-3-opus-20240229`): Complex reasoning, $15/MTok input, $75/MTok output

**Cost Optimization Features:**

1. **Prompt Caching** (`ANTHROPIC_USE_PROMPT_CACHING=true`)
   - Caches frequently used prompts (system prompts, large contexts)
   - **90% cost reduction** on cached tokens ($0.30 vs $3.00 per MTok for Sonnet)
   - Cache persists for 5 minutes, auto-refreshes on use
   - Ideal for: System prompts, legal templates, case law references

2. **Batch API** (`ANTHROPIC_USE_BATCHING=true`)
   - Processes requests asynchronously with 24hr completion window
   - **50% cost reduction** ($1.50 vs $3.00 per MTok for Sonnet)
   - Ideal for: Document analysis, bulk contract review, report generation

3. **Skills API** (`ANTHROPIC_SKILLS_ENABLED=true`)
   - Pre-built legal workflow tools for common tasks
   - **70% token reduction** compared to standard prompts
   - Reduces costs from $126/month to $80/month for 100 users

#### Claude Skills Configuration (Story 2.11-2.14)

**Core Skills Settings:**

| Variable                                | Description                            | Example                     | Required | Sensitive |
| --------------------------------------- | -------------------------------------- | --------------------------- | -------- | --------- |
| `ANTHROPIC_CODE_EXECUTION_ENABLED`      | Enable code execution in skills        | `true`                      | No       | No        |
| `ANTHROPIC_SKILLS_BETA_VERSION`         | Skills API beta version header         | `skills-2025-10-02`         | No       | No        |
| `ANTHROPIC_CODE_EXECUTION_BETA_VERSION` | Code execution API beta version header | `code-execution-2025-08-25` | No       | No        |
| `SKILLS_UPLOAD_MAX_SIZE_MB`             | Max upload size for skill files (MB)   | `10`                        | No       | No        |
| `SKILLS_MAX_PER_WORKSPACE`              | Max number of skills per workspace     | `50`                        | No       | No        |
| `SKILLS_CACHE_TTL_SECONDS`              | Skills cache time-to-live (seconds)    | `3600`                      | No       | No        |

**Pre-configured Skills (Optional - for specific use cases):**

| Variable                   | Description                | Example               | Required | Sensitive |
| -------------------------- | -------------------------- | --------------------- | -------- | --------- |
| `SKILLS_CONTRACT_ANALYSIS` | Contract Analysis Skill ID | `skill_contract_v1`   | No       | No        |
| `SKILLS_DOCUMENT_DRAFTING` | Document Drafting Skill ID | `skill_drafting_v1`   | No       | No        |
| `SKILLS_LEGAL_RESEARCH`    | Legal Research Skill ID    | `skill_research_v1`   | No       | No        |
| `SKILLS_COMPLIANCE_CHECK`  | Compliance Check Skill ID  | `skill_compliance_v1` | No       | No        |

**Skills Available:**

- **Contract Analysis**: Extract terms, identify risks, compare with templates
- **Document Drafting**: Generate legal documents from 10+ templates
- **Legal Research**: Search case law, statutes, and regulations
- **Compliance Check**: Validate against GDPR, CCPA, HIPAA, SOX, AML

#### xAI Grok Configuration (FALLBACK)

| Variable           | Description                   | Example                             | Required | Sensitive |
| ------------------ | ----------------------------- | ----------------------------------- | -------- | --------- |
| `GROK_API_KEY`     | xAI Grok API key (fallback)   | `xai-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | No       | Yes       |
| `GROK_MODEL`       | Default Grok model            | `grok-beta`                         | No       | No        |
| `GROK_MAX_TOKENS`  | Max tokens per request        | `4096`                              | No       | No        |
| `GROK_TEMPERATURE` | Response randomness (0.0-1.0) | `0.7`                               | No       | No        |

**Get Grok API Key:** https://console.x.ai/api-keys

**Note:** Grok API key is optional. System will fallback to Grok only if Claude fails and `AI_FALLBACK_ENABLED=true`.

### Integration Service (services/integration-service)

| Variable             | Description                       | Example                                                | Required | Sensitive |
| -------------------- | --------------------------------- | ------------------------------------------------------ | -------- | --------- |
| `M365_CLIENT_ID`     | Microsoft 365 OAuth client ID     | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`                 | Yes      | No        |
| `M365_CLIENT_SECRET` | Microsoft 365 OAuth client secret | `xxxxx~xxxxxxxxxxxxxxxxxxxxxxxxx`                      | Yes      | Yes       |
| `M365_TENANT_ID`     | Microsoft 365 tenant ID           | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`                 | Yes      | No        |
| `M365_REDIRECT_URI`  | OAuth redirect URI                | `https://integration.legal-platform.com/auth/callback` | Yes      | No        |

**Setup Instructions:**

1. Go to https://portal.azure.com → App registrations
2. Create new app registration or use existing
3. Copy Application (client) ID → `M365_CLIENT_ID`
4. Copy Directory (tenant) ID → `M365_TENANT_ID`
5. Create new client secret → `M365_CLIENT_SECRET`
6. Add redirect URI matching your Render service URL

### Notification Service (services/notification-service)

| Variable        | Description           | Example                               | Required | Sensitive |
| --------------- | --------------------- | ------------------------------------- | -------- | --------- |
| `SMTP_HOST`     | SMTP server hostname  | `smtp.sendgrid.net`                   | Yes      | No        |
| `SMTP_PORT`     | SMTP server port      | `587`                                 | Yes      | No        |
| `SMTP_USER`     | SMTP username         | `apikey` (for SendGrid)               | Yes      | Yes       |
| `SMTP_PASSWORD` | SMTP password/API key | `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | Yes      | Yes       |
| `SMTP_FROM`     | Email from address    | `noreply@legal-platform.com`          | Yes      | No        |
| `SMTP_SECURE`   | Use TLS for SMTP      | `false`                               | No       | No        |

**Recommended Email Providers:**

- **SendGrid** (12,000 free emails/month): https://sendgrid.com
- **Mailgun** (5,000 free emails/month): https://mailgun.com
- **AWS SES** (62,000 free emails/month): https://aws.amazon.com/ses

**SendGrid Setup:**

1. Sign up at https://sendgrid.com
2. Create API key with Mail Send permissions
3. Set `SMTP_USER=apikey` and `SMTP_PASSWORD=<your-api-key>`
4. Verify sender domain in SendGrid dashboard

## Environment-Specific Values

### Development (Local)

```bash
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/legal_platform_dev
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_API_URL=http://localhost:4000/graphql
NEXT_PUBLIC_APP_URL=http://localhost:3000
LOG_LEVEL=debug
JWT_SECRET=local-dev-secret-min-32-chars-long-replace-in-production
```

### Staging (Render)

```bash
NODE_ENV=staging
# DATABASE_URL and REDIS_URL auto-injected by Render
NEXT_PUBLIC_API_URL=https://gateway-staging.onrender.com/graphql
NEXT_PUBLIC_APP_URL=https://web-staging.onrender.com
LOG_LEVEL=debug
JWT_SECRET=<generate-secure-secret>
AI_PROVIDER=anthropic
ANTHROPIC_MODEL=claude-3-haiku-20240307  # Use Haiku for cost-effective staging
ANTHROPIC_USE_PROMPT_CACHING=true
ANTHROPIC_SKILLS_ENABLED=false  # Test skills in staging first
GROK_ENABLED=false  # Disable fallback in staging
STORAGE_PROVIDER=render-disk
SMTP_HOST=smtp.gmail.com
```

### Production (Render)

```bash
NODE_ENV=production
# DATABASE_URL and REDIS_URL auto-injected by Render
NEXT_PUBLIC_API_URL=https://api.legal-platform.com/graphql
NEXT_PUBLIC_APP_URL=https://app.legal-platform.com
LOG_LEVEL=info
JWT_SECRET=<generate-secure-secret-different-from-staging>
AI_PROVIDER=anthropic
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022  # Sonnet for production quality
ANTHROPIC_USE_PROMPT_CACHING=true
ANTHROPIC_USE_BATCHING=true
ANTHROPIC_SKILLS_ENABLED=true
GROK_ENABLED=true  # Enable fallback in production
STORAGE_PROVIDER=cloudflare-r2
SMTP_HOST=smtp.sendgrid.net
```

## Setting Environment Variables in Render

### Method 1: Render Dashboard (Recommended for Sensitive Values)

**For Individual Services:**

1. Navigate to https://dashboard.render.com
2. Select your service (e.g., `web`, `gateway`)
3. Click **Environment** tab in left sidebar
4. Click **Add Environment Variable**
5. Enter **Key** (e.g., `JWT_SECRET`) and **Value**
6. Click **Save Changes**
7. Service will automatically redeploy with new variables

**For Environment Groups (Shared Variables):**

1. Navigate to https://dashboard.render.com → **Environment Groups**
2. Click **New Environment Group**
3. Name it (e.g., `legal-platform-shared`)
4. Add shared variables: `JWT_SECRET`, `LOG_LEVEL`, etc.
5. Link the group to multiple services
6. Changes to group affect all linked services

**Important:** Changing environment variables triggers an automatic redeploy. Plan accordingly.

### Method 2: render.yaml (For Non-Sensitive Values)

Define environment variables directly in `render.yaml`:

```yaml
services:
  - type: web
    name: web
    envVars:
      - key: NODE_ENV
        value: production
      - key: LOG_LEVEL
        value: info
      - key: NEXT_PUBLIC_API_URL
        value: https://api.legal-platform.com/graphql
```

**Pros:**

- Version controlled with infrastructure as code
- Easy to replicate environments
- Visible in git history

**Cons:**

- Only for non-sensitive values (never commit secrets)
- Changes require git commit and push

### Method 3: Render CLI

Install Render CLI:

```bash
npm install -g @render/cli
render login
```

Set environment variables:

```bash
# Set a single variable
render env set JWT_SECRET="your-secret-value" --service web

# Set multiple variables from file
render env set --env-file .env.production --service web

# List all environment variables
render env list --service web

# Delete an environment variable
render env delete DEPRECATED_VAR --service web
```

**Documentation:** https://render.com/docs/cli

### Method 4: Using Secret Files (For Multi-line Secrets)

For certificates, private keys, or large configuration files:

1. Go to Render Dashboard → Service → Environment
2. Click **Add Secret File**
3. Enter filename (e.g., `/etc/secrets/service-account.json`)
4. Paste file contents
5. Access in code via filesystem: `fs.readFileSync('/etc/secrets/service-account.json')`

## Secret Rotation Strategy

### Rotation Schedule

| Secret                 | Frequency      | Priority | Impact                 |
| ---------------------- | -------------- | -------- | ---------------------- |
| `JWT_SECRET`           | Every 90 days  | High     | All users logged out   |
| `ANTHROPIC_API_KEY`    | Every 180 days | Medium   | AI features disabled   |
| `SMTP_PASSWORD`        | Every 90 days  | Medium   | Email sending fails    |
| `M365_CLIENT_SECRET`   | Every 90 days  | Medium   | M365 integration fails |
| `R2_SECRET_ACCESS_KEY` | Every 90 days  | Medium   | File uploads fail      |
| Database credentials   | Render manages | N/A      | Render auto-rotates    |
| Redis credentials      | Render manages | N/A      | Render auto-rotates    |

### Rotation Process

**Standard Secret Rotation (Zero-Downtime):**

1. **Generate New Secret:**

   ```bash
   openssl rand -base64 48  # For JWT_SECRET
   # OR generate from provider (Claude, Grok, SendGrid, etc.)
   ```

2. **Update in Render Dashboard:**
   - Go to Service → Environment
   - Click **Edit** on existing variable
   - Enter new value
   - Click **Save Changes**
   - Render automatically redeploys service

3. **Verify Service Health:**

   ```bash
   # Check service status
   curl https://your-service.onrender.com/health

   # View logs for errors
   render logs --service web --tail
   ```

4. **Revoke Old Secret:**
   - Claude: Delete old API key from https://console.anthropic.com/settings/keys
   - Grok: Delete old API key from https://console.x.ai/api-keys
   - SendGrid: Revoke old API key from dashboard
   - M365: Expire old client secret in Azure Portal

5. **Document Rotation:**
   - Update rotation log in `infrastructure/SECRET_ROTATION_LOG.md`
   - Note date, rotated secret, and performed by

**Emergency Secret Rotation (Compromised Secret):**

If a secret is compromised:

1. **Immediately** update the secret in Render Dashboard
2. Verify all services redeploy successfully
3. Revoke compromised secret from provider **immediately**
4. Review access logs for unauthorized usage
5. Document incident in security log
6. Consider rotating all related secrets

### Automation (Optional)

Create a script to automate rotation reminders:

```bash
# scripts/render/check-secret-age.sh
# Checks age of secrets and warns if rotation is due
```

Add to CI/CD:

```yaml
# .github/workflows/secret-rotation-reminder.yml
on:
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sunday
jobs:
  check-secrets:
    runs-on: ubuntu-latest
    steps:
      - run: ./scripts/render/check-secret-age.sh
      - if: secrets-due
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.create({
              title: 'Secret Rotation Reminder',
              body: 'The following secrets need rotation: ...'
            })
```

## Security Best Practices

### Environment Variables

1. **Never commit `.env` files** - They are in `.gitignore`
2. **Never commit secrets in `render.yaml`** - Use Render Dashboard for sensitive values
3. **Use strong, unique secrets** - Generate with `openssl rand -base64 48`
4. **Rotate secrets regularly** - Follow rotation schedule above
5. **Minimize exposure** - Only set variables where needed
6. **Use Environment Groups** - For shared variables across services
7. **Enable audit logging** - Track who changes environment variables

### NEXT*PUBLIC* Variables (Frontend)

1. **Never include secrets** - These are exposed to browser
2. **Only use for public URLs** - API endpoints, app URLs
3. **Validate in backend** - Never trust client-provided data
4. **Use HTTPS only** - For production API URLs

### Database and Redis

1. **Let Render manage credentials** - Don't set manually
2. **Use connection pooling** - Configure in application code
3. **Enable SSL/TLS** - Render enforces by default
4. **Regular backups** - Render auto-backups PostgreSQL daily
5. **Monitor connections** - Alert on >80% connection usage

### Third-Party API Keys

1. **Use service accounts** - Not personal accounts
2. **Minimum permissions** - Only grant required scopes
3. **Monitor usage** - Set up alerts for unusual activity
4. **Revoke unused keys** - Clean up old API keys regularly
5. **Use different keys per environment** - Staging vs production

### Compliance

- **GDPR**: Ensure encryption at rest and in transit (Render provides both)
- **SOC 2**: Use Render's SOC 2 compliance for legal platform requirements
- **HIPAA**: If handling health data, enable Render HIPAA-compliant environment
- **Data residency**: Configure Render region appropriately (US, EU)

## Troubleshooting

### Missing Environment Variables

**Symptom:** Service fails to start with error about missing environment variable.

**Solution:**

1. Check if variable is set in Render Dashboard:
   - Service → Environment tab → Search for variable
2. Verify variable name (case-sensitive):
   - `DATABASE_URL` ≠ `database_url`
3. Check if variable should be auto-injected:
   - `DATABASE_URL` and `REDIS_URL` require linked database/Redis service
4. Verify service has redeployed after setting variable:
   - Check **Events** tab for recent deploy

### Database Connection Errors

**Symptom:** `Error: connect ECONNREFUSED` or `FATAL: password authentication failed`

**Solution:**

1. Verify `DATABASE_URL` is auto-injected:
   - Service → Environment tab → Should see `DATABASE_URL` (hidden value)
2. Ensure PostgreSQL database is linked:
   - Service → Settings → Check **Database** section
   - If not linked, click **Add Database** and select your PostgreSQL instance
3. Check database is running:
   - Dashboard → Databases → Check status
4. Verify SSL mode (Render requires SSL):
   ```javascript
   // In your database connection config
   ssl: {
     rejectUnauthorized: false;
   }
   ```

### Redis Connection Errors

**Symptom:** `Error: Redis connection failed`

**Solution:**

1. Verify `REDIS_URL` is auto-injected:
   - Service → Environment tab → Should see `REDIS_URL`
2. Ensure Redis is linked to service:
   - Service → Settings → Check **Redis** section
3. Check Redis is running:
   - Dashboard → Redis → Check status
4. Verify connection string format:
   - Should be `redis://red-xxxxx:6379` (not `rediss://` with double 's')

### CORS Errors in Frontend

**Symptom:** `Access to fetch at 'https://api...' from origin 'https://app...' has been blocked by CORS policy`

**Solution:**

1. Verify `NEXT_PUBLIC_API_URL` matches actual API URL:
   - Check Service → Environment → `NEXT_PUBLIC_API_URL`
   - Should be `https://api.legal-platform.com/graphql` (not localhost)
2. Configure CORS in gateway service:
   ```javascript
   // services/gateway/src/index.ts
   app.use(
     cors({
       origin: process.env.WEB_APP_URL || 'https://app.legal-platform.com',
       credentials: true,
     })
   );
   ```
3. Ensure API service is running:
   - Dashboard → Gateway service → Check status

### Environment Variable Changes Not Taking Effect

**Symptom:** Changed environment variable but service still uses old value.

**Solution:**

1. Verify service has redeployed:
   - Service → Events tab → Check for recent "Deploy" event
   - Changes trigger automatic redeploy (takes 2-5 minutes)
2. Check deploy succeeded:
   - Events tab → Latest deploy should show "Live"
   - If failed, check logs for error
3. Force redeploy if needed:
   - Service → Manual Deploy → Click **Deploy Latest Commit**
4. Check for cached values:
   - Some values may be cached in application memory
   - Restart service: Manual Deploy → **Clear build cache & deploy**

### Invalid JWT Secret

**Symptom:** `JsonWebTokenError: invalid signature` or users can't authenticate.

**Solution:**

1. Verify `JWT_SECRET` is set and **same across all services**:
   - Check gateway and all services that verify JWTs
   - Use Environment Group for consistency
2. Ensure minimum 32 characters:
   ```bash
   openssl rand -base64 48  # Generates 64 characters
   ```
3. Check for trailing spaces or quotes:
   - Render Dashboard values should have no quotes
   - `your-secret` not `"your-secret"`
4. Verify services redeployed after changing secret:
   - All services need to restart to pick up new secret

### Service Can't Connect to Other Services

**Symptom:** `Error: connect ETIMEDOUT` when gateway calls microservice.

**Solution:**

1. Verify service URLs are correct:
   - Gateway → Environment → Check `DOCUMENT_SERVICE_URL`, etc.
   - Should be `https://document-service.onrender.com` (not localhost)
2. Ensure services are in same region:
   - Dashboard → Service → Check region (e.g., Oregon, Frankfurt)
   - Cross-region calls may be slow
3. Check service is running:
   - Dashboard → Target service → Verify status is "Live"
4. Verify service has health endpoint:
   ```bash
   curl https://document-service.onrender.com/health
   # Should return 200 OK
   ```
5. Check Render's internal networking:
   - Use Render's internal URLs for private communication
   - Format: `https://<service-name>.onrender.com`

### AI API Errors (Claude/Grok)

**Symptom:** `Error: Invalid API key` or `Error: Rate limit exceeded`

**Solution:**

1. Verify AI API keys are set correctly:
   - Service → Environment → Check `ANTHROPIC_API_KEY` exists (and `GROK_API_KEY` for fallback)
   - Claude: Get new key from https://console.anthropic.com/settings/keys
   - Grok: Get new key from https://console.x.ai/api-keys
2. Check API key format:
   - Claude: Should start with `sk-ant-`
   - Grok: Should start with `xai-`
   - No spaces or quotes
3. Verify API key has not been revoked:
   - Claude Console → API Keys → Check key status
   - xAI Console → API Keys → Check key status
4. Check rate limits:
   - Claude Console → Usage → Check quota and limits
   - xAI Console → Usage → Check rate limits
   - Consider implementing fallback logic or rate limiting

### Email Sending Failures

**Symptom:** Emails not being delivered or `Error: Authentication failed`

**Solution:**

1. Verify SMTP credentials:
   - Service → Environment → Check `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`
2. For SendGrid:
   - Username should be literally `apikey` (not your email)
   - Password should be API key starting with `SG.`
3. Check sender domain verification:
   - SendGrid requires domain verification for production
   - Verify at https://app.sendgrid.com/settings/sender_auth
4. Test SMTP connection:
   ```bash
   npm install -g smtp-tester
   smtp-tester --host smtp.sendgrid.net --port 587 --user apikey --password SG.xxx
   ```
5. Check email quota:
   - Free tier: 100 emails/day (SendGrid)
   - Upgrade if needed

### Render Service Logs

View logs to debug environment variable issues:

```bash
# Via Render CLI
render logs --service web --tail

# Via Dashboard
Dashboard → Service → Logs tab → View real-time logs
```

**Common Log Messages:**

- `Environment variable X is not defined` → Set in Render Dashboard
- `Connection refused` → Check service URLs
- `Authentication failed` → Check credentials
- `Rate limit exceeded` → Check API quotas

## Additional Resources

- **Render Documentation:** https://render.com/docs
- **Render Environment Variables:** https://render.com/docs/environment-variables
- **Render CLI:** https://render.com/docs/cli
- **Render Secrets Management:** https://render.com/docs/yaml-spec#secrets
- **Environment Template:** `infrastructure/render/environment-template.yaml`

For questions, check Render support: https://render.com/support
