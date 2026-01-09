# Brainstorm: Admin AI Services Dashboard

**Status**: Complete
**Date**: 2025-01-07
**Next step**: `/research brainstorm-admin-ai-dashboard`

---

## Problem Statement

The platform has multiple AI-powered services (email drafting, classification, morning briefing, etc.) with existing cost tracking infrastructure, but no visibility for administrators. Admins need a dashboard to monitor AI usage, costs, and configure which models each service uses. The dashboard must automatically reflect new AI services as they're added.

## Decisions

> **IMPORTANT**: This section propagates unchanged through research → plan → implement.
> Be specific and complete. These are the requirements.

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

### Open Questions for Research

- [ ] Exact values in AIOperationType enum and their current usage patterns
- [ ] ModelRouter implementation details for extending with DB overrides
- [ ] Existing admin pages structure to follow patterns
- [ ] TokenTrackerService aggregation methods - exact signatures and return types
- [ ] How to handle EUR conversion (fixed rate vs API)

---

## Context Snapshot

### Existing Infrastructure

- **TokenTrackerService**: Records every AI call with model, tokens, cost (USD cents), latency
- **AITokenUsage table**: Stores usage with indices on firmId, userId, operationType
- **ModelRouter**: Routes operations to Haiku/Sonnet/Opus based on complexity (currently hardcoded)
- **Usage API**: `GET /api/ai/usage` exists but may need enhancement

### Active AI Services (from AIOperationType)

- EMAIL_DRAFT - Email drafting with tone/recipient customization
- EMAIL_CLASSIFICATION - Routes emails to correct cases
- MORNING_BRIEFING - Daily AI briefings
- EMAIL_CATEGORIZATION - Categorizes emails by type
- THREAD_ANALYSIS - Analyzes email threads
- Plus others in the enum

### Tech Stack Relevant to Dashboard

- Frontend: Next.js App Router, TailwindCSS, Radix UI components
- State: Apollo Client for GraphQL
- Backend: Apollo Server GraphQL
- Design: Linear-inspired dark theme with existing tokens

## Next Step

Start a new session and run:
`/research brainstorm-admin-ai-dashboard`
