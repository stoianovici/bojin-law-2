# Plan: Mape Feature + ONRC Integration

**Status**: Approved
**Date**: 2024-12-29
**Input**: `research-mape-onrc.md`
**Next step**: `/implement plan-mape-onrc`

---

## Context Summary

**Project**: bojin-law-ui (Next.js 16, TypeScript, Apollo Client, Tailwind, Radix UI)
**Backend**: bojin-law-2 (GraphQL gateway)
**Tech Stack**: React 19, Zustand, Radix UI, react-pdf
**Current State**: 80% mapa UI complete (mock data), 0% backend integration

**Goal**: Build complete "mape" (binder) feature with:

- ONRC template sync for SRL procedures
- Document request workflow with email reminders
- Smart document matching and form generation

---

## Approach Summary

Build the mape feature in 5 phases: (1) Core GraphQL infrastructure for both frontend and backend, (2) Template system with ONRC scraper and seed data, (3) Complete mapa UI with modals and document assignment, (4) Document request workflow with email job queue, (5) Smart features including document matching, print/PDF generation, and client schema extension for company data.

---

## PHASE 1: Core Infrastructure

### Parallel Group 1.1: Types & GraphQL Schema (Backend)

> These tasks run simultaneously via sub-agents

#### Task 1.1.1: Shared Mapa Types

- **Repo**: bojin-law-2
- **File**: `packages/shared/types/src/mapa.ts` (CREATE)
- **Do**: Create shared TypeScript types for Mapa, MapaSlot, MapaTemplate, SlotDefinition with all fields from research (including sync fields: sourceUrl, lastSynced, contentHash, isLocked)
- **Done when**: Types compile, exported from package

#### Task 1.1.2: Mapa GraphQL Schema

- **Repo**: bojin-law-2
- **File**: `services/gateway/schema/mapa.graphql` (CREATE)
- **Do**: Define GraphQL types and operations:
  - Types: Mapa, MapaSlot, MapaTemplate, MapaCompletionStatus, SlotStatus (pending/requested/received/final)
  - Queries: mapa(id), mapas(caseId), templates(firmId), template(id)
  - Mutations: createMapa, updateMapa, deleteMapa, createMapaFromTemplate, assignDocumentToSlot, removeDocumentFromSlot, updateSlotStatus
- **Done when**: Schema validates, no syntax errors

#### Task 1.1.3: Client Schema Extension

- **Repo**: bojin-law-2
- **File**: `services/gateway/schema/client.graphql` (MODIFY)
- **Do**: Add company-specific fields to Client type:
  - clientType: enum (individual, company)
  - cui: String (Romanian tax ID)
  - registrationNumber: String
  - companyType: enum (SRL, SA, PFA, Other)
  - incorporationDate: DateTime
  - administrators: [Administrator]
  - shareholders: [Shareholder]
- **Done when**: Schema validates, backwards compatible

---

### Parallel Group 1.2: Backend Resolvers

> Depends on: Group 1.1 complete

#### Task 1.2.1: Mapa Resolvers

- **Repo**: bojin-law-2
- **File**: `services/gateway/resolvers/mapa.ts` (CREATE)
- **Do**: Implement resolvers for mapa CRUD:
  - Query.mapa: Fetch single mapa with slots populated
  - Query.mapas: Fetch all mapas for a case
  - Mutation.createMapa: Create empty mapa with name/description
  - Mutation.updateMapa: Update mapa details
  - Mutation.deleteMapa: Soft delete mapa
  - Mapa.completionStatus: Calculate from slot status
- **Done when**: All resolvers return expected data, tested with playground

#### Task 1.2.2: Template Resolvers

- **Repo**: bojin-law-2
- **File**: `services/gateway/resolvers/template.ts` (CREATE)
- **Do**: Implement template resolvers:
  - Query.templates: List templates (filter by isONRC, isActive)
  - Query.template: Get single template with slot definitions
  - Mutation.createMapaFromTemplate: Create mapa pre-populated with template slots
  - Note: ONRC templates are read-only (no update/delete mutations)
- **Done when**: Templates queryable, mapa creation from template works

#### Task 1.2.3: Slot Resolvers

- **Repo**: bojin-law-2
- **File**: `services/gateway/resolvers/mapaSlot.ts` (CREATE)
- **Do**: Implement slot operations:
  - Mutation.assignDocumentToSlot: Link document to slot, set assignedAt/assignedBy
  - Mutation.removeDocumentFromSlot: Unlink document, clear assignment
  - Mutation.updateSlotStatus: Transition slot status with validation
- **Done when**: Document assignment works, status transitions validated

---

### Parallel Group 1.3: Frontend GraphQL + Hooks

> Can run in parallel with Group 1.2

#### Task 1.3.1: Mapa GraphQL Operations

- **Repo**: bojin-law-ui
- **File**: `src/graphql/mapa.ts` (CREATE)
- **Do**: Define Apollo Client operations:
  - GET_MAPA query
  - GET_MAPAS query (by caseId)
  - CREATE_MAPA mutation
  - UPDATE_MAPA mutation
  - DELETE_MAPA mutation
  - ASSIGN_DOCUMENT_TO_SLOT mutation
  - REMOVE_DOCUMENT_FROM_SLOT mutation
  - UPDATE_SLOT_STATUS mutation
- **Done when**: All operations typed, no TypeScript errors

#### Task 1.3.2: Template GraphQL Operations

- **Repo**: bojin-law-ui
- **File**: `src/graphql/template.ts` (CREATE)
- **Do**: Define Apollo Client operations:
  - GET_TEMPLATES query
  - GET_TEMPLATE query
  - CREATE_MAPA_FROM_TEMPLATE mutation
- **Done when**: All operations typed, no TypeScript errors

#### Task 1.3.3: Mapa Hook

- **Repo**: bojin-law-ui
- **File**: `src/hooks/useMapa.ts` (CREATE)
- **Do**: Create React hook:
  - useMapa(id): Returns mapa with loading/error state
  - useMapas(caseId): Returns mapa list
  - useCreateMapa(): Returns mutation function with optimistic update
  - useUpdateMapa(): Returns mutation function
  - useDeleteMapa(): Returns mutation function
  - useAssignDocument(): Returns slot assignment mutation
- **Done when**: Hook works with mock data, ready for real API

#### Task 1.3.4: Templates Hook

- **Repo**: bojin-law-ui
- **File**: `src/hooks/useTemplates.ts` (CREATE)
- **Do**: Create React hook:
  - useTemplates(firmId): Returns template list
  - useTemplate(id): Returns single template with slots
  - useCreateMapaFromTemplate(): Returns mutation function
- **Done when**: Hook works with mock data

#### Task 1.3.5: Update Mapa Types

- **Repo**: bojin-law-ui
- **File**: `src/types/mapa.ts` (MODIFY)
- **Do**: Add missing fields:
  - MapaTemplate: sourceUrl, lastSynced, contentHash, isLocked, isONRC
  - MapaSlot: status enum (pending | requested | received | final)
  - SlotStatusHistory type for audit trail
- **Done when**: Types match backend schema

---

## PHASE 2: Template System

### Parallel Group 2.1: ONRC Seed Data + Scraper

> Can start after Phase 1 schema is defined

#### Task 2.1.1: ONRC Template Seed Data

- **Repo**: bojin-law-2
- **File**: `services/mapa-sync/data/onrc-templates.json` (CREATE)
- **Do**: Create seed data for 10 common SRL procedures:
  1. Înființare SRL (SRL Establishment)
  2. Înființare SRL-D (Debutant SRL)
  3. Cesiune părți sociale (Share Transfer)
  4. Schimbare administrator (Management Change)
  5. Majorare capital social (Capital Increase)
  6. Reducere capital social (Capital Reduction)
  7. Schimbare sediu social (Office Change)
  8. Modificare obiect activitate (Activity Change)
  9. Modificare denumire (Name Change)
  10. Dizolvare și lichidare simultană (Simultaneous Dissolution)

  Each template includes:
  - id, name, description (Romanian)
  - sourceUrl (ONRC page URL from research)
  - slotDefinitions with category, name, required flag, order

- **Done when**: JSON valid, covers main SRL procedures

#### Task 2.1.2: ONRC Web Scraper

- **Repo**: bojin-law-2
- **File**: `services/mapa-sync/scraper.ts` (CREATE)
- **Do**: Create scraper using cheerio:
  - scrapeProcedure(url): Fetch ONRC page, extract document list
  - parseDocumentList(html): Extract document names from HTML structure
  - Handle Romanian text encoding (UTF-8)
  - Respectful scraping: 2s delay between requests, proper User-Agent
- **Done when**: Scraper extracts document list from sample ONRC URL

#### Task 2.1.3: Sync Cron Job

- **Repo**: bojin-law-2
- **File**: `services/mapa-sync/sync-job.ts` (CREATE)
- **Do**: Create monthly sync job using node-cron:
  - Schedule: First day of month at 3 AM
  - For each ONRC template: scrape URL, compare content
  - On change: update template slots, log changelog
  - On error: alert admin, keep existing template
- **Done when**: Cron job runs, logs sync results

#### Task 2.1.4: Change Detector

- **Repo**: bojin-law-2
- **File**: `services/mapa-sync/change-detector.ts` (CREATE)
- **Do**: Create change detection utility:
  - hashContent(html): Generate content hash (SHA-256)
  - detectChanges(oldHash, newHash, oldSlots, newSlots): Return diff
  - generateChangelog(diff): Human-readable change description
- **Done when**: Detects added/removed documents accurately

---

### Parallel Group 2.2: Frontend Template UI

> Can run in parallel with Group 2.1

#### Task 2.2.1: Template Picker Component

- **Repo**: bojin-law-ui
- **File**: `src/components/documents/TemplatePicker.tsx` (CREATE)
- **Do**: Create template selection UI:
  - List templates with name, description, document count
  - Filter by: ONRC vs firm templates, search by name
  - Preview: Show slot definitions before selection
  - Selection callback for parent component
  - Use Radix UI Dialog for preview modal
- **Done when**: User can browse and select templates

#### Task 2.2.2: Admin Templates Page

- **Repo**: bojin-law-ui
- **File**: `src/app/(dashboard)/admin/templates/page.tsx` (CREATE)
- **Do**: Create admin page for template management:
  - List all templates (ONRC and firm)
  - Show last synced date for ONRC templates
  - Manual sync button (triggers backend sync)
  - Badge for "needs review" when changes detected
  - Link to template detail view
- **Done when**: Admin can view all templates, trigger sync

#### Task 2.2.3: Template Card Component

- **Repo**: bojin-law-ui
- **File**: `src/components/admin/TemplateCard.tsx` (CREATE)
- **Do**: Create template card:
  - Display: name, description, slot count, usage count
  - ONRC badge for official templates
  - Lock icon for read-only templates
  - Last synced timestamp
  - Actions: View, Duplicate (for firm templates)
- **Done when**: Card displays all template info

#### Task 2.2.4: Sync Status Indicator

- **Repo**: bojin-law-ui
- **File**: `src/components/admin/TemplateSyncStatus.tsx` (CREATE)
- **Do**: Create sync status component:
  - States: synced (green), syncing (spinner), error (red), needs-review (orange)
  - Show last sync time
  - Error message display
- **Done when**: All states render correctly

---

## PHASE 3: Core Mapa UI

### Parallel Group 3.1: Mapa Modals

> Depends on: Hooks from Phase 1

#### Task 3.1.1: Create Mapa Modal

- **Repo**: bojin-law-ui
- **File**: `src/components/documents/CreateMapaModal.tsx` (CREATE)
- **Do**: Create modal for new mapa:
  - Form fields: name (required), description (optional)
  - "Start from template" toggle with TemplatePicker
  - caseId from context
  - Validation: name required, min 3 chars
  - Use useCreateMapa or useCreateMapaFromTemplate hook
  - Success: close modal, navigate to new mapa
- **Done when**: Creates mapa with and without template

#### Task 3.1.2: Edit Mapa Modal

- **Repo**: bojin-law-ui
- **File**: `src/components/documents/EditMapaModal.tsx` (CREATE)
- **Do**: Create modal for editing mapa:
  - Pre-populate form with existing values
  - Only edit name and description (slots edited separately)
  - Use useUpdateMapa hook
  - Optimistic update for better UX
- **Done when**: Edits persist, modal closes on success

#### Task 3.1.3: Slot Assignment Modal

- **Repo**: bojin-law-ui
- **File**: `src/components/documents/SlotAssignModal.tsx` (CREATE)
- **Do**: Create document picker modal:
  - Show case documents that match slot category
  - Search/filter documents
  - Preview document before selection
  - Confirm assignment with useAssignDocument hook
  - Handle already-assigned documents (warn/replace)
- **Done when**: Documents can be assigned to slots

#### Task 3.1.4: Delete Mapa Dialog

- **Repo**: bojin-law-ui
- **File**: `src/components/documents/DeleteMapaDialog.tsx` (CREATE)
- **Do**: Create delete confirmation:
  - Warning message with mapa name
  - Show slot count to be deleted
  - Confirm/Cancel buttons
  - Use useDeleteMapa hook
- **Done when**: Deletion requires confirmation

---

### Sequential Group 3.2: Integration

> Depends on: Group 3.1 complete

#### Task 3.2.1: Wire MapaDetail

- **Repo**: bojin-law-ui
- **File**: `src/components/documents/MapaDetail.tsx` (MODIFY)
- **Do**: Replace mock data with real hooks:
  - Use useMapa(id) for data fetching
  - Add loading/error states
  - Wire "Edit" menu item to EditMapaModal
  - Wire "Delete" menu item to DeleteMapaDialog
  - Wire print button (placeholder for Phase 5)
- **Done when**: MapaDetail loads real data

#### Task 3.2.2: Wire MapaSlotItem

- **Repo**: bojin-law-ui
- **File**: `src/components/documents/MapaSlotItem.tsx` (MODIFY)
- **Do**: Wire slot actions:
  - "Assign" button opens SlotAssignModal
  - "Remove" button calls useAssignDocument(null)
  - Show slot status badge
  - Add slot status dropdown (pending/requested/received/final)
- **Done when**: Slot assignment/removal works

#### Task 3.2.3: Wire Documents Page

- **Repo**: bojin-law-ui
- **File**: `src/app/(dashboard)/documents/page.tsx` (MODIFY)
- **Do**: Add mapa creation:
  - "New Mapa" button in header
  - Opens CreateMapaModal
  - Use useMapas for sidebar list
  - Remove mock data imports
- **Done when**: Full mapa CRUD works from documents page

---

## PHASE 4: Document Request Workflow

### Parallel Group 4.1: Backend Job Queue

> New backend infrastructure

#### Task 4.1.1: DocumentRequest Schema

- **Repo**: bojin-law-2
- **File**: `services/gateway/schema/documentRequest.graphql` (CREATE)
- **Do**: Define document request type:
  - DocumentRequest: id, slotId, recipientEmail, recipientName, status, requestedAt, dueDate, remindersSent, lastReminderAt
  - RequestStatus: enum (pending, sent, reminded, received, expired)
  - Queries: documentRequests(mapaId), documentRequest(id)
  - Mutations: createDocumentRequest, cancelDocumentRequest, markAsReceived
- **Done when**: Schema validates

#### Task 4.1.2: DocumentRequest Resolvers

- **Repo**: bojin-law-2
- **File**: `services/gateway/resolvers/documentRequest.ts` (CREATE)
- **Do**: Implement resolvers:
  - createDocumentRequest: Create request, enqueue initial email job
  - cancelDocumentRequest: Cancel pending reminders
  - markAsReceived: Update status, link document to slot
  - Status transition validation
- **Done when**: Request lifecycle works

#### Task 4.1.3: Job Queue Setup

- **Repo**: bojin-law-2
- **File**: `services/job-queue/setup.ts` (CREATE)
- **Do**: Setup Bull job queue with Redis:
  - documentRequest queue for emails
  - reminderCheck queue for scheduled checks
  - Error handling and retry logic
  - Dead letter queue for failed jobs
- **Done when**: Queues accept and process jobs

#### Task 4.1.4: Reminder Job

- **Repo**: bojin-law-2
- **File**: `services/job-queue/jobs/sendReminder.ts` (CREATE)
- **Do**: Create reminder job processor:
  - Check due date vs current date
  - Reminder schedule: 3 days, 7 days, then daily
  - Use existing email service to send
  - Update remindersSent count, lastReminderAt
- **Done when**: Reminders sent on schedule

---

### Parallel Group 4.2: Email Templates + UI

> Can run in parallel with Group 4.1

#### Task 4.2.1: Document Request Email Template

- **Repo**: bojin-law-2
- **File**: `services/gateway/templates/document-request.html` (CREATE)
- **Do**: Create HTML email template:
  - Professional Romanian text
  - Document name and description
  - Due date
  - Upload instructions (or reply with attachment)
  - Firm branding
- **Done when**: Template renders correctly

#### Task 4.2.2: Reminder Email Templates

- **Repo**: bojin-law-2
- **File**: `services/gateway/templates/reminder.html` (CREATE)
- **Do**: Create reminder templates:
  - 3-day reminder: Gentle reminder
  - 7-day reminder: Follow-up with urgency
  - Daily reminder: Urgent, overdue notice
  - Variables: document name, days overdue, original due date
- **Done when**: All reminder types render

#### Task 4.2.3: Request Document Modal

- **Repo**: bojin-law-ui
- **File**: `src/components/documents/RequestDocumentModal.tsx` (CREATE)
- **Do**: Create request modal:
  - Select slot to request
  - Recipient email (autocomplete from case actors)
  - Custom message (optional)
  - Due date picker
  - Preview email before sending
- **Done when**: Request creates job in backend

#### Task 4.2.4: Request Status Badge

- **Repo**: bojin-law-ui
- **File**: `src/components/documents/RequestStatusBadge.tsx` (CREATE)
- **Do**: Create status badge:
  - Colors: pending (gray), sent (blue), reminded (orange), received (green), expired (red)
  - Tooltip with request details
  - Days until/past due
- **Done when**: Badge shows correct status

---

### Sequential: Slot Status Integration

> Depends on: Groups 4.1 and 4.2

#### Task 4.3.1: Add Request to Slot Item

- **Repo**: bojin-law-ui
- **File**: `src/components/documents/MapaSlotItem.tsx` (MODIFY)
- **Do**: Add request functionality:
  - "Request" button for empty required slots
  - Show RequestStatusBadge when request exists
  - Cancel request action
  - Mark as received when document uploaded
- **Done when**: Full request workflow in slot UI

---

## PHASE 5: Smart Features

### Parallel Group 5.1: Document Matching (Backend)

> AI-assisted document matching

#### Task 5.1.1: Document Matcher

- **Repo**: bojin-law-2
- **File**: `services/mapa-sync/matcher.ts` (CREATE)
- **Do**: Create matching logic:
  - matchDocumentsToSlots(caseDocuments, slotDefinitions): Return matches with confidence
  - Match criteria: filename keywords, document type, upload date
  - Confidence score: high (>80%), medium (50-80%), low (<50%)
  - Only suggest high-confidence matches
- **Done when**: Returns reasonable matches for test data

#### Task 5.1.2: Suggestions Query

- **Repo**: bojin-law-2
- **File**: `services/gateway/resolvers/mapaSlot.ts` (MODIFY)
- **Do**: Add suggestion resolver:
  - Query.suggestedDocuments(slotId): Return matched documents with confidence
  - Filter to unassigned documents only
  - Limit to top 5 suggestions
- **Done when**: Query returns suggestions

---

### Parallel Group 5.2: Generation & Print

> Frontend utilities

#### Task 5.2.1: Print Utility

- **Repo**: bojin-law-ui
- **File**: `src/lib/print/mapaPrint.ts` (CREATE)
- **Do**: Create print function:
  - printMapa(mapaId): Opens print dialog
  - Uses CSS @media print for styling
  - Hides UI elements, shows document list
  - Option: include cover page
- **Done when**: Clean printout of mapa

#### Task 5.2.2: Cover Page Component

- **Repo**: bojin-law-ui
- **File**: `src/lib/print/mapaCoverPage.tsx` (CREATE)
- **Do**: Create cover page for print:
  - Firm logo and name
  - Mapa title and description
  - Case reference
  - Completion status summary
  - Table of contents (slot list)
  - Print date
- **Done when**: Cover page renders for print

#### Task 5.2.3: Suggested Documents Component

- **Repo**: bojin-law-ui
- **File**: `src/components/documents/SuggestedDocuments.tsx` (CREATE)
- **Do**: Create suggestions UI:
  - Show suggested documents for empty slots
  - Confidence indicator (high/medium)
  - One-click assign
  - "Ignore suggestion" option
- **Done when**: Suggestions display and can be assigned

---

### Parallel Group 5.3: Client Schema Extension

> Frontend form for company data

#### Task 5.3.1: Database Migration

- **Repo**: bojin-law-2
- **File**: Database migration (CREATE)
- **Do**: Add company fields to clients table:
  - client_type: enum
  - cui: varchar(20)
  - registration_number: varchar(50)
  - company_type: enum
  - incorporation_date: date
  - administrators: jsonb
  - shareholders: jsonb
- **Done when**: Migration runs successfully

#### Task 5.3.2: Company Details Form

- **Repo**: bojin-law-ui
- **File**: `src/components/clients/CompanyDetailsForm.tsx` (CREATE)
- **Do**: Create company data form:
  - Conditional fields when clientType = company
  - CUI with validation (8-10 digits)
  - Registration number format
  - Administrator list (add/remove)
  - Shareholder list with percentage (must sum to 100%)
- **Done when**: Form validates and saves company data

---

### Final: Integration & Testing

> Wire everything together

#### Task 5.4.1: Final MapaDetail Integration

- **Repo**: bojin-law-ui
- **File**: `src/components/documents/MapaDetail.tsx` (MODIFY)
- **Do**: Wire remaining features:
  - Print button calls mapaPrint
  - Show SuggestedDocuments for empty slots
  - Auto-match button for one-click suggestions
- **Done when**: All features accessible from main view

#### Task 5.4.2: End-to-End Testing

- **Repos**: Both
- **Do**: Test full workflow:
  - Create mapa from ONRC template
  - Assign documents to slots
  - Request missing documents via email
  - Receive document and mark slot complete
  - Print completed mapa
  - Verify admin can sync templates
- **Done when**: All flows work end-to-end

---

## Session Scope Assessment

- **Total tasks**: 38
- **Estimated complexity**: Complex (multi-repo, 5 phases)
- **Checkpoint recommended at**: After Phase 2 (template system complete)
- **Second checkpoint**: After Phase 4 (document request workflow)

## Dependencies to Install

**bojin-law-ui (package.json):**

```json
{
  "html2pdf.js": "^0.10.1"
}
```

**bojin-law-2 (package.json):**

```json
{
  "cheerio": "^1.0.0",
  "node-cron": "^3.0.2",
  "bull": "^4.12.0"
}
```

## Next Step

Start a new session and run:

```
/implement plan-mape-onrc
```

---

## CHECKPOINT - 2025-12-30 (Session 2)

### Session Summary

Implemented the frontend portions of Phases 1.3, 2.2, 3, and 4 for the mape feature. Created GraphQL operations, React hooks, template UI components, mapa modals, and the complete document request workflow UI. All type checks pass. Ready for Phase 5 (Smart Features).

### Progress

#### Phase 1: Core Infrastructure

- [x] Task 1.3.1: Create Mapa GraphQL Operations (`src/graphql/mapa.ts`)
- [x] Task 1.3.2: Create Template GraphQL Operations (`src/graphql/template.ts`)
- [x] Task 1.3.3: Create useMapa Hook (`src/hooks/useMapa.ts`)
- [x] Task 1.3.4: Create useTemplates Hook (`src/hooks/useTemplates.ts`)
- [x] Task 1.3.5: Update Mapa Types (`src/types/mapa.ts`)
- [ ] Tasks 1.1.x, 1.2.x: Backend tasks (bojin-law-2 repo) - NOT STARTED

#### Phase 2: Template System

- [x] Task 2.2.1: Create TemplatePicker Component
- [x] Task 2.2.2: Create Admin Templates Page (`src/app/(dashboard)/admin/templates/page.tsx`)
- [x] Task 2.2.3: Create TemplateCard Component (`src/components/admin/TemplateCard.tsx`)
- [x] Task 2.2.4: Create TemplateSyncStatus Component (`src/components/admin/TemplateSyncStatus.tsx`)
- [ ] Tasks 2.1.x: Backend ONRC scraper/sync (bojin-law-2 repo) - NOT STARTED

#### Phase 3: Core Mapa UI

- [x] Task 3.1.1: Create CreateMapaModal Component
- [x] Task 3.1.2: Create EditMapaModal Component
- [x] Task 3.1.3: Create SlotAssignModal Component
- [x] Task 3.1.4: Create DeleteMapaDialog Component
- [x] Task 3.2.1: Wire MapaDetail with real hooks (Edit/Delete modals)
- [x] Task 3.2.2: Wire MapaSlotItem with status dropdown
- [x] Task 3.2.3: Wire Documents Page with real data (CreateMapaModal, SlotAssignModal)

#### Phase 4: Document Request Workflow

- [x] Task 4.2.3: Create RequestDocumentModal (`src/components/documents/RequestDocumentModal.tsx`)
- [x] Task 4.2.4: Create RequestStatusBadge (`src/components/documents/RequestStatusBadge.tsx`)
- [x] Task 4.3.1: Wire request to MapaSlotItem (Request button, status badge, cancel)
- [ ] Tasks 4.1.x: Backend job queue (bojin-law-2 repo) - NOT STARTED
- [ ] Tasks 4.2.1, 4.2.2: Backend email templates (bojin-law-2 repo) - NOT STARTED

#### Phase 5: Smart Features

- [ ] All tasks - NOT STARTED

### Files Created

| File                                                | Purpose                                                    |
| --------------------------------------------------- | ---------------------------------------------------------- |
| `src/graphql/mapa.ts`                               | GraphQL operations for mapa CRUD, slots, document requests |
| `src/graphql/template.ts`                           | GraphQL operations for templates, ONRC sync                |
| `src/hooks/useMapa.ts`                              | React hooks for all mapa operations                        |
| `src/hooks/useTemplates.ts`                         | React hooks for template operations                        |
| `src/components/documents/TemplatePicker.tsx`       | Template selection modal with search/filter                |
| `src/components/documents/CreateMapaModal.tsx`      | Create mapa with optional template                         |
| `src/components/documents/EditMapaModal.tsx`        | Edit mapa name/description                                 |
| `src/components/documents/SlotAssignModal.tsx`      | Assign documents to slots                                  |
| `src/components/documents/DeleteMapaDialog.tsx`     | Delete confirmation dialog                                 |
| `src/components/documents/RequestDocumentModal.tsx` | Request document via email                                 |
| `src/components/documents/RequestStatusBadge.tsx`   | Request status with tooltip                                |
| `src/components/admin/TemplateCard.tsx`             | Template display card                                      |
| `src/components/admin/TemplateSyncStatus.tsx`       | Sync status indicator                                      |
| `src/app/(dashboard)/admin/templates/page.tsx`      | Admin templates page                                       |

### Files Modified

| File                                        | Changes                                                           |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `src/types/mapa.ts`                         | Added SlotStatus, DocumentRequest, TemplateChangelog, ONRC fields |
| `src/lib/mock/documents.ts`                 | Added `status` field to mock slots                                |
| `src/components/documents/MapaDetail.tsx`   | Added modal state, request handlers                               |
| `src/components/documents/MapaSlotItem.tsx` | Added status dropdown, request button, RequestStatusBadge         |
| `src/components/documents/index.ts`         | Added exports for new components                                  |
| `src/app/(dashboard)/documents/page.tsx`    | Wired all modals and request handlers                             |

### Resume Instructions

1. Run: `/implement plan-mape-onrc`
2. Continue from: **Phase 5 - Smart Features**
3. Next actions:
   - Task 5.2.1: Create print utility (`src/lib/print/mapaPrint.ts`)
   - Task 5.2.2: Create cover page component (`src/lib/print/mapaCoverPage.tsx`)
   - Task 5.2.3: Create SuggestedDocuments component
   - Task 5.3.2: Create CompanyDetailsForm component
   - Task 5.4.1: Final MapaDetail integration (wire print, suggestions)

### Critical Context

1. **Frontend-only implementation**: We're in `bojin-law-ui`. All backend tasks (bojin-law-2) are marked NOT STARTED.

2. **Mock data still in use**: The Documents page still imports from `src/lib/mock/documents.ts`. Real API integration requires backend completion.

3. **Type patterns established**:
   - Hooks follow pattern: `use[Action]` returning `{ actionFn, loading, error }`
   - GraphQL uses `gql` from `@apollo/client`
   - Components use `'use client'` directive, Linear design tokens, Radix UI primitives

4. **Romanian labels**: Many components use Romanian text (Nume, Descriere, Anuleaza, etc.)

5. **Component exports**: All new components are exported from `src/components/documents/index.ts`

### Blockers

- None for Phase 5 frontend tasks
- Backend integration blocked until bojin-law-2 work is done
