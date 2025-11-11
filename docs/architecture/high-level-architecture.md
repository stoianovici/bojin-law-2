# High Level Architecture

## Technical Summary

Romanian Legal Practice Management Platform employs a **microservices-within-monorepo architecture** deployed on **Azure cloud infrastructure** to ensure optimal integration with Microsoft 365 services. The frontend utilizes **Next.js 14+ with React 18** for server-side rendering and optimal performance, while the backend leverages **Node.js with TypeScript** orchestrating services through **Apollo GraphQL** with WebSocket support for real-time features. Key integration points include the **GraphQL API layer** serving as the unified interface between frontend and backend services, **Microsoft Graph API** for seamless Outlook/OneDrive/Calendar synchronization, and **AI orchestration service** coordinating multiple LLM providers (Claude primary, GPT-4 fallback) for intelligent document drafting and natural language processing. The platform is deployed using **Azure Kubernetes Service (AKS)** with services containerized via Docker, utilizing **Azure Blob Storage** for documents, **PostgreSQL with pgvector** for semantic search, and **Redis** for caching and session management, achieving the PRD goals of 2+ hour daily time savings through AI automation while maintaining 99.9% uptime and sub-2-second page loads.

## Platform and Infrastructure Choice

**Platform:** Azure
**Key Services:** AKS, Azure Database for PostgreSQL (with pgvector), Azure Blob Storage, Azure Redis Cache, Azure AD, Application Insights
**Deployment Host and Regions:** Primary: West Europe (Amsterdam), Secondary: North Europe (Stockholm) for disaster recovery

## Repository Structure

**Structure:** Monorepo (as specified in PRD)
**Monorepo Tool:** Turborepo (optimal for Next.js projects, excellent caching, parallel execution)
**Package Organization:**
- `/apps` - Deployable applications (web frontend, API backend, admin portal)
- `/packages` - Shared code (UI components, TypeScript types, utilities, AI prompts)
- `/services` - Microservices (document-service, task-service, ai-service, integration-service, notification-service)

## High Level Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        Mobile[Future Mobile]
    end

    subgraph "CDN & Edge"
        CDN[Azure CDN]
        WAF[Web Application Firewall]
    end

    subgraph "Application Layer - AKS Cluster"
        subgraph "Frontend"
            NextJS[Next.js App<br/>SSR + React]
        end

        subgraph "API Gateway"
            GraphQL[Apollo GraphQL Server<br/>+ WebSockets]
        end

        subgraph "Microservices"
            DocService[Document Service]
            TaskService[Task Service]
            AIService[AI Service]
            IntegrationService[Integration Service]
            NotificationService[Notification Service]
        end
    end

    subgraph "Data Layer"
        PostgreSQL[(PostgreSQL<br/>+ pgvector)]
        Redis[(Redis Cache)]
        BlobStorage[Azure Blob Storage]
    end

    subgraph "External Services"
        MS365[Microsoft 365<br/>Graph API]
        Claude[Anthropic Claude API]
        OpenAI[OpenAI GPT-4<br/>Fallback]
        Email[SendGrid/SES]
    end

    Browser --> CDN
    Mobile --> CDN
    CDN --> WAF
    WAF --> NextJS
    NextJS --> GraphQL
    GraphQL --> DocService
    GraphQL --> TaskService
    GraphQL --> AIService
    GraphQL --> IntegrationService
    GraphQL --> NotificationService

    DocService --> PostgreSQL
    DocService --> BlobStorage
    TaskService --> PostgreSQL
    AIService --> Claude
    AIService --> OpenAI
    AIService --> Redis
    IntegrationService --> MS365
    NotificationService --> Email
    NotificationService --> PostgreSQL

    All services --> Redis
```

## Architectural Patterns

- **Jamstack Architecture:** Static site generation with serverless APIs where possible - _Rationale:_ Optimal performance for dashboard and static content while maintaining dynamic capabilities through API routes
- **Microservices within Monorepo:** Domain-driven service separation with shared codebase - _Rationale:_ Balances modularity with development efficiency, avoiding over-engineering for a small team
- **Backend for Frontend (BFF):** GraphQL layer tailored for frontend needs - _Rationale:_ Optimizes data fetching, reduces over-fetching, and provides real-time subscriptions for collaborative features
- **Event-Driven Communication:** Services communicate via events for loose coupling - _Rationale:_ Enables scalability and allows services to evolve independently
- **Repository Pattern:** Abstract data access logic in each service - _Rationale:_ Enables testing and potential future database migrations
- **CQRS for AI Operations:** Separate read/write paths for AI-heavy operations - _Rationale:_ Optimizes performance by separating complex AI processing from simple queries
- **Circuit Breaker Pattern:** For external API calls (MS365, LLMs) - _Rationale:_ Prevents cascading failures when external services are unavailable
- **Atomic Design for Components:** Atoms, molecules, organisms component structure - _Rationale:_ Ensures consistent UI and maximizes component reusability
