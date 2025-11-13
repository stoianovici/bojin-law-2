# Legal Platform - AI-Powered Case Management System

> An intelligent legal practice management platform with Microsoft 365 integration, built for Romanian law firms.

## Overview

This platform revolutionizes legal case management by combining AI-powered document automation, natural language task management, and seamless Microsoft 365 integration. Built with Next.js, TypeScript, and GraphQL, it leverages Claude AI for intelligent document drafting and semantic search capabilities.

**Key Features:**
- AI-powered document drafting and version control
- Natural language task management and workflow automation
- Deep Microsoft 365 integration (Outlook, OneDrive, Calendar)
- Semantic document search with pgvector
- Real-time collaboration and communication intelligence

## Architecture

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

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 20 LTS or higher
- **pnpm**: Version 9.0.0 or higher (package manager)
- **Git**: For version control

To verify your installations:

```bash
node --version  # Should be >= 20.0.0
pnpm --version  # Should be >= 9.0.0
```

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd legal-platform
```

### 2. Install Dependencies

```bash
pnpm install
```

This will install all dependencies across the monorepo workspaces.

### 3. Development

```bash
# Run all applications and services in development mode
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint
```

### 4. Docker Development Environment

The project includes a complete Docker development environment with PostgreSQL 16 (with pgvector), Redis, and Node.js 20.

```bash
# Start all services (PostgreSQL, Redis, and the app)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: This will delete all data)
docker-compose down -v

# Rebuild containers after dependency changes
docker-compose up -d --build

# Run commands inside the app container
docker-compose exec app pnpm test
docker-compose exec app pnpm build

# Access PostgreSQL
docker-compose exec postgres psql -U postgres -d legal_platform

# Access Redis CLI
docker-compose exec redis redis-cli
```

**Health Checks:**
- App: http://localhost:3000/api/health
- PostgreSQL: Automatic with pg_isready
- Redis: Automatic with redis-cli ping

**Services:**
- **App**: Port 3000 (Next.js), Port 6006 (Storybook)
- **PostgreSQL**: Port 5432 (includes pgvector extension)
- **Redis**: Port 6379

## Repository Structure

This project uses a **Turborepo monorepo** structure for optimal development experience and build performance:

```
legal-platform/
├── apps/                       # Deployable applications
│   ├── web/                   # Next.js frontend application
│   └── admin/                 # Admin portal
├── services/                   # Backend microservices
│   ├── gateway/               # GraphQL API Gateway
│   ├── document-service/      # Document management service
│   ├── task-service/          # Task management service
│   ├── ai-service/            # AI orchestration service
│   ├── integration-service/   # Microsoft 365 integration
│   └── notification-service/  # Email & notification service
├── packages/                   # Shared packages
│   ├── shared/                # Shared types & utilities
│   ├── ui/                    # UI component library
│   ├── database/              # Database configuration
│   ├── config/                # Shared configuration
│   └── logger/                # Logging utilities
├── infrastructure/             # Infrastructure as Code
│   ├── terraform/             # Terraform configurations
│   ├── kubernetes/            # Kubernetes manifests
│   └── docker/                # Docker configurations
├── scripts/                   # Build & deployment scripts
├── tests/                     # End-to-end tests
└── docs/                      # Project documentation
    ├── prd/                   # Product requirements
    ├── architecture/          # Architecture documentation
    └── stories/               # Development stories
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14+, React 18, TypeScript 5.3+ | Server-side rendering, type safety |
| **UI** | Radix UI, Tailwind CSS | Accessible components, utility-first styling |
| **State** | Zustand, React Query | Client & server state management |
| **Backend** | Node.js 20 LTS, Express, TypeScript | Runtime & web framework |
| **API** | Apollo GraphQL Server | Flexible data fetching, real-time subscriptions |
| **Database** | PostgreSQL 16 + pgvector | Relational data & vector search |
| **Cache** | Redis 7.2+ | Session management & caching |
| **Storage** | Azure Blob Storage | Document storage |
| **Auth** | Azure AD + JWT | Enterprise SSO & token auth |
| **Testing** | Jest 29+, Playwright 1.41+ | Unit, integration, E2E testing |
| **Build** | Turborepo, Vite 5.0+ | Monorepo orchestration, bundling |
| **IaC** | Terraform 1.7+ | Infrastructure as Code |
| **CI/CD** | GitHub Actions, Azure DevOps | Automation pipeline |
| **Monitoring** | Application Insights | APM & logging |

## Documentation

Detailed documentation is available in the `docs/` directory:

- **[Product Requirements](docs/prd.md)** - Complete product specifications and requirements
- **[Architecture Documentation](docs/architecture/)** - Detailed technical architecture
  - [High Level Architecture](docs/architecture/high-level-architecture.md)
  - [Tech Stack](docs/architecture/tech-stack.md)
  - [Frontend Architecture](docs/architecture/frontend-architecture.md)
  - [Backend Architecture](docs/architecture/backend-architecture.md)
  - [Database Schema](docs/architecture/database-schema.md)
  - [API Specification](docs/architecture/api-specification.md)
  - [Security & Performance](docs/architecture/security-and-performance.md)
  - [Testing Strategy](docs/architecture/testing-strategy.md)
  - [Coding Standards](docs/architecture/coding-standards.md)
- **[Development Stories](docs/stories/)** - Feature implementation stories

## Testing

We maintain comprehensive test coverage across all layers of the application using the **Testing Pyramid** approach:

- **70% Unit Tests** - Components, services, utilities (Jest + React Testing Library)
- **20% Integration Tests** - API endpoints, database operations (Jest + Supertest)
- **10% E2E Tests** - Critical user workflows (Playwright)

### Quick Commands

```bash
# Run all tests
pnpm test

# Run tests with coverage report
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch

# Run E2E tests (all browsers)
pnpm test:e2e

# Run E2E tests with UI (visual debugger)
pnpm test:e2e:ui

# Run E2E tests in debug mode
pnpm test:e2e:debug

# Run accessibility tests
pnpm test:a11y

# Run performance tests
pnpm test:perf
```

### Coverage Requirements

All code must meet **80% minimum coverage** for:
- Statements
- Branches
- Functions
- Lines

Coverage is automatically checked in CI and will fail if thresholds are not met.

### Test Types

#### Unit Tests
Fast, isolated tests for components and functions. Co-located with source files:
```
packages/ui/src/atoms/Button.tsx
packages/ui/src/atoms/Button.test.tsx  ← Unit test
```

#### Integration Tests
Test API endpoints and service interactions with real database connections:
```typescript
import request from 'supertest';

test('POST /api/cases', async () => {
  const response = await request(app)
    .post('/api/cases')
    .send({ title: 'New Case' })
    .expect(201);
});
```

#### E2E Tests
Complete user workflows across the full application stack using Playwright:
```typescript
test('user can create case and upload document', async ({ page }) => {
  await loginPage.loginAsPartner();
  await dashboardPage.clickCreateCase();
  // ... complete workflow
});
```

### Test Data Factories

Use factories to generate test data:
```typescript
import { createUser, createCase, createDocument } from '@legal-platform/test-utils/factories';

const user = createUser({ role: 'Partner' });
const caseData = createCase({ status: 'Active' });
const document = createDocument({ caseId: caseData.id });
```

### Test Templates

Comprehensive test templates with examples and best practices:
- **Unit Tests**: `packages/shared/test-utils/templates/unit-test.template.tsx`
- **Integration Tests**: `packages/shared/test-utils/templates/integration-test.template.tsx`
- **E2E Tests**: `tests/e2e/templates/e2e-test.template.spec.ts`
- **Accessibility**: `tests/e2e/templates/a11y-test.template.spec.ts`
- **Performance**: `tests/performance/template.spec.ts`

### Database Testing

Test database runs on **port 5433** (separate from dev database):

```bash
# Start test database
docker-compose up -d postgres-test

# Run tests with database
pnpm test:integration
```

### Debugging Tests

```bash
# Debug E2E tests visually
pnpm test:e2e:ui

# Run with headed browser (see execution)
pnpm test:e2e:headed

# View test report
pnpm test:e2e:report
```

Failed E2E tests automatically capture:
- Screenshots in `test-results/`
- Videos of the failure
- Playwright traces for debugging

### CI/CD Integration

All tests run automatically on every pull request:
- ✓ Unit tests with coverage
- ✓ Integration tests
- ✓ E2E tests (Chromium, Firefox, WebKit)
- ✓ Accessibility tests (WCAG AA compliance)
- ✓ Performance tests (Lighthouse CI on main branch)

**All tests must pass before PR can be merged.**

For detailed testing documentation, see:
- [TESTING.md](TESTING.md) - Comprehensive testing guide
- [CONTRIBUTING.md](CONTRIBUTING.md#testing-requirements) - Testing requirements and best practices

## Development Workflow

1. **Branch Naming**: `feature/`, `bugfix/`, `hotfix/` prefixes
2. **Commit Format**: Follow [Conventional Commits](https://www.conventionalcommits.org/)
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `chore:` for maintenance tasks
3. **Pull Requests**: Use the PR template and ensure all checks pass
4. **Code Review**: Require at least one approval before merging

## License

See [LICENSE](LICENSE) file for details.

## Security

For security concerns and vulnerability reports, please see [SECURITY.md](SECURITY.md).

---

**Built with** 💙 **for Romanian legal professionals**
