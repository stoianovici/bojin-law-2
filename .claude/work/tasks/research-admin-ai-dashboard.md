# Research: Admin AI Dashboard

**Status**: Complete
**Date**: 2025-01-07
**Input**: `brainstorm-admin-ai-dashboard.md`
**Next step**: `/plan research-admin-ai-dashboard`

---

## Problem Statement

The platform has multiple AI-powered services (email drafting, classification, morning briefing, etc.) with existing cost tracking infrastructure, but no visibility for administrators. Admins need a dashboard to monitor AI usage, costs, and configure which models each service uses. The dashboard must automatically reflect new AI services as they're added.

## Decisions (from brainstorm)

> **DO NOT MODIFY** - Copy this section verbatim from brainstorm doc.
> These are the agreed requirements. Research informs HOW, not WHAT.

### Functional Decisions

| Decision                   | Details                                                                          | Rationale                                                   | Verify                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Separate admin page        | New route `/admin/ai` accessible only to Admin role                              | Dedicated space for AI monitoring, doesn't clutter settings | Navigate to `/admin/ai` as Admin → Dashboard loads; Navigate as non-Admin → Redirected or 403 |
| Overview metrics cards     | Display: total cost (period), total requests, cache hit rate                     | Quick high-level visibility                                 | Load dashboard → See 3 metric cards with current period data                                  |
| Service usage table        | Table rows per AIOperationType showing: name, request count, cost, current model | Per-service breakdown                                       | Table shows all active AI operation types with their metrics                                  |
| Model selector per service | Dropdown in each row to change model (Haiku/Sonnet/Opus)                         | Allow cost optimization per operation                       | Select "Haiku" for EMAIL_CLASSIFICATION → Subsequent classifications use Haiku                |
| Period selector            | Options: Astăzi, Săptămâna aceasta, Luna aceasta, Custom range                   | Flexible time analysis                                      | Select "Luna aceasta" → Metrics update to show monthly totals                                 |
| Cost display in EUR        | Show costs in EUR, converted from USD (stored as cents)                          | EUR more relevant for Romanian firm                         | Costs display as "€12.45" not "$13.50"                                                        |
| Auto-discover services     | Dashboard reads from AIOperationType enum + metadata config                      | New services appear without dashboard code changes          | Add new AIOperationType → It appears in dashboard automatically                               |
| Romanian UI text           | All labels, headers, descriptions in Romanian                                    | Consistent with app conventions                             | Dashboard text is in Romanian                                                                 |

### Technical Decisions

| Decision                         | Details                                                                        | Rationale                                        | Verify                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------- |
| Use existing TokenTrackerService | Leverage `getUsageStats()`, `getDailyUsageTrend()` methods                     | Infrastructure already exists, don't duplicate   | GraphQL query returns data from AITokenUsage table                              |
| New AIModelConfig table          | Schema: `operationType (unique), modelOverride, updatedById, updatedAt`        | Persist model overrides, track who changed       | DB table exists, stores model preferences                                       |
| Metadata config file             | `ai-services.config.ts` with Romanian names, descriptions, icons per operation | Display-friendly labels without hardcoding in UI | Config file maps `EMAIL_DRAFT` → `{ name: "Redactare email", icon: "Mail" }`    |
| GraphQL queries/mutations        | `aiUsageStats(period)`, `aiServiceConfigs`, `updateAIModelConfig(input)`       | Consistent with app's data layer                 | Queries return expected data, mutation persists changes                         |
| ModelRouter integration          | Read from AIModelConfig table, fallback to default routing if no override      | Non-breaking change to existing routing          | Override exists → Uses override model; No override → Uses default routing logic |
| EUR conversion                   | Use fixed rate (configurable) or fetch from API; default 1 USD = 0.92 EUR      | Simple, predictable; can enhance later           | Costs convert correctly from USD cents to EUR                                   |
| Linear-inspired design           | Dark theme, compact layout, use existing Card/Table/Select components          | Match app's design system                        | Dashboard visually consistent with rest of app                                  |

### Out of Scope

- Per-user usage breakdown (future enhancement)
- Per-case usage breakdown (future enhancement)
- Cost alerts/limits (future enhancement)
- Real-time WebSocket updates (polling is sufficient)
- Multi-tenant support (Bojin only for now)
- Cost budgeting/forecasting
- Individual request logs (just aggregates)

---

## Research Findings

### Open Questions - Answered

| Question                        | Answer                                                                                                                                                                                                                                                                                                                                                                                           | Evidence                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| AIOperationType enum values     | 20 values: `TextGeneration`, `DocumentSummary`, `LegalAnalysis`, `Classification`, `Extraction`, `Embedding`, `Chat`, `DocumentReviewAnalysis`, `TaskParsing`, `CommunicationIntelligence`, `RiskAnalysis`, `ThreadAnalysis`, `ProactiveSuggestion`, `MorningBriefing`, `PatternRecognition`, `DocumentCompleteness`, `SnippetDetection`, `SnippetShortcut`, `StyleAnalysis`, `StyleApplication` | `packages/shared/types/src/ai.ts:35-61`                             |
| ModelRouter implementation      | 3-tier override: (1) Env var, (2) Request override, (3) Complexity-based. Uses `operationComplexityMap` + `complexityModelMap`. DB override fits at line 112-113 before complexity routing                                                                                                                                                                                                       | `services/ai-service/src/services/model-router.service.ts:68-227`   |
| Existing admin pages structure  | One exists: `/admin/templates/`. Uses Partner/BusinessOwner role checks in GraphQL resolvers, not middleware                                                                                                                                                                                                                                                                                     | `apps/web/src/app/(dashboard)/admin/templates/page.tsx`             |
| TokenTrackerService aggregation | `getUsageStats(firmId, dateRange)` returns `AIUsageStats` with `totalTokens`, `totalCostCents`, `requestCount`, `avgLatencyMs`, `cacheHitRate`, `byModel[]`, `byOperation[]`. Supports operation grouping and time period filtering                                                                                                                                                              | `services/ai-service/src/services/token-tracker.service.ts:121-198` |
| EUR conversion approach         | No existing conversion. Pricing in USD cents. Recommendation: add `centsToCost(cents, currency)` utility with fixed 0.92 EUR:USD rate                                                                                                                                                                                                                                                            | No existing utility found; create new in `/lib/currency.ts`         |

### Existing Code Analysis

| Category        | Files                                                                 | Notes                                                                                                      |
| --------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Reuse as-is** | `services/ai-service/src/services/token-tracker.service.ts`           | All aggregation methods ready: `getUsageStats()`, `getDailyUsageTrend()`, `getUsageByUser()`               |
| **Reuse as-is** | `services/gateway/src/graphql/schema/ai-ops.graphql`                  | Complete schema exists (355 lines) with types for `AIUsageOverview`, `AIFeatureConfig`, `AIBudgetSettings` |
| **Reuse as-is** | `services/gateway/src/graphql/resolvers/ai-ops.resolvers.ts`          | Resolvers for `aiUsageOverview`, `aiDailyCosts`, `aiCostsByFeature`, `aiFeatures` already implemented      |
| **Reuse as-is** | `services/gateway/src/services/ai-usage.service.ts`                   | Usage statistics and cost calculations                                                                     |
| **Reuse as-is** | `services/gateway/src/services/ai-feature-config.service.ts`          | Contains `AI_FEATURES` constant with all feature definitions                                               |
| **Modify**      | `services/ai-service/src/services/model-router.service.ts` (line 112) | Add DB override check before complexity routing                                                            |
| **Modify**      | `packages/database/prisma/schema.prisma`                              | Add `AIModelConfig` table for model overrides                                                              |
| **Modify**      | `apps/web/src/components/layout/Sidebar.tsx`                          | Add `/admin/ai` navigation link                                                                            |
| **Create new**  | `apps/web/src/app/(dashboard)/admin/ai/page.tsx`                      | Main dashboard page                                                                                        |
| **Create new**  | `apps/web/src/graphql/admin-ai.ts`                                    | GraphQL queries for dashboard                                                                              |
| **Create new**  | `apps/web/src/hooks/useAdminAI.ts`                                    | Custom hook for dashboard data                                                                             |
| **Create new**  | `services/ai-service/src/config/ai-services.config.ts`                | Romanian labels and metadata per operation                                                                 |
| **Create new**  | `apps/web/src/lib/currency.ts`                                        | USD cents to EUR conversion utility                                                                        |

### Patterns Discovered

**Admin Page Pattern** (from `/admin/templates/page.tsx:103-239`):

```tsx
'use client';
export default function AdminPage() {
  return (
    <div className="flex flex-col h-full w-full bg-linear-bg-primary">
      {/* Header with title and actions */}
      <header className="px-6 py-4 border-b border-linear-border-subtle">
        <h1 className="text-xl font-semibold text-linear-text-primary">Title</h1>
      </header>

      {/* Filter section */}
      <div className="px-6 py-4 border-b border-linear-border-subtle bg-linear-bg-secondary">
        {/* Filters, tabs, search */}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">{/* Main content */}</ScrollArea>
    </div>
  );
}
```

**Authorization Pattern** (from `document-intelligence.resolvers.ts:39-53`):

```typescript
const AUTHORIZED_ROLES = ['Partner', 'BusinessOwner', 'Admin'];

function requirePartnerOrAdmin(context: Context): void {
  if (!AUTHORIZED_ROLES.includes(context.user.role)) {
    throw new GraphQLError('Access denied', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}
```

**ModelRouter Override Pattern** (from `model-router.service.ts:113-120`):

```typescript
// Current pattern for request override - DB override would follow same structure
if (input.modelOverride) {
  return {
    model: input.modelOverride,
    modelName: this.getModelName(input.modelOverride),
    complexity: TaskComplexity.OVERRIDE,
    reason: 'Model override specified in request',
  };
}
```

**Pricing Configuration** (from `services/ai-service/src/config/index.ts:66-68`):

```typescript
pricing: {
  haiku: { input: 25, output: 125 },    // $0.25/$1.25 per 1M tokens
  sonnet: { input: 300, output: 1500 }, // $3/$15 per 1M tokens
  opus: { input: 1500, output: 7500 },  // $15/$75 per 1M tokens
}
```

### Constraints Found

- **No EUR conversion exists**: App stores costs in USD cents. Must add conversion utility.
- **No explicit Admin role**: User roles are `Partner`, `Associate`, `AssociateJr`, `BusinessOwner`. Will use `Partner`/`BusinessOwner` for admin access.
- **ModelRouter is in ai-service**: DB read will require Prisma client access in ai-service (already has it).
- **GraphQL schema partially exists**: `ai-ops.graphql` has usage queries but NOT model override mutations.

---

## Implementation Recommendation

### Approach

Leverage the extensive existing infrastructure:

1. **Backend is 90% complete**: The `ai-ops.graphql` schema and resolvers already handle usage stats, daily costs, feature configs. Only need to add model override mutation.

2. **Add minimal new code**:
   - One new Prisma table (`AIModelConfig`)
   - One new GraphQL mutation (`updateModelOverride`)
   - Extend `ModelRouter.selectModel()` with DB check
   - Create frontend page with existing UI patterns

3. **EUR conversion**: Simple utility function with configurable fixed rate.

### Model Override Flow

```
Admin changes model in UI
  ↓
GraphQL mutation: updateModelOverride(operationType, model)
  ↓
Gateway resolver saves to AIModelConfig table
  ↓
ModelRouter.selectModel() checks AIModelConfig before complexity routing
  ↓
AI calls use overridden model
```

---

## File Plan

| File                                                         | Action | Purpose                                                                                                         |
| ------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------- |
| `packages/database/prisma/schema.prisma`                     | Modify | Add `AIModelConfig` model with `operationType` (unique per firm), `model`, `firmId`, `updatedById`, `updatedAt` |
| `services/gateway/src/graphql/schema/ai-ops.graphql`         | Modify | Add `updateModelOverride` mutation and `ModelOverride` type                                                     |
| `services/gateway/src/graphql/resolvers/ai-ops.resolvers.ts` | Modify | Add mutation resolver for model override                                                                        |
| `services/ai-service/src/services/model-router.service.ts`   | Modify | Add DB override check in `selectModel()` at line 112                                                            |
| `services/ai-service/src/config/ai-services.config.ts`       | Create | Romanian metadata for each AIOperationType                                                                      |
| `apps/web/src/lib/currency.ts`                               | Create | `formatCostEur(costCents)` utility                                                                              |
| `apps/web/src/app/(dashboard)/admin/ai/page.tsx`             | Create | Main dashboard page                                                                                             |
| `apps/web/src/graphql/admin-ai.ts`                           | Create | GraphQL queries/mutations                                                                                       |
| `apps/web/src/hooks/useAdminAI.ts`                           | Create | Hook wrapping GraphQL operations                                                                                |
| `apps/web/src/components/layout/Sidebar.tsx`                 | Modify | Add `/admin/ai` nav link                                                                                        |

---

## Risks

| Risk                                          | Mitigation                                                        |
| --------------------------------------------- | ----------------------------------------------------------------- |
| Model override could break AI services        | Add fallback to default routing if DB lookup fails                |
| EUR rate goes stale                           | Make rate configurable in env var; can add API call later         |
| Large token usage data                        | Use pagination/date filtering; existing methods support dateRange |
| Admin sets wrong model for complex operations | Show warning when selecting Haiku for Complex operations          |
| Migration fails                               | Test on `legal_platform_test` first; small additive change        |

---

## Next Step

Start a new session and run:
`/plan research-admin-ai-dashboard`
