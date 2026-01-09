# Plan: Admin AI Dashboard

**Status**: Approved
**Date**: 2025-01-07
**Input**: `research-admin-ai-dashboard.md`
**Next step**: `/implement plan-admin-ai-dashboard`

---

## Problem Statement

The platform has multiple AI-powered services (email drafting, classification, morning briefing, etc.) with existing cost tracking infrastructure, but no visibility for administrators. Admins need a dashboard to monitor AI usage, costs, and configure which models each service uses. The dashboard must automatically reflect new AI services as they're added.

## Decisions (from brainstorm)

> **DO NOT MODIFY** - Copy this section verbatim from research doc.
> Every task below must implement these decisions.

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

## Implementation Approach

Leverage the extensive existing infrastructure: the `ai-ops.graphql` schema and resolvers already handle usage stats, daily costs, and feature configs. We only need to add a model override mutation, one new Prisma table (`AIModelConfig`), extend `ModelRouter.selectModel()` with a DB check, and create the frontend dashboard page using existing UI patterns. EUR conversion is a simple utility with a configurable fixed rate.

---

## Tasks

### Parallel Group 1: Backend Infrastructure

> These tasks run simultaneously via sub-agents

#### Task 1.1: Add AIModelConfig table

- **Decision**: New AIModelConfig table | Schema: `operationType (unique), modelOverride, updatedById, updatedAt` | Persist model overrides, track who changed | DB table exists, stores model preferences
- **File**: `packages/database/prisma/schema.prisma` (MODIFY)
- **Do**: Add `AIModelConfig` model with fields: `id`, `operationType` (String), `model` (String), `firmId` (String), `updatedById` (String), `updatedAt` (DateTime). Add unique constraint on `[operationType, firmId]`. Add relations to User and Firm.
- **Done when**: DB table exists, stores model preferences

#### Task 1.2: Create Romanian metadata config

- **Decision**: Metadata config file | `ai-services.config.ts` with Romanian names, descriptions, icons per operation | Display-friendly labels without hardcoding in UI | Config file maps `EMAIL_DRAFT` → `{ name: "Redactare email", icon: "Mail" }`
- **File**: `services/ai-service/src/config/ai-services.config.ts` (CREATE)
- **Do**: Define config object mapping each of the 20 AIOperationType values to `{ name: "Romanian name", description: "...", icon: "IconName" }`. Include all types: TextGeneration, DocumentSummary, LegalAnalysis, Classification, Extraction, Embedding, Chat, DocumentReviewAnalysis, TaskParsing, CommunicationIntelligence, RiskAnalysis, ThreadAnalysis, ProactiveSuggestion, MorningBriefing, PatternRecognition, DocumentCompleteness, SnippetDetection, SnippetShortcut, StyleAnalysis, StyleApplication.
- **Done when**: Config file maps each AIOperationType to Romanian metadata with name, description, and icon

#### Task 1.3: Create EUR conversion utility

- **Decision**: EUR conversion | Use fixed rate (configurable) or fetch from API; default 1 USD = 0.92 EUR | Simple, predictable; can enhance later | Costs convert correctly from USD cents to EUR
- **File**: `apps/web/src/lib/currency.ts` (CREATE)
- **Do**: Create `formatCostEur(costCents: number): string` utility that converts USD cents to EUR using fixed rate 0.92. Support env var override for rate. Return formatted string like "€12.45".
- **Done when**: Costs convert correctly from USD cents to EUR

---

### Parallel Group 2: GraphQL Layer

> These tasks run simultaneously via sub-agents
> Depends on: Task 1.1 (schema must exist)

#### Task 2.1: Add model override mutation to schema

- **Decision**: GraphQL queries/mutations | `aiUsageStats(period)`, `aiServiceConfigs`, `updateAIModelConfig(input)` | Consistent with app's data layer | Queries return expected data, mutation persists changes
- **File**: `services/gateway/src/graphql/schema/ai-ops.graphql` (MODIFY)
- **Do**: Add `updateModelOverride(operationType: String!, model: String!): ModelOverrideResult!` mutation. Add `ModelOverrideResult` type with `operationType`, `model`, `updatedAt`. Add `aiModelOverrides: [ModelOverride!]!` query.
- **Done when**: Schema includes mutation and query for model overrides

#### Task 2.2: Add model override resolver

- **Decision**: GraphQL queries/mutations | `aiUsageStats(period)`, `aiServiceConfigs`, `updateAIModelConfig(input)` | Consistent with app's data layer | Queries return expected data, mutation persists changes
- **File**: `services/gateway/src/graphql/resolvers/ai-ops.resolvers.ts` (MODIFY)
- **Do**: Add Partner/BusinessOwner authorization check using existing pattern. Implement `updateModelOverride` mutation to upsert AIModelConfig record. Implement `aiModelOverrides` query to return all overrides for firm.
- **Done when**: Mutation persists changes to DB; Query returns all overrides

---

### Sequential: ModelRouter Integration

> Depends on: Task 1.1 (AIModelConfig table must exist)

#### Task 3: Integrate ModelRouter with DB overrides

- **Decision**: ModelRouter integration | Read from AIModelConfig table, fallback to default routing if no override | Non-breaking change to existing routing | Override exists → Uses override model; No override → Uses default routing logic
- **File**: `services/ai-service/src/services/model-router.service.ts` (MODIFY)
- **Do**: Add DB lookup in `selectModel()` method before complexity routing (around line 112). Query AIModelConfig for matching operationType. If override exists, return it with reason "Admin override". If DB lookup fails, log warning and continue to default routing.
- **Done when**: Override exists → Uses override model; No override → Uses default routing logic

---

### Parallel Group 3: Frontend Foundation

> These tasks run simultaneously via sub-agents
> Depends on: Tasks 1.2, 1.3 (config and utility must exist)

#### Task 4.1: Create GraphQL queries for dashboard

- **Decision**: GraphQL queries/mutations | `aiUsageStats(period)`, `aiServiceConfigs`, `updateAIModelConfig(input)` | Consistent with app's data layer | Queries return expected data, mutation persists changes
- **File**: `apps/web/src/graphql/admin-ai.ts` (CREATE)
- **Do**: Define `AI_USAGE_OVERVIEW` query using existing `aiUsageOverview` schema. Define `AI_FEATURES` query using existing `aiFeatures`. Define `AI_MODEL_OVERRIDES` query. Define `UPDATE_MODEL_OVERRIDE` mutation.
- **Done when**: GraphQL operations defined and typed for use in hooks

#### Task 4.2: Create useAdminAI hook

- **Decision**: Period selector | Options: Astăzi, Săptămâna aceasta, Luna aceasta, Custom range | Flexible time analysis | Select "Luna aceasta" → Metrics update to show monthly totals
- **File**: `apps/web/src/hooks/useAdminAI.ts` (CREATE)
- **Do**: Create hook that wraps GraphQL operations. Manage period state with options: 'today', 'week', 'month', 'custom'. Calculate date ranges for each period. Return `{ data, loading, error, period, setPeriod, updateModelOverride }`.
- **Done when**: Hook returns usage data and supports period selection

#### Task 4.3: Add sidebar navigation link

- **Decision**: Separate admin page | New route `/admin/ai` accessible only to Admin role | Dedicated space for AI monitoring, doesn't clutter settings | Navigate to `/admin/ai` as Admin → Dashboard loads; Navigate as non-Admin → Redirected or 403
- **File**: `apps/web/src/components/layout/Sidebar.tsx` (MODIFY)
- **Do**: Add `/admin/ai` link in admin section, visible only to Partner/BusinessOwner roles. Use Brain or Sparkles icon. Label: "AI Dashboard".
- **Done when**: Link visible to Partner/BusinessOwner; hidden from Associate/AssociateJr

---

### Final: Dashboard Page

> Depends on: All previous tasks

#### Task 5: Create dashboard page

- **Decision**: Overview metrics cards | Display: total cost (period), total requests, cache hit rate | Quick high-level visibility | Load dashboard → See 3 metric cards with current period data
- **Decision**: Service usage table | Table rows per AIOperationType showing: name, request count, cost, current model | Per-service breakdown | Table shows all active AI operation types with their metrics
- **Decision**: Model selector per service | Dropdown in each row to change model (Haiku/Sonnet/Opus) | Allow cost optimization per operation | Select "Haiku" for EMAIL_CLASSIFICATION → Subsequent classifications use Haiku
- **Decision**: Auto-discover services | Dashboard reads from AIOperationType enum + metadata config | New services appear without dashboard code changes | Add new AIOperationType → It appears in dashboard automatically
- **Decision**: Romanian UI text | All labels, headers, descriptions in Romanian | Consistent with app conventions | Dashboard text is in Romanian
- **Decision**: Linear-inspired design | Dark theme, compact layout, use existing Card/Table/Select components | Match app's design system | Dashboard visually consistent with rest of app
- **File**: `apps/web/src/app/(dashboard)/admin/ai/page.tsx` (CREATE)
- **Do**:
  - Header with title "Dashboard AI" and period selector dropdown
  - 3 metric cards: "Cost Total" (EUR), "Cereri", "Cache Hit Rate"
  - Service table with columns: Serviciu, Cereri, Cost, Model
  - Each row shows AIOperationType with Romanian name from config
  - Model column has Select dropdown (Haiku/Sonnet/Opus)
  - Use Linear-inspired dark theme with existing components
  - Add role check at page level for Partner/BusinessOwner
- **Done when**:
  - Navigate to `/admin/ai` as Partner → Dashboard loads with metrics and table
  - Navigate as Associate → Redirected or 403
  - See 3 metric cards with current period data
  - Table shows all active AI operation types with their metrics
  - Select "Haiku" for a service → Mutation fires, dropdown updates

---

## Decision Coverage Check

| Decision                         | Implemented by Task(s)       |
| -------------------------------- | ---------------------------- |
| Separate admin page              | Task 4.3, Task 5             |
| Overview metrics cards           | Task 5                       |
| Service usage table              | Task 5                       |
| Model selector per service       | Task 5                       |
| Period selector                  | Task 4.2, Task 5             |
| Cost display in EUR              | Task 1.3, Task 5             |
| Auto-discover services           | Task 1.2, Task 5             |
| Romanian UI text                 | Task 1.2, Task 5             |
| Use existing TokenTrackerService | Task 4.1                     |
| New AIModelConfig table          | Task 1.1                     |
| Metadata config file             | Task 1.2                     |
| GraphQL queries/mutations        | Task 2.1, Task 2.2, Task 4.1 |
| ModelRouter integration          | Task 3                       |
| EUR conversion                   | Task 1.3                     |
| Linear-inspired design           | Task 5                       |

## Session Scope

- **Total tasks**: 10
- **Complexity**: Medium (mostly existing infrastructure reuse)

---

## Next Step

Start a new session and run:
`/implement plan-admin-ai-dashboard`
