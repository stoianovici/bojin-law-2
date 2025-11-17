# Epic 2: Foundation & Microsoft 365 Integration with Basic Case Management

**Goal:** Establish the core technical infrastructure including cloud hosting on Render.com, authentication, database setup, and Microsoft 365 integration while delivering a functional case management system. This epic transforms the UI prototype into a working application with real data persistence, user authentication, and basic document storage capabilities, providing immediate value through organized case management and AI-powered search using Claude AI.

## Story 2.1: CI/CD Pipeline and Infrastructure as Code

**Note:** Story 2.1.1 supersedes the Azure infrastructure portions of this story, migrating to Render.com for 83% cost reduction.

**As a** platform operator,
**I want** automated deployment pipeline AND infrastructure as code,
**so that** deployments are consistent and repeatable.

**Acceptance Criteria:**

1. Monorepo structure created with apps/ and packages/ folders per architecture
2. TypeScript, ESLint, Prettier configured with shared rules across all packages
3. GitHub Actions workflow runs tests and builds on every PR
4. Render auto-deployment configured for staging and production environments
5. Docker containers created for all services with docker-compose for local development
6. Environment variables managed via .env files with .env.example templates
7. render.yaml configuration for all services and infrastructure
8. Automated infrastructure deployment via Git push
9. Infrastructure documentation with architecture diagrams
10. Cost estimation for infrastructure resources ($207/month on Render)

**Rollback Plan:** Render's rollback feature allows instant reversion to previous deployment.

## Story 2.2: Cloud Infrastructure and Database Setup

**Note:** This story has been updated to use Render.com infrastructure per Story 2.1.1.

**As a** platform operator,
**I want** cloud infrastructure and database configured,
**so that** the application can run reliably in production.

**Acceptance Criteria:**

1. Render services deployed across multiple regions for reliability
2. PostgreSQL database with pgvector extension deployed on Render (Standard tier, 25GB)
3. Redis cache configured for session management on Render (1GB)
4. Document storage strategy defined (OneDrive primary, local caching)
5. Monitoring configured via Render's built-in metrics and alerts
6. SSL certificates automatically managed by Render

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
2. File upload stores in OneDrive with local caching for performance
3. Document metadata tracked in PostgreSQL with OneDrive file ID
4. Bidirectional sync: changes in OneDrive reflected in platform
5. File preview generates thumbnails for common formats
6. Download provides direct OneDrive link with temporary access

## Story 2.10: Basic AI Search Implementation

**As a** user,
**I want** AI-powered search across all cases and documents,
**so that** I can quickly find relevant information.

**Acceptance Criteria:**

1. Search index created for cases and document metadata using PostgreSQL full-text search
2. Claude AI embeddings generated for all text content (with Grok as fallback)
3. Semantic search finds related content even with different wording
4. Search results ranked by relevance with highlighting
5. Search supports filters: date range, case, document type
6. Recent searches cached for performance improvement

## Story 2.11: Claude Skills Infrastructure and API Integration

**As a** platform developer,
**I want** to integrate Claude Skills API infrastructure into our AI service,
**so that** we can leverage Skills for 70%+ token reduction and 35% cost savings on repetitive legal workflows.

**Acceptance Criteria:**

1. Skills API client integrated with Anthropic SDK including beta flags configuration
2. Database schema updated to track skills metadata and usage metrics
3. SkillsManager service created for uploading, versioning, and managing skills
4. SkillsRegistry implemented for skill discovery and selection
5. Enhanced AnthropicClient supports skills in Messages API requests
6. Environment variables configured for skills feature flags
7. Cost tracking updated to account for skill-based optimizations
8. Unit tests achieve 80% coverage on new skills infrastructure
9. Integration tests validate skills API communication
10. Documentation created for skills infrastructure architecture

**Rollback Plan:** Feature flags allow instant disabling of skills functionality.

## Story 2.12: Core Legal Skills Development

**As a** legal platform user,
**I want** specialized AI skills for contract analysis, document drafting, and legal research,
**so that** I can complete legal tasks 70% faster with consistent quality.

**Acceptance Criteria:**

1. Contract Analysis Skill created with clause extraction and risk assessment
2. Document Drafting Skill created with 10+ legal templates
3. Legal Research Skill created with case law search capabilities
4. Compliance Check Skill created for GDPR and regulatory validation
5. All skills pass validation and upload successfully
6. Skills achieve >70% token reduction compared to baseline
7. Skills maintain >95% accuracy on test documents
8. Skills execute in <5 seconds for standard documents
9. Skills include comprehensive error handling
10. User documentation created for each skill

**Rollback Plan:** Skills can be individually disabled or removed without affecting core functionality.

## Story 2.13: Skills Integration with Model Routing

**As a** platform developer,
**I want** intelligent routing that combines Skills with model selection,
**so that** we achieve optimal cost-performance balance automatically.

**Acceptance Criteria:**

1. SkillSelector service implemented with pattern matching
2. Skill effectiveness tracking integrated with metrics
3. Hybrid routing strategy combines skills with model selection
4. A/B testing framework deployed for skills experiments
5. Skill caching layer implemented for deterministic results
6. Fallback logic handles skill failures gracefully
7. Request router seamlessly integrates skills
8. Performance metrics show <100ms routing overhead
9. Skills dashboard displays real-time metrics
10. Cost savings validated at >35% overall

**Rollback Plan:** Routing can revert to non-skill mode via configuration change.

## Story 2.14: Skills Production Deployment and Monitoring

**As a** platform operator,
**I want** production-ready skills deployment with comprehensive monitoring,
**so that** we can safely run skills at scale with confidence.

**Acceptance Criteria:**

1. Staged rollout plan executed (5% → 25% → 100%)
2. Monitoring alerts configured for all critical metrics
3. Rollback procedures documented and tested
4. Performance benchmarks met (<5s response time)
5. Cost monitoring shows sustained 35%+ savings
6. Error rate maintained below 2%
7. Documentation and runbooks complete
8. Team training completed
9. SLA requirements validated
10. Post-deployment review conducted

**Rollback Plan:** Immediate rollback capability via feature flags with full monitoring.
