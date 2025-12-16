# Multi-Case Email Classification - Feature Handoff

**Issues:** OPS-027, OPS-028, OPS-029, OPS-030, OPS-031
**Date:** 2025-12-16
**Status:** 4 of 5 issues complete, OPS-031 in progress

---

## Executive Summary

This feature set solves a critical problem: when a client has multiple active cases, the platform now intelligently classifies emails to the correct case instead of dumping all emails into one case.

**Problem Solved:** Previously, importing emails for a contact (e.g., `client@company.ro`) imported ALL their emails into a single case, even if some emails belonged to other cases for the same client.

**Solution Delivered:** AI-powered email classification with:

- Case metadata for matching (keywords, reference numbers)
- Global email sources for courts/authorities (special handling)
- Confidence scoring with human review for uncertain cases
- Multi-case import wizard with classification preview

---

## Implementation Status

| Issue   | Title                     | Status         | Verification          |
| ------- | ------------------------- | -------------- | --------------------- |
| OPS-027 | Schema & Data Model       | ✅ Complete    | Pending preflight     |
| OPS-028 | Metadata UI               | ✅ Complete    | Pending preflight     |
| OPS-029 | AI Classification Service | ✅ Complete    | 31 unit tests passing |
| OPS-030 | Email Import Integration  | ✅ Complete    | Pending E2E test      |
| OPS-031 | Review & Correction       | 🔄 In Progress | Not started           |

---

## What Was Built

### OPS-027: Database Schema

**New Case fields:**

```prisma
keywords            String[]    // User-defined terms for matching
referenceNumbers    String[]    // Court file numbers, contract refs
subjectPatterns     String[]    // Email subject patterns
classificationNotes String?     // Free text guidance for AI
```

**New GlobalEmailSource table:**

- For firm-level court/authority addresses
- Categories: Court, Notary, Bailiff, Authority, Other
- Domains and specific emails
- Classification hints

**CaseActor enhancement:**

- Added `emailDomains` field for domain-based matching

### OPS-028: UI Components

**Firm Settings (`/settings/firm`):**

- `GlobalEmailSourcesPanel.tsx` - CRUD for court/authority addresses
- Category icons and Romanian labels

**Case Settings:**

- `ClassificationSettingsPanel.tsx` - Edit keywords, references, notes
- `ClassificationMetadataStep.tsx` - Optional wizard step (not integrated)

**GraphQL:**

- Full CRUD for GlobalEmailSource
- `updateCaseClassification` mutation

### OPS-029: AI Classification Service

**Algorithm (`email-classification.service.ts`):**

1. Global source detection (courts skip actor matching)
2. Reference number extraction (`reference-extractor.ts`)
3. CaseActor email/domain matching
4. Keyword matching with weights
5. Subject pattern matching (glob-style)
6. AI semantic analysis fallback
7. Confidence scoring with thresholds

**Confidence Thresholds:**

- > 0.85: Auto-assign
- 0.50 - 0.85: Assign with review flag
- < 0.50: Needs human review

**Unit Tests:** 31 tests for reference extraction (all passing)

### OPS-030: Email Import Integration

**Modified EmailImportWizard:**

- Detects multi-case clients automatically
- 5-step flow for multi-case (vs 4-step for single-case):
  1. Input emails
  2. Preview stats
  3. **Classification** (NEW) - review AI assignments
  4. Assign roles
  5. Complete

**Classification Step Features:**

- Summary by case (auto vs needs review)
- Email list with confidence scores
- Override case assignment per email
- Exclude emails from import
- Bulk actions

**GraphQL Operations:**

```graphql
query clientHasMultipleCases(caseId: ID!): Boolean!
query previewClassificationForImport(input: PreviewClassificationForImportInput!): EmailClassificationPreview!
mutation executeClassifiedImport(input: ExecuteClassifiedImportInput!): ClassifiedImportResult!
```

### OPS-031: Review & Correction (In Progress)

**Planned:**

- "De clasificat" review queue for uncertain emails
- Email reassignment between cases
- Audit trail for all classification actions
- Classification insights dashboard

---

## Files Created/Modified

### New Files (21 total)

**Database:**

- `packages/database/prisma/migrations/20251216120000_add_email_classification_schema/`

**AI Service:**

- `services/ai-service/src/utils/reference-extractor.ts`
- `services/ai-service/src/services/email-classification.service.ts`
- `services/ai-service/src/utils/__tests__/reference-extractor.test.ts`

**Gateway:**

- `services/gateway/src/graphql/schema/global-email-sources.graphql`
- `services/gateway/src/graphql/schema/email-classification.graphql`
- `services/gateway/src/graphql/resolvers/global-email-sources.resolvers.ts`
- `services/gateway/src/graphql/resolvers/email-classification.resolvers.ts`

**Frontend:**

- `apps/web/src/hooks/useGlobalEmailSources.ts`
- `apps/web/src/components/settings/GlobalEmailSourcesPanel.tsx`
- `apps/web/src/components/case/ClassificationMetadataStep.tsx`
- `apps/web/src/components/case/ClassificationSettingsPanel.tsx`
- `apps/web/src/app/settings/firm/page.tsx`

### Modified Files

- `packages/database/prisma/schema.prisma`
- `services/gateway/src/graphql/server.ts`
- `services/gateway/src/graphql/schema/case.graphql`
- `services/gateway/src/graphql/schema/index.ts`
- `apps/web/src/hooks/useEmailImport.ts`
- `apps/web/src/components/case/EmailImportWizard.tsx`
- `apps/web/src/components/layout/Sidebar.tsx`

---

## How to Test

### 1. Prerequisites

- Production data imported locally (has TT Solaria with 2 cases)
- Dev servers running: `pnpm dev`

### 2. Test Global Email Sources

1. Go to `/settings/firm`
2. Add a court domain (e.g., `just.ro`)
3. Verify CRUD operations work

### 3. Test Case Classification Metadata

1. Open any case settings
2. Add keywords and reference numbers
3. Verify they save correctly

### 4. Test Multi-Case Import Flow

1. Open a case for TT Solaria (has 2 active cases)
2. Go to Communications tab → Import
3. Enter a contact email address
4. Should see 5-step flow with classification step
5. Review AI classifications
6. Override some assignments
7. Complete import
8. Verify emails landed in correct cases

### 5. Test Single-Case Import Flow

1. Open a case for a client with only 1 case
2. Import should show 4-step flow (no classification step)
3. Verify existing behavior unchanged

---

## Known Issues / TODOs

1. **Case creation wizard** - Classification step not integrated into CreateCaseModal (requires refactor)
2. **OPS-031** - Review queue and reassignment not yet built
3. **Semantic analysis** - AI fallback not fully tested with real data
4. **Performance** - Large email volumes (1000+) may need pagination optimization

---

## Verification Checklist

- [ ] `pnpm preflight` passes
- [ ] `pnpm preview` (Docker) works
- [ ] Global Email Sources CRUD works
- [ ] Case classification metadata saves
- [ ] Multi-case import shows classification step
- [ ] Single-case import skips classification
- [ ] AI classifications have reasonable confidence
- [ ] Emails import to correct cases
- [ ] Attachments import to correct cases

---

## Next Steps

1. **Complete OPS-031** - Build review queue and reassignment
2. **Run verification** - Full E2E test with production data
3. **Deploy** - After verification passes
4. **Monitor** - Watch for classification accuracy in production
5. **Iterate** - Adjust confidence thresholds based on user corrections

---

## Commands

```bash
# Start dev servers
pnpm dev

# Run unit tests
pnpm test

# Run preflight checks
pnpm preflight

# Test in Docker
pnpm preview

# View at
# - http://localhost:3000 (web)
# - http://localhost:4000/graphql (gateway)
```
