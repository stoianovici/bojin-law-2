# Next.js 14 → 16 Upgrade Plan

**Status:** Planning Phase
**Target:** Next.js 16.0.2 + React 19
**Estimated Time:** 4-8 hours
**Risk Level:** Medium-High (2 major versions)

---

## Current State

- **Next.js:** 14.2.0 → 16.0.2 (2 major versions)
- **React:** 18.3.0 → 19.2.0 (1 major version)
- **Node.js:** Currently >=20.0.0 (meets v16 requirement of >=20.9.0)
- **TypeScript:** 5.3.0 (meets v16 requirement of >=5.1.0)

---

## Phase 1: Pre-Upgrade Preparation

### 1.1 Backup & Safety
- [ ] Create git branch: `upgrade/nextjs-16`
- [ ] Commit all current changes
- [ ] Document current working state
- [ ] Run full test suite to establish baseline
- [ ] Take note of current dev server behavior

### 1.2 Audit Current Code
- [ ] Search for all usages of request APIs: `cookies()`, `headers()`, `draftMode()`
- [ ] Identify all pages using `params` and `searchParams`
- [ ] Check for custom `middleware.ts` (needs rename to `proxy.ts`)
- [ ] Review all `fetch()` calls (caching behavior changed)
- [ ] Find Route Handlers with GET methods
- [ ] Check for deprecated APIs: `useFormState`, `@next/font`

### 1.3 Environment Check
- [ ] Verify Node.js version >= 20.9.0
- [ ] Verify pnpm version >= 9.0.0
- [ ] Check browser compatibility requirements (Chrome 111+, Safari 16.4+)

---

## Phase 2: Upgrade to Next.js 15 (Intermediate Step)

**Why intermediate?** Reduces risk by handling breaking changes incrementally.

### 2.1 Install Next.js 15
```bash
pnpm add next@15 react@19 react-dom@19
```

### 2.2 Run Automated Codemod
```bash
npx @next/codemod@canary upgrade 15
```

**What it handles:**
- Converts synchronous request APIs to async
- Updates `params`/`searchParams` type definitions
- Replaces `@next/font` with `next/font`
- Updates `experimental-edge` to `edge` runtime
- Renames config options

### 2.3 Manual Breaking Changes (v15)

#### Make Request APIs Async
```typescript
// Before (v14)
export default function Page({ params, searchParams }) {
  const cookieStore = cookies()
  const headersList = headers()
}

// After (v15+)
export default async function Page({ params, searchParams }) {
  const cookieStore = await cookies()
  const headersList = await headers()
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
}
```

#### Update Fetch Caching
```typescript
// Before (v14) - cached by default
fetch('https://api.example.com/data')

// After (v15+) - explicit caching
fetch('https://api.example.com/data', { cache: 'force-cache' })

// OR set default at layout/page level
export const fetchCache = 'default-cache'
```

#### Update Route Handlers
```typescript
// Route handlers need explicit caching
export const dynamic = 'force-static' // if needed
```

### 2.4 Test Next.js 15
- [ ] Run dev server: `pnpm dev`
- [ ] Test all routes
- [ ] Run test suite: `pnpm test`
- [ ] Run e2e tests: `pnpm test:e2e`
- [ ] Check for console errors/warnings
- [ ] Commit working state

---

## Phase 3: Upgrade to Next.js 16

### 3.1 Install Next.js 16
```bash
pnpm add next@16 react@latest react-dom@latest
```

### 3.2 Run Next.js 16 Codemod
```bash
npx @next/codemod@canary upgrade 16
```

### 3.3 Manual Breaking Changes (v16)

#### Middleware → Proxy Migration
```bash
# If you have middleware.ts
mv middleware.ts proxy.ts
```

```typescript
// Update export name
// Before
export function middleware(request) { }

// After
export function proxy(request) { }
```

**Important:** Edge runtime NOT supported in proxy. Node.js runtime only.

#### Add default.js for Parallel Routes
If using parallel routes, add `default.js` to all route slots or build will fail.

#### Update Image Configuration
```typescript
// next.config.js
module.exports = {
  images: {
    // Update if using custom values
    minimumCacheTTL: 14400, // Default now 4 hours instead of 60s
    imageSizes: [32, 48, 64, 96, 128, 256, 384], // 16 removed
    qualities: [75], // Default changed

    // Replace domains with remotePatterns
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'example.com',
      },
    ],
  },
}
```

#### Update ESLint Config to Flat Format
Next.js 16 requires ESLint flat config format. Convert `.eslintrc.json` to `eslint.config.js`.

#### Enable Turbopack Config (if using experimental)
```typescript
// next.config.js
// Move experimental.turbopack to top-level
module.exports = {
  turbopack: {
    // your turbopack config
  },
}
```

### 3.4 Optional Optimizations

#### Enable React Compiler (Stable in v16)
```typescript
// next.config.js
module.exports = {
  reactCompiler: true,
}
```

#### Enable Filesystem Caching
```typescript
// next.config.js
module.exports = {
  turbopackFileSystemCacheForDev: true,
}
```

### 3.5 React 19 Migration

#### Replace useFormState
```typescript
// Before
import { useFormState } from 'react-dom'

// After
import { useActionState } from 'react'
```

#### Update Component Types
React 19 has stricter type requirements for components and props.

---

## Phase 4: Testing & Validation

### 4.1 Development Testing
- [ ] Start dev server (expect 5-10x faster with Turbopack)
- [ ] Test all routes manually
- [ ] Check SSR/SSG pages
- [ ] Verify API routes work
- [ ] Test dynamic routes with params
- [ ] Check search params handling
- [ ] Verify image optimization works

### 4.2 Automated Testing
- [ ] Run unit tests: `pnpm test`
- [ ] Run e2e tests: `pnpm test:e2e`
- [ ] Run accessibility tests: `pnpm test:a11y`
- [ ] Check test coverage hasn't dropped

### 4.3 Build Testing
- [ ] Run production build: `pnpm build`
- [ ] Check for build errors/warnings
- [ ] Verify bundle sizes (should be similar or smaller)
- [ ] Test production server: `pnpm start`

### 4.4 Performance Testing
- [ ] Run Lighthouse CI: `pnpm test:perf`
- [ ] Compare metrics to baseline
- [ ] Check Core Web Vitals
- [ ] Verify Fast Refresh speed improvement

---

## Phase 5: Dependency Updates

### 5.1 Update Related Packages
```bash
# Testing libraries (check compatibility)
pnpm add -D @testing-library/react@latest @testing-library/jest-dom@latest

# Radix UI packages (check for React 19 compatibility)
pnpm add @radix-ui/react-avatar@latest @radix-ui/react-dialog@latest @radix-ui/react-dropdown-menu@latest @radix-ui/react-navigation-menu@latest @radix-ui/react-select@latest @radix-ui/react-tabs@latest

# Check other dependencies
pnpm outdated
```

### 5.2 Fix Package Issues
Address any peer dependency warnings or incompatibilities.

---

## Known Issues & Workarounds

### Issue: test-utils Package in Browser
**Current Error:** `Module not found: Can't resolve 'fs'` in test-utils when imported in browser code.

**Fix:** Ensure test-utils is only imported in test files, not in application code. Consider adding Next.js webpack config:
```typescript
// next.config.js
module.exports = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      }
    }
    return config
  },
}
```

### Issue: Package Export "types" Warning
**Current Warning:** `"types" will never be used as it comes after "import" and "require"`

**Fix:** Update package.json exports in affected packages:
```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  }
}
```

---

## Rollback Plan

If issues arise:

1. **Git Rollback:**
   ```bash
   git reset --hard HEAD
   git checkout main
   ```

2. **Dependency Rollback:**
   ```bash
   git checkout package.json pnpm-lock.yaml
   pnpm install
   ```

3. **Selective Rollback:**
   Stay on Next.js 15 if v16 causes issues.

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Preparation | 1-2 hours | None |
| Phase 2: Next.js 15 | 2-3 hours | Phase 1 |
| Phase 3: Next.js 16 | 1-2 hours | Phase 2 |
| Phase 4: Testing | 2-3 hours | Phase 3 |
| Phase 5: Dependencies | 1 hour | Phase 4 |
| **Total** | **7-11 hours** | - |

---

## Success Criteria

- [ ] All tests pass (unit, e2e, a11y)
- [ ] No console errors in dev/prod
- [ ] Build completes without errors
- [ ] Performance metrics maintained or improved
- [ ] All routes render correctly
- [ ] Dev server starts without issues
- [ ] Production build size reasonable

---

## Post-Upgrade Tasks

- [ ] Update documentation
- [ ] Notify team of changes
- [ ] Update CI/CD pipelines if needed
- [ ] Monitor production for issues
- [ ] Review and remove deprecated code
- [ ] Consider enabling new features (React Compiler, etc.)

---

## Resources

- [Next.js 15 Upgrade Guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15)
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [React 19 Upgrade Guide](https://react.dev/blog/2024/12/05/react-19)
- [Next.js Codemods](https://nextjs.org/docs/app/building-your-application/upgrading/codemods)

---

## Decision: Proceed?

**Recommendation:** Given the scope and breaking changes, I recommend:

1. **Best Approach:** Upgrade in phases (14→15→16) on a feature branch
2. **Timeline:** Allocate 2-3 days for upgrade + testing + fixes
3. **Testing:** Extensive testing required before merging
4. **Consider:** Current project phase - if actively developing features, may want to wait

**Alternatives:**
- Stay on 14.x until major feature development complete
- Upgrade to 15 only (more stable, fewer breaking changes)
- Wait for Next.js 16.1+ (patch releases often address early issues)

Would you like me to:
1. **Begin Phase 1** (preparation and audit)?
2. **Stay on Next.js 14** for now?
3. **Only upgrade to Next.js 15** (skip 16)?
4. **Make adjustments** to this plan?
