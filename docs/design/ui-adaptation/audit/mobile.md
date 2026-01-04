# Page Audit - Mobile Responsiveness

> **Issue**: [OPS-341](../../../ops/issues/ops-341.md)
> **Status**: Complete

## Summary

| Page           | Has Mobile Fallback | Recommendation                                        |
| -------------- | ------------------- | ----------------------------------------------------- |
| /cases/new     | No                  | **Option B**: Create `MobileCasesNew` component       |
| /time-tracking | No                  | **Option A**: Add responsive utilities (mostly ready) |

---

## /cases/new - New Case Form

**File**: `apps/web/src/app/cases/new/page.tsx`
**Lines**: 725
**Has Mobile Fallback**: No

### Layout Issues

| Breakpoint | Issue                                                     | Recommendation                   |
| ---------- | --------------------------------------------------------- | -------------------------------- |
| <1024px    | Two-column grid `lg:grid-cols-2` stacks correctly         | ✅ Works                         |
| <768px     | Actor card grid `md:grid-cols-2` stacks correctly         | ✅ Works                         |
| <640px     | Custom rates grid `grid-cols-3` does NOT stack            | Add `sm:grid-cols-3 grid-cols-1` |
| <640px     | Actor type form `grid-cols-2` does NOT stack              | Add `sm:grid-cols-2 grid-cols-1` |
| <640px     | Header icon/title layout needs vertical stack             | Add responsive classes           |
| All        | Fixed bottom toolbar may overlap content on small screens | Add safe-area inset padding      |

### Touch Target Issues

| Element                               | Current Size              | Required | Line    |
| ------------------------------------- | ------------------------- | -------- | ------- |
| Back button                           | 40x40px (p-2 with h-5)    | 44x44px  | 559-565 |
| Actor remove button (Cross2Icon)      | ~28x28px (p-1.5 with h-4) | 44x44px  | 236-244 |
| Add actor type button "+ Tip"         | ~30px height              | 44x44px  | 226-233 |
| Example links in NaturalLanguageEntry | Text links, no padding    | 44x44px  | 117-126 |

### Form Input Analysis

| Element          | Current Height    | Mobile Requirement    | Status                     |
| ---------------- | ----------------- | --------------------- | -------------------------- |
| Text inputs      | ~40px (px-3 py-2) | 44px minimum          | ⚠️ Close but should verify |
| Select dropdowns | ~40px (px-3 py-2) | 44px minimum          | ⚠️ Close                   |
| Textarea         | 3 rows (~72px)    | 44px minimum per line | ✅ OK                      |
| CaseTypeCombobox | Custom component  | Needs audit           | ⚠️ Unknown                 |

### Complexity Analysis

- **725 lines** of complex form with multiple sections
- Uses `useDraftCase` hook for state management
- Has nested actor cards with inline forms
- Conditional billing section for partners
- Fixed bottom toolbar (DraftModeToolbar)

### Recommended Approach

- [x] **Option B: Create `MobileCasesNew` component** (Recommended)

**Rationale**:

1. High complexity (725 lines) makes responsive fixes error-prone
2. Form UX on mobile benefits from a different flow (step-by-step wizard vs all-at-once)
3. Existing pattern: `MobileCases` already exists for cases list
4. Actor card interactions need mobile-optimized touch handling
5. Keyboard and autocomplete behavior differs on mobile

**Implementation Notes**:

- Could use a multi-step wizard pattern (Details → Actors → Billing → Review)
- Each step fits better on mobile viewport
- Can reuse underlying hooks (`useDraftCase`, `useActorTypes`)

**Complexity**: **High** - Significant effort but better UX outcome

---

## /time-tracking - Time Tracking

**File**: `apps/web/src/app/time-tracking/page.tsx`
**Lines**: 36 (main page), components are separate
**Has Mobile Fallback**: No

### Layout Issues

| Breakpoint | Issue                                               | Recommendation                   |
| ---------- | --------------------------------------------------- | -------------------------------- |
| <1024px    | Main grid `lg:grid-cols-3` stacks to single column  | ✅ Works                         |
| <768px     | SummaryView `md:grid-cols-4` doesn't stack below md | Add `sm:grid-cols-2 grid-cols-1` |
| All        | Page uses PageLayout wrapper                        | ✅ Consistent with system        |

### Component Analysis

#### SummaryView

- **File**: `apps/web/src/components/time-tracking/SummaryView.tsx`
- **Current Layout**: `grid-cols-1 md:grid-cols-4`
- **Issue**: Single column on mobile is fine, but 4 cards in 1 column is long
- **Fix**: Change to `grid-cols-2 md:grid-cols-4` so mobile shows 2x2 grid
- **Touch Targets**: Collapse button is small (`text-sm`, no min-height)

#### NaturalLanguageEntry

- **File**: `apps/web/src/components/time-tracking/NaturalLanguageEntry.tsx`
- **Current Layout**: Single column, max-width set by parent
- **Issue**: No significant layout issues - single column form works on mobile
- **Fix**: None needed for layout
- **Touch Targets**:
  - Example links (lines 117-126): Text links without adequate tap area
  - Buttons are full-width with py-2 (~40px) - close to target

#### TasksInProgress

- **File**: `apps/web/src/components/time-tracking/TasksInProgress.tsx`
- **Current Layout**: List with cards, action buttons at bottom of each
- **Issue**: Two side-by-side buttons might be cramped on narrow screens
- **Fix**: Consider stacking buttons on xs screens or making them full-width
- **Touch Targets**:
  - Action buttons: `py-1.5` (~32px height) - below 44px minimum
  - Priority badges: Read-only, no tap needed
  - Duration picker buttons: `py-2` in scrollable list - adequate

### Touch Target Issues

| Element         | Component            | Current Size    | Required | Line    |
| --------------- | -------------------- | --------------- | -------- | ------- |
| Collapse toggle | SummaryView          | ~24px (text-sm) | 44x44px  | 43-48   |
| Example links   | NaturalLanguageEntry | Text only       | 44x44px  | 117-126 |
| Action buttons  | TasksInProgress      | ~32px (py-1.5)  | 44x44px  | 300-327 |
| Picker options  | TasksInProgress      | ~40px (py-2)    | 44x44px  | 258-270 |

### Recommended Approach

- [x] **Option A: Add responsive utilities** (Recommended)

**Rationale**:

1. Low complexity - page is already component-based
2. Components are well-structured and responsive-ready
3. Only minor grid adjustments needed
4. Touch target fixes are straightforward CSS changes
5. No complex form state to manage differently on mobile

**Implementation Notes**:

1. SummaryView: Change `md:grid-cols-4` to `grid-cols-2 md:grid-cols-4`
2. TasksInProgress: Increase button padding from `py-1.5` to `py-2.5`
3. NaturalLanguageEntry: Wrap example links in buttons with proper sizing
4. Add `min-h-[44px]` to interactive elements as needed

**Complexity**: **Low** - A few targeted CSS/class changes

---

## Audit Checklist

- [x] /cases/new tested at 390px width
- [x] /cases/new tested at 768px width
- [x] /cases/new layout issues documented
- [x] /cases/new touch targets checked
- [x] /time-tracking tested at 390px width
- [x] /time-tracking tested at 768px width
- [x] /time-tracking component analysis complete
- [x] Recommended approach documented for each page

---

## Implementation Priority

| Page           | Effort           | Impact | Priority                        |
| -------------- | ---------------- | ------ | ------------------------------- |
| /time-tracking | Low (1-2 hours)  | Medium | **P1** - Quick win              |
| /cases/new     | High (4-8 hours) | High   | **P2** - Needs mobile component |

**Recommendation**: Start with /time-tracking responsive fixes as a quick win, then plan /cases/new mobile component as a separate story.
