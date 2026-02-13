# Investigation: Admin AI Models Not Showing in Dropdown

**Slug**: admin-ai-models
**Date**: 2026-01-10
**Status**: Investigation Complete
**Severity**: Low
**Next step**: `/debug admin-ai-models` to implement fix

---

## Bug Summary

**Reported symptom**: Earlier work to add more Anthropic models to the AI admin page isn't visible in the /admin/ai dropdowns.

**Reproduction steps**:

1. Log in as Partner/Admin
2. Navigate to /admin/ai
3. Look at the model dropdown for any AI service

**Expected behavior**: Should see all available models including version distinctions (e.g., Sonnet 4 vs Sonnet 4.5)

**Actual behavior**: Only shows generic "Haiku", "Sonnet", "Opus" options

**Frequency**: Always

---

## Root Cause Analysis

### The Bug

**Root cause**: The frontend admin page uses a hardcoded `MODEL_OPTIONS` array instead of fetching the available models from the backend GraphQL API.

**Location**: `apps/web/src/app/(dashboard)/admin/ai/page.tsx:77-81`

**Code path**:

```
Backend AI_MODELS array (6 models) → GraphQL aiAvailableModels query → [NEVER CALLED] → Hardcoded MODEL_OPTIONS (3 generic options)
```

**Type**: Integration bug - frontend/backend disconnect

### Why It Happens

The backend implementation is complete:

1. **Backend model list** (`services/gateway/src/services/ai-client.service.ts:89-137`):

   ```typescript
   export const AI_MODELS: AIModelInfo[] = [
     { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', category: 'haiku', ... },
     { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', category: 'haiku', ... },
     { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', category: 'sonnet', ... },
     { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', category: 'sonnet', ... },
     { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', category: 'opus', ... },
     { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', category: 'opus', ... },
   ];
   ```

2. **GraphQL resolver** (`services/gateway/src/graphql/resolvers/ai-ops.resolvers.ts:117-129`):

   ```typescript
   aiAvailableModels: (_: unknown, __: unknown, context: Context) => {
     requirePartner(context);
     const models = getAvailableModels();
     return models.map((m) => ({ ... }));
   };
   ```

3. **GraphQL query** defined (`apps/web/src/graphql/admin-ai.ts:63-74`):

   ```graphql
   query AIAvailableModels {
     aiAvailableModels {
       id
       name
       category
       inputCostPerMillion
       outputCostPerMillion
       isDefault
     }
   }
   ```

4. **BUT the hook never uses it** (`apps/web/src/hooks/useAdminAI.ts`):
   - The hook imports the query but never calls `useQuery(AI_AVAILABLE_MODELS)`
   - Does not return available models in its return value

5. **Page uses hardcoded fallback** (`apps/web/src/app/(dashboard)/admin/ai/page.tsx:77-81`):
   ```typescript
   const MODEL_OPTIONS = [
     { value: 'haiku', label: 'Haiku', description: 'Rapid, costuri reduse' },
     { value: 'sonnet', label: 'Sonnet', description: 'Echilibrat' },
     { value: 'opus', label: 'Opus', description: 'Performanță maximă' },
   ];
   ```

### Why It Wasn't Caught

- The backend work was completed (API exists and works)
- The GraphQL query was defined
- But the frontend integration step (fetching and using the data) was never implemented
- The page had a hardcoded fallback that "worked" so no error was visible

---

## Impact Assessment

**Affected functionality**:

- Model selection in /admin/ai dropdowns
- Admin ability to select specific model versions

**Blast radius**: Localized - only affects the admin AI configuration page

**Related code**:

- `apps/web/src/hooks/useAdminAI.ts`: Needs to fetch and expose available models
- `apps/web/src/app/(dashboard)/admin/ai/page.tsx`: Needs to use dynamic model list

**Risk of similar bugs**: Low - this appears to be an incomplete feature rollout

---

## Proposed Fix Approaches

### Option A: Update useAdminAI hook and page (Recommended)

**Approach**: Add the missing query to the hook and update the page to use dynamic data

**Files to change**:

- `apps/web/src/hooks/useAdminAI.ts`: Add useQuery for AI_AVAILABLE_MODELS, return availableModels
- `apps/web/src/app/(dashboard)/admin/ai/page.tsx`: Remove hardcoded MODEL_OPTIONS, use hook data

**Pros**:

- Uses existing infrastructure
- Models stay in sync with backend automatically
- Shows pricing info from API

**Cons**:

- None significant

**Risk**: Low

### Option B: Keep hardcoded list but expand it

**Approach**: Update the hardcoded MODEL_OPTIONS to include all models

**Files to change**:

- `apps/web/src/app/(dashboard)/admin/ai/page.tsx`: Expand MODEL_OPTIONS array

**Pros**:

- Quick fix
- No new API calls

**Cons**:

- Needs manual updates when models change
- Won't show pricing info
- Duplicates data that exists in backend

**Risk**: Low but creates tech debt

### Recommendation

**Option A** - Use the existing GraphQL API. The infrastructure is already in place; we just need to connect the wires.

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] /admin/ai page loads successfully
2. [ ] Model dropdown shows all 6 models with proper names
3. [ ] Models are grouped/ordered logically (by category or by capability)
4. [ ] Selecting a specific model version works
5. [ ] Override persists after page refresh

### Suggested Test Cases

Manual verification:

1. Log in as Partner
2. Navigate to /admin/ai
3. Click model dropdown for any service
4. Verify all models appear with version info
5. Select "Claude Sonnet 4.5", save, refresh, verify selection persists

---

## Investigation Notes

### Files Examined

| File                                                         | Purpose          | Relevant Finding                             |
| ------------------------------------------------------------ | ---------------- | -------------------------------------------- |
| `apps/web/src/app/(dashboard)/admin/ai/page.tsx`             | Admin AI page    | Has hardcoded MODEL_OPTIONS                  |
| `apps/web/src/hooks/useAdminAI.ts`                           | Data hook        | Missing AI_AVAILABLE_MODELS query            |
| `apps/web/src/graphql/admin-ai.ts`                           | GraphQL queries  | AI_AVAILABLE_MODELS query defined but unused |
| `services/gateway/src/services/ai-client.service.ts`         | Backend models   | Full AI_MODELS array with 6 models           |
| `services/gateway/src/graphql/resolvers/ai-ops.resolvers.ts` | GraphQL resolver | aiAvailableModels resolver works             |

### Git History

No recent commits related to this feature. The backend work appears complete but frontend integration was missed.

### Questions Answered During Investigation

- Q: Was the model expansion work done?
- A: Partially. Backend API is complete. Frontend integration was not completed.

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug admin-ai-models
```

The debug phase will:

1. Read this investigation document
2. Propose the specific implementation
3. Get approval before making changes
4. Implement and verify the fix
