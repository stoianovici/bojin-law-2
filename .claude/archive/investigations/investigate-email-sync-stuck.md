# Investigation: Email Sync Gets Stuck

**Slug**: email-sync-stuck
**Date**: 2026-01-14
**Status**: Investigation Complete
**Severity**: High
**Next step**: `/debug email-sync-stuck` to implement fix

---

## Bug Summary

**Reported symptom**: Email sync for case "negrea c. noventa" was stuck for 2 days. After some changes were made, it got stuck again.

**Reproduction steps**:

1. Create a case with contacts (or add a contact to an existing case)
2. Historical email sync job is queued
3. Wait for the sync to process (especially for contacts with many emails)
4. Sync gets stuck or fails repeatedly

**Expected behavior**: Email sync should complete, fetching all historical emails for the contact and linking them to the case.

**Actual behavior**: Sync gets stuck in "Syncing" status or fails repeatedly without proper completion.

**Frequency**: Likely occurs when:

- Sync takes longer than 1 hour (many emails/attachments)
- Jobs sit in queue for more than 1 hour before processing
- User's session expires during sync

---

## Root Cause Analysis

### The Bug

**Root cause**: The historical email sync worker stores the Microsoft Graph access token in the BullMQ job data at queue time. Access tokens expire after ~1 hour. When the sync takes longer than the token lifetime, or when jobs wait in queue before processing, all Graph API calls fail with authentication errors.

**Location**: `services/gateway/src/workers/historical-email-sync.worker.ts:56-148`

**Code path**:

```
queueHistoricalSyncJob() → stores accessToken from context.user.accessToken in job data
    ↓
BullMQ picks up job (could be immediately or after waiting)
    ↓
processHistoricalSyncJob() → uses job.data.accessToken (potentially expired)
    ↓
service.syncHistoricalEmails() → makes Graph API calls with expired token
    ↓
Graph API returns 401 InvalidAuthenticationToken
    ↓
Job fails, retries with same expired token, fails again
    ↓
Case stays in "Syncing" status or moves to "Failed"
```

**Type**: Integration bug / Authentication handling gap

### Why It Happens

The access token is captured at job creation time in `queueHistoricalSyncJob()`:

```typescript
// services/gateway/src/graphql/resolvers/case.resolvers.ts:1241-1245
await queueHistoricalSyncJob({
  caseId: newCase.id,
  contactEmail: contact.email.toLowerCase().trim(),
  accessToken: context.user.accessToken, // <-- Token captured HERE
  userId: user.id,
});
```

This token is stored in BullMQ job data and used when the job is processed. Microsoft Graph access tokens have a default lifetime of ~1 hour. When:

1. **Jobs wait in queue**: With concurrency=3 and rate limiting (50 jobs/min), jobs can queue up
2. **Sync takes a long time**: Syncing thousands of emails with attachments can take hours
3. **User session expires**: User logs out or session times out during background sync

The token in job data becomes stale, and all subsequent API calls fail.

**Critical evidence**: The `email-subscription-renewal.worker.ts` correctly handles this by retrieving a fresh token at processing time:

```typescript
// services/gateway/src/workers/email-subscription-renewal.worker.ts:102
accessToken = await getGraphToken(syncState.userId);
```

But `historical-email-sync.worker.ts` does NOT use this pattern - it relies on the stale token from job data.

### Why It Wasn't Caught

1. **Works in short syncs**: For small cases with few emails, sync completes within the token lifetime
2. **Works immediately after login**: Token is fresh when user creates case
3. **No token expiry test coverage**: Tests don't simulate long-running syncs
4. **Different worker patterns**: The subscription renewal worker uses the correct pattern, suggesting this was an oversight in the historical sync implementation

---

## Impact Assessment

**Affected functionality**:

- Historical email sync for new cases
- Adding contacts to existing cases
- Any sync operation that takes >1 hour or waits >1 hour in queue

**Blast radius**: Moderate - affects cases with many historical emails or during high system load

**Related code**:

- `services/gateway/src/services/historical-email-sync.service.ts`: Core sync logic
- `services/gateway/src/services/case-sync.service.ts`: Orchestrates sync jobs
- `services/gateway/src/graphql/resolvers/case.resolvers.ts`: Creates sync jobs
- `services/gateway/src/graphql/resolvers/email.resolvers.ts`: Manual sync trigger

**Risk of similar bugs**: Medium - other background jobs that use access tokens may have the same issue

---

## Proposed Fix Approaches

### Option A: Retrieve Fresh Token at Processing Time (Recommended)

**Approach**: Modify the worker to retrieve a fresh access token from the user's session at processing time, similar to `email-subscription-renewal.worker.ts`.

**Files to change**:

- `services/gateway/src/workers/historical-email-sync.worker.ts`:
  - Import `getGraphToken` from token helpers
  - In `processHistoricalSyncJob()`, retrieve fresh token using `getGraphToken(userId)`
  - Remove `accessToken` from job data interface (or keep for fallback)

**Implementation sketch**:

```typescript
// In processHistoricalSyncJob()
async function processHistoricalSyncJob(job: Job<HistoricalSyncJobData>) {
  const { jobId, caseId, contactEmail, userId } = job.data;

  // Get fresh token instead of using stale job.data.accessToken
  let accessToken: string;
  try {
    accessToken = await getGraphToken(userId);
  } catch (tokenError) {
    // User session expired - mark job as failed with clear message
    throw new Error(`User session expired. Please log in and retry sync.`);
  }

  // Continue with fresh token...
}
```

**Pros**:

- Direct fix for the root cause
- Follows existing pattern in email-subscription-renewal.worker.ts
- Token is always fresh when making API calls
- Minimal code changes

**Cons**:

- Requires user to have active session (they must be logged in)
- If user logs out, sync will fail (but with clear error message)

**Risk**: Low

### Option B: Use Application Tokens (Client Credentials Flow) ⭐ RECOMMENDED

**Approach**: Use app-level access tokens (client credentials flow) instead of delegated user tokens for background sync operations. This allows background workers to operate independently of user sessions.

**Existing Infrastructure** (already implemented):

- `GraphService.getAppClient()` in `graph.service.ts:79` - acquires app-only tokens via MSAL
- `User.azureAdId` field in database - stores Azure AD user ID for `/users/{id}/...` endpoints
- `graphScopes.application` in `graph.config.ts:77` - defines required app permissions
- Already used by `bulk-communication.service.ts` for sending emails

**Files to change**:

- `services/gateway/src/workers/historical-email-sync.worker.ts`:
  - Remove `accessToken` from job data (no longer needed)
  - Get user's `azureAdId` from database
  - Use `GraphService.getAppClient()` instead of user token
- `services/gateway/src/services/historical-email-sync.service.ts`:
  - Change `fetchEmailsByContact()` to accept `azureAdId` parameter
  - Change endpoint from `/me/messages` → `/users/{azureAdId}/messages`
  - Same change for attachment endpoints
- `services/gateway/src/config/graph.config.ts`:
  - Add user-specific mail endpoints: `userMessages: (userId) => /users/${userId}/messages`

**Azure AD Configuration Required**:

- Grant **application permission** `Mail.Read` (not delegated)
- Admin consent required (one-time setup in Azure Portal)
- This grants the app access to read mail for all users in the tenant

**Implementation sketch**:

```typescript
// In historical-email-sync.worker.ts
async function processHistoricalSyncJob(job: Job<HistoricalSyncJobData>) {
  const { jobId, caseId, contactEmail, userId } = job.data;

  // Get user's Azure AD ID from database
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { azureAdId: true },
  });

  if (!user?.azureAdId) {
    throw new Error('User Azure AD ID not found');
  }

  // Use app-only client (no user session needed)
  const graphService = new GraphService();
  const appClient = await graphService.getAppClient();

  // Call service with azureAdId instead of accessToken
  const result = await service.syncHistoricalEmails(
    jobId, caseId, contactEmail, user.azureAdId, userId, job
  );
}

// In historical-email-sync.service.ts
private async fetchEmailsByContact(
  appClient: Client,
  azureAdId: string,  // Changed from accessToken
  contactEmail: string,
  sinceDate: Date
) {
  // Use /users/{azureAdId}/messages instead of /me/messages
  let response = await appClient
    .api(`/users/${azureAdId}/messages`)
    .search(`"${contactEmail}"`)
    .select('id,hasAttachments,receivedDateTime')
    .top(BATCH_SIZE)
    .get();
  // ...
}
```

**Pros**:

- No dependency on user session - works even when user is logged out
- Token automatically refreshed by MSAL (no manual refresh needed)
- Works for long-running syncs (hours/days)
- Follows enterprise integration best practices
- Already partially implemented (`getAppClient()` exists and works)
- Used successfully by `bulk-communication.service.ts`

**Cons**:

- Requires one-time admin consent for `Mail.Read` application permission
- Application permission grants access to ALL users' mailboxes (standard for enterprise apps)
- Slightly more code changes than Option A
- Need to change endpoint pattern from `/me/...` to `/users/{id}/...`

**Security Considerations**:

- `Mail.Read` application permission is standard for enterprise email integration
- The app already has MSAL client credentials configured
- Access is scoped to the organization's tenant only
- Audit logs track all Graph API calls
- This is the recommended pattern for background/daemon applications per Microsoft docs

**Risk**: Low-Medium (one-time Azure AD config, but follows established patterns)

### Option C: Implement Token Refresh in Worker

**Approach**: Store refresh token in job data and implement token refresh logic in the worker when access token expires.

**Files to change**:

- `services/gateway/src/workers/historical-email-sync.worker.ts`: Add refresh logic
- `HistoricalSyncJobData` interface: Add refreshToken field
- Queue function: Include refresh token in job data

**Pros**:

- Self-contained - doesn't depend on active session
- Can handle long-running syncs

**Cons**:

- Storing refresh tokens in job data is a security concern
- More complex implementation
- Refresh tokens also expire (though longer-lived)

**Risk**: Medium-High (security concerns)

### Recommendation

**Option B (App-Only Tokens)** is now recommended because:

1. Works independently of user sessions - no risk of sync failing due to logout
2. Infrastructure already exists (`getAppClient()`, `azureAdId` field)
3. Already proven in production (`bulk-communication.service.ts` uses it)
4. Follows Microsoft's recommended pattern for daemon/background apps
5. Token refresh handled automatically by MSAL - no manual refresh code needed
6. Robust for long-running syncs that take hours

**Fallback**: If Azure AD admin consent is not immediately available, Option A can be implemented as a quick fix, then upgraded to Option B later.

**Azure AD Setup Required** (one-time, by admin):

1. Go to Azure Portal → App Registrations → Your App → API Permissions
2. Add permission → Microsoft Graph → Application permissions → `Mail.Read`
3. Click "Grant admin consent for [organization]"

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Original bug no longer reproduces - sync completes for contacts with many emails
2. [ ] Sync works for cases with >1000 historical emails
3. [ ] Sync works when jobs wait in queue for extended periods
4. [ ] Clear error message when user session expires during sync
5. [ ] Retry functionality works with fresh token retrieval
6. [ ] Case sync status correctly reflects job outcomes

### Suggested Test Cases

```typescript
// historical-email-sync.worker.test.ts
describe('Historical Email Sync Worker', () => {
  it('should retrieve fresh token at processing time', async () => {
    // Queue job with potentially stale token
    // Verify worker calls getGraphToken(userId) instead of using job.data.accessToken
  });

  it('should fail gracefully when user session is expired', async () => {
    // Setup: User has no active session
    // Verify: Job fails with clear "session expired" error
    // Verify: Case status is updated to Failed with appropriate message
  });

  it('should handle token refresh during long sync', async () => {
    // Setup: Large sync with many emails
    // Verify: Fresh tokens are used throughout the process
  });
});
```

---

## Investigation Notes

### Files Examined

| File                                   | Purpose            | Relevant Finding                   |
| -------------------------------------- | ------------------ | ---------------------------------- |
| `historical-email-sync.worker.ts`      | BullMQ worker      | Uses stale token from job data     |
| `historical-email-sync.service.ts`     | Core sync logic    | Takes accessToken as parameter     |
| `email-subscription-renewal.worker.ts` | Renewal worker     | Correctly uses `getGraphToken()`   |
| `token-helpers.ts`                     | Token utilities    | Has `getGraphToken(userId)` helper |
| `graph-error-handler.ts`               | Error handling     | Categorizes 401 as AUTH error      |
| `case-sync.service.ts`                 | Sync orchestration | Passes token from context          |
| `case.resolvers.ts`                    | GraphQL resolvers  | Queues jobs with current token     |

### Git History

Recent changes added progress tracking and lock extension to prevent stalling, but did not address the token expiry issue:

- `23bcfb1` - Dropdown for case assignment
- `e3294b5` - Privacy toggle icons
- Recent changes to `historical-email-sync.service.ts` added `updateJobProgress()` and lock extension

### Questions Answered During Investigation

- Q: Why does it get stuck?
- A: Access token expires after ~1 hour. The worker uses the token captured at job creation time, which becomes stale.

- Q: Why does retry not help?
- A: All retry attempts use the same expired token from job data.

- Q: Why does `email-subscription-renewal.worker.ts` work correctly?
- A: It retrieves fresh tokens using `getGraphToken(userId)` at processing time.

- Q: Do workers work when user is logged out?
- A: No. Both the current implementation and Option A require active user sessions. Only Option B (app-only tokens) works without user sessions.

- Q: Is app-only token infrastructure available?
- A: Yes. `GraphService.getAppClient()` exists and is used by `bulk-communication.service.ts`. The `User.azureAdId` field stores Azure AD user IDs. Only change needed is the endpoint pattern (`/me/...` → `/users/{azureAdId}/...`) and Azure AD permission consent.

### Pre-Implementation Checklist

Before implementing Option B, verify Azure AD permissions:

1. Check if `Mail.Read` **application** permission is already granted in Azure Portal
2. If not granted, request admin consent (requires Azure AD admin)
3. Test `getAppClient()` can successfully acquire a token

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug email-sync-stuck
```

The debug phase will:

1. Read this investigation document
2. Implement Option A: Retrieve fresh token at processing time
3. Add error handling for expired sessions
4. Verify the fix works
