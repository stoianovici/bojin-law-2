# Updated Epic Section for PRD

Replace the Epic sections (starting from line 497) with the following updated content:

## Epic 1: UI Foundation & Interactive Prototype

**Goal:** Establish the complete visual design language and interactive prototype that demonstrates all major user workflows through clickable mockups, allowing pilot firm validation before backend development begins. This epic delivers a comprehensive component library and navigation framework that will be reused throughout all subsequent development, ensuring UI consistency and reducing future implementation time.

### Story 1.0: Project Initialization and Repository Setup

**As a** development team,
**I want** the project repository and foundation properly initialized,
**so that** all developers can start work with a consistent environment.

**Acceptance Criteria:**

1. GitHub repository created with proper .gitignore for Node.js/TypeScript
2. Monorepo initialized using Turborepo with folder structure:
   - /apps (web, api, admin)
   - /packages (ui, types, utils, ai-prompts)
   - /services (document, task, ai, integration, notification)
3. Initial README.md with project overview, architecture diagram, setup instructions
4. Git workflow configured with branch protection, PR template, commit conventions
5. Base package.json with workspaces configuration
6. LICENSE file and SECURITY.md added

### Story 1.1: Design System, Component Library, and Development Environment Setup

**As a** developer,
**I want** a comprehensive design system, component library, AND local development environment,
**so that** I can immediately start building UI components.

**Acceptance Criteria:**

1. Design tokens defined for colors, typography (with Romanian diacritic support), spacing, and shadows in CSS variables
2. Base components created: buttons (primary, secondary, ghost), form inputs, cards, modals, tooltips
3. Tailwind CSS configuration customized with design tokens and Radix UI integrated
4. Storybook configured showing all components in various states (default, hover, disabled, loading)
5. Romanian diacritics (ă, â, î, ș, ț) display correctly in all typography components
6. Component documentation includes usage examples and accessibility notes
7. Docker setup with docker-compose.yml for local development
8. Node.js 20+ and pnpm configured as package manager
9. VS Code workspace settings with recommended extensions
10. .env.example file with all required environment variables documented
11. Pre-commit hooks with Husky for linting and formatting

### Story 1.2: Testing Infrastructure Setup

**As a** development team,
**I want** comprehensive testing infrastructure configured,
**so that** we can ensure code quality from the start.

**Acceptance Criteria:**

1. Jest/Vitest configured for unit testing with coverage reporting
2. React Testing Library setup for component testing
3. Testing utilities and custom renders created
4. Playwright configured for E2E testing
5. Test database setup with Docker for integration tests
6. CI pipeline runs tests on every PR with coverage requirements (80% minimum)
7. Test data factories created for common entities
8. Performance testing setup with Lighthouse CI
9. Accessibility testing automated with axe-core
10. Example tests created for each test type as templates

### Story 1.3: Navigation Shell and Role Switching

**As a** user in any role,
**I want** to navigate between major sections and switch roles for testing,
**so that** I can access all platform features and validate role-specific views.

**Acceptance Criteria:**

1. Sidebar navigation implemented with sections: Dashboard, Cases, Documents, Tasks, Communications, Time Tracking, Reports
2. Top bar includes search/command palette trigger (Cmd+K), notifications icon, user menu
3. Role switcher allows instant switching between Partner, Associate, Paralegal views
4. Navigation highlights current section and maintains state during role switch
5. Responsive behavior: sidebar collapses to hamburger menu on tablet/mobile
6. Quick action buttons change based on current role

### Story 1.4: Dashboard Mockups for All Roles

**As a** user in my specific role,
**I want** to see a dashboard tailored to my responsibilities,
**so that** I can quickly understand my priorities and firm status.

**Acceptance Criteria:**

1. Partner dashboard shows: firm KPIs, billable hours chart, case distribution, pending approvals
2. Associate dashboard displays: my active cases, today's tasks, deadlines this week, recent documents
3. Paralegal dashboard presents: assigned tasks, document requests, deadline calendar
4. All dashboards include AI suggestion panels (mockup with sample suggestions)
5. Interactive elements demonstrate hover states and click feedback (no real data)
6. Widgets are drag-and-drop rearrangeable within dashboard grid

### Story 1.5: Case Workspace Prototype

**As a** lawyer working on a case,
**I want** to see all case information in one unified workspace,
**so that** I can efficiently manage all aspects of a legal matter.

**Acceptance Criteria:**

1. Case header shows: case name, client, status, assigned team, next deadline
2. Tab navigation for: Overview, Documents, Tasks, Communications, Time Entries, Notes
3. Documents tab demonstrates folder tree, document list with version badges, preview pane
4. Tasks tab shows kanban board with task cards containing assignee, due date, status
5. AI insights panel (collapsible) shows mockup suggestions relevant to case context
6. Quick actions bar enables natural language input (visual only, no processing)

### Story 1.6: Document Editor Interface

**As a** user creating or editing documents,
**I want** an AI-assisted document editor interface,
**so that** I can efficiently draft legal documents with intelligent support.

**Acceptance Criteria:**

1. Split-screen layout: document editor (left), AI assistant panel (right)
2. Editor toolbar includes formatting options, insert menu, version history button
3. AI panel shows: suggested completions, similar documents, relevant templates
4. Version comparison view demonstrates side-by-side diff with semantic changes highlighted
5. Comments/review sidebar for collaboration mockup
6. Natural language command bar at bottom for document operations

### Story 1.7: Task Management Views

**As a** user managing my work,
**I want** multiple ways to view and create tasks,
**so that** I can work in my preferred style.

**Acceptance Criteria:**

1. Calendar view shows week with tasks as time blocks, color-coded by type
2. Kanban board displays tasks in columns: To Do, In Progress, Review, Complete
3. List view presents tasks in table format with sortable columns
4. Natural language task creation bar at top with example text showing parsing
5. Task detail modal includes all six task types with appropriate fields
6. Drag-and-drop demonstrated between calendar slots and kanban columns

### Story 1.8: Communication Hub Mockup

**As a** user handling case communications,
**I want** a unified view of all case-related messages,
**so that** I can track conversations and respond efficiently.

**Acceptance Criteria:**

1. Thread list shows email subjects with case tags, sender, preview, date
2. Message view displays full thread with collapse/expand for individual messages
3. AI draft response panel shows suggested reply based on context
4. Extracted items sidebar lists: deadlines, commitments, action items
5. Compose interface includes natural language enhancements mockup
6. Filter bar allows filtering by case, sender, date range, has-deadline

### Story 1.9: Interactive Prototype Assembly

**As a** stakeholder evaluating the platform,
**I want** a clickable prototype demonstrating key workflows,
**so that** I can validate the UX before development.

**Acceptance Criteria:**

1. Prototype allows navigation between all major screens
2. Three complete workflows demonstrated: create document, assign task, respond to email
3. Role switching shows different data and permissions for same screens
4. Loading states and transitions demonstrated between screens
5. Error states shown for form validation and system messages
6. Deployed prototype accessible via web browser for stakeholder review

### Story 1.10: Developer Onboarding Documentation

**As a** new developer joining the team,
**I want** comprehensive onboarding documentation,
**so that** I can become productive quickly.

**Acceptance Criteria:**

1. ONBOARDING.md created with system requirements, setup guide, common commands
2. Video walkthrough recorded showing setup process
3. Postman/Insomnia collection for API testing
4. Sample data setup script
5. FAQ document with common issues and solutions
6. Slack/Teams channel details for support

## Epic 2: Foundation & Microsoft 365 Integration with Basic Case Management

**Goal:** Establish the core technical infrastructure including Azure hosting, authentication, database setup, and Microsoft 365 integration while delivering a functional case management system. This epic transforms the UI prototype into a working application with real data persistence, user authentication, and basic document storage capabilities, providing immediate value through organized case management and AI-powered search.

### Story 2.1: CI/CD Pipeline and Infrastructure as Code

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

### Story 2.2: Azure Infrastructure and Database Setup

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

### Story 2.3: Data Migration and Seeding Strategy

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

### Story 2.4: Authentication with Azure AD

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

### Story 2.5: Microsoft Graph API Integration Foundation

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

### Story 2.6: Case Management Data Model and API

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

### Story 2.7: API Documentation and Developer Portal

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

### Story 2.8: Case CRUD Operations UI

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

### Story 2.9: Document Storage with OneDrive Integration

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

### Story 2.10: Basic AI Search Implementation

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

[Continue with Epic 3, 4, and 5 as in original PRD, with these additions:]

## Epic 3 Additions:

### Story 3.8: Document System Testing and Performance

**As a** platform operator,
**I want** comprehensive testing of the document system,
**so that** we can ensure reliability and performance.

**Acceptance Criteria:**

1. Load testing for concurrent document operations
2. Performance benchmarks for generation, search, and version comparison
3. Stress testing with large documents (100+ pages)
4. Integration tests for Word synchronization
5. Failover testing for AI service switching
6. Token usage monitoring and alerting
7. Performance dashboard in Application Insights

## Epic 4 Additions:

### Story 4.8: Task System User Documentation

**As a** end user,
**I want** comprehensive documentation for the task system,
**so that** I can use all features effectively.

**Acceptance Criteria:**

1. User guide sections for all task types and workflows
2. Video tutorials for common workflows
3. In-app help tooltips and guided tours
4. Quick reference cards (printable)
5. Troubleshooting guide
6. Best practices document

## Epic 5 Additions:

### Story 5.8: Platform Monitoring and Operations

**As a** platform operator,
**I want** comprehensive monitoring and alerting,
**so that** we can maintain high availability.

**Acceptance Criteria:**

1. Application Insights dashboards for health, performance, errors, activity
2. Alerts configured for downtime, degradation, errors, budget, security
3. Log aggregation and search capabilities
4. Incident response runbook
5. On-call rotation schedule
6. Status page for users

### Story 5.9: Security Audit and Compliance

**As a** security officer,
**I want** security validation and compliance documentation,
**so that** we meet all regulatory requirements.

**Acceptance Criteria:**

1. Security audit covering OWASP Top 10 and authentication
2. GDPR compliance documentation complete
3. Romanian Law 190/2018 compliance verified
4. Penetration testing completed
5. Security training for development team
6. Incident response plan created
