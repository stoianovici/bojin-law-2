# Testing Guide

> Comprehensive guide to testing the Legal Platform application

## Table of Contents

- [Overview](#overview)
- [Testing Philosophy](#testing-philosophy)
- [Testing Pyramid](#testing-pyramid)
- [Test Types](#test-types)
  - [Unit Tests](#unit-tests)
  - [Integration Tests](#integration-tests)
  - [End-to-End Tests](#end-to-end-tests)
  - [Accessibility Tests](#accessibility-tests)
  - [Performance Tests](#performance-tests)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Data](#test-data)
- [Debugging Tests](#debugging-tests)
- [Coverage](#coverage)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

This platform maintains a comprehensive test suite to ensure:

- **Code Quality**: All code is thoroughly tested before merge
- **Regression Prevention**: Changes don't break existing functionality
- **Confidence**: Deploy with confidence knowing tests pass
- **Documentation**: Tests serve as living documentation
- **Accessibility**: WCAG AA compliance is maintained
- **Performance**: Page load times stay within budgets

**Key Metrics:**

- **80% minimum coverage** requirement (statements, branches, functions, lines)
- **3 browsers tested** for E2E (Chromium, Firefox, WebKit)
- **Zero accessibility violations** policy
- **Performance score >= 90** for critical pages

## Testing Philosophy

Our testing approach follows these principles:

1. **Test Behavior, Not Implementation**: Focus on what users see and do
2. **Write Tests First**: TDD/BDD helps design better interfaces
3. **Keep Tests Simple**: Tests should be easy to understand and maintain
4. **Test Realistically**: Use real user scenarios and data
5. **Fail Fast**: Tests should provide quick, actionable feedback
6. **Maintain Tests**: Update tests when requirements change

## Testing Pyramid

We follow the **Testing Pyramid** strategy for optimal test suite performance:

```
      /\
     /  \      10% E2E Tests
    /____\     Critical user workflows, cross-browser
   /      \
  /        \   20% Integration Tests
 /          \  API endpoints, database, services
/____________\
              70% Unit Tests
              Components, functions, utilities
```

### Why This Distribution?

- **Unit Tests (70%)**
  - Fast execution (< 2 minutes for full suite)
  - Cheap to write and maintain
  - Pinpoint exact failures
  - Can run on every file save

- **Integration Tests (20%)**
  - Verify systems work together
  - Catch configuration issues
  - Test database interactions
  - Balance speed vs. coverage

- **E2E Tests (10%)**
  - Test critical business workflows
  - Verify real user experience
  - Catch UI regressions
  - Slowest but most comprehensive

## Test Types

### Unit Tests

**Purpose**: Test individual components, functions, and modules in isolation.

**Tools**:

- Jest 29+ (test runner and assertions)
- React Testing Library 14+ (component testing)
- @testing-library/jest-dom (DOM matchers)
- @testing-library/user-event (user interactions)

**Location**: Co-located with source files

```
packages/ui/src/atoms/Button.tsx
packages/ui/src/atoms/Button.test.tsx
```

**Template**: `packages/shared/test-utils/templates/unit-test.template.tsx`

**Example:**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

**When to Use**:

- Testing React components in isolation
- Testing utility functions and helpers
- Testing custom hooks
- Testing business logic
- Testing state management

**Best Practices**:

- Use accessible queries (`getByRole`, `getByLabelText`)
- Test user-visible behavior, not implementation
- Mock external dependencies (API calls, context)
- Keep tests focused on one thing
- Use `renderWithProviders()` for components needing context

### Integration Tests

**Purpose**: Test how multiple components, services, or systems work together.

**Tools**:

- Jest 29+ (test runner)
- Supertest 6.3+ (HTTP assertions)
- Real test database (PostgreSQL on port 5433)
- Test data factories

**Location**: Co-located or in dedicated test directories

```
services/document-service/src/api/routes.test.ts
services/document-service/src/repositories/document.integration.test.ts
```

**Template**: `packages/shared/test-utils/templates/integration-test.template.tsx`

**Example:**

```typescript
import request from 'supertest';
import { app } from '../app';
import { cleanupDatabase } from '@legal-platform/test-utils/database';

describe('POST /api/cases', () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it('should create new case with valid data', async () => {
    const response = await request(app)
      .post('/api/cases')
      .send({
        title: 'New Legal Case',
        clientId: 'client-123',
        type: 'CIV',
      })
      .expect(201)
      .expect('Content-Type', /json/);

    expect(response.body.data).toMatchObject({
      title: 'New Legal Case',
      clientId: 'client-123',
      status: 'Active',
    });
    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data).toHaveProperty('createdAt');
  });

  it('should return 400 for missing required fields', async () => {
    const response = await request(app)
      .post('/api/cases')
      .send({ title: 'Missing Client' })
      .expect(400);

    expect(response.body.error).toContain('clientId is required');
  });
});
```

**When to Use**:

- Testing API endpoints with database
- Testing GraphQL resolvers
- Testing service interactions
- Testing database operations
- Testing authentication flows

**Best Practices**:

- Use real test database (not mocks)
- Clean database before each test
- Use factories for test data
- Test complete request/response cycles
- Verify HTTP status codes
- Test error scenarios

### End-to-End Tests

**Purpose**: Test complete user workflows across the entire application stack.

**Tools**:

- Playwright 1.41+ (browser automation)
- Page Object Model pattern
- Test fixtures and data seeding

**Location**: Centralized in `tests/e2e/`

```
tests/e2e/auth/login.spec.ts
tests/e2e/cases/create-case.spec.ts
tests/e2e/documents/upload-document.spec.ts
```

**Template**: `tests/e2e/templates/e2e-test.template.spec.ts`

**Example:**

```typescript
import { test, expect } from '@playwright/test';

class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.getByLabel(/email/i).fill(email);
    await this.page.getByLabel(/password/i).fill(password);
    await this.page.getByRole('button', { name: /sign in/i }).click();
  }
}

class DashboardPage {
  constructor(private page: Page) {}

  async expectToBeOnDashboard() {
    await expect(this.page).toHaveURL(/\/dashboard/);
    await expect(this.page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  }
}

test.describe('Authentication', () => {
  test('user can log in and see dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.goto();
    await loginPage.login('partner@example.com', 'password123');
    await dashboardPage.expectToBeOnDashboard();
  });
});
```

**When to Use**:

- Testing critical user journeys
- Testing multi-page workflows
- Testing AI features
- Cross-browser compatibility
- Smoke testing deployments

**Best Practices**:

- Use Page Object Model
- Use accessible locators
- Run tests in parallel
- Capture screenshots on failure
- Test authentication and sessions
- Keep tests independent

### Accessibility Tests

**Purpose**: Ensure WCAG 2.0/2.1/2.2 Level AA compliance.

**Tools**:

- axe-core (automated a11y testing)
- @axe-core/playwright (Playwright integration)
- jest-axe (Jest integration)

**Location**: Co-located and in dedicated directory

```
packages/ui/src/atoms/Button.a11y.test.tsx
tests/e2e/accessibility/dashboard.spec.ts
```

**Template**: `tests/e2e/templates/a11y-test.template.spec.ts`

**Example:**

```typescript
import { test } from '@playwright/test';
import { testA11y } from '@legal-platform/test-utils/a11y';

test.describe('Dashboard Accessibility', () => {
  test('should have no accessibility violations', async ({ page }) => {
    await page.goto('/dashboard');
    await testA11y(page, 'Dashboard');
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/dashboard');

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should be able to activate button with Enter
    await page.keyboard.press('Enter');
  });
});
```

**When to Use**:

- Every page and component
- Forms and interactive elements
- Modals and dialogs
- Complex widgets (tables, editors)
- After UI changes

**Best Practices**:

- Test every page for violations
- Test keyboard navigation
- Verify focus management
- Check color contrast
- Test with screen readers occasionally
- Zero violations policy

### Performance Tests

**Purpose**: Ensure fast page loads and good Core Web Vitals.

**Tools**:

- Lighthouse CI (automated performance testing)
- Playwright (custom performance metrics)
- Performance API (browser metrics)

**Location**: `tests/performance/`

```
tests/performance/dashboard.spec.ts
tests/performance/case-detail.spec.ts
```

**Template**: `tests/performance/template.spec.ts`

**Example:**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Dashboard Performance', () => {
  test('should load within performance budget', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/dashboard', { waitUntil: 'load' });
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(2000); // < 2 seconds
  });

  test('should have good LCP', async ({ page }) => {
    await page.goto('/dashboard');

    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          resolve(lastEntry.renderTime || lastEntry.loadTime);
        }).observe({ entryTypes: ['largest-contentful-paint'] });
      });
    });

    expect(lcp).toBeLessThan(2500); // < 2.5 seconds
  });
});
```

**When to Use**:

- Critical pages (dashboard, case detail)
- After performance optimizations
- On main branch (not every PR)
- Before releases

**Best Practices**:

- Set performance budgets
- Monitor Core Web Vitals
- Test on throttled networks
- Check bundle sizes
- Test mobile viewports

## Running Tests

### All Tests

```bash
# Run all tests (unit + integration)
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch

# Run tests in CI mode
pnpm test:ci
```

### Unit Tests

```bash
# Run all unit tests
pnpm test

# Run tests for specific package
pnpm test --filter=@legal-platform/ui

# Run specific test file
pnpm test Button.test.tsx

# Run tests matching pattern
pnpm test --testNamePattern="Button"

# Update snapshots
pnpm test -- -u
```

### Integration Tests

```bash
# Start test database
docker-compose up -d postgres-test

# Run integration tests
pnpm test:integration

# Run specific integration test
pnpm test document.integration.test.ts
```

### E2E Tests

```bash
# Run all E2E tests (all browsers)
pnpm test:e2e

# Run in specific browser
pnpm test:e2e --project=chromium
pnpm test:e2e --project=firefox
pnpm test:e2e --project=webkit

# Run specific test file
pnpm test:e2e tests/e2e/auth/login.spec.ts

# Run with UI mode (visual debugger)
pnpm test:e2e:ui

# Run in debug mode (step through)
pnpm test:e2e:debug

# Run in headed mode (see browser)
pnpm test:e2e:headed

# Generate HTML report
pnpm test:e2e:report
```

### Accessibility Tests

```bash
# Run all accessibility tests
pnpm test:a11y

# Run UI package a11y tests
pnpm test:a11y:ui

# Run E2E a11y tests
pnpm test:e2e tests/e2e/accessibility/
```

### Performance Tests

```bash
# Run performance tests
pnpm test:perf

# Collect Lighthouse data
pnpm test:perf:collect

# Assert against budgets
pnpm test:perf:assert

# Upload results
pnpm test:perf:upload
```

## Writing Tests

### 1. Choose the Right Test Type

Use this decision tree:

```
Does it test user-visible behavior?
├─ Yes: Is it isolated to one component/function?
│  ├─ Yes: UNIT TEST
│  └─ No: Does it span multiple pages?
│     ├─ Yes: E2E TEST
│     └─ No: INTEGRATION TEST
└─ No: Don't test implementation details
```

### 2. Use Test Templates

Copy the appropriate template and adapt it:

```bash
# For unit tests
cp packages/shared/test-utils/templates/unit-test.template.tsx \
   packages/ui/src/components/MyComponent.test.tsx

# For E2E tests
cp tests/e2e/templates/e2e-test.template.spec.ts \
   tests/e2e/my-feature/workflow.spec.ts
```

### 3. Follow Test Structure

Use the **Arrange-Act-Assert** pattern:

```typescript
test('should do something', () => {
  // Arrange: Setup test data and conditions
  const user = createUser({ role: 'Partner' });
  render(<MyComponent user={user} />);

  // Act: Perform the action
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));

  // Assert: Verify the outcome
  expect(screen.getByText(/success/i)).toBeInTheDocument();
});
```

### 4. Write Descriptive Test Names

Good test names explain what's being tested:

```typescript
// ❌ Bad
test('button test', () => { ... });

// ✅ Good
test('should disable button when form is invalid', () => { ... });
test('should call onSubmit with form data when submitted', () => { ... });
```

### 5. Test Error Scenarios

Don't just test the happy path:

```typescript
describe('createCase', () => {
  it('should create case with valid data', () => { ... });

  it('should return error when title is missing', () => { ... });

  it('should return error when client does not exist', () => { ... });

  it('should handle network errors gracefully', () => { ... });
});
```

## Test Data

### Factories

Use factories to generate consistent test data:

```typescript
import { createUser, createCase, createDocument } from '@legal-platform/test-utils/factories';

// Create with defaults
const user = createUser();

// Override specific fields
const partner = createUser({
  role: 'Partner',
  firstName: 'Maria',
  lastName: 'Ionescu',
});

// Create related entities
const caseData = createCase({ assignedUserId: partner.id });
const document = createDocument({ caseId: caseData.id });
```

**Available Factories:**

- `createUser()` - Users with all role variations (Partner, Associate, Paralegal)
- `createCase()` - Cases with all status types (Active, OnHold, Closed, Archived)
- `createDocument()` - Documents with all types (Contract, Motion, Letter, etc.)
- `createTask()` - Tasks with all 6 task types

**Benefits:**

- Consistent test data across test suite
- Easy to create valid entities
- Support for Romanian names and localization
- TypeScript type safety
- Override capabilities for edge cases

### Database Seeding

For integration and E2E tests:

```typescript
import { seedDatabase, cleanupDatabase } from '@legal-platform/test-utils/database';

beforeEach(async () => {
  // Clean before each test
  await cleanupDatabase();

  // Seed with base data
  await seedDatabase({
    users: [createUser({ id: '1', role: 'Partner' })],
    cases: [createCase({ id: '1', assignedUserId: '1' })],
  });
});
```

### Mock Data

Use mocks for external dependencies:

```typescript
import { mockAzureAdToken, mockGraphQLResponse } from '@legal-platform/test-utils/mocks';

// Mock Azure AD authentication
const token = mockAzureAdToken({ userId: '123', role: 'Partner' });

// Mock API responses
jest.mock('./api', () => ({
  fetchCases: jest.fn().mockResolvedValue([
    { id: '1', title: 'Case 1' },
    { id: '2', title: 'Case 2' },
  ]),
}));
```

## Debugging Tests

### Unit Tests

**VS Code Debugging:**

1. Set breakpoint in test file
2. Use "Jest: Debug" configuration
3. Run test in debug mode

**Console Logging:**

```typescript
import { screen, debug } from '@testing-library/react';

test('example', () => {
  render(<MyComponent />);

  // Print DOM tree
  screen.debug();

  // Print specific element
  const button = screen.getByRole('button');
  console.log(button);
});
```

**Watch Mode:**

```bash
pnpm test:watch

# Press 'p' to filter by filename
# Press 't' to filter by test name
# Press 'a' to run all tests
```

### E2E Tests

**Playwright UI Mode (Recommended):**

```bash
pnpm test:e2e:ui

# Visual test runner with:
# - Watch mode
# - Time travel debugging
# - Network inspection
# - Screenshots/videos
```

**Debug Mode:**

```bash
pnpm test:e2e:debug

# Runs tests with Playwright Inspector
# Step through test line by line
```

**Headed Mode:**

```bash
pnpm test:e2e:headed

# See browser as tests run
# Useful for visual debugging
```

**Pause Execution:**

```typescript
test('example', async ({ page }) => {
  await page.goto('/dashboard');

  // Pause here - opens Playwright Inspector
  await page.pause();

  // Continue with test
  await page.click('button');
});
```

**Screenshots and Videos:**

Failed tests automatically capture:

- Screenshot at failure point
- Video of entire test run
- Playwright trace for time-travel debugging

Find them in `test-results/`:

```
test-results/
├── auth-login-chromium/
│   ├── test-failed-1.png
│   ├── video.webm
│   └── trace.zip
```

**View HTML Report:**

```bash
pnpm test:e2e:report

# Opens interactive HTML report with:
# - Test results
# - Screenshots
# - Videos
# - Traces
# - Error messages
```

### Common Issues

**Test Database Connection Errors:**

```bash
# Ensure test database is running
docker-compose up -d postgres-test

# Check database logs
docker-compose logs postgres-test

# Reset database
docker-compose restart postgres-test
```

**Port Already in Use:**

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill

# Or use different port
PORT=3001 pnpm test:e2e
```

**Flaky Tests:**

```typescript
// ❌ Don't use arbitrary waits
await page.waitForTimeout(1000);

// ✅ Wait for specific condition
await page.waitForSelector('[data-loaded="true"]');
await expect(page.getByText('Loaded')).toBeVisible();

// ✅ Use Playwright auto-waiting
await page.click('button'); // Waits for button to be clickable
```

## Coverage

### Requirements

All code must meet **80% minimum coverage** for:

- **Statements**: 80%
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%

### Viewing Coverage

```bash
# Generate coverage report
pnpm test:coverage

# Open HTML report
open coverage/lcov-report/index.html
```

### Coverage Reports

Coverage reports show:

- Overall coverage percentages
- Per-file coverage breakdown
- Uncovered lines highlighted
- Branch coverage visualization

### Excluding Files from Coverage

Some files don't need coverage:

```javascript
// jest.config.js
module.exports = {
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/.storybook/',
    '\\.test\\.',
    '\\.spec\\.',
    '/test-utils/templates/', // Templates are examples
  ],
};
```

### CI Coverage Enforcement

Coverage is enforced in CI:

- PR fails if coverage drops below 80%
- Coverage reports posted as PR comment
- Coverage trends tracked over time

## CI/CD Integration

### GitHub Actions Workflow

All tests run on:

- Every pull request
- Push to main branch
- Nightly builds

**Jobs:**

1. **Unit Tests** - Run on Node.js 20
2. **E2E Tests** - Run on 3 browsers
3. **Accessibility Tests** - Check WCAG compliance
4. **Lighthouse CI** - Performance tests (main branch only)

### Status Checks

Required checks before merge:

- ✓ Unit tests pass
- ✓ Integration tests pass
- ✓ E2E tests pass (all browsers)
- ✓ Coverage >= 80%
- ✓ No accessibility violations
- ✓ Performance within budgets (main branch)

### Test Results

Test results posted as PR comments:

- Coverage summary
- Changed files coverage
- Failed tests
- Screenshots/videos for failed E2E tests
- Lighthouse performance report

## Best Practices

### Do's ✅

- **Write tests first** (TDD) when possible
- **Test behavior**, not implementation
- **Use accessible queries** (`getByRole`, `getByLabel`)
- **Keep tests simple** and focused
- **Use factories** for test data
- **Mock external dependencies** (APIs, services)
- **Clean up after tests** (database, timers, mocks)
- **Write descriptive test names**
- **Group related tests** with `describe()`
- **Test error scenarios**
- **Test edge cases**
- **Update tests** when requirements change

### Don'ts ❌

- **Don't test implementation details** (state, internal methods)
- **Don't use test IDs** unless absolutely necessary
- **Don't write dependent tests** (test A requires test B)
- **Don't skip error cases**
- **Don't use arbitrary waits** (`waitForTimeout`)
- **Don't test framework/library code**
- **Don't leave commented-out tests**
- **Don't ignore flaky tests** - fix them!
- **Don't hardcode test data** - use factories
- **Don't test too many things** in one test

### Query Priority

Use this priority order for queries:

1. **getByRole** - Most accessible, prefer this
2. **getByLabelText** - Good for form fields
3. **getByPlaceholderText** - For inputs without labels
4. **getByText** - For non-interactive text
5. **getByDisplayValue** - Current form value
6. **getByAltText** - For images
7. **getByTitle** - For title attributes
8. **getByTestId** - Last resort only

## Troubleshooting

### Tests Timing Out

```typescript
// Increase timeout for slow tests
test('slow operation', async () => {
  // ...
}, 10000); // 10 second timeout

// Or in describe block
describe('slow tests', () => {
  jest.setTimeout(10000);

  test('test 1', () => { ... });
  test('test 2', () => { ... });
});
```

### Memory Leaks

```typescript
// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
  cleanup(); // React Testing Library
});

// Clear intervals/timeouts
afterEach(() => {
  jest.useRealTimers();
});
```

### Async Issues

```typescript
// ❌ Don't forget await
test('bad', () => {
  render(<AsyncComponent />);
  expect(screen.getByText('Loaded')).toBeInTheDocument(); // Fails!
});

// ✅ Use waitFor
test('good', async () => {
  render(<AsyncComponent />);
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });
});

// ✅ Or findBy queries (async)
test('also good', async () => {
  render(<AsyncComponent />);
  expect(await screen.findByText('Loaded')).toBeInTheDocument();
});
```

### Module Resolution

```typescript
// If imports fail, check tsconfig.json paths:
{
  "compilerOptions": {
    "paths": {
      "@legal-platform/*": ["packages/*/src"]
    }
  }
}

// And jest.config.js moduleNameMapper:
{
  moduleNameMapper: {
    '^@legal-platform/(.*)$': '<rootDir>/packages/$1/src'
  }
}
```

### E2E Selectors Not Found

```typescript
// ❌ Fragile - breaks on class changes
await page.click('.btn-primary');

// ✅ Accessible - stable selector
await page.getByRole('button', { name: /submit/i }).click();

// ✅ User-friendly - matches user perception
await page.getByLabel('Email').fill('user@example.com');
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library Query Priority](https://testing-library.com/docs/queries/about/#priority)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Web Vitals](https://web.dev/vitals/)
- [Test Templates](packages/shared/test-utils/templates/)

---

**Questions?** Check [CONTRIBUTING.md](CONTRIBUTING.md#testing-requirements) or ask the development team.
