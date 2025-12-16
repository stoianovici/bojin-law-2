# Task: Fix Implicit Any Type Errors

**ID:** type-audit-004
**Priority:** P2 (Medium)
**Estimated Time:** 45 minutes
**Dependencies:** type-audit-003 (paths must resolve first)

---

## Problem

50+ parameters in callback functions have implicit `any` type due to `noImplicitAny` compiler option.

## Common Patterns to Fix

### Pattern 1: Prisma Transaction Callbacks

```typescript
// FROM:
prisma.$transaction(async (tx) => {
//                         ^^ Parameter 'tx' implicitly has an 'any' type

// TO:
import { Prisma, PrismaClient } from '@prisma/client';

prisma.$transaction(async (tx: Prisma.TransactionClient) => {
```

### Pattern 2: Array Callbacks

```typescript
// FROM:
documents.map((d) => d.id);
//             ^ Parameter 'd' implicitly has an 'any' type

// TO:
documents.map((d: Document) => d.id);
// Or let TypeScript infer from typed array:
const documents: Document[] = await getDocuments();
documents.map((d) => d.id); // Now inferred
```

### Pattern 3: Reduce Callbacks

```typescript
// FROM:
stats.reduce((acc, stat) => {
//            ^^^  ^^^^ implicitly any

// TO:
stats.reduce((acc: number, stat: Stat) => {
  return acc + stat.value;
}, 0);
```

---

## Files to Fix

Run this to get the full list:

```bash
cd /path/to/project
npx tsc --noEmit 2>&1 | grep "TS7006" | cut -d'(' -f1 | sort -u
```

Known files from initial scan:

| File                                                                          | Approximate Count |
| ----------------------------------------------------------------------------- | ----------------- |
| `apps/legacy-import/src/app/api/analyze-documents/route.ts`                   | 6                 |
| `apps/legacy-import/src/app/api/bulk-import-documents/route.ts`               | 1                 |
| `apps/legacy-import/src/app/api/export-onedrive/route.ts`                     | 1                 |
| `apps/legacy-import/src/app/api/merge-categories/route.ts`                    | 2                 |
| `apps/legacy-import/src/app/api/partner-dashboard/route.ts`                   | 2                 |
| `apps/legacy-import/src/app/api/reassign-batches/route.ts`                    | 5                 |
| `apps/legacy-import/src/app/api/session-progress/route.ts`                    | 6                 |
| `apps/legacy-import/src/app/api/sync-categories/route.ts`                     | 1                 |
| `apps/legacy-import/src/app/api/get-batch/route.ts`                           | 1                 |
| `apps/legacy-import/src/__tests__/integration/multi-user.integration.test.ts` | 3                 |

---

## Fix Strategy

### For each file:

1. Identify the type of data being processed
2. Import or define the appropriate type
3. Add type annotation to parameter

### Example Fix (analyze-documents/route.ts):

```typescript
// Line 49 - map callback
// FROM:
const ids = results.map((d) => d.id);

// Determine type from context - likely a Prisma model
import type { Document } from '@prisma/client';
// Or from shared types
import type { Document } from '@legal-platform/types';

// TO:
const ids = results.map((d: Document) => d.id);
```

### Example Fix (bulk-import-documents/route.ts):

```typescript
// Line 63 - transaction callback
// FROM:
await prisma.$transaction(async (tx) => {

// TO:
import { Prisma } from '@prisma/client';
await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
```

---

## Verification

```bash
npx tsc --noEmit 2>&1 | grep "TS7006" | wc -l
```

Expected: 0 implicit any errors.

## Notes

- Prefer importing existing types over defining inline
- Check `@legal-platform/types` for shared types
- Check `@prisma/client` for database types
- Use `unknown` instead of `any` when type truly unknown, then narrow with type guards
