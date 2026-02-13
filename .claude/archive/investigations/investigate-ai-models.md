# Investigation: AI Dashboard Missing Latest Anthropic Models

**Slug**: ai-models
**Date**: 2026-01-10
**Status**: Investigation Complete
**Severity**: Medium
**Next step**: `/debug ai-models` to implement fix

---

## Bug Summary

**Reported symptom**: AI dashboard doesn't have access to the latest Anthropic models (Opus 4.5, Sonnet 4.5, Haiku 4.5) plus the tier below these.

**Reproduction steps**:

1. Go to the AI dashboard (admin panel)
2. View available models for feature configuration
3. Notice some latest models are missing or have incorrect IDs

**Expected behavior**: Should have access to ALL model families, both latest AND prior tier:

| Family     | Latest (4.5) | Model ID                     | Prior Tier | Model ID                   |
| ---------- | ------------ | ---------------------------- | ---------- | -------------------------- |
| **Haiku**  | Haiku 4.5    | `claude-haiku-4-5-20251001`  | Haiku 3    | `claude-3-haiku-20240307`  |
| **Sonnet** | Sonnet 4.5   | `claude-sonnet-4-5-20250929` | Sonnet 4   | `claude-sonnet-4-20250514` |
| **Opus**   | Opus 4.5     | `claude-opus-4-5-20251101`   | Opus 4     | `claude-opus-4-20250514`   |

Total: 6 models (3 latest + 3 prior)

**Note**: There is no Haiku 4 - Anthropic went from Haiku 3 directly to Haiku 4.5.

**Actual behavior**: The `AI_MODELS` array in `services/gateway/src/services/ai-client.service.ts` has several issues:

1. Sonnet 4.5 has WRONG model ID (`claude-sonnet-4-20250514` instead of `claude-sonnet-4-5-20250929`)
2. Haiku 4.5 has WRONG model ID (`claude-haiku-4-5-20250514` instead of `claude-haiku-4-5-20251001`)
3. Contains outdated legacy models (Claude 3.5 Sonnet, Claude 3 Opus) that clutter the list

**Frequency**: Always

---

## Root Cause Analysis

### The Bug

**Root cause**: The `AI_MODELS` array has incorrect model IDs that don't match Anthropic's actual API.

**Location**: `services/gateway/src/services/ai-client.service.ts:90-152`

**Code path**:

```
Admin Dashboard → GraphQL aiAvailableModels query → getAvailableModels() → AI_MODELS array
```

**Type**: Data bug - incorrect model configuration data

### Why It Happens

The `AI_MODELS` array was created with incorrect model IDs:

1. **Wrong Sonnet 4.5 model ID** (lines 122-128):

   ```typescript
   {
     id: 'claude-sonnet-4-20250514',  // WRONG! This is Sonnet 4, not 4.5
     name: 'Claude Sonnet 4.5',
     ...
   }
   ```

   **Correct ID**: `claude-sonnet-4-5-20250929`

2. **Wrong Haiku 4.5 model ID** (lines 100-105):

   ```typescript
   {
     id: 'claude-haiku-4-5-20250514',  // WRONG date!
     name: 'Claude Haiku 4.5',
     ...
   }
   ```

   **Correct ID**: `claude-haiku-4-5-20251001`

3. **Duplicate entry**: Both "Claude Sonnet 4" and "Claude Sonnet 4.5" have the same ID

### Current AI_MODELS Array vs Correct Values

| Model Name        | ID in Code                   | Correct ID                   | Status                       |
| ----------------- | ---------------------------- | ---------------------------- | ---------------------------- |
| Claude 3 Haiku    | `claude-3-haiku-20240307`    | `claude-3-haiku-20240307`    | OK - keep as prior tier      |
| Claude Haiku 4.5  | `claude-haiku-4-5-20250514`  | `claude-haiku-4-5-20251001`  | **FIX: wrong date**          |
| Claude 3.5 Sonnet | `claude-3-5-sonnet-20241022` | —                            | **REMOVE: too old**          |
| Claude Sonnet 4   | `claude-sonnet-4-20250514`   | `claude-sonnet-4-20250514`   | OK - keep as prior tier      |
| Claude Sonnet 4.5 | `claude-sonnet-4-20250514`   | `claude-sonnet-4-5-20250929` | **FIX: completely wrong ID** |
| Claude 3 Opus     | `claude-3-opus-20240229`     | —                            | **REMOVE: too old**          |
| Claude Opus 4     | `claude-opus-4-20250514`     | `claude-opus-4-20250514`     | OK - keep as prior tier      |
| Claude Opus 4.5   | `claude-opus-4-5-20251101`   | `claude-opus-4-5-20251101`   | OK                           |

### Official Anthropic Pricing (January 2026)

Source: [platform.claude.com/docs/en/about-claude/models/overview](https://platform.claude.com/docs/en/about-claude/models/overview)

**Latest Models (4.5 tier)**:
| Model | Model ID | Input/MTok | Output/MTok |
|-------|----------|------------|-------------|
| Opus 4.5 | `claude-opus-4-5-20251101` | $5 | $25 |
| Sonnet 4.5 | `claude-sonnet-4-5-20250929` | $3 | $15 |
| Haiku 4.5 | `claude-haiku-4-5-20251001` | $1 | $5 |

**Prior Tier (Legacy)**:
| Model | Model ID | Input/MTok | Output/MTok |
|-------|----------|------------|-------------|
| Opus 4 | `claude-opus-4-20250514` | $15 | $75 |
| Sonnet 4 | `claude-sonnet-4-20250514` | $3 | $15 |
| Haiku 3 | `claude-3-haiku-20240307` | $0.25 | $1.25 |

### Why It Wasn't Caught

- Model IDs were entered manually without verification against Anthropic docs
- No automated test validating model IDs are unique
- Model dates were guessed rather than looked up

---

## Impact Assessment

**Affected functionality**:

- AI dashboard model selection (Partners configuring features)
- API calls using wrong model IDs would fail or use wrong model
- Cost calculations may be incorrect

**Blast radius**: Moderate - affects admin configuration and potentially API calls

**Related code**:

- `services/gateway/src/graphql/resolvers/ai-ops.resolvers.ts:117-129`: Uses `getAvailableModels()`
- `services/ai-service/src/config/index.ts:17-19`: Also defines model IDs (needs sync)
- `packages/shared/types/src/ai.ts:14-18`: `ClaudeModel` enum (outdated, uses Claude 3 versions)

**Risk of similar bugs**: Medium - model IDs change with new releases

---

## Proposed Fix

### Changes Required

**File**: `services/gateway/src/services/ai-client.service.ts`

Replace the `AI_MODELS` array with the correct 6 models:

```typescript
export const AI_MODELS: AIModelInfo[] = [
  // Haiku models (fastest, cheapest)
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    category: 'haiku',
    input: 0.25,
    output: 1.25,
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    category: 'haiku',
    input: 1.0,
    output: 5.0,
  },

  // Sonnet models (balanced)
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    category: 'sonnet',
    input: 3.0,
    output: 15.0,
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    category: 'sonnet',
    input: 3.0,
    output: 15.0,
  },

  // Opus models (most capable)
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    category: 'opus',
    input: 15.0,
    output: 75.0,
  },
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    category: 'opus',
    input: 5.0,
    output: 25.0,
  },
];
```

**Note**: Pricing is in USD per MTok (matching Anthropic's official pricing).

**Risk**: Low

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] All 6 models show in AI dashboard
2. [ ] No duplicate model IDs in the list
3. [ ] Model selection works for all models
4. [ ] Cost calculations use correct pricing

### Suggested Test Cases

```typescript
// ai-client.service.test.ts
describe('AI_MODELS configuration', () => {
  it('should have exactly 6 models', () => {
    expect(AI_MODELS.length).toBe(6);
  });

  it('should have unique model IDs', () => {
    const ids = AI_MODELS.map((m) => m.id);
    const uniqueIds = [...new Set(ids)];
    expect(ids.length).toBe(uniqueIds.length);
  });

  it('should include all 4.5 models with correct IDs', () => {
    const haiku45 = AI_MODELS.find((m) => m.name === 'Claude Haiku 4.5');
    const sonnet45 = AI_MODELS.find((m) => m.name === 'Claude Sonnet 4.5');
    const opus45 = AI_MODELS.find((m) => m.name === 'Claude Opus 4.5');

    expect(haiku45?.id).toBe('claude-haiku-4-5-20251001');
    expect(sonnet45?.id).toBe('claude-sonnet-4-5-20250929');
    expect(opus45?.id).toBe('claude-opus-4-5-20251101');
  });

  it('should include prior tier models', () => {
    const haiku3 = AI_MODELS.find((m) => m.name === 'Claude 3 Haiku');
    const sonnet4 = AI_MODELS.find((m) => m.name === 'Claude Sonnet 4');
    const opus4 = AI_MODELS.find((m) => m.name === 'Claude Opus 4');

    expect(haiku3?.id).toBe('claude-3-haiku-20240307');
    expect(sonnet4?.id).toBe('claude-sonnet-4-20250514');
    expect(opus4?.id).toBe('claude-opus-4-20250514');
  });
});
```

---

## Investigation Notes

### Files Examined

| File                                                         | Purpose              | Relevant Finding            |
| ------------------------------------------------------------ | -------------------- | --------------------------- |
| `services/gateway/src/services/ai-client.service.ts`         | AI model definitions | Has wrong IDs, duplicates   |
| `services/gateway/src/graphql/resolvers/ai-ops.resolvers.ts` | GraphQL resolvers    | Uses `getAvailableModels()` |
| `services/ai-service/src/config/index.ts`                    | AI service config    | Has different defaults      |

### Sources

- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) - Official model IDs and pricing
- [Claude Pricing](https://claude.com/pricing) - Current pricing information

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug ai-models
```

The debug phase will:

1. Read this investigation document
2. Update AI_MODELS array with correct 6 models
3. Fix model IDs to match Anthropic's official API
4. Update pricing to match official rates
5. Run tests to verify
