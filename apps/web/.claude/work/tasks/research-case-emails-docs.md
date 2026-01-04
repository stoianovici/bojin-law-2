# Research: Emails & Documents in Case Detail

**Status**: Complete
**Date**: 2026-01-02
**Input**: `brainstorm-case-emails-docs.md`
**Next step**: `/plan research-case-emails-docs`

---

## Context Summary

**Project**: bojin-law-ui - AI-powered legal case management UI
**Tech Stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Apollo Client (GraphQL), Radix UI
**Design System**: Superhuman-inspired dark theme
**Backend**: GraphQL gateway at localhost:4000

**Goal**: Add emails and documents as tabs within the mobile case detail view, with:

- Sticky case info card at top
- Horizontal tabs: Taskuri | Emails | Documente
- Expandable email items with AI reply
- Inline document preview
- Search FAB

---

## Problem Statement

Lawyers need to access case-related emails and documents from mobile. The case detail page currently has tabs for Taskuri, Documente, Note, and Istoric, but only Taskuri is implemented. We need to build out the Emails and Documents tabs following the brainstorm decisions.

---

## Research Findings

### 1. Current Case Detail Page Structure

**File**: `src/app/m/cases/[id]/page.tsx`

**Architecture**:

- Next.js 16 App Router with `'use client'`
- Data fetching via Apollo hooks
- State management with React useState
- Tailwind CSS with design tokens

**Current Layout** (top to bottom):

1. Header (back button, case title, more menu)
2. Case Info Section (type, client, responsible)
3. Tab Navigation (4 tabs defined, only Taskuri implemented)
4. Tab Content Area
5. Fixed Bottom Action Bar

**Existing Tab Implementation**:

```typescript
type TabId = 'taskuri' | 'documente' | 'note' | 'istoric';
const [activeTab, setActiveTab] = useState<TabId>('taskuri');

// Tab buttons use conditional styling:
// Active: bg-mobile-bg-elevated text-mobile-text-primary
// Inactive: text-mobile-text-tertiary
```

**Placeholder tabs at lines 319-341** need implementation.

### 2. GraphQL Data Structures

#### Email Types (from `src/types/email.ts`)

**EmailThread** (for list view):

```typescript
{
  id: string
  conversationId: string
  subject: string
  case: { id, title, caseNumber } | null
  participantCount: number
  emails: EmailMessage[]
  lastMessageDate: string
  hasUnread: boolean
  hasAttachments: boolean
  messageCount: number
}
```

**EmailMessage** (for expanded view):

```typescript
{
  id: string
  subject: string
  bodyContent: string
  bodyContentClean?: string
  bodyContentType: 'html' | 'text'
  from: { name, address }
  toRecipients: { name, address }[]
  sentDateTime: string
  receivedDateTime: string
  attachments: Attachment[]
  isRead: boolean
  hasAttachments: boolean
}
```

**ThreadPreview** (lightweight for lists):

```typescript
{
  (id, conversationId, subject);
  (lastMessageDate, lastSenderName, lastSenderEmail);
  preview: string; // truncated body
  (isUnread, hasAttachments, messageCount);
}
```

#### Document Types (from `src/types/document.ts`)

**Document**:

```typescript
{
  id: string
  fileName: string
  fileType: 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'image' | 'other'
  fileSize: number
  status: 'DRAFT' | 'PENDING' | 'FINAL' | 'ARCHIVED'
  sourceType: 'UPLOAD' | 'EMAIL_ATTACHMENT' | 'AI_GENERATED' | 'TEMPLATE'
  uploadedBy: { id, firstName, lastName, initials }
  uploadedAt: string
  thumbnailUrl?: string
  downloadUrl?: string
}
```

### 3. Existing GraphQL Queries

| Query                      | Hook                 | File                              |
| -------------------------- | -------------------- | --------------------------------- |
| `GET_EMAILS_BY_CASE`       | `useEmailsByCase`    | `src/hooks/useEmailsByCase.ts`    |
| `GET_EMAIL_THREAD`         | —                    | `src/graphql/queries.ts:401-479`  |
| `GET_CASE_DOCUMENTS`       | `useCaseDocuments`   | `src/hooks/useDocuments.ts`       |
| `GET_DOCUMENT_PREVIEW_URL` | `useDocumentPreview` | `src/hooks/useDocumentPreview.ts` |

**Email Query Returns**:

- `cases[]` - threads organized by case
- `unassignedCase` - unassigned threads
- `courtEmails[]` - court system emails
- `uncertainEmails[]` - unclassified with AI suggestions
- Supports pagination: `limit`, `offset`

**Document Query Returns**:

- `caseDocuments[]` with document metadata
- `isOriginal` flag for primary documents

### 4. Existing Mutations for Actions

**Email Actions**:

- `REPLY_TO_EMAIL` - Send reply
- `GENERATE_AI_REPLY` - AI draft with tone selection
- `GENERATE_QUICK_REPLY` - Quick AI reply
- `MARK_AS_READ` - Mark email read

**Document Actions**:

- `GET_DOCUMENT_DOWNLOAD_URL` - Get download link
- `GET_DOCUMENT_PREVIEW_URL` - Get preview URL

### 5. Reusable UI Patterns

#### Accordion Pattern (from `src/components/email/CaseAccordion.tsx`)

```tsx
<div onClick={onToggle} className="cursor-pointer hover:bg-linear-bg-hover">
  <ChevronDown className={isExpanded ? '' : 'rotate-180'} />
  <Icon />
  <Title />
  <Badge count={threadCount} />
</div>;
{
  isExpanded && children;
}
```

#### List Item Pattern (Mobile)

```tsx
<div className="flex items-start gap-3 py-4 -mx-6 px-6 border-b border-[#1f1f1f]">
  <div className="w-10 h-10 rounded-[10px] bg-mobile-bg-card border flex-shrink-0">
    <Icon />
  </div>
  <div className="flex-1 min-w-0">
    <p className="text-[15px] font-medium">{title}</p>
    <p className="text-[13px] text-mobile-text-secondary">{meta}</p>
  </div>
</div>
```

#### Section Header Pattern

```tsx
<div className="flex items-center justify-between mb-4">
  <span className="text-[11px] uppercase tracking-[0.1em] text-mobile-text-tertiary">
    SECTION LABEL
  </span>
  <span className="text-[12px] bg-mobile-bg-elevated px-2 py-0.5 rounded-[10px]">{count}</span>
</div>
```

#### Skeleton Pattern (from `src/components/mobile/skeletons/`)

```tsx
<div className="animate-pulse flex items-start gap-3">
  <div className="h-10 w-10 bg-[#2a2a2a] rounded-lg" />
  <div className="flex-1 space-y-2">
    <div className="h-4 bg-[#2a2a2a] rounded w-4/5" />
    <div className="h-3 bg-[#2a2a2a] rounded w-2/3" />
  </div>
</div>
```

### 6. Document Preview Infrastructure

**Already Implemented**:

- `src/components/documents/DocumentPreviewModal.tsx` - Modal wrapper
- `src/components/documents/PDFViewer.tsx` - Custom PDF viewer with zoom/page controls
- Uses `react-pdf` (v9.2.1) with pdfjs-dist (v4.0.0)
- Supports: PDF, images, text files, Office documents (via iframe)

**Hook**: `useDocumentPreview` manages preview state with:

- `previewUrl` - URL to preview
- `previewMethod`: `'pdf' | 'image' | 'iframe' | 'text' | 'unsupported'`
- `isLoading`, `error` states

**Mobile Enhancement Needed**:

- Add touch gestures (pinch-to-zoom, swipe pages)
- Add "fit to screen" option
- Test on actual mobile devices

### 7. Design Tokens

**Colors**:

```
Backgrounds: #0a0a0a → #141414 → #1a1a1a → #242424
Text: #fafafa → #a1a1a1 → #6b6b6b
Borders: #2a2a2a (default), #1f1f1f (subtle)
Accent: #3b82f6 (blue), #f59e0b (warning), #22c55e (success)
```

**Typography**:

```
Header: 17px, font-semibold, tracking-[-0.02em]
Item title: 15px, font-medium, tracking-[-0.01em]
Meta: 13px, font-normal
Section: 11px, uppercase, tracking-[0.1em]
```

**Spacing**:

```
Content padding: Always px-6 (24px)
Item padding: py-4
Gaps: gap-3
```

### 8. Timestamp Formatting

**Pattern from codebase** (`ThreadItem.tsx`, `UncertainEmailItem.tsx`):

```typescript
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'ieri';
  } else if (diffDays < 7) {
    return `${diffDays} zile`;
  } else {
    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
  }
}
```

### 9. What Doesn't Exist (Needs Creation)

- **Mobile email list component** for case emails
- **Mobile email expanded view** with reply actions
- **Mobile document list component** for case documents
- **Search FAB component** for mobile
- **Mobile hooks** in `src/hooks/mobile/` for emails and documents
- **Swipe gesture** support for tabs (optional enhancement)
- **Virtualization** for long lists (50+ items)

---

## Implementation Recommendation

### Approach: Extend Existing Case Detail Page

Rather than creating new routes, extend `src/app/m/cases/[id]/page.tsx` to:

1. Add email and document data fetching
2. Implement the Emails tab content
3. Implement the Documente tab content
4. Add search FAB overlay

### Component Architecture

```
src/app/m/cases/[id]/page.tsx (modify)
├── Add useEmailsByCase hook
├── Add useCaseDocuments hook
├── Emails tab content
│   ├── EmailListItem (new component)
│   └── ExpandedEmail (new component with AI reply)
└── Documents tab content
    ├── DocumentListItem (new component)
    └── DocumentPreview (reuse existing modal)

src/components/mobile/ (new files)
├── EmailListItem.tsx
├── ExpandedEmail.tsx
├── DocumentListItem.tsx
├── SearchFAB.tsx
└── skeletons/EmailCardSkeleton.tsx
```

---

## File Plan

| File                                                       | Action | Purpose                             |
| ---------------------------------------------------------- | ------ | ----------------------------------- |
| `src/app/m/cases/[id]/page.tsx`                            | Modify | Add email/doc hooks, implement tabs |
| `src/components/mobile/EmailListItem.tsx`                  | Create | Email thread list item for mobile   |
| `src/components/mobile/ExpandedEmail.tsx`                  | Create | Expanded email with actions         |
| `src/components/mobile/DocumentListItem.tsx`               | Create | Document list item for mobile       |
| `src/components/mobile/SearchFAB.tsx`                      | Create | Floating search button              |
| `src/components/mobile/skeletons/EmailCardSkeleton.tsx`    | Create | Loading state                       |
| `src/components/mobile/skeletons/DocumentCardSkeleton.tsx` | Create | Loading state                       |
| `src/hooks/mobile/useEmailsByCase.ts`                      | Create | Mobile-specific email hook          |
| `src/hooks/mobile/index.ts`                                | Modify | Export new hooks                    |

---

## Risks

1. **Performance with 50+ items**: Need virtualization or pagination
   - Mitigation: Use `limit/offset` from GraphQL, implement load more

2. **Document preview on mobile**: PDF viewer may be heavy
   - Mitigation: Lazy load PDFViewer, use thumbnails in list

3. **AI Reply latency**: GENERATE_AI_REPLY may be slow
   - Mitigation: Show loading state, optimistic UI

4. **Swipe gestures conflict**: Tab swiping vs page scrolling
   - Mitigation: Start without swipe, add later if needed

---

## Next Step

Start a new session and run:

```
/plan research-case-emails-docs
```
