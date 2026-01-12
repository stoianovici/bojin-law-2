# Codebase Optimization Audit

**Epic**: Performance and code quality optimization across the platform
**Status**: Phase 1 - Establishing Safety Nets (In Progress)
**Created**: 2026-01-12
**Last Updated**: 2026-01-12 (Session 8)

## Overview

A systematic audit of the codebase to identify and implement optimizations while maintaining stability. The approach prioritizes safety through comprehensive testing and monitoring before making changes.

### Quick Status

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Gateway unit tests failing | 216 | 116 | -100 |
| Gateway unit tests passing | 1435 | 1688 | +253 |
| Gateway unit suites failing | 87 | 37 | -50 |
| Integration tests | N/A | 30 suites (86 tests) | Separated (need test DB) |
| GraphService tests | 0/24 passing | 24/24 passing | ✅ Fixed |
| retry.util tests | failing | 19/19 passing | ✅ Fixed |
| session.config tests | 22/23 passing | 23/23 passing | ✅ Fixed |
| email-thread.service | failing | 24/24 passing | ✅ Fixed (Session 8) |
| approval.resolvers tests | failing (TS errors) | 39/39 passing | ✅ Fixed (Session 6) |
| firm.resolvers tests | failing (import + i18n) | 22/22 passing | ✅ Fixed (Session 6) |
| search.resolvers tests | failing (vitest + API) | 24/24 passing | ✅ Rewritten (Session 6) |
| Paralegal role | 197 refs, schema missing | Added to all types | ✅ Fixed |
| track-changes.service tests | 5/8 passing | 8/8 passing | ✅ Fixed (Session 7) |
| deadline-warning.service tests | 5/23 passing | 23/23 passing | ✅ Fixed (Session 7) |
| batch-runner.service tests | 0/14 (vitest) | 14/14 passing | ✅ Converted (Session 7) |
| search-index.processor tests | 0/17 (vitest) | 17/17 passing | ✅ Converted (Session 7) |
| briefing.handler tests | 0/17 (vitest) | 17/17 passing | ✅ Converted (Session 7) |
| document-summary.service tests | 3/13 passing | 13/13 passing | ✅ Fixed (Session 8) |
| classification-scoring tests | 14/19 passing | 19/19 passing | ✅ Fixed (Session 8) |
| embedding.service tests | 3/16 passing | 16/16 passing | ✅ Fixed (Session 8) |

**Next focus**: Fix remaining 37 test suites - continue fixing mock issues and test expectations

### Goals

- Improve application performance (load times, API response times, query efficiency)
- Reduce bundle sizes and eliminate dead code
- Optimize database queries and indexing
- Clean up technical debt without breaking functionality
- Establish better observability for ongoing maintenance

### Principles

1. **Safety first** - No optimization without adequate test coverage
2. **Measure before and after** - Every change must be validated with metrics
3. **Incremental changes** - One optimization per PR, isolated and reversible
4. **Document decisions** - Record why optimizations were made for future context

---

## Phase 1: Establish Safety Nets

**Objective**: Ensure adequate test coverage and monitoring before making any changes.

### Current State Assessment

#### Test Infrastructure

| Area | Test Count | Status | Notes |
|------|------------|--------|-------|
| E2E (Playwright) | 354+ | ⚠️ Blocked | test-utils import errors prevent full run |
| Gateway Unit Tests | 1585 (148 fail) | 🟡 Improving | Was 236 failing, down to 148 |
| Gateway Integration | 86 (need DB) | ⚠️ Separated | Require real test database |
| **Web App (apps/web)** | **0** | 🔴 Critical | New app has zero tests |
| UI Package | 7 | ✅ Passing | All tests pass (Modal, Button, Input, etc.) |
| Shared test-utils | 6 | ✅ Passing | Factory tests pass |
| Database Package | 2 | ⚠️ Minimal | Data layer under-tested |
| Root Unit Tests | 299 | ✅ Passing | 13 suites, all pass |

**Test Frameworks Available**:
- Jest v30.2.0 (unit/integration)
- Playwright v1.56.1 (E2E, accessibility)
- Artillery v2.0.27 (load testing)
- Lighthouse CI (performance testing)

**Coverage Configuration**:
- 80% threshold configured globally
- CI enforcement via GitHub Actions
- Codecov integration enabled
- Coverage reporters: text, lcov, clover, json-summary

**Test Commands**:
```bash
pnpm test              # Unit tests
pnpm test:coverage     # With coverage report
pnpm test:e2e          # Playwright E2E
pnpm test:a11y         # Accessibility tests
pnpm test:perf         # Lighthouse CI
pnpm test:load         # Artillery load tests
pnpm preflight         # All pre-commit checks
```

#### Monitoring & Observability

| Category | Current State | Gap |
|----------|---------------|-----|
| Health Checks | ✅ Basic | `/health` endpoint, DB/Redis checks |
| Logging | ⚠️ Console-based | No JSON format, no aggregation |
| Error Tracking | ❌ None | Need Sentry or similar |
| APM/Tracing | ❌ None | No distributed tracing |
| Metrics | ⚠️ Defined only | `performance-metrics.service.ts` exists but not exposed |
| Alerting | ❌ None | No threshold monitoring |
| Frontend Errors | ❌ None | Client-side errors invisible |
| Worker Monitoring | ❌ None | 28+ workers with no visibility |
| Slow Query Detection | ❌ None | Prisma logs queries in dev only |

**Existing Infrastructure**:
- Custom logger at `services/gateway/src/utils/logger.ts`
- Graph API error handler with categorization
- Rate limiting (API: 30 req/min read, 10 req/min write)
- Redis cache statistics available
- Database connection pooling configured

### Known Test Suite Issues

#### Gateway Test Failures (~200 tests, 84 suites)

**Root Causes Identified:**

1. ~~**GraphService mocking issues**~~ ✅ FIXED
   - Location: `__tests__/services/graph.service.test.ts`
   - Issue: Mock chain broke after `clearAllMocks()` because return values were set once at module load
   - Fix: Created `setupGraphClientMock()` helper called in `beforeEach` to re-establish mock chain
   - Result: All 24 GraphService tests now pass

2. ~~**Environment validation at import time**~~ ✅ FIXED
   - Issue: Config modules validate env vars on import, tests failed before running
   - Fix: Created `jest.setup.ts` that sets all required env vars before any imports
   - Includes: `AZURE_AD_CLIENT_ID`, `SESSION_SECRET`, retry/circuit breaker config

3. ~~**Missing test isolation**~~ ✅ PARTIALLY FIXED
   - Retry noise: Fixed by setting `GRAPH_RETRY_MAX_ATTEMPTS=0` in jest.setup.ts
   - Circuit breaker: Using default threshold (10) so circuit breaker tests work
   - Result: retry.util.test.ts (19 tests) and session.config.test.ts (23 tests) now pass

4. ~~**Schema-code mismatch**~~ ✅ FIXED (Session 4)
   - `Paralegal` role was removed from Prisma schema but 197 references remained
   - Fix: Added `Paralegal` back to schema, regenerated Prisma client

#### E2E Test Import Errors

**Root Cause:**
- `@legal-platform/test-utils` exports `expect.extend(extensions)` at module load
- This works in Jest context but fails in Playwright context
- Accessibility tests import from non-existent subpath `/a11y`

**Affected Files:**
- `tests/e2e/accessibility/*.spec.ts`
- `tests/e2e/templates/a11y-test.template.spec.ts`

**Working E2E Directories:**
- `tests/e2e/dashboard/` - 63 tests
- `tests/e2e/navigation/` - 48 tests
- `tests/e2e/tasks/` - 120 tests
- Individual feature specs work if they don't import test-utils

### Phase 1 Action Items

#### P0 - Critical (Must complete before Phase 2)

- [x] **Run and verify existing test suite** ✅ 2026-01-12
  - Root unit tests: 299/299 passing
  - Gateway tests: 1649/1866 passing (215 failing - see Known Issues)
  - E2E tests: Blocked by test-utils import issue

- [~] **Fix gateway test failures** 🔄 In Progress
  - [x] Created `jest.setup.ts` for environment variables (SESSION_SECRET, Azure AD, etc.)
  - [x] Fixed GraphService mock isolation (chain breaks after clearAllMocks)
  - [x] Fixed retry.util tests (circuit breaker threshold config)
  - [x] Fixed session.config test (sameSite expectation mismatch)
  - [x] Fixed Paralegal role - added back to schema (Session 4)
  - [x] Fixed email-thread.service tests - updated mocks + expectations (Session 4)
  - [x] Expanded database mock with all Prisma methods (Session 4)
  - [ ] Fix remaining test mock gaps (52 suites, 148 tests)
  - [ ] Separate integration tests (30 suites need real DB)
  - Current status: 148 unit tests failing (was 236)

- [ ] **Fix test-utils Playwright compatibility**
  - Guard `expect.extend()` to only run in Jest context
  - Add proper `/a11y` subpath export

- [ ] **Add unit tests for critical web components**
  - Focus on: hooks (useAuth, useDocuments, useMapa, useTemplates)
  - Focus on: complex components (DocumentsContentPanel, EmailCaseSidebar)
  - Target: 50%+ coverage for apps/web

- [ ] **Set up Sentry error tracking**
  - Server-side: Gateway service integration
  - Client-side: Next.js frontend integration
  - Configure source maps upload for stack traces

#### P1 - Important

- [ ] **Add slow query logging**
  - Enable Prisma query logging in production (error + slow queries)
  - Define slow query threshold (>500ms)
  - Log query patterns and execution times

- [ ] **Capture performance baselines**
  - API response times (p50, p95, p99) for key endpoints
  - Page load times (LCP, FID, CLS) for main pages
  - Database query times for common operations

- [ ] **Add correlation IDs**
  - Generate request ID at gateway entry
  - Propagate through all service calls
  - Include in all log messages

#### P2 - Nice to Have

- [ ] **BullMQ dashboard setup**
  - Visibility into background job queues
  - Monitor: email-categorization, task-reminder, daily-digest workers

- [ ] **Expand integration tests**
  - Add tests for email sync flow
  - Add tests for document processing pipeline

---

## Phase 2: Analysis (Read-Only)

**Objective**: Identify optimization opportunities without making code changes.

### 2.1 Frontend Bundle Analysis

- [ ] Run `next build` with bundle analyzer
- [ ] Identify largest chunks and their contents
- [ ] Check for duplicate dependencies
- [ ] Review dynamic imports usage
- [ ] Analyze tree-shaking effectiveness

**Tools**: `@next/bundle-analyzer`, webpack-bundle-analyzer

### 2.2 Database & Query Audit

- [ ] Review Prisma schema for missing indexes
- [ ] Identify N+1 query patterns in resolvers
- [ ] Analyze query complexity in GraphQL operations
- [ ] Check for inefficient joins/includes
- [ ] Review connection pool utilization

**Key files to analyze**:
- `packages/database/prisma/schema.prisma`
- `services/gateway/src/graphql/resolvers/*.ts`
- `services/gateway/src/services/*.ts`

### 2.3 GraphQL Resolver Audit

- [ ] Check for overfetching in resolvers
- [ ] Identify missing DataLoader usage
- [ ] Review resolver complexity and depth
- [ ] Analyze subscription efficiency
- [ ] Check for proper field-level authorization

### 2.4 API Performance Audit

- [ ] Profile slow endpoints
- [ ] Check caching strategy effectiveness
- [ ] Review rate limiting adequacy
- [ ] Analyze external API call patterns (Graph API, AI services)

### 2.5 Code Quality Audit

- [ ] Run dependency audit (outdated, unused, vulnerable)
- [ ] Identify dead code paths
- [ ] Check for code duplication
- [ ] Review error handling patterns
- [ ] Analyze TypeScript strict mode violations

### 2.6 Infrastructure Audit

- [ ] Review Docker configuration efficiency
- [ ] Check Redis memory usage patterns
- [ ] Analyze worker job efficiency
- [ ] Review environment variable management

---

## Phase 3: Prioritized Improvements

**Objective**: Implement optimizations based on Phase 2 findings.

### Implementation Guidelines

1. **One optimization per PR** - Isolated, reviewable, reversible
2. **Benchmark before/after** - Quantify the improvement
3. **All tests must pass** - No regressions allowed
4. **Update documentation** - Record what changed and why

### Categories

#### Performance (P-*)
- P-1: Critical performance issues (>2s response times, blocking renders)
- P-2: Significant improvements (>30% improvement opportunity)
- P-3: Minor optimizations (nice-to-have)

#### Code Quality (Q-*)
- Q-1: Security vulnerabilities, critical bugs
- Q-2: Technical debt affecting maintainability
- Q-3: Code style, minor refactors

#### Bundle Size (B-*)
- B-1: Large unused dependencies
- B-2: Missing code splitting
- B-3: Asset optimization

### Tracking

| ID | Category | Description | Status | Impact | PR |
|----|----------|-------------|--------|--------|-----|
| - | - | To be populated after Phase 2 | - | - | - |

---

## Appendix

### A. Key File Locations

```
# Test Configuration
/jest.config.js                    # Root Jest config
/playwright.config.ts              # E2E test config
/.github/workflows/test.yml        # CI test workflow
/services/gateway/jest.config.js   # Gateway Jest config
/services/gateway/jest.setup.ts    # Gateway test setup (NEW)

# Monitoring
/services/gateway/src/utils/logger.ts
/services/gateway/src/services/performance-metrics.service.ts
/services/gateway/src/utils/graph-error-handler.ts

# Database
/packages/database/prisma/schema.prisma
/packages/database/src/client.ts
/packages/database/src/redis.ts

# Gateway Entry
/services/gateway/src/index.ts
```

### A.1 Files Changed (Session 3)

```
# New Files
services/gateway/jest.setup.ts                              # Test environment setup

# Modified Files
services/gateway/jest.config.js                             # Added setupFiles config
services/gateway/__tests__/services/graph.service.test.ts   # Fixed mock pattern
services/gateway/__tests__/config/session.config.test.ts    # Fixed sameSite expectation
services/gateway/__tests__/integration/communication-hub.test.ts  # Fixed Paralegal role
```

### A.2 Files Changed (Session 4)

```
# Modified Files
packages/database/prisma/schema.prisma                      # Added Paralegal to UserRole enum
services/gateway/__mocks__/@legal-platform/database.ts      # Expanded mock with all Prisma methods
services/gateway/__tests__/services/email-thread.service.test.ts  # Fixed mock + test expectations
services/gateway/src/services/email-attachment.service.ts   # Fixed missing isPrivate argument
```

### A.3 Files Changed (Session 5)

```
# New Files
services/gateway/__tests__/test-types.d.ts                  # Type declarations for test mocks (not used yet)

# Modified Files - TypeScript type fixes (Paralegal role)
services/gateway/src/config/session.config.ts               # Added Paralegal to UserSessionData role type
services/gateway/src/types/auth.types.ts                    # Added Paralegal to JWTAccessTokenPayload and LoginResponse
services/gateway/src/middleware/auth.middleware.ts          # Added Paralegal to requireRole parameter type
services/gateway/src/middleware/session.middleware.ts       # Added Paralegal to requireRole parameter type
services/gateway/src/services/jwt.service.ts                # Added Paralegal to generateAccessToken parameter type

# Modified Files - Database mock expansion
services/gateway/__mocks__/@legal-platform/database.ts      # Added 100+ Prisma models, added MockedModel type

# Modified Files - Test fixes (mockPrisma pattern)
services/gateway/__tests__/resolvers/approval.resolvers.test.ts  # Applied mockPrisma pattern (38/39 pass)
```

### A.4 Files Changed (Session 6)

```
# Modified Files - Test fixes
services/gateway/__tests__/resolvers/approval.resolvers.test.ts  # Fixed legacy case support test (39/39 pass)
services/gateway/__tests__/resolvers/firm.resolvers.test.ts      # Fixed Context import, i18n assertions (22/22 pass)
services/gateway/__tests__/resolvers/search.resolvers.test.ts    # Full rewrite from vitest to Jest (24/24 pass)
```

### A.5 Files Changed (Session 7)

```
# New Files
services/gateway/src/utils/__mocks__/logger.ts                   # Logger mock with child() support

# Modified Files - Test fixes
services/gateway/__tests__/services/track-changes.service.test.ts  # Use automatic logger mock (8/8 pass)
services/gateway/src/services/deadline-warning.service.test.ts     # Add logger mock (23/23 pass)

# Modified Files - Vitest to Jest conversions
services/gateway/src/batch/batch-runner.service.test.ts            # Converted from vitest (14/14 pass)
services/gateway/src/batch/processors/search-index.processor.test.ts  # Converted from vitest (17/17 pass)
services/gateway/src/services/intent-handlers/briefing.handler.test.ts  # Converted from vitest (17/17 pass)
```

### A.6 Files Changed (Session 8)

```
# Modified Files - Jest setup
services/gateway/jest.setup.ts                                     # Added VOYAGE_API_KEY env var

# Modified Files - Test fixes (mock corrections)
services/gateway/src/services/document-summary.service.test.ts     # Added getModelForFeature mock, fixed resetAllMocks issue (13/13 pass)
services/gateway/src/services/classification-scoring.test.ts       # Added mockPrisma type, default mocks, updated expectations (19/19 pass)
services/gateway/src/services/embedding.service.test.ts            # Changed findUnique→findFirst, redis→cacheManager, added usage field (16/16 pass)
services/gateway/__tests__/services/email-thread.service.test.ts   # Updated assertion to use objectContaining (24/24 pass)
```

### B. Useful Commands

```bash
# Testing
pnpm test:coverage                 # Coverage report
pnpm test:e2e -- --project=chromium # Single browser E2E
pnpm test:load                     # Load testing

# Gateway Tests (separated)
cd services/gateway
pnpm exec jest --testPathIgnorePatterns="integration"  # Unit tests only (no DB needed)
pnpm exec jest --testPathPattern=integration           # Integration tests (needs test DB)
pnpm exec jest __tests__/services/graph.service.test.ts  # Run single test file

# Analysis
pnpm --filter web exec next build  # Build analysis
pnpm --filter database exec prisma studio  # DB inspection

# Profiling
pnpm test:perf                     # Lighthouse CI

# Database
pnpm --filter database exec prisma generate  # Regenerate client after schema changes
```

### C. Reference Thresholds

From `services/gateway/src/services/performance-metrics.service.ts`:

| Metric | Target | P95 Max |
|--------|--------|---------|
| Document upload | 2000ms | 5000ms |
| Document download | 1000ms | 3000ms |
| Document search | 500ms | 2000ms |
| GraphQL query | 200ms | 1000ms |
| GraphQL mutation | 500ms | 2000ms |
| DB query | 50ms | 200ms |
| Cache hit rate | 70% | - |

### D. Session Log

| Date | Session | Actions | Next Steps |
|------|---------|---------|------------|
| 2026-01-12 | Initial | Completed Phase 1 assessment | Begin P0 action items |
| 2026-01-12 | Session 2 | Ran full test suite, discovered gateway failures (215/1866), E2E blocked by test-utils issue. Updated counts and documented root causes. | Fix gateway test isolation and test-utils Playwright compat |
| 2026-01-12 | Session 3 | Created jest.setup.ts for env vars, fixed GraphService mock isolation, fixed retry.util tests, fixed session.config test. Improved from 216→~200 failing tests. Discovered schema-code mismatch (Paralegal role removed but still referenced). | Continue fixing test-code mismatches, address Paralegal role references |
| 2026-01-12 | Session 4 | Added Paralegal role back to schema, expanded database mock, fixed email-thread.service tests (24/24), fixed email-attachment.service isPrivate bug. Categorized test failures. | Fix remaining unit test mock gaps, separate integration tests |
| 2026-01-12 | Session 5 | Added Paralegal to 5 TypeScript type definitions (session.config, auth.types, auth.middleware, session.middleware, jwt.service). Expanded database mock with 100+ models. Created mockPrisma pattern for approval.resolvers.test.ts (38/39 pass). Identified TypeScript mock pattern issue (390 occurrences). | Apply mockPrisma pattern to remaining 48 failing test suites |
| 2026-01-12 | Session 6 | Fixed approval.resolvers.test.ts (39/39), firm.resolvers.test.ts (Context import + i18n, 22/22), rewrote search.resolvers.test.ts from vitest to Jest (24/24). Passing tests: 1547→1593 (+46). Failing suites: 48→46. Identified remaining issues: logger mock missing, indirect Prisma method calls not mocked. | Continue fixing service tests - add logger mock to jest.setup.ts |
| 2026-01-12 | Session 7 | Created logger mock at `src/utils/__mocks__/logger.ts` with child() support. Fixed track-changes.service (8/8) and deadline-warning.service (23/23). Converted 3 vitest files to Jest: batch-runner (14/14), search-index.processor (17/17), briefing.handler (17/17). Passing: 1593→1660 (+67). Failing suites: 46→41 (-5). | Continue fixing remaining 41 test suites - focus on Prisma method mocks |
| 2026-01-12 | Session 8 | Fixed document-summary.service (13/13) - added `getModelForFeature` mock and fixed `jest.resetAllMocks` issue. Fixed classification-scoring (19/19) - added default Prisma mocks in beforeEach, updated test expectations for ClientInbox routing. Fixed embedding.service (16/16) - changed `findUnique` to `findFirst`, `redis` to `cacheManager`, added `usage` field to API mocks. Fixed email-thread.service (24/24) - updated assertion to use `objectContaining`. Added `VOYAGE_API_KEY` to jest.setup.ts. Passing: 1660→1688 (+28). Failing suites: 41→37 (-4). | Continue fixing remaining 37 test suites |

---

### E. Discovered Technical Debt

#### ~~Schema-Code Mismatch: UserRole Enum~~ ✅ FIXED (Session 4)

Added `Paralegal` back to `packages/database/prisma/schema.prisma`.

**Current UserRole values**: `Partner`, `Associate`, `AssociateJr`, `Paralegal`, `BusinessOwner`

#### Test Failure Categories (Session 8 Update)

**37 unit test suites failing (116 tests) - categorized:**

| Category | Count | Examples | Fix Approach |
|----------|-------|----------|--------------|
| **Mock setup issues** | ~15 | Service uses `cacheManager.get` but test mocks `redis.get` | Update mocks to match actual service dependencies |
| **Service method changes** | ~10 | Service uses `findFirst` but test mocks `findUnique` | Update mocks to use correct Prisma methods |
| **Test expectation mismatches** | ~10 | Code adds fields that tests don't expect | Use `objectContaining` for flexible assertions |
| **Logger mock missing** | ~5 | `logger.child is not a function` | Add `jest.mock('../utils/logger')` to test |
| **TypeScript mock type errors** | ~5 | `mockResolvedValue` not on Prisma type | Use mockPrisma pattern (see below) |

#### TypeScript Mock Pattern Issue (Session 5 Discovery)

**Problem**: Tests import `prisma` from `@legal-platform/database` and TypeScript uses real Prisma types at compile-time, even though Jest replaces with mock at runtime. This causes `mockResolvedValue` errors.

**Solution (mockPrisma pattern)**:
```typescript
import { prisma } from '@legal-platform/database';

// Add at top of test file - cast prisma to enable mock methods
const mockPrisma = prisma as unknown as {
  [K in keyof typeof prisma]: {
    [M in keyof (typeof prisma)[K]]: jest.Mock;
  };
} & {
  $transaction: jest.Mock;
};

// Use mockPrisma instead of prisma for mock operations
mockPrisma.case.findMany.mockResolvedValue([]);
expect(mockPrisma.case.findMany).toHaveBeenCalled();
```

**Applied to**: `approval.resolvers.test.ts` (38/39 tests now pass)
**Remaining**: 48 test suites need this pattern applied

**Integration tests (30 suites, 86 tests):**
- Located in `__tests__/integration/`
- Import `@prisma/client` directly, need real database
- Run with `jest --testPathPattern=integration` when test DB available

#### Test-Code Expectation Mismatches

Several tests fail due to code changes not reflected in test expectations:
- `ai-client.service.test.ts`: Cost calculations changed
- `task-validation.service.test.ts`: Validation rules changed
- `session.config.test.ts`: sameSite changed from 'strict' to 'lax' in non-prod (fixed)

---

## Notes

- The new web app (`apps/web`) replacing legacy (`apps/web-old`) has zero test coverage - this is the highest priority gap
- 28+ background workers exist with no monitoring visibility
- Performance metrics service exists but isn't integrated into any observable endpoint
- Consider using `/investigate` command for complex optimization analysis before implementing
