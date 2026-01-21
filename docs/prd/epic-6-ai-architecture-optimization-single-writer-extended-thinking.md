# Epic 6: AI Architecture Optimization - Single-Writer with Extended Thinking

**Goal:** Consolidate the Word add-in AI research architecture to a single-writer model enhanced with Claude's extended thinking, native tool parallelism, and prompt caching. This epic targets 50-70% cost reduction while improving document quality through deeper AI reasoning. Remove deprecated multi-agent and two-phase code paths to simplify maintenance.

## Background

The current implementation has three research strategies:

1. **Single-Writer** (active) - One agent performs research + writing
2. **Two-Phase** (deprecated) - Research agent → JSON → Writing agent
3. **Multi-Agent** (deprecated) - Parallel section writers → Assembly agent

The deprecated approaches were abandoned due to:

- Brittle JSON handoffs between agents
- Inconsistent voice across sections (multi-agent)
- Non-deterministic footnote ordering
- Higher complexity without proportional quality gains

This epic enhances the single-writer approach with modern Claude capabilities while cleaning up technical debt.

---

## Story 6.1: Implement Prompt Caching for System Prompts

**As a** platform operator,
**I want** system prompts cached via Claude's prompt caching feature,
**so that** we reduce token costs by ~90% on repeated requests.

**Acceptance Criteria:**

1. `ai-client.service.ts` updated to use `cache_control: { type: "ephemeral" }` on system messages
2. System prompts in `word-ai-prompts.ts` marked as cacheable (9,000+ token prompts)
3. Cache hit rate tracked in `AIUsageLog` with new `cacheHitTokens` field
4. Admin dashboard shows cache hit rate and estimated savings
5. Feature flag `ai_prompt_caching` allows toggling per firm
6. Logging captures cache creation vs cache hit events for debugging

**Technical Notes:**

- Ephemeral cache has 5-minute TTL; matches typical user session
- First request pays 25% premium for cache creation; subsequent requests get 90% discount
- Expected savings: ~€1.20 per deep research document after first request

**Rollback Plan:** Feature flag disables caching; falls back to standard API calls.

---

## Story 6.2: Add Extended Thinking for Deep Research

**As a** lawyer requesting deep research documents,
**I want** the AI to reason more thoroughly before writing,
**so that** complex legal analysis is more accurate and comprehensive.

**Acceptance Criteria:**

1. `draftWithSingleWriter()` enables extended thinking when `researchDepth === 'deep'`
2. Thinking budget configurable per firm via `AIFeatureConfig.thinkingBudget` (default: 10,000 tokens)
3. Extended thinking content NOT included in response (only final output)
4. Progress events emit `{ type: 'thinking', text: 'Analizează...' }` for UI feedback
5. Token usage tracking includes thinking tokens separately (`thinkingTokens` field)
6. Admin can disable extended thinking via feature flag `ai_extended_thinking`
7. Quality metrics tracked: user satisfaction rating, edit percentage on deep docs

**Technical Notes:**

```typescript
// In ai-client.service.ts
const response = await anthropic.messages.create({
  model: 'claude-opus-4-5-20251101',
  thinking: {
    type: 'enabled',
    budget_tokens: thinkingBudget,
  },
  // ...
});
```

**Rollback Plan:** Feature flag disables extended thinking; deep research uses standard completion.

---

## Story 6.3: Enable Native Tool Parallelism for Web Search

**As a** user waiting for research results,
**I want** multiple web searches to execute in parallel,
**so that** research completes faster.

**Acceptance Criteria:**

1. System prompt updated to instruct Claude to batch related searches in single response
2. `chatWithTools()` executes multiple `tool_use` blocks concurrently (Promise.all)
3. Maximum parallel searches configurable (default: 3) to avoid rate limits
4. Progress events show parallel search status: `"Căutare: 3 interogări paralele..."`
5. Total search latency reduced by 40-60% for multi-source research
6. Error handling: if one search fails, others continue; partial results used

**Technical Notes:**

- Claude can return multiple tool_use blocks in a single response
- Current implementation processes them sequentially; change to parallel
- Add `maxParallelTools` config option

**Rollback Plan:** Config flag `parallelTools: false` reverts to sequential execution.

---

## Story 6.4: Intelligent Model Routing by Task Complexity

**As a** platform operator,
**I want** simpler AI tasks routed to cheaper models,
**so that** costs are optimized without sacrificing quality.

**Acceptance Criteria:**

1. `word_ai_suggest` and `word_ai_explain` default to Haiku 4.5 (5x cheaper than Sonnet)
2. Model routing matrix documented and configurable per firm
3. Complexity detection: if input >2000 tokens or contains legal citations, upgrade to Sonnet
4. A/B testing framework to compare quality metrics across model choices
5. Admin override allows forcing specific model per feature
6. Cost savings dashboard shows routing decisions and per-model spend

**Model Routing Matrix:**

| Feature                   | Default Model | Upgrade Condition       |
| ------------------------- | ------------- | ----------------------- |
| `word_ai_suggest`         | Haiku 4.5     | Input >2000 tokens      |
| `word_ai_explain`         | Haiku 4.5     | Legal citation detected |
| `word_ai_improve`         | Sonnet 4.5    | -                       |
| `word_draft`              | Sonnet 4.5    | -                       |
| `research_document_quick` | Sonnet 4.5    | -                       |
| `research_document`       | Opus 4.5      | - (always high quality) |

**Rollback Plan:** Remove complexity detection; use current static routing.

---

## Story 6.5: Remove Deprecated Multi-Agent and Two-Phase Code

**As a** platform developer,
**I want** deprecated research architectures removed,
**so that** the codebase is simpler and easier to maintain.

**Acceptance Criteria:**

1. `draftWithResearchTwoPhase()` method removed from `word-ai.service.ts`
2. `draftWithMultiAgent()` method removed from `word-ai.service.ts`
3. `executeIsolatedSectionAgents()` and related helper methods removed
4. `research-phases.ts` file removed or simplified
5. `PHASE1_RESEARCH_PROMPT` and multi-agent prompts removed from `word-ai-prompts.ts`
6. GraphQL schema: `useTwoPhaseResearch` and `useMultiAgent` fields removed
7. Request types updated; TypeScript compilation passes
8. All existing tests pass; no regression in single-writer functionality
9. ~500 lines of code removed

**Rollback Plan:** Git revert if issues discovered; deprecated code preserved in git history.

---

## Story 6.6: Fix Budget Tracking Implementation

**As a** firm administrator,
**I want** AI budget limits to actually work,
**so that** I can control costs.

**Acceptance Criteria:**

1. `getSpending()` in `ai-feature-config.service.ts` queries `AIUsageLog` correctly
2. Monthly and daily budget limits enforced before AI calls
3. Budget exceeded returns user-friendly error: "Limita lunară de AI a fost atinsă"
4. Near-limit warning at 80% usage: "Ați utilizat 80% din bugetul lunar de AI"
5. Real-time spending visible in admin dashboard
6. Budget reset runs automatically on month/day boundaries

**Current Bug:**

```typescript
// ai-feature-config.service.ts:479-483
private async getSpending(): Promise<number> {
  // AITokenUsage model was removed from schema
  // TODO: Reimplement budget tracking if needed
  return 0; // Always returns 0!
}
```

**Rollback Plan:** Feature flag disables budget enforcement; unlimited usage allowed.

---

## Story 6.7: Context Compression for Case Information

**As a** platform operator,
**I want** case context intelligently compressed before AI calls,
**so that** we reduce token usage without losing important information.

**Acceptance Criteria:**

1. Case context summarizer creates 3-tier summaries: critical (100 tokens), standard (300 tokens), full (1000+ tokens)
2. AI operations use appropriate tier: suggestions use critical, research uses full
3. Context compression runs nightly as part of case context file generation
4. Redis cache stores compressed contexts with 1-hour TTL
5. Token savings tracked: compare actual context tokens vs uncompressed baseline
6. Quality validation: spot-check that critical facts preserved in compression

**Technical Notes:**

- Use Haiku to generate summaries (cheap, fast)
- Store all tiers in `CaseContextFile` table
- Estimated savings: 30-40% on context tokens for repeat case operations

**Rollback Plan:** Use full context always; disable tiered compression.

---

## Story 6.8: Streaming Progress Enhancement

**As a** user waiting for AI-generated documents,
**I want** detailed progress updates during generation,
**so that** I understand what's happening and feel confident the system is working.

**Acceptance Criteria:**

1. Progress events include phase name, current action, and estimated completion
2. Web search progress shows query being searched: `"Căutare: Codul Civil art. 1350..."`
3. Extended thinking phase shows `"Analiză în curs..."` with elapsed time
4. Writing phase streams partial content to UI (visible text appearing)
5. Progress bar shows percentage completion based on phase (Research: 0-40%, Writing: 40-90%, Formatting: 90-100%)
6. Error states clearly communicated: `"Eroare la căutare, se încearcă din nou..."`

**Rollback Plan:** Revert to current progress events; no UI regression.

---

## Dependencies & Sequencing

```
Story 6.1 (Prompt Caching)     ─┐
Story 6.4 (Model Routing)      ─┼─► Can be done in parallel
Story 6.6 (Budget Tracking)    ─┘

Story 6.5 (Remove Deprecated)  ─► Do after 6.1-6.4 validated

Story 6.2 (Extended Thinking)  ─┐
Story 6.3 (Tool Parallelism)   ─┼─► Requires 6.1 complete (for cost baseline)
Story 6.7 (Context Compression)─┘

Story 6.8 (Streaming Progress) ─► Do last (depends on 6.2, 6.3)
```

---

## Success Metrics

| Metric                        | Current   | Target     | Measurement            |
| ----------------------------- | --------- | ---------- | ---------------------- |
| Cost per research doc (deep)  | ~€2.50    | <€1.00     | AIUsageLog aggregation |
| Cost per research doc (quick) | ~€0.80    | <€0.40     | AIUsageLog aggregation |
| Research latency (standard)   | ~45s      | <30s       | Request timing logs    |
| Cache hit rate                | 0%        | >70%       | New cache metrics      |
| User satisfaction (deep docs) | Baseline  | +20%       | Post-generation survey |
| Code complexity               | 2,211 LOC | <1,700 LOC | word-ai.service.ts     |

---

## Risks & Mitigations

| Risk                                       | Likelihood | Impact | Mitigation                                  |
| ------------------------------------------ | ---------- | ------ | ------------------------------------------- |
| Extended thinking increases latency        | Medium     | Medium | Set reasonable token budgets; show progress |
| Prompt caching miss rate high              | Low        | Medium | Monitor cache TTL; adjust if needed         |
| Haiku quality insufficient for suggestions | Medium     | Low    | Complexity detection upgrades to Sonnet     |
| Removing deprecated code breaks edge cases | Low        | High   | Comprehensive testing; feature flags        |
| Budget tracking blocks legitimate usage    | Low        | Medium | Soft limits with warnings before hard block |

---

## Estimated Effort

| Story                   | Complexity | Estimate |
| ----------------------- | ---------- | -------- |
| 6.1 Prompt Caching      | Low        | 1-2 days |
| 6.2 Extended Thinking   | Medium     | 2-3 days |
| 6.3 Tool Parallelism    | Medium     | 2-3 days |
| 6.4 Model Routing       | Low        | 1-2 days |
| 6.5 Remove Deprecated   | Low        | 1 day    |
| 6.6 Budget Tracking     | Medium     | 2 days   |
| 6.7 Context Compression | High       | 3-4 days |
| 6.8 Streaming Progress  | Medium     | 2 days   |

**Total: 14-19 days** (can be parallelized to ~10 days with 2 developers)

---

## Out of Scope

- Batch API for scheduled research (defer to future epic)
- Alternative AI providers (Grok fallback exists but not enhanced)
- Client-side caching of AI responses
- Fine-tuning or custom model training
