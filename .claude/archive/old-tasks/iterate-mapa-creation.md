# Iteration: Mapa Creation Flows

**Status**: Review Complete
**Date**: 2026-01-08
**Input**: User request for mapa creation flows
**Screenshots**: `.claude/work/screenshots/iterate-mapa-creation/`
**Next step**: Fix issues with `/implement iterate-mapa-creation`

---

## Inspection Summary

### Pages Inspected (Code Review)

| Route            | Component          | Issues |
| ---------------- | ------------------ | ------ |
| /documents       | DocumentsPage      | 1      |
| /admin/templates | AdminTemplatesPage | 2      |

### Components Inspected

| Component          | File                                     | Issues |
| ------------------ | ---------------------------------------- | ------ |
| MapaDetail         | components/documents/MapaDetail.tsx      | 1      |
| CreateMapaModal    | components/documents/CreateMapaModal.tsx | 0      |
| TemplatePicker     | components/documents/TemplatePicker.tsx  | 0      |
| AdminTemplatesPage | app/(dashboard)/admin/templates/page.tsx | 2      |

---

## Issues Found

### Issue 1: Add Slot Button Not Functional

- **Location**: `/documents` page → MapaDetail view
- **File**: `apps/web/src/app/(dashboard)/documents/page.tsx:248`
- **What I See**: The "Adaugă slot" (Add slot) button in MapaDetail only logs to console
- **Expected**: Should open a modal to add a new slot to the mapa
- **Current Code**:
  ```tsx
  onAddSlot={() => console.log('Add slot')}
  ```
- **Suggested Fix**:
  1. Create an `AddSlotModal` component
  2. Wire up the `onAddSlot` handler to open this modal
  3. Use the existing `useAddSlot` hook from `useMapa.ts`

### Issue 2: No Dedicated Mapa Template Creation Screen

- **Location**: `/admin/templates` page
- **File**: `apps/web/src/app/(dashboard)/admin/templates/page.tsx`
- **What I See**: The "Șablon nou" (New template) button has no handler - just renders without onClick
- **Expected**: Should open a template creation flow/modal
- **Current Code** (line 120-123):
  ```tsx
  <Button variant="primary" size="sm">
    <Plus className="w-4 h-4 mr-2" />
    Șablon nou
  </Button>
  ```
- **Suggested Fix**:
  1. Create a `CreateTemplateModal` component
  2. Add onClick handler to the button
  3. Template creation should allow:
     - Name and description
     - Add/remove slot definitions
     - Set slot categories and required flags
     - Preview the template structure

### Issue 3: Template View/Edit Not Implemented

- **Location**: `/admin/templates` page
- **File**: `apps/web/src/app/(dashboard)/admin/templates/page.tsx:73-75`
- **What I See**: `handleViewTemplate` only logs to console
- **Expected**: Should navigate to template detail or open an edit modal
- **Current Code**:
  ```tsx
  const handleViewTemplate = (template: MapaTemplate) => {
    console.log('View template:', template.id);
    // TODO: Navigate to template detail or open modal
  };
  ```
- **Suggested Fix**:
  1. Create a `TemplateDetailModal` or dedicated route `/admin/templates/[id]`
  2. Show template slot definitions with edit capability (for firm templates)
  3. Read-only view for ONRC templates (they're locked)

---

## Iteration Tasks

> These tasks can be passed to `/implement iterate-mapa-creation` for automated fixes

### Task 1: Create AddSlotModal Component

- **File**: `apps/web/src/components/documents/AddSlotModal.tsx` (CREATE)
- **Do**: Create a modal component that allows users to add a new slot to a mapa with:
  - Slot name (required)
  - Description (optional)
  - Category selector (using `mapaCategories` from types/mapa.ts)
  - Required checkbox
  - Uses `useAddSlot` hook for mutation
- **Done when**: Modal opens when clicking "Adaugă slot" in MapaDetail, and successfully creates slots

### Task 2: Wire Up AddSlotModal in DocumentsPage

- **File**: `apps/web/src/app/(dashboard)/documents/page.tsx` (MODIFY)
- **Do**:
  - Import AddSlotModal
  - Add state for modal open/slot target
  - Replace console.log with handler that opens modal
  - Add onSuccess handler to refresh mapa data
- **Done when**: Clicking "Adaugă slot" opens the modal and creating slots works end-to-end

### Task 3: Create CreateTemplateModal Component

- **File**: `apps/web/src/components/admin/CreateTemplateModal.tsx` (CREATE)
- **Do**: Create a modal/wizard for creating new firm templates:
  - Step 1: Name, description, case type
  - Step 2: Add slot definitions (name, category, required, description)
  - Step 3: Review and create
  - Uses template creation hook/API
- **Done when**: Users can create custom firm templates from the admin page

### Task 4: Wire Up CreateTemplateModal in AdminTemplatesPage

- **File**: `apps/web/src/app/(dashboard)/admin/templates/page.tsx` (MODIFY)
- **Do**:
  - Import CreateTemplateModal
  - Add state for modal
  - Add onClick to "Șablon nou" button
  - Add onSuccess to refresh templates list
- **Done when**: Clicking "Șablon nou" opens the modal

### Task 5: Create TemplateDetailModal Component

- **File**: `apps/web/src/components/admin/TemplateDetailModal.tsx` (CREATE)
- **Do**: Create a modal showing template details:
  - Display all slot definitions grouped by category
  - Edit functionality for firm templates (not ONRC)
  - Delete/duplicate actions
  - Show usage count and metadata
- **Done when**: Clicking on a template shows its details

### Task 6: Wire Up TemplateDetailModal in AdminTemplatesPage

- **File**: `apps/web/src/app/(dashboard)/admin/templates/page.tsx` (MODIFY)
- **Do**:
  - Import TemplateDetailModal
  - Add state for selected template and modal
  - Update handleViewTemplate to open modal
- **Done when**: Clicking a template card shows its details in a modal

---

## Priority Order

1. **High Priority**: Tasks 1-2 (Add Slot functionality) - Core mapa workflow
2. **Medium Priority**: Tasks 3-4 (Template creation) - New template screen requested by user
3. **Lower Priority**: Tasks 5-6 (Template viewing/editing) - Enhancement to existing admin page

---

## Verdict

- [x] **Issues found** - Run `/implement iterate-mapa-creation` to fix, or make manual changes
- [ ] **No issues** - Implementation looks good! Proceed to `/commit`

---

## Additional Notes

### Existing Infrastructure Available

The codebase already has:

- `useAddSlot` hook in `useMapa.ts` (line 372-399) - ready to use
- `mapaCategories` constant in `types/mapa.ts` - for category dropdown
- `SlotDefinition` type - for template slot structure
- Modal pattern established with `CreateMapaModal`, `EditMapaModal`
- Template picker with slot preview pattern in `TemplatePicker.tsx`

### GraphQL Mutations Available

- `ADD_SLOT_TO_MAPA` mutation exists and works
- Template creation may need a new API endpoint (check useTemplates.ts)
