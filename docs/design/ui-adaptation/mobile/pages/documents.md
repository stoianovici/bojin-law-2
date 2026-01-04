# Mobile Documents Page

> Document browsing and management on mobile.

## 1. Documents List (All Documents)

### Layout

```
┌─────────────────────────────────────────────────┐
│ [safe area]                                     │
├─────────────────────────────────────────────────┤
│ Documente                              [🔍] [⋮] │
├─────────────────────────────────────────────────┤
│ [Ciornă] [Review (3)] [Final (2)]               │
├─────────────────────────────────────────────────┤
│                                                 │
│ ▼ ACEASTĂ SĂPTĂMÂNĂ                4 documente  │
│ ┌────────────────────┐ ┌────────────────────┐   │
│ │ [Preview]    [PDF] │ │ [Preview]   [DOCX] │   │
│ │ contract.pdf       │ │ cerere.docx        │   │
│ │ 2.1 MB             │ │ 512 KB             │   │
│ └────────────────────┘ └────────────────────┘   │
│ ┌────────────────────┐ ┌────────────────────┐   │
│ │ [Preview]    [PDF] │ │ [Preview]   [XLSX] │   │
│ │ anexa.pdf          │ │ calcul.xlsx        │   │
│ │ 1.8 MB             │ │ 256 KB             │   │
│ └────────────────────┘ └────────────────────┘   │
│                                                 │
│ ▼ DECEMBRIE 2024                   6 documente  │
│ ┌────────────────────┐ ┌────────────────────┐   │
│ │ [Preview]    [PDF] │ │ [Preview]    [IMG] │   │
│ │ document.pdf       │ │ foto.jpg           │   │
│ └────────────────────┘ └────────────────────┘   │
│                                                 │
│ ▶ NOIEMBRIE 2024                   12 documente │
│                                                 │
│                      [+]                        │ ← FAB (Upload)
├─────────────────────────────────────────────────┤
│  🏠      📁      ✓      📄      ✉️           │
└─────────────────────────────────────────────────┘
```

### Components

#### Header

```css
.docs-header {
  background: var(--bg-secondary);
  padding: 16px;
  padding-top: calc(16px + var(--safe-area-top));
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle);
}

.docs-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
}
```

#### Status Toggle

Segmented control for document status.

```css
.status-toggle {
  display: flex;
  padding: 12px 16px;
  gap: 0;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-subtle);
}

.status-btn {
  flex: 1;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  color: var(--text-tertiary);
  font-size: 13px;
  font-weight: 500;
  text-align: center;
}

.status-btn:first-child {
  border-radius: 8px 0 0 8px;
}

.status-btn:last-child {
  border-radius: 0 8px 8px 0;
}

.status-btn:not(:first-child) {
  border-left: none;
}

.status-btn.active {
  background: var(--accent-secondary);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.status-badge {
  display: inline-block;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  margin-left: 6px;
  background: var(--bg-hover);
  border-radius: 9px;
  font-size: 11px;
  font-weight: 600;
}

.status-btn.active .status-badge {
  background: var(--accent-primary);
  color: white;
}
```

#### Period Sections

```css
.period-section {
  margin-bottom: 24px;
}

.period-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
}

.period-toggle {
  width: 44px;
  height: 44px;
  margin: -12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}

.period-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.period-count {
  font-size: 12px;
  color: var(--text-muted);
  margin-left: auto;
}
```

#### Document Grid

```css
.doc-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 0 16px;
}

.doc-grid.collapsed {
  display: none;
}
```

#### Document Card

```css
.doc-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.doc-card:active {
  border-color: var(--border-default);
}

.doc-thumbnail {
  aspect-ratio: 4/3;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.doc-type-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.doc-type-badge.pdf {
  background: var(--status-error-bg);
  color: var(--status-error);
}

.doc-type-badge.docx {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.doc-type-badge.xlsx {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.doc-type-badge.img {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.doc-info {
  padding: 12px;
  border-top: 1px solid var(--border-subtle);
}

.doc-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.doc-size {
  font-size: 12px;
  color: var(--text-tertiary);
}
```

### Interactions

| Action            | Result                             |
| ----------------- | ---------------------------------- |
| Pull down         | Refresh list                       |
| Tap document      | Open preview/detail                |
| Long press        | Context menu (share, delete, move) |
| Status toggle     | Filter by status                   |
| Period header tap | Toggle collapse                    |
| FAB tap           | Upload sheet                       |

### Upload Sheet

```
┌─────────────────────────────────────────────────┐
│       ═══════════════════                       │
│ Încarcă document                           [×]  │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │                                             │ │
│ │          [📤]                               │ │
│ │                                             │ │
│ │    Trage fișiere aici sau apasă            │ │
│ │    pentru a selecta                         │ │
│ │                                             │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ sau                                             │
│                                                 │
│ [📷 Fotografiază]    [📁 Fișiere]              │
│                                                 │
│ DOSAR DESTINAȚIE                                │
│ [CAZ-2024-0156 - Ionescu vs. Alpha       ▼]    │
│                                                 │
├─────────────────────────────────────────────────┤
│                              [Anulează][Încarcă]│
└─────────────────────────────────────────────────┘
```

---

## 2. Document Preview/Detail

Full screen document viewer.

```
┌─────────────────────────────────────────────────┐
│ [safe area]                                     │
├─────────────────────────────────────────────────┤
│ [←] contract-alpha.pdf                    [⋮]   │
├─────────────────────────────────────────────────┤
│                                                 │
│                                                 │
│                                                 │
│         [Document Preview Image]                │
│                                                 │
│                  Page 1 of 5                    │
│                                                 │
│                                                 │
│                                                 │
├─────────────────────────────────────────────────┤
│ [◀ Prev]  ●●●○○ (pagination)      [Next ▶]     │
├─────────────────────────────────────────────────┤
│ [📤 Share]  [📥 Download]  [📂 Mapă]  [📝 Word] │
└─────────────────────────────────────────────────┘
```

### Components

```css
.doc-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.preview-header {
  background: var(--bg-secondary);
  padding: 16px;
  padding-top: calc(16px + var(--safe-area-top));
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.preview-title {
  flex: 1;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.preview-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle);
}

.page-indicator {
  font-size: 13px;
  color: var(--text-secondary);
}

.preview-actions {
  display: flex;
  justify-content: space-around;
  padding: 16px;
  padding-bottom: calc(16px + var(--safe-area-bottom));
  background: var(--bg-secondary);
}

.preview-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  min-width: 60px;
  color: var(--text-secondary);
}

.preview-action:active {
  color: var(--accent-primary);
}

.preview-action-icon {
  width: 24px;
  height: 24px;
}

.preview-action-label {
  font-size: 11px;
  font-weight: 500;
}
```

### Gestures

- **Pinch to zoom** - Zoom into document
- **Double tap** - Zoom in/out
- **Swipe left/right** - Navigate pages
- **Swipe down** - Close preview

---

## 3. Case Documents Context

When viewing documents within a case.

```
┌─────────────────────────────────────────────────┐
│ [←] Ionescu vs. Alpha SRL                  [⋮]  │
├─────────────────────────────────────────────────┤
│ Detalii │ Documente │ Timp │ Mesaje │ Istoric   │
├─────────────────────────────────────────────────┤
│ [Ciornă] [Review (3)] [Final (2)]          [+]  │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌────────────────────┐ ┌────────────────────┐   │
│ │ [Preview]    [PDF] │ │ [Preview]   [DOCX] │   │
│ │ contract.pdf       │ │ cerere.docx        │   │
│ │ 2.1 MB             │ │ 512 KB             │   │
│ └────────────────────┘ └────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

Same grid layout but without period grouping (case context is enough).

---

## 4. List View Alternative

User can toggle between grid and list.

```
┌─────────────────────────────────────────────────┐
│ [Ciornă] [Review (3)] [Final (2)]    [⊞][☰] [+] │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ [📄] contract-alpha.pdf           2.1 MB   │ │
│ │      Azi, 14:30                    [PDF]   │ │
│ ├─────────────────────────────────────────────┤ │
│ │ [📄] cerere-tribunal.docx          512 KB  │ │
│ │      Ieri                         [DOCX]   │ │
│ ├─────────────────────────────────────────────┤ │
│ │ [📄] anexa-calcul.xlsx             256 KB  │ │
│ │      27 Dec                       [XLSX]   │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

```css
.doc-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.doc-list-item:active {
  background: var(--bg-hover);
}

.doc-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.doc-list-info {
  flex: 1;
}

.doc-list-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.doc-list-meta {
  font-size: 13px;
  color: var(--text-tertiary);
}

.doc-list-size {
  font-size: 13px;
  color: var(--text-tertiary);
  text-align: right;
}
```

---

## States

### Loading

Skeleton for document cards.

### Empty

```
┌─────────────────────────────────────────────────┐
│                                                 │
│              [📄]                               │
│                                                 │
│         Niciun document                         │
│                                                 │
│    Nu aveți documente în această categorie.     │
│                                                 │
│           [+ Încarcă document]                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Upload Progress

Toast notification showing upload progress.

```
┌─────────────────────────────────────────────────┐
│ [📄] contract.pdf             ████████░░ 75%    │
│      Se încarcă...                              │
└─────────────────────────────────────────────────┘
```

---

## Comparison: Desktop vs Mobile

| Aspect           | Desktop        | Mobile               |
| ---------------- | -------------- | -------------------- |
| Grid columns     | 5              | 2                    |
| Period sections  | Collapsible    | Collapsible          |
| File type badge  | On thumbnail   | On thumbnail (same)  |
| Document preview | Side panel     | Full screen          |
| Upload           | Drag & drop    | Camera + file picker |
| Actions          | Inline buttons | Bottom action bar    |
| List view        | Table          | Simple list          |
