# Handoff: Multi-Case Email Support (OPS-058 → OPS-062)

**Session**: 4
**Date**: 2025-12-20
**Status**: OPS-058, OPS-059, OPS-060, OPS-061 Implemented, Ready for Phase 3
**Created via**: /ops-investigate

## Investigation Summary

**Symptom**: Emails and documents not being sorted for a new case when the client and main contacts are the same as an existing case.

**Category**: A - "X Not Appearing"

**Root Cause**: Thread continuity locks emails to first case + single caseId constraint

## Hypotheses Tested

| Hypothesis                     | Verdict | Key Finding                                                                       |
| ------------------------------ | ------- | --------------------------------------------------------------------------------- |
| Thread Continuity Override     | ❌      | `classification-scoring.ts:191-204` - Thread continuity bypasses multi-case logic |
| Single caseId Constraint       | ❌      | `schema.prisma:2543` - Email can only belong to ONE case                          |
| Contact Scoring Too Low        | ⚠️      | Contact match = 10 pts, threshold = 70                                            |
| No Re-classification on Create | ⚠️      | Case creation doesn't trigger re-evaluation                                       |

## Root Cause Details

The email classification algorithm has a critical flaw in thread continuity handling:

1. **Thread Continuity Check** (`classification-scoring.ts:191-204, 405-421`):
   - Checks if any email in the conversation thread is already classified
   - Returns immediately with 100% confidence for that case
   - **Bypasses all multi-case scoring logic**

2. **Single caseId Field** (`schema.prisma:2543`):
   - Email model has a single `caseId` foreign key
   - An email can only belong to ONE case by database design
   - No way to represent multi-case ownership

3. **The Failing Flow**:
   ```
   1. Case A created (contact: john@example.com)
   2. Email arrives → classified to Case A
   3. Case B created (same contact)
   4. New email arrives on SAME thread
      → Thread continuity finds Case A
      → Returns Case A immediately
      → Multi-case scoring NEVER runs
      → Email goes to Case A, Case B gets nothing
   ```

## Solution: Multi-Case Email Model

Replace single `caseId` with `EmailCaseLink` junction table enabling many-to-many.

## Issues Status

| Issue   | Title                       | Phase | Status      |
| ------- | --------------------------- | ----- | ----------- |
| OPS-058 | Multi-Case Email Data Model | 1     | Implemented |
| OPS-059 | Classification Algorithm    | 2     | Implemented |
| OPS-060 | GraphQL Multi-Case Support  | 2     | Implemented |
| OPS-061 | Data Migration              | 2     | Implemented |
| OPS-062 | UI Multi-Case Display       | 3     | Open        |

## Dependency Graph

```
PHASE 1 (Start Immediately):
└── OPS-058: Data Model ← BLOCKS ALL

PHASE 2 (After OPS-058, parallel):
├── OPS-059: Classification Algorithm
├── OPS-060: GraphQL Schema
└── OPS-061: Data Migration

PHASE 3 (After Phase 2):
└── OPS-062: UI Updates
```

## Environment Strategy

- For development: `pnpm dev`
- For testing with prod data: `source .env.prod && pnpm dev`
- For pre-deploy: `pnpm preflight:full`
- For production-like: `pnpm preview`

## Session 2 Work Completed

1. **OPS-058 Implemented**:
   - Added `ThreadContinuity` to `ClassificationMatchType` enum
   - Created `EmailCaseLink` junction table with:
     - `confidence` (Float, default 1.0)
     - `matchType` (ClassificationMatchType)
     - `linkedAt` (DateTime)
     - `linkedBy` (String)
     - `isPrimary` (Boolean)
   - Added `Email.caseLinks` relation (kept `Email.caseId` for backward compatibility)
   - Added `Case.emailLinks` relation
   - Created migration `20251220130000_add_email_case_links`
   - Prisma client generated successfully
   - Gateway and web packages compile without errors

## Session 3 Work Completed (OPS-060)

1. **OPS-060 Implemented - GraphQL Multi-Case Email Support**:
   - Added `ClassificationMatchType` enum to GraphQL schema
   - Added `EmailCaseLink` type with metadata (confidence, matchType, linkedAt, linkedBy, isPrimary)
   - Updated `Email` type with:
     - `caseLinks: [EmailCaseLink!]!` - all case links with metadata
     - `cases: [Case!]!` - convenience field for all linked cases
     - `primaryCase: Case` - the primary case assignment
     - `case: Case` - deprecated for backwards compatibility
   - Added mutations:
     - `linkEmailToCase(emailId, caseId, isPrimary): EmailCaseLink!`
     - `unlinkEmailFromCase(emailId, caseId): Boolean!`
   - Updated `Case` type with:
     - `emailLinks: [EmailCaseLink!]!` - all email links with metadata
     - `communications: [Email!]!` - now fetches via EmailCaseLink
   - Implemented all Email resolvers:
     - `Email.caseLinks`, `Email.cases`, `Email.primaryCase`, `Email.case`
     - `EmailCaseLink` type resolvers
     - `linkEmailToCase` mutation with auth, duplicate prevention, classification updates, timeline sync
     - `unlinkEmailFromCase` mutation with primary promotion, state cleanup
   - Implemented Case resolvers:
     - `Case.emailLinks`, `Case.communications` (with legacy fallback)
   - TypeScript compilation verified

2. **OPS-061 Previously Implemented**:
   - Updated migration `20251220130000_add_email_case_links` with data migration SQL
   - Fixed: Created `ClassificationMatchType` enum (was missing - only ALTER TYPE existed)
   - Added INSERT statement to migrate existing `Email.caseId` to `EmailCaseLink`
   - Mapping logic:
     - `classified_by ILIKE '%thread%'` → ThreadContinuity
     - `classified_by IN ('auto', 'contact_match', 'migration')` → Actor
     - `classified_by ILIKE '%manual%'` → Manual
     - Default → Actor
   - Verified locally: 82 emails with case_id = 82 email_case_links, 0 orphans
   - All records have `is_primary = true` (original assignment)

## Local Verification Status

| Step           | Status     | Notes                            |
| -------------- | ---------- | -------------------------------- |
| Prod data test | ✅ Passed  | 82/82 emails migrated, 0 orphans |
| Preflight      | ⬜ Pending | Need to run full preflight       |
| Docker test    | ⬜ Pending |                                  |

**Verified**: Partial (migration logic verified, awaiting preflight + Docker)

## Session 4 Work Completed (OPS-059)

1. **OPS-059 Implemented - Multi-Case Classification Algorithm**:
   - Updated `ClassificationResult` interface with `caseAssignments: CaseAssignment[]` array
   - Added `CaseAssignment` interface with confidence, matchType, isPrimary, signals
   - Modified `classifyEmail()` to collect ALL matching cases instead of returning on first match
   - Thread continuity now ADDS to assignments instead of early return
   - Court emails now also support multi-case assignment
   - Updated email categorization worker to create EmailCaseLink records for all assignments
   - Updated email-to-case service to create EmailCaseLink for manual imports
   - All preflight checks passed

## Next Steps

1. ~~**OPS-058**: Create EmailCaseLink junction table~~ ✅ DONE
2. ~~**Phase 2 (parallel work)**~~:
   - ~~OPS-059: Update classification to return multiple assignments~~ ✅ DONE
   - ~~OPS-060: Update GraphQL for caseLinks field~~ ✅ DONE
   - ~~OPS-061: Migrate existing Email.caseId data to EmailCaseLink~~ ✅ DONE
3. **Phase 3**:
   - OPS-062: Update UI to show multi-case badges

### Immediate Next Actions

1. Run `pnpm preview` to verify Docker build works
2. Test with production data to verify multi-case email assignment works
3. Continue to OPS-062 to update UI for multi-case display

## Key Files

### Core Algorithm

- `services/gateway/src/services/classification-scoring.ts` - Main classification logic
- `services/gateway/src/workers/email-categorization.worker.ts` - Background worker

### Database

- `packages/database/prisma/schema.prisma` - Email model, new EmailCaseLink

### GraphQL

- `services/gateway/src/graphql/resolvers/email.resolvers.ts`
- `services/gateway/src/graphql/resolvers/case.resolvers.ts`
- `services/gateway/src/graphql/schema/email.graphql`

### Services

- `services/gateway/src/services/email-to-case.service.ts`
- `services/gateway/src/services/email-sync.service.ts`

### Frontend

- `apps/web/src/components/email/` - Email components for multi-case display

## Code References from Investigation

**Thread Continuity Override (The Problem)**:

```typescript
// classification-scoring.ts:191-204
if (threadCase) {
  return {
    state: EmailClassificationState.Classified,
    caseId: threadCase.caseId,
    confidence: 1.0,
    matchType: ClassificationMatchType.THREAD_CONTINUITY,
  };
}
// ↑ Returns immediately, never reaches multi-case scoring
```

**Single caseId Constraint**:

```prisma
// schema.prisma:2543
model Email {
  caseId    String?  @map("case_id") // Only ONE case!
  // ...
}
```

**Scoring Weights**:

```typescript
// classification-scoring.ts:117-124
export const WEIGHTS = {
  THREAD_CONTINUITY: 100, // Deterministic
  REFERENCE_NUMBER: 50,
  KEYWORD_SUBJECT: 30,
  KEYWORD_BODY: 20,
  RECENT_ACTIVITY: 20,
  CONTACT_MATCH: 10, // Too low to distinguish cases alone
};

export const THRESHOLDS = {
  MIN_SCORE: 70, // Contact alone (10) never reaches this
  MIN_GAP: 20,
};
```
