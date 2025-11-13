# @legal-platform/test-utils

Shared testing utilities for the Legal Platform monorepo.

## Overview

This package provides reusable testing utilities, custom renders, test data factories, and helpers for writing tests across the entire monorepo.

## Current Status

This package provides **foundational testing infrastructure**. Some components are fully implemented, while others are intentionally placeholder implementations that will be extended as the application grows.

### ✅ Fully Implemented

- **Test Data Factories**: Complete factories for User, Case, Document, and Task entities with Romanian language support
- **Helper Utilities**: Form helpers, toast helpers, wait utilities
- **Mock Factories**: Azure AD authentication mocks
- **Database Utilities**: Test database connection and cleanup utilities (implementation pending actual ORM setup)
- **Accessibility Utilities**: axe-core integration for WCAG AA compliance testing

### 🚧 Placeholder Implementations

These utilities have interfaces and basic implementations but need to be extended as corresponding application features are developed:

#### `renderWithProviders`

**Current State**: Returns a simple div wrapper with data attributes

**Future Implementation**: Will wrap components with actual providers as they are implemented:

- [ ] React Query (QueryClientProvider)
- [ ] Zustand stores
- [ ] Next.js router mock
- [ ] Theme provider
- [ ] i18n provider

**How to Use Now**:

```tsx
// For simple components without provider dependencies
import { render } from '@testing-library/react';
render(<Button>Click me</Button>);

// For consistency and future-proofing
import { renderWithProviders } from '@legal-platform/test-utils';
renderWithProviders(<Dashboard />, {
  initialRoute: '/dashboard',
  themeMode: 'dark'
});
```

**How to Extend**: See inline documentation in `src/renders/with-providers.tsx`

#### Database Utilities

**Current State**: Basic connection helpers with mock client

**Future Implementation**: Will use actual database client (Prisma, Drizzle, or direct pg) once schema is implemented

## Installation

```bash
pnpm add @legal-platform/test-utils --workspace
```

## Usage

### Test Data Factories

Create realistic test data with factory functions:

```tsx
import {
  createPartner,
  createActiveCase,
  createContract,
  createResearchTask
} from '@legal-platform/test-utils';

const partner = createPartner({
  email: 'partner@test.com',
  firstName: 'Ion',
  lastName: 'Popescu'
});

const activeCase = createActiveCase();
const contract = createContract({ caseId: activeCase.id });
```

All factories support:
- Default realistic data generation
- Override capabilities for specific scenarios
- Romanian names and addresses with diacritics (ă, â, î, ș, ț)
- Type-safe entity creation

### Custom Renders

```tsx
import { renderWithProviders, screen } from '@legal-platform/test-utils';

test('renders with providers', () => {
  renderWithProviders(<MyComponent />, {
    themeMode: 'dark',
    locale: 'ro-RO'
  });

  expect(screen.getByRole('button')).toBeInTheDocument();
});
```

### Helper Utilities

```tsx
import {
  waitForLoadingToFinish,
  fillForm,
  expectToastMessage
} from '@legal-platform/test-utils';

test('submits form successfully', async () => {
  render(<ContactForm />);

  fillForm({
    'First Name': 'Ion',
    'Last Name': 'Popescu',
    'Email': 'ion@test.com'
  });

  await userEvent.click(screen.getByRole('button', { name: /submit/i }));
  await waitForLoadingToFinish();

  expectToastMessage('Form submitted successfully');
});
```

### Accessibility Testing

```tsx
import { testA11y } from '@legal-platform/test-utils';

test('passes accessibility checks', async () => {
  const { container } = render(<Dashboard />);
  await testA11y(container);
});
```

## Development

### Build

```bash
pnpm build
```

### Test

```bash
pnpm test
```

### Type Check

```bash
pnpm type-check
```

## File Structure

```
packages/shared/test-utils/
├── src/
│   ├── factories/          # Test data factories
│   │   ├── user.factory.ts
│   │   ├── case.factory.ts
│   │   ├── document.factory.ts
│   │   ├── task.factory.ts
│   │   └── index.ts
│   ├── renders/            # Custom RTL renders
│   │   ├── with-providers.tsx
│   │   └── index.ts
│   ├── helpers/            # Test utilities
│   │   ├── wait-for.ts
│   │   ├── form-helpers.ts
│   │   ├── toast-helpers.ts
│   │   └── index.ts
│   ├── mocks/              # Mock factories
│   │   ├── azure-ad.ts
│   │   └── index.ts
│   ├── database.ts         # Database utilities
│   ├── a11y.ts            # Accessibility helpers
│   └── index.ts
├── templates/              # Example test templates
│   ├── unit-test.template.tsx
│   ├── integration-test.template.tsx
│   └── e2e-test.template.spec.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Contributing

When extending this package:

1. **Adding Factories**: Follow the pattern in existing factories. Include Romanian language support.
2. **Extending Providers**: Update `renderWithProviders` in `src/renders/with-providers.tsx` and this README.
3. **Adding Helpers**: Place in `src/helpers/` and export from index.ts.
4. **Tests**: All utilities should have corresponding test coverage.

## Related Documentation

- [TESTING.md](../../../TESTING.md) - Comprehensive testing guide
- [Architecture: Testing Strategy](../../../docs/architecture/testing-strategy.md) - Testing philosophy
- [Architecture: Coding Standards](../../../docs/architecture/coding-standards.md) - Code quality standards

## License

Private - Legal Platform Project
