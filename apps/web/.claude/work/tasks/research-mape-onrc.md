# Research: Mape Feature + ONRC Integration

**Status**: Complete
**Date**: 2024-12-29
**Input**: `brainstorm-mape-onrc.md`
**Next step**: `/plan research-mape-onrc`

---

## Context Summary

**Project**: bojin-law-ui (Next.js 16 legal platform UI)
**Backend**: bojin-law-2 (GraphQL gateway)
**Tech Stack**: Next.js 16, TypeScript, Apollo Client, Tailwind, Radix UI
**Users**: Lawyers and paralegals at Romanian law firm

**Goal**: Build a "mape" (binder) feature with ONRC template sync for managing document collections for SRL legal procedures.

---

## Problem Statement

The firm needs a robust "mape" (binder) feature to manage document collections for cases:

1. **ONRC integration**: Pre-built templates for all SRL procedures from onrc.ro, auto-synced monthly
2. **Smart automation**: Auto-detect existing docs, auto-request missing docs, auto-generate forms

---

## Research Findings

### 1. Existing Mape Implementation Analysis

**Current State: 80% UI Complete, 0% Backend Integration**

#### Files Found:

| File Path                                         | Purpose                                              |
| ------------------------------------------------- | ---------------------------------------------------- |
| `src/types/mapa.ts`                               | Core type definitions (Mapa, MapaSlot, Template)     |
| `src/components/documents/MapaDetail.tsx`         | Main mapa detail view with slots grouped by category |
| `src/components/documents/MapaCard.tsx`           | Card and sidebar item components                     |
| `src/components/documents/MapaSlotItem.tsx`       | Individual slot display with assign/remove actions   |
| `src/components/documents/MapaCompletionRing.tsx` | SVG completion progress indicator                    |
| `src/store/documentsStore.ts`                     | Zustand store for documents UI state                 |
| `src/lib/mock/documents.ts`                       | Complete mock data (Romanian legal categories)       |
| `src/app/(dashboard)/documents/page.tsx`          | Documents page with mapa integration                 |

#### Current Data Model:

```typescript
interface Mapa {
  id: string;
  caseId: string;
  name: string;
  description?: string;
  templateId?: string; // Reference defined but not implemented
  createdBy: UserSummary;
  createdAt: string;
  updatedAt: string;
  slots: MapaSlot[];
  completionStatus: MapaCompletionStatus;
}

interface MapaSlot {
  id: string;
  mapaId: string;
  name: string;
  description?: string;
  category: string; // 'acte_procedurale', 'dovezi', 'corespondenta', etc.
  required: boolean;
  order: number;
  document?: Document; // Assigned document
  assignedAt?: string;
  assignedBy?: UserSummary;
}

// Template types defined but NOT implemented:
interface MapaTemplate {
  id: string;
  firmId: string;
  name: string;
  description?: string;
  caseType?: string;
  slotDefinitions: SlotDefinition[];
  isActive: boolean;
  usageCount: number;
  createdBy: UserSummary;
}
```

#### UI Capabilities:

- Mapa list view per case (sidebar navigation)
- Mapa detail view with slots grouped by category
- Completion ring (green=complete, orange=partial, gray=empty)
- Print button (handler not implemented)
- More actions menu (Edit, Duplicate, Export, Delete)
- Slot assignment/removal (TODO: actual functionality)

#### Gaps vs Target Design:

| Feature              | Status     | Notes                                        |
| -------------------- | ---------- | -------------------------------------------- |
| Template CRUD        | Types only | No UI or API                                 |
| Template sync        | Missing    | Core feature needed                          |
| Item status workflow | Basic      | Need: pending → requested → received → final |
| Document generation  | Missing    | Need forms prefill capability                |
| Auto-matching        | Missing    | Match case docs to slots                     |
| GraphQL integration  | None       | All mock data                                |
| Reminder system      | Missing    | For document requests                        |

---

### 2. Email System Analysis

**Current State: Production-Ready Email Client**

#### Capabilities:

| Feature             | Status  | Details                                  |
| ------------------- | ------- | ---------------------------------------- |
| Send Email          | Full    | `SEND_EMAIL` mutation via GraphQL        |
| Reply to Email      | Full    | `REPLY_TO_EMAIL` mutation via GraphQL    |
| Email Attachments   | Partial | Upload (max 10 files, 3MB each), display |
| Receive & Sync      | Full    | Exchange sync with `START_EMAIL_SYNC`    |
| Email Threads       | Full    | Conversation threading                   |
| AI Draft Generation | Full    | Quick replies & prompt-based             |
| Case Association    | Full    | Link emails to cases                     |
| **Scheduled Send**  | None    | Not implemented                          |
| **Email Reminders** | None    | Not implemented                          |

#### Key Files:

| File                                         | Purpose                              |
| -------------------------------------------- | ------------------------------------ |
| `src/types/email.ts`                         | Email, thread, attachment types      |
| `src/store/emailStore.ts`                    | Zustand store with draft persistence |
| `src/hooks/useAiEmailDraft.ts`               | AI reply generation                  |
| `src/components/email/ComposeEmailModal.tsx` | Email composition (552 lines)        |
| `src/components/email/ReplyArea.tsx`         | Reply interface with AI              |

#### GraphQL Mutations Available:

```graphql
SEND_EMAIL(input: SendEmailInput!) → Email
REPLY_TO_EMAIL(input: ReplyEmailInput!) → Email
GENERATE_AI_REPLY(threadId, tone) → String
START_EMAIL_SYNC() → EmailSyncStatus
```

#### Document Request Workflow Feasibility:

**Feasible with moderate effort (1-2 weeks)**

Required extensions:

1. **Email Templates**: Add template system for document requests
2. **Scheduling Backend**: Job queue (Bull/Agenda.js) for reminders
3. **Request Tracking**: New `DocumentRequest` type with status tracking
4. **Automatic Reminders**: Backend cron checking overdue requests

---

### 3. Document Handling Analysis

**Current State: Viewing Complete, Upload Not Implemented**

#### Capabilities:

| Feature             | Status  | Details                              |
| ------------------- | ------- | ------------------------------------ |
| Document Preview    | Full    | Multi-format modal with react-pdf    |
| PDF Viewing         | Full    | react-pdf 9.2.1 with zoom/navigation |
| DOCX/Excel/PPT      | Partial | Office Online preview (read-only)    |
| Image Viewing       | Full    | Direct rendering                     |
| Document Upload     | UI only | Handler is TODO                      |
| Download            | Ready   | GraphQL query exists                 |
| **PDF Generation**  | None    | No library installed                 |
| **DOCX Generation** | None    | No library installed                 |
| **Print**           | UI only | Handler not implemented              |

#### Key Files:

| File                                                | Purpose                             |
| --------------------------------------------------- | ----------------------------------- |
| `src/types/document.ts`                             | Document types with mapa assignment |
| `src/components/documents/PDFViewer.tsx`            | PDF viewing with react-pdf          |
| `src/components/documents/DocumentPreviewModal.tsx` | Multi-format preview                |
| `src/hooks/useDocumentPreview.ts`                   | GraphQL preview URL fetching        |

#### Storage Integration:

- Backend uses Microsoft Graph/OneDrive (based on Office Online preview)
- 10GB storage quota visible in mock data

#### Document Generation Recommendation:

**For Mapa Print Output:**

1. **Short term (MVP)**: Browser `window.print()` with CSS @media print
2. **Medium term**: Add `html2pdf.js` (~150KB) for PDF export
3. **Long term**: Server-side generation for complex needs

**Dependencies to add:**

```json
"html2pdf.js": "^0.10.1"
```

---

### 4. Client/Case Data Analysis

**Current State: Good Foundation, Missing SRL-Specific Fields**

#### Available Client Data:

```typescript
interface Client {
  id: string;
  name: string;
  contactInfo: JSON; // Flexible - phone, email, etc.
  address: string;
  firmId: string;
}
```

#### Available Case Data:

```typescript
interface Case {
  id: string;
  caseNumber: string;
  title: string;
  status: CaseStatus; // Active, PendingApproval, OnHold, Closed
  type: CaseType; // Litigation, Contract, Advisory, Criminal, Other
  description: string;
  client: Client;
  teamMembers: TeamMember[];
  actors: CaseActor[]; // External parties
  openedDate: DateTime;
}

interface CaseActor {
  id: string;
  role: CaseActorRole; // Client, OpposingParty, Witness, Expert, LegalRepresentative, etc.
  name: string;
  organization?: string;
  email?: string;
  phone?: string;
  address?: string;
}
```

#### SRL Form Prefilling Assessment:

**40-50% of required data available**

| Data                    | Available | Notes                     |
| ----------------------- | --------- | ------------------------- |
| Company name            | Yes       | Via client.name           |
| Address                 | Yes       | Via client.address        |
| Contact info            | Yes       | Via contactInfo JSON      |
| **CUI (Tax ID)**        | No        | Critical for SRL forms    |
| **Registration Number** | No        | Critical for SRL forms    |
| **Company Type**        | No        | SRL/SA/PFA classification |
| **Administrators**      | No        | List with roles           |
| **Shareholders**        | No        | With share percentages    |
| Legal representative    | Partial   | Via CaseActor role        |

#### Recommended Schema Extension:

```typescript
interface CompanyClient extends Client {
  clientType: 'individual' | 'company';
  // Romanian company registration
  cui?: string; // Cod Unic de Identificare
  registrationNumber?: string; // Nr. înregistrare RC
  companyType?: 'SRL' | 'SA' | 'PFA' | 'Other';
  incorporationDate?: Date;
  // Company structure
  administrators?: Administrator[];
  shareholders?: Shareholder[];
  // Address details
  registeredAddress: string;
  fiscalAddress?: string;
}

interface Administrator {
  name: string;
  cnp?: string;
  role: string; // Administrator unic, Administrator, etc.
  startDate?: Date;
}

interface Shareholder {
  name: string;
  type: 'individual' | 'company';
  sharePercentage: number;
  capitalContribution: number;
}
```

---

### 5. ONRC Website Structure Analysis

**Research Status**: Extensive analysis via web fetch (33+ page fetches)

#### Website Structure:

- **Main URL**: https://www.onrc.ro
- **Procedure sections**:
  - `/index.php/ro/inmatriculari` - Registration procedures
  - `/index.php/ro/mentiuni` - Modification procedures
  - `/index.php/ro/dizolvari-lichidari-radieri` - Dissolution/liquidation
  - `/index.php/ro/operatiuni-prealabile` - Preliminary operations
  - `/index.php/ro/formulare` - Forms and templates

#### Key SRL Procedure URLs:

| Procedure                | URL Pattern                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| SRL Establishment        | `/inmatriculari/persoane-juridice/societate-cu-raspundere-limitata`                             |
| SRL-D (Debutant)         | `/inmatriculari/persoane-juridice/societati-cu-raspundere-limitata-debutant-srl-d`              |
| Share Transfer           | `/mentiuni/persoane-juridice/transmiterea-partilor-de-interes-si-a-partilor-sociale`            |
| Management Change        | `/mentiuni/persoane-juridice/schimbarea-membrilor-organelor-de-conducere-si-de-control`         |
| Capital Increase         | `/mentiuni/persoane-juridice/majorarea-capitalului-social`                                      |
| Capital Reduction        | `/mentiuni/persoane-juridice/reducerea-capitalului-social`                                      |
| Office Change            | `/mentiuni/persoane-juridice/schimbarea-sediului-social-in-acelasi-judet`                       |
| Activity Change          | `/mentiuni/persoane-juridice/modificarea-obiectului-de-activitate`                              |
| Name Change              | `/mentiuni/persoane-juridice/modificarea-denumirii`                                             |
| Activity Suspension      | `/mentiuni/persoane-juridice/suspendarea-sau-reluarea-activitatii`                              |
| Simultaneous Dissolution | `/dizolvari-lichidari-radieri/persoane-juridice/dizolvarea-si-lichidarea-simultana`             |
| Voluntary Dissolution    | `/dizolvari-lichidari-radieri/persoane-juridice/dizolvarea-voluntara-cu-numirea-lichidatorului` |

#### Scraping Feasibility:

| Aspect          | Assessment                                    |
| --------------- | --------------------------------------------- |
| URL Structure   | Predictable, SEO-friendly                     |
| HTML Structure  | Standard HTML with content sections           |
| Document Lists  | Mix of bullet lists and descriptive text      |
| Forms/Templates | Available at `/formulare` section             |
| Rate Limiting   | None observed, but respectful scraping needed |
| Updates         | Changes occur when legislation changes        |

#### Scraping Approach Recommended:

1. **Initial Load**: Manual review + semi-automated extraction
2. **Monthly Sync**: Scrape document requirement sections
3. **Change Detection**: Hash page content, alert on changes
4. **Fallback**: Keep existing template if scrape fails

#### API Availability:

- **ONRC Official API**: None publicly documented
- **data.gov.ro**: No procedure-related datasets found
- **Third-party (REGNET)**: Commercial API available for company data lookup (not procedures)

---

## Implementation Recommendation

### Phase 1: Core Mape Infrastructure (Frontend)

**Focus**: Complete UI-backend integration

1. **GraphQL Schema** (backend - bojin-law-2)
   - Add Mapa CRUD mutations
   - Add Template CRUD mutations
   - Add MapaSlot operations

2. **Frontend Integration**
   - Connect existing UI to GraphQL
   - Implement create/edit mapa modals
   - Implement slot assignment flow

### Phase 2: Template System

**Focus**: ONRC template management

1. **Backend Template Sync Service**
   - Web scraper for ONRC pages
   - Content hash for change detection
   - Changelog storage
   - Admin notifications on changes

2. **Admin Dashboard**
   - Template list with sync status
   - Manual sync trigger
   - Change review UI

3. **Template Application**
   - Create mapa from template
   - Lock ONRC templates (read-only)

### Phase 3: Document Request Workflow

**Focus**: Automated document collection

1. **Backend Job Queue**
   - Bull/Agenda.js setup
   - Scheduled email job
   - Reminder escalation logic

2. **Document Request Entity**
   - Link to mapa slot
   - Status tracking (pending → requested → received → final)
   - Reminder history

3. **Email Templates**
   - Document request template
   - Reminder templates (3-day, 7-day, daily)

### Phase 4: Smart Features

**Focus**: Automation and generation

1. **Document Matching**
   - Match case documents to mapa slots
   - Confidence scoring
   - User confirmation flow

2. **Document Generation**
   - Form prefill from client/case data
   - PDF generation (html2pdf.js)
   - Cover page generation for print

3. **Client Schema Extension**
   - Add CUI, registration number fields
   - Add administrators/shareholders
   - Migration for existing data

---

## File Plan

| File                                           | Action | Purpose                                                       |
| ---------------------------------------------- | ------ | ------------------------------------------------------------- |
| `src/graphql/queries.ts`                       | Modify | Add mapa CRUD queries/mutations                               |
| `src/types/mapa.ts`                            | Modify | Add Template sync fields (sourceUrl, lastSynced, contentHash) |
| `src/components/documents/CreateMapaModal.tsx` | Create | Modal for creating new mapa                                   |
| `src/components/documents/EditMapaModal.tsx`   | Create | Modal for editing mapa                                        |
| `src/components/documents/TemplatePicker.tsx`  | Create | Template selection UI                                         |
| `src/components/documents/SlotAssignModal.tsx` | Create | Assign document to slot                                       |
| `src/app/(dashboard)/admin/templates/page.tsx` | Create | Admin template management                                     |
| `src/components/admin/TemplateSync.tsx`        | Create | Template sync status/controls                                 |
| `src/hooks/useMapa.ts`                         | Create | Mapa data fetching hook                                       |
| `src/hooks/useTemplates.ts`                    | Create | Template data fetching hook                                   |
| `src/lib/print/mapaPrint.ts`                   | Create | Print/PDF generation utility                                  |

**Backend (bojin-law-2):**
| File | Action | Purpose |
|------|--------|---------|
| `services/gateway/schema/mapa.graphql` | Create | Mapa GraphQL schema |
| `services/gateway/resolvers/mapa.ts` | Create | Mapa resolvers |
| `services/mapa-sync/scraper.ts` | Create | ONRC web scraper |
| `services/mapa-sync/sync-job.ts` | Create | Monthly sync cron job |
| `packages/shared/types/src/mapa.ts` | Create | Shared mapa types |

---

## Risks

| Risk                               | Impact           | Mitigation                                                   |
| ---------------------------------- | ---------------- | ------------------------------------------------------------ |
| ONRC website structure changes     | Sync breaks      | Change detection + alerts, manual review fallback            |
| ONRC blocks scraping               | No auto-sync     | User-agent rotation, respectful rate limiting, manual backup |
| Complex document matching logic    | Poor UX          | Start with high-confidence matches only, user confirmation   |
| Schema migration for clients       | Data loss risk   | Careful migration, keep existing fields                      |
| Email deliverability for reminders | Missed reminders | SPF/DKIM setup, delivery tracking                            |

---

## Dependencies

**NPM Packages to Add:**

```json
{
  "html2pdf.js": "^0.10.1", // PDF generation
  "cheerio": "^1.0.0", // HTML parsing (backend)
  "node-cron": "^3.0.2" // Cron scheduling (backend)
}
```

**Backend Services Required:**

- Job queue (Bull + Redis or Agenda.js + MongoDB)
- Email service (existing Exchange integration)
- ONRC scraper service (new)

---

## Next Step

Start a new session and run:

```
/plan research-mape-onrc
```
