# Authentication Documentation

**Story 2.4: Authentication with Azure AD**

This document provides comprehensive documentation for the Azure AD OAuth 2.0 authentication system implemented in the Gateway service.

## Table of Contents

- [Overview](#overview)
- [Azure AD App Registration Setup](#azure-ad-app-registration-setup)
- [Environment Variables](#environment-variables)
- [Authentication Flow](#authentication-flow)
- [API Endpoints](#api-endpoints)
- [JWT Token Structure](#jwt-token-structure)
- [Session Management](#session-management)
- [Role-Based Access Control](#role-based-access-control)
- [User Provisioning](#user-provisioning)
- [Troubleshooting](#troubleshooting)

## Overview

The application uses **Azure AD OAuth 2.0 with PKCE** (Proof Key for Code Exchange) for user authentication. Users sign in with their Microsoft 365 credentials and are automatically provisioned in the database with "Pending" status until activated by a Partner.

**Key Features:**

- Single Sign-On (SSO) with Microsoft 365
- OAuth 2.0 Authorization Code Flow with PKCE
- JWT-based access tokens (30-minute expiry)
- Refresh tokens (7-day expiry)
- Redis-backed session storage
- Role-based access control (Partner, Associate, Paralegal)
- User status management (Pending, Active, Inactive)

## Azure AD App Registration Setup

### Step 1: Create App Registration

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory** → **App registrations** → **New registration**
3. Fill in the details:
   - **Name**: `Bojin Law Platform`
   - **Supported account types**: `Single tenant` (organization directory only)
   - **Redirect URI**: Web application
     - Development: `http://localhost:3000/auth/callback`
     - Staging: `https://bojin-law-staging.onrender.com/auth/callback`
     - Production: `https://bojin-law.onrender.com/auth/callback`
4. Click **Register**

### Step 2: Configure API Permissions

1. Go to **API permissions** → **Add a permission**
2. Select **Microsoft Graph** → **Delegated permissions**
3. Add the following permissions:
   - `User.Read` - Read user profile
   - `profile` - Read basic profile
   - `email` - Read email address
   - `openid` - OpenID Connect
   - `User.ReadBasic.All` (optional) - Read other users
4. Click **Grant admin consent** to approve permissions

### Step 3: Generate Client Secret

1. Go to **Certificates & secrets** → **New client secret**
2. Add description: `Gateway Service Secret`
3. Set expiration: `24 months` (recommended)
4. Click **Add** and **copy the secret value immediately** (it won't be shown again)
5. Store securely in environment variables

### Step 4: Configure Token Claims

1. Go to **Token configuration** → **Add optional claim**
2. Select **ID token**
3. Add claims:
   - `email`
   - `given_name`
   - `family_name`
4. Save configuration

### Step 5: Note Configuration Details

Copy the following values for environment variables:

- **Application (client) ID** → `AZURE_AD_CLIENT_ID`
- **Directory (tenant) ID** → `AZURE_AD_TENANT_ID`
- **Client secret** (from Step 3) → `AZURE_AD_CLIENT_SECRET`

## Environment Variables

Add these environment variables to your `.env` file or Render environment configuration:

```bash
# Azure AD Configuration
AZURE_AD_CLIENT_ID=<guid-from-app-registration>
AZURE_AD_CLIENT_SECRET=<secret-from-step-3>
AZURE_AD_TENANT_ID=<tenant-guid>
AZURE_AD_REDIRECT_URI=https://bojin-law.onrender.com/auth/callback

# JWT Configuration
JWT_SECRET=<random-256-bit-secret-min-32-chars>
JWT_ISSUER=https://bojin-law.onrender.com
JWT_AUDIENCE=bojin-law-api
JWT_ACCESS_TOKEN_EXPIRY=30m
JWT_REFRESH_TOKEN_EXPIRY=7d

# Session Configuration
SESSION_SECRET=<random-256-bit-secret>
SESSION_MAX_AGE=604800000  # 7 days in milliseconds

# Database (from Story 2.2)
DATABASE_URL=<postgresql-connection-string>
REDIS_URL=<redis-connection-string>
```

**Generating Secrets:**

```bash
# Generate secure random secrets (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Authentication Flow

### 1. Login Flow (OAuth 2.0 Authorization Code with PKCE)

```
┌──────────┐                                     ┌───────────┐                    ┌──────────┐
│ Frontend │                                     │  Gateway  │                    │ Azure AD │
└────┬─────┘                                     └─────┬─────┘                    └────┬─────┘
     │                                                 │                                │
     │ 1. User clicks "Sign in with Microsoft"        │                                │
     ├────────────────────────────────────────────────>│                                │
     │                                                 │                                │
     │                      GET /auth/login            │                                │
     │                                                 │                                │
     │                                                 │ 2. Generate auth URL + PKCE    │
     │                                                 │    (code_verifier,             │
     │                                                 │     code_challenge, state)     │
     │                                                 │                                │
     │                                                 │ 3. Store PKCE in Redis         │
     │                                                 │    (15 min TTL)                │
     │                                                 │                                │
     │ 4. Redirect to Azure AD                        │                                │
     │<────────────────────────────────────────────────┤                                │
     │                                                 │                                │
     │ 5. User authenticates                           │                                │
     ├─────────────────────────────────────────────────┼───────────────────────────────>│
     │                                                 │                                │
     │ 6. Azure AD callback with code + state         │                                │
     │<────────────────────────────────────────────────┼────────────────────────────────┤
     │                                                 │                                │
     │ 7. Frontend receives callback                   │                                │
     ├────────────────────────────────────────────────>│                                │
     │                      GET /auth/callback         │                                │
     │                      ?code=...&state=...        │                                │
     │                                                 │                                │
     │                                                 │ 8. Validate state, retrieve    │
     │                                                 │    PKCE from Redis             │
     │                                                 │                                │
     │                                                 │ 9. Exchange code for tokens    │
     │                                                 │    (with code_verifier)        │
     │                                                 ├───────────────────────────────>│
     │                                                 │                                │
     │                                                 │ 10. Return access + ID token   │
     │                                                 │<───────────────────────────────┤
     │                                                 │                                │
     │                                                 │ 11. Extract user profile       │
     │                                                 │                                │
     │                                                 │ 12. Create/update user in DB   │
     │                                                 │     (Pending status)           │
     │                                                 │                                │
     │                                                 │ 13. Validate user status       │
     │                                                 │     - Pending → 403           │
     │                                                 │     - Inactive → 403          │
     │                                                 │     - Active → Continue       │
     │                                                 │                                │
     │                                                 │ 14. Generate JWT tokens        │
     │                                                 │     (access + refresh)         │
     │                                                 │                                │
     │                                                 │ 15. Create session in Redis    │
     │                                                 │                                │
     │ 16. Return JWT tokens + user data              │                                │
     │<────────────────────────────────────────────────┤                                │
     │                                                 │                                │
     │ 17. Store access token in memory               │                                │
     │     Store refresh token in httpOnly cookie     │                                │
     │                                                 │                                │
```

### 2. Token Refresh Flow

```
┌──────────┐                    ┌───────────┐                    ┌──────────┐
│ Frontend │                    │  Gateway  │                    │ Azure AD │
└────┬─────┘                    └─────┬─────┘                    └────┬─────┘
     │                                │                                │
     │ 1. Access token expired        │                                │
     │    (detected on API request)   │                                │
     │                                │                                │
     │ 2. Call refresh endpoint       │                                │
     ├───────────────────────────────>│                                │
     │     POST /auth/refresh         │                                │
     │                                │                                │
     │                                │ 3. Validate session exists     │
     │                                │                                │
     │                                │ 4. Get Azure AD refresh token  │
     │                                │    from session                │
     │                                │                                │
     │                                │ 5. Exchange refresh token      │
     │                                ├───────────────────────────────>│
     │                                │                                │
     │                                │ 6. Return new access token     │
     │                                │<───────────────────────────────┤
     │                                │                                │
     │                                │ 7. Update session with new     │
     │                                │    access token + expiry       │
     │                                │                                │
     │                                │ 8. Generate new JWT tokens     │
     │                                │                                │
     │ 9. Return new JWT tokens       │                                │
     │<───────────────────────────────┤                                │
     │                                │                                │
     │ 10. Update stored access token │                                │
     │                                │                                │
```

### 3. Logout Flow

```
┌──────────┐                    ┌───────────┐
│ Frontend │                    │  Gateway  │
└────┬─────┘                    └─────┬─────┘
     │                                │
     │ 1. User clicks logout          │
     ├───────────────────────────────>│
     │     POST /auth/logout          │
     │                                │
     │                                │ 2. Destroy session in Redis
     │                                │
     │                                │ 3. Clear session cookie
     │                                │
     │ 4. Return success              │
     │<───────────────────────────────┤
     │                                │
     │ 5. Clear local tokens          │
     │    Redirect to login page      │
     │                                │
```

## API Endpoints

### GET /auth/login

Initiates OAuth 2.0 authorization flow with Azure AD.

**Request:**

```http
GET /auth/login HTTP/1.1
Host: bojin-law.onrender.com
```

**Response:**

```http
HTTP/1.1 302 Found
Location: https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/authorize?
  client_id={client-id}
  &response_type=code
  &redirect_uri={redirect-uri}
  &scope=openid%20profile%20email%20User.Read
  &state={random-state}
  &code_challenge={code-challenge}
  &code_challenge_method=S256
```

**Behavior:**

1. Generates authorization URL with PKCE parameters
2. Stores PKCE session in Redis (15-minute TTL)
3. Redirects user to Azure AD login page

**Error Responses:**

```json
{
  "error": "oauth_error",
  "message": "Failed to initiate authentication flow"
}
```

---

### GET /auth/callback

Handles OAuth callback from Azure AD after user authentication.

**Request:**

```http
GET /auth/callback?code={authorization-code}&state={state} HTTP/1.1
Host: bojin-law.onrender.com
```

**Success Response (200 OK):**

```json
{
  "message": "Authentication successful",
  "user": {
    "id": "user-uuid",
    "email": "user@lawfirm.ro",
    "firstName": "John",
    "lastName": "Doe",
    "role": "Partner",
    "status": "Active",
    "firmId": "firm-uuid"
  },
  "tokens": {
    "accessToken": "jwt-access-token",
    "refreshToken": "jwt-refresh-token",
    "expiresIn": 1800
  }
}
```

**Error Responses:**

**Pending User (403 Forbidden):**

```json
{
  "error": "account_pending_activation",
  "message": "Your account is pending activation. Please contact your firm's partner for access.",
  "userEmail": "user@lawfirm.ro",
  "userStatus": "Pending"
}
```

**Inactive User (403 Forbidden):**

```json
{
  "error": "account_inactive",
  "message": "Your account has been deactivated. Please contact your administrator for assistance.",
  "userEmail": "user@lawfirm.ro",
  "userStatus": "Inactive"
}
```

**Invalid State (400 Bad Request):**

```json
{
  "error": "invalid_state",
  "message": "Authentication session expired or invalid. Please try again."
}
```

---

### POST /auth/refresh

Refreshes access token using Azure AD refresh token from session.

**Request:**

```http
POST /auth/refresh HTTP/1.1
Host: bojin-law.onrender.com
Cookie: sid=session-id
```

**Success Response (200 OK):**

```json
{
  "message": "Token refreshed successfully",
  "tokens": {
    "accessToken": "new-jwt-access-token",
    "refreshToken": "new-jwt-refresh-token",
    "expiresIn": 1800
  }
}
```

**Error Responses:**

**No Session (401 Unauthorized):**

```json
{
  "error": "session_not_found",
  "message": "Session not found. Please login again."
}
```

**Expired Refresh Token (401 Unauthorized):**

```json
{
  "error": "refresh_token_expired",
  "message": "Session expired. Please login again."
}
```

---

### POST /auth/logout

Logs out user by destroying session and clearing cookies.

**Request:**

```http
POST /auth/logout HTTP/1.1
Host: bojin-law.onrender.com
Cookie: sid=session-id
```

**Success Response (200 OK):**

```json
{
  "message": "Logged out successfully"
}
```

**Error Responses:**

**No Session (200 OK - Graceful):**

```json
{
  "message": "No active session found"
}
```

## JWT Token Structure

### Access Token (30-minute expiry)

JWT access tokens are used for API authentication and contain user identity claims.

**Claims:**

```json
{
  "iss": "https://bojin-law.onrender.com",
  "sub": "user-uuid",
  "aud": "bojin-law-api",
  "exp": 1234567890,
  "iat": 1234567890,
  "userId": "user-uuid",
  "email": "user@lawfirm.ro",
  "role": "Partner",
  "status": "Active",
  "firmId": "firm-uuid",
  "azureAdId": "azure-ad-user-id"
}
```

**Usage:**

```http
GET /api/cases HTTP/1.1
Authorization: Bearer {access-token}
```

### Refresh Token (7-day expiry)

Refresh tokens are used to obtain new access tokens without re-authentication.

**Claims:**

```json
{
  "iss": "https://bojin-law.onrender.com",
  "sub": "user-uuid",
  "aud": "bojin-law-api",
  "exp": 1234567890,
  "iat": 1234567890,
  "type": "refresh"
}
```

**Storage:**

- Access Token: In-memory (React state/context) - cleared on page refresh
- Refresh Token: httpOnly session cookie - inaccessible to JavaScript

**Security:**

- Algorithm: HS256 (HMAC-SHA256)
- Signature: Verified using `JWT_SECRET`
- Expiry: Strictly enforced (access: 30min, refresh: 7 days)

## Session Management

### Redis Session Structure

Sessions are stored in Redis with the following structure:

**Session Key Format:** `sess:{session-id}`

**Session Data (JSON):**

```json
{
  "userId": "user-uuid",
  "email": "user@lawfirm.ro",
  "role": "Partner",
  "status": "Active",
  "firmId": "firm-uuid",
  "azureAdId": "azure-ad-user-id",
  "accessToken": "azure-ad-access-token",
  "refreshToken": "azure-ad-refresh-token",
  "accessTokenExpiry": 1234567890,
  "createdAt": 1234567890,
  "lastActivity": 1234567890
}
```

**Configuration:**

- **TTL**: 7 days (604,800 seconds)
- **Cleanup**: Automatic via Redis TTL expiration
- **Storage**: Redis backend via `connect-redis`

### Session Cookie

**Name:** `sid` (session ID)

**Configuration:**

```javascript
{
  httpOnly: true,              // Prevent JavaScript access
  secure: true,                // HTTPS only (production)
  sameSite: 'strict',         // CSRF protection
  maxAge: 604800000           // 7 days in milliseconds
}
```

### Session Middleware

Protected routes can validate sessions using middleware:

```typescript
import { validateSession } from './middleware/session.middleware';

// Require valid session
router.get('/protected', validateSession, (req, res) => {
  const user = req.user; // User from session
});
```

## Role-Based Access Control

### User Roles

Three user roles are supported:

1. **Partner** - Full access to all features
   - Manage users (activate, deactivate, assign roles)
   - Manage cases, documents, tasks
   - View all firm data

2. **Associate** - Limited management access
   - Manage assigned cases and documents
   - Create tasks
   - View firm data

3. **Paralegal** - Execution access
   - View assigned cases and documents
   - Complete tasks
   - Limited data access

### Role Middleware

Protect routes by required roles:

```typescript
import { authenticateJWT, requireRole } from './middleware/auth.middleware';

// Partner-only endpoint
router.get('/admin/users', authenticateJWT, requireRole(['Partner']), (req, res) => {
  // Only Partners can access
});

// Partner or Associate endpoint
router.post('/cases', authenticateJWT, requireRole(['Partner', 'Associate']), (req, res) => {
  // Partners and Associates can access
});
```

### Status-Based Access

Users must have "Active" status to access the application:

```typescript
import { authenticateJWT, requireActiveUser } from './middleware/auth.middleware';

router.get('/dashboard', authenticateJWT, requireActiveUser, (req, res) => {
  // Only Active users can access
});
```

**Status Values:**

- **Pending**: New user awaiting Partner activation (no access)
- **Active**: User can access application
- **Inactive**: User deactivated by Partner (no access)

## User Provisioning

### First-Time Login

When a user signs in for the first time:

1. User authenticates with Azure AD
2. Profile extracted from ID token claims:
   - `oid` (Azure AD user ID) → `azureAdId`
   - `preferred_username` or `email` → `email`
   - `given_name` → `firstName`
   - `family_name` → `lastName`
3. User created in database with:
   - **Status**: `Pending` (awaiting activation)
   - **Role**: `Paralegal` (default, can be changed)
   - **Firm ID**: `null` (assigned during activation)
4. User blocked with 403 Forbidden message to contact Partner

### User Activation (Story 2.4.1)

Partners activate pending users via the Partner User Management UI:

1. View all pending users
2. Assign role (Partner, Associate, Paralegal)
3. Assign to firm
4. Set status to "Active"

Until Story 2.4.1 is implemented, user activation requires manual database updates:

```sql
UPDATE users
SET status = 'Active',
    role = 'Associate',
    firm_id = 'firm-uuid'
WHERE email = 'user@lawfirm.ro';
```

### Subsequent Logins

For existing users:

1. User found by `azureAdId` (unique)
2. `lastActive` timestamp updated
3. User status validated:
   - **Active** → Authentication succeeds
   - **Pending** → 403 Forbidden
   - **Inactive** → 403 Forbidden

## Troubleshooting

### Common Issues

#### 1. "Missing or invalid Authorization header"

**Cause:** Access token not included in API request

**Solution:**

```javascript
// Include Bearer token in Authorization header
fetch('/api/cases', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

---

#### 2. "Access token has expired. Please refresh your token."

**Cause:** Access token expired (30-minute lifetime)

**Solution:**

```javascript
// Call refresh endpoint to get new access token
const response = await fetch('/auth/refresh', {
  method: 'POST',
  credentials: 'include', // Include session cookie
});

const { tokens } = await response.json();
// Use new accessToken for subsequent requests
```

---

#### 3. "Your account is pending activation"

**Cause:** New user not yet activated by Partner

**Solution:**

- Contact your firm's Partner to activate your account
- Partners can activate users via Story 2.4.1 (Partner User Management UI)
- Temporary workaround: Manual database update (see User Provisioning)

---

#### 4. "Authentication session expired or invalid"

**Cause:** PKCE session expired or state mismatch

**Solution:**

- PKCE sessions have 15-minute TTL
- User took too long to authenticate
- Retry login flow from beginning

---

#### 5. "Session not found. Please login again."

**Cause:** Redis session expired or not found

**Solution:**

- Sessions expire after 7 days of inactivity
- User must re-authenticate via `/auth/login`
- Check Redis connectivity if persistent

---

#### 6. "Invalid signature" (JWT validation error)

**Cause:** JWT_SECRET mismatch or token tampered with

**Solution:**

- Verify `JWT_SECRET` matches value used to sign tokens
- Do not manually edit JWT tokens
- Re-authenticate to get fresh tokens

---

### Debugging Tips

#### Check Session in Redis

```bash
# Connect to Redis
redis-cli -u $REDIS_URL

# List all sessions
KEYS sess:*

# View specific session
GET sess:{session-id}

# Check session TTL
TTL sess:{session-id}
```

#### Decode JWT Token

```bash
# Decode JWT token (header + payload only, signature not verified)
echo "jwt-token" | cut -d. -f2 | base64 -d | jq
```

#### Check User Status in Database

```sql
SELECT id, email, role, status, firm_id, azure_ad_id, last_active
FROM users
WHERE email = 'user@lawfirm.ro';
```

#### Monitor Authentication Logs

```bash
# Gateway service logs
tail -f logs/gateway.log | grep -i "auth"

# Redis logs
tail -f logs/redis.log

# PostgreSQL logs
tail -f logs/postgresql.log
```

---

### Error Codes Reference

| Error Code                   | Status | Description                      | Solution                          |
| ---------------------------- | ------ | -------------------------------- | --------------------------------- |
| `unauthorized`               | 401    | Missing or invalid authorization | Include valid Bearer token        |
| `token_expired`              | 401    | Access token expired             | Call `/auth/refresh`              |
| `invalid_token`              | 401    | Token signature invalid          | Re-authenticate                   |
| `session_not_found`          | 401    | Redis session not found          | Re-authenticate                   |
| `refresh_token_expired`      | 401    | Refresh token expired            | Re-authenticate                   |
| `account_pending_activation` | 403    | User status is Pending           | Contact Partner for activation    |
| `account_inactive`           | 403    | User status is Inactive          | Contact administrator             |
| `forbidden`                  | 403    | Insufficient role permissions    | Request role upgrade from Partner |
| `invalid_state`              | 400    | OAuth state mismatch or expired  | Retry login flow                  |
| `oauth_error`                | 500    | OAuth flow initialization failed | Check Azure AD configuration      |
| `authentication_failed`      | 500    | General authentication error     | Check logs for details            |

---

## Security Considerations

### Token Storage

✅ **DO:**

- Store access tokens in memory (React state/context)
- Store refresh tokens in httpOnly cookies
- Clear tokens on page refresh/logout

❌ **DON'T:**

- Store tokens in localStorage (vulnerable to XSS)
- Store tokens in sessionStorage (vulnerable to XSS)
- Log tokens in console or error messages

### CSRF Protection

- `state` parameter in OAuth flow (random nonce)
- `sameSite=strict` on session cookies
- Verify `state` matches on callback

### PKCE (Proof Key for Code Exchange)

- Prevents authorization code interception attacks
- `code_verifier`: Random 43-128 character string
- `code_challenge`: SHA-256 hash of code verifier
- Required for all OAuth flows

### Rate Limiting (Future Enhancement)

Recommended rate limits:

- Login: 5 attempts per minute per IP
- Token refresh: 10 per minute per session
- Failed auth: Exponential backoff

---

## Testing

### Unit Tests

```bash
# Run all authentication tests
cd services/gateway
npm test

# Run specific test file
npm test -- __tests__/services/auth.service.test.ts

# Run with coverage
npm test -- --coverage
```

### Integration Tests

```bash
# Run integration tests
npm test -- __tests__/integration/

# Test specific flow
npm test -- __tests__/routes/auth.routes.test.ts
```

### E2E Tests (Task 20)

```bash
# Run Playwright tests
npx playwright test tests/e2e/auth.spec.ts

# Run in headed mode
npx playwright test --headed
```

---

## Related Documentation

- [Story 2.4: Authentication with Azure AD](../../docs/stories/2.4.story.md)
- [Story 2.4.1: Partner User Management](../../docs/stories/2.4.1.story.md)
- [Story 2.2: Cloud Infrastructure and Database Setup](../../docs/stories/2.2.story.md)
- [Azure AD OAuth 2.0 Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-20
**Author:** James (Dev Agent)
**Story:** 2.4 - Authentication with Azure AD
