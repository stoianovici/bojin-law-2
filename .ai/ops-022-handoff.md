# Handoff: [OPS-022] Email-to-Case Timeline Integration

**Session**: 2
**Date**: 2025-12-14 11:50
**Status**: In Progress

## Work Completed This Session

Implemented complete email-to-case import feature:

### Backend (services/gateway)

1. **EmailToCaseService** (`src/services/email-to-case.service.ts`)
   - `previewEmailImport()` - Shows email count, date range, discovered contacts
   - `executeEmailImport()` - Links emails, creates CaseActors, imports attachments
   - Contact role suggestion based on email domain patterns
   - Full firmId/userId tenant isolation

2. **GraphQL Schema** (`src/graphql/schema/email-import.graphql`)
   - `EmailImportPreview` type with date range, contacts, stats
   - `ContactCandidate` type with suggested role
   - `previewEmailImport` query
   - `executeEmailImport` mutation

3. **Resolvers** (`src/graphql/resolvers/email-import.resolvers.ts`)
   - Input validation for email addresses
   - Proper error handling with GraphQL errors

### Frontend (apps/web)

4. **useEmailImport Hook** (`src/hooks/useEmailImport.ts`)
   - Multi-step wizard state machine (input → preview → assign → complete)
   - Contact role assignment management
   - Preview and execute GraphQL operations

5. **EmailImportWizard Component** (`src/components/case/EmailImportWizard.tsx`)
   - 4-step modal wizard with progress indicator
   - Step 1: Enter email addresses (add/remove)
   - Step 2: Preview (stats, date range, attachment toggle)
   - Step 3: Assign roles to discovered contacts
   - Step 4: Import results with success/error feedback
   - Romanian UI labels throughout

6. **Integration** - Added "Importă din Email" button to CommunicationsTab

## Current State

All code compiles without errors. The feature is ready for local testing:

```bash
cd /Users/mio/Desktop/dev/Bojin-law\ 2
pnpm dev
# Navigate to a case → Communications tab → Click "Importă din Email"
```

## Testing Needed

1. **Happy path**: Enter valid email addresses → Preview shows emails → Assign roles → Import succeeds
2. **No emails found**: Enter addresses with no synced emails → Shows warning
3. **Contact creation**: Verify CaseActors are created with correct roles
4. **Attachment import**: Enable attachment import → Verify documents created
5. **Error handling**: Test with invalid caseId, unauthorized access

## Blockers/Questions

- Email search uses JSON field queries which may need PostgreSQL-specific syntax - need to test
- Attachment import requires MS Graph access token - needs testing with real auth flow

## Next Steps

1. Test locally with `pnpm dev`
2. Fix any issues found during testing
3. Add activity log entries for imported emails
4. Consider adding "Import from Email" button to case creation flow
5. Consider adding document source indicator ("Din email")

## Key Files

### Created

- `services/gateway/src/services/email-to-case.service.ts`
- `services/gateway/src/graphql/schema/email-import.graphql`
- `services/gateway/src/graphql/resolvers/email-import.resolvers.ts`
- `apps/web/src/hooks/useEmailImport.ts`
- `apps/web/src/components/case/EmailImportWizard.tsx`

### Modified

- `services/gateway/src/graphql/schema/index.ts` - Added email-import schema
- `services/gateway/src/graphql/server.ts` - Added email-import resolvers
- `apps/web/src/components/case/tabs/CommunicationsTab.tsx` - Added wizard button
- `apps/web/src/app/cases/[caseId]/page.tsx` - Pass caseTitle to CommunicationsTab

## Commands/Context to Remember

```bash
# Test locally
pnpm dev

# Commit and deploy when ready
/ops-commit   # Commit changes
/ops-deploy   # Deploy to production

# Files changed (uncommitted):
# - 6 modified files
# - 7 new files (including this handoff)
```

**Git Status at Save:** Uncommitted changes present. Run `/ops-commit` when ready.
