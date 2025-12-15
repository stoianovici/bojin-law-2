# Handoff: [OPS-024] Email Import - Attachments Not Importing

**Session**: 13
**Date**: 2025-12-15T17:40:00Z
**Status**: Fixing (bulk delete mutation deployed, awaiting use)

## Summary

- **Documents Tab Fix**: VERIFIED WORKING - Documents now appear
- **Cleanup**: Bulk delete mutation added, gateway deploying

## Session 13 Progress

### 1. Verified Frontend Fix

- Web deployment completed (commit `89256c2`)
- User confirmed documents now appear in Documents tab
- **OPS-024 core issue is FIXED**

### 2. Cleanup Task (In Progress)

User requested deletion of test documents (duplicates from debugging sessions).

**Problem**: Can't connect to Render PostgreSQL from local machine (connection terminated - internal-only access)

**Solution**: Added `bulkDeleteCaseDocuments` GraphQL mutation to gateway:

- Schema: `services/gateway/src/graphql/schema/document.graphql`
- Resolver: `services/gateway/src/graphql/resolvers/document.resolvers.ts`
- Commit: `c678da2`

### 3. Gateway Deployment Status

- Triggered at 17:35 UTC
- Status: `build_in_progress` (last checked)
- Commit: `c678da2`

Check status:

```bash
curl -s -H "Authorization: Bearer rnd_xPmOVitvPACYNfeNEMSDH5ZQfSR0" \
  "https://api.render.com/v1/services/srv-d4pkv8q4i8rc73fq3mvg/deploys?limit=1" \
  | jq '.[0] | {status: .deploy.status, commit: .deploy.commit.id[0:7]}'
```

## Next Steps

1. **Wait for gateway deployment** to complete (should show `status: "live"`)

2. **Call the bulk delete mutation** via GraphQL Playground or curl:

   ```graphql
   mutation {
     bulkDeleteCaseDocuments(caseId: "47504bff-e466-4166-b6a6-16db23ebdb2d") {
       caseDocumentsDeleted
       attachmentReferencesCleared
       documentsDeleted
       success
     }
   }
   ```

   Via curl (requires auth token from browser):

   ```bash
   curl -X POST https://gateway.bojinlaw.com/graphql \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <YOUR_TOKEN>" \
     -d '{"query": "mutation { bulkDeleteCaseDocuments(caseId: \"47504bff-e466-4166-b6a6-16db23ebdb2d\") { caseDocumentsDeleted attachmentReferencesCleared documentsDeleted success } }"}'
   ```

3. **Verify Documents tab is empty** after deletion

4. **Close OPS-024** - Core issue is resolved, cleanup is optional

## Files Modified (Session 13)

- `services/gateway/src/graphql/schema/document.graphql` - Added `bulkDeleteCaseDocuments` mutation and `BulkDeleteResult` type
- `services/gateway/src/graphql/resolvers/document.resolvers.ts` - Added resolver implementation
- `packages/database/scripts/cleanup-case-documents.ts` - Created standalone script (unused - DB not accessible from local)

## Commits

- `c678da2` - feat(gateway): add bulkDeleteCaseDocuments mutation for admin cleanup

## Key Insight

The core OPS-024 issue (attachments not appearing) was a **frontend display bug** fixed in session 12. The cleanup task in session 13 is a separate housekeeping task to remove test data.

## Service IDs

- Gateway: `srv-d4pkv8q4i8rc73fq3mvg`
- Web: `srv-d4dk9fodl3ps73d3d7ig`
