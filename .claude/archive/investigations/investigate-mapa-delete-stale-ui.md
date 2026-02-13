# Investigation: Deleted Mapa Remains Visible Until Hard Refresh

**Slug**: mapa-delete-stale-ui
**Date**: 2026-01-12
**Status**: Investigation Complete
**Severity**: Medium
**Next step**: `/debug mapa-delete-stale-ui` to implement fix

---

## Bug Summary

**Reported symptom**: When a mapa is deleted, the UI keeps it until next hard refresh

**Reproduction steps**:

1. Navigate to Documents page
2. Click on a mapa in the sidebar to view it
3. Open the "More Actions" dropdown menu
4. Click "Sterge mapa" (Delete mapa)
5. Confirm deletion in the dialog
6. Observe that the UI navigates back to the case, but the deleted mapa still appears in the sidebar

**Expected behavior**: After deletion, the mapa should immediately disappear from the sidebar and all views

**Actual behavior**: The deleted mapa remains visible in the sidebar until a hard refresh (F5)

**Frequency**: Always

---

## Root Cause Analysis

### The Bug

**Root cause**: The `handleMapaDeleted` callback in `DocumentsPage` does not trigger a refetch of the mapas list after deletion.

**Location**: `apps/web/src/app/(dashboard)/documents/page.tsx:301-308`

**Code path**:

```
DeleteMapaDialog (confirm click)
  → useDeleteMapa.deleteMapa(id)
  → Apollo mutation succeeds
  → onSuccess callback called
  → handleMapaDeleted()
  → setSidebarSelection() [navigates away]
  → MISSING: setMapasVersion() to trigger refetch
```

**Type**: State bug - Incorrect state management after mutation

### Why It Happens

The documents page maintains a local state (`allMapas`) that caches all fetched mapas. This state is updated by a `useEffect` that runs when `caseIdsKey` or `mapasVersion` changes.

The pattern for updating state after mutations is:

1. Perform the mutation
2. Increment `mapasVersion` to trigger the refetch useEffect
3. The useEffect fetches fresh data from the server

This pattern is correctly implemented for:

- **Create mapa** (`handleMapaCreated`, line 271-279): calls `setMapasVersion((v) => v + 1)`
- **Add slot** (line 413-416): calls `setMapasVersion((v) => v + 1)`

However, **delete mapa** (`handleMapaDeleted`, line 301-308) only navigates away without incrementing `mapasVersion`:

```javascript
const handleMapaDeleted = () => {
  console.log('Mapa deleted');
  // Navigate back to the case
  if (viewingMapa) {
    setSidebarSelection({ type: 'case', caseId: viewingMapa.caseId });
  }
  // TODO: Refetch cases to update sidebar  <-- Never implemented!
};
```

The `TODO` comment on line 307 explicitly acknowledges the missing functionality.

### Why It Wasn't Caught

1. **No automated tests** for the delete flow that verify UI state updates
2. **The TODO comment** suggests this was known but deprioritized
3. **Manual testing likely missed it** because the deletion "appears to work" (dialog closes, view changes) - you only notice the stale data when looking at the sidebar

---

## Impact Assessment

**Affected functionality**:

- Documents page sidebar shows stale mapa list
- If user re-selects the deleted mapa from sidebar, it may cause errors or show stale data

**Blast radius**: Localized - only affects the Documents page after mapa deletion

**Related code**:

- `apps/web/src/components/documents/MapaDetail.tsx`: Triggers the deletion via DeleteMapaDialog
- `apps/web/src/hooks/useMapa.ts`: The `useDeleteMapa` hook performs the mutation
- `apps/web/src/store/documentsStore.ts`: Could potentially be used for optimistic updates

**Risk of similar bugs**: Medium - The same pattern (missing refetch after mutation) could exist for other mutations. The `handleMapaUpdated` callback (line 296-299) also has a `TODO` comment suggesting incomplete implementation.

---

## Proposed Fix Approaches

### Option A: Increment mapasVersion (Recommended)

**Approach**: Add `setMapasVersion((v) => v + 1)` to `handleMapaDeleted`, following the same pattern as `handleMapaCreated`.

**Files to change**:

- `apps/web/src/app/(dashboard)/documents/page.tsx`: Add one line to `handleMapaDeleted`

**Code change**:

```javascript
const handleMapaDeleted = () => {
  console.log('Mapa deleted');
  // Refresh mapas list to remove the deleted one
  setMapasVersion((v) => v + 1);
  // Navigate back to the case
  if (viewingMapa) {
    setSidebarSelection({ type: 'case', caseId: viewingMapa.caseId });
  }
};
```

**Pros**:

- Simple one-line fix
- Follows existing pattern in the codebase
- Consistent with how `handleMapaCreated` works

**Cons**:

- Triggers a network request to refetch all mapas (not strictly necessary since we know which one was deleted)

**Risk**: Low

### Option B: Optimistic Update (Filter from local state)

**Approach**: Instead of refetching, immediately filter the deleted mapa from `allMapas` state.

**Files to change**:

- `apps/web/src/app/(dashboard)/documents/page.tsx`: Modify `handleMapaDeleted` and potentially `DeleteMapaDialog` to pass the mapa ID

**Code change**:

```javascript
const handleMapaDeleted = (deletedMapaId: string) => {
  console.log('Mapa deleted:', deletedMapaId);
  // Optimistically remove from local state
  setAllMapas((prev) => prev.filter((m) => m.id !== deletedMapaId));
  // Navigate back to the case
  if (viewingMapa) {
    setSidebarSelection({ type: 'case', caseId: viewingMapa.caseId });
  }
};
```

**Pros**:

- No network request needed
- Instant UI update

**Cons**:

- More complex change (need to pass mapa ID through callback chain)
- If deletion failed server-side but the callback ran, UI would be out of sync

**Risk**: Medium

### Recommendation

**Option A** is recommended. It's a minimal change that follows the existing pattern and ensures the UI stays in sync with server state. The extra network request is acceptable for this use case.

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Original bug no longer reproduces - deleted mapa disappears from sidebar immediately
2. [ ] Mapa creation still works - new mapa appears in sidebar
3. [ ] Adding slots still works and updates the UI
4. [ ] Navigation works correctly after deletion (lands on case view)
5. [ ] Deleting multiple mapas in sequence works correctly

### Suggested Test Cases

If adding automated tests:

```typescript
// apps/web/src/app/(dashboard)/documents/page.test.tsx
describe('DocumentsPage mapa deletion', () => {
  it('should remove mapa from sidebar after deletion', async () => {
    // Setup: render page with a mapa
    // Action: trigger deletion flow
    // Assert: mapa no longer appears in sidebar
  });

  it('should navigate to case view after mapa deletion', async () => {
    // Setup: render page viewing a mapa
    // Action: delete the mapa
    // Assert: sidebar selection is case view
  });
});
```

---

## Investigation Notes

### Files Examined

| File                   | Purpose                              | Relevant Finding                                                |
| ---------------------- | ------------------------------------ | --------------------------------------------------------------- |
| `DeleteMapaDialog.tsx` | UI component for delete confirmation | Calls `onSuccess` callback after successful deletion            |
| `useMapa.ts`           | Hook with `useDeleteMapa`            | Mutation works correctly, returns boolean                       |
| `MapaDetail.tsx`       | Mapa detail view                     | Passes `onMapaDeleted` to DeleteMapaDialog                      |
| `documents/page.tsx`   | Main documents page                  | **Missing `setMapasVersion` call in `handleMapaDeleted`**       |
| `documentsStore.ts`    | Zustand store                        | Not directly involved, but could be used for optimistic updates |
| `graphql/mapa.ts`      | GraphQL queries/mutations            | DELETE_MAPA mutation is properly defined                        |

### Git History

No recent changes to the deletion flow. The `TODO` comment suggests this was known since initial implementation.

### Questions Answered During Investigation

- Q: Is the backend deletion working?
- A: Yes, the Apollo mutation succeeds. The bug is purely in the frontend state management.

- Q: Why does hard refresh fix it?
- A: Hard refresh reloads the page, which fetches fresh data from the server. The `useEffect` runs again with the latest `caseIdsKey` and fetches mapas that no longer include the deleted one.

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug mapa-delete-stale-ui
```

The debug phase will:

1. Read this investigation document
2. Propose the specific implementation (Option A recommended)
3. Get approval before making changes
4. Implement and verify the fix
