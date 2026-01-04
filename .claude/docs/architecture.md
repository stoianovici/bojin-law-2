# Architecture Overview

## Project Structure

```
bojin-law-2/
├── apps/web/                 # Next.js frontend
│   ├── src/app/              # App Router pages
│   │   ├── (auth)/           # Auth pages (login, callback)
│   │   ├── (dashboard)/      # Main app pages
│   │   └── m/                # Mobile-specific pages
│   ├── src/components/       # React components
│   │   ├── ui/               # Design system primitives
│   │   ├── layout/           # Layout components
│   │   ├── mobile/           # Mobile-specific components
│   │   └── [feature]/        # Feature-specific components
│   └── src/hooks/            # Custom React hooks
├── services/
│   ├── gateway/              # GraphQL API (main backend)
│   └── ai-service/           # AI features (Claude integration)
├── packages/
│   ├── database/             # Prisma schema & client
│   └── ui/                   # Shared UI (currently minimal)
└── docs/                     # Documentation
```

## Tech Stack

| Layer           | Technology       | Notes                              |
| --------------- | ---------------- | ---------------------------------- |
| **Frontend**    | Next.js 14       | App Router, Server Components      |
| **Styling**     | TailwindCSS      | With CSS custom properties         |
| **Components**  | Radix UI         | Accessible primitives              |
| **State**       | Apollo Client    | GraphQL cache & queries            |
| **Local State** | Zustand          | UI state (modals, filters)         |
| **Backend**     | Apollo Server    | GraphQL API                        |
| **ORM**         | Prisma           | PostgreSQL                         |
| **Auth**        | MSAL (Azure AD)  | Microsoft 365 SSO                  |
| **AI**          | Anthropic Claude | Document gen, email classification |

---

## Design System (Linear-inspired)

### Design Tokens

All colors, spacing, and typography use CSS custom properties defined in `globals.css`. Use Tailwind classes that reference these tokens.

#### Colors

```css
/* Backgrounds - Layer hierarchy (darkest to lightest in dark mode) */
--linear-bg-primary: #0a0a0b; /* Main background */
--linear-bg-secondary: #111113; /* Subtle sections */
--linear-bg-tertiary: #18181b; /* Cards, elevated content */
--linear-bg-elevated: #1c1c1f; /* Modals, popovers */
--linear-bg-hover: #232326; /* Hover states */

/* Text - Semantic hierarchy */
--linear-text-primary: #fafafa; /* Main text, headings */
--linear-text-secondary: #a1a1aa; /* Labels, descriptions */
--linear-text-tertiary: #71717a; /* Hints, placeholders */
--linear-text-muted: #52525b; /* Disabled, very subtle */

/* Accent - Primary action color */
--linear-accent: #3b82f6; /* Buttons, links, focus rings */
--linear-accent-hover: #60a5fa; /* Hover state */
--linear-accent-muted: rgba(59, 130, 246, 0.15); /* Subtle backgrounds */

/* Borders */
--linear-border-subtle: rgba(255, 255, 255, 0.06);
--linear-border-default: rgba(255, 255, 255, 0.1);

/* Status */
--linear-success: #22c55e;
--linear-warning: #f59e0b;
--linear-error: #ef4444;
--linear-info: #38bdf8;
```

#### Tailwind Usage

```tsx
// Backgrounds
className = 'bg-linear-bg-primary'; // Main page background
className = 'bg-linear-bg-elevated'; // Cards, modals
className = 'hover:bg-linear-bg-hover'; // Interactive hover

// Text
className = 'text-linear-text-primary'; // Main content
className = 'text-linear-text-secondary'; // Labels
className = 'text-linear-text-tertiary'; // Hints

// Borders
className = 'border-linear-border-subtle'; // Subtle dividers
className = 'border-linear-border-default'; // Visible borders

// Accent
className = 'bg-linear-accent'; // Primary buttons
className = 'text-linear-accent'; // Links
className = 'ring-linear-accent'; // Focus rings
```

#### Spacing Scale

```css
--linear-space-xs: 4px; /* Tight gaps */
--linear-space-sm: 8px; /* Default gaps */
--linear-space-md: 12px; /* Section gaps */
--linear-space-lg: 16px; /* Card padding */
--linear-space-xl: 24px; /* Section padding */
--linear-space-2xl: 32px; /* Page margins */
```

#### Typography Scale

```css
--linear-text-xs: 11px; /* Badges, metadata */
--linear-text-sm: 12px; /* Secondary text, labels */
--linear-text-base: 13px; /* Body text (smaller than typical) */
--linear-text-lg: 14px; /* Emphasized body */
--linear-text-xl: 16px; /* Section headings */
--linear-text-2xl: 20px; /* Page titles */
```

### Component Patterns

#### Using class-variance-authority (cva)

All core components use `cva` for variant management:

```tsx
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva('inline-flex items-center justify-center rounded-md transition-colors', {
  variants: {
    variant: {
      primary: 'bg-linear-accent hover:bg-linear-accent-hover text-white',
      secondary:
        'bg-linear-bg-elevated hover:bg-linear-bg-tertiary text-linear-text-primary border border-linear-border-subtle',
      ghost: 'hover:bg-linear-bg-elevated text-linear-text-secondary',
      danger: 'bg-linear-error/10 hover:bg-linear-error/20 text-linear-error',
    },
    size: {
      sm: 'h-7 px-2.5 text-linear-xs',
      md: 'h-8 px-3 text-linear-sm',
      lg: 'h-10 px-4 text-linear-sm',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});
```

#### Core Components

| Component | Variants                                | Usage              |
| --------- | --------------------------------------- | ------------------ |
| `Button`  | primary, secondary, ghost, danger       | Actions            |
| `Card`    | default, elevated, outline, interactive | Content containers |
| `Badge`   | default, success, warning, error, info  | Status indicators  |
| `Input`   | default                                 | Form inputs        |
| `Dialog`  | -                                       | Modals             |
| `Tabs`    | -                                       | Tab navigation     |
| `Select`  | -                                       | Dropdowns          |
| `Tooltip` | -                                       | Contextual help    |

### Mobile Design

Mobile uses separate design tokens (`mobile-*`) optimized for touch:

```css
/* Mobile backgrounds - Always dark */
--mobile-bg-primary: #0a0a0a;
--mobile-bg-elevated: #141414;
--mobile-bg-card: #1a1a1a;

/* Mobile-specific patterns */
- Larger touch targets (44px minimum)
- Full-width cards with px-6 padding
- Bottom sheets instead of modals
- Swipe gestures for navigation
```

Mobile pages are in `/m/*` routes with dedicated components in `components/mobile/`.

---

## Code Patterns

### File Organization

```tsx
// Component file structure
'use client';  // If needed

import * as React from 'react';
// External imports (alphabetical)
import { cva } from 'class-variance-authority';
import { SomeIcon } from 'lucide-react';
// Internal imports
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

interface ComponentProps { ... }

// ============================================================
// Component
// ============================================================

export function Component({ ... }: ComponentProps) {
  // hooks
  // derived state
  // handlers
  // render
}
```

### Conventions

- **'use client'** - Required for components using hooks, state, or browser APIs
- **cn()** - Use for conditional class merging: `cn('base-class', condition && 'conditional-class')`
- **Section dividers** - Use `// ====` comments to organize code sections
- **Romanian UI text** - All user-facing strings in Romanian, code in English
- **Co-located tests** - Put `Component.test.tsx` next to `Component.tsx`

### GraphQL

```tsx
// Query pattern
import { gql, useQuery } from '@apollo/client';

const GET_CASES = gql`
  query GetCases($filter: CaseFilterInput) {
    cases(filter: $filter) {
      id
      title
      status
    }
  }
`;

function CaseList() {
  const { data, loading, error } = useQuery(GET_CASES, {
    variables: { filter: { status: 'ACTIVE' } },
  });
  // ...
}
```

### State Management

- **Server state**: Apollo Client (GraphQL cache)
- **UI state**: Zustand stores in `src/stores/`
- **Form state**: React Hook Form (where used)
- **URL state**: Next.js searchParams

---

_Last updated: 2025-01-03_
