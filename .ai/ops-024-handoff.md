# Handoff: [OPS-024] Email Import - Attachments Not Importing

**Session**: 12
**Date**: 2025-12-15T17:07:00Z
**Status**: Fixing (Web frontend fix deployed, awaiting verification)

## Summary

- **Emails**: WORKING (61 imported)
- **Backend (Gateway)**: WORKING - CaseDocument links exist
- **Frontend (Web)**: FIX DEPLOYED - awaiting verification

## ROOT CAUSE FOUND (Session 12)

**The Documents tab was never connected to the backend.**

In `apps/web/src/app/cases/[caseId]/page.tsx` line 166:

```typescript
documents: [], // TODO: Fetch from API  <-- HARDCODED EMPTY ARRAY!
```

The `DocumentsTab` component just rendered whatever was passed to it. The `useCaseDocuments` hook existed but was never used.

**Backend was working all along** - the session 11 fix created CaseDocument links properly. Diagnostic output showed `linkedToCase` values (3, 14, 4, etc.) confirming data exists.

## Session 12 Fix

Replaced `DocumentsTab` with `CaseDocumentsList` component which properly fetches documents via GraphQL.

Changes to `apps/web/src/app/cases/[caseId]/page.tsx`:

- Import `CaseDocumentsList` instead of `DocumentsTab`
- Add `useAuth` to get user role
- Replace DocumentsTab render with CaseDocumentsList

```typescript
case 'documents':
  return (
    <CaseDocumentsList
      caseId={caseId}
      caseName={caseData.case.title}
      clientId={realCaseData?.client?.id || ''}
      userRole={(user?.role as 'Partner' | 'Associate' | 'Paralegal') || 'Associate'}
      className="p-6"
    />
  );
```

## Commits

- `a478b86` - fix(gateway): create missing CaseDocument links for email attachments (Session 11)
- `ba98ab3` - fix(web): connect Documents tab to backend via CaseDocumentsList (Session 12)

## Deployment Status

- **Web**: Queued/Building (commit `ba98ab3`) - triggered at 17:05 UTC

Check status:

```bash
curl -s -H "Authorization: Bearer rnd_xPmOVitvPACYNfeNEMSDH5ZQfSR0" \
  "https://api.render.com/v1/services/srv-d4dk9fodl3ps73d3d7ig/deploys?limit=1" \
  | jq '.[0] | {status: .deploy.status, commit: .deploy.commit.id[0:7]}'
```

Should show: `status: "live"`, `commit: "ba98ab3"`

## How to Test (Next Session)

1. **Check deployment completed** (see command above)

2. **Test in browser**:
   - Go to case `47504bff-e466-4166-b6a6-16db23ebdb2d`
   - Click on **Documents** tab
   - Verify email attachments appear (should be ~104 documents)

3. **Check Network tab**:
   - Should see `GetCaseDocuments` GraphQL request (previously missing!)
   - Response should contain array of documents

4. **If working**: Close OPS-024

## Key Insight

This was a **frontend display bug**, not a backend data bug:

- Backend: Documents exist, EmailAttachments exist, CaseDocuments exist
- Frontend: Never queried the backend - just displayed empty array

The `CaseDocumentsList` component was already built with proper GraphQL integration (`useCaseDocuments` hook), it was just never used on the main case page.

## Files Modified (Session 12)

- `apps/web/src/app/cases/[caseId]/page.tsx`:
  - Added: `CaseDocumentsList`, `useAuth` imports
  - Removed: `DocumentsTab`, `useRouter`, `handleNewDocument`
  - Changed: Documents tab now renders `CaseDocumentsList`

## Service IDs

- Gateway: `srv-d4pkv8q4i8rc73fq3mvg`
- Web: `srv-d4dk9fodl3ps73d3d7ig`

## Useful Commands

```bash
# Resume this issue
/ops-continue 024

# Check web deployment
curl -s -H "Authorization: Bearer rnd_xPmOVitvPACYNfeNEMSDH5ZQfSR0" \
  "https://api.render.com/v1/services/srv-d4dk9fodl3ps73d3d7ig/deploys?limit=1" \
  | jq '.[0] | {status: .deploy.status, commit: .deploy.commit.id[0:7]}'

# Test locally
pnpm dev
```
