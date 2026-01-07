# Plan: Mobile UX - Superhuman Direction

**Status**: Draft
**Date**: 2025-12-31
**Reference Mockups**: `mockups/*.html`

---

## Design System (Extracted from Mockups)

### Color Tokens

```css
/* Backgrounds */
--bg-primary: #0a0a0a /* Main background */ --bg-elevated: #141414
  /* Elevated surfaces, tab bar, sheets */ --bg-card: #1a1a1a /* Cards, icon boxes */
  --bg-hover: #242424 /* Hover states */ /* Text */ --text-primary: #fafafa /* Primary text */
  --text-secondary: #a1a1a1 /* Secondary text, meta */ --text-tertiary: #6b6b6b
  /* Muted text, labels */ /* Borders */ --border: #2a2a2a /* Default borders */
  --border-subtle: #1f1f1f /* Subtle dividers */ /* Semantic Colors */ --accent: #3b82f6
  /* Blue - links, active states */ --warning: #f59e0b /* Orange - urgent, due soon */
  --success: #22c55e /* Green - completed */ --purple: #a855f7 /* Purple - court/instanță */;
```

### Typography Scale

| Element       | Size | Weight | Tracking | Color               |
| ------------- | ---- | ------ | -------- | ------------------- |
| Greeting      | 26px | 700    | -0.03em  | primary             |
| Page title    | 22px | 700    | -0.02em  | primary             |
| Detail header | 17px | 600    | -0.02em  | primary             |
| Item title    | 15px | 600    | -0.01em  | primary             |
| Body text     | 15px | 400    | normal   | primary             |
| Meta text     | 13px | 400    | normal   | secondary           |
| Section label | 11px | 600    | 0.1em    | tertiary, UPPERCASE |
| Tab label     | 10px | 500    | normal   | varies              |

### Spacing Scale

```
4px   (xs)   - Tiny gaps
8px   (sm)   - Small gaps
12px  (md)   - Medium gaps, icon-content gap
16px  (lg)   - Item padding, section gaps
24px  (xl)   - Main content padding (px-6)
32px  (2xl)  - Section margins
48px  (3xl)  - Header top padding (safe area)
```

### Component Patterns

#### 1. Headers

**Home Page:**

- Wordmark "Bojin Law" (18px/700)
- Avatar (32px circle, gradient)
- Menu button (32px)

**Tab Pages (Cases, Calendar, Search):**

- Title left-aligned (22px/700)
- Menu/action button right (32px)

**Detail Pages:**

- Back button left (32px, -8px margin)
- Title center-flex (17px/600, truncate)
- More button right (32px)

#### 2. Section Headers

```
[LABEL]                    [COUNT]
11px/600 uppercase         12px/500 bg-elevated rounded
tracking 0.1em             px-2 py-0.5
text-tertiary
```

#### 3. List Items (Simple)

```
[ICON BOX]  [CONTENT]           [CHEVRON]
40x40       Title: 15px/600     16x16
rounded-10  Meta: 13px          text-tertiary
bg-card     secondary
border
```

#### 4. Attention Cards

```
┌─────────────────────────────────┐
│ [ICON]  Title (15px/600)        │
│ 36x36   Meta (13px)             │
└─────────────────────────────────┘
- bg-card with border
- Urgent: 3px left border in warning color
- Icon: colored bg (warning-subtle or accent-subtle)
```

#### 5. Task Items

```
○  Task title (15px/500)
   Case name · Due time

- Checkbox: 20x20, border-2, rounded-full
- Completed: bg-success with checkmark
- Due soon: warning color
- Completed title: line-through, text-tertiary
```

#### 6. FAB Button

```
┌──────────────┐
│  +   Nou     │
└──────────────┘
- Position: fixed, bottom-24, center
- Style: bg-white, text-black, rounded-full
- Font: 15px/600
- Padding: px-7 py-3.5
- Shadow: shadow-lg shadow-black/40
```

#### 7. Bottom Tab Bar

```
┌─────────────────────────────────┐
│  🏠      📁      📅      🔍   │
│ Acasă  Dosare  Calendar  Caută │
└─────────────────────────────────┘
- bg-elevated, border-top
- Icons: 22x22
- Labels: 10px/500
- Active: text-primary
- Inactive: text-tertiary
```

#### 8. Bottom Sheet

```
┌─────────────────────────────────┐
│         ────                    │ <- Handle (40x4, rounded)
│                                 │
│  Sheet content                  │
│                                 │
└─────────────────────────────────┘
- bg-elevated
- rounded-t-3xl
- Overlay: bg-black/60
```

---

## Current State vs Mockups

| Page          | Current    | Mockup                 | Status          |
| ------------- | ---------- | ---------------------- | --------------- |
| /m (Home)     | ✅ Updated | superhuman-mobile.html | Done            |
| /m/cases      | Partial    | cases-tab.html         | Needs review    |
| /m/cases/[id] | Partial    | case-detail.html       | Needs review    |
| /m/calendar   | Partial    | calendar-tab.html      | Needs review    |
| /m/search     | Partial    | search-tab.html        | Needs review    |
| Bottom Sheet  | Exists     | bottom-sheet.html      | Needs review    |
| Task Detail   | Missing    | task-detail.html       | New page needed |

---

## Implementation Tasks

### Phase 1: Design System Foundation

**Files to create/update:**

#### Task 1.1: Update Mobile CSS Variables

- **File**: src/app/globals.css or tailwind.config.ts
- **Do**: Ensure all mobile-\* CSS variables match the mockup tokens exactly
- **Verify**: Colors, spacing values match mockups

#### Task 1.2: Create Shared Mobile Components

- **File**: src/components/mobile/index.ts (barrel export)
- **Components to standardize**:
  - `MobilePageHeader` - For tab pages (title + menu)
  - `MobileDetailHeader` - For detail pages (back + title + more)
  - `SectionHeader` - Label + optional count
  - `ListItem` - Icon box + content + chevron
  - `TaskItem` - Checkbox + content
  - `AttentionCard` - Urgent/notification cards

### Phase 2: Page Updates

#### Task 2.1: Cases List Page

- **File**: src/app/m/cases/page.tsx
- **Mockup**: cases-tab.html
- **Checklist**:
  - [ ] Header: "Dosare" (22px/700) + menu button
  - [ ] Search bar: bg-elevated, border, 12px radius
  - [ ] Sections: "RECENTE", "TOATE DOSARELE" with counts
  - [ ] List items: 40x40 icon box, folder icon, title/meta
  - [ ] Spacing: px-6 content padding

#### Task 2.2: Case Detail Page

- **File**: src/app/m/cases/[id]/page.tsx
- **Mockup**: case-detail.html
- **Checklist**:
  - [ ] Header: back + case name (17px/600) + more
  - [ ] Case info section: type, client, responsible
  - [ ] Tabs: simple text tabs with active bg
  - [ ] Task list: round checkboxes, warning for due soon
  - [ ] Bottom action: "Task nou" button (full width, white)

#### Task 2.3: Calendar Page

- **File**: src/app/m/calendar/page.tsx
- **Mockup**: calendar-tab.html
- **Checklist**:
  - [ ] Header: "Calendar" + menu
  - [ ] Month nav: "Decembrie 2025" + arrows
  - [ ] Calendar grid: 7 columns, weekday headers
  - [ ] Day cells: today highlight (accent bg), event dots
  - [ ] Legend: colored squares for event types
  - [ ] Event list: grouped by day with headers

#### Task 2.4: Search Page

- **File**: src/app/m/search/page.tsx
- **Mockup**: search-tab.html
- **Checklist**:
  - [ ] Search input: full width, with cancel button
  - [ ] Filter chips: text style, accent when active
  - [ ] Recent searches: search icon + text
  - [ ] Results: grouped by type with section headers

### Phase 3: New Pages & Components

#### Task 3.1: Task Detail Page

- **File**: src/app/m/tasks/[id]/page.tsx (NEW)
- **Mockup**: task-detail.html
- **Features**:
  - Header with back + "Task" + more
  - Large checkbox with title
  - Due date, case link, assignee
  - Notes section
  - Action buttons

#### Task 3.2: Bottom Sheet Component

- **File**: src/components/mobile/BottomSheet.tsx
- **Mockup**: bottom-sheet.html
- **Features**:
  - Overlay backdrop
  - Draggable handle
  - Content area
  - Action items with icons

### Phase 4: Polish & Consistency

#### Task 4.1: Animations

- Page transitions: fadeIn
- Sheet: slide up/down
- List items: subtle hover states
- Checkboxes: smooth fill

#### Task 4.2: Visual QA

- Screenshot all pages
- Compare side-by-side with mockups
- Fix any discrepancies

---

## Execution Strategy

**Approach**: Update pages one at a time, comparing against mockups after each change.

**Order**:

1. Verify design tokens are correct
2. Cases list (simplest tab page)
3. Case detail (introduces detail header pattern)
4. Calendar (complex grid layout)
5. Search (input + filters pattern)
6. Task detail (new page)
7. Bottom sheet refinement

**Verification after each task**:

```bash
npx ts-node scripts/capture-mobile.ts
# Compare screenshots to mockups
```

---

## Success Criteria

- [ ] All pages match mockups within 95% accuracy
- [ ] Consistent spacing (24px padding throughout)
- [ ] Consistent typography (sizes, weights, colors)
- [ ] Consistent component patterns (headers, sections, lists)
- [ ] Smooth animations and transitions
- [ ] No visual regressions
