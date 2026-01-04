# Iteration: Mobile Mockups Comparison

**Status**: Review Complete
**Date**: 2025-12-30
**Input**: HTML mockups from `/Users/mio/Developer/bojin-law-ui/mockups/`
**Screenshots**: `.claude/work/screenshots/iterate-mobile-mockups/`
**Next step**: Fix issues via `/implement iterate-mobile-mockups`

---

## Inspection Summary

### Pages Inspected

| Route         | Screenshot          | Mockup File               | Issues |
| ------------- | ------------------- | ------------------------- | ------ |
| /m            | page-m.png          | N/A (home mockup missing) | 3      |
| /m/cases      | page-m-cases.png    | cases-tab.html            | 8      |
| /m/cases/[id] | page-m-cases-1.png  | case-detail.html          | 6      |
| /m/calendar   | page-m-calendar.png | calendar-tab.html         | 7      |
| /m/search     | page-m-search.png   | search-tab.html           | 4      |

---

## Issues Found

### Issue 1: Header Title Not Left-Aligned (All Pages)

- **Location**: All pages
- **What I See**: Title is centered in header
- **Expected**: Mockups show title left-aligned with larger font (22px, font-weight 700)
- **Suggested Fix**:
  - File: `src/components/layout/MobileHeader.tsx`
  - Change: Remove center alignment, use left-aligned title with larger font

### Issue 2: Missing Header Menu Button (Cases, Calendar)

- **Location**: Cases and Calendar pages
- **What I See**: No menu button in header
- **Expected**: Mockups show a hamburger menu icon on the right side of the header
- **Suggested Fix**:
  - File: `src/components/layout/MobileHeader.tsx`
  - Add: Optional menu button prop

### Issue 3: Cases - Different List Structure

- **Location**: /m/cases
- **What I See**: Cards with colored left border, icon box, status badges on right
- **Expected**: Simple list items with folder icon box (40x40), title, subtitle with dot separator (e.g., "Litigiu comercial · 12 taskuri"), and chevron arrow. Grouped by sections ("Recente", "Toate dosarele")
- **Suggested Fix**:
  - File: `src/app/m/cases/page.tsx`
  - Change: Remove colored borders, simplify to list format, add section grouping

### Issue 4: Cases - Search Bar Styling

- **Location**: /m/cases
- **What I See**: Search bar inside a button/link component with full-width card styling
- **Expected**: Search bar with elevated background (#141414), subtle border, icon on left, placeholder text
- **Suggested Fix**:
  - File: `src/app/m/cases/page.tsx`
  - Change: Use an actual search input style matching mockup

### Issue 5: Cases - Filter Chips Position

- **Location**: /m/cases
- **What I See**: Filter chips (Toate, Active, Urgente) below search
- **Expected**: Mockup doesn't show filter chips on the main cases list - it's a simpler list view
- **Suggested Fix**:
  - File: `src/app/m/cases/page.tsx`
  - Consider: Remove filter chips to match simpler mockup design, or keep but style differently

### Issue 6: Case Detail - Header Structure

- **Location**: /m/cases/[id]
- **What I See**: Title showing case number "2024/123" centered, back button on left
- **Expected**: Back button, case title "Smith v. Jones" (the case name, not number), and a more menu button (three dots)
- **Suggested Fix**:
  - File: `src/app/m/cases/[id]/page.tsx`
  - Change: Show case name in header, not case number

### Issue 7: Case Detail - Missing Case Info Section

- **Location**: /m/cases/[id]
- **What I See**: Header card with case info, status badge, team avatars all combined
- **Expected**: Separate case info section below header with type (e.g., "Litigiu comercial"), client info with icon, and responsible person with icon. Each on separate rows.
- **Suggested Fix**:
  - File: `src/app/m/cases/[id]/page.tsx`
  - Change: Add structured case info section below header

### Issue 8: Case Detail - Tab Navigation Style

- **Location**: /m/cases/[id]
- **What I See**: Tabs in a pill/segment control style within a card background
- **Expected**: Simple horizontal tabs without background wrapper, just text tabs with hover/active states
- **Suggested Fix**:
  - File: `src/app/m/cases/[id]/page.tsx`
  - Change: Remove card wrapper around tabs, use simpler tab styling

### Issue 9: Case Detail - Task List Missing Checkbox

- **Location**: /m/cases/[id] (Taskuri tab)
- **What I See**: Tasks with square checkbox icons
- **Expected**: Round checkbox (circle) that can be checked, with different states (empty, checked with green background and checkmark)
- **Suggested Fix**:
  - File: `src/app/m/cases/[id]/page.tsx`
  - Change: Use round checkbox style matching mockup

### Issue 10: Case Detail - Missing Bottom Action Button

- **Location**: /m/cases/[id]
- **What I See**: No bottom action button
- **Expected**: Fixed bottom action bar with "Task nou" button (full width, white background, black text, plus icon)
- **Suggested Fix**:
  - File: `src/app/m/cases/[id]/page.tsx`
  - Add: Fixed bottom action button component

### Issue 11: Calendar - Missing Full Month Grid

- **Location**: /m/calendar
- **What I See**: Horizontal scrollable week view with day cards
- **Expected**: Full month calendar grid with weekday headers (L M M J V S D), day numbers in grid, today highlighted (white bg, black text), days with events marked with dot indicator
- **Suggested Fix**:
  - File: `src/app/m/calendar/page.tsx`
  - Major change: Replace week strip with full month grid view

### Issue 12: Calendar - Missing Legend

- **Location**: /m/calendar
- **What I See**: No legend for event types
- **Expected**: Legend section showing event type colors (Termene = orange/yellow, Intalniri = blue, Instanta = purple)
- **Suggested Fix**:
  - File: `src/app/m/calendar/page.tsx`
  - Add: Legend component below calendar grid

### Issue 13: Calendar - Event Item Structure

- **Location**: /m/calendar
- **What I See**: Event cards with time on left column, colored vertical bar, title and location
- **Expected**: Similar but with different visual - time in a fixed-width column (50px), thin colored indicator bar (3px), event title and meta on right
- **Suggested Fix**:
  - File: `src/app/m/calendar/page.tsx`
  - Adjust: Event item styling to match mockup proportions

### Issue 14: Calendar - Day Headers

- **Location**: /m/calendar
- **What I See**: Section header "EVENIMENTE"
- **Expected**: Day-specific headers like "Azi · 29 Decembrie" with today's header in accent color
- **Suggested Fix**:
  - File: `src/app/m/calendar/page.tsx`
  - Change: Add day-specific headers for events

### Issue 15: Search - Missing Cancel Button

- **Location**: /m/search
- **What I See**: Search input with X button to clear
- **Expected**: Search input with clear button AND a "Anuleaza" (Cancel) text button to the right of the search bar
- **Suggested Fix**:
  - File: `src/app/m/search/page.tsx`
  - Add: Cancel button that navigates back or clears search state

### Issue 16: Search - Filter Chips Visual Style

- **Location**: /m/search
- **What I See**: Filter chips with icon + text, active state with inverted colors (white bg, black text)
- **Expected**: Filter chips with just text (no icons), pill/rounded style, active state with accent background and border
- **Suggested Fix**:
  - File: `src/app/m/search/page.tsx`
  - Change: Remove icons from filter chips, adjust active state styling

### Issue 17: Search - Results Structure

- **Location**: /m/search
- **What I See**: Empty state showing "Rezultatele vor aparea aici"
- **Expected**: When results exist, they should be grouped by type (Dosare, Taskuri, Documente, Persoane) with section headers. Results should have smaller icon boxes (36x36), highlighted search term in title using `<mark>` styling
- **Suggested Fix**:
  - File: `src/app/m/search/page.tsx`
  - Add: Proper search results display with grouping and highlighting

### Issue 18: Bottom Tab Bar - Icon Size and Style

- **Location**: All pages
- **What I See**: Tab bar with icons (22x22) and labels
- **Expected**: Matches fairly well, but mockup shows stroke-width 2 icons. Current may be using filled variants.
- **Suggested Fix**:
  - File: `src/components/layout/BottomTabBar.tsx`
  - Verify: Icons are outline/stroke style, not filled

---

## Design System Discrepancies

### Colors (Current vs Mockup)

The CSS variables are correctly defined but some components aren't using them consistently:

| Token                   | Current | Mockup  |
| ----------------------- | ------- | ------- |
| --mobile-bg-primary     | #0a0a0a | #0a0a0a |
| --mobile-bg-elevated    | #141414 | #141414 |
| --mobile-bg-card        | #1a1a1a | #1a1a1a |
| --mobile-text-primary   | #fafafa | #fafafa |
| --mobile-text-secondary | #a1a1a1 | #a1a1a1 |
| --mobile-text-tertiary  | #6b6b6b | #6b6b6b |
| --mobile-accent         | #3b82f6 | #3b82f6 |

### Typography

- Header titles should be 22px/700 (currently 17px/600)
- Section labels should be 11px/600 uppercase with 0.1em letter-spacing
- Item titles should be 15px/600 with -0.01em letter-spacing

### Spacing

- Mockups use 24px (--space-xl) for main content padding
- Current implementation uses 16px (px-4 = 1rem = 16px)

---

## Iteration Tasks

> These tasks can be passed to `/implement iterate-mobile-mockups` for automated fixes

### Task 1: Update MobileHeader Component

- **Files**:
  - src/components/layout/MobileHeader.tsx (MODIFY)
- **Do**:
  - Change title to left-aligned
  - Increase font size to 22px, weight to 700
  - Add letter-spacing -0.02em
  - Add optional rightAction prop for menu button
  - Update padding to use 24px horizontal
- **Done when**: Header matches mockup style with left-aligned larger title

### Task 2: Redesign Cases List Page

- **Files**:
  - src/app/m/cases/page.tsx (MODIFY)
- **Do**:
  - Remove colored left borders from case items
  - Change icon box to 40x40 with folder icon
  - Update case item structure: title (15px/600), meta with dot separator
  - Add section grouping ("Recente", "Toate dosarele")
  - Update search bar styling to match mockup (elevated bg, subtle border)
  - Remove or restyle filter chips
- **Done when**: Cases list matches mockup layout

### Task 3: Redesign Case Detail Page

- **Files**:
  - src/app/m/cases/[id]/page.tsx (MODIFY)
- **Do**:
  - Show case name in header (not case number)
  - Add more menu button (three dots) to header
  - Create separate case info section with type, client, responsible
  - Change tabs to simple style (no card wrapper)
  - Change task checkboxes to round style
  - Add fixed bottom action button "Task nou"
- **Done when**: Case detail matches mockup layout with proper sections and bottom action

### Task 4: Redesign Calendar Page

- **Files**:
  - src/app/m/calendar/page.tsx (MODIFY)
- **Do**:
  - Replace week strip with full month calendar grid
  - Add weekday headers (L M M J V S D)
  - Implement day cells with event dot indicators
  - Add legend section for event types
  - Change event list to show day-specific headers ("Azi · 29 Decembrie")
  - Style today's header in accent color
- **Done when**: Calendar shows full month grid with legend and proper event list

### Task 5: Update Search Page

- **Files**:
  - src/app/m/search/page.tsx (MODIFY)
- **Do**:
  - Add "Anuleaza" cancel button next to search input
  - Remove icons from filter chips
  - Update filter chip active state to accent color
  - Add proper search results display with section grouping
  - Implement search term highlighting with `<mark>` styling
- **Done when**: Search page matches mockup with cancel button and proper results display

### Task 6: Update Bottom Tab Bar

- **Files**:
  - src/components/layout/BottomTabBar.tsx (MODIFY)
- **Do**:
  - Verify icons are stroke/outline style (stroke-width 2)
  - Ensure consistent 22x22 icon size
- **Done when**: Tab bar icons match mockup outline style

---

## Verdict

- [x] **Issues found** - Run `/implement iterate-mobile-mockups` to fix, or make manual changes
- [ ] **No issues** - Implementation looks good! Proceed to `/commit`

---

## Priority Order

1. **High Priority** (Core UX differences):
   - Task 4: Calendar - Full month grid is major UX change
   - Task 2: Cases list - Structure significantly different
   - Task 3: Case detail - Missing bottom action and structural changes

2. **Medium Priority** (Visual polish):
   - Task 1: Header styling
   - Task 5: Search refinements

3. **Low Priority** (Minor):
   - Task 6: Tab bar icons

---

## Recommendation

The current implementation follows a different design philosophy (cards with colored accents) compared to the mockups (minimal, list-based with sections). I recommend implementing the changes in order of priority, starting with the calendar page as it has the most significant UX difference.

Would you like me to proceed with `/implement iterate-mobile-mockups` to make these changes?
