# API Gateway Service

> **Legal Platform - GraphQL API Gateway**

This service provides the main GraphQL API gateway for the Legal Platform, handling authentication, authorization, and routing to backend services.

---

## Quick Start

### Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Run linting
pnpm lint

# Type check
pnpm type-check
```

### GraphQL Playground

The GraphQL playground (Apollo Sandbox) is available in development mode:

**URL:** http://localhost:4000/graphql

Features:

- 🔍 Interactive schema explorer
- 📝 Query and mutation testing
- 🔐 Automatic authentication (via session cookies)
- 📚 Auto-generated documentation
- 💾 Query history

**Quick Test Query:**

```graphql
query GetMyCases {
  cases(assignedToMe: true) {
    id
    caseNumber
    title
    status
  }
}
```

For detailed playground guide, see: [docs/api/playground-guide.md](../../docs/api/playground-guide.md)

---

## Documentation

### Generate Schema Documentation

```bash
pnpm docs:generate
```

This generates markdown documentation from GraphQL schema files to `docs/api/schema/schema.md`.

The documentation is automatically regenerated on every push to main/develop that modifies schema files.

---

## Architecture

### GraphQL Schema

Schema files are organized in `src/graphql/schema/`:

- `scalars.graphql` - Custom scalar types (DateTime, UUID, JSON)
- `enums.graphql` - Enumeration types
- `case.graphql` - Case management types, queries, and mutations

### Resolvers

Resolvers are implemented in `src/graphql/resolvers/`:

- `case.resolvers.ts` - Case management business logic

### Authentication

- Uses Azure AD OAuth 2.0 for authentication
- JWT tokens stored in Redis-backed sessions
- User context extracted and passed to all resolvers
- Firm isolation enforced at resolver level

---

## API Documentation

- **Playground Guide:** [docs/api/playground-guide.md](../../docs/api/playground-guide.md)
- **Schema Documentation:** [docs/api/schema/schema.md](../../docs/api/schema/schema.md)
- **Case Management API:** [docs/api/case-management-api.md](../../docs/api/case-management-api.md)
- **Error Handling:** [docs/api/error-handling.md](../../docs/api/error-handling.md)

---

## Environment Variables

Create a `.env` file in the service directory:

```env
# Server
NODE_ENV=development
PORT=4000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/legal_platform

# Redis
REDIS_URL=redis://localhost:6379

# Azure AD
AZURE_AD_CLIENT_ID=your_client_id
AZURE_AD_CLIENT_SECRET=your_client_secret
AZURE_AD_TENANT_ID=your_tenant_id

# Session
SESSION_SECRET=your_session_secret
```

---

## Security

### Production Configuration

In production, the following security features are automatically enabled:

- ❌ Introspection disabled
- ❌ Playground disabled
- ✅ HTTPS enforced
- ✅ Rate limiting enabled
- ✅ Helmet security headers
- ✅ CORS restricted to allowed origins

### Authentication Flow

1. User authenticates via Azure AD OAuth 2.0
2. JWT token stored in Redis-backed session
3. Each GraphQL request extracts user from session
4. Resolvers receive authenticated user context
5. Authorization checks performed at resolver level

---

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

---

## Technology Stack

- **GraphQL Server:** Apollo Server 4.9+
- **Runtime:** Node.js 20 LTS
- **Framework:** Express 4.19+
- **Authentication:** Azure AD (MSAL Node)
- **Session Store:** Redis (ioredis)
- **Database:** PostgreSQL (Prisma ORM)
- **Validation:** Zod
- **Testing:** Jest + Supertest

---

## Firm Operations Agent (Partner Briefings)

### Overview

The Firm Operations Agent provides AI-powered daily briefings for partners, offering firm-wide insights on cases, team workload, client attention, and operational metrics.

### Configuration

| Environment Variable                      | Default                    | Description                                |
| ----------------------------------------- | -------------------------- | ------------------------------------------ |
| `ENABLE_FIRM_BRIEFING`                    | `true`                     | Feature flag to enable/disable briefings   |
| `BRIEFING_GENERATION_RATE_LIMIT_REQUESTS` | `3`                        | Max briefing generations per user per hour |
| `BRIEFING_GENERATION_RATE_LIMIT_WINDOW`   | `3600`                     | Rate limit window in seconds               |
| `FIRM_OPS_GENERATION_MODEL`               | `claude-sonnet-4-20250514` | Model for briefing generation              |
| `FIRM_OPS_THINKING_BUDGET`                | `10000`                    | Max thinking tokens per generation         |
| `FIRM_OPS_MAX_TOOL_ROUNDS`                | `5`                        | Max tool invocation rounds                 |
| `FIRM_OPS_DAILY_COST_ALERT_EUR`           | `5`                        | Daily cost alert threshold (€)             |
| `FIRM_BRIEFING_BATCH_CONCURRENCY`         | `5`                        | Parallel users in batch generation         |

### GraphQL API

**Queries:**

- `firmBriefing` - Get today's briefing for the current user
- `firmBriefingEligibility` - Check if user is eligible for briefings

**Mutations:**

- `generateFirmBriefing(force: Boolean)` - Generate or regenerate today's briefing
- `markFirmBriefingViewed(briefingId: ID!)` - Mark briefing as viewed
- `askBriefingFollowUp(input: BriefingFollowUpInput!)` - Ask follow-up questions

### Health Check

The firm briefing health check endpoint is available at:

```
GET /api/firm-briefing/health
```

Returns:

- Database connectivity status
- Redis connectivity status
- Feature flag status
- Today's briefing statistics

### Architecture

```
services/gateway/src/
├── services/
│   ├── firm-operations-agent.service.ts     # Main agent service
│   ├── firm-operations-agent.prompts.ts     # System prompts
│   ├── firm-operations-context.service.ts   # Context & caching
│   ├── firm-operations-tools.handlers.ts    # Tool implementations
│   ├── firm-operations-tools.schema.ts      # Tool definitions
│   ├── firm-operations.types.ts             # TypeScript types
│   └── firm-briefing-trigger.service.ts     # Staleness triggers
├── graphql/
│   ├── schema/firm-briefing.graphql         # GraphQL schema
│   └── resolvers/firm-briefing.resolvers.ts # GraphQL resolvers
├── batch/processors/
│   └── firm-briefings.processor.ts          # 5 AM batch generation
└── workers/
    └── firm-briefing-cleanup.worker.ts      # Retention cleanup
```

### Tools Available to Agent

| Tool                     | Description                                 |
| ------------------------ | ------------------------------------------- |
| `get_case_updates`       | Get recent case activity and status changes |
| `get_upcoming_deadlines` | Get tasks with approaching deadlines        |
| `get_team_status`        | Get team workload and availability          |
| `get_client_attention`   | Find clients needing attention              |
| `get_pending_emails`     | Get email threads awaiting response         |
| `get_firm_metrics`       | Get firm-wide operational metrics           |

### Batch Processing

Briefings are pre-generated at 5 AM daily for all eligible partners:

- Processor: `FirmBriefingsProcessor`
- Schedule: Configured in batch runner
- Only processes partners who were active in last 7 days

### Data Retention

- `FirmBriefing`: 90 days retention
- `FirmBriefingRun`: 30 days retention
- Cleanup runs daily at 3:30 AM

### Security

- **Authentication**: Required for all operations
- **Authorization**: Partners only
- **Rate limiting**: 3 generations per hour per user
- **Concurrent refresh protection**: Only one generation at a time per user

### How to Test Locally

1. **Enable the feature flag** (enabled by default):

   ```bash
   export ENABLE_FIRM_BRIEFING=true
   ```

2. **Start the gateway**:

   ```bash
   pnpm --filter gateway dev
   ```

3. **Login as a Partner** through the web app

4. **Verify the widget** appears on the dashboard

5. **Generate a briefing** by clicking "Generează briefing" or test via GraphQL:
   ```graphql
   mutation {
     generateFirmBriefing(force: true) {
       id
       summary
       items {
         headline
         severity
       }
     }
   }
   ```

### Debugging Agent Runs

Each briefing generation creates a `FirmBriefingRun` record with debug info:

```sql
-- Find recent runs for a user
SELECT id, status, started_at, completed_at,
       input_tokens, output_tokens, cost_eur, error
FROM firm_briefing_runs
WHERE user_id = 'USER_UUID'
ORDER BY started_at DESC
LIMIT 5;

-- Find runs by correlation ID (from logs)
SELECT * FROM firm_briefing_runs
WHERE tool_calls::text LIKE '%CORRELATION_ID%';
```

Log messages include `[FirmOperations]` prefix and correlation IDs for tracing.

### Cost Monitoring

Daily cost alerts are sent to Discord when `FIRM_OPS_DAILY_COST_ALERT_EUR` threshold is exceeded.

Query total costs:

```sql
-- Today's costs
SELECT SUM(cost_eur) as total_cost, COUNT(*) as runs
FROM firm_briefing_runs
WHERE started_at >= CURRENT_DATE;

-- Last 7 days by firm
SELECT f.name as firm, SUM(r.cost_eur) as total_cost
FROM firm_briefing_runs r
JOIN firms f ON r.firm_id = f.id
WHERE r.started_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY f.name
ORDER BY total_cost DESC;
```

---

## Related Documentation

- [Architecture Documentation](../../docs/architecture/)
- [Coding Standards](../../docs/architecture/coding-standards.md)
- [Tech Stack](../../docs/architecture/tech-stack.md)
- [API Specification](../../docs/architecture/api-specification.md)

---

**Last Updated:** 2026-02-02
**Story:** 2.7 - API Documentation and Developer Portal
