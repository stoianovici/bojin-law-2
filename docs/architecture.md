# Romanian Legal Practice Management Platform - Full-Stack Architecture Document

## Introduction

This document outlines the complete fullstack architecture for **Romanian Legal Practice Management Platform**, including backend systems, frontend implementation, and their integration. It serves as the single source of truth for AI-driven development, ensuring consistency across the entire technology stack.

This unified approach combines what would traditionally be separate backend and frontend architecture documents, streamlining the development process for modern fullstack applications where these concerns are increasingly intertwined.

### Starter Template or Existing Project

Based on reviewing the PRD, I see:

- **Repository Structure:** Monorepo specified (PRD line 127)
- **Service Architecture:** Microservices within Monorepo (PRD lines 133-138)
- No specific starter template is mentioned - this appears to be a greenfield project

### Change Log

| Date     | Version | Description                                                | Author              |
| -------- | ------- | ---------------------------------------------------------- | ------------------- |
| Nov 2024 | 1.0     | Initial architecture document created from PRD and UI spec | Winston (Architect) |

## High Level Architecture

### Technical Summary

Romanian Legal Practice Management Platform employs a **microservices-within-monorepo architecture** deployed on **Azure cloud infrastructure** to ensure optimal integration with Microsoft 365 services. The frontend utilizes **Next.js 14+ with React 18** for server-side rendering and optimal performance, while the backend leverages **Node.js with TypeScript** orchestrating services through **Apollo GraphQL** with WebSocket support for real-time features. Key integration points include the **GraphQL API layer** serving as the unified interface between frontend and backend services, **Microsoft Graph API** for seamless Outlook/OneDrive/Calendar synchronization, and **AI orchestration service** coordinating multiple LLM providers (Claude primary, GPT-4 fallback) for intelligent document drafting and natural language processing. The platform is deployed using **Azure Kubernetes Service (AKS)** with services containerized via Docker, utilizing **Azure Blob Storage** for documents, **PostgreSQL with pgvector** for semantic search, and **Redis** for caching and session management, achieving the PRD goals of 2+ hour daily time savings through AI automation while maintaining 99.9% uptime and sub-2-second page loads.

### Platform and Infrastructure Choice

**Platform:** Azure
**Key Services:** AKS, Azure Database for PostgreSQL (with pgvector), Azure Blob Storage, Azure Redis Cache, Azure AD, Application Insights
**Deployment Host and Regions:** Primary: West Europe (Amsterdam), Secondary: North Europe (Stockholm) for disaster recovery

### Repository Structure

**Structure:** Monorepo (as specified in PRD)
**Monorepo Tool:** Turborepo (optimal for Next.js projects, excellent caching, parallel execution)
**Package Organization:**

- `/apps` - Deployable applications (web frontend, API backend, admin portal)
- `/packages` - Shared code (UI components, TypeScript types, utilities, AI prompts)
- `/services` - Microservices (document-service, task-service, ai-service, integration-service, notification-service)

### High Level Architecture Diagram

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

### Architectural Patterns

- **Jamstack Architecture:** Static site generation with serverless APIs where possible - _Rationale:_ Optimal performance for dashboard and static content while maintaining dynamic capabilities through API routes
- **Microservices within Monorepo:** Domain-driven service separation with shared codebase - _Rationale:_ Balances modularity with development efficiency, avoiding over-engineering for a small team
- **Backend for Frontend (BFF):** GraphQL layer tailored for frontend needs - _Rationale:_ Optimizes data fetching, reduces over-fetching, and provides real-time subscriptions for collaborative features
- **Event-Driven Communication:** Services communicate via events for loose coupling - _Rationale:_ Enables scalability and allows services to evolve independently
- **Repository Pattern:** Abstract data access logic in each service - _Rationale:_ Enables testing and potential future database migrations
- **CQRS for AI Operations:** Separate read/write paths for AI-heavy operations - _Rationale:_ Optimizes performance by separating complex AI processing from simple queries
- **Circuit Breaker Pattern:** For external API calls (MS365, LLMs) - _Rationale:_ Prevents cascading failures when external services are unavailable
- **Atomic Design for Components:** Atoms, molecules, organisms component structure - _Rationale:_ Ensures consistent UI and maximizes component reusability

## Tech Stack

### Technology Stack Table

| Category             | Technology                    | Version                        | Purpose                                       | Rationale                                                                                  |
| -------------------- | ----------------------------- | ------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Frontend Language    | TypeScript                    | 5.3+                           | Type-safe frontend development                | Prevents runtime errors, improves IDE support, essential for large-scale application       |
| Frontend Framework   | Next.js                       | 14.2+                          | React framework with SSR/SSG                  | Optimal performance, SEO benefits, excellent Azure deployment support, built-in API routes |
| UI Component Library | Radix UI + Tailwind CSS       | Radix 1.1+, Tailwind 3.4+      | Accessible components + utility-first styling | WCAG AA compliance out-of-box, rapid development, smaller bundle than MUI                  |
| State Management     | Zustand + React Query         | Zustand 4.5+, React Query 5.0+ | Client state + Server state                   | Simpler than Redux, excellent TypeScript support, optimal cache management                 |
| Backend Language     | TypeScript                    | 5.3+                           | Type-safe backend development                 | Code sharing with frontend, prevents runtime errors, excellent ecosystem                   |
| Backend Framework    | Node.js + Express             | Node 20 LTS, Express 4.19+     | Runtime and web framework                     | Consistency with frontend, extensive middleware ecosystem, GraphQL integration             |
| API Style            | GraphQL                       | Apollo Server 4.9+             | Flexible data fetching                        | Complex nested data requirements, real-time subscriptions, reduces over-fetching           |
| Database             | PostgreSQL + pgvector         | PostgreSQL 16, pgvector 0.5+   | Relational data + vector search               | ACID compliance for legal data, semantic search capability, single database solution       |
| Cache                | Redis                         | 7.2+                           | Session management + caching                  | Fast session storage, API response caching, real-time data synchronization                 |
| File Storage         | Azure Blob Storage            | Latest SDK                     | Document storage                              | Native Azure integration, cost-effective, supports large files, geo-redundancy             |
| Authentication       | Azure AD + JWT                | MSAL 3.0+                      | Enterprise SSO + token auth                   | Native Microsoft 365 integration, enterprise-grade security, role-based access             |
| Frontend Testing     | Jest + React Testing Library  | Jest 29+, RTL 14+              | Unit and integration testing                  | Excellent React ecosystem support, fast execution, good coverage reporting                 |
| Backend Testing      | Jest + Supertest              | Jest 29+, Supertest 6.3+       | API and unit testing                          | Consistent with frontend, excellent async support, GraphQL testing capability              |
| E2E Testing          | Playwright                    | 1.41+                          | End-to-end testing                            | Cross-browser support, excellent debugging, faster than Cypress, Azure DevOps integration  |
| Build Tool           | Vite                          | 5.0+                           | Frontend bundling                             | Faster than Webpack, excellent HMR, optimized production builds                            |
| Bundler              | Rollup (via Vite)             | Included with Vite             | Module bundling                               | Tree-shaking, code-splitting, optimal bundle size                                          |
| IaC Tool             | Terraform                     | 1.7+                           | Infrastructure as Code                        | Azure provider support, state management, modular infrastructure                           |
| CI/CD                | GitHub Actions + Azure DevOps | Latest                         | Automation pipeline                           | GitHub integration for code, Azure DevOps for deployment, comprehensive automation         |
| Monitoring           | Application Insights          | Latest SDK                     | APM and logging                               | Native Azure integration, excellent performance tracking, AI-powered insights              |
| Logging              | Winston + App Insights        | Winston 3.11+                  | Structured logging                            | Flexible log levels, multiple transports, Azure integration                                |
| CSS Framework        | Tailwind CSS                  | 3.4+                           | Utility-first CSS                             | Rapid development, consistent spacing, excellent tree-shaking, dark mode support           |

## Data Models

### User

**Purpose:** Represents legal professionals using the system with role-based access control

**Key Attributes:**

- id: UUID - Unique identifier from Azure AD
- email: string - Primary email address
- firstName: string - User's first name
- lastName: string - User's last name
- role: UserRole - Partner | Associate | Paralegal
- firmId: UUID - Associated law firm
- azureAdId: string - Microsoft 365 identity
- preferences: UserPreferences - AI behavior, UI settings
- createdAt: DateTime - Account creation timestamp
- lastActive: DateTime - Last activity timestamp

#### TypeScript Interface

```typescript
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'Partner' | 'Associate' | 'Paralegal';
  firmId: string;
  azureAdId: string;
  preferences: UserPreferences;
  createdAt: Date;
  lastActive: Date;
}

export interface UserPreferences {
  language: 'ro' | 'en';
  aiSuggestionLevel: 'aggressive' | 'moderate' | 'minimal';
  emailDigestFrequency: 'realtime' | 'hourly' | 'daily';
  dashboardLayout: Record<string, any>;
  timeZone: string;
}
```

#### Relationships

- Has many Cases (through CaseTeam)
- Has many Tasks (as assignee)
- Has many TimeEntries
- Has many Documents (as author)
- Belongs to one Firm

### Case

**Purpose:** Core legal matter entity containing all related information and documents

**Key Attributes:**

- id: UUID - Unique case identifier
- caseNumber: string - Human-readable case number
- title: string - Case title/name
- clientId: UUID - Associated client
- status: CaseStatus - Active | OnHold | Closed | Archived
- type: CaseType - Litigation | Contract | Advisory | Criminal | Other
- description: Text - Detailed case description
- openedDate: Date - Case start date
- closedDate: Date? - Case closure date (nullable)
- value: Decimal? - Monetary value if applicable
- metadata: JSONB - Flexible additional data

#### TypeScript Interface

```typescript
export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  clientId: string;
  status: 'Active' | 'OnHold' | 'Closed' | 'Archived';
  type: 'Litigation' | 'Contract' | 'Advisory' | 'Criminal' | 'Other';
  description: string;
  openedDate: Date;
  closedDate?: Date;
  value?: number;
  metadata?: Record<string, any>;
  // Computed fields from relations
  teamMembers?: User[];
  client?: Client;
  documents?: Document[];
  tasks?: Task[];
}
```

#### Relationships

- Belongs to one Client
- Has many Users (through CaseTeam)
- Has many Documents
- Has many Tasks
- Has many Communications
- Has many TimeEntries

### Document

**Purpose:** Legal documents with AI-powered versioning and semantic change tracking

**Key Attributes:**

- id: UUID - Unique document identifier
- caseId: UUID - Associated case
- title: string - Document title
- type: DocumentType - Contract | Motion | Letter | Memo | Other
- currentVersion: number - Latest version number
- status: DocumentStatus - Draft | Review | Approved | Filed
- oneDriveId: string? - Microsoft OneDrive file ID
- blobStorageUrl: string - Azure Blob Storage URL
- aiGenerated: boolean - Whether AI created initial draft
- templateId: UUID? - Source template if applicable
- createdBy: UUID - Author user ID
- documentEmbedding: vector - Semantic search embedding

#### TypeScript Interface

```typescript
export interface Document {
  id: string;
  caseId: string;
  title: string;
  type: 'Contract' | 'Motion' | 'Letter' | 'Memo' | 'Pleading' | 'Other';
  currentVersion: number;
  status: 'Draft' | 'Review' | 'Approved' | 'Filed';
  oneDriveId?: string;
  blobStorageUrl: string;
  aiGenerated: boolean;
  templateId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  versions?: DocumentVersion[];
  case?: Case;
  author?: User;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  content: string;
  semanticChanges?: SemanticChange[];
  createdBy: string;
  createdAt: Date;
  changesSummary: string;
  riskLevel: 'Low' | 'Medium' | 'High';
}
```

#### Relationships

- Belongs to one Case
- Has many DocumentVersions
- Belongs to one User (author)
- May belong to one Template

[Additional data models continue with Task, Communication, TimeEntry, and Client following the same pattern...]

## API Specification

### GraphQL Schema

```graphql
# Scalar types for custom data
scalar DateTime
scalar UUID
scalar JSON
scalar Vector

# Enums
enum UserRole {
  PARTNER
  ASSOCIATE
  PARALEGAL
}

enum CaseStatus {
  ACTIVE
  ON_HOLD
  CLOSED
  ARCHIVED
}

enum DocumentType {
  CONTRACT
  MOTION
  LETTER
  MEMO
  PLEADING
  OTHER
}

enum TaskType {
  RESEARCH
  DOCUMENT_CREATION
  DOCUMENT_RETRIEVAL
  COURT_DATE
  MEETING
  BUSINESS_TRIP
}

# Input Types
input CreateCaseInput {
  title: String!
  clientId: UUID!
  type: CaseType!
  description: String!
  value: Float
  metadata: JSON
}

input CreateDocumentInput {
  caseId: UUID!
  title: String!
  type: DocumentType!
  content: String
  templateId: UUID
  aiPrompt: String
}

input NaturalLanguageTaskInput {
  text: String!
  caseId: UUID
  suggestedAssignee: UUID
}

# Types
type User {
  id: UUID!
  email: String!
  firstName: String!
  lastName: String!
  role: UserRole!
  firmId: UUID!
  preferences: UserPreferences!
  createdAt: DateTime!
  lastActive: DateTime!
  # Relations
  assignedTasks: [Task!]!
  timeEntries(from: DateTime, to: DateTime): [TimeEntry!]!
}

type Case {
  id: UUID!
  caseNumber: String!
  title: String!
  clientId: UUID!
  status: CaseStatus!
  type: CaseType!
  description: String!
  openedDate: DateTime!
  closedDate: DateTime
  value: Float
  metadata: JSON
  # Relations
  client: Client!
  teamMembers: [User!]!
  documents(type: DocumentType, status: DocumentStatus): [Document!]!
  tasks(status: TaskStatus, assigneeId: UUID): [Task!]!
  communications(limit: Int): [Communication!]!
  timeEntries(from: DateTime, to: DateTime): [TimeEntry!]!
}

# Mutations
type Mutation {
  # Cases
  createCase(input: CreateCaseInput!): Case!
  updateCase(id: UUID!, input: UpdateCaseInput!): Case!
  archiveCase(id: UUID!): Case!

  # Documents
  createDocument(input: CreateDocumentInput!): Document!
  generateDocumentWithAI(input: AIDocumentGenerationInput!): Document!
  updateDocument(id: UUID!, content: String!, createVersion: Boolean!): Document!
  approveDocument(id: UUID!, comments: String): Document!

  # Tasks
  createTask(input: CreateTaskInput!): Task!
  createTaskFromNaturalLanguage(input: NaturalLanguageTaskInput!): Task!
  updateTaskStatus(id: UUID!, status: TaskStatus!): Task!

  # Time Tracking
  createTimeEntry(input: TimeEntryInput!): TimeEntry!
  confirmAISuggestedTime(entryId: UUID!): TimeEntry!

  # Communications
  sendEmail(caseId: UUID!, draft: String!, to: [String!]!): Communication!
  processIncomingEmail(outlookMessageId: String!): Communication!
}

# Queries
type Query {
  # Current User
  me: User!

  # Dashboard
  dashboard(role: UserRole): DashboardMetrics!

  # Cases
  cases(status: CaseStatus, clientId: UUID, assignedToMe: Boolean): [Case!]!
  case(id: UUID!): Case
  searchCases(query: String!, limit: Int): [Case!]!

  # Documents
  document(id: UUID!): Document
  searchDocuments(input: DocumentSearchInput!): [Document!]!

  # Tasks
  tasks(status: TaskStatus, assigneeId: UUID, caseId: UUID): [Task!]!
  myTasks(includeCompleted: Boolean): [Task!]!

  # Time Tracking
  timeEntries(userId: UUID, caseId: UUID, from: DateTime!, to: DateTime!): [TimeEntry!]!
  suggestedTimeEntries: [TimeEntry!]!
}

# Subscriptions for real-time updates
type Subscription {
  # Real-time case updates
  caseUpdated(caseId: UUID!): Case!

  # Document collaboration
  documentUpdated(documentId: UUID!): Document!

  # Task notifications
  taskAssigned(userId: UUID!): Task!

  # AI suggestions
  aiSuggestionGenerated(userId: UUID!): AISuggestion!
}
```

## Components Architecture

[Component descriptions continue with Frontend Components, Backend Services, Data & Infrastructure Components, and Supporting Components as defined earlier...]

## External APIs

### Microsoft Graph API

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

### Anthropic Claude API

- **Purpose:** Primary LLM provider for document generation, natural language processing
- **Documentation:** https://docs.anthropic.com/claude/reference/
- **Base URL(s):** https://api.anthropic.com/v1
- **Authentication:** API key in X-API-Key header
- **Rate Limits:** Varies by tier - Enterprise tier provides 10,000 requests/minute

### OpenAI API

- **Purpose:** Fallback LLM provider, specialized embeddings for semantic search
- **Documentation:** https://platform.openai.com/docs/api-reference
- **Base URL(s):** https://api.openai.com/v1
- **Authentication:** Bearer token with API key
- **Rate Limits:** 10,000 requests/min for GPT-4

[Additional external APIs continue...]

## Core Workflows

[Workflow diagrams for AI-Assisted Document Creation, Natural Language Task Management, Email Processing, Document Review, and Intelligent Time Tracking as defined earlier...]

## Database Schema

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Custom types
CREATE TYPE user_role AS ENUM ('Partner', 'Associate', 'Paralegal');
CREATE TYPE case_status AS ENUM ('Active', 'OnHold', 'Closed', 'Archived');
CREATE TYPE document_status AS ENUM ('Draft', 'Review', 'Approved', 'Filed');
CREATE TYPE task_type AS ENUM ('Research', 'DocumentCreation', 'DocumentRetrieval', 'CourtDate', 'Meeting', 'BusinessTrip');

-- Tables
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL,
    azure_ad_id VARCHAR(255) UNIQUE NOT NULL,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id UUID NOT NULL,
    case_number VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    client_id UUID NOT NULL,
    status case_status NOT NULL DEFAULT 'Active',
    type case_type NOT NULL,
    description TEXT,
    opened_date DATE NOT NULL DEFAULT CURRENT_DATE,
    closed_date DATE,
    UNIQUE(firm_id, case_number)
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id),
    title VARCHAR(500) NOT NULL,
    type document_type NOT NULL,
    current_version INTEGER NOT NULL DEFAULT 1,
    status document_status NOT NULL DEFAULT 'Draft',
    blob_storage_url TEXT NOT NULL,
    ai_generated BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id),
    content_embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

[Additional schema continues...]
```

## Frontend Architecture

[Component Architecture, State Management, Routing Architecture, and Frontend Services Layer as defined earlier...]

## Backend Architecture

[Service Architecture, Database Architecture, and Authentication/Authorization as defined earlier...]

## Unified Project Structure

```plaintext
legal-platform/
├── .github/                           # CI/CD workflows
├── apps/                              # Deployable applications
│   ├── web/                          # Next.js frontend
│   └── admin/                        # Admin portal
├── services/                          # Backend microservices
│   ├── gateway/                      # GraphQL API Gateway
│   ├── document-service/
│   ├── task-service/
│   ├── ai-service/
│   ├── integration-service/
│   └── notification-service/
├── packages/                          # Shared packages
│   ├── shared/                       # Types & utilities
│   ├── ui/                           # UI components
│   ├── database/                     # Database config
│   ├── config/                       # Shared config
│   └── logger/                       # Logging
├── infrastructure/                   # Infrastructure as Code
│   ├── terraform/
│   ├── kubernetes/
│   └── docker/
├── scripts/                          # Build & deployment
├── docs/                            # Documentation
├── tests/                           # E2E tests
└── turbo.json                       # Turborepo config
```

## Development Workflow

[Local Development Setup, Environment Configuration, and Development Tools Setup as defined earlier...]

## Deployment Architecture

[Deployment Strategy, CI/CD Pipeline, Environments, and Infrastructure as defined earlier...]

## Security and Performance

### Security Requirements

**Frontend Security:**

- CSP Headers: Strict content security policy with specific allowlists
- XSS Prevention: React's built-in escaping + DOMPurify for user content
- Secure Storage: httpOnly cookies for tokens, sessionStorage for non-sensitive data

**Backend Security:**

- Input Validation: Zod schemas for all API inputs
- Rate Limiting: 100 req/min general, 10 req/min for AI operations
- CORS Policy: Strict origin whitelist for production
- SQL Injection Prevention: Parameterized queries via Prisma

**Authentication Security:**

- Token Storage: Access tokens in memory, refresh in httpOnly cookies
- Session Management: 30-minute access token, 7-day refresh token
- Password Policy: Azure AD enforced - min 12 chars, complexity required
- MFA: Enforced via Azure AD conditional access

### Performance Optimization

**Frontend Performance:**

- Bundle Size Target: < 200KB initial JS (gzipped)
- Loading Strategy: Route-based code splitting, lazy loading
- Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1

**Backend Performance:**

- Response Time Target: p50 < 200ms, p95 < 1s, p99 < 2s
- Database Optimization: Connection pooling, DataLoader for N+1 prevention
- Caching Strategy: Redis for sessions, CDN for static assets

## Testing Strategy

### Testing Pyramid

- E2E Tests (10%) - Playwright for critical user journeys
- Integration Tests (20%) - API and component integration
- Unit Tests (70%) - Jest for business logic

### Test Organization

- Frontend: Unit tests for components, hooks, stores
- Backend: Unit tests for services, integration for APIs
- E2E: Critical user workflows and AI features

## Coding Standards

### Critical Fullstack Rules

- **Type Sharing:** Always define types in packages/shared/types
- **API Calls:** Never make direct HTTP calls - use service layers
- **Environment Variables:** Access only through config objects
- **Error Handling:** All API routes must use standard error handler
- **State Updates:** Never mutate state directly
- **Database Access:** Only through repository pattern
- **AI Token Usage:** Always track token usage
- **Authentication:** Never trust client-provided user IDs

### Naming Conventions

| Element         | Frontend   | Backend    | Example             |
| --------------- | ---------- | ---------- | ------------------- |
| Components      | PascalCase | -          | `UserProfile.tsx`   |
| API Routes      | -          | kebab-case | `/api/user-profile` |
| Database Tables | -          | snake_case | `user_profiles`     |

## Error Handling Strategy

### Error Response Format

```typescript
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
    retryable?: boolean;
    retryAfter?: number;
  };
}
```

### Error Categories

- Validation Errors (400)
- Authentication Errors (401)
- Authorization Errors (403)
- Not Found Errors (404)
- Rate Limit Errors (429)
- Internal Errors (500)
- Service Unavailable (503)

## Monitoring and Observability

### Monitoring Stack

- **Frontend Monitoring:** Application Insights JavaScript SDK
- **Backend Monitoring:** Application Insights for APM
- **Error Tracking:** Sentry for detailed error tracking
- **Performance Monitoring:** Azure Monitor for infrastructure

### Key Metrics

**Frontend Metrics:**

- Core Web Vitals
- JavaScript errors per session
- API response times
- User interactions per session

**Backend Metrics:**

- Request rate by endpoint
- Error rate by service
- Response time percentiles
- Database query performance

**Business Metrics:**

- Daily/Monthly Active Users
- Documents created per user
- AI feature utilization rate
- Time saved through automation

## Next Steps

1. Review and validate architecture with stakeholders
2. Set up development environment
3. Begin Sprint 1 with Epic 1: UI Foundation
4. Establish CI/CD pipeline
5. Deploy initial infrastructure to Azure
