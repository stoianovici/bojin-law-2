# Plan: Documents Preview Feature (Phase 1)

**Status**: Approved
**Date**: 2025-12-29
**Input**: `research-documents.md`
**Next step**: `/implement plan-documents`

---

## Context Summary

- **Project**: `/Users/mio/Developer/bojin-law-ui`
- **Tech Stack**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Apollo Client 4.x, MSAL auth, Zustand state
- **Reference**: `/Users/mio/Developer/bojin-law-2` - existing document management implementation
- **UI Pattern**: Radix UI primitives, Lucide icons, `cn()` utility for classes, Linear-inspired dark theme

## Approach Summary

Build a progressive document preview system that shows thumbnails instantly (<100ms), loads large thumbnails (<500ms), then renders full previews (1-5s). Support PDFs via react-pdf, images via native rendering, and Office docs via Office Online iframe. Port proven patterns from bojin-law-2 with improvements for progressive loading.

---

## Parallel Group 1

> These 3 tasks run simultaneously via sub-agents (no file conflicts)

### Task 1.1: Create PDFViewer Component

- **File**: `src/components/documents/PDFViewer.tsx` (CREATE)
- **Do**:
  - Port from `bojin-law-2/apps/web/src/components/preview/PDFViewer.tsx` (lines 43-213)
  - Use `react-pdf` with lazy loading via `React.lazy()` and Suspense
  - Include zoom controls (+/- buttons, fit-to-width)
  - Include page navigation (prev/next, page number input)
  - Configure PDF.js worker from CDN: `pdfjs.GlobalWorkerOptions.workerSrc`
  - Style with Tailwind, use Lucide icons (ZoomIn, ZoomOut, ChevronLeft, ChevronRight)
  - Handle loading states with skeleton
- **Done when**: Component accepts `url: string` prop and renders PDF with zoom/page controls

### Task 1.2: Create useDocumentPreview Hook

- **File**: `src/hooks/useDocumentPreview.ts` (CREATE)
- **Do**:
  - Port from `bojin-law-2/apps/web/src/hooks/useDocumentPreview.ts` (lines 156-342)
  - Manage preview phases: `'thumbnail' | 'largeThumbnail' | 'fullPreview'`
  - Use Apollo `useLazyQuery` for preview URL fetching
  - Track state: `{ phase, thumbnailUrl, previewUrl, error, isLoading }`
  - Implement `openPreview(document)` and `closePreview()` functions
  - Determine preview method based on file type:
    - PDF → react-pdf viewer
    - Images (jpeg, png, gif, webp) → native img tag
    - Office (docx, xlsx, pptx) → Office Online iframe
    - Text (txt, json, csv, html, css, js) → pre element
  - Return `{ phase, previewUrl, previewMethod, isLoading, error, openPreview, closePreview }`
- **Done when**: Hook manages progressive loading state and returns preview URLs

### Task 1.3: Add GraphQL Preview Queries

- **File**: `src/graphql/queries.ts` (MODIFY)
- **Do**:
  - Add `GET_DOCUMENT_PREVIEW_URL` query:
    ```graphql
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
    ```
  - Add `GET_DOCUMENT_DOWNLOAD_URL` query:
    ```graphql
    query GetDocumentDownloadUrl($documentId: UUID!) {
      getDocumentDownloadUrl(documentId: $documentId)
    }
    ```
  - Add `GET_DOCUMENT_TEXT_CONTENT` query:
    ```graphql
    query GetDocumentTextContent($documentId: UUID!) {
      documentTextContent(documentId: $documentId)
    }
    ```
- **Done when**: Queries added, match gateway schema from research doc

---

## Parallel Group 2

> This task depends on Group 1 completing first

### Task 2.1: Create DocumentPreviewModal

- **File**: `src/components/documents/DocumentPreviewModal.tsx` (CREATE)
- **Depends on**: Task 1.1, 1.2, 1.3
- **Do**:
  - Port from `bojin-law-2/apps/web/src/components/preview/DocumentPreviewModal.tsx` (lines 301-823)
  - Use Radix `Dialog` from `@/components/ui/Dialog`
  - Implement three-phase progressive loading:
    1. **Phase 1 (<100ms)**: Show `thumbnailMedium` (200x200), file metadata, skeleton for preview area
    2. **Phase 2 (<500ms)**: Crossfade to `thumbnailLarge` (800x800), show "Loading preview..."
    3. **Phase 3 (1-5s)**: Render full preview based on file type
  - Include action toolbar with buttons:
    - Download (use `GET_DOCUMENT_DOWNLOAD_URL`)
    - Open in new tab
    - Copy link
    - Close (X button)
  - Handle preview methods:
    - `pdf`: Render `<PDFViewer url={previewUrl} />`
    - `image`: Render `<img src={previewUrl} />`
    - `office`: Render `<iframe src={previewUrl} />` (Office Online)
    - `text`: Render `<pre>{textContent}</pre>`
  - Show error state if preview fails
  - Props: `document: Document`, `onClose: () => void`
- **Done when**: Modal opens with progressive loading, renders all supported file types

---

## Sequential: After Group 2

### Task 3: Wire Preview into Existing Components

- **Depends on**: Task 2.1
- **Files**:
  - `src/components/documents/DocumentCard.tsx` (MODIFY)
  - `src/components/documents/DocumentListItem.tsx` (MODIFY)
  - `src/store/documentsStore.ts` (MODIFY)
  - `src/components/documents/DocumentsContentPanel.tsx` (MODIFY)
- **Do**:
  - In `documentsStore.ts`: Ensure `previewDocumentId` and `setPreviewDocument` exist (may already be there)
  - In `DocumentCard.tsx`: Add click handler to call `setPreviewDocument(document.id)`
  - In `DocumentListItem.tsx`: Add click handler to call `setPreviewDocument(document.id)`
  - In `DocumentsContentPanel.tsx`:
    - Import `DocumentPreviewModal`
    - Get `previewDocumentId` from store
    - Find document by ID from current documents list
    - Render `<DocumentPreviewModal document={doc} onClose={() => setPreviewDocument(null)} />` when `previewDocumentId` is set
- **Done when**: Clicking any document card/list item opens preview modal

---

## Final Steps (Sequential)

### Task 4: Add Dependencies and Verify Build

- **File**: `package.json` (MODIFY)
- **Do**:
  - Add dependencies:
    ```json
    "react-pdf": "^9.2.1",
    "pdfjs-dist": "^4.0.0"
    ```
  - Run `pnpm install`
  - Run `pnpm build` to verify no TypeScript errors
  - Run `pnpm dev` to verify preview works end-to-end
- **Done when**: Dependencies installed, build passes, preview modal works in dev

---

## Session Scope Assessment

- **Total tasks**: 6
- **Estimated complexity**: Medium
- **Parallel groups**: 2 (3 tasks + 1 task)
- **Sequential tasks**: 2
- **Checkpoint recommended at**: After Task 2.1 (modal complete)

## Key Patterns to Follow

### File Type Detection

```typescript
const OFFICE_TYPES = ['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt'];
const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
const TEXT_TYPES = ['txt', 'json', 'csv', 'html', 'css', 'js', 'ts', 'md'];

function getPreviewMethod(fileType: string): 'pdf' | 'image' | 'office' | 'text' | 'unsupported' {
  if (fileType === 'pdf') return 'pdf';
  if (IMAGE_TYPES.includes(fileType)) return 'image';
  if (OFFICE_TYPES.includes(fileType)) return 'office';
  if (TEXT_TYPES.includes(fileType)) return 'text';
  return 'unsupported';
}
```

### Progressive Loading State

```typescript
type PreviewPhase = 'thumbnail' | 'largeThumbnail' | 'fullPreview';

interface PreviewState {
  phase: PreviewPhase;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  previewMethod: 'pdf' | 'image' | 'office' | 'text' | 'unsupported';
  isLoading: boolean;
  error: Error | null;
}
```

### Component Import Pattern

```typescript
'use client';

import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Download, ExternalLink, X } from 'lucide-react';
```

---

## Next Step

Start a new session and run:

```
/implement plan-documents
```
