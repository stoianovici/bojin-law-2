# Iteration: Layout Polish, Font Choices, Navigation Items

**Status**: Review Complete
**Date**: 2025-12-29
**Input**: User request for general layout polish, font choices, navigation items size and look
**Screenshots**: `.claude/work/screenshots/iterate-layout-polish/`
**Next step**: Fix issues with `/implement iterate-layout-polish`

---

## Inspection Summary

### Pages Inspected

| Route  | Screenshot     | Issues |
| ------ | -------------- | ------ |
| /login | page-login.png | 3      |

### Components Analyzed (Code Review)

| Component | File                               | Issues |
| --------- | ---------------------------------- | ------ |
| Sidebar   | src/components/layout/Sidebar.tsx  | 4      |
| Header    | src/components/layout/Header.tsx   | 2      |
| AppShell  | src/components/layout/AppShell.tsx | 1      |
| Button    | src/components/ui/Button.tsx       | 1      |

---

## Issues Found

### Issue 1: Login Card Title Not Using Linear Font Scale

- **Location**: `/login` page
- **Screenshot**: `page-login.png`
- **What I See**: Title uses `text-2xl` which maps to Tailwind's default 24px, not the Linear design system's 20px
- **Expected**: Should use `text-linear-2xl` (20px) for consistency with Linear design system
- **Suggested Fix**:
  - File: `src/app/(auth)/login/page.tsx`
  - Line: ~39
  - Change: `text-2xl` to `text-linear-2xl`

### Issue 2: Navigation Items Font Size Inconsistent

- **Location**: Sidebar navigation items
- **What I See**: Nav items use `text-sm` (14px Tailwind default) instead of Linear's `text-linear-sm` (12px)
- **Expected**: Per Linear design system, navigation items should use `text-linear-sm` (12px) for a more compact, refined look
- **Suggested Fix**:
  - File: `src/components/layout/Sidebar.tsx`
  - Line: ~48
  - Change: `text-sm` to `text-linear-sm`

### Issue 3: Navigation Icons Too Small

- **Location**: Sidebar navigation items
- **What I See**: Icons are `h-4 w-4` (16px) which feels slightly small relative to the nav item padding
- **Expected**: Icons should be `h-[18px] w-[18px]` for better visual balance with the 12px text
- **Suggested Fix**:
  - File: `src/components/layout/Sidebar.tsx`
  - Line: ~54
  - Change: `h-4 w-4` to `h-[18px] w-[18px]`

### Issue 4: Sidebar Logo Font Not Optimal

- **Location**: Sidebar header
- **What I See**: Logo text uses `font-semibold` with no explicit size
- **Expected**: Should use `text-linear-lg font-semibold tracking-tight` for a more polished brand presence
- **Suggested Fix**:
  - File: `src/components/layout/Sidebar.tsx`
  - Line: ~33
  - Change: `font-semibold text-linear-text-primary` to `text-linear-lg font-semibold tracking-tight text-linear-text-primary`

### Issue 5: Navigation Item Padding Needs Polish

- **Location**: Sidebar navigation items
- **What I See**: Nav items use `px-3 py-2` which feels slightly cramped vertically
- **Expected**: Should use `px-3 py-2.5` for better touch targets and visual breathing room
- **Suggested Fix**:
  - File: `src/components/layout/Sidebar.tsx`
  - Line: ~48
  - Change: `px-3 py-2` to `px-3 py-2.5`

### Issue 6: Navigation Active State Lacks Emphasis

- **Location**: Sidebar navigation items (active state)
- **What I See**: Active state uses `bg-linear-accent/10` which is quite subtle
- **Expected**: Should use `bg-linear-accent/15` and add a left border indicator for clearer visual feedback
- **Suggested Fix**:
  - File: `src/components/layout/Sidebar.tsx`
  - Line: ~49-51
  - Change active state classes to include border-left indicator

### Issue 7: Header Search Box Height Inconsistent

- **Location**: Header search trigger
- **What I See**: Search box uses `py-1.5` resulting in ~28px height, feels small
- **Expected**: Should use `py-2` for 32px height to match other header elements better
- **Suggested Fix**:
  - File: `src/components/layout/Header.tsx`
  - Line: ~23
  - Change: `py-1.5` to `py-2`

### Issue 8: Header Search Placeholder Text Size

- **Location**: Header search trigger
- **What I See**: Uses default `text-sm` (14px)
- **Expected**: Should use `text-linear-sm` (12px) for tighter, more refined look matching Linear aesthetic
- **Suggested Fix**:
  - File: `src/components/layout/Header.tsx`
  - Line: ~23
  - Add: `text-linear-sm`

### Issue 9: User Profile Section Padding

- **Location**: Sidebar user profile at bottom
- **What I See**: Uses `px-3 py-2` which doesn't align with nav item spacing
- **Expected**: Should use `px-3 py-2.5` to match updated nav item spacing
- **Suggested Fix**:
  - File: `src/components/layout/Sidebar.tsx`
  - Line: ~87
  - Change: `px-3 py-2` to `px-3 py-2.5`

### Issue 10: Button Text Size Not Using Linear Scale

- **Location**: Button component
- **What I See**: Button sizes use `text-xs` and `text-sm` (Tailwind defaults)
- **Expected**: Should use `text-linear-xs` (11px) and `text-linear-sm` (12px) for Linear consistency
- **Suggested Fix**:
  - File: `src/components/ui/Button.tsx`
  - Line: ~21-23
  - Change size variants to use Linear text scale

### Issue 11: Dashboard Title Too Large

- **Location**: Dashboard page greeting
- **What I See**: Uses `text-3xl` which is quite large (30px Tailwind default)
- **Expected**: Should use `text-linear-2xl` (20px) or max `text-2xl` for better hierarchy
- **Suggested Fix**:
  - File: `src/app/(dashboard)/page.tsx`
  - Line: ~111
  - Change: `text-3xl` to `text-2xl` or `text-linear-2xl`

---

## Iteration Tasks

> These tasks can be passed to `/implement iterate-layout-polish` for automated fixes

### Task 1: Update Sidebar Navigation Typography

- **File**: src/components/layout/Sidebar.tsx (MODIFY)
- **Do**:
  - Change nav item text from `text-sm` to `text-linear-sm`
  - Change nav item padding from `py-2` to `py-2.5`
  - Change icon size from `h-4 w-4` to `h-[18px] w-[18px]`
  - Update active state from `bg-linear-accent/10` to `bg-linear-accent/15` and add left border
- **Done when**: Nav items have 12px text, 18px icons, 2.5 vertical padding, and prominent active state

### Task 2: Polish Sidebar Logo and User Section

- **File**: src/components/layout/Sidebar.tsx (MODIFY)
- **Do**:
  - Update logo text to use `text-linear-lg font-semibold tracking-tight`
  - Update user section padding to match nav items
- **Done when**: Logo has proper sizing and tracking, user section aligns with nav items

### Task 3: Refine Header Search Box

- **File**: src/components/layout/Header.tsx (MODIFY)
- **Do**:
  - Change search box padding from `py-1.5` to `py-2`
  - Add `text-linear-sm` for placeholder text
- **Done when**: Search box is 32px height with 12px text

### Task 4: Update Button Component Typography

- **File**: src/components/ui/Button.tsx (MODIFY)
- **Do**:
  - Change `text-xs` to `text-linear-xs` in sm size
  - Change `text-sm` to `text-linear-sm` in md and lg sizes
- **Done when**: Button text uses Linear typography scale

### Task 5: Fix Login Page Title Typography

- **File**: src/app/(auth)/login/page.tsx (MODIFY)
- **Do**: Change `text-2xl` to `text-linear-2xl`
- **Done when**: Login title uses 20px Linear scale

### Task 6: Adjust Dashboard Greeting Size

- **File**: src/app/(dashboard)/page.tsx (MODIFY)
- **Do**: Change `text-3xl` to `text-2xl`
- **Done when**: Dashboard greeting uses appropriate hierarchy

---

## Verdict

- [x] **Issues found** - Run `/implement iterate-layout-polish` to fix, or make manual changes

---

## Design System Notes

The Linear design system uses a 13px base font size with the following scale:

- `linear-xs`: 11px
- `linear-sm`: 12px
- `linear-base`: 13px
- `linear-lg`: 14px
- `linear-xl`: 16px
- `linear-2xl`: 20px

Current implementation mixes Tailwind defaults (14px/16px/etc) with Linear scales, creating inconsistency. The fixes above ensure consistent use of the Linear typography system.
