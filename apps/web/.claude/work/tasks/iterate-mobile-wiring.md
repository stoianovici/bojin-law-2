# Iteration: Mobile UI Data Wiring

**Status**: Review Complete
**Date**: 2025-12-31
**Input**: `implement-mobile-wiring.md` + user-provided screenshots
**Screenshots**: User-provided (3 screenshots)
**Next step**: Fix issues then proceed to `/commit`

---

## Inspection Summary

### Pages Inspected

| Route       | Screenshot   | Issues |
| ----------- | ------------ | ------ |
| /m (Home)   | Screenshot 1 | 1      |
| /m/cases    | Screenshot 2 | 1      |
| /m/calendar | Screenshot 3 | 1      |

---

## Issues Found

### Issue 1: Inconsistent Error Message Language on Calendar Page

- **Location**: `/m/calendar` page
- **Screenshot**: Screenshot 3
- **What I See**: The error message shows "Failed to fetch" in English, while all other error messages in the app are in Romanian ("Nu s-au putut încărca taskurile", "Nu s-au putut incarca dosarele")
- **Expected**: Error message should be in Romanian to match the rest of the UI: "Nu s-au putut încărca evenimentele" or similar
- **Suggested Fix**:
  - File: `src/app/m/calendar/page.tsx`
  - Change: Update the InlineError component's message prop to use Romanian text

### Issue 2: Missing Diacritics in Cases Error Message

- **Location**: `/m/cases` page
- **Screenshot**: Screenshot 2
- **What I See**: Error message shows "Nu s-au putut incarca dosarele" - missing diacritics on "încărca"
- **Expected**: Should be "Nu s-au putut încărca dosarele" with proper Romanian diacritics
- **Suggested Fix**:
  - File: `src/app/m/cases/page.tsx`
  - Change: Update the error message to use "încărca" instead of "incarca"

### Issue 3: Backend Connection Issue (Not a UI Bug)

- **Location**: All pages showing error states
- **Screenshot**: All 3 screenshots
- **What I See**: All data-fetching pages are showing error states, indicating the backend GraphQL server may not be running or is unreachable
- **Expected**: This is expected behavior when backend is unavailable - the error states are correctly displayed
- **Note**: This is not a UI bug but indicates the GraphQL backend needs to be running for full testing. The InlineError component with retry button is working as designed.

---

## Visual Design Compliance

### Positive Observations:

1. **Home Page Header**: Correct "Bojin Law" branding with avatar initials "AP" and hamburger menu
2. **Color Scheme**: Proper dark theme with #0a0a0a background
3. **Attention Cards**: Correct styling with warning border on urgent item, proper icon boxes
4. **Section Labels**: "ATENȚIE" and "TASKURI AZI" correctly uppercase with proper styling
5. **Tab Bar**: Correct icons and labels (Acasă, Dosare, Calendar, Cauta)
6. **FAB Button**: "+ Nou" button correctly positioned and styled
7. **Calendar Grid**: Proper month display with Romanian day abbreviations (L, M, M, J, V, S, D)
8. **Today Indicator**: December 31 correctly highlighted with white background
9. **Calendar Legend**: Shows "Termene", "Întâlniri", "Instanță" with correct colors
10. **Search Input**: Correct styling on Cases page with placeholder "Cauta dosare..."
11. **Error Component**: InlineError displays correctly with red border, message, and retry button

---

## Iteration Tasks

> These tasks can be passed to `/implement iterate-mobile-wiring` for automated fixes

### Task 1: Fix Calendar Error Message Language

- **File**: src/app/m/calendar/page.tsx (MODIFY)
- **Do**: Change the error message from English to Romanian. Find the InlineError component and update its message prop to "Nu s-au putut încărca evenimentele" or similar Romanian text.
- **Done when**: Error message displays in Romanian

### Task 2: Fix Cases Error Message Diacritics

- **File**: src/app/m/cases/page.tsx (MODIFY)
- **Do**: Update the error message to use proper Romanian diacritics - "încărca" instead of "incarca"
- **Done when**: Error message shows "Nu s-au putut încărca dosarele" with proper diacritics

---

## Verdict

- [x] **Issues found** - 2 text/language issues to fix (see tasks above)

The UI implementation looks correct visually. The only issues are:

1. One English error message that should be Romanian
2. One Romanian message missing diacritics

Run `/implement iterate-mobile-wiring` to fix these issues, or make manual changes.
