# Investigation: Team Editing in Case Detail Panel is Unreliable

**Slug**: team-edit-unreliable
**Date**: 2026-01-10
**Status**: Investigation Complete
**Severity**: High
**Next step**: `/debug team-edit-unreliable` to implement fix

---

## Bug Summary

**Reported symptom**: Adding team members to cases via the "Editează echipa" modal doesn't reliably persist. Members are added in the UI but don't appear after saving. No error messages are shown.

**Reproduction steps**:

1. Open a case in the detail panel
2. Click "Editează echipa"
3. Add a new team member
4. Click "Salvează"
5. Modal closes, but new member doesn't appear in the team

**Expected behavior**: New team member appears in the case team immediately after saving

**Actual behavior**: Modal closes without error, but team member doesn't appear (or appears after a delay/refresh)

**Frequency**: "Mostly doesn't" persist - intermittent, with no obvious pattern

---

## Root Cause Analysis

### The Bug

**Root cause**: Three compounding issues cause this bug:

1. **`errorPolicy: 'all'` swallows GraphQL errors** - The Apollo client is configured with `errorPolicy: 'all'` for mutations, which means GraphQL errors don't throw exceptions. The error handling in `handleSave` only catches thrown exceptions.

2. **`refetchQueries` is not awaited** - The mutation doesn't use `awaitRefetchQueries: true`, so the modal closes immediately after the mutation response, before the refetch completes. The UI shows stale cached data.

3. **Role updates use wrong mutation** - The code assumes `assignTeam` handles "upsert" behavior, but the resolver throws "User already assigned" for existing users. Role changes fail silently.

**Locations**:

- `apps/web/src/lib/apollo-client.ts:207-209` - `errorPolicy: 'all'` on mutations
- `apps/web/src/components/cases/EditTeamModal.tsx:79-84` - Missing `awaitRefetchQueries`
- `apps/web/src/components/cases/EditTeamModal.tsx:180-191` - Incorrect assumption about upsert
- `services/gateway/src/graphql/resolvers/case.resolvers.ts:1212-1216` - Throws for existing users

**Code path**:

```
User clicks Save → handleSave() → assignTeamMember mutation →
Apollo returns { data, errors } (doesn't throw due to errorPolicy: 'all') →
handleSave continues (errors not checked) →
Modal closes (onOpenChange(false)) →
refetchQueries runs in background (not awaited) →
UI shows stale cache data
```

**Type**: Error handling bug + Race condition + API misuse

### Why It Happens

#### Issue 1: errorPolicy swallows errors

`apps/web/src/lib/apollo-client.ts:207-209`:

```typescript
mutate: {
  errorPolicy: 'all',
},
```

With `errorPolicy: 'all'`, Apollo returns GraphQL errors in `result.errors` instead of throwing. But `handleSave` only catches thrown exceptions:

```typescript
// EditTeamModal.tsx:152-200
try {
  // ... mutations
  await assignTeamMember({...}); // Returns {data, errors}, doesn't throw
} catch (err) {
  // This NEVER runs for GraphQL errors!
  setError(err instanceof Error ? err.message : '...');
}
```

#### Issue 2: refetchQueries not awaited

`apps/web/src/components/cases/EditTeamModal.tsx:79-84`:

```typescript
const [assignTeamMember] = useMutation(ASSIGN_TEAM_MEMBER, {
  refetchQueries: [{ query: GET_CASES }],
  // Missing: awaitRefetchQueries: true
});
```

Without `awaitRefetchQueries: true`:

1. Mutation completes
2. `await` resolves immediately
3. Modal closes
4. refetchQueries runs in background
5. User sees stale data until refetch completes

#### Issue 3: assignTeam doesn't support role updates

The code assumes `assignTeam` works like an upsert:

```typescript
// EditTeamModal.tsx:180-191
// Execute additions and updates (assignTeam handles both via upsert behavior)
for (const member of [...toAdd, ...toUpdate]) {
  await assignTeamMember({...});
}
```

But the resolver explicitly rejects existing users:

```typescript
// case.resolvers.ts:1202-1216
const existing = await prisma.caseTeam.findUnique({...});
if (existing) {
  throw new GraphQLError('User already assigned to case', {...});
}
```

So role updates ALWAYS fail - silently, due to Issue 1.

### Why It Wasn't Caught

1. `errorPolicy: 'all'` was set globally for good reasons (partial data on error), but mutation error handling wasn't updated to match
2. No explicit check for `result.errors` after mutations
3. The race condition with refetchQueries is subtle - sometimes the refetch IS fast enough
4. No automated tests for the team editing flow

---

## Impact Assessment

**Affected functionality**:

- Adding new team members to cases (intermittently fails to show)
- Changing team member roles (always fails silently)
- Removing team members (likely works, uses different mutation)

**Blast radius**: Wide - affects core case team management functionality

**Related code**:

- `apps/web/src/components/cases/EditTeamModal.tsx`: The modal component
- `apps/web/src/graphql/mutations.ts`: ASSIGN_TEAM_MEMBER mutation
- `services/gateway/src/graphql/resolvers/case.resolvers.ts`: assignTeam resolver
- `apps/web/src/lib/apollo-client.ts`: Global Apollo configuration

**Risk of similar bugs**: High - any mutation that doesn't check `result.errors` will have the same silent failure problem

---

## Proposed Fix Approaches

### Option A: Fix Error Handling + Await Refetch (Recommended)

**Approach**:

1. Check mutation result for errors explicitly
2. Add `awaitRefetchQueries: true` to ensure data is fresh before closing

**Files to change**:

- `apps/web/src/components/cases/EditTeamModal.tsx`

**Code changes**:

```typescript
// Add awaitRefetchQueries
const [assignTeamMember] = useMutation(ASSIGN_TEAM_MEMBER, {
  refetchQueries: [{ query: GET_CASES }],
  awaitRefetchQueries: true, // ADD THIS
});

// Check mutation result for errors
const result = await assignTeamMember({
  variables: { input: {...} },
});

// Check for GraphQL errors (errorPolicy: 'all' puts them here)
if (result.errors && result.errors.length > 0) {
  throw new Error(result.errors[0].message);
}
```

**Pros**:

- Fixes all three issues
- Errors now shown to user
- Data always fresh when modal closes
- Minimal code changes

**Cons**:

- Slightly slower (waits for refetch)
- Role updates still fail (need Issue 3 fix too)

**Risk**: Low

### Option B: Add updateTeamMemberRole Mutation

**Approach**: Create a separate mutation for role updates that uses Prisma `update` instead of `create`

**Files to change**:

- `services/gateway/src/graphql/schema/case.graphql`: Add mutation
- `services/gateway/src/graphql/resolvers/case.resolvers.ts`: Add resolver
- `apps/web/src/graphql/mutations.ts`: Add mutation
- `apps/web/src/components/cases/EditTeamModal.tsx`: Use new mutation for role updates

**Pros**:

- Proper separation of concerns
- Role updates work correctly

**Cons**:

- More code to maintain
- Requires backend changes

**Risk**: Low

### Option C: Make assignTeam Upsert

**Approach**: Modify assignTeam resolver to use Prisma `upsert` instead of checking for existing + create

**Files to change**:

- `services/gateway/src/graphql/resolvers/case.resolvers.ts`

**Code change**:

```typescript
// Replace check + create with upsert
const assignment = await prisma.$transaction(async (tx) => {
  const result = await tx.caseTeam.upsert({
    where: {
      caseId_userId: {
        caseId: args.input.caseId,
        userId: args.input.userId,
      },
    },
    update: {
      role: args.input.role,
    },
    create: {
      caseId: args.input.caseId,
      userId: args.input.userId,
      role: args.input.role,
      assignedBy: user.id,
    },
    include: { user: true },
  });
  // ... audit logging
  return result;
});
```

**Pros**:

- Matches the frontend's expectation
- Simple change
- One mutation handles both add and update

**Cons**:

- Changes existing API behavior (could affect other callers)

**Risk**: Low-Medium

### Recommendation

**Implement Options A + C together**:

1. Option A fixes error handling and race condition (frontend)
2. Option C makes the API work as expected (backend)

This provides complete fix with minimal code changes.

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Adding a new team member shows them immediately after save
2. [ ] Changing a team member's role persists after save
3. [ ] Removing a team member works correctly
4. [ ] If mutation fails, error message is shown to user
5. [ ] Modal doesn't close until data is saved and refreshed

### Suggested Test Cases

```typescript
// EditTeamModal.test.tsx
describe('EditTeamModal', () => {
  it('should show new team member after save', async () => {
    // Add member, save, verify they appear
  });

  it('should show error when mutation fails', async () => {
    // Mock mutation to return error
    // Verify error message is displayed
    // Verify modal stays open
  });

  it('should update role when changed', async () => {
    // Change existing member role
    // Save, verify role is updated
  });

  it('should wait for refetch before closing modal', async () => {
    // Verify modal doesn't close until refetch completes
  });
});
```

---

## Investigation Notes

### Files Examined

| File                                                       | Purpose              | Relevant Finding                            |
| ---------------------------------------------------------- | -------------------- | ------------------------------------------- |
| `apps/web/src/components/cases/EditTeamModal.tsx`          | Team editing UI      | Missing error check, no awaitRefetchQueries |
| `apps/web/src/lib/apollo-client.ts`                        | Apollo configuration | `errorPolicy: 'all'` for mutations          |
| `services/gateway/src/graphql/resolvers/case.resolvers.ts` | assignTeam resolver  | Throws for existing users, no upsert        |
| `apps/web/src/app/(dashboard)/cases/page.tsx`              | Cases page           | Data comes from GET_CASES query             |
| `apps/web/src/graphql/mutations.ts`                        | GraphQL mutations    | ASSIGN_TEAM_MEMBER definition               |

### Questions Answered During Investigation

- Q: Why don't error messages appear?
- A: `errorPolicy: 'all'` means GraphQL errors don't throw. The catch block only catches thrown exceptions, so errors are silently ignored.

- Q: Why does it "sometimes" work?
- A: Race condition. If refetchQueries completes quickly, the data appears. If it's slow, modal closes before refetch and user sees stale data.

- Q: Why would role updates fail?
- A: The assignTeam resolver throws "User already assigned" for existing users. The code incorrectly assumes it handles upserts.

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug team-edit-unreliable
```

The debug phase will:

1. Read this investigation document
2. Fix error handling in EditTeamModal
3. Add awaitRefetchQueries: true
4. Either add updateRole mutation or make assignTeam upsert
5. Verify the fix works
