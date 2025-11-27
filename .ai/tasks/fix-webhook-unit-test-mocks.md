# Fix Webhook Service Unit Test Mocks (TEST-001)

**Issue ID:** TEST-001
**Severity:** Medium
**Status:** Deferred from Story 2.5 QA Review
**Date Created:** 2025-11-21
**Assigned To:** Future Dev Agent

## Problem Statement

The webhook service unit tests have mock configuration issues causing 8 out of 22 tests to fail. The root cause is a Jest lifecycle limitation where `jest.clearAllMocks()` in `beforeEach` clears mock implementations, breaking the Graph API client mock chain.

**Current Test Results:**
- ✅ 14/22 tests passing (64%)
- ❌ 8/22 tests failing (36%)
- ✅ Core functionality validated via 37 passing integration tests

## File Location

```
services/gateway/__tests__/services/webhook.service.test.ts
```

## Failing Tests

1. `createSubscription > should create a subscription successfully`
2. `createSubscription > should use environment variables for notification URL and client state`
3. `createSubscription > should use default localhost URL when WEBHOOK_BASE_URL not set`
4. `createSubscription > should handle Graph API errors during subscription creation`
5. `renewSubscription > should renew a subscription successfully`
6. `renewSubscription > should handle Graph API errors during renewal`
7. `deleteSubscription > should delete a subscription successfully`
8. `deleteSubscription > should handle Graph API errors during deletion`

## Error Messages

**Example Error (createSubscription tests):**
```
TypeError: Cannot read properties of undefined (reading 'id')

  92 |       const dbSubscription = await prisma.graphSubscription.create({
  93 |         data: {
> 94 |           subscriptionId: graphSubscription.id,
     |                                             ^
  95 |           resource: graphSubscription.resource,
```

**Example Error (deleteSubscription tests):**
```
expect(jest.fn()).toHaveBeenCalledWith(...expected)

Expected: "/subscriptions/graph-subscription-id-456"
Number of calls: 0
```

## Root Cause Analysis

### The Problem

The service implementation uses this call chain:
```typescript
// In webhook.service.ts
const client = Client.init({ authProvider: ... });
const graphSubscription = await client.api('/subscriptions').post(subscriptionRequest);
```

Expected mock chain:
1. `Client.init()` returns a client object
2. `client.api('/subscriptions')` returns an API builder object
3. `apiBuilder.post(data)` returns the response

### Current Mock Setup (Lines 28-52)

```javascript
jest.mock('@microsoft/microsoft-graph-client', () => {
  const mockApi = jest.fn();
  const mockPost = jest.fn();
  const mockPatch = jest.fn();
  const mockDelete = jest.fn();

  return {
    Client: {
      init: jest.fn(() => ({
        api: mockApi.mockReturnValue({
          post: mockPost,
          patch: mockPatch,
          delete: mockDelete,
        }),
      })),
    },
    __mockApi: mockApi,
    __mockPost: mockPost,
    __mockPatch: mockPatch,
    __mockDelete: mockDelete,
  };
});
```

### The Lifecycle Issue

```javascript
beforeEach(() => {
  jest.clearAllMocks(); // ⚠️ This clears ALL mocks including implementations

  // Environment setup
  process.env.WEBHOOK_BASE_URL = 'https://test-app.com';
  process.env.WEBHOOK_CLIENT_STATE = 'test-secret';

  webhookService = new WebhookService();
});
```

**What happens:**
1. Module mock is set up ONCE when Jest loads the test file
2. `mockReturnValue()` sets up the chain at module load time
3. `beforeEach` runs `jest.clearAllMocks()` which clears:
   - Mock call history ✅ (intended)
   - Mock return values set via `mockResolvedValue()` ✅ (intended)
   - Mock implementations and return value chains ❌ (unintended - breaks our mock)

## What's Been Tried

### Attempt 1: QA Reviewer's First Fix (Lines 35-39, 100-105)
```javascript
// Changed from mockReturnValue to mockImplementation
mockApi.mockImplementation(() => ({
  post: mockPost,
  patch: mockPatch,
  delete: mockDelete,
}));

// Tried re-setup in beforeEach
beforeEach(() => {
  jest.clearAllMocks();

  mockApi.mockImplementation(() => ({ // ⚠️ Gets cleared by clearAllMocks anyway
    post: mockPost,
    patch: mockPatch,
    delete: mockDelete,
  }));
});
```

**Result:** Still failed - `mockImplementation()` also gets cleared by `clearAllMocks()`

### Attempt 2: Dev Agent's Pattern from graph.service.test.ts
```javascript
// Tried using require() inside each test to get fresh mock references
it('should test something', () => {
  const { __mockPost } = require('@microsoft/microsoft-graph-client');
  __mockPost.mockResolvedValue(mockResponse);
  // ... test code
});
```

**Result:** Still failed - mock chain still broken after `clearAllMocks()`

## Successful Reference Implementation

File: `services/gateway/__tests__/services/graph.service.test.ts`

This file uses the SAME mock pattern and `jest.clearAllMocks()` but somehow works. Key differences to investigate:

```javascript
// graph.service.test.ts (WORKING)
jest.mock('@microsoft/microsoft-graph-client', () => {
  const mockApi = jest.fn();
  const mockGet = jest.fn();
  const mockPost = jest.fn();
  const mockTop = jest.fn();
  const mockOrderby = jest.fn();

  return {
    Client: {
      init: jest.fn(() => ({
        api: mockApi.mockReturnValue({
          get: mockGet,
          post: mockPost,
          top: mockTop.mockReturnValue({
            orderby: mockOrderby.mockReturnValue({
              get: mockGet,
            }),
            get: mockGet,
          }),
          orderby: mockOrderby.mockReturnValue({
            get: mockGet,
          }),
        }),
      })),
    },
    __mockApi: mockApi,
    __mockGet: mockGet,
    __mockPost: mockPost,
    __mockTop: mockTop,
    __mockOrderby: mockOrderby,
  };
});

beforeEach(() => {
  jest.clearAllMocks(); // Also uses clearAllMocks but works!
  // ...
});
```

**Why does graph.service.test.ts work but webhook.service.test.ts doesn't?**

## Potential Approaches to Fix

### Option 1: Remove jest.clearAllMocks() (Simple but Risky)

**Approach:**
```javascript
beforeEach(() => {
  // jest.clearAllMocks(); // Remove this line

  // Manually reset only what's needed
  mockGraphSubscriptionCreate.mockReset();
  mockGraphSubscriptionFindUnique.mockReset();
  mockGraphSubscriptionUpdate.mockReset();
  mockGraphSubscriptionFindMany.mockReset();

  // Don't reset Graph client mocks - let mockReturnValue chain persist
});
```

**Pros:**
- Simple fix
- Preserves mock chain set up in module mock

**Cons:**
- Mock call history accumulates across tests
- May cause test interdependencies
- Goes against Jest best practices

**Validation:**
- Run tests to ensure no cross-test pollution
- Check that each test still works in isolation

### Option 2: Restructure Mock Setup (More Complex but Cleaner)

**Approach:**
```javascript
// At module level - create mock factories
const createMockGraphClient = () => {
  const mockApi = jest.fn();
  const mockPost = jest.fn();
  const mockPatch = jest.fn();
  const mockDelete = jest.fn();

  mockApi.mockReturnValue({
    post: mockPost,
    patch: mockPatch,
    delete: mockDelete,
  });

  return { mockApi, mockPost, mockPatch, mockDelete };
};

jest.mock('@microsoft/microsoft-graph-client', () => {
  return {
    Client: {
      init: jest.fn(),
    },
  };
});

// In test suite
describe('WebhookService', () => {
  let mocks: ReturnType<typeof createMockGraphClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Re-create mock chain after clear
    mocks = createMockGraphClient();

    const { Client } = require('@microsoft/microsoft-graph-client');
    Client.init.mockReturnValue({
      api: mocks.mockApi,
    });
  });

  it('should test something', () => {
    mocks.mockPost.mockResolvedValue(mockResponse);
    // ... test code
  });
});
```

**Pros:**
- Follows Jest best practices
- Explicit mock setup in each test lifecycle
- No cross-test pollution

**Cons:**
- More verbose
- Requires restructuring entire test file

### Option 3: Use jest.resetAllMocks() Instead (Middle Ground)

**Approach:**
```javascript
beforeEach(() => {
  jest.resetAllMocks(); // Instead of clearAllMocks

  // Re-setup the chain
  const GraphClientModule = require('@microsoft/microsoft-graph-client');
  const { Client } = GraphClientModule;

  Client.init.mockReturnValue({
    api: GraphClientModule.__mockApi,
  });

  GraphClientModule.__mockApi.mockReturnValue({
    post: GraphClientModule.__mockPost,
    patch: GraphClientModule.__mockPatch,
    delete: GraphClientModule.__mockDelete,
  });
});
```

**Difference:**
- `clearAllMocks()`: Clears call history AND return values/implementations
- `resetAllMocks()`: Clears call history, return values, AND resets to initial state
- `restoreAllMocks()`: Only for spies, restores original implementation

### Option 4: Compare Byte-for-Byte with graph.service.test.ts

**Approach:**
1. Copy the EXACT mock setup from graph.service.test.ts
2. Adapt it to webhook.service.test.ts use case
3. Test incrementally to find the exact difference

**Steps:**
```bash
# Compare the two files
diff services/gateway/__tests__/services/graph.service.test.ts \
     services/gateway/__tests__/services/webhook.service.test.ts
```

**Focus areas:**
- Mock setup structure (lines 24-55 in graph.service.test.ts)
- beforeEach setup (lines 64-79 in graph.service.test.ts)
- How mocks are used in tests (line 225+ in graph.service.test.ts)

### Option 5: Hybrid Approach - Manual Mock Module

**Approach:** Create a manual mock file

```javascript
// __mocks__/@microsoft/microsoft-graph-client.js
const mockApi = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();
const mockGet = jest.fn();

const createClient = () => ({
  api: jest.fn((path) => ({
    post: mockPost,
    patch: mockPatch,
    delete: mockDelete,
    get: mockGet,
  })),
});

module.exports = {
  Client: {
    init: jest.fn(() => createClient()),
  },
  // Expose mocks for test control
  __mockApi: mockApi,
  __mockPost: mockPost,
  __mockPatch: mockPatch,
  __mockDelete: mockDelete,
  __mockGet: mockGet,
  __resetMocks: () => {
    mockApi.mockClear();
    mockPost.mockClear();
    mockPatch.mockClear();
    mockDelete.mockClear();
    mockGet.mockClear();
  },
};
```

Then in test file:
```javascript
beforeEach(() => {
  const GraphClient = require('@microsoft/microsoft-graph-client');
  GraphClient.__resetMocks(); // Custom reset that preserves chain
});
```

## Success Criteria

✅ **All 22 tests pass consistently**
- All `createSubscription` tests pass (4 tests)
- All `renewSubscription` tests pass (3 tests)
- All `deleteSubscription` tests pass (3 tests)
- All query tests remain passing (12 tests)

✅ **No test interdependencies**
- Tests pass when run individually: `npx jest -t "should create a subscription successfully"`
- Tests pass when run in suite: `npx jest webhook.service.test.ts`
- Tests pass when run in different orders

✅ **Mock isolation maintained**
- Each test gets clean mock state
- No call history leaks between tests
- Mock return values properly reset

## Testing Commands

```bash
# Run webhook service tests only
npx jest services/gateway/__tests__/services/webhook.service.test.ts --verbose --no-coverage

# Run single test
npx jest -t "should create a subscription successfully"

# Run with watch mode for development
npx jest webhook.service.test.ts --watch

# Clear cache if needed
npx jest --clearCache
```

## Reference Files

**Primary Files:**
- `services/gateway/__tests__/services/webhook.service.test.ts` - File to fix
- `services/gateway/src/services/webhook.service.ts` - Service implementation
- `services/gateway/__tests__/services/graph.service.test.ts` - Working reference

**Related Documentation:**
- `docs/qa/gates/2.5-microsoft-graph-api-integration-foundation.yml` - QA gate details
- `docs/stories/2.5.story.md` - Story context and previous fix attempts

**Jest Documentation:**
- https://jestjs.io/docs/mock-functions
- https://jestjs.io/docs/jest-object#jestclearallmocks
- https://jestjs.io/docs/manual-mocks

## Additional Context

**Core Functionality Status:**
- ✅ Service implementation is correct
- ✅ Integration tests validate real behavior (37 passing)
- ⚠️ Only unit test mocking is broken
- ✅ Production code is safe to deploy

**Why This Matters:**
- Unit tests provide fast feedback during development
- Mock issues make test-driven development harder
- Currently relying only on slower integration tests for coverage
- Reduces developer confidence when modifying webhook code

## Recommended Approach

**Step 1:** Start with Option 4 (Compare with graph.service.test.ts)
- Understand WHY it works when webhook tests don't
- Document the exact difference

**Step 2:** Try Option 1 (Remove clearAllMocks) as quick validation
- If it works, proves the hypothesis
- May or may not be acceptable as final solution

**Step 3:** Implement Option 2 or Option 5 for production-ready fix
- Choose based on team coding standards
- Ensure comprehensive testing

**Step 4:** Update documentation
- Document the chosen approach in test file comments
- Update story 2.5 with resolution
- Add learnings to team knowledge base

## Questions to Answer During Fix

1. What is the EXACT difference between graph.service.test.ts and webhook.service.test.ts that causes one to work and one to fail?
2. Does the working test file actually use a different Jest configuration?
3. Is there a version mismatch in @microsoft/microsoft-graph-client between what graph.service and webhook.service import?
4. Can we reproduce the issue in a minimal test case outside this project?

## Notes for Future Developer

- This is a test infrastructure issue, NOT a service logic bug
- Don't waste time debugging webhook.service.ts - it's correct
- Focus on the mock lifecycle and Jest configuration
- The QA reviewer and one dev agent have already attempted fixes
- Consider asking for help if stuck after 2 hours - this is a tricky Jest edge case

## Acceptance

- [ ] All 22 webhook.service.test.ts tests pass
- [ ] Tests pass in isolation and as suite
- [ ] No test interdependencies introduced
- [ ] Solution documented in test file comments
- [ ] Story 2.5 updated with resolution
- [ ] QA gate re-run shows TEST-001 resolved

---

**Good luck! This is a challenging Jest mocking problem, but solvable. The fact that graph.service.test.ts works proves there's a solution.** 🎯
