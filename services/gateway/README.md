# Gateway Service

API Gateway for the Bojin Law Platform - Handles authentication, routing, and request proxying.

## Features

- **Azure AD Authentication** (OAuth 2.0 with PKCE)
- **JWT Token Management** (Access + Refresh tokens)
- **Session Management** (Redis-backed)
- **Role-Based Access Control** (Partner, Associate, Paralegal)
- **User Provisioning** (Automatic from Azure AD)
- **Microsoft Graph API Integration** (User profile fetching)

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

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/auth/login` | GET | Initiate OAuth flow | No |
| `/auth/callback` | GET | Handle OAuth callback | No |
| `/auth/refresh` | POST | Refresh access token | Session |
| `/auth/logout` | POST | Logout and revoke session | Session |

### Admin (Monitoring)

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/admin/session-stats` | GET | Session statistics | Partner |
| `/admin/cleanup-sessions` | POST | Manual session cleanup | Partner |
| `/admin/health` | GET | Redis health check | Partner |

For detailed API documentation, see [AUTHENTICATION.md - API Endpoints](./AUTHENTICATION.md#api-endpoints).

## Authentication Flow

1. **Login**: User redirected to Azure AD
2. **Callback**: Exchange authorization code for tokens
3. **Provisioning**: Create/update user in database
4. **Status Validation**: Check user status (Pending/Active/Inactive)
5. **Session Creation**: Store session in Redis
6. **JWT Generation**: Issue access + refresh tokens

For detailed flow diagrams, see [AUTHENTICATION.md - Authentication Flow](./AUTHENTICATION.md#authentication-flow).

## Architecture

```
services/gateway/
├── src/
│   ├── config/          # Configuration (MSAL, session, Redis)
│   ├── middleware/      # Auth & session middleware
│   ├── routes/          # API routes (auth, admin)
│   ├── services/        # Business logic (auth, JWT, user)
│   ├── types/           # TypeScript type definitions
│   └── index.ts         # Express app entry point
├── __tests__/           # Unit & integration tests
│   ├── config/          # Config tests
│   ├── middleware/      # Middleware tests
│   ├── services/        # Service tests
│   ├── routes/          # Route tests
│   └── integration/     # Integration tests
├── AUTHENTICATION.md    # Authentication documentation
└── package.json         # Dependencies & scripts
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
