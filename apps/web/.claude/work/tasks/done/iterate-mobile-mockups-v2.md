# Iteration: Mobile Mockups v2

**Status**: Review Complete
**Date**: 2025-12-30
**Input**: `implement-iterate-mobile-mockups.md`
**Screenshots**: `.claude/work/screenshots/iterate-mobile-mockups-v2/`
**Next step**: Update home page to match mockup style, or proceed to `/commit`

---

## Inspection Summary

### Pages Inspected

| Route       | Screenshot          | Issues                   |
| ----------- | ------------------- | ------------------------ |
| /m          | page-m.png          | 3 (uses old card design) |
| /m/cases    | page-m-cases.png    | 0                        |
| /m/cases/1  | page-m-cases-1.png  | 0                        |
| /m/calendar | page-m-calendar.png | 0                        |
| /m/search   | page-m-search.png   | 0                        |

---

## Comparison Results

### Cases List (/m/cases) - MATCHES MOCKUP

Comparing `page-m-cases.png` against `mockups/cases-tab.html`:

- Header "Dosare" left-aligned with 22px/700 font
- Hamburger menu icon on right
- Search bar with elevated background (`#141414`) and border
- Section headers (RECENTE, TOATE DOSARELE) with uppercase styling, 11px/600 font
- Folder icons in 40x40 neutral boxes with border
- Case names 15px/600 with meta text (Type · X taskuri)
- Chevron arrows on the right
- **Verdict: Excellent match**

### Case Detail (/m/cases/1) - MATCHES MOCKUP

Comparing `page-m-cases-1.png` against `mockups/case-detail.html`:

- Back button and case name "Smith v. Jones" in header
- Three-dots menu button on right
- Case info section: type, client, responsible with icons
- Simple text tabs (Taskuri, Documente, Note, Istoric) with active state
- Section headers (TASKURI DESCHISE, FINALIZATE) with count badges
- Round checkboxes (20px circle, border `#2a2a2a`)
- Completed tasks: green fill (`#22c55e`), checkmark, strikethrough text
- Task due dates: orange warning color for "Până la 17:00"
- **Verdict: Excellent match**

### Calendar (/m/calendar) - MATCHES MOCKUP

Comparing `page-m-calendar.png` against `mockups/calendar-tab.html`:

- Full 7x6 month grid
- Weekday headers (L M M J V S D) in tertiary color
- Today (30) highlighted with blue background, white text
- Event dot indicators (4px blue dots under days with events)
- Legend with colored squares: Termene (orange), Întâlniri (blue), Instanță (purple)
- Day-specific event headers: "AZI · 30 DECEMBRIE" in accent color
- Events with time, title, and case name
- **Verdict: Excellent match**

### Search (/m/search) - MATCHES MOCKUP

Comparing `page-m-search.png` against `mockups/search-tab.html`:

- "Anulează" cancel button in accent color
- Filter chips: "Toate" active with blue styling, others in neutral
- "CĂUTĂRI RECENTE" section header
- Recent searches with search icons
- **Verdict: Excellent match**

### Home (/m) - DOES NOT MATCH MOCKUP STYLE

The home page uses the OLD design pattern:

- Card-based items with rounded corners (`bg-elevated`)
- Colored left borders (red, yellow, green for status)
- Check icons in colored circle backgrounds
- Clock icons in colored circles for recent items
- FAB button "+ Nou" in bottom right corner

**Note**: There was no `home-tab.html` mockup provided, so this page wasn't updated. However, for visual consistency, it should match the minimalist list style used in the other mockup pages.

---

## Issues Found

### Issue 1: Home Page Uses Old Card Design

- **Location**: /m (home page)
- **Screenshot**: `page-m.png`
- **What I See**: Card-based items with colored left borders (red/yellow/green), colored icon backgrounds, and a FAB button
- **Expected**: Minimalist list design matching the cases page style - folder/check icons in neutral 40x40 boxes, no colored borders, simple list items with dividers
- **Suggested Fix**:
  - File: `src/app/m/page.tsx`
  - Change: Replace card-based design with simple list items matching the mockup style

### Issue 2: Home Page Has Colored Status Borders

- **Location**: /m (home page)
- **Screenshot**: `page-m.png`
- **What I See**: Items have colored left borders indicating status (red = urgent, yellow = warning, green = ok)
- **Expected**: Clean list items without colored borders, status conveyed through text/meta instead
- **Suggested Fix**:
  - File: `src/app/m/page.tsx`
  - Change: Remove `border-l-4` classes and colored borders

### Issue 3: Home Page FAB Button Style

- **Location**: /m (home page)
- **Screenshot**: `page-m.png`
- **What I See**: "+ Nou" floating action button in bottom right with white background
- **Expected**: Either no FAB (rely on tab bar + actions), or integrate into header like the cases page hamburger menu
- **Suggested Fix**:
  - File: `src/app/m/page.tsx`
  - Change: Remove FAB or relocate action to header

---

## Iteration Tasks

> These tasks can be passed to `/implement iterate-mobile-mockups-v2` for automated fixes

### Task 1: Redesign Home Page to Match Mockup Style

- **File**: src/app/m/page.tsx (MODIFY)
- **Do**:
  - Replace card-based "ASTAZI" items with simple list items matching cases page style
  - Use check icons in neutral 40x40 boxes instead of colored backgrounds
  - Remove colored left borders
  - Use same padding (px-6) and spacing as cases page
  - Section headers should be 11px/600 uppercase with 0.1em letter-spacing
- **Done when**: Home page visually matches the minimalist style of cases-tab.html mockup

### Task 2: Update Recent Items Section

- **File**: src/app/m/page.tsx (MODIFY)
- **Do**:
  - Replace clock icons in colored circles with folder icons in neutral boxes
  - Use same list item structure as cases page (icon box, content, chevron)
  - Meta text should show case number and client, not just case number
- **Done when**: Recent items match the cases list style

### Task 3: Remove or Relocate FAB Button

- **File**: src/app/m/page.tsx (MODIFY)
- **Do**:
  - Either remove the FAB button entirely (actions accessible through bottom sheet or header)
  - Or keep it but ensure it doesn't conflict with bottom tab bar
- **Done when**: No floating button overlapping the content area

---

## Verdict

- [x] **Issues found** - The home page (/m) uses the old card-based design and doesn't match the minimalist mockup style

**Recommendation**:

1. If a home page mockup exists or is created, run `/implement iterate-mobile-mockups-v2` to update the home page
2. If no home page mockup is needed and the current design is acceptable, proceed to `/commit`

The cases list, case detail, calendar, and search pages all match their respective mockups excellently.
