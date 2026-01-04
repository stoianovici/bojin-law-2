# Plan: Case History Redesign

**Status**: Approved
**Date**: 2026-01-04
**Input**: `research-case-history-redesign.md`
**Next step**: `/implement plan-case-history-redesign`

---

## Problem Statement

The Cases section currently mixes day-to-day operations with historical reference, making it hard for team members to quickly understand a case's history or retrieve old documents. We need to reposition Cases as an intuitive archival experience - a place for institutional memory where both veteran and new team members can browse case history, understand what happened, and retrieve documents for reuse.

## Decisions (from brainstorm)

> **DO NOT MODIFY** - Copy this section verbatim from research doc.
> Every task below must implement these decisions.

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

## Implementation Approach

Transform the case detail page from a tab-based operations workspace to an accordion-based archival browser. The existing component library and AI infrastructure (worker pattern, Claude API client, document preview hooks) are well-suited for this redesign. We'll add new database models for chapters and events, create a weekly AI worker to generate content, build new frontend components for the accordion/timeline UI, and integrate with the existing "use as template" and Word integration flows.

---

## Tasks

### Parallel Group 1: Database Foundation

> These tasks run simultaneously via sub-agents

#### Task 1.1: Add CaseChapter and CaseChapterEvent models

- **Implements**: Chapter storage, Event linking, AI-generated chapters
- **File**: `packages/database/prisma/schema.prisma` (MODIFY)
- **Do**: Add CaseChapter model (id, caseId, phase, title, summary, startDate, endDate, generatedAt, dataVersionHash, isStale), CaseChapterEvent model (id, chapterId, eventType, title, summary, occurredAt, metadata), CasePhase enum (ConsultantaInitiala, Negociere, DueDiligence, PrimaInstanta, Apel, Executare, Mediere, Arbitraj, Inchis), and relations to Case model
- **Done when**: Schema compiles with `pnpm prisma format`

---

### Sequential: After Group 1

#### Task 2: Generate and run database migration

- **Implements**: Chapter storage
- **Depends on**: Task 1.1
- **File**: `packages/database/prisma/migrations/` (CREATE)
- **Do**: Run `pnpm prisma migrate dev --name add_case_chapters` to create migration
- **Done when**: Migration runs successfully, tables exist in DB

---

### Parallel Group 2: Backend Services

> These tasks run simultaneously via sub-agents

#### Task 3.1: Create case chapters service

- **Implements**: AI-generated chapters, Timeline events include, No financial events, Weekly AI generation
- **File**: `services/gateway/src/services/case-chapters.service.ts` (CREATE)
- **Do**: Create service with methods: `generateChaptersForCase(caseId)`, `gatherCaseContext(caseId)`, `detectPhases(context)`, `extractTimelineEvents(context, phase)`. Follow patterns from `case-summary.service.ts`. Use Claude API to detect phases and generate summaries. Exclude financial events. Include hash-based change detection.
- **Done when**: Service can generate chapters for a test case via unit test

#### Task 3.2: Create case chapters worker

- **Implements**: Weekly AI generation, AI processing frequency
- **File**: `services/gateway/src/workers/case-chapters.worker.ts` (CREATE)
- **Do**: Create weekly worker following `case-summary.worker.ts` pattern. Cron schedule `'0 2 * * 1'` (Mondays 2 AM). Batch size 10. Call `CaseChaptersService.generateChaptersForCase()`. Include metrics tracking.
- **Done when**: Worker starts and logs scheduled job

#### Task 3.3: Create GraphQL schema for chapters

- **Implements**: Chapter storage, Event linking, Access Control
- **File**: `services/gateway/src/graphql/schema/case-chapters.graphql` (CREATE)
- **Do**: Define types: CaseChapter, CaseChapterEvent, CasePhase enum. Define queries: `caseChapters(caseId: ID!)`, `caseChapterEvents(chapterId: ID!)`, `searchCaseHistory(caseId: ID!, query: String!)`. Define mutation: `copyDocumentAsTemplate(documentId: ID!, targetCaseId: ID!)`. Follow existing schema patterns.
- **Done when**: Schema validates with GraphQL tools

#### Task 3.4: Create GraphQL resolvers for chapters

- **Implements**: Chapter storage, Search implementation, Access Control
- **File**: `services/gateway/src/graphql/resolvers/case-chapters.resolvers.ts` (CREATE)
- **Do**: Implement resolvers for all queries and mutations. Include `canAccessCase()` check for both source and target cases. Implement full-text search across event summaries. Follow `case.resolvers.ts` patterns.
- **Done when**: Queries return data via GraphQL playground

---

### Parallel Group 3: Frontend Components (Core)

> These tasks run simultaneously via sub-agents

#### Task 4.1: Create ChapterAccordion component

- **Implements**: Accordion navigation, Chapters + Timeline structure
- **File**: `apps/web/src/components/case/chapters/ChapterAccordion.tsx` (CREATE)
- **Do**: Create Radix Accordion wrapper that renders list of chapters. Accept `chapters` array prop. Render `ChapterHeader` for each item trigger and `TimelineView` for each item content. Handle expand/collapse state. Style with existing design system.
- **Done when**: Component renders with mock chapter data

#### Task 4.2: Create ChapterHeader component

- **Implements**: Accordion navigation, AI-generated chapters
- **File**: `apps/web/src/components/case/chapters/ChapterHeader.tsx` (CREATE)
- **Do**: Display phase title (Romanian), date range (e.g., "Ian 2024 - Mar 2024"), event count badge, AI summary preview (truncated to 2 lines). Use existing typography and badge components. Include chevron icon for expand state.
- **Done when**: Component renders with mock chapter data

#### Task 4.3: Create TimelineView component

- **Implements**: Chapters + Timeline structure, Timeline events include
- **File**: `apps/web/src/components/case/chapters/TimelineView.tsx` (CREATE)
- **Do**: Render chronological list of `TimelineEvent` components. Add date separators between events on different days. Support lazy loading for chapters with >20 events. Add vertical timeline line decoration.
- **Done when**: Component renders with mock event data

#### Task 4.4: Create TimelineEvent component

- **Implements**: Timeline events include, Inline document access
- **File**: `apps/web/src/components/case/chapters/TimelineEvent.tsx` (CREATE)
- **Do**: Event card with type icon (FileText for doc, Mail for email, CheckSquare for task, Flag for milestone), title, summary, timestamp. Show "X documente atașate" expandable section when documents linked. Render inline `DocumentQuickView` list when expanded.
- **Done when**: Component renders with expand/collapse for attached docs

#### Task 4.5: Create RawActivityFallback component

- **Implements**: New cases: raw list
- **File**: `apps/web/src/components/case/chapters/RawActivityFallback.tsx` (CREATE)
- **Do**: Simple chronological list of case activity for cases without AI chapters. Show info message "Acest dosar nu are încă un istoric structurat. Activitățile sunt afișate cronologic." with activity list below using simplified event cards.
- **Done when**: Component renders with mock activity data

---

### Parallel Group 4: Frontend Components (Support)

> These tasks run simultaneously via sub-agents

#### Task 5.1: Create DocumentQuickView component

- **Implements**: Inline document access
- **File**: `apps/web/src/components/case/chapters/DocumentQuickView.tsx` (CREATE)
- **Do**: Inline document card with file type icon, filename, file size, upload date. Action menu (DropdownMenu) with "Previzualizează", "Deschide în Word", "Folosește ca șablon". Use existing `useDocumentPreview` hook for preview/Word actions.
- **Done when**: Component renders with action menu functional

#### Task 5.2: Create CaseHistorySearchBar component

- **Implements**: Search across chapters
- **File**: `apps/web/src/components/case/chapters/CaseHistorySearchBar.tsx` (CREATE)
- **Do**: Search input with debounced query (300ms). Call `searchCaseHistory` query. Display results in dropdown grouped by chapter name. Show event title and summary snippet with highlighted search terms. Click result scrolls to and expands that chapter.
- **Done when**: Component searches and displays results

#### Task 5.3: Create UseAsTemplateModal component

- **Implements**: "Folosește ca șablon" action, Template flow
- **File**: `apps/web/src/components/documents/UseAsTemplateModal.tsx` (CREATE)
- **Do**: Modal with title "Folosește ca șablon". Case selector combobox (searchable, shows case number and title). Confirm button "Copiază și deschide". On confirm: call `copyDocumentAsTemplate` mutation, then open returned Word URL. Show loading state during copy. Handle errors with toast.
- **Done when**: Modal opens, selects case, triggers copy flow

#### Task 5.4: Create useCaseChapters hook

- **Implements**: Chapter storage (frontend data fetching)
- **File**: `apps/web/src/hooks/useCaseChapters.ts` (CREATE)
- **Do**: Apollo `useQuery` hook for `caseChapters(caseId)` query. Return `{ chapters, loading, error, refetch }`. Include `useLazyQuery` for `searchCaseHistory`. Export both hooks.
- **Done when**: Hook fetches data from GraphQL endpoint

#### Task 5.5: Create useTemplateFromDocument hook

- **Implements**: Template flow
- **File**: `apps/web/src/hooks/useTemplateFromDocument.ts` (CREATE)
- **Do**: Hook with `copyAsTemplate(documentId, targetCaseId)` async function. Call `copyDocumentAsTemplate` mutation. Return `{ copyAsTemplate, loading, error }`. On success, return Word URL for caller to navigate.
- **Done when**: Hook copies document and returns Word URL

---

### Sequential: Integration

#### Task 6: Create chapters index and exports

- **Implements**: All frontend components organization
- **Depends on**: Tasks 4.1-4.5, 5.1-5.2
- **File**: `apps/web/src/components/case/chapters/index.ts` (CREATE)
- **Do**: Export all chapter components: ChapterAccordion, ChapterHeader, TimelineView, TimelineEvent, DocumentQuickView, RawActivityFallback, CaseHistorySearchBar
- **Done when**: All components importable from `@/components/case/chapters`

---

#### Task 7: Update case detail page

- **Implements**: Cases = archival reference, Accordion navigation
- **Depends on**: Task 6, Task 5.4
- **File**: `apps/web/src/app/cases/[caseId]/page.tsx` (MODIFY)
- **Do**: Replace tab-based `WorkspaceTabs` with new archival layout. Keep `CaseHeader` at top. Add `CaseHistorySearchBar` below header. Render `ChapterAccordion` when chapters exist, `RawActivityFallback` when no chapters. Use `useCaseChapters` hook for data. Maintain existing access control check.
- **Done when**: Case detail page shows chapter accordion or fallback based on data

---

#### Task 8: Wire backend and verify end-to-end

- **Implements**: All Decisions verification
- **Depends on**: Task 7
- **Files**: Multiple (verification and registration)
- **Do**:
  1. Register `case-chapters.worker.ts` in gateway startup (`src/index.ts`)
  2. Add chapters resolvers to resolver map (`src/graphql/resolvers/index.ts`)
  3. Add chapters schema to type definitions
  4. Test full flow: view case → see chapters → expand → see timeline → click document → use as template → verify doc appears in target case
  5. Verify Jr Associate can only see assigned cases
  6. Verify Partners/Associates see all cases
- **Done when**: Feature works end-to-end per all Decisions

---

## Decision Coverage Check

| Decision                      | Implemented by Task(s)        |
| ----------------------------- | ----------------------------- |
| Cases = archival reference    | Task 7                        |
| Chapters + Timeline structure | Task 4.1, 4.3                 |
| Accordion navigation          | Task 4.1, 4.2, 7              |
| AI-generated chapters         | Task 3.1, 4.2                 |
| Weekly AI generation          | Task 3.2                      |
| Timeline events include       | Task 3.1, 4.3, 4.4            |
| No financial events           | Task 3.1                      |
| Inline document access        | Task 4.4, 5.1                 |
| "Folosește ca șablon" action  | Task 5.1, 5.3                 |
| Template flow                 | Task 5.3, 5.5                 |
| Search across chapters        | Task 5.2, 3.4                 |
| New cases: raw list           | Task 4.5, 7                   |
| No manual event addition      | Task 3.1 (AI-only generation) |
| AI processing frequency       | Task 3.2                      |
| Chapter storage               | Task 1.1, 2                   |
| Event linking                 | Task 1.1, 3.4                 |
| Search implementation         | Task 3.4, 5.2                 |
| Access Control (Partner)      | Task 3.4, 7                   |
| Access Control (Associate)    | Task 3.4, 7                   |
| Access Control (Jr Associate) | Task 3.4, 7, 8                |

## Session Scope

- **Total tasks**: 15
- **Parallel groups**: 4
- **Complexity**: Complex (new DB models, AI worker, 7 new UI components)

---

## Next Step

After approval, start a new session and run:

```
/implement plan-case-history-redesign
```
