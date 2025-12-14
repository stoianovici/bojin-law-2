# OPS-021 Handoff: Dev/Production Parity

**Status:** RESOLVED

## Summary

Issue has been resolved. All identified gaps have been addressed:

### Completed Work

1. **Node.js Version Aligned** - All Dockerfiles and CI workflows now use Node 22
   - `infrastructure/docker/Dockerfile.dev` - Node 20 → 22
   - `.github/workflows/pr-validation.yml` - Node 20 → 22
   - `.github/workflows/test.yml` - Node 20 → 22
   - `.github/workflows/deploy-selective.yml` - Node 20 → 22
   - `.github/workflows/docs-generation.yml` - Node 20 → 22

2. **Created Parity Check Script** - `scripts/check-parity.sh`
   - Validates Node.js version consistency
   - Checks pnpm version alignment
   - Validates Docker Compose files
   - Checks Dockerfile structure
   - Validates environment configuration

3. **Added npm Scripts**
   - `pnpm check-parity` - Run parity validation
   - `pnpm preflight:full` - Parity + full preflight

4. **Updated Documentation** - `docs/ops/deployment-flows.md`
   - New "Dev/Production Parity" section
   - Updated scripts reference table
   - Documented known intentional differences

### Verification

```bash
$ pnpm check-parity
[parity] ✓ All Node.js versions match (22)
[parity] ✓ pnpm major version matches (10.x)
[parity] ✓ All checks passed (9/9)
```

### Files Changed

- `infrastructure/docker/Dockerfile.dev`
- `.github/workflows/*.yml` (4 files)
- `scripts/check-parity.sh` (new)
- `package.json`
- `docs/ops/deployment-flows.md`
- `docs/ops/archive/ops-021.md` (resolution doc)
