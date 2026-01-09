# Legal Platform - Claude Code Context

AI-powered legal case management platform for Romanian law firms with Microsoft 365 integration.

## Quick Start

```bash
pnpm setup            # First-time setup (Docker, DB, migrations, env files)
pnpm dev              # Core services only (web, gateway, database, ui) - recommended
pnpm dev:full         # All services (legacy-import, word-addin, ai-service, etc.)
pnpm dev:web          # Minimal: web + gateway + database only
pnpm dev:ai           # Core + AI service (for AI feature development)
pnpm preview          # Production-like Docker build
pnpm preflight        # Run all checks before commit
pnpm deploy:production # Deploy (git push does NOT deploy)
```

> **Memory tip**: `pnpm dev` uses ~1.5GB RAM. Use `pnpm dev:web` (~800MB) if memory-constrained.

## Local Development Setup

Run `pnpm setup` to configure local development. This will:

1. Start PostgreSQL and Redis containers
2. Create environment files from templates
3. Run database migrations
4. Optionally import production data

**Required environment variables** (add to env files after setup):

- `AZURE_AD_CLIENT_ID` / `AZURE_AD_CLIENT_SECRET` / `AZURE_AD_TENANT_ID` - Microsoft auth
- `ANTHROPIC_API_KEY` - AI features

To import production database:

1. Download backup from Render Dashboard (legal-platform-db > Backups)
2. Run `pnpm setup` and choose option 1 when prompted

## Database & Gateway Architecture

The app supports **two gateway modes** selectable via the UI (stored in localStorage):

| Mode           | Gateway          | Database          | Purpose                                     |
| -------------- | ---------------- | ----------------- | ------------------------------------------- |
| **local**      | `localhost:4000` | `legal_platform`  | Real Outlook data synced from Microsoft 365 |
| **production** | Render remote    | Render PostgreSQL | Live production                             |

### Running the Gateway

```bash
# Local development gateway (port 4000)
pnpm --filter gateway dev
```

### Database Details

| Database              | Description                                                                 |
| --------------------- | --------------------------------------------------------------------------- |
| `legal_platform`      | **Real data** - contains actual Outlook emails and cases from bojin-law.com |
| `legal_platform_prod` | Production backup import (may be empty locally)                             |
| `legal_platform_test` | For automated tests                                                         |

### Schema Migrations

When adding new Prisma models:

```bash
# Sync schema to local database
pnpm --filter database exec prisma db push
```

### Switching Gateway Mode in UI

The frontend has a gateway mode selector (check `useGateway` hook). Changing mode:

1. Updates localStorage (`gateway-mode`)
2. Clears auth session
3. Reloads the page to reinitialize Apollo client with new URL

## Project Structure

- `apps/web` - Next.js frontend (App Router, Romanian UI)
- `services/gateway` - Node.js GraphQL API
- `packages/ui` - Shared component library
- `packages/database` - Prisma schema and client

## Key Conventions

**Read `docs/project-conventions.md` for detailed patterns before implementing features.**

Summary:

- UI text is in **Romanian** (code stays in English)
- Use `'use client'` directive for React client components
- Use `clsx` for conditional classes, Radix UI for primitives
- Backend services use singleton pattern with `UserContext` for auth
- Use section dividers (`// ====`) to organize code sections
- Co-locate tests with source files (`Component.test.tsx`)

## Development Workflow

### Feature Development

For new features or complex changes:

```
/ideate [topic]    # Explore problem + codebase, make decisions (one session)
    ↓
/plan [slug]       # Break into tasks (skip if simple)
    ↓
/implement [slug]  # Execute with parallel agents
    ↓
/test              # Verify all decisions work
    ↓
/commit            # Done
```

**Quick iterations** (preferred for small changes):

```
/iterate [description or screenshot]  # Fast fix-verify loop
```

### Session Continuity

```
/checkpoint [name]  # Save state for later (machine-generated)
/resume [name]      # Load checkpoint and continue
```

Use checkpoints when:

- Context is getting long
- Pausing mid-task
- Before complex parallel work

### Operations Workflow

Use `/ops-*` commands for issue tracking:

- `/ops-new <description>` - Create new issue
- `/ops-continue [OPS-XXX]` - Resume work on issue
- `/ops-save` - Save progress for session handoff
- `/ops-close [OPS-XXX]` - Close resolved issue

## Testing

```bash
pnpm test             # Unit tests
pnpm test:e2e         # Playwright E2E tests
pnpm test:integration # Integration tests
```

## Important Files

- `docs/project-conventions.md` - Code patterns and conventions
- `.claude/docs/templates.md` - Lightweight document templates
- `.claude/work/checkpoints/` - Session checkpoints (use `/resume` to load)
- `.claude/work/tasks/` - Task documents for feature work
- `.claude/ops/` - Operations handoffs and logs
- `docs/ops/operations-log.md` - Issue tracking source of truth

## Directory Structure

```
.claude/
├── commands/           # Skill definitions (/ideate, /plan, etc.)
├── docs/               # Project docs for Claude context
├── work/
│   ├── checkpoints/    # Session checkpoints
│   ├── tasks/          # Active task documents
│   └── current.md      # Current work log
├── ops/                # Operations handoffs (moved from .ai/)
└── archive/            # Archived frameworks and old tasks
```
