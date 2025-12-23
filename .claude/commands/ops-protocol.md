# Ops Protocol: Local Verification Gate

## Core Principle

> If it works locally with production data + production Docker, it WILL work in production.

## Verification Checklist

Before closing issues or deploying:

```
□ pnpm dev (with .env.prod) → test the fix works with real data
□ pnpm preflight → TypeScript, tests, build all pass
□ pnpm preview → test again in production Docker
```

All three must pass. No exceptions, no skip option.

## When Verification Is Required

- Before `/ops-close`
- Before `/ops-deploy`
- Before marking work as "done"

## Verification Prompt

Use this concise prompt:

```
🔒 Verification required:
□ pnpm dev (prod data) - tested fix works
□ pnpm preflight - all checks pass
□ pnpm preview - tested in Docker

All three complete?
```

## Status Tracking

**Single source of truth**: `docs/ops/operations-log.md`

Issue files in `issues/` contain investigation details. The ops-log table has the authoritative status.

Don't duplicate status in handoff files - they capture _state_, not status.

## Why This Works

| Test            | Catches                           |
| --------------- | --------------------------------- |
| Production data | Data-specific bugs, edge cases    |
| Preflight       | TypeScript errors, test failures  |
| Docker          | Runtime differences, missing deps |
