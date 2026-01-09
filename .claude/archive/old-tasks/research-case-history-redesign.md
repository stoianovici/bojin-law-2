# Research: Case History Redesign

**Status**: Complete
**Date**: 2026-01-04
**Input**: `brainstorm-case-history-redesign.md`
**Next step**: `/plan research-case-history-redesign`

---

## Problem Statement

The Cases section currently mixes day-to-day operations with historical reference, making it hard for team members to quickly understand a case's history or retrieve old documents. We need to reposition Cases as an intuitive archival experience - a place for institutional memory where both veteran and new team members can browse case history, understand what happened, and retrieve documents for reuse.

## Decisions (from brainstorm)

> **DO NOT MODIFY** - Copy this section verbatim from brainstorm doc.
> These are the agreed requirements. Research informs HOW, not WHAT.

### Functional Decisions

| Decision                      | Details                                                                                                                                                    | Rationale                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Cases = archival reference    | Cases section is for historical browsing and retrieval, not daily operations                                                                               | Separates "understand the past" from "do today's work" (Emails/Docs handle daily ops)     |
| Chapters + Timeline structure | AI groups case history into chapters (phases), each containing a timeline of events                                                                        | Provides narrative structure for complex cases while maintaining chronological detail     |
| Accordion navigation          | Chapters displayed as accordion - click to expand and see timeline within                                                                                  | Compact view, easy scanning, familiar pattern                                             |
| AI-generated chapters         | Chapters created by AI based on detected case phases: Consultanță inițială, Negociere, Prima instanță, Apel, Executare, etc.                               | Start simple with AI-only; no manual chapter management needed                            |
| Weekly AI generation          | Timeline and chapters regenerated weekly                                                                                                                   | Balance between freshness and compute cost; can adjust frequency later                    |
| Timeline events include       | Court outcomes, contract outcomes, negotiation details, deadlines met/missed, key client decisions, document milestones, team changes, case status changes | Comprehensive history without financial clutter                                           |
| No financial events           | Financial milestones excluded from timeline                                                                                                                | Separate billing/financial section handles this; avoids role-based complexity in timeline |
| Inline document access        | Documents and emails shown inline within timeline events (e.g., "3 documente atașate" → expand to see)                                                     | Quick access without leaving context                                                      |
| "Folosește ca șablon" action  | Right-click/action menu on any document to use as template                                                                                                 | Primary retrieval use case for archival docs                                              |
| Template flow                 | 1) Select target case → 2) AI updates doc with new case/client info → 3) Opens in Word → 4) Appears in /docs as working document                           | Seamless transition from archive to active work                                           |
| Search across chapters        | Search bar at top of case view to find docs/events across all chapters                                                                                     | Essential for quick retrieval when you know what you're looking for                       |
| New cases: raw list           | Cases without AI summary yet show raw chronological list of docs/emails                                                                                    | Graceful degradation; new cases may take months to have meaningful chapters               |
| No manual event addition      | Timeline is pure AI-generated, users cannot add events manually                                                                                            | Keeps archive clean; users won't maintain it anyway                                       |

### Technical Decisions

| Decision                | Details                                                                                  | Rationale                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| AI processing frequency | Weekly batch job generates/updates chapter summaries and timeline events                 | Manageable compute cost, acceptable staleness for archival use |
| Chapter storage         | Store generated chapters and events in database (not regenerated on each view)           | Performance; timeline should load instantly                    |
| Event linking           | Each timeline event links to source documents/emails by ID                               | Enables inline preview and "use as template" actions           |
| Search implementation   | Full-text search across timeline event summaries + linked document content within a case | Users need to find both "what happened" and specific docs      |

### Access Control

| Role         | Access Level                    |
| ------------ | ------------------------------- |
| Partner      | All cases                       |
| Associate    | All cases                       |
| Jr Associate | Only cases they are assigned to |

### Out of Scope

- Manual chapter creation/editing (AI-only for v1)
- Real-time timeline updates (weekly batch is sufficient)
- Financial events in timeline (separate section)
- Cross-case search (this is single-case history view)
- Mobile-specific optimizations (desktop-first for archival browsing)
- Document version comparison within timeline
- Collaborative annotations on timeline events

---

## Research Findings

### Open Questions - Answered

| Question                                                                       | Answer                                                                                                                                                                                                                              | Evidence                                                                                                                       |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| What's the current case detail page structure?                                 | Tab-based workspace with 7 tabs: Overview, Documents, Mape, Tasks, Communications, Time Entries, Notes, Intelligence. Uses `WorkspaceTabs` for navigation.                                                                          | `apps/web/src/app/cases/[caseId]/page.tsx`, `apps/web/src/components/case/WorkspaceTabs.tsx`                                   |
| How is the AI service currently set up? Can it handle weekly batch processing? | Yes, excellent infrastructure. Uses node-cron + BullMQ for scheduling. `case-summary.worker.ts` provides exact pattern for weekly chapter generation. Claude API via `AnthropicEnhancedClient` with caching, retry, cost tracking.  | `services/gateway/src/workers/case-summary.worker.ts`, `services/ai-service/src/clients/AnthropicEnhancedClient.ts`            |
| What data is available for timeline event extraction?                          | Rich data: CaseAuditLog (field changes), CaseActivityEntry (task/doc/comm events), Email with ExtractedDeadline/Commitment/ActionItem, DocumentVersion, TaskHistory. Missing: explicit court outcomes, formal negotiation tracking. | `packages/database/prisma/schema.prisma`, `services/gateway/src/services/case-activity.service.ts`                             |
| How does the current document preview/action system work?                      | `useDocumentPreview` hook provides preview URLs + Word integration. 3-tier fallback: SharePoint → OneDrive → R2. Action menu on `DocumentCard` with preview/download/rename/delete.                                                 | `apps/web/src/hooks/useDocumentPreview.ts`, `apps/web/src/components/documents/DocumentCard.tsx`                               |
| What's the Word integration mechanism for "open in Word"?                      | `OPEN_IN_WORD` mutation returns `ms-word:` protocol URL. Document locking (Redis + PostgreSQL). SharePoint-first path for fast access.                                                                                              | `services/gateway/src/services/word-integration.service.ts`, `apps/web/src/graphql/mutations.ts`                               |
| How are case assignments tracked for jr associate access control?              | `CaseTeam` model with `caseId`, `userId`, `assignedAt`, `assignedBy`. Unique constraint on `[caseId, userId]`. `canAccessCase()` function checks assignment for non-partners.                                                       | `packages/database/prisma/schema.prisma` lines 618-636, `services/gateway/src/graphql/resolvers/case.resolvers.ts` lines 50-78 |
| What Romanian legal case phases exist beyond the common ones?                  | Additional phases found: Pregătire întâmpinare, Verificare acte, Redactare memoriu, Mediere comercială, Due diligence, Arbitraj comercial. Currently stored as free-form strings in case metadata.                                  | `packages/database/prisma/seed.ts`, seed-bulk.ts                                                                               |

### Existing Code Analysis

| Category        | Files                                                                                                                                                                                    | Notes                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Reuse as-is** | `SectionGroup` (accordion container), `DocumentCard`, `TaskCard`, `RiskAlertBanner`, `InlineEditField`, `DocumentPreviewModal`, action dialogs                                           | These components work for chapters/timeline without changes |
| **Modify**      | `CaseHeader` (extract metadata display), `WorkspaceTabs` (adapt for chapter navigation), `CaseDocumentsList` (add inline preview), `OverviewTab` sections (break into chapter structure) | Minor refactoring to support chapter context                |
| **Create new**  | `ChapterAccordion`, `ChapterHeader`, `TimelineView`, `TimelineEvent`, `DocumentQuickView`, `ChapterSummary`, `ArchivalExperienceContainer`                                               | Core new components for redesign                            |

### Patterns Discovered

**1. Worker Pattern for Weekly Processing** (`case-summary.worker.ts:1-180`)

```typescript
// Configuration
BATCH_SIZE = 5, INTERVAL_MS = 300000

// Lifecycle
startCaseSummaryWorker() → processBatch() → stopCaseSummaryWorker()

// Processing
- Hash-based change detection (skip if unchanged)
- Error continues to next item (no batch failure)
- 500ms delay between items (rate limiting)
- Metrics tracking (success/error counts, timing)
```

**2. AI Response Parsing Pattern** (`case-summary.service.ts`)

````typescript
// Extract JSON from markdown code blocks
const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
const jsonContent = jsonMatch ? jsonMatch[1] : content;
const parsed = JSON.parse(jsonContent);
````

**3. Context Gathering Pattern** (`case-summary.service.ts`)

```typescript
// Parallel data collection
await Promise.all([
  prisma.case.findUnique({...}),     // Case metadata
  prisma.email.findMany({take: 50}), // Recent emails
  prisma.caseDocument.findMany({take: 30}), // Linked docs
  prisma.communicationEntry.findMany({take: 20}), // Internal notes
  prisma.task.findMany({take: 20})   // Tasks
])
```

**4. Access Control Pattern** (`case.resolvers.ts:50-78`)

```typescript
async function canAccessCase(caseId, user) {
  // 1. Verify firm isolation
  if (caseData.firmId !== user.firmId) return false;
  // 2. Partners have full access
  if (user.role === 'Partner') return true;
  // 3. Others need team assignment
  return !!await prisma.caseTeam.findUnique({...});
}
```

**5. Document Preview Pattern** (`useDocumentPreview.ts`)

```typescript
// Preview methods by file type
const previewMethods = {
  pdf: 'pdf',
  docx: 'office',
  xlsx: 'office',
  pptx: 'office',
  png: 'image',
  jpg: 'image',
  txt: 'text',
};

// Word integration
const session = await openInWord(documentId);
window.location.href = session.wordUrl; // ms-word: protocol
```

**6. Activity Logging Pattern** (`case-activity.service.ts`)

```typescript
// Activity types enum
enum ActivityType {
  TaskCreated,
  TaskStatusChanged,
  TaskCompleted,
  TaskAssigned,
  DocumentUploaded,
  DocumentVersioned,
  CommunicationReceived,
  DeadlineApproaching,
  MilestoneReached,
}

// Record activity
await recordActivity({
  caseId,
  userId,
  activityType,
  entityType,
  entityId,
  title,
  summary,
  metadata,
});
```

### Constraints Found

1. **No dedicated court outcomes model** - Must use case metadata or create new model
2. **Phases stored as free-form strings** - Need to standardize to enum for AI chapter detection
3. **AssociateJr role exists but has same permissions as Associate** - May need differentiation
4. **Weekly batch requires cron setup** - Already in use for morning briefing, no new infrastructure needed
5. **Token budget for AI** - Case summary uses ~2000 tokens; chapters may need ~3000 tokens per case

---

## Implementation Recommendation

### Approach Overview

Transform the case detail page from a tab-based operations workspace to an accordion-based archival browser. The existing component library and AI infrastructure are well-suited for this with minimal new code.

### Architecture

```
Case Archival Experience
├── CaseHeader (reuse - metadata display)
├── SearchBar (new - search across chapters)
├── ChapterAccordion (new - main navigation)
│   ├── Chapter "Consultanță inițială"
│   │   ├── ChapterHeader (AI summary, date range, stats)
│   │   └── TimelineView
│   │       ├── TimelineEvent (document milestone)
│   │       ├── TimelineEvent (email thread summary)
│   │       ├── TimelineEvent (task completed)
│   │       └── DocumentQuickView (inline preview)
│   ├── Chapter "Negociere"
│   │   └── ...
│   └── Chapter "Prima instanță"
│       └── ...
└── RawActivityFallback (for new cases without chapters)
```

### Database Changes

**New Table: `CaseChapter`**

```prisma
model CaseChapter {
  id              String   @id @default(uuid())
  caseId          String   @map("case_id")
  phase           String   @db.VarChar(100) // AI-detected phase name
  title           String   @db.VarChar(200) // Romanian display title
  summary         String   @db.Text         // AI narrative
  startDate       DateTime?
  endDate         DateTime?
  generatedAt     DateTime @default(now())
  dataVersionHash String   @db.VarChar(32) // For change detection
  isStale         Boolean  @default(false)

  case            Case     @relation(fields: [caseId], references: [id], onDelete: Cascade)
  events          CaseChapterEvent[]

  @@index([caseId])
  @@map("case_chapters")
}

model CaseChapterEvent {
  id              String   @id @default(uuid())
  chapterId       String   @map("chapter_id")
  eventType       String   @db.VarChar(50) // DocumentMilestone, TaskCompleted, EmailSummary, etc.
  title           String   @db.VarChar(300)
  summary         String   @db.Text
  occurredAt      DateTime
  metadata        Json?    // Linked document IDs, task IDs, email IDs

  chapter         CaseChapter @relation(fields: [chapterId], references: [id], onDelete: Cascade)

  @@index([chapterId])
  @@index([occurredAt])
  @@map("case_chapter_events")
}
```

**New Enum: `CasePhase`** (for AI detection guidance)

```prisma
enum CasePhase {
  ConsultantaInitiala  // Consultanță inițială
  Negociere
  DueDiligence
  PrimaInstanta        // Prima instanță
  Apel
  Executare
  Mediere
  Arbitraj
  Inchis               // Închis (closed)
}
```

### Weekly Worker

Create `case-chapters.worker.ts` following `case-summary.worker.ts` pattern:

- Cron schedule: `'0 2 * * 1'` (Mondays 2 AM)
- Batch size: 10 cases per run
- Context gathering: emails, documents, tasks, notes, activity entries
- AI prompt: Detect phases, generate chapter titles/summaries, extract timeline events
- Hash-based change detection to skip unchanged cases

### Frontend Components

| Component             | Location                    | Purpose                                                    |
| --------------------- | --------------------------- | ---------------------------------------------------------- |
| `ChapterAccordion`    | `components/case/chapters/` | Radix Accordion wrapper with chapter list                  |
| `ChapterHeader`       | `components/case/chapters/` | Phase title, date range, event count, AI summary preview   |
| `TimelineView`        | `components/case/chapters/` | Chronological event list within chapter                    |
| `TimelineEvent`       | `components/case/chapters/` | Event card with type icon, title, summary, linked entities |
| `DocumentQuickView`   | `components/case/chapters/` | Inline document preview with action menu                   |
| `CaseSearchBar`       | `components/case/`          | Full-text search across chapters and documents             |
| `RawActivityFallback` | `components/case/chapters/` | Simple activity list for cases without chapters            |

### "Folosește ca șablon" Flow

1. User clicks "Folosește ca șablon" on document in timeline
2. Modal opens: Select target case (combobox)
3. Backend: Copy document to target case, mark as template-derived
4. AI: Update document content with new case/client placeholders (optional enhancement)
5. Frontend: Open in Word via `OPEN_IN_WORD` mutation
6. Document appears in target case's /docs as working document

---

## File Plan

| File                                                                | Action | Purpose (maps to Decision)                                         |
| ------------------------------------------------------------------- | ------ | ------------------------------------------------------------------ |
| `packages/database/prisma/schema.prisma`                            | Modify | Add CaseChapter, CaseChapterEvent models, CasePhase enum           |
| `packages/database/prisma/migrations/`                              | Create | Migration for new tables                                           |
| `services/gateway/src/workers/case-chapters.worker.ts`              | Create | Weekly AI generation (Decisions: Weekly AI, AI-generated chapters) |
| `services/gateway/src/services/case-chapters.service.ts`            | Create | Chapter generation logic, context gathering                        |
| `services/gateway/src/graphql/schema/case-chapters.graphql`         | Create | GraphQL types for chapters/events                                  |
| `services/gateway/src/graphql/resolvers/case-chapters.resolvers.ts` | Create | Queries for chapters, events, search                               |
| `apps/web/src/components/case/chapters/ChapterAccordion.tsx`        | Create | Accordion navigation (Decision: Accordion navigation)              |
| `apps/web/src/components/case/chapters/ChapterHeader.tsx`           | Create | Chapter title/summary display                                      |
| `apps/web/src/components/case/chapters/TimelineView.tsx`            | Create | Event list (Decision: Chapters + Timeline structure)               |
| `apps/web/src/components/case/chapters/TimelineEvent.tsx`           | Create | Event card with inline docs (Decision: Inline document access)     |
| `apps/web/src/components/case/chapters/DocumentQuickView.tsx`       | Create | Inline preview (Decision: Inline document access)                  |
| `apps/web/src/components/case/chapters/RawActivityFallback.tsx`     | Create | Fallback for new cases (Decision: New cases: raw list)             |
| `apps/web/src/components/case/CaseSearchBar.tsx`                    | Create | Cross-chapter search (Decision: Search across chapters)            |
| `apps/web/src/app/cases/[caseId]/page.tsx`                          | Modify | Replace tabs with chapter accordion                                |
| `apps/web/src/hooks/useCaseChapters.ts`                             | Create | Data fetching for chapters/events                                  |
| `apps/web/src/hooks/useTemplateFromDocument.ts`                     | Create | Template flow logic (Decision: Template flow)                      |
| `apps/web/src/components/documents/UseAsTemplateModal.tsx`          | Create | Target case selection (Decision: "Folosește ca șablon" action)     |

---

## Risks

| Risk                                              | Mitigation                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| AI chapter detection inaccurate for complex cases | Start with simple phase detection, add user feedback mechanism for v2             |
| Weekly generation too stale for active cases      | Add manual "refresh" button for power users; consider daily for very active cases |
| Performance with large case history               | Paginate timeline events within chapters; lazy load expanded chapters             |
| Token costs exceed budget                         | Monitor via existing token tracker; adjust batch size if needed                   |
| Template flow breaks with locked documents        | Check lock status before copy; show clear error message                           |
| Jr Associate filtering inconsistent               | Review all case queries; add integration tests for role-based access              |

---

## Next Step

Start a new session and run:

```
/plan research-case-history-redesign
```
