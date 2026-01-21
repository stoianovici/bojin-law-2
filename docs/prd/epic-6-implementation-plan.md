# Epic 6: Implementation Plan

**AI Architecture Optimization - Single-Writer with Extended Thinking**

Based on codebase analysis, this plan sequences the 8 stories for efficient implementation with minimal risk.

---

## Phase 1: Foundation (Parallel - Stories 6.1, 6.4, 6.6)

These stories have no dependencies and establish the cost baseline.

### Story 6.1: Prompt Caching

**Files to Modify:**
| File | Changes |
|------|---------|
| `services/gateway/src/services/ai-client.service.ts` | Add `cache_control` to system messages |
| `packages/database/prisma/schema.prisma` | Add `cacheHitTokens` to `AIUsageLog` |
| `services/gateway/src/services/ai-feature-config.service.ts` | Add `ai_prompt_caching` feature flag |

**Implementation Steps:**

1. **Update `chat()` method in ai-client.service.ts (~line 180)**

   ```typescript
   // Add cache_control to system messages when caching enabled
   const systemMessages = messages
     .filter((m) => m.role === 'system')
     .map((m) => ({
       ...m,
       cache_control: cacheEnabled ? { type: 'ephemeral' } : undefined,
     }));
   ```

2. **Track cache metrics in usage logging (~line 350)**

   ```typescript
   // Extract cache info from response
   const cacheHitTokens = response.usage?.cache_read_input_tokens ?? 0;
   const cacheMissTokens = response.usage?.cache_creation_input_tokens ?? 0;
   ```

3. **Add schema field**

   ```prisma
   model AIUsageLog {
     // existing fields...
     cacheHitTokens    Int?
     cacheMissTokens   Int?
   }
   ```

4. **Seed feature flag** in ai-feature-config.service.ts seeding

**Validation:**

- Log cache_read_input_tokens and cache_creation_input_tokens
- Compare costs before/after in admin dashboard

---

### Story 6.4: Model Routing

**Files to Modify:**
| File | Changes |
|------|---------|
| `services/gateway/src/services/word-ai.service.ts` | Add complexity detection to `getSuggestions()`, `explainText()` |
| `services/gateway/src/services/ai-feature-config.service.ts` | Update model defaults per feature |

**Implementation Steps:**

1. **Create complexity detector utility**

   ```typescript
   // services/gateway/src/services/word-ai-utils.ts
   export function detectComplexity(text: string): 'simple' | 'complex' {
     const tokenEstimate = text.length / 4;
     const hasLegalCitations = /art\.\s*\d+|Cod|Legea|Decizia/i.test(text);
     if (tokenEstimate > 2000 || hasLegalCitations) return 'complex';
     return 'simple';
   }
   ```

2. **Update feature config defaults**

   ```typescript
   // Default model routing matrix
   const MODEL_ROUTING = {
     word_ai_suggest: { default: 'haiku-4.5', upgrade: 'sonnet-4.5' },
     word_ai_explain: { default: 'haiku-4.5', upgrade: 'sonnet-4.5' },
     word_ai_improve: { default: 'sonnet-4.5', upgrade: null },
     word_draft: { default: 'sonnet-4.5', upgrade: null },
     research_document_quick: { default: 'sonnet-4.5', upgrade: null },
     research_document: { default: 'opus-4.5', upgrade: null },
   };
   ```

3. **Update `getSuggestions()` (~line 276)**
   ```typescript
   const complexity = detectComplexity(request.text);
   const featureKey = 'word_ai_suggest';
   const model =
     complexity === 'complex' ? 'claude-sonnet-4-5-20250514' : 'claude-haiku-4-5-20250514';
   ```

**Validation:**

- Track model usage in AIUsageLog
- Compare quality ratings for Haiku vs Sonnet suggestions

---

### Story 6.6: Budget Tracking Fix

**Files to Modify:**
| File | Changes |
|------|---------|
| `services/gateway/src/services/ai-feature-config.service.ts` | Fix `getSpending()` implementation |
| `services/gateway/src/graphql/resolvers/user-preferences.resolvers.ts` | Add budget status query |

**Implementation Steps:**

1. **Fix `getSpending()` (~line 479)**

   ```typescript
   private async getSpending(
     firmId: string,
     period: 'monthly' | 'daily'
   ): Promise<number> {
     const startDate = period === 'monthly'
       ? startOfMonth(new Date())
       : startOfDay(new Date());

     const usage = await this.prisma.aIUsageLog.aggregate({
       where: {
         firmId,
         createdAt: { gte: startDate },
       },
       _sum: { costEur: true },
     });

     return usage._sum.costEur ?? 0;
   }
   ```

2. **Add budget check before AI calls**

   ```typescript
   // In ai-client.service.ts before API call
   async checkBudget(firmId: string, featureKey: string): Promise<void> {
     const config = await this.featureConfig.getConfig(firmId, featureKey);
     if (!config.budgetLimitMonthlyEur) return; // No limit

     const spent = await this.featureConfig.getSpending(firmId, 'monthly');
     const percentUsed = (spent / config.budgetLimitMonthlyEur) * 100;

     if (percentUsed >= 100) {
       throw new BudgetExceededError('Limita lunară de AI a fost atinsă');
     }
     if (percentUsed >= 80) {
       this.emitWarning(`Ați utilizat ${Math.round(percentUsed)}% din bugetul lunar`);
     }
   }
   ```

3. **Add admin dashboard query** for real-time spending

**Validation:**

- Set test budget limit, verify enforcement
- Check 80% warning appears correctly

---

## Phase 2: Performance (After Phase 1 - Stories 6.2, 6.3)

These require Phase 1 for cost baseline measurement.

### Story 6.2: Extended Thinking

**Files to Modify:**
| File | Changes |
|------|---------|
| `services/gateway/src/services/ai-client.service.ts` | Add thinking parameter support |
| `services/gateway/src/services/word-ai.service.ts` | Enable thinking for deep research |
| `packages/database/prisma/schema.prisma` | Add `thinkingTokens` to AIUsageLog |
| `services/gateway/src/services/ai-feature-config.service.ts` | Add `thinkingBudget` config |

**Implementation Steps:**

1. **Add thinking support to `chat()` method**

   ```typescript
   interface ChatOptions {
     // existing...
     thinking?: {
       enabled: boolean;
       budgetTokens: number;
     };
   }

   // In API call
   const response = await this.anthropic.messages.create({
     model,
     messages,
     ...(options.thinking?.enabled && {
       thinking: {
         type: 'enabled',
         budget_tokens: options.thinking.budgetTokens,
       },
     }),
   });
   ```

2. **Update `draftWithSingleWriter()` (~line 1801)**

   ```typescript
   const useThinking =
     request.researchDepth === 'deep' &&
     (await this.featureConfig.isEnabled(firmId, 'ai_extended_thinking'));

   const thinkingBudget = await this.featureConfig.getThinkingBudget(firmId);

   const response = await this.aiClient.chatWithTools({
     // existing params...
     thinking: useThinking ? { enabled: true, budgetTokens: thinkingBudget } : undefined,
   });
   ```

3. **Emit thinking progress events**
   ```typescript
   if (event.type === 'thinking') {
     progressCallback?.({ type: 'thinking', text: 'Analizează în profunzime...' });
   }
   ```

**Validation:**

- Deep research shows thinking progress
- Thinking tokens tracked separately
- Quality comparison: with vs without thinking

---

### Story 6.3: Tool Parallelism

**Files to Modify:**
| File | Changes |
|------|---------|
| `services/gateway/src/services/ai-client.service.ts` | Parallel tool execution in `chatWithTools()` |

**Implementation Steps:**

1. **Modify tool execution loop (~line 450)**

   ```typescript
   // Current: Sequential
   for (const toolUse of toolUseBlocks) {
     const result = await executeToolHandler(toolUse);
     results.push(result);
   }

   // New: Parallel with limit
   const MAX_PARALLEL = options.maxParallelTools ?? 3;
   const chunks = chunkArray(toolUseBlocks, MAX_PARALLEL);

   for (const chunk of chunks) {
     const results = await Promise.all(
       chunk.map(async (toolUse) => {
         try {
           return await executeToolHandler(toolUse);
         } catch (error) {
           return { error: error.message, toolUse };
         }
       })
     );
     allResults.push(...results);
   }
   ```

2. **Update progress events**

   ```typescript
   progressCallback?.({
     type: 'search',
     text: `Căutare: ${chunk.length} interogări paralele...`,
   });
   ```

3. **Handle partial failures**
   ```typescript
   // Continue with successful results if some fail
   const successfulResults = results.filter((r) => !r.error);
   const failedCount = results.length - successfulResults.length;
   if (failedCount > 0) {
     progressCallback?.({
       type: 'warning',
       text: `${failedCount} căutări eșuate, se continuă...`,
     });
   }
   ```

**Validation:**

- Measure latency reduction (target: 40-60%)
- Verify parallel searches execute correctly
- Test error handling with intentional failures

---

## Phase 3: Cleanup (After Phase 2 - Story 6.5)

Remove deprecated code only after new features are validated.

### Story 6.5: Remove Deprecated Code

**Files to Modify:**
| File | Changes |
|------|---------|
| `services/gateway/src/services/word-ai.service.ts` | Remove ~500 lines |
| `services/gateway/src/services/research-phases.ts` | Remove deprecated prompts/types |
| `services/gateway/src/graphql/schema/*.graphql` | Remove deprecated fields |

**Implementation Steps:**

1. **Remove from word-ai.service.ts:**
   - Lines 553-561: Deprecated strategy selection logic
   - Lines 838-1091: `draftWithResearchTwoPhase()` method
   - Lines 1115-1312: `draftWithMultiAgent()` method
   - Lines 1318-1381: `planSectionsFromScope()`
   - Lines 1387-1457: `executeIsolatedSectionAgents()`
   - Lines 1463-1583: `executeIsolatedSectionAgent()`
   - Lines 1589-1679: `generateIntroConclusion()`
   - Lines 1685-1781: `assembleDocumentFanIn()`

2. **Remove from research-phases.ts:**
   - `DocumentOutline` interface
   - `SectionPlan` interface
   - `SectionContent` interface
   - `CitationUsed` interface
   - `PHASE1_RESEARCH_PROMPT`
   - `PHASE2_WRITING_PROMPT`
   - `OUTLINE_AGENT_PROMPT`
   - `SECTION_WRITER_PROMPT`
   - `ASSEMBLY_PROMPT`

3. **Update GraphQL schema:**
   - Remove `useTwoPhaseResearch` field
   - Remove `useMultiAgent` field
   - Update input types

4. **Run full test suite**
   ```bash
   pnpm test
   pnpm build
   ```

**Validation:**

- TypeScript compiles without errors
- All tests pass
- Single-writer research works unchanged
- Line count reduced by ~500

---

## Phase 4: Enhancement (After Phase 3 - Stories 6.7, 6.8)

Polish and optimization.

### Story 6.7: Context Compression

**Files to Modify:**
| File | Changes |
|------|---------|
| `services/gateway/src/services/case-context.service.ts` | Add tiered compression |
| `packages/database/prisma/schema.prisma` | Add compression fields to CaseContextFile |

**Implementation Steps:**

1. **Create context summarizer**

   ```typescript
   // services/gateway/src/services/context-summarizer.service.ts
   export class ContextSummarizer {
     async generateTiers(caseId: string): Promise<{
       critical: string; // 100 tokens
       standard: string; // 300 tokens
       full: string; // 1000+ tokens
     }> {
       // Use Haiku for cheap summarization
       const fullContext = await this.getCaseContext(caseId);

       const critical = await this.aiClient.complete({
         model: 'claude-haiku-4-5-20250514',
         prompt: `Summarize in exactly 100 tokens: ${fullContext}`,
       });

       // Similar for standard tier...
     }
   }
   ```

2. **Store tiers in database**

   ```prisma
   model CaseContextFile {
     // existing...
     contextCritical   String?
     contextStandard   String?
     contextFull       String?
     compressedAt      DateTime?
   }
   ```

3. **Use appropriate tier per operation**
   ```typescript
   // In word-ai.service.ts
   const contextTier = featureKey === 'word_ai_suggest' ? 'critical' : 'full';
   const context = await this.getContext(caseId, contextTier);
   ```

**Validation:**

- Compare token usage with/without compression
- Spot-check quality of compressed contexts
- Measure cost savings

---

### Story 6.8: Streaming Progress

**Files to Modify:**
| File | Changes |
|------|---------|
| `services/gateway/src/services/word-ai.service.ts` | Enhanced progress events |
| `apps/word-addin/src/taskpane/components/*.tsx` | Progress UI updates |

**Implementation Steps:**

1. **Define progress phases**

   ```typescript
   type ProgressPhase =
     | { type: 'research'; query: string; progress: number }
     | { type: 'thinking'; elapsed: number }
     | { type: 'writing'; partialContent: string; progress: number }
     | { type: 'formatting'; progress: number }
     | { type: 'error'; message: string; retrying: boolean };
   ```

2. **Emit detailed events throughout pipeline**

   ```typescript
   // Research phase: 0-40%
   progressCallback({ type: 'research', query: searchQuery, progress: 20 });

   // Thinking phase (if enabled)
   progressCallback({ type: 'thinking', elapsed: elapsedMs });

   // Writing phase: 40-90%
   progressCallback({ type: 'writing', partialContent: partial, progress: 60 });

   // Formatting: 90-100%
   progressCallback({ type: 'formatting', progress: 95 });
   ```

3. **Update Word Add-in UI**
   - Show current phase name
   - Display search queries being executed
   - Stream partial content as it arrives
   - Show percentage progress bar

**Validation:**

- Progress bar moves smoothly
- User understands current phase
- Error messages clear and actionable

---

## Implementation Schedule

```
Week 1:
├─ Day 1-2: Story 6.1 (Prompt Caching)
├─ Day 2-3: Story 6.4 (Model Routing)
└─ Day 3-4: Story 6.6 (Budget Tracking)

Week 2:
├─ Day 1-2: Story 6.2 (Extended Thinking)
└─ Day 3-4: Story 6.3 (Tool Parallelism)

Week 3:
├─ Day 1: Story 6.5 (Remove Deprecated Code)
├─ Day 2-3: Story 6.7 (Context Compression)
└─ Day 4: Story 6.8 (Streaming Progress)

Week 4:
└─ Testing, monitoring, and iteration
```

---

## Risk Mitigations

| Risk                                  | Mitigation                                   |
| ------------------------------------- | -------------------------------------------- |
| Extended thinking increases latency   | Keep budget at 10k tokens; show progress     |
| Haiku quality issues                  | Complexity detection auto-upgrades to Sonnet |
| Deprecated code removal breaks things | Git revert ready; remove last                |
| Parallel tools cause rate limits      | Cap at 3 parallel; exponential backoff       |

---

## Rollback Plan

Each story has a feature flag for quick rollback:

| Story | Flag                     | Rollback Behavior       |
| ----- | ------------------------ | ----------------------- |
| 6.1   | `ai_prompt_caching`      | Disable cache_control   |
| 6.2   | `ai_extended_thinking`   | Use standard completion |
| 6.3   | `maxParallelTools: 1`    | Sequential execution    |
| 6.4   | Admin model override     | Force Sonnet for all    |
| 6.6   | `ai_budget_enforcement`  | Unlimited usage         |
| 6.7   | `ai_context_compression` | Use full context        |
| 6.8   | N/A                      | Revert progress events  |

---

## Success Criteria

| Metric                          | Baseline | Target |
| ------------------------------- | -------- | ------ |
| Cost per deep research          | €2.50    | <€1.00 |
| Cost per quick research         | €0.80    | <€0.40 |
| Research latency                | 45s      | <30s   |
| Cache hit rate                  | 0%       | >70%   |
| Code lines (word-ai.service.ts) | 2,211    | <1,700 |
