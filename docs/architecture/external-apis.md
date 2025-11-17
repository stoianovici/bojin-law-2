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

## Anthropic Claude API (PRIMARY PROVIDER)

- **Status:** PRIMARY - All AI operations use Claude by default
- **Purpose:** Primary LLM provider for document generation, legal analysis, natural language processing
- **Documentation:** https://docs.anthropic.com/claude/reference/
- **Base URL(s):** https://api.anthropic.com/v1
- **Authentication:** API key in X-API-Key header
- **Rate Limits:**
  - Claude 3 Haiku: 1000 requests/min, 100K tokens/min
  - Claude 3.5 Sonnet: 200 requests/min, 40K tokens/min
  - Claude 3 Opus: 50 requests/min, 10K tokens/min

**Key Features:**

- **Skills API (Beta):** 70% token reduction for repetitive tasks
- **Prompt Caching:** 90% cost reduction on cached content
- **Batch API:** 50% discount for non-urgent requests
- **200K Context Window:** Handles large legal documents

**Key Endpoints:**

- `POST /messages` - Send messages with optional skills
- `POST /messages/batch` - Batch processing for cost optimization
- `POST /skills/upload` - Upload custom legal skills
- `POST /skills/execute` - Execute specific skills

## Claude Skills API (BETA)

- **Purpose:** Specialized tools for 70% token reduction on legal workflows
- **Documentation:** https://docs.anthropic.com/claude/skills
- **Base URL(s):** https://api.anthropic.com/v1/skills
- **Authentication:** Same as Claude API with beta flag enabled
- **Available Skills:**
  - Contract Analysis - Extract terms, identify risks
  - Document Drafting - Generate from templates
  - Legal Research - Search case law and statutes
  - Compliance Check - Validate against regulations

## xAI Grok API (FALLBACK PROVIDER)

- **Status:** FALLBACK - Used when Claude is unavailable
- **Purpose:** Backup LLM provider for general queries and real-time information
- **Documentation:** https://docs.x.ai/api
- **Base URL(s):** https://api.x.ai/v1
- **Authentication:** API key in Authorization header
- **Rate Limits:** 100 requests/min, 20K tokens/min
- **Key Features:** Access to real-time X (Twitter) data

**Key Endpoints:**

- `POST /chat/completions` - Generate text responses
- `GET /models` - List available models

## Voyage AI API (Embeddings)

- **Purpose:** High-quality embeddings for semantic search and document similarity
- **Documentation:** https://docs.voyageai.com/
- **Base URL(s):** https://api.voyageai.com/v1
- **Authentication:** Bearer token with API key
- **Rate Limits:** 300 requests/min
- **Models Used:** voyage-large-2 (best quality for legal documents)

**Key Endpoints:**

- `POST /embeddings` - Generate embeddings for text

## OpenAI API (DEPRECATED)

- **Status:** DEPRECATED - Do not use for new features
- **Purpose:** Legacy support only, migrating to Claude/Grok
- **Migration:** All OpenAI calls should be replaced with Claude API
- **Sunset Date:** Q2 2026
- **Documentation:** https://platform.openai.com/docs/api-reference
- **Note:** 40% more expensive than Claude for comparable performance

[Additional external APIs continue...]
