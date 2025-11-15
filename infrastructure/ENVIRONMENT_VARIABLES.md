# Environment Variables for Legal Platform

## Overview

This document provides comprehensive documentation for all environment variables used in the Romanian Legal Practice Management Platform. The platform follows a monorepo architecture, so most variables are defined at the root level and shared across apps and services.

Environment variables are loaded using the `dotenv` package for local development and Azure Key Vault with managed identities for staging/production environments.

### Loading Strategy

- **Local Development**: `.env` file in project root, loaded via `dotenv.config()`
- **Docker**: Passed via `docker-compose.yml` environment section or `--env-file`
- **Kubernetes**: ConfigMaps for non-sensitive, Secrets for sensitive (integrated with Key Vault)
- **Azure DevOps**: Variable groups per environment (staging, production)
- **Production**: Azure Key Vault with CSI driver for Kubernetes pods

### Security Best Practices

- Never commit `.env` files (already in `.gitignore`)
- Use Azure Key Vault for all secrets in production
- Rotate secrets regularly via Azure AD and Key Vault policies
- Use managed identities for service-to-service authentication
- Validate required variables at startup

## Required Variables

These variables must be set for the application to start.

### Database Configuration

**DATABASE_URL**
- **Type**: string
- **Required**: Yes
- **Default**: None
- **Description**: Full PostgreSQL connection string for the main database.
- **Format**: `postgresql://username:password@host:port/database?sslmode=require`
- **Local Example**: `postgresql://postgres:postgres@localhost:5432/legal_platform`
- **Production**: Azure Database for PostgreSQL Flexible Server connection string
- **Validation**: Must connect successfully at startup

**DATABASE_POOL_MIN**
- **Type**: integer
- **Required**: No
- **Default**: 2
- **Description**: Minimum connections in the database pool.
- **Range**: 1-20

**DATABASE_POOL_MAX**
- **Type**: integer
- **Required**: No
- **Default**: 10
- **Description**: Maximum connections in the database pool.
- **Range**: 5-50 (adjust based on AKS node count)

### Cache Configuration

**REDIS_URL**
- **Type**: string
- **Required**: Yes
- **Default**: None
- **Description**: Redis connection string for caching and sessions.
- **Format**: `redis://[[username][:password]@][host][:port][/db-number]`
- **Local Example**: `redis://localhost:6379`
- **Production**: Azure Cache for Redis Premium tier endpoint

**REDIS_SESSION_PREFIX**
- **Type**: string
- **Required**: No
- **Default**: `legal_platform:session:`
- **Description**: Prefix for session keys in Redis.

**REDIS_SESSION_TTL**
- **Type**: integer
- **Required**: No
- **Default**: 86400 (24 hours)
- **Description**: Session TTL in seconds.

### Authentication & Microsoft 365 Integration

**AZURE_AD_CLIENT_ID**
- **Type**: string
- **Required**: Yes
- **Default**: None
- **Description**: Azure AD Application (Client) ID for SSO and Microsoft 365 integration.
- **Source**: Azure Portal > App Registrations

**AZURE_AD_TENANT_ID**
- **Type**: string
- **Required**: Yes
- **Default**: None
- **Description**: Azure AD Tenant (Directory) ID.
- **Source**: Azure Portal > Azure Active Directory > Overview

**AZURE_AD_CLIENT_SECRET**
- **Type**: string
- **Required**: Yes (local), No (production with certs)
- **Default**: None
- **Description**: Client secret for Azure AD app. Use certificate authentication in production.
- **Security**: Store in Azure Key Vault

**AZURE_AD_REDIRECT_URI**
- **Type**: string
- **Required**: Yes
- **Default**: `http://localhost:3000/api/auth/callback`
- **Description**: Redirect URI registered in Azure AD app.
- **Production**: `https://yourdomain.com/api/auth/callback`

**MS_GRAPH_SCOPES**
- **Type**: string (space-separated)
- **Required**: No
- **Default**: `User.Read Calendars.ReadWrite Mail.ReadWrite Files.ReadWrite.All`
- **Description**: Microsoft Graph API scopes for the application.

### API & Frontend Configuration

**NEXT_PUBLIC_APP_URL**
- **Type**: string
- **Required**: Yes
- **Default**: `http://localhost:3000`
- **Description**: Base URL for the frontend application (used for links and redirects).
- **Production**: `https://app.legal-platform.ro`

**NEXT_PUBLIC_API_URL**
- **Type**: string
- **Required**: Yes
- **Default**: `http://localhost:3000/api/graphql`
- **Description**: Base URL for GraphQL API endpoint.

**API_RATE_LIMIT_WINDOW_MS**
- **Type**: integer
- **Required**: No
- **Default**: 60000 (1 minute)
- **Description**: Rate limiting window in milliseconds.

**API_RATE_LIMIT_MAX_REQUESTS**
- **Type**: integer
- **Required**: No
- **Default**: 100
- **Description**: Maximum requests per window per IP.

### AI Service Configuration

**CLAUDE_API_KEY**
- **Type**: string
- **Required**: Yes
- **Default**: None
- **Description**: Anthropic Claude API key for AI features (document drafting, semantic search).
- **Source**: https://console.anthropic.com/
- **Security**: Store in Azure Key Vault

**CLAUDE_MODEL**
- **Type**: string
- **Required**: No
- **Default**: `claude-sonnet-4-5-20250929`
- **Description**: Claude model to use for AI tasks.

**CLAUDE_MAX_TOKENS**
- **Type**: integer
- **Required**: No
- **Default**: 4096
- **Description**: Maximum tokens for AI responses.

### Storage Configuration

**AZURE_STORAGE_ACCOUNT_NAME**
- **Type**: string
- **Required**: Yes
- **Default**: None
- **Description**: Azure Storage account name for document storage.

**AZURE_STORAGE_ACCOUNT_KEY**
- **Type**: string
- **Required**: Yes (local), No (production with SAS)
- **Default**: None
- **Description**: Storage account access key.
- **Security**: Use shared access signatures (SAS) in production

**AZURE_STORAGE_CONTAINER_NAME**
- **Type**: string
- **Required**: No
- **Default**: `legal-documents`
- **Description**: Blob container for legal documents.

### Security & Sessions

**SESSION_SECRET**
- **Type**: string
- **Required**: Yes
- **Default**: None
- **Description**: Secret for signing session cookies.
- **Generation**: `openssl rand -base64 32`
- **Security**: Rotate regularly

**JWT_SECRET**
- **Type**: string
- **Required**: Yes
- **Default**: None
- **Description**: Secret for signing JWT tokens.
- **Generation**: `openssl rand -base64 32`

**JWT_EXPIRATION**
- **Type**: integer
- **Required**: No
- **Default**: 3600 (1 hour)
- **Description**: JWT token expiration in seconds.

**CORS_ORIGINS**
- **Type**: string (comma-separated)
- **Required**: No
- **Default**: `http://localhost:3000,http://localhost:6006`
- **Description**: Allowed origins for CORS.

### Logging & Monitoring

**LOG_LEVEL**
- **Type**: string
- **Required**: No
- **Default**: `debug`
- **Valid Values**: `error`, `warn`, `info`, `debug`
- **Description**: Winston logger level.

**APPLICATIONINSIGHTS_CONNECTION_STRING**
- **Type**: string
- **Required**: No
- **Default**: Empty
- **Description**: Azure Application Insights connection string.
- **Production**: Required for APM and logging.

### Feature Flags

**FEATURE_AI_DOCUMENT_DRAFTING**
- **Type**: boolean
- **Required**: No
- **Default**: true
- **Description**: Enable AI-powered document drafting.

**FEATURE_SEMANTIC_SEARCH**
- **Type**: boolean
- **Required**: No
- **Default**: true
- **Description**: Enable pgvector semantic search.

**FEATURE_MS365_INTEGRATION**
- **Type**: boolean
- **Required**: No
- **Default**: true
- **Description**: Enable Microsoft 365 integration.

**FEATURE_REAL_TIME_COLLABORATION**
- **Type**: boolean
- **Required**: No
- **Default**: false
- **Description**: Enable real-time collaboration (future feature).

### Development Tools

**DEBUG**
- **Type**: boolean
- **Required**: No
- **Default**: false
- **Description**: Enable debug mode for development.

**ENABLE_SOURCE_MAPS**
- **Type**: boolean
- **Required**: No
- **Default**: false
- **Description**: Enable source maps in production (security risk).

**STORYBOOK_PORT**
- **Type**: integer
- **Required**: No
- **Default**: 6006
- **Description**: Port for Storybook in development.

## Service-Specific Variables

### AI Service

- **AI_SERVICE_BASE_URL**: Internal URL for AI service microservice
- **AI_TOKEN_USAGE_TRACKING**: Enable token usage logging (default: true)

### Document Service

- **DOCUMENT_VERSIONING_ENABLED**: Enable semantic version control (default: true)
- **DOCUMENT_MAX_SIZE_MB**: Maximum document upload size (default: 50)

### Task Service

- **TASK_WORKFLOW_ENGINE**: Workflow engine type (default: 'simple')

### Integration Service (Microsoft 365)

- **MS365_POLLING_INTERVAL_MIN**: Polling interval for email/calendar sync (default: 5)

## Validation Script

Use `scripts/validate-env.sh` to check required variables at startup:

```bash
#!/bin/bash
set -e

required_vars=(
  DATABASE_URL
  REDIS_URL
  AZURE_AD_CLIENT_ID
  AZURE_AD_TENANT_ID
  AZURE_AD_CLIENT_SECRET
  SESSION_SECRET
  JWT_SECRET
  CLAUDE_API_KEY
  AZURE_STORAGE_ACCOUNT_NAME
  AZURE_STORAGE_ACCOUNT_KEY
)

missing_vars=()

for var in \"${required_vars[@]}\"; do
  if [ -z \"${!var}\" ]; then
    missing_vars+=(\"$var\")
  fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
  echo \"Error: Missing required environment variables:\"
  for var in \"${missing_vars[@]}\"; do
    echo \"  - $var\"
  done
  exit 1
fi

echo \"All required environment variables are set.\"
```

## Production Deployment Notes

- All secrets are fetched from Azure Key Vault using managed identities
- Non-sensitive variables (e.g., NODE_ENV, feature flags) in ConfigMaps
- Use Azure DevOps variable groups for pipeline injection
- Enable Azure Monitor for environment variable usage auditing

## Troubleshooting

- **Connection Errors**: Verify DATABASE_URL and REDIS_URL formats
- **Auth Failures**: Check AZURE_AD_CLIENT_SECRET rotation and permissions
- **AI Errors**: Validate CLAUDE_API_KEY permissions and rate limits
- **Storage Issues**: Ensure AZURE_STORAGE_ACCOUNT_KEY has correct permissions

**Last Updated**: 2025-11-15 (Story 2.1)
**Version**: 1.0