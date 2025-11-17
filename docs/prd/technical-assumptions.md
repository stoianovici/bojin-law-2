# Technical Assumptions

## Repository Structure: Monorepo

We will use a monorepo structure to maintain all services and packages in a single repository, enabling better code sharing, consistent tooling, and simplified dependency management across the platform. This approach supports our microservices architecture while keeping deployment and versioning manageable for a small team.

## Service Architecture

**CRITICAL DECISION** - The platform will use a **Microservices within Monorepo** architecture, with services separated by domain but not over-engineered:

- **Document Service:** Handles all document operations, versioning, and Word integration
- **Task Service:** Manages task lifecycle, dependencies, and automated workflows
- **AI Service:** Coordinates LLM interactions, prompt management, and response caching
- **Integration Service:** Microsoft 365 synchronization and webhook management
- **Notification Service:** Email, in-app, and future push notifications

Services communicate via GraphQL API (Apollo Server) with WebSocket support for real-time features. Each service can be independently scaled based on load patterns.

## Testing Requirements

**CRITICAL DECISION** - We will implement a **Full Testing Pyramid** approach:

- **Unit Tests:** Jest for business logic with 80% coverage target
- **Integration Tests:** Testing API endpoints and service interactions
- **E2E Tests:** Playwright for critical user journeys (login, document creation, task management)
- **AI Testing:** Dedicated test suite for prompt consistency and response quality
- **Manual Testing Conveniences:** Seed data scripts and test account management for QA

## Additional Technical Assumptions and Requests

**Frontend Stack:**

- Next.js 14+ with React 18 for optimal performance and SEO
- Tailwind CSS with Radix UI for accessible, customizable components
- Zustand for client state + React Query for server state management
- TypeScript throughout for type safety

**Backend Stack:**

- Node.js with TypeScript for consistency across stack
- GraphQL with Apollo Server for flexible data fetching
- BullMQ with Redis for background job processing
- Prisma ORM for database management

**Database Architecture:**

- PostgreSQL with pgvector extension for semantic search
- Redis for session management and caching
- OneDrive for document storage (primary integration with Microsoft 365)
- PostgreSQL full-text search (simpler deployment on Render)

**AI Infrastructure:**

- Anthropic Claude as primary LLM (3.5 Haiku for simple, 3.5 Sonnet for standard, 4.1 Opus for complex)
- xAI Grok as fallback provider (automatic failover if Claude unavailable)
- Prompt Caching enabled for 90% cost reduction on repeated prompts
- Batch API enabled for 50% cost reduction on non-real-time tasks
- Smart model selection based on task complexity (60% Haiku, 35% Sonnet, 5% Opus target distribution)
- LangChain for prompt management and complex reasoning chains
- Token usage tracking per user/feature for cost management
- Target AI costs: $126/month (100 users) with full optimization vs $1,260/month without

**Deployment & Infrastructure:**

- Render.com PaaS for simplified deployment and 83% cost savings vs Azure
- Docker containers with auto-scaling and zero-downtime deployments
- GitHub Actions + Render Deploy Hooks for CI/CD pipeline
- Render native monitoring + New Relic free tier for APM
- Target infrastructure costs: $207/month production (vs $1,189/month on Azure)

**Integration Requirements:**

- Microsoft Graph API for full Outlook/OneDrive/Calendar access
- OAuth 2.0 with Azure AD for enterprise SSO (authentication only, not hosting)
- Webhook support for real-time Microsoft 365 updates
- Rate limiting with intelligent request queuing

**Security & Compliance:**

- All data stored in EU data centers (GDPR compliance)
- AES-256 encryption at rest, TLS 1.3 in transit
- Row-level security in PostgreSQL for data isolation
- Complete audit logging for legal compliance

**Performance Targets:**

- Page loads under 2 seconds
- AI responses under 5 seconds
- Support 100+ concurrent users per firm
- 99.9% uptime during business hours
