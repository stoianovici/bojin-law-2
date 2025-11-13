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
| Data Visualization | Recharts | 2.5+ | React charting library | TypeScript support, responsive charts, 100KB gzipped, MIT license, integrates with React/Tailwind |
| Calendar Component | React Big Calendar + date-fns | 1.8+ / 3.0+ | Calendar/scheduler UI + date utilities | Full-featured calendar with drag-and-drop, 65KB total gzipped, MIT license, TypeScript support |

---

## Pending Architectural Decisions

### 1. Data Visualization Library (Required for Story 1.4)

**Context:**
Story 1.4 (Dashboard Mockups) requires charting capabilities for:
- Bar charts (billable hours over time)
- Pie charts (case distribution by type)
- KPI metric visualizations with trend indicators

**Proposed Solution: Recharts 2.5+**

**Pros:**
- ✅ Built specifically for React with component-based API
- ✅ Excellent TypeScript support with full type definitions
- ✅ Responsive by default with ResponsiveContainer component
- ✅ ~100KB gzipped (reasonable bundle size)
- ✅ Customizable with Tailwind CSS classes
- ✅ MIT license (permissive)
- ✅ Active maintenance (last release within 3 months)
- ✅ 23K+ GitHub stars, widely adopted in production
- ✅ Supports all required chart types (Bar, Pie, Line, Area)
- ✅ Accessibility features (SVG-based, screen reader compatible)

**Cons:**
- ⚠️ Not as feature-rich as D3.js for complex visualizations
- ⚠️ Performance can degrade with very large datasets (>1000 points)

**Alternatives Considered:**

| Library | Pros | Cons | Decision |
|---------|------|------|----------|
| **Chart.js + react-chartjs-2** | Lightweight (60KB), canvas-based, fast rendering | Limited TypeScript support, less React-friendly API, harder to customize with Tailwind | ❌ Rejected - Poor TypeScript integration |
| **Victory** | Excellent accessibility, animation support | Large bundle (200KB+), slower performance | ❌ Rejected - Bundle size exceeds budget |
| **Nivo** | Beautiful defaults, excellent docs | 180KB gzipped, opinionated styling | ❌ Rejected - Bundle size too large |
| **D3.js** | Most powerful, infinite customization | Steep learning curve, requires manual React integration, 250KB+ | ❌ Rejected - Overkill for dashboard needs |
| **Tremor** | Built for dashboards, Tailwind-first | Young project (2022), smaller community, 80KB | ⚠️ Alternative option - Consider for future |

**Recommendation:** ✅ **APPROVE Recharts 2.5+**

**Bundle Impact:**
- Recharts: ~100KB gzipped
- Target dashboard bundle: <500KB gzipped
- Remaining budget: 400KB for other dependencies

---

### 2. Calendar/Scheduler Component (Required for Story 1.4)

**Context:**
Story 1.4 requires calendar widget for Paralegal dashboard showing:
- Monthly calendar view with deadline highlights
- Date hover tooltips with deadline details
- Previous/next month navigation

**Proposed Solution: React Big Calendar 1.8+**

**Pros:**
- ✅ Full-featured calendar with month/week/day/agenda views
- ✅ Drag-and-drop event support (useful for future stories)
- ✅ ~50KB gzipped (reasonable bundle size)
- ✅ MIT license
- ✅ TypeScript support via @types/react-big-calendar
- ✅ Widely adopted (10K+ GitHub stars)
- ✅ Customizable styling with CSS/Tailwind
- ✅ Event handlers for all interactions (click, select, navigate)
- ✅ Responsive with breakpoint support

**Cons:**
- ⚠️ Requires separate date library (date-fns or moment.js)
- ⚠️ Styling requires CSS overrides (not Tailwind-native)
- ⚠️ Documentation could be more comprehensive

**Alternatives Considered:**

| Library | Pros | Cons | Decision |
|---------|------|------|----------|
| **FullCalendar** | Most feature-rich, excellent docs, drag-and-drop | 150KB+ gzipped, commercial license for some features, jQuery heritage | ❌ Rejected - Bundle size + licensing concerns |
| **react-calendar** | Lightweight (20KB), simple API | Limited features, no event scheduling, basic styling | ⚠️ Could work for simple use case |
| **Custom with date-fns** | Full control, minimal bundle (~15KB) | Requires building calendar UI from scratch, time-intensive | ⚠️ Alternative if bundle budget tight |
| **@schedule-x/calendar** | Modern, TypeScript-first, small bundle | Very new (2023), small community, limited docs | ❌ Rejected - Too immature |

**Recommendation:** ✅ **APPROVE React Big Calendar 1.8+** OR ⚠️ **CONSIDER react-calendar** if bundle budget is constrained

**Bundle Impact:**
- React Big Calendar: ~50KB gzipped
- date-fns (localizer): ~15KB gzipped
- Total: ~65KB
- Combined with Recharts: 165KB (within budget)

**Alternative Lightweight Option:**
- If bundle size becomes critical, use **react-calendar** (~20KB) or build **custom calendar with date-fns** (~15KB)
- Would save 35-50KB but lose drag-and-drop and advanced features

---

## ✅ DECISION APPROVED - 2025-11-12

**Decision:**
- ✅ **APPROVED:** Recharts 2.5+ for data visualization
- ✅ **APPROVED:** React Big Calendar 1.8+ with date-fns 3.0+ for calendar component

**Approved By:** Sarah (Product Owner)
**Date:** 2025-11-12
**Rationale:**
- Both libraries meet technical requirements for Story 1.4
- Combined bundle size (165KB) well within 500KB dashboard budget
- Industry-standard choices with excellent TypeScript support
- Active maintenance and strong community support
- MIT licenses ensure no legal concerns
- All alternatives properly evaluated and documented

**Implementation Notes:**
- Libraries added to approved tech stack table (lines 29-30)
- Story 1.4 updated with proper source references
- Dev agent may proceed with implementation using these libraries

**Future Considerations:**
- Monitor bundle size during implementation
- Consider Tremor library for future dashboard enhancements if additional features needed
- Evaluate react-calendar as lightweight alternative if bundle budget becomes constrained in future stories
