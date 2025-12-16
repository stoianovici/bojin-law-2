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

## Related Documentation

- [Architecture Documentation](../../docs/architecture/)
- [Coding Standards](../../docs/architecture/coding-standards.md)
- [Tech Stack](../../docs/architecture/tech-stack.md)
- [API Specification](../../docs/architecture/api-specification.md)

---

**Last Updated:** 2025-11-21
**Story:** 2.7 - API Documentation and Developer Portal
