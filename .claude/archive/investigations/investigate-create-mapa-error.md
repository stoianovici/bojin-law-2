# Investigation: Create Mapa Fails with Generic Error

**Slug**: create-mapa-error
**Date**: 2026-01-11
**Status**: Investigation Complete
**Severity**: High
**Next step**: `/debug create-mapa-error` to implement fix

---

## Bug Summary

**Reported symptom**: Creating a new mapa fails with error "Crearea mapei a eșuat. Încercați din nou."

**Reproduction steps**:

1. Navigate to /documents page
2. Expand a case in the sidebar
3. Click "Adaugă mapă" button
4. Enter a name (e.g., "test22")
5. Click "Creează mapă"

**Expected behavior**: New mapa is created and user is navigated to it

**Actual behavior**: Error message "Crearea mapei a eșuat. Încercați din nou." appears

**Frequency**: Appears to happen consistently

---

## Root Cause Analysis

### The Bug

**Root cause**: Two separate issues working together:

1. **Primary Issue**: The actual GraphQL API error is being hidden by a generic error message in the frontend
2. **Secondary Issue**: The actual API error is unknown (likely permission-related or database constraint)

**Location**: `apps/web/src/components/documents/CreateMapaModal.tsx:154-178`

**Code path**:

```
User clicks "Creează mapă" → handleSubmit → createMapa (useCreateMapa hook) →
Apollo mutation (CREATE_MAPA) → Backend fails → Hook catches error, sets createMapaError, returns null →
Modal sees null, sets submitError → errorMessage shows submitError (hides actual error)
```

**Type**: Frontend error handling bug + Unknown backend error

### Why It Happens

The error handling in `CreateMapaModal.tsx` has a logic flaw. When the `createMapa` function fails:

1. The `useCreateMapa` hook catches the error, calls `setError(error)`, and returns `null`
2. The modal's `handleSubmit` checks `if (newMapa)` - it's null
3. Modal sets `submitError` to a generic message
4. When rendering, `errorMessage` is calculated as:
   ```javascript
   const errorMessage =
     submitError || createMapaError?.message || createFromTemplateError?.message || null;
   ```
5. Because `submitError` is truthy, it short-circuits and the actual `createMapaError?.message` is never shown

The actual API error could be:

- "Case not found" (if caseId is invalid)
- "Access denied: Not assigned to this case" (if user lacks permissions)
- Database constraint violation
- Network error

### Why It Wasn't Caught

1. The error handling was designed for success-path display, not failure debugging
2. No logging of the actual error in the frontend
3. The generic error message masks the real issue
4. Server logs on production weren't captured during the failure

---

## Impact Assessment

**Affected functionality**:

- Creating new mapas from the documents page
- Creating mapas from templates

**Blast radius**: Moderate - Affects core document organization feature

**Related code**:

- `apps/web/src/hooks/useMapa.ts`: useCreateMapa hook - catches and stores error
- `apps/web/src/graphql/mapa.ts`: CREATE_MAPA mutation definition
- `services/gateway/src/services/mapa.service.ts`: createMapa service method
- `services/gateway/src/graphql/resolvers/mapa.resolvers.ts`: createMapa resolver

**Risk of similar bugs**: Medium - Same error handling pattern may exist in other modals/forms

---

## Proposed Fix Approaches

### Option A: Fix Error Message Priority (Quick Fix)

**Approach**: Change the error message calculation to prioritize API errors over generic messages

**Files to change**:

- `apps/web/src/components/documents/CreateMapaModal.tsx`: Change line 177-178

**Change**:

```javascript
// Before
const errorMessage =
  submitError || createMapaError?.message || createFromTemplateError?.message || null;

// After
const errorMessage =
  createMapaError?.message || createFromTemplateError?.message || submitError || null;
```

**Pros**:

- Quick fix
- Shows actual API error to user
- Helps with debugging

**Cons**:

- Still shows generic error if no API error is captured
- Doesn't fix underlying cause if it's a backend issue

**Risk**: Low

### Option B: Remove Generic Error, Rely on API Errors (Better Fix)

**Approach**: Remove the `submitError` state entirely and only show errors from the hooks

**Files to change**:

- `apps/web/src/components/documents/CreateMapaModal.tsx`: Remove submitError state and usage

**Change**:

```javascript
// Remove these lines (48, 55-56, 154-157):
// const [submitError, setSubmitError] = useState<string | null>(null);
// setSubmitError(null);
// setSubmitError('Crearea mapei a eșuat. Încercați din nou.');

// Change error display (line 177-178):
const errorMessage = createMapaError?.message || createFromTemplateError?.message || null;
```

**Pros**:

- Clean error handling
- Always shows actual error
- Consistent with how other hooks work

**Cons**:

- If Apollo mutation fails silently (returns null without error), user sees no feedback
- Need to ensure hooks always set error on failure

**Risk**: Low-Medium

### Option C: Improve Hook Error Handling (Best Fix)

**Approach**: Ensure the hook EITHER returns a result OR sets an error, never both null

**Files to change**:

- `apps/web/src/hooks/useMapa.ts`: Improve useCreateMapa error handling
- `apps/web/src/components/documents/CreateMapaModal.tsx`: Simplify error display

**Hook change**:

```javascript
const createMapa = useCallback(async (input: CreateMapaInput): Promise<Mapa | null> => {
  setLoading(true);
  setError(undefined);

  try {
    const result = await apolloClient.mutate<CreateMapaMutationResult>({
      mutation: CREATE_MAPA,
      variables: { input },
    });

    if (!result.data?.createMapa) {
      // Handle case where mutation returns null without throwing
      setError(new Error('Crearea mapei a eșuat. Verificați datele și încercați din nou.'));
      return null;
    }

    return result.data.createMapa;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    setError(error);
    return null;
  } finally {
    setLoading(false);
  }
}, []);
```

**Modal change**: Use Option B's simplified error display

**Pros**:

- Guarantees error message when creation fails
- Clean separation of concerns
- Hook handles all error states

**Cons**:

- More changes required
- Need to verify this doesn't break other usages of the hook

**Risk**: Low

### Option D: Fix Apollo errorPolicy Issue (Root Cause Fix)

**Approach**: The Apollo client uses `errorPolicy: 'all'` which returns errors in `result.errors` instead of throwing. The hook needs to check this.

**Files to change**:

- `apps/web/src/hooks/useMapa.ts`: Check `result.errors` in addition to `result.data`

**Change**:

```javascript
const createMapa = useCallback(async (input: CreateMapaInput): Promise<Mapa | null> => {
  setLoading(true);
  setError(undefined);

  try {
    const result = await apolloClient.mutate<CreateMapaMutationResult>({
      mutation: CREATE_MAPA,
      variables: { input },
    });

    // Check for GraphQL errors (with errorPolicy: 'all', these don't throw)
    if (result.errors?.length) {
      const errorMessage = result.errors[0]?.message || 'Crearea mapei a eșuat.';
      setError(new Error(errorMessage));
      return null;
    }

    if (!result.data?.createMapa) {
      setError(new Error('Crearea mapei a eșuat. Răspuns invalid de la server.'));
      return null;
    }

    return result.data.createMapa;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    setError(error);
    return null;
  } finally {
    setLoading(false);
  }
}, []);
```

**Pros**:

- Addresses the root cause (Apollo errorPolicy)
- Extracts actual error message from backend
- Single place to fix

**Cons**:

- Need to apply same pattern to all hooks

**Risk**: Low

### Recommendation

**Option D** is the best fix as it addresses the actual root cause: Apollo's `errorPolicy: 'all'` setting returns errors in `result.errors` instead of throwing them, but the hook never checks this array.

Apply **Option D** first to extract the real backend error, then combine with **Option A** to ensure the modal displays API errors with priority.

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Original bug no longer reproduces (mapa creation works)
2. [ ] Error messages from API are displayed to user
3. [ ] If API returns specific errors (Case not found, Access denied), those are shown
4. [ ] Creating mapa from template still works
5. [ ] Success path still works correctly

### Suggested Test Cases

If adding automated tests:

```typescript
// CreateMapaModal.test.tsx
describe('CreateMapaModal', () => {
  it('should display API error message when creation fails', async () => {
    // Mock useCreateMapa to return error
    // Verify error message is shown
  });

  it('should not show generic error when API error is available', async () => {
    // Verify API error takes precedence
  });
});
```

---

## Investigation Notes

### Files Examined

| File                   | Purpose                  | Relevant Finding                          |
| ---------------------- | ------------------------ | ----------------------------------------- |
| `CreateMapaModal.tsx`  | Modal component          | Error priority bug on line 177-178        |
| `useMapa.ts`           | Hook for mapa operations | Catches error and returns null            |
| `mapa.ts` (graphql)    | GraphQL mutations        | CREATE_MAPA mutation is correctly defined |
| `mapa.service.ts`      | Backend service          | validateCaseAccess called before create   |
| `mapa.resolvers.ts`    | GraphQL resolvers        | Calls service method correctly            |
| `DocumentsSidebar.tsx` | Sidebar component        | Passes caseId correctly                   |
| `page.tsx` (documents) | Page component           | Handles modal state correctly             |
| `/api/mapas/route.ts`  | API route                | Uses mock data, not used for creation     |

### Critical Finding: Apollo errorPolicy

The Apollo client is configured with `errorPolicy: 'all'` in `apps/web/src/lib/apollo-client.ts:198-210`:

```javascript
defaultOptions: {
  mutate: {
    errorPolicy: 'all',  // THIS IS KEY
  },
},
```

With this setting:

- GraphQL errors are NOT thrown as exceptions
- Errors are returned in `result.errors` array
- `result.data` may be null or contain partial data

The `useCreateMapa` hook (line 169-187) never checks `result.errors`, so the actual backend error is silently ignored and a generic message is shown instead.

### Architecture Note

The documents page has a hybrid architecture:

- **Cases**: Fetched from GraphQL (real database)
- **Mapas for display**: Fetched from `/api/mapas` (mock data)
- **Mapa creation**: Uses GraphQL mutation (writes to database)

This mismatch could cause confusion but is not the direct cause of the bug. New mapas created via GraphQL won't appear in the mock data fetch, but the error happens during creation itself.

### Questions Answered During Investigation

- Q: What exact error occurs when creating a mapa?
- A: Unknown - the frontend hides the actual error message. The first fix should reveal it.

- Q: Is the caseId valid?
- A: Yes, cases come from the real database via GraphQL.

- Q: Is there a permission issue?
- A: Possible. The `validateCaseAccess` checks if user is Partner or assigned to case. Need to see actual error to confirm.

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug create-mapa-error
```

The debug phase will:

1. Read this investigation document
2. Apply Option A first to reveal actual error
3. Test and observe the actual error message
4. Apply Option C for complete fix if needed
5. Verify the fix works
