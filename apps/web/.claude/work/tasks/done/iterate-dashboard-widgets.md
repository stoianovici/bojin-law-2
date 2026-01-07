# Iteration: Dashboard Widget Proportions

**Status**: Review Complete
**Date**: 2025-12-29
**Input**: User request (dashboard widget resizing)
**Screenshots**: `.claude/work/screenshots/iterate-dashboard-widgets/`
**Next step**: Fix issues with `/implement iterate-dashboard-widgets`

---

## Inspection Summary

### Pages Inspected

| Route             | Screenshot            | Issues |
| ----------------- | --------------------- | ------ |
| /dev/home-preview | page-home-preview.png | 5      |

---

## Issues Found

### Issue 1: Metrici Firmă Card - Excessive Density

- **Location**: Dashboard page, third card in top row
- **Screenshot**: `page-home-preview.png`
- **What I See**: The "Metrici Firmă" card has a 2x2 grid of metrics with additional comparison text ("+12% față de săpt. trecută", "-3 față de săpt. trecută"). This makes it visually denser than the other two cards in the row.
- **Expected**: All three cards in the row should have similar visual weight
- **Suggested Fix**:
  - File: `src/app/(dashboard)/page.tsx`
  - Line: ~419-438
  - Change: Remove the comparison trend text or move it to a tooltip/hover state to reduce density

### Issue 2: Bottom Row Cards - Unequal Heights

- **Location**: Dashboard page, bottom row (Utilizare Echipă, Acțiuni rapide)
- **Screenshot**: `page-home-preview.png`
- **What I See**: The two bottom cards have the same height but "Acțiuni rapide" has more empty space at the bottom after the 4 quick action items
- **Expected**: Cards should either have content that fills them proportionally, or use min-height instead of forced equal height
- **Suggested Fix**:
  - File: `src/app/(dashboard)/page.tsx`
  - Line: ~445
  - Change: Consider using `items-start` on the grid so cards size to their content, or add more quick actions to fill the space

### Issue 3: Top Three Cards - Content Height Mismatch

- **Location**: Dashboard page, three-column layout
- **Screenshot**: `page-home-preview.png`
- **What I See**: "Cazuri Supravegheate" shows 4 cases, "Sarcinile Mele" shows 4 tasks, but "Metrici Firmă" has a 2x2 grid that is shorter. The cards are forced to equal height leaving different internal spacing.
- **Expected**: Content should align better across the three cards
- **Suggested Fix**:
  - File: `src/app/(dashboard)/page.tsx`
  - Line: ~321
  - Change: Add `items-start` to the grid: `grid grid-cols-1 lg:grid-cols-3 gap-6 items-start`

### Issue 4: Metrici Card - Missing Bottom Padding Balance

- **Location**: Dashboard page, Metrici Firmă card
- **Screenshot**: `page-home-preview.png`
- **What I See**: The metrics grid (2x2) ends abruptly without visual balance compared to the list-style cards
- **Expected**: The card should have similar vertical rhythm to other cards
- **Suggested Fix**:
  - File: `src/app/(dashboard)/page.tsx`
  - Line: ~408
  - Change: Add `pb-2` or `pb-4` to CardContent to add bottom padding, or add a subtle footer element

### Issue 5: Quick Actions Card - Search Box Proportion

- **Location**: Dashboard page, Acțiuni rapide card
- **Screenshot**: `page-home-preview.png`
- **What I See**: The search input box at the top of "Acțiuni rapide" takes significant vertical space, creating an imbalance with the list of actions below
- **Expected**: The search box should be more compact or the actions list should be more prominent
- **Suggested Fix**:
  - File: `src/app/(dashboard)/page.tsx`
  - Line: ~506-516
  - Change: Reduce padding on the search box from `px-3 py-2.5` to `px-3 py-2` for a more compact appearance

---

## Iteration Tasks

> These tasks can be passed to `/implement iterate-dashboard-widgets` for automated fixes

### Task 1: Add items-start to three-column grid

- **File**: src/app/(dashboard)/page.tsx (MODIFY)
- **Do**: Change line ~321 from `grid grid-cols-1 lg:grid-cols-3 gap-6` to `grid grid-cols-1 lg:grid-cols-3 gap-6 items-start`
- **Done when**: Top three cards size to their content instead of stretching to equal height

### Task 2: Add items-start to bottom two-column grid

- **File**: src/app/(dashboard)/page.tsx (MODIFY)
- **Do**: Change line ~445 from `grid grid-cols-1 lg:grid-cols-2 gap-6` to `grid grid-cols-1 lg:grid-cols-2 gap-6 items-start`
- **Done when**: Bottom two cards size to their content

### Task 3: Compact search box in Quick Actions

- **File**: src/app/(dashboard)/page.tsx (MODIFY)
- **Do**: Change the search button className from `px-3 py-2.5` to `px-3 py-2`
- **Done when**: Search box is more compact

### Task 4: Remove or simplify trend comparison text in Metrici

- **File**: src/app/(dashboard)/page.tsx (MODIFY)
- **Do**: The production dashboard doesn't have trend text (see lines 419-438), but if present, consider removing for cleaner appearance
- **Done when**: Metrici card has similar visual density to other cards

---

## Verdict

- [x] **Issues found** - Run `/implement iterate-dashboard-widgets` to fix, or make manual changes
- [ ] **No issues** - Implementation looks good! Proceed to `/commit`

---

## Quick Summary

The main proportion issues are:

1. **Grid alignment**: Cards stretch to equal height when they should size to content (`items-start` needed)
2. **Visual density**: Metrici card is denser than list-based cards
3. **Search box**: Slightly too tall in Quick Actions

Recommended priority: Tasks 1 and 2 (grid alignment) will have the most immediate visual impact.
