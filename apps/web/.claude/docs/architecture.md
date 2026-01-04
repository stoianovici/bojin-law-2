# Project Architecture

## Overview

**bojin-law-ui** - New UI for Legal Platform V2, an AI-powered legal case management system.

## Tech Stack

| Category  | Technology                              |
| --------- | --------------------------------------- |
| Framework | Next.js 16 (App Router)                 |
| Language  | TypeScript 5.3+                         |
| Styling   | Tailwind CSS 3.4 + Linear design tokens |
| State     | Zustand                                 |
| Data      | Apollo Client 4 (GraphQL)               |
| Auth      | Azure MSAL Browser                      |
| UI        | Radix UI primitives                     |
| Icons     | Lucide React                            |
| Dates     | date-fns                                |

## Project Structure

```
bojin-law-ui/
├── .claude/                    # Claude workflow system
│   ├── commands/               # Command definitions
│   │   ├── context.md          # /context - load project state
│   │   ├── brainstorm.md       # /brainstorm - collaborative ideation
│   │   ├── research.md         # /research - parallel investigation
│   │   ├── plan.md             # /plan - task breakdown
│   │   ├── implement.md        # /implement - parallel execution
│   │   ├── commit.md           # /commit - verified commit
│   │   ├── deploy.md           # /deploy - verified deployment
│   │   ├── document.md         # /document - record work
│   │   └── checkpoint.md       # /checkpoint - mid-step pause
│   ├── docs/
│   │   ├── architecture.md     # This file
│   │   └── decisions.md        # Decision log
│   └── work/
│       ├── current.md          # General work log
│       └── tasks/              # Task docs (self-contained per step)
│           ├── brainstorm-{slug}.md  # Output of /brainstorm
│           ├── research-{slug}.md    # Output of /research
│           ├── plan-{slug}.md        # Output of /plan
│           └── implement-{slug}.md   # Output of /implement
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout + providers
│   │   ├── page.tsx            # Home page
│   │   └── globals.css         # Global styles + design tokens
│   ├── providers/              # React context providers
│   │   ├── ApolloProvider.tsx  # GraphQL client
│   │   └── ThemeProvider.tsx   # Dark/light theme
│   ├── lib/                    # Utilities
│   │   ├── utils.ts            # General utilities (cn)
│   │   ├── apollo-client.ts    # Apollo configuration
│   │   └── msal-config.ts      # Azure AD auth config
│   └── components/             # UI components (to build)
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## Design System

- Linear-inspired dark theme (default)
- CSS custom properties for tokens
- `linear-*` prefixed Tailwind utilities
- Colors: bg-primary, bg-elevated, text-primary, text-secondary, accent, etc.

### Mobile UX

> **See `.claude/docs/mobile-ux.md` for complete mobile design system.**

- Superhuman-inspired, minimal dark theme
- Source of truth: HTML mockups in `mockups/` folder
- Mobile-specific tokens: `mobile-*` prefixed
- Verify with: `npx ts-node scripts/capture-mobile.ts`

## Development

| Command           | Purpose                      |
| ----------------- | ---------------------------- |
| `pnpm dev`        | Start dev server (port 3001) |
| `pnpm build`      | Production build             |
| `pnpm lint`       | ESLint                       |
| `pnpm type-check` | TypeScript check             |

## Backend Connection

- GraphQL gateway: `http://localhost:4000/graphql`
- Requires `bojin-law-2` gateway running
- Start gateway: `cd ~/Developer/bojin-law-2 && pnpm dev:gateway`

## Related Projects

- **bojin-law-2**: Main monorepo with backend services, existing UI, tests
- This UI is a fresh rewrite, runs alongside existing app

## Key Patterns

- Server components by default, `'use client'` where needed
- Providers at root layout level
- Romanian language (`lang="ro"`)

---

_Last updated: 2025-12-31_
