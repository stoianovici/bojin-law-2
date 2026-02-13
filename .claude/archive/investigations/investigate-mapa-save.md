# Investigation: Mapa from Template Not Saving

**Slug**: mapa-save
**Date**: 2026-01-12
**Status**: Fixed
**Severity**: High
**Fixed**: 2026-01-12

---

## Bug Summary

**Reported symptom**: Creating a mapa from a template doesn't work - the modal stays on screen with no error message after clicking save.

**Reproduction steps**:

1. Open the documents/mapa section
2. Click "Create Mapa" button
3. Select a template from the template picker (e.g., an ONRC template)
4. Name gets auto-filled from template
5. Click "Creează mapă" (Create mapa)
6. Modal stays open, no error, no success

**Expected behavior**: Modal should close and new mapa should appear in the list

**Actual behavior**: Modal stays open indefinitely, no feedback provided

**Frequency**: Always (every time a template is selected)

---

## Root Cause Analysis

### The Bug

**Root cause**: Template ID format mismatch between frontend static data and backend database lookup.

**Location**:

- Frontend: `apps/web/src/lib/onrc/templates-data.ts:1988` - generates IDs as `onrc-${procedureId}`
- Backend: `services/gateway/src/services/mapa.service.ts:145-147` - looks up by database UUID

**Code path**:

```
User selects template → CreateMapaModal stores selectedTemplate → handleSubmit calls createFromTemplate →
useCreateMapaFromTemplate sends mutation with templateId: "onrc-XX" → Backend resolver calls mapaService.createMapaFromTemplate →
Prisma findUnique({ where: { id: "onrc-XX" } }) → Returns null → Throws "Template not found"
```

**Type**: Data/Integration bug - frontend and backend disagree on template data source

### Why It Happens

The system has two sources of template data that are not synchronized:

1. **Frontend static templates** (`/api/templates` route):
   - Serves templates from `ONRC_TEMPLATES` in `templates-data.ts`
   - IDs are formatted as `onrc-{procedureId}` (e.g., `onrc-12`)
   - These are TypeScript constants, not database records
   - Comment says: "This is the source of truth - no database needed"

2. **Backend database templates** (`mapaService.createMapaFromTemplate`):
   - Looks up templates in `MapaTemplate` table by `id` (UUID)
   - Expects database records with UUID primary keys
   - ONRC templates in DB would have `procedureId: "12"` but `id: UUID`

When the user selects a template:

- Frontend has template object with `id: "onrc-12"`
- Mutation sends `templateId: "onrc-12"` to backend
- Backend does `prisma.mapaTemplate.findUnique({ where: { id: "onrc-12" } })`
- This fails because "onrc-12" is not a valid UUID and no such record exists
- Backend throws "Template not found" error

### Why the Error Isn't Displayed

The error likely isn't propagating to the UI due to Apollo Client error handling:

```typescript
// useTemplates.ts:201-208
const result = await apolloClient.mutate<...>({...});
return result.data?.createMapaFromTemplate ?? null;
```

If GraphQL returns errors in `result.errors` (rather than throwing), this code returns `null` without checking for errors. The `catch` block only catches thrown exceptions, not GraphQL response errors.

### Why It Wasn't Caught

1. The two template sources were designed independently
2. No integration test covers selecting a template from the picker and creating a mapa
3. The frontend template API was added later as "source of truth" without updating the mutation path
4. Apollo error handling silently returns `null` instead of surfacing the error

---

## Impact Assessment

**Affected functionality**:

- Creating mape from ONRC templates (58 templates affected)
- Creating mape from firm templates (if using mock data)

**Blast radius**: Moderate - All template-based mapa creation is broken

**Related code**:

- `apps/web/src/hooks/useTemplates.ts`: `useCreateMapaFromTemplate` hook
- `apps/web/src/graphql/template.ts`: `CREATE_MAPA_FROM_TEMPLATE` mutation
- `services/gateway/src/services/mapa.service.ts`: `createMapaFromTemplate` method
- `apps/web/src/app/api/templates/route.ts`: Template API serving static data

**Risk of similar bugs**: Medium - Other features might assume templates are in the database

---

## Proposed Fix Approaches

### Option A: Backend reads static templates (Recommended)

**Approach**: Modify `createMapaFromTemplate` to handle `onrc-XX` IDs by reading from static template data instead of database.

**Files to change**:

- `services/gateway/src/services/mapa.service.ts`: Add fallback to static ONRC template lookup
- Create or import ONRC template data in gateway service

**Pros**:

- Aligns with frontend "source of truth" approach
- No database sync needed
- Matches the documented design decision

**Cons**:

- Need to share template data between web and gateway
- Slight code duplication

**Risk**: Low

### Option B: Sync templates to database before use

**Approach**: Before creating a mapa from template, ensure ONRC templates are synced to the database.

**Files to change**:

- Trigger `saveONRCTemplates` mutation on app startup or admin action
- Possibly change frontend to use database template IDs after sync

**Pros**:

- Single source of truth in database
- Consistent UUID-based lookups

**Cons**:

- Requires sync mechanism to run
- Templates could get out of sync
- More complex deployment story

**Risk**: Medium

### Option C: Change mutation to use procedureId

**Approach**: Modify mutation to accept `procedureId` instead of `templateId`, look up by that field.

**Files to change**:

- `apps/web/src/graphql/template.ts`: Change mutation variable
- `services/gateway/src/graphql/schema/mapa.graphql`: Update mutation signature
- `services/gateway/src/services/mapa.service.ts`: Look up by procedureId

**Pros**:

- Minimal change, uses existing field
- Database already has procedureId indexed

**Cons**:

- Assumes templates ARE in database (still breaks if not synced)
- Only works for ONRC templates, not firm templates

**Risk**: Medium

### Recommendation

**Option A** is recommended because:

1. It aligns with the documented design that static templates are "source of truth"
2. It doesn't require database sync to work
3. It handles the immediate issue cleanly

Additionally, fix the error handling in `useCreateMapaFromTemplate` to properly surface GraphQL errors to the UI.

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Original bug no longer reproduces - creating mapa from ONRC template works
2. [ ] Mapa is created with correct name from template
3. [ ] Mapa has all slots from the template's slotDefinitions
4. [ ] Creating a blank mapa (no template) still works
5. [ ] Errors are properly displayed in the modal if they occur
6. [ ] Template selection can be cleared and mapa created without template

### Suggested Test Cases

```typescript
// mapa.service.test.ts
describe('createMapaFromTemplate', () => {
  it('should create mapa from ONRC template using onrc-XX ID format', () => {
    // Use templateId like "onrc-12"
  });

  it('should create mapa from database template using UUID', () => {
    // For firm-specific templates
  });

  it('should throw error for invalid template ID', () => {
    // Verify proper error message
  });
});
```

---

## Investigation Notes

### Files Examined

| File                                                    | Purpose                | Relevant Finding                                      |
| ------------------------------------------------------- | ---------------------- | ----------------------------------------------------- |
| `apps/web/src/components/documents/CreateMapaModal.tsx` | Modal component        | Calls `createFromTemplate` with `selectedTemplate.id` |
| `apps/web/src/hooks/useTemplates.ts`                    | Template mutation hook | Does not check `result.errors`, returns null silently |
| `apps/web/src/graphql/template.ts`                      | GraphQL mutation       | `templateId: String!` (not UUID)                      |
| `apps/web/src/lib/onrc/templates-data.ts`               | Static ONRC data       | IDs are `onrc-${procedureId}` format                  |
| `apps/web/src/app/api/templates/route.ts`               | Template API           | Serves static ONRC_TEMPLATES data                     |
| `services/gateway/src/services/mapa.service.ts`         | Mapa service           | Looks up template by `id` as UUID in database         |

### Git History

Recent changes to template and mapa files are in uncommitted changes (working directory modified).

### Questions Answered During Investigation

- Q: Why doesn't an error show?
- A: Apollo Client returns errors in `result.errors` but the hook only catches thrown exceptions. `result.data?.createMapaFromTemplate ?? null` returns null silently.

- Q: Where do templates come from?
- A: Frontend uses static TypeScript data served via `/api/templates`. Backend expects database records.

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug mapa-save
```

The debug phase will:

1. Read this investigation document
2. Propose the specific implementation
3. Get approval before making changes
4. Implement and verify the fix
