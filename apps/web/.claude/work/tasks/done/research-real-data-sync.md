# Research: Real MS 365 Data Sync for Local Dev

**Status**: Complete
**Date**: 2024-12-31
**Input**: `brainstorm-real-data-sync.md`
**Next step**: `/plan research-real-data-sync`

---

## Context Summary

**Project**: bojin-law-ui (Next.js 16 UI for Legal Platform V2)
**Location**: `~/Developer/bojin-law-ui`
**Related**: `~/Developer/bojin-law-2` (monorepo with backend services)

**Tech Stack**:

- Next.js 16 (App Router), TypeScript, Tailwind CSS
- Apollo Client 4 → connects to gateway at `localhost:4000/graphql`
- Azure MSAL Browser for auth
- Backend runs from bojin-law-2

**Goal**: Enable real MS 365 data (emails, documents) to sync locally for development testing.

---

## Problem Statement

Replicate the bojin-law-2 local development setup in bojin-law-ui so that:

1. User can log in with real MS 365 credentials
2. Real emails/documents sync from their account to local database
3. AI classification and case population can be tested with real data
4. The app behaves as a "perfect mirror" of production

---

## Research Findings

### 1. MS 365 Sync Services Architecture (bojin-law-2)

**Primary Services** (all in `services/gateway/src/services/`):

| Service                          | Purpose                                               |
| -------------------------------- | ----------------------------------------------------- |
| `email-sync.service.ts`          | Full/incremental email sync from all mail folders     |
| `onedrive-sync.service.ts`       | Document sync between R2 storage and OneDrive         |
| `graph.service.ts`               | Core Microsoft Graph API abstraction layer            |
| `webhook.service.ts`             | Graph API webhook subscriptions for real-time updates |
| `email-categorization.worker.ts` | AI-powered email classification (runs every 5 min)    |

**Data Flow**:

```
User Login (Azure AD)
    ↓
Graph API Access Token
    ↓
EmailSyncService.syncUserEmails()
    ├─ Fetches /me/messages (all folders)
    ├─ Filters personal contacts
    ├─ Stores in Prisma database
    └─ Emits activity events
    ↓
Email Categorization Worker
    ├─ Classifies uncategorized emails
    ├─ Uses scoring algorithm + AI fallback
    └─ Links emails to cases
```

### 2. Required Environment Variables

**Azure AD / MSAL** (REQUIRED):

```env
AZURE_AD_CLIENT_ID=<app-registration-client-id>
AZURE_AD_CLIENT_SECRET=<app-registration-secret>
AZURE_AD_TENANT_ID=<azure-tenant-id>
AZURE_AD_REDIRECT_URI=http://localhost:4000/auth/callback
```

**Graph API Configuration**:

```env
GRAPH_API_BASE_URL=https://graph.microsoft.com/v1.0
GRAPH_API_TIMEOUT=30000
GRAPH_RETRY_MAX_ATTEMPTS=5
EMAIL_SEND_MODE=draft
```

**Database & Redis**:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/legal_platform_dev
REDIS_URL=redis://localhost:6379
```

**Email Sync Workers**:

```env
EMAIL_SYNC_PAGE_SIZE=50
EMAIL_AI_CATEGORIZATION_ENABLED=true
EMAIL_CATEGORIZATION_BATCH_SIZE=10
EMAIL_CATEGORIZATION_INTERVAL_MS=300000
```

**Webhooks** (optional for real-time):

```env
WEBHOOK_BASE_URL=http://localhost:4000
WEBHOOK_CLIENT_STATE=<random-state-value>
```

### 3. Database Configuration

**Database**: PostgreSQL 16 with pgvector extension

**Key Tables for MS 365 Data**:

- `emails` - Synced email messages
- `email_attachments` - Attachment metadata
- `email_sync_states` - Per-user sync state (delta tokens, status)
- `graph_subscriptions` - Webhook subscription tracking
- `email_case_links` - Multi-case associations

**Database Switching** (bojin-law-2 has built-in scripts):

```bash
pnpm db:use:seed    # Clean test data
pnpm db:use:prod    # Imported production data
pnpm db:which       # Show current database
```

**Full Data Reset** (preserves users/firms):

```bash
npx tsx scripts/migrations/full-data-reset.ts
```

### 4. Services Startup Sequence

**Docker Compose** (`infrastructure/docker/docker-compose.yml`):

```yaml
Services:
  - postgres (pgvector:pg16) - Port 5432
  - redis (redis:7.2-alpine) - Port 6379
  - gateway - Port 4000 (GraphQL API + MS 365 integration)
  - document-service - Port 5001
  - ai-service - Port 5002
  - task-service - Port 5003
  - integration-service - Port 5004
  - notification-service - Port 5005
```

**Startup Commands**:

```bash
# Start all services
cd ~/Developer/bojin-law-2
docker-compose -f infrastructure/docker/docker-compose.yml up --build

# Or start services individually
cd services/gateway && npm run dev
```

**Background Workers** (auto-start with gateway):

- Task Reminder Worker (1 hour interval)
- Email Categorization Worker (5 min interval)
- Subscription Renewal Worker (1 hour interval)
- Daily Digest Worker
- Case Summary Worker

### 5. bojin-law-ui Current Auth Status

**MSAL Configuration** (`src/lib/msal-config.ts`):

- ✅ Client ID configured
- ✅ Tenant ID configured
- ✅ Login scopes defined (openid, profile, email, User.Read, Mail.Read)
- ✅ Graph scopes defined (User.Read, Files.ReadWrite.All, Sites.ReadWrite.All)
- ✅ Mail scopes defined (Mail.Read, Mail.Send, Mail.ReadWrite)

**Current Environment** (`.env.local`):

```env
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd
NEXT_PUBLIC_AZURE_AD_TENANT_ID=e39d7b1e-9d0c-41ae-b1db-99aecc04fa42
NEXT_PUBLIC_GATEWAY_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000/graphql
```

**CRITICAL GAP**: `setMsAccessTokenGetter()` is never called!

- The function exists in `apollo-client.ts`
- It's designed to pass MS tokens to GraphQL requests via `x-ms-access-token` header
- But it's never initialized, so tokens are never sent to the gateway

**Apollo Client Headers** (what gets sent):

- `x-mock-user`: JSON with userId, firmId, role, email (for dev mocking)
- `x-ms-access-token`: MS token (ONLY if `setMsAccessTokenGetter` initialized - currently NOT)

### 6. Email Sync Process Details

**Sync Trigger Options**:

1. **Manual**: User initiates via GraphQL mutation `startEmailSync`
2. **Webhook**: Real-time notifications from MS Graph API (requires public URL)
3. **Scheduled**: Background workers for classification

**What Gets Synced**:

- All emails from all folders (Inbox, Sent, custom folders)
- Email metadata (from, to, cc, subject, body, timestamps)
- Attachments (stored in R2 with metadata)
- Conversation threading (conversationId)

**AI Classification Workflow**:

1. Email stored with `classificationState: Pending`
2. Categorization worker runs every 5 min
3. Scoring algorithm with signals:
   - THREAD_CONTINUITY (100 pts) - same conversation = same case
   - REFERENCE_NUMBER (50 pts) - case ref# in subject/body
   - KEYWORD_SUBJECT (30 pts) - case keyword in subject
   - COURT_REFERENCE (50 pts) - court case reference
4. If score too low, AI fallback for semantic analysis
5. Links email to one or more cases

---

## Implementation Recommendation

### Approach: Configure bojin-law-ui to use bojin-law-2 backend

This is a **configuration/wiring task**, not new development. The MS 365 sync infrastructure already exists in bojin-law-2.

### Steps:

1. **Fix the Token Gap in bojin-law-ui**
   - Initialize `setMsAccessTokenGetter()` in AuthProvider
   - Ensure `x-ms-access-token` header is sent to gateway

2. **Start bojin-law-2 Backend Services**
   - Run docker-compose for postgres + redis
   - Start gateway service
   - Verify GraphQL endpoint at localhost:4000

3. **Verify Azure AD App Registration**
   - Ensure bojin-law-ui's client ID is registered
   - Add required Graph API permissions
   - Configure redirect URIs for localhost

4. **Trigger Email Sync**
   - Use GraphQL mutation `startEmailSync`
   - Or trigger via UI if available

5. **Monitor Sync & Classification**
   - Check `email_sync_states` table for status
   - Watch categorization worker logs
   - Verify emails appear in database

---

## File Plan

| File                                                   | Action | Purpose                               |
| ------------------------------------------------------ | ------ | ------------------------------------- |
| `bojin-law-ui/src/providers/AuthProvider.tsx`          | Modify | Initialize `setMsAccessTokenGetter()` |
| `bojin-law-ui/src/lib/apollo-client.ts`                | Review | Verify token header logic             |
| `bojin-law-ui/.env.local`                              | Modify | Ensure gateway URL is correct         |
| `bojin-law-2/.env`                                     | Modify | Configure Azure AD secrets            |
| `bojin-law-2/infrastructure/docker/docker-compose.yml` | Use    | Start required services               |

---

## Risks & Mitigations

| Risk                               | Mitigation                                                    |
| ---------------------------------- | ------------------------------------------------------------- |
| Azure AD app registration mismatch | Verify client IDs match between UI and gateway                |
| Token scopes insufficient          | Check gateway logs for scope errors, add required scopes      |
| Database schema mismatch           | Run migrations in bojin-law-2 before syncing                  |
| Webhook delivery fails locally     | Use manual sync trigger; webhooks require public URL or ngrok |
| Personal emails synced             | PersonalContact filtering is built-in; verify blocklist       |

---

## Open Questions Resolved

- [x] **Services for MS 365 sync**: Gateway service handles all MS 365 integration
- [x] **Environment variables**: Documented above (Azure AD + Graph API + Database)
- [x] **MSAL/Azure AD config**: Client ID, tenant ID, scopes documented
- [x] **Sync process**: Manual trigger via GraphQL, delta tokens for incremental
- [x] **Database setup**: PostgreSQL 16 with pgvector, migrations in Prisma
- [x] **Background workers**: Email categorization runs automatically with gateway
- [x] **Startup sequence**: Docker-compose, then gateway, workers auto-start
- [x] **bojin-law-ui MSAL config gap**: `setMsAccessTokenGetter()` never initialized

---

## Next Step

Start a new session and run:

```
/plan research-real-data-sync
```
