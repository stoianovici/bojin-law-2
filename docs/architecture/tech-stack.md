# Tech Stack

## Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|-----------|---------|---------|-----------|
| Frontend Language | TypeScript | 5.3+ | Type-safe frontend development | Prevents runtime errors, improves IDE support, essential for large-scale application |
| Frontend Framework | Next.js | 14.2+ | React framework with SSR/SSG | Optimal performance, SEO benefits, excellent Azure deployment support, built-in API routes |
| UI Component Library | Radix UI + Tailwind CSS | Radix 1.1+, Tailwind 3.4+ | Accessible components + utility-first styling | WCAG AA compliance out-of-box, rapid development, smaller bundle than MUI |
| State Management | Zustand + React Query | Zustand 4.5+, React Query 5.0+ | Client state + Server state | Simpler than Redux, excellent TypeScript support, optimal cache management |
| Backend Language | TypeScript | 5.3+ | Type-safe backend development | Code sharing with frontend, prevents runtime errors, excellent ecosystem |
| Backend Framework | Node.js + Express | Node 20 LTS, Express 4.19+ | Runtime and web framework | Consistency with frontend, extensive middleware ecosystem, GraphQL integration |
| API Style | GraphQL | Apollo Server 4.9+ | Flexible data fetching | Complex nested data requirements, real-time subscriptions, reduces over-fetching |
| Database | PostgreSQL + pgvector | PostgreSQL 16, pgvector 0.5+ | Relational data + vector search | ACID compliance for legal data, semantic search capability, single database solution |
| Cache | Redis | 7.2+ | Session management + caching | Fast session storage, API response caching, real-time data synchronization |
| File Storage | Azure Blob Storage | Latest SDK | Document storage | Native Azure integration, cost-effective, supports large files, geo-redundancy |
| Authentication | Azure AD + JWT | MSAL 3.0+ | Enterprise SSO + token auth | Native Microsoft 365 integration, enterprise-grade security, role-based access |
| Frontend Testing | Jest + React Testing Library | Jest 29+, RTL 14+ | Unit and integration testing | Excellent React ecosystem support, fast execution, good coverage reporting |
| Backend Testing | Jest + Supertest | Jest 29+, Supertest 6.3+ | API and unit testing | Consistent with frontend, excellent async support, GraphQL testing capability |
| E2E Testing | Playwright | 1.41+ | End-to-end testing | Cross-browser support, excellent debugging, faster than Cypress, Azure DevOps integration |
| Build Tool | Vite | 5.0+ | Frontend bundling | Faster than Webpack, excellent HMR, optimized production builds |
| Bundler | Rollup (via Vite) | Included with Vite | Module bundling | Tree-shaking, code-splitting, optimal bundle size |
| IaC Tool | Terraform | 1.7+ | Infrastructure as Code | Azure provider support, state management, modular infrastructure |
| CI/CD | GitHub Actions + Azure DevOps | Latest | Automation pipeline | GitHub integration for code, Azure DevOps for deployment, comprehensive automation |
| Monitoring | Application Insights | Latest SDK | APM and logging | Native Azure integration, excellent performance tracking, AI-powered insights |
| Logging | Winston + App Insights | Winston 3.11+ | Structured logging | Flexible log levels, multiple transports, Azure integration |
| CSS Framework | Tailwind CSS | 3.4+ | Utility-first CSS | Rapid development, consistent spacing, excellent tree-shaking, dark mode support |
