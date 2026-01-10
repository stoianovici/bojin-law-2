# Legal Platform - Claude Code Context

AI-powered legal case management platform for Romanian law firms with Microsoft 365 integration.

## Quick Start

```bash
# First time setup
docker compose up -d      # Start PostgreSQL + Redis
cp .env.example .env.local # Create config file
# Edit .env.local with your Azure AD + Anthropic credentials
pnpm setup                # Run migrations + create symlinks

# Development
pnpm dev                  # Start web + gateway
```

**Services:**

- Web: http://localhost:3000
- GraphQL: http://localhost:4000/graphql

## Environment Variables

All config lives in `.env.local` at the project root. Required:

```env
# Azure AD - from Azure Portal > App Registrations
AZURE_AD_CLIENT_ID=xxx
AZURE_AD_CLIENT_SECRET=xxx
AZURE_AD_TENANT_ID=xxx
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=xxx  # Same as AZURE_AD_CLIENT_ID
NEXT_PUBLIC_AZURE_AD_TENANT_ID=xxx  # Same as AZURE_AD_TENANT_ID

# Anthropic - from console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-xxx
```

Database and Redis are provided by Docker with default credentials.

## Project Structure

- `apps/web` - Next.js frontend (App Router, Romanian UI)
- `services/gateway` - Node.js GraphQL API
- `packages/database` - Prisma schema and client
- `packages/ui` - Shared component library

## Key Conventions

- UI text in **Romanian**, code in English
- Use `'use client'` for React client components
- Use `clsx` for conditional classes, Radix UI for primitives
- Use section dividers (`// ====`) to organize code sections

## Development Workflow

```
/ideate [topic]    # Explore + decide
/plan [slug]       # Break into tasks (if complex)
/implement [slug]  # Execute
/test              # Verify
/commit            # Done
```

Quick iterations: `/iterate [description]`

### Bug Workflow

```
/investigate [slug] [symptom]  # Read-only investigation, produces analysis doc
/debug [slug]                  # Fix bug (reads investigation doc if exists)
```

**Rule**: For complex bugs, always `/investigate` first. No code changes until analysis is complete.

## Testing

```bash
pnpm test             # Unit tests
pnpm test:e2e         # Playwright E2E
pnpm preflight        # All checks before commit
```

## Database

```bash
# Migrations
pnpm --filter database exec prisma migrate deploy

# Push schema changes (dev)
pnpm --filter database exec prisma db push

# Studio (GUI)
pnpm --filter database exec prisma studio
```
