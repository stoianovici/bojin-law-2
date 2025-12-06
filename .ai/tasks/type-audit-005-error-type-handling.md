# Task: Fix Unknown Error Type Handling

**ID:** type-audit-005
**Priority:** P2 (Medium)
**Estimated Time:** 20 minutes
**Dependencies:** type-audit-003 (paths must resolve first)

---

## Problem

Caught errors are typed as `unknown` in strict TypeScript, causing errors when accessing `.message` or other properties.

```
error TS18046: 'error' is of type 'unknown'.
```

## Files to Fix

| File | Lines |
|------|-------|
| `apps/legacy-import/src/app/api/categorize-doc/route.ts` | 170, 171 |
| `apps/legacy-import/src/app/api/cleanup/route.ts` | 81, 82 |
| `apps/legacy-import/src/app/api/merge-categories/route.ts` | 154, 155 |
| `apps/legacy-import/src/app/api/upload-pst/route.ts` | 199, 200 |

---

## Fix Pattern

### Option A: Type Guard (Recommended)

```typescript
// FROM:
} catch (error) {
  console.error(error.message);
  return { error: error.message };
}

// TO:
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(message);
  return { error: message };
}
```

### Option B: Type Assertion (Use sparingly)

```typescript
} catch (error) {
  const err = error as Error;
  console.error(err.message);
  return { error: err.message };
}
```

### Option C: Helper Function (For reuse)

Create a utility:

```typescript
// src/lib/errors.ts
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error occurred';
}

// Usage:
import { getErrorMessage } from '@/lib/errors';

} catch (error) {
  const message = getErrorMessage(error);
  console.error(message);
  return { error: message };
}
```

---

## Detailed Fixes

### categorize-doc/route.ts (lines 170-171)

```typescript
// FROM:
} catch (error) {
  console.error('Categorization error:', error);
  return NextResponse.json(
    { error: error.message || 'Failed to categorize' },
    { status: 500 }
  );
}

// TO:
} catch (error) {
  const message = error instanceof Error ? error.message : 'Failed to categorize';
  console.error('Categorization error:', error);
  return NextResponse.json(
    { error: message },
    { status: 500 }
  );
}
```

### cleanup/route.ts (lines 81-82)

```typescript
// Apply same pattern
} catch (error) {
  const message = error instanceof Error ? error.message : 'Cleanup failed';
  console.error('Cleanup error:', error);
  return NextResponse.json({ error: message }, { status: 500 });
}
```

### merge-categories/route.ts (lines 154-155)

```typescript
// Apply same pattern
} catch (error) {
  const message = error instanceof Error ? error.message : 'Merge failed';
  console.error('Merge error:', error);
  return NextResponse.json({ error: message }, { status: 500 });
}
```

### upload-pst/route.ts (lines 199-200)

```typescript
// Apply same pattern
} catch (error) {
  const message = error instanceof Error ? error.message : 'Upload failed';
  console.error('Upload error:', error);
  return NextResponse.json({ error: message }, { status: 500 });
}
```

---

## Verification

```bash
npx tsc --noEmit 2>&1 | grep "TS18046" | wc -l
```

Expected: 0 unknown type errors.

## Notes

- Always preserve the original `error` object in logs for stack traces
- Only extract `.message` for user-facing responses
- Consider adding error codes for API responses
- `instanceof Error` works for all Error subclasses (TypeError, RangeError, custom errors)
