# Research: Documents Feature with OneDrive/SharePoint Integration

**Status**: Complete
**Date**: 2025-12-29
**Input**: `brainstorm-documents.md`
**Next step**: `/plan research-documents`

---

## Context Summary

### Project

- **Main**: `/Users/mio/Developer/bojin-law-ui` - Next.js 16 (App Router), TypeScript, Tailwind, Apollo Client, MSAL, Zustand
- **Reference**: `/Users/mio/Developer/bojin-law-2` - Existing document management with GraphQL gateway

### Tech Stack

- **Frontend**: React 19, Next.js 16, Tailwind CSS, Radix UI, Lucide icons
- **State**: Zustand (localStorage persistence for UI preferences)
- **GraphQL**: Apollo Client 4.x (HTTP-only, no subscriptions)
- **Auth**: Azure MSAL (SSO), tokens stored in session storage
- **Design**: Linear-inspired dark theme with CSS variables

### Storage Strategy

- **Primary**: SharePoint (firm-scoped, path: `Cases/{CaseNumber}/Documents/`)
- **Legacy**: OneDrive (user-scoped, pre-migration documents)
- **Fallback**: Cloudflare R2 (when cloud storage unavailable)

---

## Problem Statement

Implement `/documents` feature in bojin-law-ui with:

1. **Improved preview performance** - Progressive loading with client-side rendering
2. **Real-time sync** - Detect SharePoint changes via webhooks
3. **Full feature parity** - Review workflow, version control, AI features
4. **Reuse backend** - Leverage existing GraphQL mutations/queries

---

## Research Findings

### 1. Existing Code Analysis

#### Reusable Components (bojin-law-2)

| Component            | Path                                                       | Lines   | Reusability               |
| -------------------- | ---------------------------------------------------------- | ------- | ------------------------- |
| DocumentPreviewModal | `apps/web/src/components/preview/DocumentPreviewModal.tsx` | 301-823 | Port with modifications   |
| PDFViewer            | `apps/web/src/components/preview/PDFViewer.tsx`            | 43-213  | Port directly             |
| PreviewButton        | `apps/web/src/components/preview/PreviewButton.tsx`        | -       | Port directly             |
| useDocumentPreview   | `apps/web/src/hooks/useDocumentPreview.ts`                 | 156-342 | Port with Apollo changes  |
| usePreviewActions    | `apps/web/src/hooks/usePreviewActions.ts`                  | -       | Port for action filtering |
| ActionToolbar        | DocumentPreviewModal.tsx                                   | 200-295 | Extract and port          |

#### Existing in bojin-law-ui

| Component             | Path                                                 | Status |
| --------------------- | ---------------------------------------------------- | ------ |
| DocumentCard          | `src/components/documents/DocumentCard.tsx`          | Ready  |
| DocumentListItem      | `src/components/documents/DocumentListItem.tsx`      | Ready  |
| DocumentsSidebar      | `src/components/documents/DocumentsSidebar.tsx`      | Ready  |
| DocumentsContentPanel | `src/components/documents/DocumentsContentPanel.tsx` | Ready  |
| documentsStore        | `src/store/documentsStore.ts`                        | Ready  |
| Document types        | `src/types/document.ts`                              | Ready  |
| Mapa types            | `src/types/mapa.ts`                                  | Ready  |

#### Files Needing Modification

| File                       | Change Required                                     |
| -------------------------- | --------------------------------------------------- |
| `src/graphql/queries.ts`   | Add preview URL, download URL, text content queries |
| `src/lib/apollo-client.ts` | Add WebSocket link for subscriptions                |
| `package.json`             | Add react-pdf, graphql-ws dependencies              |
| `next.config.js`           | Add WebSocket proxy rewrite                         |

#### Files to Create

| File                                                | Purpose                          |
| --------------------------------------------------- | -------------------------------- |
| `src/components/documents/DocumentPreviewModal.tsx` | Progressive preview modal        |
| `src/components/documents/PDFViewer.tsx`            | PDF rendering with zoom          |
| `src/hooks/useDocumentPreview.ts`                   | Preview state management         |
| `src/hooks/useDocumentSubscription.ts`              | Real-time document updates       |
| `src/graphql/subscriptions.ts`                      | GraphQL subscription definitions |

---

### 2. Preview Architecture

#### Current Implementation (bojin-law-2)

**Preview Method Selection:**

1. **Text Files** → Backend proxy → `<pre>` element
2. **PDFs** → Download URL → react-pdf viewer
3. **Office Docs** → Office Online iframe (slow, 3-5s)
4. **Images** → Direct blob URL → `<object>` tag

**Lazy Loading Pattern:**

```typescript
const PDFViewer = lazy(() => import('./PDFViewer'));
// Wrapped in Suspense boundary with skeleton fallback
```

**File Type Constants:**

- `OFFICE_TYPES`: docx, xlsx, pptx, doc, xls, ppt (MIME types)
- `BROWSER_NATIVE_TYPES`: pdf, images (jpeg, png, gif, webp), text
- `TEXT_TYPES`: csv, json, html, css, javascript

#### Thumbnail Infrastructure

**Storage:**

- Location: Cloudflare R2 (`thumbnails/{documentId}/[small|medium|large].jpg`)
- Sizes: small (48x48), medium (200x200), large (800x800)
- Cache: 1 year immutable (`public, max-age=31536000`)

**Generation:**

- BullMQ worker with Redis backend
- Images → Sharp library (local)
- Office/PDF → Microsoft Graph thumbnails API
- Retries: 3 attempts, exponential backoff

**GraphQL Fields:**

```graphql
thumbnailSmall: String   # 48x48 grid icons
thumbnailMedium: String  # 200x200 grid view
thumbnailLarge: String   # 800x800 preview modal
thumbnailStatus: ThumbnailStatus  # PENDING | PROCESSING | COMPLETED | FAILED
```

#### Progressive Loading Strategy (New)

**Phase 1: Instant Feedback (<100ms)**

- Show medium thumbnail (200x200) from R2
- Display file metadata (name, size, type)
- Skeleton for full preview area

**Phase 2: Enhanced Thumbnail (<500ms)**

- Load large thumbnail (800x800)
- Smooth crossfade transition
- Display "Loading full preview..." indicator

**Phase 3: Full Preview (1-5s)**

- **PDFs**: Load react-pdf viewer
- **Images**: Load full resolution
- **Office**: Attempt client-side rendering first
  - Word → `docx-preview` library
  - Excel → `xlsx` + custom table renderer
- **Fallback**: Office Online iframe for complex docs

**Detection Logic for Client-Side vs. Server:**

```typescript
function canRenderClientSide(doc: Document): boolean {
  // Word: Check for known complex features
  if (doc.fileType === 'docx') {
    const complexity = doc.metadata?.complexity || 'simple';
    return complexity !== 'complex'; // Macros, OLE, etc.
  }
  // Excel: Check sheet count and formula complexity
  if (doc.fileType === 'xlsx') {
    const sheets = doc.metadata?.sheetCount || 1;
    return sheets <= 10;
  }
  return ['pdf', 'image'].includes(doc.fileType);
}
```

---

### 3. GraphQL Schema Summary

#### Key Types

```graphql
type Document {
  id: UUID!
  fileName: String!
  fileType: String!
  fileSize: Int!
  status: DocumentStatus!
  sourceType: DocumentSourceType!
  uploadedBy: User!
  uploadedAt: DateTime!

  # Storage
  storageType: DocumentStorageType! # ONEDRIVE | SHAREPOINT | R2
  sharePointItemId: String
  oneDriveId: String

  # Thumbnails
  thumbnailSmall: String
  thumbnailMedium: String
  thumbnailLarge: String
  thumbnailStatus: ThumbnailStatus

  # Review
  reviewer: User
  reviewerId: String
  submittedAt: DateTime

  # Relations
  versions: [DocumentVersion!]!
  versionCount: Int!
  linkedCases: [CaseDocumentLink!]!
}

enum DocumentStatus {
  DRAFT
  IN_REVIEW
  CHANGES_REQUESTED
  PENDING
  FINAL
  ARCHIVED
}

enum DocumentSourceType {
  UPLOAD
  EMAIL_ATTACHMENT
  AI_GENERATED
  TEMPLATE
}
```

#### Available Queries

| Query                                          | Purpose           | Pagination |
| ---------------------------------------------- | ----------------- | ---------- |
| `caseDocuments(caseId)`                        | All docs for case | No         |
| `caseDocumentsGrid(caseId, first, after, ...)` | Paginated grid    | Cursor     |
| `document(id)`                                 | Single document   | N/A        |
| `documentVersions(documentId)`                 | Version history   | No         |
| `documentPreviewUrl(documentId)`               | Office Online URL | N/A        |
| `documentTextContent(documentId)`              | Text file content | N/A        |
| `getDocumentThumbnail(documentId)`             | Thumbnail URL     | N/A        |
| `documentsForReview`                           | Review queue      | No         |
| `supervisors`                                  | Reviewer list     | No         |

#### Available Mutations

| Mutation                                     | Purpose                        |
| -------------------------------------------- | ------------------------------ |
| `uploadDocument(input)`                      | Create document + link to case |
| `linkDocumentsToCase(input)`                 | Cross-case linking             |
| `unlinkDocumentFromCase(caseId, documentId)` | Soft delete link               |
| `permanentlyDeleteDocument(documentId)`      | Hard delete (Partner only)     |
| `updateDocumentMetadata(documentId, input)`  | Update tags/description        |
| `renameDocument(documentId, newFileName)`    | Rename                         |
| `uploadDocumentToSharePoint(input)`          | Direct SharePoint upload       |
| `syncDocumentFromOneDrive(documentId)`       | Sync changes                   |
| `getDocumentDownloadUrl(documentId)`         | Pre-signed download URL        |

#### Review Workflow Mutations

| Mutation                         | Purpose                                |
| -------------------------------- | -------------------------------------- |
| `submitForReview(input)`         | DRAFT → IN_REVIEW                      |
| `reviewDocument(input)`          | IN_REVIEW → FINAL or CHANGES_REQUESTED |
| `withdrawFromReview(documentId)` | IN_REVIEW → DRAFT                      |
| `sendReviewFeedbackEmail(input)` | Email feedback to author               |

---

### 4. Microsoft Graph Integration

#### Current Setup (bojin-law-2)

**SDK:**

- Package: `@microsoft/microsoft-graph-client` v3.0.7
- Auth: `@azure/msal-node` v2.0.0
- Retry: 5 attempts, exponential backoff (1-32s)

**OAuth Scopes:**

```
Delegated (user context):
- Files.Read, Files.ReadWrite, Files.Read.All
- Sites.Read.All, Sites.ReadWrite.All (SharePoint)
- User.Read, Mail.Read, Calendars.Read
```

**Token Management:**

- Storage: Redis-backed Express sessions
- Refresh: Proactive (5-minute buffer before expiry)
- Helper: `getGraphToken(userId)` for background jobs

#### SharePoint Document Operations

**Upload:**

- Simple (<4MB): Direct PUT to content endpoint
- Resumable (>4MB): Upload session with 320KB chunks
- Path: `/Cases/{CaseNumber}/Documents/{fileName}`

**Download:**

- `@microsoft.graph.downloadUrl` from item metadata (1-hour expiry)
- Fallback: Create organization sharing link

**Thumbnails:**

- Graph API: `/drive/items/{itemId}/thumbnails`
- Sizes: small, medium, large (auto-generated)

#### Webhook Infrastructure (Existing)

**Database Model:** `GraphSubscription`

```prisma
model GraphSubscription {
  id                  String   @id @default(uuid())
  subscriptionId      String   @unique  // Graph subscription ID
  resource            String              // e.g., /me/drive/root
  changeTypes         String              // created,updated,deleted
  notificationUrl     String
  clientState         String              // Validation token
  expirationDateTime  DateTime
  isActive            Boolean  @default(true)
}
```

**Webhook Endpoint:** `POST /webhooks/graph`

- Validates subscription setup (returns validationToken)
- Processes change notifications
- Routes: email → processEmailNotification(), files → processFileNotification()

**Current File Change Handler:**

```typescript
// On 'updated': Creates audit log, syncs on next access
// On 'deleted': Archives document, clears OneDrive reference
```

**Missing for Real-Time:**

1. No WebSocket push to frontend
2. No immediate version creation on change
3. No user notification mechanism

---

### 5. WebSocket Architecture

#### Current State

**bojin-law-ui:**

- Apollo Client HTTP-only (no subscription link)
- No `graphql-ws` or `subscriptions-transport-ws` installed
- No WebSocket proxy in next.config.js

**bojin-law-2 Gateway:**

- Email subscriptions implemented with in-memory PubSub
- Events: `EMAIL_RECEIVED`, `EMAIL_SYNC_PROGRESS`, `EMAIL_CATEGORIZED`
- Task subscriptions scaffolded but not functional
- **No WebSocket protocol handler** configured in Apollo Server

**Packages Available:**

- `graphql-subscriptions` v3.0.0 (installed)
- `ioredis` v5.8.2 (available for Redis PubSub)

#### Recommended Architecture

**Option: Production-Grade (Redis + graphql-ws)**

```
┌─────────────────────────────────────────────────────────────────┐
│                        bojin-law-ui                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Apollo Client                         │  │
│  │  ┌───────────────┐    ┌───────────────────────────────┐  │  │
│  │  │  HTTP Link    │    │  WebSocket Link (graphql-ws)  │  │  │
│  │  │ (query/mut)   │    │  (subscriptions)              │  │  │
│  │  └───────┬───────┘    └───────────────┬───────────────┘  │  │
│  └──────────┼────────────────────────────┼──────────────────┘  │
└─────────────┼────────────────────────────┼──────────────────────┘
              │                            │
              │ HTTP                       │ WebSocket
              ▼                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GraphQL Gateway                              │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │ Apollo Server│  │ graphql-ws      │  │ Redis PubSub     │   │
│  │ (HTTP)       │  │ (WebSocket)     │  │ Adapter          │   │
│  └──────┬───────┘  └────────┬────────┘  └────────┬─────────┘   │
│         │                   │                    │             │
│         │                   │                    │             │
│         └───────────────────┴────────────────────┘             │
│                             │                                   │
│                      Webhook Handler ◄─── Microsoft Graph       │
│                             │                                   │
│                      Publish Events                            │
│                             │                                   │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────┐
                    │    Redis     │
                    │ (Pub/Sub)    │
                    └──────────────┘
```

**Implementation Steps:**

1. **Gateway Changes:**
   - Add `graphql-ws` package
   - Configure WebSocket protocol in Apollo Server
   - Replace in-memory PubSub with Redis adapter
   - Add document change events and subscriptions

2. **Frontend Changes:**
   - Add `graphql-ws` and `@apollo/client/link/subscriptions`
   - Create split link (HTTP for query/mutation, WS for subscription)
   - Add WebSocket proxy rewrite in next.config.js

**GraphQL Subscriptions to Add:**

```graphql
type Subscription {
  documentChanged(caseId: UUID!): DocumentChangeEvent!
  documentStatusChanged(documentId: UUID!): Document!
  reviewAssigned(userId: UUID!): DocumentForReview!
}

type DocumentChangeEvent {
  type: DocumentChangeType! # CREATED | UPDATED | DELETED | SYNCED
  document: Document
  documentId: UUID!
  caseId: UUID!
  timestamp: DateTime!
  triggeredBy: String # 'user' | 'webhook' | 'system'
}
```

---

### 6. Review Workflow

#### Status Flow

```
DRAFT
  │
  ├─► submitForReview() ─► IN_REVIEW
  │                           │
  │   withdrawFromReview() ◄──┤
  │                           │
  │   ┌───────────────────────┴───────────────────────┐
  │   │                                               │
  │   ▼                                               ▼
  │ FINAL ◄── reviewDocument(APPROVE) ── reviewDocument(REQUEST_CHANGES) ─► CHANGES_REQUESTED
  │   │                                               │
  │   │                                               │
  │   ▼                                               │ (resubmit)
  │ ARCHIVED                                          └─────► IN_REVIEW
  │
  └─► updateStatus(ARCHIVED) ─► ARCHIVED
```

#### Metadata Tracked

```typescript
// On submit
{
  reviewerId: string;
  submittedAt: DateTime;
  reviewSubmissionMessage?: string;
  submittedBy: string;
  submittedByEmail: string;
  submittedByName: string;
}

// On review decision
{
  lastReviewDecision: 'APPROVE' | 'REQUEST_CHANGES';
  lastReviewComment: string;
  lastReviewedAt: DateTime;
  lastReviewedBy: string;
  changesAssignedTo?: string;
  changesAssignedToName?: string;
}

// On withdraw
{
  withdrawnAt: DateTime;
  withdrawnBy: string;
}
```

#### Authorization Rules

- **Submit**: Any user with case access
- **Review**: Only assigned reviewer OR Partner
- **Withdraw**: Original submitter OR Partner/BusinessOwner
- **See Review Queue**: Partner or Senior Associate only

---

### 7. bojin-law-ui Patterns to Follow

#### Store Pattern (Zustand)

```typescript
export const useDocumentsStore = create<State>()(
  persist(
    (set) => ({
      viewMode: 'grid',
      activeTab: 'working',
      searchQuery: '',
      previewDocumentId: null,

      setViewMode: (mode) => set({ viewMode: mode }),
      setPreviewDocument: (id) => set({ previewDocumentId: id }),
      clearFilters: () => set({ searchQuery: '', statusFilter: 'all' }),
    }),
    {
      name: 'documents-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ viewMode: state.viewMode, activeTab: state.activeTab }),
    }
  )
);
```

#### Component Pattern

```typescript
'use client';

import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { FileIcon } from 'lucide-react';

interface Props {
  document: Document;
  onClose: () => void;
}

export function DocumentPreviewModal({ document, onClose }: Props) {
  // Use Radix Dialog, Lucide icons, cn() for classes
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent size="xl">
        {/* Progressive preview content */}
      </DialogContent>
    </Dialog>
  );
}
```

#### GraphQL Query Pattern

```typescript
export const GET_DOCUMENT_PREVIEW_URL = gql`
  query GetDocumentPreviewUrl($documentId: UUID!) {
    documentPreviewUrl(documentId: $documentId) {
      url
      source
      expiresAt
      syncResult {
        synced
        newVersionNumber
      }
    }
  }
`;
```

---

## Implementation Recommendation

### Phase 1: Foundation (Core Preview)

**Scope:**

- Port DocumentPreviewModal with progressive loading
- Port PDFViewer component
- Add preview URL queries
- Implement thumbnail-first loading
- Basic document actions (download, rename)

**Dependencies to Add:**

```json
{
  "react-pdf": "^9.2.1",
  "pdfjs-dist": "^4.0.0"
}
```

**New Files:**

- `src/components/documents/DocumentPreviewModal.tsx`
- `src/components/documents/PDFViewer.tsx`
- `src/hooks/useDocumentPreview.ts`

### Phase 2: Review Workflow

**Scope:**

- Review queue tab in documents view
- Submit for review action
- Review decision modal
- Reviewer picker (supervisors query)
- Status badge updates

**New Components:**

- `src/components/documents/ReviewQueue.tsx`
- `src/components/documents/SubmitForReviewDialog.tsx`
- `src/components/documents/ReviewDecisionDialog.tsx`
- `src/components/documents/ReviewerPicker.tsx`

### Phase 3: Real-Time Sync

**Scope:**

- WebSocket infrastructure (gateway + frontend)
- Document change subscriptions
- Toast notifications for external changes
- Version sync indicator

**Gateway Changes:**

- Add graphql-ws to gateway
- Replace in-memory PubSub with Redis
- Add document subscription resolvers
- Connect webhook handler to PubSub

**Frontend Changes:**

- Add WebSocket subscription link
- Create useDocumentSubscription hook
- Add change notification toasts

### Phase 4: Advanced Preview (Optional)

**Scope:**

- Client-side Word preview (docx-preview)
- Client-side Excel preview (xlsx)
- Complexity detection for fallback
- Prefetch adjacent pages in PDFs

**Dependencies (Phase 4 only):**

```json
{
  "docx-preview": "^0.3.0",
  "xlsx": "^0.18.5"
}
```

---

## File Plan

| File                                                 | Action | Purpose                    | Phase |
| ---------------------------------------------------- | ------ | -------------------------- | ----- |
| `package.json`                                       | Modify | Add react-pdf              | 1     |
| `src/components/documents/DocumentPreviewModal.tsx`  | Create | Progressive preview modal  | 1     |
| `src/components/documents/PDFViewer.tsx`             | Create | PDF rendering              | 1     |
| `src/hooks/useDocumentPreview.ts`                    | Create | Preview state/URL fetching | 1     |
| `src/graphql/queries.ts`                             | Modify | Add preview queries        | 1     |
| `src/components/documents/DocumentCard.tsx`          | Modify | Add preview action         | 1     |
| `src/components/documents/ReviewQueue.tsx`           | Create | Review queue view          | 2     |
| `src/components/documents/SubmitForReviewDialog.tsx` | Create | Submit dialog              | 2     |
| `src/components/documents/ReviewDecisionDialog.tsx`  | Create | Review dialog              | 2     |
| `src/lib/apollo-client.ts`                           | Modify | Add WebSocket link         | 3     |
| `next.config.js`                                     | Modify | Add WS proxy               | 3     |
| `src/hooks/useDocumentSubscription.ts`               | Create | Real-time updates          | 3     |
| `src/graphql/subscriptions.ts`                       | Create | Subscription definitions   | 3     |

---

## Risks

| Risk                                | Impact                    | Mitigation                                   |
| ----------------------------------- | ------------------------- | -------------------------------------------- |
| react-pdf bundle size (~2MB)        | Slow initial load         | Lazy load with Suspense, code split          |
| Office Online iframe latency        | Poor UX for first preview | Progressive thumbnail loading                |
| WebSocket connection stability      | Missed updates            | Reconnection logic, polling fallback         |
| Graph webhook delivery delays       | Stale UI                  | Show "last synced" timestamp, manual refresh |
| Complex Word docs break client-side | Rendering errors          | Fallback detection, Office Online fallback   |
| Redis PubSub scaling                | Message loss at scale     | Consider dedicated pub/sub service later     |

---

## Open Questions (Resolved)

| Question                  | Answer                                        |
| ------------------------- | --------------------------------------------- |
| Which PDF library?        | react-pdf (already used in bojin-law-2)       |
| Client-side Word preview? | Optional Phase 4, with Office Online fallback |
| WebSocket auth?           | Pass MSAL token in connection params          |
| Multi-instance scaling?   | Redis PubSub adapter (ioredis available)      |
| Thumbnail generation?     | Existing R2 + BullMQ worker in gateway        |

---

## Next Step

Start a new session and run:

```
/plan research-documents
```

This will create a detailed implementation plan with file-by-file changes and step-by-step instructions.
