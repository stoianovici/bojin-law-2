# Epic 2: Foundation & Microsoft 365 Integration with Basic Case Management

**Goal:** Establish the core technical infrastructure including Azure hosting, authentication, database setup, and Microsoft 365 integration while delivering a functional case management system. This epic transforms the UI prototype into a working application with real data persistence, user authentication, and basic document storage capabilities, providing immediate value through organized case management and AI-powered search.

## Story 2.1: CI/CD Pipeline and Infrastructure as Code

**As a** platform operator,
**I want** automated deployment pipeline AND infrastructure as code,
**so that** deployments are consistent and repeatable.

**Acceptance Criteria:**
1. Monorepo structure created with apps/ and packages/ folders per architecture
2. TypeScript, ESLint, Prettier configured with shared rules across all packages
3. GitHub Actions workflow runs tests and builds on every PR
4. Azure DevOps pipeline deploys to staging environment on merge to main
5. Docker containers created for all services with docker-compose for local development
6. Environment variables managed via .env files with .env.example templates
7. Terraform/Bicep templates for all Azure resources (AKS, PostgreSQL, Redis, Blob Storage)
8. Automated infrastructure deployment pipeline
9. Infrastructure documentation with architecture diagrams
10. Cost estimation for infrastructure resources

**Rollback Plan:** Terraform state allows rollback to previous infrastructure version.

## Story 2.2: Azure Infrastructure and Database Setup

**As a** platform operator,
**I want** cloud infrastructure and database configured,
**so that** the application can run reliably in production.

**Acceptance Criteria:**
1. Azure Kubernetes Service (AKS) cluster provisioned in EU West region
2. PostgreSQL database with pgvector extension deployed on Azure
3. Redis cache configured for session management
4. Azure Blob Storage containers created for document storage
5. Application Insights configured for monitoring and logging
6. SSL certificates configured with automatic renewal

## Story 2.3: Data Migration and Seeding Strategy

**As a** development team,
**I want** data migration and seeding capabilities,
**so that** we can manage schema changes and test data effectively.

**Acceptance Criteria:**
1. Prisma migrations configured with history tracking and rollback capabilities
2. Seed data script creates test law firm, sample cases, documents, tasks
3. Data anonymization script for production data in dev
4. Backup and restore procedures documented
5. Migration runbook for production deployments
6. Zero-downtime migration strategy defined

**Rollback Plan:** Database backups allow restoration to previous state.

## Story 2.4: Authentication with Azure AD

**As a** user,
**I want** to sign in using my Microsoft 365 account,
**so that** I can access the platform with single sign-on.

**Acceptance Criteria:**
1. Azure AD app registration configured with proper permissions
2. OAuth 2.0 flow implemented for user authentication
3. JWT tokens issued and validated for API requests
4. Role claims extracted from Azure AD (Partner, Associate, Paralegal)
5. Session management with Redis storing active sessions
6. Logout properly revokes tokens and clears sessions

## Story 2.5: Microsoft Graph API Integration Foundation

**As a** platform developer,
**I want** Microsoft Graph API integrated,
**so that** we can access Outlook, OneDrive, and Calendar data.

**Acceptance Criteria:**
1. Microsoft Graph client configured with app-level permissions
2. Token management implements refresh token flow automatically
3. Rate limiting middleware prevents exceeding API quotas
4. Webhook subscriptions created for email and file change notifications
5. Error handling includes retry logic for transient failures
6. Graph API responses cached in Redis for performance

## Story 2.6: Case Management Data Model and API

**As a** developer,
**I want** a complete data model and GraphQL API for cases,
**so that** the frontend can perform all case operations.

**Acceptance Criteria:**
1. Prisma schema defines: Case, Client, CaseTeam, CaseStatus, CaseType entities
2. GraphQL schema includes queries: getCases, getCase, searchCases
3. GraphQL mutations: createCase, updateCase, archiveCase, assignTeam
4. Role-based access control enforced at resolver level
5. Case search includes full-text search on case name and client
6. Audit log records all case modifications with user and timestamp

## Story 2.7: API Documentation and Developer Portal

**As a** frontend developer,
**I want** comprehensive API documentation,
**so that** I can integrate with the backend effectively.

**Acceptance Criteria:**
1. GraphQL schema documentation auto-generated
2. GraphQL playground available in development
3. API documentation includes authentication, query/mutation examples, error formats
4. Postman/Insomnia collection maintained
5. API versioning strategy documented
6. Breaking change communication process defined

**Rollback Plan:** N/A - Documentation only.

## Story 2.8: Case CRUD Operations UI

**As a** lawyer,
**I want** to create, read, update, and manage cases,
**so that** I can organize my legal work effectively.

**Acceptance Criteria:**
1. Case list page displays all cases with filtering by status, client, assigned user
2. Create case form includes: client selection, case type, description, team assignment
3. Case detail page shows all case information with inline editing
4. Case archival moves case to archived status with confirmation
5. Search bar implements real-time search across case properties
6. Success/error notifications display for all operations

## Story 2.9: Document Storage with OneDrive Integration

**As a** user working with documents,
**I want** documents automatically synchronized with OneDrive,
**so that** I can access files from Microsoft 365 apps.

**Acceptance Criteria:**
1. OneDrive folder structure created: /Cases/{CaseID}/Documents/
2. File upload stores in both Azure Blob Storage and OneDrive
3. Document metadata tracked in PostgreSQL with OneDrive file ID
4. Bidirectional sync: changes in OneDrive reflected in platform
5. File preview generates thumbnails for common formats
6. Download provides direct OneDrive link with temporary access

## Story 2.10: Basic AI Search Implementation

**As a** user,
**I want** AI-powered search across all cases and documents,
**so that** I can quickly find relevant information.

**Acceptance Criteria:**
1. Elasticsearch index created for cases and document metadata
2. OpenAI embeddings generated for all text content
3. Semantic search finds related content even with different wording
4. Search results ranked by relevance with highlighting
5. Search supports filters: date range, case, document type
6. Recent searches cached for performance improvement
