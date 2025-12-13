# Project Conventions

This document captures implementation patterns and conventions used throughout the codebase. AI agents should follow these patterns when implementing new features or fixing bugs.

## Architecture Overview

```
legal-platform/
├── apps/
│   └── web/                 # Next.js frontend (App Router)
├── services/
│   └── gateway/             # Node.js GraphQL API
├── packages/
│   ├── ui/                  # Shared UI components
│   ├── database/            # Prisma schema and client
│   └── shared/              # Shared types and utilities
└── infrastructure/          # Docker, deployment configs
```

## Language & Localization

- **UI labels are in Romanian** - All user-facing text should be in Romanian
- Examples: "Reîmprospătează" (Refresh), "Configurează" (Configure), "Elimină" (Remove)
- Code comments and variable names remain in English

## Frontend Patterns (apps/web)

### Component Structure

```tsx
/**
 * ComponentName Component
 * Brief description of what it does
 */

'use client'; // Required for client components

import React, { type ReactNode, useState } from 'react';
import { clsx } from 'clsx';

// Types defined before component
export interface ComponentNameProps {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
  onAction?: () => void;
}

/**
 * JSDoc description for the component
 * @param id - Description of param
 * @param title - Description of param
 */
export function ComponentName({ id, title, children, className, onAction }: ComponentNameProps) {
  const [state, setState] = useState(false);

  return <div className={clsx('base-classes', className)}>{children}</div>;
}

ComponentName.displayName = 'ComponentName';
```

### Key Conventions

1. **Use `'use client'`** at the top of client components
2. **Use `clsx`** for conditional class names, not template literals
3. **Use Radix UI primitives** for complex UI (dropdowns, dialogs, etc.)
4. **Export interfaces** for component props
5. **Add `displayName`** to components
6. **Use JSDoc comments** for component documentation

### Hooks Pattern

```tsx
/**
 * Hook description
 * Story X.X: Feature Name (AC: 1, 2)
 */

import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import { useCallback, useState } from 'react';

// ============================================================================
// GraphQL Fragments
// ============================================================================

const FRAGMENT_NAME = gql`
  fragment FieldsName on TypeName {
    id
    field1
    field2
  }
`;

// ============================================================================
// Queries
// ============================================================================

const GET_DATA = gql`
  ${FRAGMENT_NAME}
  query GetData($id: ID!) {
    getData(id: $id) {
      ...FieldsName
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface DataType {
  id: string;
  field1: string;
}

// ============================================================================
// Hooks
// ============================================================================

export function useDataHook(id: string) {
  const { data, loading, error, refetch } = useQuery(GET_DATA, {
    variables: { id },
    skip: !id,
    fetchPolicy: 'cache-and-network',
  });

  return {
    data: data?.getData,
    loading,
    error,
    refetch,
  };
}
```

### Key Hook Conventions

1. **Use section dividers** (`// ====`) to organize fragments, queries, mutations, types, hooks
2. **Define GraphQL fragments** for reusable field selections
3. **Export TypeScript types** alongside hooks
4. **Use `useCallback`** for memoized functions returned from hooks
5. **Include `skip` option** when query depends on a variable

### UI Components

- Use `@legal-platform/ui` package components (Card, Button, etc.)
- Use Tailwind CSS for styling
- Follow color conventions: `text-gray-600`, `hover:bg-gray-100`, etc.
- Use transition classes: `transition-colors`, `transition-all duration-200`

## Backend Patterns (services/gateway)

### Service Class Structure

```typescript
/**
 * ServiceName Service
 * Story X.X: Feature Name (AC: 1)
 *
 * Brief description of what this service manages
 */

import { prisma } from '@legal-platform/database';
import { SomeEnum, UserRole } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface CreateInput {
  field1: string;
  field2: number;
}

interface UserContext {
  userId: string;
  role: UserRole;
  firmId: string;
}

// ============================================================================
// Service
// ============================================================================

export class ServiceNameService {
  /**
   * Method description
   */
  async createSomething(input: CreateInput, userContext: UserContext): Promise<ReturnType> {
    // Validate permissions
    this.validatePermission(userContext.role);

    // Database operation
    const result = await prisma.model.create({
      data: {
        firmId: userContext.firmId,
        ...input,
      },
    });

    return this.mapToReturnType(result);
  }

  /**
   * Private helper methods
   */
  private validatePermission(role: UserRole): void {
    if (role !== UserRole.Partner) {
      throw new Error('Insufficient permissions');
    }
  }
}

// Export singleton instance
export const serviceNameService = new ServiceNameService();
```

### Key Backend Conventions

1. **Use section dividers** (`// ====`) for Types and Service sections
2. **Use `UserContext`** pattern for authenticated operations
3. **Include `firmId`** in all multi-tenant data
4. **Export singleton instances** of services
5. **Use Prisma client** from `@legal-platform/database`
6. **Throw errors** for validation failures (GraphQL will handle them)

### GraphQL Resolvers

- Resolvers call service methods
- Services contain business logic
- Use DataLoader for N+1 prevention when needed

## Testing Patterns

### Unit Tests

- Co-locate tests with source files: `Component.tsx` + `Component.test.tsx`
- Or use `__tests__/` folder within feature directory
- Use Jest for unit tests
- Use MSW for mocking API calls

### E2E Tests

- Located in `tests/e2e/`
- Use Playwright
- Include accessibility tests with axe-playwright

### Test File Naming

```
Component.tsx           # Source
Component.test.tsx      # Unit test
Component.stories.tsx   # Storybook story
Component.a11y.test.tsx # Accessibility test
```

## File Organization

### Feature Folders

```
components/
├── feature-name/
│   ├── FeatureComponent.tsx
│   ├── FeatureComponent.test.tsx
│   ├── FeatureComponent.stories.tsx
│   ├── SubComponent.tsx
│   └── __tests__/
│       └── integration.test.tsx
```

### Hooks

```
hooks/
├── useFeatureName.ts    # Custom hook for feature
├── useAnotherFeature.ts
```

## Code Style

### Imports Order

1. React and framework imports
2. External library imports
3. Internal package imports (`@legal-platform/*`)
4. Relative imports
5. Type imports (using `type` keyword)

### Naming Conventions

- **Components**: PascalCase (`WidgetContainer`)
- **Hooks**: camelCase with `use` prefix (`useCaseTimeline`)
- **Services**: PascalCase with `Service` suffix (`InternalNotesService`)
- **Files**: Match export name (`WidgetContainer.tsx`, `useCaseTimeline.ts`)
- **GraphQL**: SCREAMING_SNAKE_CASE for operations (`GET_CASE_TIMELINE`)

## Common Patterns

### Optimistic Updates

```typescript
const [createNote, { loading }] = useMutation(CREATE_NOTE, {
  optimisticResponse: {
    createNote: {
      __typename: 'Note',
      id: `temp-${Date.now()}`,
      // ... optimistic data
    },
  },
});
```

### Pagination with Cursor

```typescript
const { data, fetchMore } = useQuery(GET_LIST, {
  variables: { first: 20 },
});

const loadMore = () => {
  fetchMore({
    variables: { after: data.cursor },
    updateQuery: (prev, { fetchMoreResult }) => ({
      ...fetchMoreResult,
      items: [...prev.items, ...fetchMoreResult.items],
    }),
  });
};
```

### Error Boundaries

- Wrap feature sections in error boundaries
- Display user-friendly Romanian error messages

## Development Workflow

### Local Development

```bash
pnpm dev          # Start all services with hot reload
pnpm preview      # Build and run production Docker
```

### Before Committing

```bash
pnpm preflight    # Run all checks (lint, type-check, test)
pnpm preflight:quick  # Quick checks only
```

### Deployment

```bash
pnpm deploy:production  # Deploy to production
```

Note: `git push` does NOT deploy. Always use the deploy script.
