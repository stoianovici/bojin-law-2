# Contributing to Legal Platform

Thank you for contributing to the Legal Platform project! This document outlines our development workflow and standards.

## Table of Contents

- [Git Workflow](#git-workflow)
- [Commit Conventions](#commit-conventions)
- [Branch Naming](#branch-naming)
- [Pull Request Process](#pull-request-process)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)

## Git Workflow

We follow a **feature branch workflow** with the following principles:

1. **Main Branch Protection**: The `main` branch is protected and requires:
   - Pull request reviews before merging
   - All CI/CD checks to pass
   - Up-to-date branch with main

2. **Development Flow**:
   - Create a feature branch from `main`
   - Make your changes with clear, atomic commits
   - Push to your branch and create a pull request
   - Address review feedback
   - Merge after approval

## Commit Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification for clear and semantic commit messages.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: A new feature
  - Example: `feat(auth): add Azure AD authentication`
- **fix**: A bug fix
  - Example: `fix(document): resolve version comparison error`
- **docs**: Documentation changes
  - Example: `docs(readme): update setup instructions`
- **style**: Code style changes (formatting, missing semicolons, etc.)
  - Example: `style(ui): format button component`
- **refactor**: Code refactoring without changing functionality
  - Example: `refactor(api): simplify GraphQL resolver logic`
- **perf**: Performance improvements
  - Example: `perf(search): optimize vector search query`
- **test**: Adding or updating tests
  - Example: `test(task): add unit tests for task service`
- **chore**: Maintenance tasks, dependency updates
  - Example: `chore(deps): upgrade Next.js to 14.2.1`
- **build**: Build system or external dependency changes
  - Example: `build(turbo): configure build pipeline`
- **ci**: CI/CD configuration changes
  - Example: `ci(actions): add automated testing workflow`

### Scope

The scope is optional and should reference the affected package or service:
- `auth`, `document`, `task`, `ai`, `integration`, `notification`
- `ui`, `shared`, `database`, `config`, `logger`
- `web`, `admin`, `gateway`

### Subject

- Use imperative, present tense: "add" not "added" nor "adds"
- Don't capitalize the first letter
- No period (.) at the end
- Keep under 72 characters

### Body

- Explain **what** and **why**, not **how**
- Wrap at 72 characters
- Separate from subject with a blank line

### Footer

- Reference related stories or issues
  - `Story: 1.2`
  - `Closes #123`
  - `Fixes #456`
- Document breaking changes
  - `BREAKING CHANGE: description`

### Examples

#### Simple Commit
```
feat(document): add version comparison feature

Implements semantic version comparison for legal documents
with highlight diff visualization.

Story: 2.3
```

#### Bug Fix
```
fix(auth): prevent token expiration during active session

Adds token refresh logic before expiration when user is active.
Fixes session timeout issues reported by QA team.

Fixes #789
Story: 1.4
```

#### Breaking Change
```
refactor(api)!: change GraphQL schema for documents

BREAKING CHANGE: Document.versions field now returns
DocumentVersion[] instead of string[]. Clients must update
queries to access version.id and version.content.

Story: 3.1
```

## Branch Naming

Use descriptive branch names with the following prefixes:

- **feature/**: New features
  - Example: `feature/document-version-control`
- **bugfix/**: Bug fixes
  - Example: `bugfix/auth-token-expiration`
- **hotfix/**: Critical production fixes
  - Example: `hotfix/security-vulnerability-patch`
- **docs/**: Documentation updates
  - Example: `docs/api-documentation-update`
- **refactor/**: Code refactoring
  - Example: `refactor/simplify-graphql-resolvers`
- **test/**: Test additions or updates
  - Example: `test/add-integration-tests-task-service`
- **chore/**: Maintenance tasks
  - Example: `chore/upgrade-dependencies`

## Pull Request Process

1. **Before Creating PR**:
   - Ensure all tests pass: `pnpm test`
   - Run linting: `pnpm lint`
   - Verify build succeeds: `pnpm build`
   - Update documentation if needed
   - Self-review your code

2. **Creating the PR**:
   - Use the pull request template
   - Provide clear description and context
   - Link related story/issue
   - Add screenshots for UI changes
   - Mark as draft if work in progress

3. **Review Process**:
   - At least one approval required
   - Address all review comments
   - Keep PR scope focused and reasonable
   - Respond to feedback promptly

4. **After Approval**:
   - Ensure branch is up-to-date with main
   - Squash commits if requested
   - Merge using "Squash and Merge" strategy

## Code Standards

Please follow our coding standards documented in [docs/architecture/coding-standards.md](docs/architecture/coding-standards.md):

- **Type Sharing**: All types in `packages/shared/types`
- **No Direct HTTP Calls**: Use service layers
- **Environment Variables**: Access through config objects
- **Error Handling**: Use standard error handlers
- **Naming Conventions**:
  - Components: PascalCase (`UserProfile.tsx`)
  - API Routes: kebab-case (`/api/user-profile`)
  - Database Tables: snake_case (`user_profiles`)

## Testing Requirements

All code changes must include appropriate tests. We follow the **Testing Pyramid** strategy to ensure comprehensive coverage while maintaining test suite performance.

### Testing Pyramid

Our testing strategy follows this distribution:

- **70% Unit Tests**: Fast, isolated tests for functions, components, and services
- **20% Integration Tests**: Tests for API endpoints, database operations, and service interactions
- **10% E2E Tests**: Critical user workflows and complete application flows

### Test Types and When to Use Them

#### 1. Unit Tests

**Use For:**
- Individual React components in isolation
- Utility functions and helpers
- Custom hooks
- Business logic and data transformations
- State management (stores, reducers)

**Template:** `packages/shared/test-utils/templates/unit-test.template.tsx`

**Key Practices:**
- Test behavior, not implementation details
- Use accessible queries (`getByRole`, `getByLabel`)
- Mock external dependencies
- Keep tests focused and isolated
- Use `renderWithProviders()` for components needing context

**Example:**
```typescript
import { render, screen } from '@testing-library/react';

test('should display user name', () => {
  render(<UserProfile name="John Doe" />);
  expect(screen.getByText('John Doe')).toBeInTheDocument();
});
```

#### 2. Integration Tests

**Use For:**
- API endpoints with database connections
- GraphQL resolvers with data loaders
- Component integration with backend services
- Database operations and queries
- Multiple services working together
- Authentication and authorization flows

**Template:** `packages/shared/test-utils/templates/integration-test.template.tsx`

**Key Practices:**
- Use real test database connection
- Clean database between tests
- Use Supertest for API testing
- Test complete request/response cycles
- Verify HTTP status codes and response formats
- Use factories for test data creation

**Example:**
```typescript
import request from 'supertest';

describe('POST /api/cases', () => {
  it('should create new case', async () => {
    const response = await request(app)
      .post('/api/cases')
      .send({ title: 'New Case', clientId: '123' })
      .expect(201);

    expect(response.body.data).toHaveProperty('id');
  });
});
```

#### 3. E2E Tests

**Use For:**
- Complete user workflows (login → create case → upload document)
- AI features requiring full integration
- Multi-page navigation flows
- Cross-browser compatibility
- Critical business workflows
- Smoke testing after deployment

**Template:** `tests/e2e/templates/e2e-test.template.spec.ts`

**Key Practices:**
- Use Page Object Model pattern
- Test real user scenarios end-to-end
- Use accessible locators
- Run tests in parallel
- Capture screenshots/videos on failure
- Test authentication and sessions

**Example:**
```typescript
test('should create case and upload document', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.loginAsPartner();

  const dashboardPage = new DashboardPage(page);
  await dashboardPage.clickCreateCase();

  // Continue workflow...
});
```

#### 4. Accessibility Tests

**Use For:**
- WCAG 2.0/2.1/2.2 Level AA compliance
- Keyboard navigation
- Screen reader compatibility
- Color contrast ratios
- Focus management
- Semantic HTML structure
- ARIA labels and roles

**Template:** `tests/e2e/templates/a11y-test.template.spec.ts`

**Key Practices:**
- Test every page for a11y compliance
- Use `testA11y()` helper from test-utils
- Test keyboard navigation
- Verify focus management
- Check color contrast
- Zero violations policy

**Example:**
```typescript
import { testA11y } from '@legal-platform/test-utils/a11y';

test('should have no accessibility violations', async ({ page }) => {
  await page.goto('/dashboard');
  await testA11y(page, 'Dashboard');
});
```

#### 5. Performance Tests

**Use For:**
- Page load times
- Core Web Vitals (LCP, FID, CLS)
- Bundle size monitoring
- API response times
- Memory leak detection
- Rendering performance

**Template:** `tests/performance/template.spec.ts`

**Key Practices:**
- Set performance budgets
- Monitor Core Web Vitals
- Test on throttled networks
- Check bundle sizes
- Test mobile viewports
- Use Lighthouse CI for automation

**Example:**
```typescript
test('should load within performance budget', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('/dashboard');
  const loadTime = Date.now() - startTime;

  expect(loadTime).toBeLessThan(2000);
});
```

### Coverage Requirements

All code must meet these minimum coverage thresholds:

- **Statements**: 80%
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%

Coverage is enforced in CI pipeline and will fail if thresholds are not met.

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch

# Run tests for specific package
pnpm test --filter=@legal-platform/ui

# Run E2E tests
pnpm test:e2e

# Run E2E tests in UI mode (with visual debugger)
pnpm test:e2e:ui

# Run E2E tests in debug mode
pnpm test:e2e:debug

# Run E2E tests in headed mode (see browser)
pnpm test:e2e:headed

# Run accessibility tests
pnpm test:a11y

# Run performance tests
pnpm test:perf

# Run specific test file
pnpm test:e2e tests/e2e/auth/login.spec.ts

# Run Lighthouse CI
pnpm test:perf:collect
```

### Using Test Templates

Each test template provides comprehensive examples and best practices:

1. **Copy the template** to your test file location
2. **Rename** it to match the component/feature you're testing
3. **Adapt** the examples to your specific use case
4. **Follow** the patterns and best practices documented in the template

Templates include:
- Detailed comments explaining each pattern
- Multiple examples for common scenarios
- Best practices checklist
- Common pitfalls to avoid

### Test Data Factories

Use factories from `@legal-platform/test-utils/factories` to generate test data:

```typescript
import { createUser, createCase, createDocument } from '@legal-platform/test-utils/factories';

// Create user with defaults
const user = createUser();

// Create user with overrides
const partner = createUser({ role: 'Partner', firstName: 'Maria' });

// Create related entities
const caseData = createCase({ status: 'Active' });
const document = createDocument({ caseId: caseData.id });
```

Available factories:
- `createUser()` - User entities with all role variations
- `createCase()` - Case entities with all status types
- `createDocument()` - Document entities with all document types
- `createTask()` - Task entities with all 6 task types

All factories support:
- Default values following project standards
- Romanian names with diacritics for localization testing
- Override capabilities for specific test scenarios
- TypeScript type safety

### Test Utilities

Use helpers from `@legal-platform/test-utils`:

```typescript
import { renderWithProviders, waitForLoadingToFinish, fillForm } from '@legal-platform/test-utils';

// Render component with all providers
const { getByText } = renderWithProviders(<MyComponent />);

// Wait for loading states to complete
await waitForLoadingToFinish();

// Fill form fields
await fillForm({ name: 'John Doe', email: 'john@example.com' });
```

### Database Testing

For integration tests requiring database:

```typescript
import { cleanupDatabase, seedDatabase } from '@legal-platform/test-utils/database';

beforeEach(async () => {
  await cleanupDatabase(); // Clean before each test
});

afterAll(async () => {
  await closeDatabase(); // Close connection
});
```

Test database runs on port 5433 (separate from dev database on 5432).

### Debugging Tests

#### Debugging Unit Tests

```bash
# Run in watch mode with coverage
pnpm test:watch

# Debug in VS Code
# Add breakpoint and use "Jest: Debug" configuration
```

#### Debugging E2E Tests

```bash
# UI Mode (visual test runner)
pnpm test:e2e:ui

# Debug mode (step through)
pnpm test:e2e:debug

# Headed mode (see browser)
pnpm test:e2e:headed

# Add page.pause() in test to pause execution
await page.pause();
```

#### Debugging Failed Tests

1. **Check screenshots**: Failed E2E tests capture screenshots in `test-results/`
2. **Check videos**: Videos recorded on failure in `test-results/`
3. **Check trace**: Playwright traces available in `test-results/`
4. **View HTML report**: `pnpm test:e2e:report`
5. **Run single test**: Add `.only` to test: `test.only('...', ...)`

### CI/CD Integration

All tests run automatically on:

- **Every Pull Request**: Unit, integration, E2E, accessibility tests
- **Main Branch**: All tests + performance tests with Lighthouse CI
- **Status Checks**: All tests must pass before PR can be merged

### Best Practices Summary

✅ **DO:**
- Write tests before or alongside code (TDD/BDD)
- Test behavior, not implementation
- Use accessible queries
- Keep tests focused and isolated
- Mock external dependencies
- Clean up after tests
- Use descriptive test names
- Group related tests with `describe()`
- Test error scenarios
- Use factories for test data

❌ **DON'T:**
- Test implementation details
- Use test IDs unless absolutely necessary
- Write tests that depend on other tests
- Skip error cases
- Use hard-coded waits
- Test framework/library code
- Leave commented-out tests
- Skip flaky tests (fix them!)

### Test File Organization

```
packages/
  ui/src/
    components/
      Button.tsx
      Button.test.tsx          # Unit test co-located
      Button.a11y.test.tsx     # A11y test co-located
  shared/test-utils/
    src/
      factories/               # Test data factories
      helpers/                 # Test utilities
      templates/               # Test templates

tests/
  e2e/
    auth/                      # E2E tests by feature
    cases/
    documents/
    accessibility/             # Dedicated a11y tests
    templates/                 # E2E templates
  performance/                 # Performance tests
  fixtures/                    # Test fixtures and data
```

### Getting Help

- **Templates**: Comprehensive examples in `packages/shared/test-utils/templates/` and `tests/e2e/templates/`
- **Test Utils**: Helper functions documented in `packages/shared/test-utils/`
- **Factories**: Usage examples in factory test files
- **Documentation**: Testing best practices in template comments

### Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Web Vitals](https://web.dev/vitals/)

## Questions or Issues?

If you have questions or encounter issues:

1. Check existing documentation in `docs/`
2. Review related stories in `docs/stories/`
3. Ask in pull request comments
4. Contact the development team

---

Thank you for contributing to Legal Platform! Your efforts help build better tools for legal professionals.
