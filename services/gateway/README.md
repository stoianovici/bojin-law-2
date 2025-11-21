# Gateway Service

API Gateway for the Bojin Law Platform - Handles authentication, routing, and request proxying.

## Features

- **Azure AD Authentication** (OAuth 2.0 with PKCE)
- **JWT Token Management** (Access + Refresh tokens)
- **Session Management** (Redis-backed)
- **Role-Based Access Control** (Partner, Associate, Paralegal)
- **User Provisioning** (Automatic from Azure AD)
- **Microsoft Graph API Integration** (User profile fetching)
- **Graph API Rate Limiting** (10,000 req/10min per app)
- **Webhook Subscriptions** (Email and file change notifications)
- **Response Caching** (Redis-backed with configurable TTL)

## Quick Start

### Prerequisites

- Node.js 20 LTS
- Redis 7.2+
- PostgreSQL 16+
- Azure AD app registration (see [Authentication Setup](./AUTHENTICATION.md#azure-ad-app-registration-setup))

### Installation

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your Azure AD and database credentials
```

### Environment Variables

See [AUTHENTICATION.md - Environment Variables](./AUTHENTICATION.md#environment-variables) for full configuration details.

Required variables:

```bash
# Azure AD
AZURE_AD_CLIENT_ID=<guid>
AZURE_AD_CLIENT_SECRET=<secret>
AZURE_AD_TENANT_ID=<guid>
AZURE_AD_REDIRECT_URI=http://localhost:3000/auth/callback

# JWT
JWT_SECRET=<min-32-chars>
JWT_ISSUER=https://bojin-law.onrender.com
JWT_AUDIENCE=bojin-law-api

# Session
SESSION_SECRET=<min-32-chars>

# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Microsoft Graph API (optional - defaults shown)
GRAPH_API_BASE_URL=https://graph.microsoft.com/v1.0
GRAPH_API_TIMEOUT=30000
GRAPH_RETRY_MAX_ATTEMPTS=5
```

### Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Type checking
npx tsc --noEmit

# Linting
npm run lint
```

### Testing

```bash
# Unit tests
npm test

# Integration tests
npm test -- __tests__/integration/

# E2E tests (requires Playwright)
npx playwright test
```

**Test Coverage:**

- Overall: 86.6% statements, 88.88% functions, 86.45% lines
- Services: 96.57% (auth, JWT, user)
- Middleware: 100%

## API Endpoints

### Authentication

| Endpoint         | Method | Description               | Auth Required |
| ---------------- | ------ | ------------------------- | ------------- |
| `/auth/login`    | GET    | Initiate OAuth flow       | No            |
| `/auth/callback` | GET    | Handle OAuth callback     | No            |
| `/auth/refresh`  | POST   | Refresh access token      | Session       |
| `/auth/logout`   | POST   | Logout and revoke session | Session       |

### Admin (Monitoring)

| Endpoint                  | Method | Description            | Auth Required |
| ------------------------- | ------ | ---------------------- | ------------- |
| `/admin/session-stats`    | GET    | Session statistics     | Partner       |
| `/admin/cleanup-sessions` | POST   | Manual session cleanup | Partner       |
| `/admin/health`           | GET    | Redis health check     | Partner       |

For detailed API documentation, see [AUTHENTICATION.md - API Endpoints](./AUTHENTICATION.md#api-endpoints).

## Microsoft Graph API Configuration

### Required Azure AD Permissions

The application requires both **Application** (app-only) and **Delegated** (user context) permissions configured in Azure AD.

#### Application Permissions (Requires Admin Consent)

These permissions allow the app to access resources without a signed-in user:

- `Mail.Read` - Read mail in all mailboxes
- `Mail.Send` - Send mail as any user
- `Files.Read.All` - Read all files (OneDrive)
- `Files.ReadWrite.All` - Read and write all files (OneDrive)
- `Calendars.Read` - Read calendars in all mailboxes
- `Calendars.ReadWrite` - Read and write calendars

#### Delegated Permissions (User Context)

These permissions require a signed-in user:

- `User.Read` - Read signed-in user profile
- `Mail.Read` - Read user mail
- `Mail.Send` - Send mail as user
- `Mail.ReadWrite` - Read and write user mail
- `Files.Read` - Read user files
- `Files.ReadWrite` - Read and write user files
- `Files.Read.All` - Read all files user can access
- `Calendars.Read` - Read user calendars
- `Calendars.ReadWrite` - Read and write user calendars

### Azure AD App Registration Setup

1. Navigate to Azure Portal > Azure Active Directory > App registrations
2. Select your application (or create new registration)
3. Go to **API permissions**
4. Click **Add a permission** > **Microsoft Graph**
5. Add **Application permissions** listed above
6. Add **Delegated permissions** listed above
7. Click **Grant admin consent** for your tenant (requires admin role)

**Note:** Admin consent is required for all Application permissions. Without admin consent, the application cannot access Microsoft Graph API with app-only access.

### Graph API Endpoints

The following Microsoft Graph API endpoints are available through the GraphService:

| Resource      | Endpoint                           | Description                 |
| ------------- | ---------------------------------- | --------------------------- |
| User Profile  | `GET /me`                          | Get current user profile    |
| User by ID    | `GET /users/{id}`                  | Get specific user info      |
| Messages      | `GET /me/messages`                 | List user emails            |
| Send Mail     | `POST /me/sendMail`                | Send email as user          |
| Drive         | `GET /me/drive`                    | Get user OneDrive           |
| Drive Item    | `GET /me/drive/items/{id}`         | Get file metadata           |
| Upload File   | `PUT /me/drive/items/{id}/content` | Upload file to OneDrive     |
| Calendar      | `GET /me/calendar`                 | Get user calendar           |
| Events        | `GET /me/calendar/events`          | List calendar events        |
| Subscriptions | `POST /subscriptions`              | Create webhook subscription |

### Rate Limiting

Microsoft Graph API enforces the following rate limits:

- **10,000 requests per 10 minutes** per application
- **100 requests per minute** per user (secondary protection)

The gateway implements automatic rate limiting middleware to prevent quota exhaustion. When limits are exceeded:

- API returns `429 Too Many Requests`
- Response includes `Retry-After` header
- Automatic exponential backoff retry logic applies

### Webhook Subscriptions

The gateway supports webhook subscriptions for real-time notifications:

**Supported Resources:**

- Email notifications: `/me/messages` (created, updated)
- File notifications: `/me/drive/root` (created, updated, deleted)

**Subscription Lifecycle:**

- Subscriptions expire every **3 days** (4320 minutes)
- Background worker automatically renews expiring subscriptions
- Renewal occurs **24 hours before expiry**
- Failed renewals are logged for monitoring

**Webhook Endpoint:**

- `POST /webhooks/graph` - Receives Graph API notifications

### Response Caching

Graph API responses are cached in Redis with resource-specific TTLs:

| Resource        | Cache TTL         |
| --------------- | ----------------- |
| User Profile    | 1 hour (3600s)    |
| Calendar Events | 5 minutes (300s)  |
| File Metadata   | 15 minutes (900s) |
| Email Messages  | 1 minute (60s)    |

**Cache Invalidation:**

- Automatic on POST/PUT/DELETE operations
- Webhook notifications trigger cache invalidation
- Manual invalidation: `POST /admin/cache/invalidate` (Partner role)

### Error Handling

The GraphService implements automatic retry logic for transient failures:

**Retryable Errors:**

- `429` - Rate limit exceeded (respects `Retry-After` header)
- `500` - Internal server error
- `503` - Service unavailable
- Network timeouts

**Retry Strategy:**

- Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s
- Maximum 5 retry attempts
- Circuit breaker: Opens after 10 consecutive failures

**Non-Retryable Errors:**

- `400` - Bad request
- `401` - Unauthorized (triggers automatic token refresh)
- `403` - Forbidden
- `404` - Not found

## Authentication Flow

1. **Login**: User redirected to Azure AD
2. **Callback**: Exchange authorization code for tokens
3. **Provisioning**: Create/update user in database
4. **Status Validation**: Check user status (Pending/Active/Inactive)
5. **Session Creation**: Store session in Redis
6. **JWT Generation**: Issue access + refresh tokens

For detailed flow diagrams, see [AUTHENTICATION.md - Authentication Flow](./AUTHENTICATION.md#authentication-flow).

## Architecture

### Service Structure

```
services/gateway/
├── src/
│   ├── config/               # Configuration modules
│   │   ├── auth.config.ts    # MSAL (Azure AD) configuration
│   │   ├── session.config.ts # Redis session store configuration
│   │   └── graph.config.ts   # Microsoft Graph API client configuration
│   ├── middleware/           # Request processing middleware
│   │   ├── auth.middleware.ts          # JWT authentication
│   │   ├── session.middleware.ts       # Session validation
│   │   ├── rate-limit.middleware.ts    # Graph API rate limiting
│   │   ├── token-refresh.middleware.ts # Automatic token renewal
│   │   └── cache.middleware.ts         # Redis response caching
│   ├── routes/               # API endpoint handlers
│   │   ├── auth.routes.ts    # OAuth flows and token management
│   │   ├── graph.routes.ts   # Graph API proxied endpoints
│   │   └── webhook.routes.ts # Graph webhook notifications
│   ├── services/             # Business logic layer
│   │   ├── auth.service.ts   # Azure AD integration
│   │   ├── jwt.service.ts    # JWT token generation/validation
│   │   ├── user.service.ts   # User provisioning and management
│   │   ├── graph.service.ts  # Graph API operations
│   │   └── webhook.service.ts # Subscription management
│   ├── workers/              # Background job processors
│   │   └── subscription-renewal.worker.ts # Auto-renew webhooks
│   ├── utils/                # Helper utilities
│   │   ├── retry.util.ts          # Exponential backoff + circuit breaker
│   │   ├── graph-error-handler.ts # Graph API error categorization
│   │   ├── graph-api-wrapper.ts   # Auto-retry wrapper for 401
│   │   └── token-helpers.ts       # Token storage and retrieval
│   ├── types/                # TypeScript type definitions
│   │   └── auth.types.ts     # Authentication type definitions
│   └── index.ts              # Express app entry point
├── __tests__/                # Test suites
│   ├── config/               # Configuration tests
│   ├── middleware/           # Middleware unit tests
│   ├── services/             # Service unit tests
│   ├── routes/               # Route unit tests
│   ├── utils/                # Utility unit tests
│   ├── workers/              # Worker unit tests
│   └── integration/          # Integration tests
│       ├── graph-rate-limiting.integration.test.ts
│       ├── graph-error-handling.integration.test.ts
│       ├── retry-error-handling.integration.test.ts
│       ├── email-webhooks.integration.test.ts
│       ├── file-webhooks.integration.test.ts
│       └── graph-api.integration.test.ts
├── AUTHENTICATION.md         # Authentication documentation
└── package.json              # Dependencies & scripts
```

### Graph API Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Request                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Express Middleware Stack                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. Rate Limit Check (combinedGraphRateLimitMiddleware) │  │
│  │    ├─ App-level: 10,000 req/10min                      │  │
│  │    └─ Per-user: 100 req/min                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │ 429 if exceeded                    │
│                         ▼                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 2. Authentication (requireAuth)                        │  │
│  │    ├─ Extract userId & accessToken from session        │  │
│  │    └─ Store in res.locals                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │ 401 if unauthorized                │
│                         ▼                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 3. Cache Check (graphCacheMiddleware) [GET only]       │  │
│  │    ├─ Generate cache key: graph:{userId}:{url}         │  │
│  │    ├─ Check Redis for cached response                  │  │
│  │    └─ Return cached data if found (X-Cache: HIT)       │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │ Cache MISS                         │
│                         ▼                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 4. Route Handler (graph.routes.ts)                     │  │
│  │    └─ Call GraphService method                         │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      GraphService Layer                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 5. Retry Wrapper (retryWithBackoff)                    │  │
│  │    ├─ Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s    │  │
│  │    ├─ Max 5 retry attempts                             │  │
│  │    ├─ Circuit breaker (opens after 10 failures)        │  │
│  │    └─ Respect Retry-After header (429 responses)       │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                    │
│                         ▼                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 6. Graph API Client                                    │  │
│  │    ├─ Create authenticated client (Client.init)        │  │
│  │    ├─ Attach access token to request                   │  │
│  │    └─ Make HTTP call to Graph API                      │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               Microsoft Graph API (External)                 │
│  https://graph.microsoft.com/v1.0/{resource}                 │
└────────────────────────┬────────────────────────────────────┘
                         │ Response / Error
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Error Handler / Retry Logic                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 7. Error Categorization (graph-error-handler.ts)       │  │
│  │    ├─ Transient: 429, 500, 503 → Retry                 │  │
│  │    ├─ Auth: 401 → Auto token refresh + retry           │  │
│  │    └─ Permanent: 400, 403, 404 → Return immediately    │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ Success
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     Response Processing                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 8. Cache Storage (cache.middleware.ts) [GET only]      │  │
│  │    ├─ Store response in Redis with TTL                 │  │
│  │    ├─ Set X-Cache: MISS header                         │  │
│  │    └─ Set Cache-Control header with max-age            │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                    │
│                         ▼                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 9. Cache Invalidation (POST/PUT/DELETE operations)     │  │
│  │    ├─ Generate invalidation pattern: graph:{userId}:*  │  │
│  │    ├─ Find matching Redis keys                         │  │
│  │    └─ Delete invalidated cache entries                 │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Response to Client                        │
│  ├─ Status code (200, 400, 401, 403, 404, 429, 500, 503)    │
│  ├─ Response body (data or error)                           │
│  └─ Headers: X-Cache, X-RateLimit-*, Cache-Control          │
└─────────────────────────────────────────────────────────────┘
```

### Webhook Notification Flow

```
┌─────────────────────────────────────────────────────────────┐
│          Microsoft Graph API (Webhook Notification)          │
│  POST https://your-app.onrender.com/webhooks/graph          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Webhook Routes Handler                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. Validation Token Check (Subscription Creation)      │  │
│  │    └─ Return validation token if present               │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │ No validation token                │
│                         ▼                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 2. Client State Verification                           │  │
│  │    └─ Verify matches WEBHOOK_CLIENT_STATE env var      │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │ Valid client state                 │
│                         ▼                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 3. Process Notifications                               │  │
│  │    ├─ Parse notification array from request body       │  │
│  │    ├─ Extract subscriptionId, resource, changeType     │  │
│  │    └─ Route to appropriate handler (email/file)        │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                Cache Invalidation / Task Queue               │
│  ├─ Invalidate related cache entries (graph:{userId}:*)     │
│  ├─ Queue email processing task (for future stories)        │
│  ├─ Queue file sync task (for future stories)               │
│  └─ Log notification processing metrics                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Return 202 Accepted (Async Processing)          │
└─────────────────────────────────────────────────────────────┘
```

### Subscription Renewal Worker Flow

```
┌─────────────────────────────────────────────────────────────┐
│          Hourly Cron Job / Background Worker                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Query Database for Expiring Subscriptions               │
│     SELECT * FROM graph_subscriptions                        │
│     WHERE expiration_datetime < NOW() + INTERVAL '24 hours' │
│     AND is_active = true                                     │
└────────────────────────┬────────────────────────────────────┘
                         │ Found N subscriptions
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  2. For Each Subscription:                                   │
│     ├─ Call webhook.service.renewSubscription()              │
│     ├─ PATCH /subscriptions/{subscriptionId}                 │
│     ├─ Update expiration_datetime in database                │
│     └─ Log renewal result (success/failure)                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Handle Renewal Failures:                                 │
│     ├─ Exponential backoff retry (3 attempts)                │
│     ├─ Mark subscription as inactive if all retries fail     │
│     └─ Alert monitoring system for manual intervention       │
└─────────────────────────────────────────────────────────────┘
```

## Security

### Token Security

- Access tokens: In-memory storage (React state)
- Refresh tokens: httpOnly cookies
- Session cookies: httpOnly, secure, sameSite=strict
- JWT signing: HS256 with 256-bit secret

### PKCE (Proof Key for Code Exchange)

- All OAuth flows use PKCE (RFC 7636)
- Code challenge: SHA-256 hash
- Prevents authorization code interception

### Session Management

- Redis backend with 7-day TTL
- Automatic cleanup via Redis expiration
- Session validation on every request

For full security documentation, see [AUTHENTICATION.md - Security Considerations](./AUTHENTICATION.md#security-considerations).

## Troubleshooting

### Common Issues

#### "Your account is pending activation"

**Solution:** Contact your firm's Partner to activate your account. Until Story 2.4.1 (Partner User Management) is implemented, activation requires manual database updates.

#### "Access token has expired"

**Solution:** Call `POST /auth/refresh` to get a new access token using the refresh token from your session.

#### "Session not found"

**Solution:** Sessions expire after 7 days. Re-authenticate via `/auth/login`.

For more troubleshooting tips, see [AUTHENTICATION.md - Troubleshooting](./AUTHENTICATION.md#troubleshooting).

### Graph API Troubleshooting Runbook

#### Issue: 429 Rate Limit Exceeded

**Symptoms:**

- API responses with status `429 Too Many Requests`
- Log entries: `[Graph Rate Limit] Rate limit exceeded`
- High request volume in monitoring dashboards

**Diagnosis:**

1. Check rate limit headers in responses:
   ```
   X-RateLimit-Limit: 10000
   X-RateLimit-Remaining: 0
   X-RateLimit-Reset: 1732147200
   ```
2. Check Redis rate limit keys: `redis-cli KEYS "rate:graph:*"`
3. Review application logs for request patterns

**Resolution:**

- **Immediate:** Wait for reset time (check `Retry-After` header)
- **Short-term:** Implement request batching to reduce call volume
- **Long-term:** Review caching strategy to improve hit rates (target >60%)

**Prevention:**

- Monitor rate limit remaining via `X-RateLimit-Remaining` header
- Set alerts when remaining requests < 1000
- Increase cache TTLs for frequently accessed resources

---

#### Issue: Webhook Subscription Failures

**Symptoms:**

- Log entries: `[Webhook Service] Failed to create subscription`
- No webhook notifications received
- Subscriptions not appearing in database

**Diagnosis:**

1. Check webhook notification URL accessibility:
   ```bash
   curl -X POST https://your-app.onrender.com/webhooks/graph \
     -H "Content-Type: application/json" \
     -d '{"value":[{"subscriptionId":"test"}]}'
   ```
2. Verify Azure AD permissions granted (see [Azure AD App Registration Setup](#azure-ad-app-registration-setup))
3. Check database for expired subscriptions: `SELECT * FROM graph_subscriptions WHERE is_active=true`

**Resolution:**

- Ensure `WEBHOOK_BASE_URL` environment variable is set correctly
- Verify notification URL is publicly accessible (HTTPS required)
- Check admin consent granted for required permissions
- Manually renew expired subscriptions via webhook service

**Prevention:**

- Monitor subscription renewal worker logs
- Set alerts for subscription renewal failures
- Implement monitoring for webhook endpoint uptime

---

#### Issue: Graph API Token Expiration

**Symptoms:**

- `401 Unauthorized` responses from Graph API
- Log entries: `InvalidAuthenticationToken`
- Failed requests after extended idle periods

**Diagnosis:**

1. Check token expiry in session: `req.session.accessTokenExpiry`
2. Verify refresh token validity in Redis
3. Review token refresh middleware logs

**Resolution:**

- Automatic token refresh should handle this transparently
- If automatic refresh fails, user must re-authenticate via `/auth/login`
- Check MSAL configuration for correct token scopes

**Prevention:**

- Implement proactive token refresh (5 minutes before expiry)
- Monitor token refresh success rates
- Set alerts for high token refresh failure rates

---

#### Issue: Cache Consistency Problems

**Symptoms:**

- Stale data returned from API
- User sees outdated information after updates
- Cache hit rate abnormally high (>95%)

**Diagnosis:**

1. Check cache TTLs: Review `getCacheTTL()` function in cache.middleware.ts
2. Verify cache invalidation triggers: Check POST/PUT/DELETE handlers
3. Inspect Redis cache keys: `redis-cli KEYS "graph:*"`

**Resolution:**

- Manual cache invalidation: `POST /graph/admin/cache/invalidate` with userId
- Clear all cache: `redis-cli FLUSHDB` (⚠️ production warning)
- Reduce cache TTL for affected resources

**Prevention:**

- Implement cache versioning for breaking changes
- Monitor cache hit/miss ratios (target 60-80%)
- Review cache invalidation logic in webhook handlers

---

#### Issue: Circuit Breaker Opened

**Symptoms:**

- Log entries: `[Retry Util] Circuit breaker opened`
- All Graph API requests failing immediately
- No retry attempts being made

**Diagnosis:**

1. Check circuit breaker state in logs
2. Review recent error patterns (should see 10+ consecutive failures)
3. Verify Graph API service health: https://status.graph.microsoft.com/

**Resolution:**

- Wait for circuit breaker reset (60 seconds default)
- If Graph API is healthy, circuit will automatically close
- If persistent, investigate root cause of repeated failures

**Prevention:**

- Monitor Graph API error rates
- Set alerts for circuit breaker state changes
- Implement graceful degradation for non-critical operations

---

#### Issue: High Memory Usage

**Symptoms:**

- Node.js process using excessive memory
- OOM (Out of Memory) errors
- Slow API response times

**Diagnosis:**

1. Check Redis connection count: `redis-cli CLIENT LIST`
2. Review cache size: `redis-cli DBSIZE`
3. Analyze heap snapshot for memory leaks

**Resolution:**

- Restart gateway service
- Clear Redis cache if size exceeds limits
- Review cache middleware for connection leaks

**Prevention:**

- Implement Redis connection pooling
- Set max cache entry size limits
- Monitor memory usage with alerts at 80% threshold

---

### Graph API Monitoring

**Key Metrics to Track:**

1. **Rate Limiting**
   - Requests per minute/hour
   - Rate limit violations (429 responses)
   - Time until rate limit reset

2. **Caching**
   - Cache hit ratio (target: 60-80%)
   - Average cache response time (<50ms)
   - Cache invalidation frequency

3. **Webhooks**
   - Active subscriptions count
   - Subscription renewal success rate (target: >99%)
   - Webhook notification processing time (<500ms)

4. **Error Rates**
   - Graph API error responses by code (400, 401, 403, 404, 429, 500, 503)
   - Retry attempts per request
   - Circuit breaker state changes

5. **Performance**
   - API response times (p50, p95, p99)
   - Token refresh latency
   - Database query performance for subscriptions

**Monitoring Endpoints:**

- `GET /graph/admin/cache/stats` - Cache statistics
- `GET /admin/health` - Redis health check
- `GET /admin/session-stats` - Session statistics

**Alerting Thresholds:**

- Rate limit remaining < 1000 requests
- Cache hit ratio < 50%
- Subscription renewal failure rate > 5%
- Graph API error rate > 10%
- Circuit breaker opened
- Memory usage > 80%

## Documentation

- **[AUTHENTICATION.md](./AUTHENTICATION.md)** - Comprehensive authentication documentation
  - Azure AD setup guide
  - Environment variables
  - Authentication flows
  - API endpoints
  - JWT token structure
  - Session management
  - Role-based access control
  - Troubleshooting guide

- **[Story 2.4](../../docs/stories/2.4.story.md)** - Implementation story with dev notes

## Related Stories

- **Story 2.2:** Cloud Infrastructure and Database Setup (Redis, PostgreSQL)
- **Story 2.3:** Data Migration and Seeding Strategy (Database schema)
- **Story 2.4:** Authentication with Azure AD (this service)
- **Story 2.4.1:** Partner User Management (user activation UI)
- **Story 2.5:** Microsoft Graph API Integration (user profile sync)

## Tech Stack

- **Runtime:** Node.js 20 LTS
- **Framework:** Express 4.19+
- **Language:** TypeScript 5.3+
- **Authentication:** @azure/msal-node 2.0+ (OAuth 2.0)
- **Tokens:** jsonwebtoken 9.0+ (JWT)
- **Session:** express-session 1.17+ + connect-redis 7.0+
- **Database:** @legal-platform/database (Prisma + Redis)
- **Testing:** Jest 29+ + Supertest 6.3+

## Contributing

### Running Tests

Always run tests before committing:

```bash
# Run all tests
npm test

# Run tests with coverage (must meet 80% threshold)
npm test -- --coverage

# Run specific test file
npm test -- __tests__/services/auth.service.test.ts
```

### Code Style

- TypeScript strict mode enabled
- ESLint + Prettier for formatting
- Follow existing patterns in codebase

### Pull Requests

1. Create feature branch from `main`
2. Write tests for new features (80%+ coverage required)
3. Run `npm test` and ensure all tests pass
4. Run `npx tsc --noEmit` to check types
5. Submit PR with clear description

## License

Proprietary - Bojin Law Firm

---

**Version:** 1.0.0
**Last Updated:** 2025-11-20
**Story:** 2.4 - Authentication with Azure AD
