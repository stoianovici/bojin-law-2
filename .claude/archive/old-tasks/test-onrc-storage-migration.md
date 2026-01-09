# Test: ONRC Template Storage Migration

**Status**: PASS
**Date**: 2026-01-05
**Input**: Direct verification (no implement doc)
**Decisions**: 6/6 passing

---

## Test Results

| Decision                   | Exists | Integrated | Functional | Status |
| -------------------------- | ------ | ---------- | ---------- | ------ |
| Prisma schema ONRC fields  | Yes    | Yes        | Yes        | PASS   |
| GraphQL schema additions   | Yes    | Yes        | Yes        | PASS   |
| Resolver implementations   | Yes    | Yes        | Yes        | PASS   |
| Storage service rewrite    | Yes    | Yes        | Yes        | PASS   |
| Body parser limit increase | Yes    | Yes        | Yes        | PASS   |
| Type definitions update    | Yes    | Yes        | Yes        | PASS   |

---

## Verification Details

### 1. Prisma Schema ONRC Fields - PASS

**Location**: `packages/database/prisma/schema.prisma:4251-4275`

**Verified**:

- `isONRC` Boolean field added (line 4251)
- `isLocked` Boolean field added (line 4252)
- `procedureId` unique String field added (line 4253)
- `sourceUrl` String field added (line 4254)
- `lastSynced` DateTime field added (line 4255)
- `contentHash` String field added (line 4256)
- `aiMetadata` Json field added (line 4260)
- `firmId` and `createdById` made optional for system templates
- Index on `isONRC` added (line 4275)

### 2. GraphQL Schema Additions - PASS

**Location**: `services/gateway/src/graphql/schema/mapa.graphql`

**Verified**:

- `ONRCSyncResult` type defined (line 175)
- `ONRCSyncError` type defined
- `ONRCSyncStatus` type defined
- `ONRCTemplateInput` input type defined
- `onrcTemplates` query added (line 422)
- `onrcSyncStatus` query added (line 429)
- `saveONRCTemplates` mutation added (line 584)
- MapaTemplate type extended with ONRC fields

### 3. Resolver Implementations - PASS

**Location**: `services/gateway/src/graphql/resolvers/mapa.resolvers.ts`

**Verified**:

- `onrcTemplates` query resolver (line 178)
- `onrcSyncStatus` query resolver (line 189)
- `saveONRCTemplates` mutation resolver (line 410)
- Partner role check for sync operations
- Proper upsert by `procedureId` (unique constraint)
- JSON type casting for Prisma compatibility

### 4. Storage Service Rewrite - PASS

**Location**: `apps/web/src/lib/onrc/storage.ts`

**Verified**:

- Old file-based code completely removed (no `fs`, `writeFileSync`, `/tmp` references)
- `getServerGatewayUrl()` function for server-side URL resolution (line 12)
- `SAVE_ONRC_TEMPLATES_MUTATION` GraphQL mutation (line 31)
- `graphqlRequest()` helper function (line 96)
- `saveTemplates()` calls GraphQL mutation (line 172)
- `getLastSyncInfo()` calls GraphQL query (line 195)
- `getStoredTemplates()` calls GraphQL query (line 227)
- Environment-aware gateway URL (production vs development)

### 5. Body Parser Limit Increase - PASS

**Location**: `services/gateway/src/index.ts:68-69`

**Verified**:

```typescript
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```

### 6. Type Definitions Update - PASS

**Location**: `apps/web/src/types/mapa.ts`

**Verified**:

- `firmId: string | null` - nullable for ONRC templates (line 93)
- `createdBy: UserSummary | null` - nullable for ONRC templates (line 100)
- `category?: string` - optional in SlotDefinition (line 127)

---

## Functional Verification

### Database Storage Test - PASS

```sql
SELECT COUNT(*) as total, COUNT(ai_metadata) as with_ai FROM mapa_templates WHERE is_onrc = true;

 total | with_ai
-------+---------
    58 |      58
```

**Result**: All 58 ONRC templates are stored in the database with AI metadata.

### Template Data Integrity - PASS

```sql
SELECT procedure_id, name, is_onrc, is_locked, ai_metadata IS NOT NULL as has_ai
FROM mapa_templates WHERE is_onrc = true LIMIT 5;

            procedure_id            |                name                | is_onrc | is_locked | has_ai
------------------------------------+------------------------------------+---------+-----------+--------
 onrc-actualizare-obiect-activitate | Actualizarea obiectului de activitate | t    | t         | t
 onrc-desfiintare-if                | Desființare IF                        | t    | t         | t
 ...
```

**Result**: Templates have correct flags (`is_onrc=true`, `is_locked=true`) and AI metadata.

### Statistics Verification - PASS

```sql
SELECT AVG(jsonb_array_length(slot_definitions::jsonb))::numeric(10,1) as avg_slots
FROM mapa_templates WHERE is_onrc = true;

 avg_slots
-----------
      11.4
```

**Result**: Average 11.4 slots per template matches sync output.

### Type Safety - PASS

```bash
pnpm --filter gateway exec tsc --noEmit 2>&1 | grep -E "mapa|storage"
# No output - no type errors
```

---

## Issues Found

None.

---

## Recommendation

All Decisions verified. Proceed to `/commit`.

### Summary of Changes Ready to Commit:

1. **Prisma Schema** - Added ONRC fields to MapaTemplate model
2. **GraphQL Schema** - Added ONRC types, queries, and mutation
3. **Resolvers** - Implemented ONRC template CRUD operations
4. **Storage Service** - Rewrote to use database instead of `/tmp`
5. **Gateway Config** - Increased body parser limit to 10MB
6. **Type Definitions** - Updated to support nullable fields for system templates

### Files Changed:

- `packages/database/prisma/schema.prisma`
- `services/gateway/src/graphql/schema/mapa.graphql`
- `services/gateway/src/graphql/resolvers/mapa.resolvers.ts`
- `services/gateway/src/index.ts`
- `apps/web/src/lib/onrc/storage.ts`
- `apps/web/src/types/mapa.ts`
