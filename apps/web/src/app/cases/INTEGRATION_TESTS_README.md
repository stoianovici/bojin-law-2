# Integration Tests for Case CRUD Operations

## Story 2.8 - Task 20

This directory contains comprehensive integration tests for the Case CRUD Operations UI.

## Test Coverage

### Implemented Tests

1. **Case Creation Flow** (`page.integration.test.tsx`)
   - Complete case creation workflow
   - Form validation
   - Modal open/close behavior
   - Error handling

2. **Case Detail Page** (`[caseId]/page.integration.test.tsx`)
   - Data loading and display
   - Inline editing functionality
   - Team management operations
   - Case actors management

3. **Search and Filters** (`search-and-filters.integration.test.tsx`)
   - Real-time case search with highlighting
   - Status filtering
   - "Assigned to Me" filtering
   - URL persistence of filter state
   - Combined filters
   - Empty states

4. **Archival and Authorization** (`[caseId]/archival-and-authorization.integration.test.tsx`)
   - Case archival workflow
   - Partner-only access restrictions
   - Status validation (Closed cases only)
   - Error handling (FORBIDDEN, BAD_USER_INPUT)
   - Role-based UI visibility (Partner vs Associate vs Paralegal)

## Test Infrastructure

### Mock Service Worker (MSW)

GraphQL API mocking is configured using **MSW v1.3.x** (CommonJS compatible) with handlers in:

- `src/test-utils/mocks/graphql-handlers.ts` - Mock GraphQL queries and mutations
- `src/test-utils/mocks/server.ts` - MSW server setup

**Important:** This project uses MSW v1.3.x for Jest compatibility. MSW v2.x is ESM-only and caused significant compatibility issues with Jest's CommonJS environment. See [remediation plan](../../../../../docs/remediation-plans/jest-msw-integration-tests-fix.md) for details.

### Jest Configuration

Integration tests run in Jest's CommonJS mode with the following setup:

**Transform Setup:**

- `@swc/jest` for TypeScript and JavaScript transformation to CommonJS
- Next.js Jest configuration (`next/jest`) for framework integration
- Custom Jest config for workspace package aliasing

**Polyfills (in jest.setup.js):**

- `whatwg-fetch` - Fetch API polyfill
- `TextEncoder/TextDecoder` - Text encoding
- `ReadableStream/WritableStream/TransformStream` - Stream APIs
- `BroadcastChannel` - MSW requirement
- `ResizeObserver` - Radix UI requirement

**Status**: ✅ Infrastructure working. Integration tests are executable.

## Running Tests

To run all integration tests:

```bash
pnpm test integration.test
```

To run a specific integration test file:

```bash
pnpm test src/app/cases/page.integration.test.tsx
```

To run all tests (unit + integration):

```bash
pnpm test
```

## Environment Requirements

- Node.js 18+ (current: v22.20.0)
- `@swc/jest` and `@swc/core` packages installed
- MSW polyfills configured in `jest.setup.js`
- jsdom test environment

## Known Issues & Future Work

### Infrastructure

- [x] ~~MSW/Jest compatibility issue~~ - RESOLVED (downgraded to MSW v1.3.x)
- [ ] Consider MSW v2 migration when Jest ESM support stabilizes

### Test Implementation

- [ ] Fix integration test failures (mock data/assertions need adjustment)
- [ ] Improve integration test pass rate (current: varies, target: ≥80%)
- [ ] Add more comprehensive integration test scenarios
- [ ] Integrate with CI/CD pipeline

## Test Structure

All integration tests follow this pattern:

1. Setup MSW server with GraphQL handlers
2. Mock Next.js navigation and routing
3. Mock Zustand stores
4. Render components with Apollo Client provider
5. Simulate user interactions with @testing-library/user-event
6. Assert on GraphQL mutations and UI state changes

## Notes

- Tests use Apollo MockedProvider alternative (direct MSW handlers)
- All tests include proper cleanup (beforeEach/afterEach)
- Tests are isolated and can run independently
- Coverage targets: 70%+ for integration test scenarios
