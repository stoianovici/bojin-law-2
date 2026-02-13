# Investigation: Client Document Access Denied Despite Visible Client

**Slug**: access-control
**Date**: 2026-01-21
**Status**: Investigation Complete
**Severity**: High
**Next step**: `/debug access-control` to implement fix

---

## Bug Summary

**Reported symptom**: User sees "Nu aveți acces la documentele acestui client" error when trying to create a new document, despite being able to see the client/case in the UI.

**Reproduction steps**:

1. Log in as a user with assignment-based role (AssociateJr or Paralegal)
2. Navigate to Documents page
3. In the sidebar, see a client that has inbox documents (but user is NOT assigned to this client or any of its cases)
4. Select that client's inbox or a mapa under it
5. Click "Document nou" to create a new document
6. Enter a document name and click "Creează și deschide în Word"
7. Error appears: "Nu aveți acces la documentele acestui client"

**Expected behavior**: Either:

- Option A: User should NOT see clients they don't have access to (correct visibility)
- Option B: User should be able to create documents for visible clients (correct access)

**Actual behavior**: User can SEE clients they don't have access to, but CANNOT act on them. This creates a confusing UX where the system appears broken.

**Frequency**: Always happens for assignment-based roles viewing clients they're not assigned to

---

## Root Cause Analysis

### The Bug

**Root cause**: The `clientsWithInboxDocuments` query lacks role-based access filtering. It returns ALL clients in the firm that have inbox documents, ignoring assignment-based access rules.

**Location**: `services/gateway/src/graphql/resolvers/document.resolvers.ts:1426-1474`

**Code path**:

```
User navigates to Documents page
  → Frontend queries clientsWithInboxDocuments
  → Backend returns ALL clients with inbox docs (no role filtering!)
  → User sees clients they're not assigned to
  → User tries to create document
  → Backend correctly checks canAccessClientDocuments()
  → Access denied
```

**Type**: Authorization bug (visibility vs. action permission mismatch)

### Why It Happens

The `clientsWithInboxDocuments` resolver was implemented without considering the role-based access model. It only filters by `firmId`:

```typescript
// document.resolvers.ts:1453-1457
const clients = await prisma.client.findMany({
  where: {
    id: { in: clientIds },
    firmId: user.firmId,  // Only firm isolation, no role check!
  },
  ...
});
```

Meanwhile, the mutation correctly uses `canAccessClientDocuments()` which enforces:

- Full-access roles (Partner, Associate, BusinessOwner): access to all clients
- Assignment-based roles (AssociateJr, Paralegal): only assigned clients

This creates a mismatch where visibility is broader than action permissions.

### Why It Wasn't Caught

1. The role-based access model was added later (via `access-control.ts` utility)
2. The `clientsWithInboxDocuments` query predates the centralized access control utilities
3. Manual testing likely used full-access roles (Partner/Associate)
4. No automated tests verify that assignment-based roles can't see unassigned clients

---

## Impact Assessment

**Affected functionality**:

- Client inbox document visibility in Documents sidebar
- Document creation in client inbox
- Potentially document upload to client inbox

**Blast radius**: Moderate - affects assignment-based roles (AssociateJr, Paralegal) when viewing the Documents page

**Related code**:

- `services/gateway/src/graphql/resolvers/document.resolvers.ts:1426-1474` - The buggy query
- `services/gateway/src/graphql/utils/access-control.ts` - The correct access control utilities that should be used

**Risk of similar bugs**: High - other queries might also be missing role-based filtering. Should audit:

- `clientInboxDocuments` query
- `clientMape` query
- Any other client-level document queries

---

## Proposed Fix Approaches

### Option A: Add role filtering to clientsWithInboxDocuments (Recommended)

**Approach**: Add the same role-based filtering that `getAccessibleClientIds` uses to the `clientsWithInboxDocuments` query.

**Files to change**:

- `services/gateway/src/graphql/resolvers/document.resolvers.ts`: Import and use `getAccessibleClientIds` or replicate its logic

**Implementation**:

```typescript
// In clientsWithInboxDocuments resolver
const user = requireAuth(context);

// Get accessible client IDs based on role
const accessibleClientIds = await getAccessibleClientIds(user.id, user.firmId, user.role);

// Build where clause
const whereClause: Prisma.ClientWhereInput = {
  id: { in: clientIds },
  firmId: user.firmId,
};

// Assignment-based roles only see assigned clients
if (accessibleClientIds !== 'all') {
  whereClause.id = { in: clientIds.filter((id) => accessibleClientIds.includes(id)) };
}
```

**Pros**:

- Fixes root cause (visibility matches action permissions)
- Follows principle of least privilege
- Consistent with how other queries work

**Cons**:

- Reduces visible data for assignment-based roles (expected behavior)

**Risk**: Low

### Option B: Grant access for visible clients

**Approach**: Modify `canAccessClientDocuments` to be more permissive.

**Files to change**:

- `services/gateway/src/graphql/resolvers/document.resolvers.ts`: Loosen access check

**Pros**:

- No change to visibility
- Fewer components to modify

**Cons**:

- Violates security model (assignment-based roles shouldn't access unassigned clients)
- Creates inconsistency with other operations

**Risk**: High (security regression)

### Recommendation

**Option A** is the correct fix. The security model is correctly implemented in the mutation; the bug is in the query showing more than it should.

Additionally, consider auditing these related queries for the same issue:

- `clientInboxDocuments(clientId: UUID!)` - line 260
- `clientMape(clientId: UUID!)` - likely needs similar filtering

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] AssociateJr user only sees clients they're assigned to (via ClientTeam or CaseTeam)
2. [ ] Paralegal user only sees clients they're assigned to
3. [ ] Partner/Associate/BusinessOwner still sees all clients
4. [ ] Document creation works for visible clients
5. [ ] No regression in client inbox document queries

### Suggested Test Cases

If adding automated tests:

```typescript
// document.resolvers.test.ts
describe('clientsWithInboxDocuments', () => {
  it('should return all clients for Partner role', async () => {
    // Setup: Create clients with inbox docs, partner user
    // Assert: All clients returned
  });

  it('should only return assigned clients for Paralegal role', async () => {
    // Setup: Create 2 clients with inbox docs
    // - Client A: user assigned via CaseTeam
    // - Client B: user NOT assigned
    // Assert: Only Client A returned
  });

  it('should include clients via implicit case assignment', async () => {
    // Setup: User assigned to case, case belongs to client
    // Assert: Client appears in results
  });
});
```

---

## Investigation Notes

### Files Examined

| File                      | Purpose                      | Relevant Finding                                        |
| ------------------------- | ---------------------------- | ------------------------------------------------------- |
| `document.resolvers.ts`   | Document CRUD                | `clientsWithInboxDocuments` missing role filter         |
| `access-control.ts`       | Centralized access utilities | Has correct logic in `getAccessibleClientIds`           |
| `client.resolvers.ts`     | Client queries               | `clients` query correctly uses `getAccessibleClientIds` |
| `CreateDocumentModal.tsx` | Frontend modal               | Correctly passes caseId or clientId                     |
| `documents/page.tsx`      | Documents page               | Gets clientsWithInboxDocuments and passes to sidebar    |

### Git History

No recent changes to `clientsWithInboxDocuments` - this appears to be a latent bug since the query was created.

### Questions Answered During Investigation

- Q: Why does the error message mention "client" access specifically?
- A: Because when caseId is not provided, the mutation falls back to client inbox mode which uses `canAccessClientDocuments`

- Q: Could this be a timing issue with mapa loading?
- A: No, the investigation shows the query returns unauthorized clients

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug access-control
```

The debug phase will:

1. Read this investigation document
2. Propose the specific implementation
3. Get approval before making changes
4. Implement and verify the fix
