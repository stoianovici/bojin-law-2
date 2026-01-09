# Handoff: [OPS-027] Classification Schema & Data Model

**Session**: 1
**Date**: 2025-12-16
**Status**: Verifying

## Work Completed This Session

### Schema Changes (Prisma)

1. **Case Model** - Added 4 classification fields:
   - `keywords` (String[], default []) - User-defined terms for email matching
   - `referenceNumbers` (String[], default []) - Court file numbers (e.g., "1234/5/2024")
   - `subjectPatterns` (String[], default []) - Email subject patterns for matching
   - `classificationNotes` (String?) - Free text guidance for AI classifier

2. **GlobalEmailSource Model** - New table for firm-level institutional sources:

   ```
   - id: UUID
   - firmId: UUID (FK to Firm)
   - category: GlobalEmailSourceCategory enum
   - name: String (e.g., "Tribunalul București")
   - domains: String[] (e.g., ["just.ro"])
   - emails: String[] (specific addresses)
   - classificationHint: String? (AI guidance)
   - createdAt, updatedAt
   ```

3. **GlobalEmailSourceCategory Enum**:
   - Court, Notary, Bailiff, Authority, Other

4. **CaseActor Model** - Added:
   - `emailDomains` (String[], default []) - Additional email domains for actor

### Migration

Created and applied: `20251216120000_add_email_classification_schema`

## Current State

- Schema changes complete and applied to local DB
- Prisma client regenerated with new types
- Dev server runs successfully
- App loads and existing functionality works
- OPS-028 work (GraphQL schema + resolvers) already exists and integrates with these changes

## Local Verification Status

| Step           | Status     | Notes                        |
| -------------- | ---------- | ---------------------------- |
| Prod data test | ✅ Passed  | App loads, migration applied |
| Preflight      | ⬜ Pending |                              |
| Docker test    | ⬜ Pending |                              |

**Verified**: No

## Blockers/Questions

None - straightforward schema addition with defaults for all new fields.

## Next Steps

1. Run `pnpm preflight:full` to verify build
2. Run `pnpm preview` for Docker verification
3. Close issue once all verification passes

## Key Files

- `packages/database/prisma/schema.prisma` - Schema changes
- `packages/database/prisma/migrations/20251216120000_add_email_classification_schema/migration.sql` - Migration

## Related Issues

- **OPS-028** (Classification Metadata UI) - Already has GraphQL schema and resolvers for GlobalEmailSource CRUD
- **OPS-029** (AI Email Classification Service) - Will use these fields for classification logic
