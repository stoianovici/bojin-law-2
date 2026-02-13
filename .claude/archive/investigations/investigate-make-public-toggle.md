# Investigation: Missing "Make Public" Toggle for Emails and Documents

**Slug**: make-public-toggle
**Date**: 2026-01-12
**Status**: Investigation Complete
**Severity**: Medium
**Next step**: `/debug make-public-toggle` to implement fix

---

## Bug Summary

**Reported symptom**: After implementing privacy-first policy, the "make public" toggle for emails and documents is not visible for partners.

**Reproduction steps**:

1. Log in as a Partner user
2. Navigate to Documents page
3. Select a case and view documents
4. Hover over a document that should be private (uploaded by the current user)
5. Click the dropdown menu (three dots)
6. Expected: "Fă public" option should appear
7. Actual: Option does not appear

**Expected behavior**: Partners should see a "Fă public" (Make Public) option in the dropdown menu for their own private emails and documents.

**Actual behavior**: The option never appears because the `isPrivate` field is not being fetched from the API.

**Frequency**: Always

---

## Root Cause Analysis

### The Bug

**Root cause**: The `isPrivate` field is not being requested in the GraphQL queries for documents, so it's always `undefined` in the frontend. Since the condition `document.isPrivate && ...` evaluates to `false` when `isPrivate` is `undefined`, the toggle never appears.

**Location**:

- `apps/web/src/graphql/queries.ts:420-450` (GET_CASE_DOCUMENTS query)
- `apps/web/src/hooks/useDocuments.ts:143-161` (transformDocument function)

**Code path**:

```
DocumentsPage → useCaseDocuments(GET_CASE_DOCUMENTS) → apiDocuments (missing isPrivate) → transformDocument (doesn't map isPrivate) → DocumentCard/DocumentListItem (isPrivate undefined) → canMakePublic = false
```

**Type**: Data bug - Field not being fetched from API

### Why It Happens

The privacy-first feature was implemented in two parts:

1. **Backend**: Added `isPrivate`, `markedPublicAt`, `markedPublicBy` fields to the Document and Email types in the GraphQL schema
2. **Frontend components**: Added conditional rendering based on `isPrivate` field

However, the connection between backend and frontend was incomplete:

1. The `GET_CASE_DOCUMENTS` GraphQL query does NOT request the `isPrivate` field from the nested `document` object
2. The `transformDocument` function in `useDocuments.ts` does NOT map the `isPrivate` field to the UI document type

#### For Documents:

**Query issue** (`apps/web/src/graphql/queries.ts:420-450`):

```graphql
export const GET_CASE_DOCUMENTS = gql`
  query GetCaseDocuments($caseId: UUID!) {
    caseDocuments(caseId: $caseId) {
      id
      document {
        id
        fileName
        fileType
        # ... other fields
        # MISSING: isPrivate
      }
      # ...
    }
  }
`;
```

**Transform issue** (`apps/web/src/hooks/useDocuments.ts:143-161`):

```typescript
return {
  id: doc.id,
  fileName: doc.fileName,
  // ... other fields
  // MISSING: isPrivate: doc.isPrivate,
};
```

#### For Emails:

The email queries (`GET_EMAILS_BY_CASE`) DO include `isPrivate` and `userId` fields, so emails should work IF:

1. The user is a Partner/BusinessOwner (`isPartnerDb(user.dbRole)`)
2. The email is marked as private (`thread.isPrivate === true`)
3. The user is the owner (`thread.userId === user.id`)

The condition in `ThreadItem.tsx:30-31`:

```typescript
const canMakePublic =
  thread.isPrivate && user && isPartnerDb(user.dbRole) && thread.userId === user.id;
```

If emails are also not showing the toggle, it could be that:

- Emails are not being marked as `isPrivate: true` by the backend (new emails may default to `false`)
- The `userId` field is not populated correctly

### Why It Wasn't Caught

1. No automated tests for the privacy toggle UI visibility
2. The feature was partially implemented - backend schema has the fields, UI has the conditional logic, but the data flow wasn't connected
3. The `isPrivate` field being `undefined` (falsy) doesn't cause any error - it just silently makes the condition fail

---

## Impact Assessment

**Affected functionality**:

- Document privacy toggle (completely broken)
- Email privacy toggle (potentially working, needs verification)

**Blast radius**: Moderate - Privacy controls are not visible, but data is still protected at the API level (private items are filtered server-side)

**Related code**:

- `apps/web/src/components/documents/DocumentCard.tsx:71-72`: Uses `canMakePublic` condition
- `apps/web/src/components/documents/DocumentListItem.tsx:73-74`: Uses `canMakePublic` condition
- `apps/web/src/components/email/ThreadItem.tsx:30-31`: Uses `canMakePublic` condition

**Risk of similar bugs**: Medium - Other fields added to GraphQL schema may not be fetched in queries

---

## Proposed Fix Approaches

### Option A: Update GraphQL Query and Transform Function

**Approach**: Add `isPrivate` field to the GET_CASE_DOCUMENTS query and update the transformDocument function to map it.

**Files to change**:

- `apps/web/src/graphql/queries.ts`: Add `isPrivate` to document fields in GET_CASE_DOCUMENTS
- `apps/web/src/hooks/useDocuments.ts`: Map `isPrivate` in transformDocument function

**Code changes**:

1. In `GET_CASE_DOCUMENTS` query, add inside `document { ... }`:

```graphql
isPrivate
```

2. In `transformDocument` function return object, add:

```typescript
isPrivate: doc.isPrivate ?? false,
```

3. Update `DocumentData` interface to include:

```typescript
isPrivate?: boolean;
```

**Pros**:

- Simple, focused fix
- Minimal code changes
- Follows existing patterns

**Cons**:

- None significant

**Risk**: Low

### Option B: Add `isPrivate` to All Document Queries

**Approach**: Audit all document-related queries and ensure `isPrivate` is included everywhere documents are fetched.

**Files to change**:

- `apps/web/src/graphql/queries.ts`: Multiple queries
- `apps/web/src/hooks/useDocuments.ts`: Transform function

**Pros**:

- More comprehensive
- Prevents inconsistent data in different views

**Cons**:

- More changes
- Some queries may not need this field

**Risk**: Low-Medium

### Recommendation

**Option A** - The GET_CASE_DOCUMENTS query is the primary document fetching mechanism used in the Documents page. The fix is straightforward and low-risk.

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Log in as Partner user
2. [ ] Upload a new document to a case
3. [ ] Verify the document has `isPrivate: true` in the response
4. [ ] Hover over the document and open the dropdown menu
5. [ ] Confirm "Fă public" option appears
6. [ ] Click "Fă public" and verify the document becomes public
7. [ ] Verify the option disappears after making public
8. [ ] Test in both Grid and List view modes

### For Emails (if also broken):

1. [ ] Verify email queries return `isPrivate` and `userId` fields
2. [ ] Verify hover shows dropdown with "Fă public" for private threads
3. [ ] Test making an email thread public

### Suggested Test Cases

If adding automated tests:

```typescript
// DocumentCard.test.tsx
describe('DocumentCard', () => {
  it('should show "Fă public" option for private documents owned by partner', () => {
    // Mock user as Partner
    // Mock document with isPrivate: true and matching uploadedBy.id
    // Render and verify dropdown contains the option
  });

  it('should NOT show "Fă public" option for public documents', () => {
    // Mock document with isPrivate: false
    // Verify dropdown does not contain the option
  });

  it('should NOT show "Fă public" option for documents owned by others', () => {
    // Mock document with different uploadedBy.id
    // Verify dropdown does not contain the option
  });
});
```

---

## Investigation Notes

### Files Examined

| File                                                     | Purpose                  | Relevant Finding                                       |
| -------------------------------------------------------- | ------------------------ | ------------------------------------------------------ |
| `apps/web/src/components/documents/DocumentCard.tsx`     | Document card UI         | Has `canMakePublic` condition checking `isPrivate`     |
| `apps/web/src/components/documents/DocumentListItem.tsx` | Document list item UI    | Has `canMakePublic` condition checking `isPrivate`     |
| `apps/web/src/components/email/ThreadItem.tsx`           | Email thread item UI     | Has `canMakePublic` condition checking `isPrivate`     |
| `apps/web/src/graphql/queries.ts`                        | GraphQL queries          | GET_CASE_DOCUMENTS does NOT include `isPrivate`        |
| `apps/web/src/graphql/mutations.ts`                      | GraphQL mutations        | MARK_DOCUMENT_PUBLIC mutation exists and looks correct |
| `apps/web/src/hooks/useDocuments.ts`                     | Document fetching hooks  | `transformDocument` does NOT map `isPrivate`           |
| `apps/web/src/types/document.ts`                         | Document type definition | `isPrivate` is optional field                          |
| `apps/web/src/types/email.ts`                            | Email type definition    | `isPrivate` and `userId` are defined                   |
| `services/gateway/src/graphql/schema/document.graphql`   | Document schema          | `isPrivate: Boolean!` field exists at line 141         |
| `apps/web/src/store/authStore.ts`                        | Auth state               | `isPartnerDb` helper function exists                   |

### Git History

The privacy-first implementation was added recently. The schema fields exist but the frontend query was not updated to fetch them.

### Questions Answered During Investigation

- Q: Is `isPrivate` available in the GraphQL schema?
- A: Yes, it's defined at `document.graphql:141` as `isPrivate: Boolean!`

- Q: Are the mutations for marking documents public working?
- A: The mutations exist (`MARK_DOCUMENT_PUBLIC`, `MARK_EMAIL_PUBLIC`) and appear correct

- Q: Why doesn't the toggle appear?
- A: The `isPrivate` field is not fetched in GET_CASE_DOCUMENTS query, so it's always `undefined` in the UI

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug make-public-toggle
```

The debug phase will:

1. Read this investigation document
2. Propose the specific implementation
3. Get approval before making changes
4. Implement and verify the fix
