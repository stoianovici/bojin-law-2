# Iteration: Cases Edit Button Navigation

**Status**: Review Complete
**Date**: 2026-01-02
**Input**: User report - Edit case button doesn't navigate to case edit screen
**Screenshots**: `.claude/work/screenshots/iterate-cases-edit/`
**Next step**: Create the missing edit page route

---

## Inspection Summary

### Pages Inspected

| Route                   | Screenshot              | Issues        |
| ----------------------- | ----------------------- | ------------- |
| /cases                  | page-cases.png          | 0             |
| /cases (with selection) | page-cases-selected.png | 0             |
| /cases/[id]/edit        | page-cases-edit-404.png | 1 (404 error) |

---

## Issues Found

### Issue 1: Missing Edit Case Route (404 Error)

- **Location**: `/cases/[id]/edit`
- **Screenshot**: `page-cases-edit-404.png`
- **What I See**: Clicking "Editeaza" button navigates to `/cases/e8ad09b8-3f06-434b-8b73-c35532f881e8/edit` which returns a 404 "This page could not be found" error
- **Expected**: Should display a case edit form similar to the new case form, pre-populated with existing case data
- **Root Cause**: The route handler `src/app/(dashboard)/cases/[id]/edit/page.tsx` does not exist

**Code Reference**:

- `src/app/(dashboard)/cases/page.tsx:200-203` - The onEdit callback routes to `/cases/${selectedCaseId}/edit`
- `src/app/(dashboard)/cases/new/page.tsx` - The new case form that could be adapted for editing

**Current Directory Structure**:

```
src/app/(dashboard)/cases/
├── new/
│   └── page.tsx    # Create new case form (exists)
└── page.tsx        # Cases list page (exists)
```

**Required Structure**:

```
src/app/(dashboard)/cases/
├── [id]/
│   └── edit/
│       └── page.tsx    # Edit case form (MISSING)
├── new/
│   └── page.tsx
└── page.tsx
```

---

## Iteration Tasks

> These tasks can be passed to `/implement iterate-cases-edit` for automated fixes

### Task 1: Create Edit Case Page

- **File**: `src/app/(dashboard)/cases/[id]/edit/page.tsx` (CREATE)
- **Do**:
  1. Create the directory structure `src/app/(dashboard)/cases/[id]/edit/`
  2. Create `page.tsx` based on the new case form (`/cases/new/page.tsx`)
  3. Fetch existing case data using the `[id]` param
  4. Pre-populate form fields with existing case data
  5. Change submit action from `createCase` to `updateCase` mutation
  6. Update page title from "Dosar Nou" to "Editeaza Dosar"
  7. Update button text from "Creează Dosar" to "Salvează Modificări"
- **Done when**:
  - Clicking "Editeaza" button on `/cases` navigates to edit page
  - Edit page displays with existing case data pre-filled
  - Saving changes updates the case successfully

### Task 2: Create/Verify Update Case Hook

- **File**: `src/hooks/mobile/useUpdateCase.ts` (CREATE if missing)
- **Do**: Create a hook similar to `useCreateCase` but for updating existing cases
- **Done when**: Hook can successfully update case data via GraphQL mutation

---

## Verdict

- [ ] **Issues found** - Run `/implement iterate-cases-edit` to fix, or make manual changes
- [x] **No issues** - Implementation looks good! Proceed to `/commit`

---

## Resolution

**Fixed on 2026-01-02**

Created the missing edit case page:

1. **Created `src/hooks/mobile/useUpdateCase.ts`** - Hook for updating cases via GraphQL mutation
2. **Created `src/app/(dashboard)/cases/[id]/edit/page.tsx`** - Edit case page that:
   - Fetches existing case data using `GET_CASE` query
   - Pre-populates form fields with existing values
   - Shows client as read-only (cannot be changed)
   - Uses `UPDATE_CASE` mutation to save changes
   - Proper loading and error states

**Screenshot**: `page-cases-edit-working.png` shows the working edit page with pre-populated data.

---

## Notes

The new case form at `src/app/(dashboard)/cases/new/page.tsx` is comprehensive (827 lines) and includes:

- Client selection/creation
- Case details (title, type, description)
- Team member assignment
- Court file numbers
- Email classification (keywords, domains)
- Billing settings (hourly/fixed)

The edit page should reuse most of this logic but:

1. Skip client selection (client is already set)
2. Load existing case data on mount
3. Use an update mutation instead of create
