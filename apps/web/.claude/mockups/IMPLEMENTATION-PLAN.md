# Documents Feature - Implementation Plan

## Overview

This document outlines the implementation plan for adapting the `/documents` feature from `bojin-law-2` to `bojin-law-ui`. The feature provides a comprehensive document management system with **Mapa (document binder)** organization, multiple view modes, document preview, and workflow management.

### Key Concept: Mapa (Document Binder)

Unlike simple folders, **Mapa** (plural: **Mape**) is a structured document binder with:

- **Slot-based organization**: Predefined slots for specific document types
- **Completion tracking**: Real-time metrics on filled vs. required slots
- **Templates**: Reusable firm-level templates for common case types
- **Legal compliance**: Designed for court submission requirements
- **Assignment workflow**: Documents are explicitly assigned to slots

## HTML Mockups Created

### Document Management

1. **`documents-main.html`** - Main page with grid view (two-column layout)
2. **`documents-list-view.html`** - List view with bulk selection and actions
3. **`document-preview-modal.html`** - Full-screen document preview with details panel
4. **`document-modals.html`** - Upload, delete, rename, submit for review modals

### Mapa (Document Binder) System

5. **`mapa-detail.html`** - Mapa detail view with slots, completion ring, categories
6. **`mapa-list-and-modals.html`** - Mapa grid, create mapa, assign document, add slot modals

Open these files in a browser to preview the designs.

---

## Architecture Summary

### Page Structure

```
/documents
├── Two-column layout
│   ├── Left Sidebar (280px): Mape list + unassigned documents
│   └── Right Content: Mapa detail OR document grid/list
├── Query params: ?case={caseId}&mapa={mapaId}
└── Views: Mapa Detail | All Documents | Unassigned
```

### Key Components to Build

#### Document Components

| Component               | Description                  | Priority |
| ----------------------- | ---------------------------- | -------- |
| `DocumentsPage`         | Main page container          | High     |
| `DocumentsSidebar`      | Mape list + navigation       | High     |
| `DocumentsContentPanel` | Document grid/list display   | High     |
| `DocumentCard`          | Grid card component          | High     |
| `DocumentListItem`      | List row component           | High     |
| `DocumentPreviewModal`  | Full-screen preview          | Medium   |
| `DocumentUploadModal`   | Upload dialog with drop zone | High     |

#### Mapa Components

| Component               | Description                       | Priority |
| ----------------------- | --------------------------------- | -------- |
| `MapaList`              | Grid of mapa cards for a case     | High     |
| `MapaCard`              | Mapa summary with completion ring | High     |
| `MapaDetail`            | Full mapa view with slots         | High     |
| `MapaSlotItem`          | Individual slot row               | High     |
| `MapaCompletionRing`    | Circular progress indicator       | Medium   |
| `CreateMapaModal`       | Create mapa from template         | High     |
| `AssignDocumentModal`   | Assign document to slot           | High     |
| `AddSlotModal`          | Add/edit slot dialog              | Medium   |
| `MapaCompletionSummary` | Pre-print/finalize check          | Low      |

---

## Implementation Phases

### Phase 1: Core Page Structure

**Files to create:**

```
src/app/(dashboard)/documents/
├── page.tsx          # Main documents page
└── layout.tsx        # Documents-specific layout (optional)

src/components/documents/
├── index.ts          # Re-exports
├── DocumentsSidebar.tsx
├── DocumentsContentPanel.tsx
├── DocumentCard.tsx
├── DocumentListItem.tsx
├── DocumentGrid.tsx
└── DocumentSearchBar.tsx
```

**Key features:**

- Two-column responsive layout
- Sidebar with collapsible case/folder tree
- Grid/list view toggle
- Search bar with debouncing
- Tab navigation (Working Documents, Correspondence, Review Queue)

### Phase 2: State Management

**Store to create:**

```
src/store/documentsStore.ts
```

**State shape:**

```typescript
interface DocumentsState {
  // Navigation
  selectedCaseId: string | null;
  selectedFolderId: string | null;

  // View preferences
  viewMode: 'grid' | 'list';
  activeTab: 'working' | 'correspondence' | 'review';

  // Filters
  searchQuery: string;
  statusFilter: DocumentStatus | 'all';
  typeFilter: string | 'all';

  // Selection
  selectedDocumentIds: string[];

  // UI state
  expandedCases: string[];
  expandedFolders: string[];

  // Actions
  setSelectedCase: (caseId: string | null) => void;
  setSelectedFolder: (folderId: string | null) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setActiveTab: (tab: 'working' | 'correspondence' | 'review') => void;
  setSearchQuery: (query: string) => void;
  toggleDocumentSelection: (documentId: string) => void;
  clearSelection: () => void;
  // ... more actions
}
```

### Phase 3: Data Types

**Types to create:**

```
src/types/document.ts
src/types/mapa.ts
```

```typescript
// ==========================================
// DOCUMENT TYPES (src/types/document.ts)
// ==========================================

// Document status
type DocumentStatus = 'DRAFT' | 'PENDING' | 'FINAL' | 'ARCHIVED';

// Document source
type DocumentSource = 'UPLOAD' | 'EMAIL_ATTACHMENT' | 'AI_GENERATED' | 'TEMPLATE';

// Document type
interface Document {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: DocumentStatus;
  sourceType: DocumentSource;
  uploadedBy: User;
  uploadedAt: string;
  caseId: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  versionCount: number;
  metadata?: Record<string, unknown>;
  // Slot assignment (if assigned to a mapa)
  assignedToSlotId?: string;
}

// ==========================================
// MAPA TYPES (src/types/mapa.ts)
// ==========================================

// Mapa (Document Binder)
interface Mapa {
  id: string;
  caseId: string;
  name: string;
  description?: string;
  templateId?: string;
  createdBy: User;
  createdAt: string;
  updatedAt: string;
  slots: MapaSlot[];
  completionStatus: MapaCompletionStatus;
}

// Mapa Slot
interface MapaSlot {
  id: string;
  mapaId: string;
  name: string;
  description?: string;
  category: string;
  required: boolean;
  order: number;
  // Assigned document (if filled)
  document?: Document;
  assignedAt?: string;
  assignedBy?: User;
}

// Completion tracking
interface MapaCompletionStatus {
  totalSlots: number;
  filledSlots: number;
  requiredSlots: number;
  filledRequiredSlots: number;
  isComplete: boolean;
  missingRequired: string[]; // slot names
  percentComplete: number;
}

// Mapa Template (firm-scoped)
interface MapaTemplate {
  id: string;
  firmId: string;
  name: string;
  description?: string;
  caseType?: string;
  slotDefinitions: SlotDefinition[];
  isActive: boolean;
  usageCount: number;
  createdBy: User;
}

// Slot definition for templates
interface SlotDefinition {
  name: string;
  description?: string;
  category: string;
  required: boolean;
  order: number;
}

// Case with mape
interface CaseWithMape {
  id: string;
  name: string;
  status: CaseStatus;
  documentCount: number;
  mape: Mapa[];
  unassignedDocumentCount: number;
}
```

### Phase 4: Mock Data

**File to create:**

```
src/lib/mock/documents.ts
```

Create realistic mock data for:

- 3-4 cases with documents
- Hierarchical folders per case
- 15-20 sample documents with various statuses
- User data for uploaders

### Phase 5: GraphQL Integration (if applicable)

**Queries:**

```graphql
query GetCaseFolderTree {
  cases {
    id
    name
    status
    documentCount
    folders {
      id
      name
      parentId
      documentCount
    }
  }
}

query GetDocuments($caseId: ID, $folderId: ID, $status: DocumentStatus) {
  documents(caseId: $caseId, folderId: $folderId, status: $status) {
    id
    fileName
    fileType
    fileSize
    status
    uploadedBy {
      id
      name
      initials
    }
    uploadedAt
    thumbnailUrl
  }
}
```

### Phase 6: Modals and Actions

**Modal components:**

```
src/components/documents/
├── modals/
│   ├── DocumentUploadModal.tsx
│   ├── CreateFolderModal.tsx
│   ├── MoveDocumentModal.tsx
│   ├── DeleteDocumentDialog.tsx
│   ├── RenameDocumentDialog.tsx
│   └── SubmitForReviewModal.tsx
```

**Features:**

- Drag-and-drop file upload
- Progress tracking
- Folder tree selection
- Confirmation dialogs
- Form validation

### Phase 7: Document Preview

**Component:**

```
src/components/documents/DocumentPreviewModal.tsx
```

**Features:**

- Full-screen modal overlay
- PDF/Image preview
- Document metadata panel
- Version history
- Action buttons (download, share, open in editor)
- Navigation between documents

---

## Component Specifications

### DocumentsSidebar

```tsx
interface DocumentsSidebarProps {
  cases: CaseWithDocuments[];
  selectedCaseId: string | null;
  selectedFolderId: string | null;
  onCaseSelect: (caseId: string) => void;
  onFolderSelect: (folderId: string) => void;
  onCreateFolder: () => void;
}
```

**Features:**

- Collapsible case sections
- Nested folder tree
- Document count badges
- Quick access shortcuts (Recent, Starred, My Uploads)
- Storage usage indicator

### DocumentCard

```tsx
interface DocumentCardProps {
  document: Document;
  isSelected?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  onPreview?: () => void;
  onMoreActions?: () => void;
}
```

**Features:**

- Thumbnail with file type icon fallback
- Status badge (Draft, In Review, Final)
- File metadata (size, date)
- Uploader avatar
- Hover actions

### DocumentListItem

```tsx
interface DocumentListItemProps {
  document: Document;
  isSelected?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  onMoreActions?: () => void;
}
```

**Features:**

- Checkbox for selection
- File icon with type color
- Name with folder breadcrumb
- Status badge
- Modified date with user
- File size
- Kebab menu on hover

---

## Styling Notes

The mockups follow the existing Linear Design System in `bojin-law-ui`:

- **Colors**: Use CSS variables (`--linear-*`)
- **Typography**: Inter font, sizes from 11px to 20px
- **Spacing**: 4px grid system
- **Border radius**: 4px - 12px
- **Shadows**: Subtle dark theme shadows
- **Animations**: 150ms transitions

---

## File Type Icons

Use color-coded icons for file types:

- **PDF**: Red (#EF4444)
- **DOCX**: Blue/Accent (#5E6AD2)
- **XLSX**: Green (#22C55E)
- **PPTX**: Orange (#F59E0B)
- **Images**: Purple
- **Other**: Gray

---

## Next Steps

1. Review the HTML mockups in a browser
2. Confirm the design direction
3. Start with Phase 1 (core page structure)
4. Iterate on each phase with testing

---

## Questions to Clarify

1. Should we use real GraphQL or mock data for initial implementation?
2. Are the Romanian legal terms (Acte procedurale, Dovezi, etc.) correct for your jurisdiction?
3. What mapa templates should be included by default?
4. Should documents be able to exist in multiple mape or only one at a time?
5. Is drag-and-drop reordering of slots required for MVP?
6. Should we implement the print view for mape?
7. Any integrations needed (OneDrive, SharePoint)?
8. Is the review workflow required for MVP?
