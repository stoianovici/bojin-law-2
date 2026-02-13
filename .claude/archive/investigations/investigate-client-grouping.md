# Investigation: Client-Level Case Grouping Missing

**Slug**: client-grouping
**Date**: 2026-01-10
**Status**: Investigation Complete
**Severity**: Medium
**Next step**: `/debug client-grouping` to implement fix

---

## Bug Summary

**Reported symptom**: Cases with the same client are not grouped under a client parent folder in `/email` and `/documents` sections. Two cases with the same client appear as separate items in a flat list.

**Reproduction steps**:

1. Navigate to `/email`
2. Look at the DOSARE section in the sidebar
3. Observe that cases are listed flat, not grouped by client

**Expected behavior**: Cases should be grouped under their client name, with client-level items (emails/docs not yet assigned to a case) shown at client level:

```
DOSARE
├─ Client ABC Company
│   ├─ [Client Inbox] (3 emails awaiting case assignment)
│   ├─ Case 123/2024 (Dispute)
│   └─ Case 456/2024 (Contract)
└─ Client XYZ Ltd
    └─ Case 789/2024 (Advisory)
```

**Actual behavior**: Cases appear in a flat list:

```
DOSARE
├─ Case 123/2024
├─ Case 456/2024
└─ Case 789/2024
```

**Frequency**: Always
**Scope**: Affects `/email`, `/documents`, and `/cases` pages

---

## Root Cause Analysis

### The Bug

**Root cause**: Client grouping was never implemented. The UI infrastructure exists (component interfaces, GraphQL types) but the wiring between backend data and frontend rendering is missing.

**Type**: Integration bug / Incomplete implementation

### Why It Happens

The codebase has **partial infrastructure** for client-level organization but it was never connected:

#### 1. Data Model Supports It

Cases have a `clientId` field with a relation to `Client`:

```prisma
// packages/database/prisma/schema.prisma:288
model Case {
  clientId String @map("client_id")
  client   Client @relation(fields: [clientId], references: [id])
}
```

#### 2. GraphQL Types & Queries Exist for Client Inbox

`ClientWithInbox`, `ClientActiveCase` types and related queries exist:

- `clientsWithEmailInbox` query - returns clients with `ClientInbox` state emails
- `clientInboxEmails` query - returns emails for a specific client's inbox
- `assignClientInboxToCase` mutation - assigns client inbox email to a case
- `EmailClassificationState.ClientInbox` - state for emails attributed to client but not case

For documents, `CaseDocument` supports client-level assignment:

```prisma
model CaseDocument {
  caseId   String? @map("case_id")   // Nullable for client inbox documents
  clientId String? @map("client_id") // For documents awaiting case assignment
}
```

**These should be integrated into the client folder structure**, not shown separately.

#### 3. Frontend Components Have Optional Props (Never Passed)

- `EmailCaseSidebar.tsx:29-31` has `clientsWithInbox?: ClientWithInbox[]` prop
- `DocumentsSidebar.tsx:35-37` has `clientsWithDocuments?: ClientWithDocuments[]` prop
- But these props are **never passed** from the parent pages

#### 4. Backend Returns Flat Case List

The `emailsByCase` resolver (`email.resolvers.ts:980-1318`) returns cases as a flat array without client information:

```typescript
return {
  cases, // Flat list of CaseWithThreads
  unassignedCase,
  courtEmails,
  uncertainEmails,
};
```

The `CaseWithThreads` type doesn't include client info:

```graphql
type CaseWithThreads {
  id: ID!
  title: String!
  caseNumber: String!
  threads: [ThreadPreview!]!
  unreadCount: Int!
  totalCount: Int!
  # No client field!
}
```

### Why It Wasn't Caught

1. **No tests** for client grouping behavior
2. **Incremental development** - components were built with extensibility in mind (optional props) but the grouping feature was never completed
3. **Existing `ClientWithInbox` feature** is for a different use case (triage of multi-case client emails), causing confusion about what was implemented

---

## Impact Assessment

**Affected functionality**:

- `/email` page - DOSARE section shows flat case list
- `/documents` page - Dosare section shows flat case list
- `/cases` page - Case list shows flat list

**Blast radius**: Moderate - UI organization issue affecting all three main sections

**Related code**:
| File | Purpose | What Needs to Change |
|------|---------|---------------------|
| `services/gateway/src/graphql/schema/email.graphql` | GraphQL types | Add client info to `CaseWithThreads` or create new grouped type |
| `services/gateway/src/graphql/resolvers/email.resolvers.ts` | emailsByCase resolver | Group cases by client |
| `apps/web/src/components/email/EmailCaseSidebar.tsx` | Email sidebar | Render client → cases hierarchy |
| `apps/web/src/components/email/CaseAccordion.tsx` | Case accordion | May need ClientAccordion wrapper |
| `apps/web/src/components/documents/DocumentsSidebar.tsx` | Documents sidebar | Render client → cases hierarchy |
| `apps/web/src/components/cases/CaseListPanel.tsx` | Cases list | Group by client |
| `apps/web/src/types/email.ts` | Frontend types | Add client grouping types |

**Risk of similar bugs**: Medium - Other "infrastructure exists but not wired" issues may exist

---

## Proposed Fix Approaches

### Option A: Backend Grouping (Recommended)

**Approach**: Modify `emailsByCase` (and document equivalent) to return cases grouped by client

**GraphQL Schema Changes**:

```graphql
type ClientWithCases {
  id: ID!
  name: String!
  # Client-level inbox (emails/docs not assigned to a case yet)
  inboxThreads: [ThreadPreview!]!      # Emails with ClientInbox state
  inboxUnreadCount: Int!
  inboxTotalCount: Int!
  # Cases belonging to this client
  cases: [CaseWithThreads!]!
  # Aggregates across all cases
  totalUnreadCount: Int!
  totalEmailCount: Int!
}

type EmailsByCase {
  # Change from flat cases to grouped by client
  clients: [ClientWithCases!]!  # NEW - replaces cases
  # Keep for backwards compat or remove
  cases: [CaseWithThreads!]! @deprecated
  ...
}
```

**Key change**: Client inbox emails (`ClientInbox` state) are now part of the client folder, not a separate section.

**Files to change**:

- `services/gateway/src/graphql/schema/email.graphql`: Add `ClientWithCases` type, update `EmailsByCase`
- `services/gateway/src/graphql/resolvers/email.resolvers.ts`: Group cases by client in resolver
- `apps/web/src/types/email.ts`: Add frontend types
- `apps/web/src/components/email/EmailCaseSidebar.tsx`: Render grouped structure
- Similar changes for documents and cases

**Pros**:

- Clean separation - backend handles data organization
- Single source of truth for grouping logic
- Easy to add sorting (by client name, case count, etc.)

**Cons**:

- Requires GraphQL schema changes
- More backend work

**Risk**: Low

### Option B: Frontend Grouping

**Approach**: Keep backend flat, group on frontend

**Files to change**:

- `apps/web/src/components/email/EmailCaseSidebar.tsx`: Group `cases` by client before rendering
- Need to ensure `CaseWithThreads` includes `client` info (currently doesn't)

**Pros**:

- No GraphQL changes needed (if client info is added to case type)
- Faster to implement

**Cons**:

- Grouping logic duplicated across email/documents/cases
- Need to add client info to multiple GraphQL queries

**Risk**: Medium - Code duplication

### Recommendation

**Option A (Backend Grouping)** is recommended because:

1. Single place for grouping logic
2. Cleaner data contract
3. Easier to maintain consistency across all three pages
4. Better for future features (sorting by client, client-level actions)

---

## Testing Requirements

After fix is implemented, verify:

**Client Grouping**:

1. [ ] `/email` DOSARE section shows cases grouped under client names
2. [ ] `/documents` Dosare section shows cases grouped under client names
3. [ ] `/cases` list shows cases grouped under client names
4. [ ] Cases with single client still display correctly
5. [ ] Expanding a client shows its cases
6. [ ] Selecting a case within a client group works
7. [ ] Thread/document counts roll up correctly to client level
8. [ ] Unread indicators show at both client and case level

**Client Inbox Integration**: 9. [ ] Client inbox emails appear within client folder (not separate CLIENȚI section) 10. [ ] Client inbox shows count of unassigned emails 11. [ ] Clicking client inbox email shows conversation view 12. [ ] Can assign client inbox email to one of client's cases 13. [ ] Client inbox documents appear within client folder 14. [ ] Can assign client inbox document to one of client's cases

### Suggested Test Cases

```typescript
// Email sidebar grouping test
describe('EmailCaseSidebar client grouping', () => {
  it('should group cases by client name', () => {
    // Given cases from two clients
    // When rendered
    // Then cases should be nested under client accordions
  });

  it('should show client-level aggregate counts', () => {
    // Given client with 2 cases, 5 total threads, 2 unread
    // When rendered
    // Then client row should show "5" total and "2" unread badge
  });
});
```

---

## Investigation Notes

### Files Examined

| File                                                        | Purpose        | Relevant Finding                                    |
| ----------------------------------------------------------- | -------------- | --------------------------------------------------- |
| `apps/web/src/app/(dashboard)/email/page.tsx`               | Email page     | Does NOT pass `clientsWithInbox` to sidebar         |
| `apps/web/src/components/email/EmailCaseSidebar.tsx`        | Email sidebar  | Has `clientsWithInbox` prop but never receives data |
| `apps/web/src/components/email/CaseAccordion.tsx`           | Case accordion | Only handles single case, no client parent          |
| `services/gateway/src/graphql/schema/email.graphql`         | GraphQL schema | `CaseWithThreads` lacks client info                 |
| `services/gateway/src/graphql/resolvers/email.resolvers.ts` | Resolver       | Returns flat case list                              |
| `apps/web/src/components/documents/DocumentsSidebar.tsx`    | Docs sidebar   | Same pattern - has prop, not wired                  |
| `apps/web/src/app/(dashboard)/cases/page.tsx`               | Cases page     | Flat list rendering                                 |
| `packages/database/prisma/schema.prisma`                    | Data model     | Case → Client relation EXISTS                       |

### Key Code Locations

- Email resolver (flat list): `email.resolvers.ts:1071-1126`
- Email sidebar client section (unused): `EmailCaseSidebar.tsx:118-138`
- Documents sidebar client section (unused): `DocumentsSidebar.tsx:327-346`

### Clarification from User

- Confirmed expectation: Cases grouped under client names (Option A hierarchy)
- Scope: All three pages (`/email`, `/documents`, `/cases`) for consistency
- **Additional requirement**: Client-level items (emails/docs attributed to client but not yet assigned to a specific case) should appear in the client folder as a "Client Inbox" section, not as a separate top-level section

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug client-grouping
```

The debug phase will:

1. Read this investigation document
2. Propose the specific implementation (likely Option A)
3. Get approval before making changes
4. Implement and verify the fix across all three pages
