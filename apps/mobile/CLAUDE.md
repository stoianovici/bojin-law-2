# Mobile App - Claude Code Context

Focused mobile experience for the Bojin Law legal platform. Separate Next.js app from desktop, independently deployable.

## Quick Reference

|            |                                      |
| ---------- | ------------------------------------ |
| **Domain** | `m.bojin-law.com`                    |
| **Local**  | `http://localhost:3001`              |
| **API**    | `api.bojin-law.com` (shared gateway) |
| **Design** | Dark-only, Superhuman-inspired       |

## Feature Scope

**Included:**

- Dashboard (today's tasks, urgent items)
- Cases (list, detail, AI summary)
- Tasks (list, create, complete)
- Calendar (view, create events)
- Time Entry (quick log)
- Notes (quick capture)
- Global Search

**Not on mobile** (desktop only):

- Documents
- Email
- Invoices
- Settings
- Admin

## Project Structure

```
apps/mobile/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── layout.tsx       # Root layout with TabBar
│   │   ├── page.tsx         # Dashboard/Home
│   │   ├── cases/
│   │   ├── tasks/
│   │   ├── calendar/
│   │   ├── search/
│   │   ├── time/
│   │   ├── notes/
│   │   └── auth/
│   ├── components/
│   │   ├── ui/              # Button, Input, Card, BottomSheet
│   │   └── layout/          # Header, TabBar, SafeArea
│   ├── hooks/               # Data fetching hooks
│   └── lib/                 # Apollo, MSAL, utilities
├── tailwind.config.js
└── CLAUDE.md                # This file
```

## Design System

### Colors (Dark Only)

```css
/* Backgrounds */
--bg-primary: #0a0a0a; /* Main background */
--bg-elevated: #141414; /* Cards, inputs */
--bg-card: #1a1a1a; /* Card backgrounds */
--bg-hover: #242424; /* Touch feedback */

/* Text */
--text-primary: #fafafa; /* Main text */
--text-secondary: #a1a1a1; /* Labels */
--text-tertiary: #6b6b6b; /* Hints, placeholders */

/* Accent */
--accent: #3b82f6; /* Primary actions */
--accent-muted: rgba(59, 130, 246, 0.15);

/* Status */
--success: #22c55e;
--warning: #f59e0b;
--error: #ef4444;
```

### Tailwind Classes

```tsx
// Backgrounds
className = 'bg-bg-primary'; // Main page
className = 'bg-bg-elevated'; // Cards
className = 'bg-bg-hover'; // Touch states

// Text
className = 'text-text-primary'; // Main content
className = 'text-text-secondary'; // Labels
className = 'text-text-tertiary'; // Hints

// Accent
className = 'bg-accent'; // Primary buttons
className = 'text-accent'; // Links
```

### Typography

| Use           | Size | Weight   |
| ------------- | ---- | -------- |
| Page title    | 26px | Semibold |
| Section title | 16px | Medium   |
| Body          | 14px | Regular  |
| Label         | 13px | Medium   |
| Caption       | 12px | Regular  |

### Spacing

- Page padding: `px-6` (24px)
- Card padding: `p-4` (16px)
- Gap between items: `gap-3` (12px)
- Safe area bottom: `pb-safe` or `pb-20`

## UX Patterns

| Pattern           | Implementation                                    |
| ----------------- | ------------------------------------------------- |
| Bottom navigation | `TabBar` component, 4 tabs max                    |
| Page header       | `Header` component with back button               |
| Modals            | Use `BottomSheet` (slide-up), not centered modals |
| Touch targets     | Minimum 44px height                               |
| Loading           | Skeleton components for initial load              |
| Errors            | `InlineError` with retry button                   |
| Pull to refresh   | Native scroll + refetch                           |
| Swipe actions     | `framer-motion` gestures                          |
| Safe areas        | `env(safe-area-inset-*)`                          |

## Component Conventions

### Page Structure

```tsx
'use client';

import { Header } from '@/components/layout/Header';
import { SafeArea } from '@/components/layout/SafeArea';

export default function PageName() {
  return (
    <SafeArea>
      <Header title="Page Title" back />
      <div className="px-6 py-4">{/* Content */}</div>
    </SafeArea>
  );
}
```

### Hooks

```tsx
// All hooks return consistent shape
const { data, loading, error, refetch } = useSomething();

// Mutations return execute function + state
const { execute, loading, error } = useCreateTask();
```

### Forms

- Controlled inputs with `useState`
- Validation in component (not form library)
- Submit button disabled when invalid
- Bottom fixed action bar for submit

## Data Layer

- **Apollo Client** for GraphQL (same gateway as desktop)
- **Own instance** - not shared with desktop
- **Mobile-optimized queries** - fetch only needed fields
- **Optimistic updates** for better UX

## Auth

- **MSAL** with redirect to `m.bojin-law.com/auth/callback`
- Same Azure AD app as desktop (multiple redirect URIs)
- Token stored in session storage

## Development

```bash
# From project root
pnpm --filter mobile dev      # Start dev server on :3001

# Or from apps/mobile
pnpm dev
```

## Key Differences from Desktop

| Aspect     | Desktop (`apps/web`) | Mobile (`apps/mobile`) |
| ---------- | -------------------- | ---------------------- |
| Domain     | app.bojin-law.com    | m.bojin-law.com        |
| Theme      | Dark + Light         | Dark only              |
| Navigation | Sidebar              | Bottom tabs            |
| Modals     | Centered dialogs     | Bottom sheets          |
| Features   | Full                 | Focused subset         |
| Port       | 3000                 | 3001                   |

## Files Reference

When implementing features, check desktop equivalents for GraphQL queries:

| Mobile Hook   | Desktop Reference                   |
| ------------- | ----------------------------------- |
| `useCases`    | `apps/web/src/hooks/useCases.ts`    |
| `useCase`     | `apps/web/src/hooks/useCase.ts`     |
| `useTasks`    | `apps/web/src/hooks/useTasks.ts`    |
| `useCalendar` | `apps/web/src/hooks/useCalendar.ts` |

Copy queries but simplify - fetch fewer fields for mobile.
