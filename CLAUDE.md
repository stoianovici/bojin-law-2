# Legal Platform - Claude Code Context

AI-powered legal case management platform for Romanian law firms with Microsoft 365 integration.

## Quick Start

```bash
pnpm setup            # First-time setup (Docker, DB, migrations, env files)
pnpm dev              # Development with hot reload
pnpm preview          # Production-like Docker build
pnpm preflight        # Run all checks before commit
pnpm deploy:production # Deploy (git push does NOT deploy)
```

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

The app supports **three gateway modes** selectable via the UI (stored in localStorage):

| Mode       | Gateway          | Database              | Purpose                                     |
| ---------- | ---------------- | --------------------- | ------------------------------------------- |
| **seed**   | `localhost:4000` | `legal_platform_seed` | Fake seeded test data (121 cases)           |
| **real**   | `localhost:4001` | `legal_platform`      | Real Outlook data synced from Microsoft 365 |
| production | Render remote    | Render PostgreSQL     | Live production                             |

### Running the Gateways

The gateway `.env` file defaults to `legal_platform_seed` on port 4000. To run both modes locally:

```bash
# Terminal 1: Seed data gateway (port 4000)
pnpm --filter gateway dev

# Terminal 2: Real data gateway (port 4001)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/legal_platform PORT=4001 pnpm --filter gateway dev
```

### Database Details

| Database              | Description                                                                 |
| --------------------- | --------------------------------------------------------------------------- |
| `legal_platform_seed` | Seeded with fake test data, safe for experiments                            |
| `legal_platform`      | **Real data** - contains actual Outlook emails and cases from bojin-law.com |
| `legal_platform_prod` | Production backup import (may be empty locally)                             |
| `legal_platform_test` | For automated tests                                                         |

### Schema Migrations

When adding new Prisma models, sync to **all active databases**:

```bash
# Sync schema to seed database (default)
pnpm --filter database exec prisma db push

# Sync schema to real data database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/legal_platform pnpm --filter database exec prisma db push --accept-data-loss
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

## Operations Workflow

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

- `docs/ops/operations-log.md` - Issue tracking source of truth
- `docs/project-conventions.md` - Code patterns and conventions
- `.ai/ops-*-handoff.md` - Session handoff notes
