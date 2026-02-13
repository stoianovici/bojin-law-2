# Investigation: Local Development Environment Fragmentation

**Slug**: local-dev-env
**Date**: 2026-01-10
**Status**: Investigation Complete
**Severity**: High
**Next step**: `/debug local-dev-env` to implement fixes

---

## Bug Summary

**Reported symptom**: Local dev environment has constant issues - services not starting, no real data, inability to test with real users/emails/SharePoint connections.

**Reproduction steps**:

1. Clone repo, run `docker compose up -d && pnpm setup && pnpm dev`
2. Observe that only web + gateway start (no AI service)
3. Database is empty (no real cases, users, emails)
4. No connection to real SharePoint/email

**Expected behavior**: Local dev should be a perfect mirror of production with real synced data

**Actual behavior**: Local dev is a minimal skeleton with:

- Only 2 of 4 production services running
- Empty database with no real data
- No automated sync mechanism

**Frequency**: Always - structural issue

---

## Root Cause Analysis

### The Problem

**Root cause**: The local development setup was designed for initial bootstrapping, not for production parity. As the app grew complex, the gap widened.

**Type**: Environment/Architecture bug - accumulated technical debt

### Seven Core Issues Identified

#### 1. Fragmented Environment Variables

**Files affected**:

- `/.env.example` - Root template
- `/services/gateway/.env.example` - Different values
- `/services/ai-service/.env.example` - Different values
- `/services/ai-service/.env` - Local override (inconsistent)

**Problem**: Inconsistent database credentials across files:

```
Root:     postgres:postgres@localhost:5432/legal_platform
Services: postgres:password@localhost:5432/legal_platform_dev
```

The gateway correctly uses `--env-file=../../.env.local`, but ai-service uses local `.env`, causing configuration drift.

---

#### 2. Incomplete Service Startup

**Location**: `package.json:8`

```json
"dev": "turbo run dev --filter=@legal-platform/web --filter=@legal-platform/gateway --filter=@legal-platform/database"
```

**Missing services**:

- `@legal-platform/ai-service` - Has real code but NOT started by default
- `document-service` - Stub (no package.json)
- `task-service` - Stub (no package.json)
- `integration-service` - Stub (no package.json)
- `notification-service` - Stub (no package.json)

**Production runs**: web, gateway, ai-service, legacy-import (4 services)
**Local runs**: web, gateway (2 services)

---

#### 3. Stub Services With No Code

**Locations**:

- `/services/document-service/` - Only `.env` and `.env.example`
- `/services/task-service/` - Only `.env` and `.env.example`
- `/services/integration-service/` - Only `.env` and `.env.example`
- `/services/notification-service/` - Only `.env` and `.env.example`

**Problem**: `docker-compose.prod.yml` tries to build these stubs, which would fail:

```yaml
document-service:
  build:
    dockerfile: infrastructure/docker/Dockerfile.service
    args:
      SERVICE_NAME: document-service # No code to build!
```

---

#### 4. No Automated Data Sync

**Existing scripts** (manual, not integrated):

- `/packages/database/scripts/export-production.sh` - Manual export
- `/packages/database/scripts/import-anonymized.sh` - Manual import
- `/packages/database/scripts/anonymize-data.ts` - **PLACEHOLDER** (all logic commented out)

**Problem**: No `pnpm sync-data` or automated workflow to:

1. Export production data
2. Import to local
3. Anonymize PII
4. Verify integrity

---

#### 5. Missing Required Environment Variables

**Root `.env.example` is missing**:

```env
# Required for gateway but not documented
AZURE_AD_REDIRECT_URI=http://localhost:4000/auth/callback

# Required for Graph API subscriptions (email webhooks)
WEBHOOK_BASE_URL=http://localhost:4000
WEBHOOK_CLIENT_STATE=local-dev-webhook

# Required for SharePoint but only placeholders
SHAREPOINT_SITE_ID=bojinlucian.sharepoint.com,guid,guid
SHAREPOINT_DRIVE_ID=b!xxxxxxxxxxxx
```

The gateway's `auth.config.ts:26-33` **throws an error** if `AZURE_AD_REDIRECT_URI` is missing.

---

#### 6. Docker Compose Configuration Mismatch

**Root `docker-compose.yml`**: Only Postgres + Redis

```yaml
services:
  postgres: ...
  redis: ...
# No application services
```

**`infrastructure/docker/docker-compose.prod.yml`**: All 7 services

```yaml
services: postgres, redis, gateway, web,
  document-service, task-service, ai-service,
  integration-service, notification-service
```

**Gap**: No middle-ground `docker-compose.dev.yml` that starts actual services (not stubs) with hot-reload.

---

#### 7. Setup Script Limitations

**Location**: `/scripts/setup.sh`

**What it does**:

- Starts Postgres + Redis containers
- Creates `.env.local` from template
- Symlinks for Next.js
- Runs migrations

**What it doesn't do**:

- Seed any data
- Start all services
- Validate credentials work
- Sync production data

---

## Impact Assessment

**Affected functionality**:

- Testing role-based features (no real users)
- Email workflows (no real emails synced)
- SharePoint integration (no connected drives)
- AI features (ai-service not started)
- Document workflows (service is stub)

**Blast radius**: Wide - affects all development and testing

**Related code**:

- `services/gateway/src/config/auth.config.ts` - Strict validation, crashes on missing vars
- `services/gateway/src/config/graph.config.ts` - SharePoint config reads from env
- `services/ai-service/package.json` - Uses local `.env` not root

**Risk of similar bugs**: High - environment fragmentation compounds over time

---

## Proposed Fix Approaches

### Option A: Unified Dev Environment (Recommended)

**Approach**: Create a single, comprehensive local dev setup that mirrors production

**Changes required**:

1. **Single .env.local source of truth**
   - Update all service package.jsons to use `--env-file=../../.env.local`
   - Remove service-local `.env` files (keep only `.env.example`)
   - Update ai-service `package.json:9`: `"dev": "NODE_ENV=development tsx watch --env-file=../../.env.local src/index.ts"`

2. **Unified startup command**
   - Update root `package.json` dev script to include ai-service:
     ```json
     "dev": "turbo run dev --filter=@legal-platform/web --filter=@legal-platform/gateway --filter=@legal-platform/ai-service --filter=@legal-platform/database"
     ```

3. **Complete .env.example**
   - Add all required variables with documented placeholders
   - Add `AZURE_AD_REDIRECT_URI`
   - Add webhook config
   - Add SharePoint config

4. **Automated data sync**
   - Create `pnpm sync:prod` command
   - Automate: export → import → anonymize → verify
   - Add safeguards against running on production

5. **Delete stub services**
   - Remove document-service, task-service, integration-service, notification-service
   - OR implement them as microservices
   - Update docker-compose.prod.yml to only include real services

6. **Enhanced setup script**
   - Add credential validation
   - Add optional data seeding
   - Add service health checks

**Files to change**:

- `package.json` - Update dev script
- `.env.example` - Add missing variables
- `services/ai-service/package.json` - Fix env file path
- `scripts/setup.sh` - Add seeding, validation
- `packages/database/scripts/anonymize-data.ts` - Uncomment implementation
- Delete or implement stub services

**Pros**:

- Single source of truth for configuration
- All services start correctly
- Documented, reproducible setup

**Cons**:

- Requires careful migration of existing setups
- May need to delete or move stub service code

**Risk**: Low - incremental improvements, no breaking changes

---

### Option B: Docker-First Development

**Approach**: Use Docker Compose for all development, matching production exactly

**Changes required**:

1. Create `docker-compose.dev.yml` with all real services
2. Hot-reload via volume mounts
3. Remove need for local Node.js setup

**Files to change**:

- New `docker-compose.dev.yml`
- Update `package.json` scripts
- Dockerfile updates for dev mode

**Pros**:

- Perfect production parity
- No "works on my machine" issues

**Cons**:

- Slower iteration (container rebuilds)
- More complex debugging
- Resource-heavy (running all containers)

**Risk**: Medium - significant workflow change

---

### Option C: Minimal Fix (Quick Win)

**Approach**: Fix only the most critical issues without restructuring

**Changes required**:

1. Add ai-service to dev script
2. Fix ai-service env file path
3. Add missing env vars to .env.example
4. Add basic seed script

**Files to change**:

- `package.json` (1 line)
- `services/ai-service/package.json` (1 line)
- `.env.example` (add ~10 lines)
- New seed script

**Pros**:

- Quick to implement
- Low risk

**Cons**:

- Doesn't address data sync
- Stub services still exist
- Technical debt remains

**Risk**: Low

---

### Recommendation

**Option A (Unified Dev Environment)** is recommended.

It addresses all identified issues systematically while maintaining backward compatibility. The changes are incremental and can be rolled out in phases:

1. Phase 1: Fix env file paths and dev script (immediate)
2. Phase 2: Complete .env.example and setup script (this week)
3. Phase 3: Implement data sync automation (next sprint)
4. Phase 4: Clean up or implement stub services (backlog)

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] `pnpm setup` creates working local environment
2. [ ] `pnpm dev` starts web, gateway, AND ai-service
3. [ ] All services can connect to database
4. [ ] Azure AD authentication works locally
5. [ ] SharePoint integration connects successfully
6. [ ] Email sync works with real Microsoft Graph
7. [ ] `pnpm sync:prod` (when implemented) syncs anonymized data

### Suggested Test Cases

```typescript
// tests/integration/local-dev.test.ts
describe('Local Development Environment', () => {
  it('should start all services with pnpm dev', async () => {
    // Verify web on :3000, gateway on :4000, ai-service on :4003
  });

  it('should use single .env.local for all services', async () => {
    // Verify no service-local .env files are needed
  });

  it('should connect to Azure AD successfully', async () => {
    // Verify OAuth flow works
  });

  it('should sync with SharePoint', async () => {
    // Verify SharePoint drives are accessible
  });
});
```

---

## Investigation Notes

### Files Examined

| File                                          | Purpose            | Relevant Finding                  |
| --------------------------------------------- | ------------------ | --------------------------------- |
| `docker-compose.yml`                          | Local containers   | Only Postgres + Redis             |
| `.env.example`                                | Env template       | Missing required variables        |
| `package.json`                                | Root scripts       | Dev only runs 2 services          |
| `services/ai-service/package.json`            | AI service         | Uses local `.env`                 |
| `services/gateway/package.json`               | Gateway            | Uses `../../.env.local` (correct) |
| `scripts/setup.sh`                            | Initial setup      | No data seeding                   |
| `packages/database/scripts/anonymize-data.ts` | Data anonymization | Code is commented out             |
| `render.yaml`                                 | Production config  | 4 real services deployed          |
| `services/document-service/`                  | Document service   | Stub - no code                    |

### Production vs Local Comparison

| Aspect     | Production (Render)                     | Local Dev            |
| ---------- | --------------------------------------- | -------------------- |
| Services   | web, gateway, ai-service, legacy-import | web, gateway         |
| Database   | PostgreSQL (Render managed)             | Docker Postgres      |
| Redis      | Render Redis Pro                        | Docker Redis         |
| Data       | Real cases, emails, users               | Empty or seeded mock |
| SharePoint | Connected                               | Not configured       |
| Email      | Real Graph API webhooks                 | No webhooks          |

### Questions Answered During Investigation

- Q: Why don't services start?
- A: AI service uses local `.env` which may be misconfigured, and isn't included in dev script

- Q: Where is real data?
- A: No automated sync exists. Manual scripts exist but anonymization is a placeholder.

- Q: What's the difference from production?
- A: 2 services locally vs 4 in production; no data sync; no webhook setup

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug local-dev-env
```

The debug phase will:

1. Read this investigation document
2. Propose the specific implementation based on Option A
3. Get approval before making changes
4. Implement and verify the fix

**Priority order for fixes**:

1. Fix ai-service env path and add to dev script (immediate unblock)
2. Complete .env.example with all required variables
3. Update setup.sh with validation
4. Implement data sync automation
5. Clean up stub services
