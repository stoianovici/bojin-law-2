# Investigation: Client Inbox Emails Not Appearing

**Date:** 2026-01-12
**Status:** Root Cause Identified
**Symptom:** Only emails from the client folder don't appear when selected. All other folders work correctly.

## Executive Summary

When a user clicks on an email in the **Client Inbox** folder (under a client accordion), the email content panel shows "Selectează o conversație" (empty state) instead of displaying the email content. Case folder emails work correctly.

**Root Cause:** The `emailThread` GraphQL resolver returns data correctly (verified via logging: "Found thread with 1 emails"), but the response is received as `null` by the frontend. This indicates a **GraphQL serialization mismatch** between the returned `EmailThread` object and the schema definition.

## Evidence

### 1. Bug Reproduction

**Steps to reproduce:**

1. Navigate to `/email`
2. Expand client accordion (e.g., "T.T. & CO Solaria Grup SRL")
3. Click on "Inbox Client" folder
4. Click on any email in the client inbox

**Expected:** Email content displays in right panel
**Actual:** Right panel shows empty state "Selectează o conversație"

### 2. Data Verification

**Database query confirms email exists:**

```sql
SELECT id, classification_state, conversation_id, firm_id
FROM emails
WHERE conversation_id = 'AAQkADEwN2ViMGU0LTBkY2EtNDBlYy05OTVhLTcyYTk5YjY2ZWUzZgAQAPD1nszK6EExm_lGtGEo9Pg='
  AND firm_id = '51f2f797-3109-4b79-ac43-a57ecc07bb06';
-- Returns: 1 row with ClientInbox state
```

### 3. Direct Prisma Query Works

Created test script that runs the exact Prisma query used by `getThread`:

```typescript
const emails = await prisma.email.findMany({
  where: { conversationId, firmId },
  orderBy: { receivedDateTime: 'asc' },
});
// Result: 1 email found with correct data
```

### 4. `getThread` Service Method Works

Tested `EmailThreadService.getThread()` directly:

```
Testing getThread with:
  conversationId: AAQkADEwN2ViMGU0LTBkY2EtNDBlYy05OTVhLTcyYTk5YjY2ZWUzZgAQAPD1nszK6EExm_lGtGEo9Pg=
  firmId: 51f2f797-3109-4b79-ac43-a57ecc07bb06

Result: Found thread
  id: AAQkADEwN2ViMGU0LTBkY2EtNDBlYy05OTVhLTcyYTk5YjY2ZWUzZgAQAPD1nszK6EExm_lGtGEo9Pg=
  subject: facturi actiune anulare si cerere suspendare CIP
  emails count: 1
```

### 5. Gateway Resolver Logs Show Success

```
[emailThread] DEBUG Query called with: {
  conversationId: 'AAQkADEwN2ViMGU0LTBkY2EtNDBlYy05OTVhLTcyYTk5YjY2ZWUzZgAQAPD1nszK6EExm_lGtGEo9Pg=',
  conversationIdLength: 80,
}
[emailThread] DEBUG Result: Found thread with 1 emails firmId used: 51f2f797-3109-4b79-ac43-a57ecc07bb06
```

### 6. Frontend Apollo Cache Shows Null

```javascript
// Apollo cache after query
"emailThread({\"conversationId\":\"AAQkADEwN2ViMGU0LTBkY2EtNDBlYy05OTVhLTcyYTk5YjY2ZWUzZgAQAPD1nszK6EExm_lGtGEo9Pg=\"})": null
```

### 7. Frontend Console Logs

```
[useEmailThread] Called with: conversationId=AAQkADEwN2ViMGU0LTBkY2EtNDBlYy05OTVhLTcyYTk5YjY2Z...
[useEmailThread] Result: {hasData: false, loading: false, hasError: false}
```

## Root Cause Analysis

**The disconnect occurs between:**

- Gateway resolver: Returns valid `EmailThread` object with 1 email
- GraphQL response: `null` received by frontend

**This indicates a GraphQL schema/serialization issue:**

1. The `EmailThread` type returned by `groupEmailsIntoThreads()` may have fields that don't match the GraphQL schema
2. A field resolver for `EmailThread` may be throwing an error silently
3. A required field in the GraphQL schema may be missing from the returned object

## Code Path

### Sidebar Query (`emailsByCase`)

```
emailsByCase resolver
  → prisma.email.findMany({ where: { userId, firmId, classificationState: 'ClientInbox' } })
  → Groups by conversationId || email.id
  → Returns: inboxThreads[] with { id: convId, conversationId: convId, ... }
```

### Thread Query (`emailThread`)

```
emailThread resolver (args.conversationId, user.firmId)
  → emailThreadService.getThread(conversationId, firmId, accessToken)
  → prisma.email.findMany({ where: { conversationId, firmId } })
  → groupEmailsIntoThreads(emails)
  → Returns: EmailThread object ✓
  → GraphQL serialization → ❌ (becomes null)
```

## Key Files

| File                                                                | Purpose                    |
| ------------------------------------------------------------------- | -------------------------- |
| `services/gateway/src/graphql/resolvers/email.resolvers.ts:529-553` | `emailThread` resolver     |
| `services/gateway/src/services/email-thread.service.ts:484-584`     | `getThread` method         |
| `services/gateway/src/graphql/schema/email.graphql`                 | GraphQL schema definitions |
| `apps/web/src/graphql/queries.ts:813-870`                           | `GET_EMAIL_THREAD` query   |

## Hypothesis for Fix

The `EmailThread` type returned by the service may have:

1. A field with wrong type (e.g., `Date` object vs ISO string)
2. A missing required field in the GraphQL schema
3. A circular reference or unserializable value

**Suggested debugging approach:**

1. Compare `EmailThread` type in GraphQL schema vs service return type
2. Check each field's serialization in the resolver
3. Add try/catch with detailed error logging around the return
4. Use GraphQL introspection to verify schema alignment

## Comparison: Working vs Non-Working

| Aspect               | Case Folder Emails          | Client Inbox Emails                 |
| -------------------- | --------------------------- | ----------------------------------- |
| Classification State | `Classified`                | `ClientInbox`                       |
| Query Source         | emailsByCase → case.threads | emailsByCase → client.inboxThreads  |
| conversationId       | Same format                 | Same format                         |
| getThread result     | Works                       | Returns data but serializes to null |
| Database query       | Works                       | Works                               |

## Next Steps (for /debug)

1. Add detailed GraphQL error logging to identify serialization failures
2. Compare EmailThread schema definition with service return type
3. Check for nullable vs non-nullable field mismatches
4. Test with minimal EmailThread response to isolate problematic field
