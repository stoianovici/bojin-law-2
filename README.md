# Legal Platform - AI-Powered Case Management System

[![PR Validation](https://github.com/bojin-law/legal-platform/actions/workflows/pr-validation.yml/badge.svg)](https://github.com/bojin-law/legal-platform/actions/workflows/pr-validation.yml)
[![codecov](https://codecov.io/gh/bojin-law/legal-platform/branch/main/graph/badge.svg)](https://codecov.io/gh/bojin-law/legal-platform)

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

**Infrastructure:** Render.com Platform-as-a-Service (PaaS)

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        Mobile[Future Mobile]
    end

    subgraph "Render Platform"
        subgraph "Frontend Services"
            NextJS[Next.js App<br/>2× 4GB instances]
        end

        subgraph "API Gateway"
            GraphQL[Apollo GraphQL Server<br/>2× 4GB instances]
        end

        subgraph "Microservices"
            DocService[Document Service<br/>1× 2GB]
            TaskService[Task Service<br/>1× 2GB]
            AIService[AI Service<br/>1× 2GB]
            IntegrationService[Integration Service<br/>1× 2GB]
            NotificationService[Notification Service<br/>1× 2GB]
        end

        subgraph "Managed Data Layer"
            PostgreSQL[(PostgreSQL 16<br/>+ pgvector<br/>25GB)]
            Redis[(Redis 7<br/>1GB)]
        end
    end

    subgraph "External Services"
        MS365[Microsoft 365<br/>Graph API]
        Claude[Anthropic Claude API]
        Storage[Cloudflare R2<br/>S3-compatible]
        Email[SendGrid]
    end

    Browser --> NextJS
    Mobile --> NextJS
    NextJS --> GraphQL
    GraphQL --> DocService
    GraphQL --> TaskService
    GraphQL --> AIService
    GraphQL --> IntegrationService
    GraphQL --> NotificationService

    DocService --> PostgreSQL
    DocService --> Storage
    TaskService --> PostgreSQL
    AIService --> Claude
    AIService --> Redis
    IntegrationService --> MS365
    NotificationService --> Email
    NotificationService --> PostgreSQL

    All services --> Redis
```

**Cost:** $207/month production • $52/month staging • [Full breakdown →](infrastructure/COST_ESTIMATION.md)

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

### Quick Start (5 minutes)

```bash
# 1. Clone repository
git clone <repository-url>
cd legal-platform

# 2. Install dependencies
pnpm install

# 3. Start local environment (Docker Compose)
cd infrastructure/docker
docker-compose up -d

# 4. Run database migrations
pnpm db:migrate

# 5. Start development servers
pnpm dev
```

The web app will be available at http://localhost:3000

### Development Commands

```bash
# Run all apps and services in dev mode
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint

# Type checking
pnpm typecheck
```

### Local Services

Docker Compose provides all backing services:

- **Web App**: http://localhost:3000
- **API Gateway**: http://localhost:4000
- **PostgreSQL**: localhost:5432 (with pgvector extension)
- **Redis**: localhost:6379

For detailed local development setup, see [Local Development Guide](infrastructure/LOCAL_DEVELOPMENT.md).

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
├── infrastructure/             # Infrastructure documentation
│   ├── docker/                # Docker configurations
│   ├── render/                # Render.com configurations
│   └── archive/               # Archived Azure/Kubernetes docs
├── scripts/                   # Build & deployment scripts
│   └── render/                # Render helper scripts
├── tests/                     # End-to-end tests
└── docs/                      # Project documentation
    ├── prd/                   # Product requirements
    ├── architecture/          # Architecture documentation
    └── stories/               # Development stories
```

## Tech Stack

| Layer              | Technology                             | Purpose                                         |
| ------------------ | -------------------------------------- | ----------------------------------------------- |
| **Frontend**       | Next.js 14+, React 18, TypeScript 5.3+ | Server-side rendering, type safety              |
| **UI**             | Radix UI, Tailwind CSS                 | Accessible components, utility-first styling    |
| **State**          | Zustand, React Query                   | Client & server state management                |
| **Backend**        | Node.js 20 LTS, Express, TypeScript    | Runtime & web framework                         |
| **API**            | Apollo GraphQL Server                  | Flexible data fetching, real-time subscriptions |
| **Database**       | PostgreSQL 16 + pgvector               | Relational data & vector search                 |
| **Cache**          | Redis 7.2+                             | Session management & caching                    |
| **Storage**        | Cloudflare R2 (S3-compatible)          | Document storage                                |
| **Testing**        | Jest 29+, Playwright 1.41+             | Unit, integration, E2E testing                  |
| **Build**          | Turborepo, Vite 5.0+                   | Monorepo orchestration, bundling                |
| **Infrastructure** | Render.com (PaaS)                      | Platform-as-a-Service deployment                |
| **IaC**            | render.yaml                            | Infrastructure as Code                          |
| **CI/CD**          | GitHub Actions + Render Deploy Hooks   | Automation pipeline                             |
| **Monitoring**     | Render + New Relic (free tier)         | APM & logging                                   |

**Annual Infrastructure Cost:** $2,484/year production (83% savings vs Azure)

## Dashboard System

The Legal Platform features a flexible, role-based dashboard system with customizable widgets and layouts.

### Role-Based Dashboards

Each user role has a customized dashboard optimized for their workflow:

#### Partner Dashboard

Partners have an **operational oversight dashboard** with the following widgets:

1. **Supervised Cases**: Track cases where you're the supervising attorney
2. **My Tasks**: Personal task management and tracking
3. **Firm Cases Overview**: Firm-wide case management with 3 views:
   - At Risk: Cases requiring immediate attention
   - High Value: High-value cases requiring supervision
   - AI Insights: AI-suggested cases needing review
4. **Firm Tasks Overview**: Aggregate firm task metrics and completion rates
5. **Employee Workload**: Monitor team utilization with daily/weekly views
6. **AI Suggestions**: AI-powered insights and recommendations

#### Analytics Section (Partner Only)

Partners have access to a dedicated **Analytics section** with strategic KPI widgets:

- **Firm KPIs**: Active cases, clients, approvals, billable hours
- **Billable Hours Chart**: Visual trends and year-over-year comparisons
- **Case Distribution**: Case breakdown by status and type
- **Pending Approvals**: Documents and timesheets awaiting approval

**Access**: Navigate via sidebar Analytics link (Partner role only)

#### Associate & Paralegal Dashboards

- **Associates**: Task-focused widgets for personal productivity
- **Paralegals**: Document-focused widgets for document management workflows

### Dashboard Features

- **Drag-and-Drop**: Rearrange widgets using React Grid Layout
- **Collapsible Widgets**: Collapse widgets to save screen space
- **Persistent Layouts**: Your layout is saved automatically
- **Responsive**: Optimized for desktop, tablet, and mobile
- **Real-time Updates**: Data refreshes automatically
- **Accessible**: WCAG AA compliant with keyboard navigation

### Customization Guide

For information on customizing dashboards and creating widgets, see:

- **[Dashboard Widgets Guide](docs/guides/dashboard-widgets.md)** - Widget development and customization
- **[Dashboard Customization](CONTRIBUTING.md#dashboard-customization)** - Layout and widget configuration

## Deployment

The platform deploys to **Render.com** via GitHub Actions using git-based continuous deployment.

### Quick Deploy

```bash
# Deploy to staging (automatic on push to develop)
git push origin develop

# Deploy to production (automatic on push to main)
git push origin main

# Manual deployment using Render CLI
npm run deploy:production
```

### Infrastructure

- **Production:** $207/month • 11 services • Auto-scaling
- **Staging:** $52/month • 7 services • Preview environments for PRs
- **Local:** Free • Docker Compose

### Monitoring Deployments

Check deployment status programmatically via Render API:

```bash
# Quick status check
./scripts/render-status.sh

# Or use the API directly (requires .env.render)
source .env.render
curl -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$RENDER_WEB_SERVICE_ID/deploys?limit=1"
```

**Complete Guides:**

- [Deployment Guide](infrastructure/DEPLOYMENT_GUIDE.md) - Step-by-step deployment procedures
- [Render API Integration](infrastructure/RENDER_API.md) - API access and automation
- [Operations Runbook](infrastructure/OPERATIONS_RUNBOOK.md) - Daily operations and incident response
- [Cost Estimation](infrastructure/COST_ESTIMATION.md) - Detailed cost breakdown and projections
- [Local Development](infrastructure/LOCAL_DEVELOPMENT.md) - Set up local environment

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
- **[Infrastructure Documentation](infrastructure/)** - Deployment and operations
  - [Infrastructure README](infrastructure/README.md) - Overview and quick start
  - [Deployment Guide](infrastructure/DEPLOYMENT_GUIDE.md) - Deployment procedures
  - [Operations Runbook](infrastructure/OPERATIONS_RUNBOOK.md) - Daily operations
  - [Cost Estimation](infrastructure/COST_ESTIMATION.md) - Cost analysis
  - [Local Development](infrastructure/LOCAL_DEVELOPMENT.md) - Local setup
- **[Development Stories](docs/stories/)** - Feature implementation stories
- **[Guides](docs/guides/)** - Development guides and best practices
  - [Dashboard Widgets Guide](docs/guides/dashboard-widgets.md)

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
  const response = await request(app).post('/api/cases').send({ title: 'New Case' }).expect(201);
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
