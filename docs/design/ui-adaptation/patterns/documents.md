# Documents Page Pattern

**Status**: Discovery Complete
**Context**: /documents page only (not dashboard widget)

## Current Structure

**Layout**: 2-column

- Left sidebar (280px): Case navigation with folder tree
- Right panel: Header + tabs + document grid/list

**Current Tabs**:

- Documente de lucru (UPLOAD, AI_GENERATED, TEMPLATE)
- Corespondență (EMAIL_ATTACHMENT)
- De revizuit (supervisor review queue)

## Target Design

### Layout

Keep 2-column layout:

- Left sidebar: Case/folder navigation (apply Linear dark styling)
- Right panel: Header + document grid

### Header Changes

| Current                 | Target                                 |
| ----------------------- | -------------------------------------- |
| Breadcrumbs             | Keep                                   |
| View toggle (grid/list) | Keep                                   |
| Upload button           | Keep                                   |
| Tab system              | **Replace with status toggle buttons** |
| Sort dropdown           | **Remove**                             |
| Type filter             | **Remove**                             |

**New Header Structure:**

```
[Breadcrumb: Cazuri > Case Name > Folder]

[Search] [Ciornă | Review (3) | Final (2)] ----spacer---- [Grid|List] [+ Încarcă]
```

**Status Toggle** (visible buttons, not dropdown):

- Ciornă (DRAFT) - default active
- Review (PENDING_REVIEW) - with notification badge count
- Final (FINAL) - with notification badge count

**Note**: "Review" and "Final" buttons show notification badges with counts to alert users of documents needing attention.

### Document Card (Grid View)

**Target Layout:**

```
┌─────────────────────────────┐
│ [Thumbnail/Preview Area]    │
│                        [PDF]│  ← File type badge (top-right)
│                             │
├─────────────────────────────┤
│ Contract_vanzare_apt.pdf    │  ← Filename (truncated)
│ 2.1 MB          [Mapă][Word]│  ← Size + Actions
└─────────────────────────────┘
```

**Card Elements:**

| Element         | Position        | Details                                        |
| --------------- | --------------- | ---------------------------------------------- |
| Thumbnail       | Top area        | Dark gray bg, file icon or preview             |
| File type badge | Top-right       | PDF=red, DOCX=blue, XLSX=green, JPG/PNG=orange |
| Filename        | Below thumbnail | Truncated with ellipsis, full name on hover    |
| Size            | Bottom-left     | File size (e.g., "2.1 MB")                     |
| Action buttons  | Bottom-right    | Mapă, Word (if applicable)                     |
| Selected state  | Border          | Dashed accent border                           |

**Removed from card:**

- Status badge (DRAFT/PENDING/FINAL) → moved to header filter
- Category badge (Contract, Probă, etc.) → folder structure provides context
- Relative date → period sections provide temporal context
- Uploader name
- "Importat" badge
- SharePoint indicator

### File Type Badges

| Extension         | Color            | Label |
| ----------------- | ---------------- | ----- |
| .pdf              | Red (#EF4444)    | PDF   |
| .doc, .docx       | Blue (#3B82F6)   | DOC   |
| .xls, .xlsx       | Green (#22C55E)  | XLS   |
| .jpg, .jpeg, .png | Orange (#F59E0B) | IMG   |
| .txt              | Gray (#71717A)   | TXT   |
| Other             | Gray             | EXT   |

### Period-based Grouping

Documents are grouped by time period with collapsible sections:

| Period        | Section Title                             | Behavior             |
| ------------- | ----------------------------------------- | -------------------- |
| This week     | "Această săptămână"                       | Expanded by default  |
| Current month | "[Month] [Year]" (e.g., "Decembrie 2024") | Expanded by default  |
| Older months  | "[Month] [Year]"                          | Collapsed by default |

**Section Header:**

```
[▼ expand] ACEASTĂ SĂPTĂMÂNĂ  4 documente  ─────────────
```

- Clicking header toggles expand/collapse
- Document count shown for collapsed sections
- Horizontal line extends to fill remaining width

### Left Sidebar (Case Navigation)

Apply Linear dark styling:

- Dark background (--bg-secondary)
- Case items with expand/collapse
- Folder tree with indentation
- Document counts
- "New Folder" button

Keep current functionality:

- Drag-drop document movement
- Folder context menu (Create, Rename, Delete)
- "Toate documentele" root option

## Decisions Summary

1. **Layout**: 3-panel (nav sidebar 240px + case sidebar 280px + content)
2. **Navigation**: Add main app navigation sidebar (same as home-desktop)
3. **Status toggle**: Three buttons - Ciornă (default), Review (with badge), Final (with badge)
4. **Notification badges**: Review and Final show count badges for documents needing attention
5. **Remove filters**: Remove Type filter, Sort button, and "Toate" option from header
6. **Period grouping**: Group documents by time period (this week, current month, older months)
7. **Collapsible sections**: Week/month sections expanded, older months collapsed by default
8. **File type badge**: Add prominent colored badge (top-right of card)
9. **Card simplification**: Remove category badges, relative dates (period provides context)
10. **Actions**: Keep Mapă/Word at bottom-right
11. **Remove from cards**: Uploader, SharePoint indicator, "Importat" badge, category badge

## Implementation Notes

1. Keep existing folder tree functionality
2. Keep drag-drop for document movement
3. Keep version history feature
4. Apply Linear design tokens (dark theme)
5. Supervisor "De revizuit" becomes a Type filter option

## Open Questions (Resolved)

- ✅ Context: /documents page only
- ✅ Actions: Keep, position at bottom-right
- ✅ Status: Header filter, not card badge
