# Investigation: Case and Client Deletion Fails in Production

**Slug**: case-client-deletion
**Date**: 2026-01-15
**Status**: Investigation Complete
**Severity**: High
**Next step**: `/debug case-client-deletion` to implement fix

---

## Bug Summary

**Reported symptom**: Case and client deletion works locally but fails in production after recent fixes.

**Expected behavior**: Cases and clients should be deleted successfully, cleaning up all related data.

**Actual behavior**: Deletion fails in production with foreign key constraint errors.

**Frequency**: Likely occurs when cases have BulkCommunication records linked to them.

---

## Root Cause Analysis

### The Bug

**Root cause**: `BulkCommunication` table has a `caseId` foreign key without `onDelete: Cascade` and is NOT being handled in the `deleteCase` or `deleteClient` resolvers.

**Location**:

- `services/gateway/src/graphql/resolvers/case.resolvers.ts:1575-1684` (deleteCase)
- `services/gateway/src/graphql/resolvers/client.resolvers.ts:830-912` (deleteClient)

**Code path**:

```
User clicks Delete → GraphQL mutation → deleteCase/deleteClient resolver → Transaction attempts to delete Case → PostgreSQL FK constraint violation on BulkCommunication
```

**Type**: Integration bug - incomplete handling of foreign key constraints

### Why It Happens

The Prisma schema defines `BulkCommunication` with a foreign key to `Case`:

```prisma
model BulkCommunication {
  caseId          String?                 @map("case_id")
  case            Case?                   @relation(fields: [caseId], references: [id])  // NO onDelete: Cascade!
  ...
}
```

The recent fix (commit `65131a3`) added handling for `CommunicationEntry` and `CommunicationExport`, but missed `BulkCommunication`.

**Tables with caseId FK and NO cascade** (14 total):
| Table | Handled in deleteCase? |
|-------|------------------------|
| Email | ✓ (updateMany to null) |
| ExtractedDeadline | ✓ (deleteMany) |
| ExtractedCommitment | ✓ (deleteMany) |
| ExtractedActionItem | ✓ (deleteMany) |
| ExtractedQuestion | ✓ (deleteMany) |
| RiskIndicator | ✓ (deleteMany) |
| ThreadSummary | ✓ (deleteMany) |
| EmailDraft | ✓ (deleteMany) |
| SentEmailDraft | ✓ (deleteMany) |
| AISuggestion | ✓ (deleteMany) |
| AIConversation | ✓ (deleteMany) |
| CommunicationEntry | ✓ (deleteMany) |
| CommunicationExport | ✓ (deleteMany) |
| **BulkCommunication** | **❌ MISSING** |

### Why It Wasn't Caught

1. **Local environment**: Likely no BulkCommunication records exist in local dev data
2. **Production data**: Has actual BulkCommunication records linked to cases
3. **No test coverage**: The delete resolvers don't have integration tests that verify all FK constraints are handled
4. **Manual inspection**: Easy to miss one table among 14 that need handling

---

## Impact Assessment

**Affected functionality**:

- Deleting cases that have bulk communication campaigns
- Deleting clients whose cases have bulk communication campaigns

**Blast radius**: Moderate - only affects cases with BulkCommunication records

**Related code**:

- `case.resolvers.ts`: deleteCase resolver
- `client.resolvers.ts`: deleteClient resolver

**Risk of similar bugs**: Medium - any new table with non-cascading caseId FK could cause same issue

---

## Proposed Fix Approaches

### Option A: Add BulkCommunication deletion to resolvers

**Approach**: Add `bulkCommunication.deleteMany` before case deletion, matching the pattern used for other tables.

**Files to change**:

- `services/gateway/src/graphql/resolvers/case.resolvers.ts`: Add `tx.bulkCommunication.deleteMany({ where: { caseId } })` in deleteCase
- `services/gateway/src/graphql/resolvers/client.resolvers.ts`: Add `tx.bulkCommunication.deleteMany({ where: { caseId: { in: caseIds } } })` in deleteClient

**Pros**:

- Minimal change
- Consistent with existing pattern
- Quick to implement

**Cons**:

- Doesn't prevent future tables from having same issue

**Risk**: Low

### Option B: Add onDelete: Cascade to schema

**Approach**: Add `onDelete: Cascade` to the BulkCommunication-Case relation in schema.

**Files to change**:

- `packages/database/prisma/schema.prisma`: Change relation to `@relation(fields: [caseId], references: [id], onDelete: Cascade)`
- New migration required

**Pros**:

- Database handles it automatically
- Can't be forgotten in code

**Cons**:

- Requires migration deployment coordination
- Schema change might not be desired (maybe bulk communications should be preserved?)

**Risk**: Medium (migration required)

### Recommendation

**Option A** - Add explicit deletion in resolvers. This is:

1. Consistent with how other tables are handled
2. Requires no schema migration
3. Gives explicit control over what gets deleted
4. Can be deployed immediately

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Case with BulkCommunication records can be deleted
2. [ ] Case without BulkCommunication records still deletes correctly
3. [ ] Client with cases that have BulkCommunication records can be deleted
4. [ ] BulkCommunicationLog records are properly cleaned up (they cascade from BulkCommunication)

### Manual Test Steps

1. Create a case
2. Create a BulkCommunication record linked to that case
3. Attempt to delete the case
4. Verify deletion succeeds
5. Verify BulkCommunication record is also deleted

---

## Investigation Notes

### Files Examined

| File                  | Purpose               | Relevant Finding                                |
| --------------------- | --------------------- | ----------------------------------------------- |
| `case.resolvers.ts`   | Case deletion logic   | Missing BulkCommunication handling              |
| `client.resolvers.ts` | Client deletion logic | Missing BulkCommunication handling              |
| `schema.prisma`       | Database schema       | BulkCommunication has caseId FK without cascade |

### Git History

- `a430b69`: Added error logging to deleteCase (helps see the actual error)
- `65131a3`: Added CommunicationEntry/Export handling (but missed BulkCommunication)

### Why Local Works But Production Fails

Production has actual BulkCommunication records linked to cases from real usage. Local development likely has:

- Empty or minimal test data
- No BulkCommunication records linked to test cases

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug case-client-deletion
```

The debug phase will:

1. Read this investigation document
2. Add BulkCommunication deletion to both resolvers
3. Verify the fix works
