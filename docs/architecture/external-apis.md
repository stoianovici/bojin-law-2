# External APIs

## Microsoft Graph API
- **Purpose:** Core integration for Microsoft 365 services including Outlook email, Calendar, OneDrive file storage, and Azure AD authentication
- **Documentation:** https://docs.microsoft.com/en-us/graph/
- **Base URL(s):** https://graph.microsoft.com/v1.0
- **Authentication:** OAuth 2.0 with application and delegated permissions
- **Rate Limits:** 10,000 requests per 10 minutes per app

**Key Endpoints Used:**
- `GET /me` - Get current user profile
- `GET /users/{id}` - Retrieve user information
- `GET/POST /me/messages` - Read and send emails
- `POST /subscriptions` - Create webhooks for email changes
- `GET/PUT /drives/{drive-id}/items/{item-id}` - OneDrive file operations

## Anthropic Claude API
- **Purpose:** Primary LLM provider for document generation, natural language processing
- **Documentation:** https://docs.anthropic.com/claude/reference/
- **Base URL(s):** https://api.anthropic.com/v1
- **Authentication:** API key in X-API-Key header
- **Rate Limits:** Varies by tier - Enterprise tier provides 10,000 requests/minute

## OpenAI API
- **Purpose:** Fallback LLM provider, specialized embeddings for semantic search
- **Documentation:** https://platform.openai.com/docs/api-reference
- **Base URL(s):** https://api.openai.com/v1
- **Authentication:** Bearer token with API key
- **Rate Limits:** 10,000 requests/min for GPT-4

[Additional external APIs continue...]
