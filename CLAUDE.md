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
