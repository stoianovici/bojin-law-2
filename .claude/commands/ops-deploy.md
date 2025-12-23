# Deploy to Production

Deploy to Render services.

## Input

$ARGUMENTS options:

- (none) - Deploy web only (default)
- `all` - Deploy all services
- `gateway` - Deploy gateway only
- `web gateway` - Deploy specific services

## 1. Pre-flight (Mandatory)

```bash
pnpm preflight:full
```

**If this fails, stop. Fix issues first.**

## 2. Git Checks

```bash
git status
git branch --show-current
```

- Working directory must be clean
- Should be on `main` branch
- Push if ahead of origin

## 3. Deploy

```bash
pnpm deploy:production          # web only
pnpm deploy:production all      # all services
pnpm deploy:production gateway  # gateway only
```

## 4. Smoke Test (Mandatory)

After deploy completes (~3-5 min):

```bash
pnpm smoke-test
```

**If smoke test fails, investigate immediately.**

## 5. Report

```
Deployed: {services}
Commit: {hash}
Preflight: ✓
Smoke test: ✓/✗

URLs:
- Web: https://legal-platform-web.onrender.com
- Gateway: https://legal-platform-gateway.onrender.com
```

## Deploy Hooks

Stored in `.env.render` (gitignored). If missing, get from Render Dashboard > Service > Settings > Deploy Hook.

## Render Services

| Service       | URL                                 |
| ------------- | ----------------------------------- |
| Web           | legal-platform-web.onrender.com     |
| Gateway       | legal-platform-gateway.onrender.com |
| Legacy Import | bojin-legacy-import.onrender.com    |
