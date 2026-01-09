# Handoff: [OPS-104] Document Preview Fails for Non-Uploader Users

**Session**: 2
**Date**: 2025-12-22 18:00
**Status**: Fixing (implementation complete, awaiting verification)

## Work Completed This Session

Implemented the fix for cross-user document preview access using Option 1:

1. **Schema Update**: Added `oneDriveUserId` field to Document model
2. **Migration**: Created migration with backfill for 393 existing documents
3. **Graph Endpoints**: Added `driveItemByOwner` endpoint for owner-aware API calls
4. **OneDrive Service**: Updated `getPreviewUrl`, `getDocumentDownloadLink`, `getFileThumbnail` to use owner-aware endpoints
5. **Document Resolver**: Updated to pass `oneDriveUserId` to service methods
6. **Document Upload**: Captures uploader's `azureAdId` as `oneDriveUserId`

## Current State

- All code changes complete
- Migration applied to local database (backfilled 393 documents)
- Preflight has pre-existing TypeScript errors in `email.resolvers.ts` (unrelated to this fix)
- Docker builds pass successfully
- **Ready for verification with multiple user accounts**

## Root Cause (from Session 1)

OneDrive API uses `/me/drive/items/` which refers to the CURRENT user's drive, not the document owner's drive. When Associate tries to preview a document uploaded by Partner, it looks in Associate's empty OneDrive.

## Solution Implemented

When documents are uploaded, we now store the uploader's MS Graph user ID (`azureAdId`) in `oneDriveUserId`. When any user requests a preview, we use `/users/${oneDriveUserId}/drive/items/${oneDriveId}/preview` to access the correct OneDrive.

## Local Verification Status

| Step           | Status     | Notes                                                        |
| -------------- | ---------- | ------------------------------------------------------------ |
| Prod data test | ⬜ Pending | Need to test with Partner + Associate accounts               |
| Preflight      | ⬜ Pending | Pre-existing errors in email.resolvers.ts (unrelated to fix) |
| Docker test    | ⬜ Pending |                                                              |

**Verified**: No

## Blockers/Questions

1. **Azure Permission Check**: The fix requires `Files.Read.All` delegated permission to access other users' OneDrives. Need to verify this permission is configured in Azure app registration.

2. **Pre-existing TypeScript Errors**: There are 8 TypeScript errors in `email.resolvers.ts` unrelated to this fix:
   - Missing enum values for `ClassificationAction`
   - Missing `asyncIterator` on PubSub
     These should be fixed in a separate issue.

## Next Steps

1. **Test with production data**:
   - Start dev server with `source .env.prod && pnpm dev`
   - Login as Partner (document uploader)
   - Login as Associate in incognito (non-uploader)
   - Verify Associate can now see document previews

2. **Verify Azure permissions**:
   - Check that `Files.Read.All` is in the delegated permissions
   - If not, add it in Azure Portal

3. **Run full verification gate** when tests pass

## Key Files

- `packages/database/prisma/schema.prisma` - Document model with `oneDriveUserId`
- `packages/database/prisma/migrations/20251222180000_add_one_drive_user_id/migration.sql`
- `services/gateway/src/config/graph.config.ts` - New `driveItemByOwner` endpoint
- `services/gateway/src/services/onedrive.service.ts` - Updated service methods
- `services/gateway/src/graphql/resolvers/document.resolvers.ts` - Resolver changes
