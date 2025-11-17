# Claude AI Cost Optimization Guide

## Overview

This guide documents cost optimization strategies for using Anthropic Claude as our primary AI provider in the legal platform. By implementing these strategies, we can reduce AI costs by **up to 95%** while maintaining high-quality outputs.

**Last Updated:** 2025-11-17
**Author:** Mary (Business Analyst)

---

## Cost Optimization Strategies

### 1. Model Selection Strategy (Right-Sizing)

**Cost Impact:** 5-20x cost difference between models
**Implementation Complexity:** Medium
**Recommended Priority:** HIGH

#### Model Pricing (Per Million Tokens)

| Model                 | Input Cost | Output Cost | Use Case                    | Performance              |
| --------------------- | ---------- | ----------- | --------------------------- | ------------------------ |
| **Claude 3.5 Haiku**  | $0.80      | $4.00       | Simple tasks, high-volume   | Fast, efficient          |
| **Claude 3.5 Sonnet** | $3.00      | $15.00      | Standard tasks, balanced    | High quality, good speed |
| **Claude 4.1 Opus**   | $15.00     | $75.00      | Complex reasoning, critical | Best quality, slower     |

#### Smart Escalation Pattern

Implement intelligent model selection based on task complexity:

```typescript
// Pseudocode for model selection
function selectModel(taskType: string, complexity: string) {
  // Simple tasks: Document classification, metadata extraction, simple Q&A
  if (complexity === 'simple') {
    return 'claude-3-5-haiku-20241022';
  }

  // Standard tasks: Contract review, legal research, document drafting
  if (complexity === 'standard') {
    return 'claude-3-5-sonnet-20241022';
  }

  // Complex tasks: Complex litigation strategy, multi-document analysis
  if (complexity === 'complex') {
    return 'claude-4-1-opus-20241205';
  }
}
```

**Recommended Task→Model Mapping for Legal Platform:**

| Task                           | Recommended Model | Reasoning                             |
| ------------------------------ | ----------------- | ------------------------------------- |
| Document metadata extraction   | Haiku             | Simple pattern matching               |
| Email classification           | Haiku             | Fast, low-cost, high volume           |
| Simple Q&A (FAQs)              | Haiku             | Quick responses, predictable patterns |
| Contract clause extraction     | Sonnet            | Requires understanding context        |
| Legal research                 | Sonnet            | Balanced quality and cost             |
| Document drafting              | Sonnet            | Good quality, reasonable cost         |
| Contract review (detailed)     | Sonnet            | Most contracts can be handled well    |
| Complex litigation strategy    | Opus              | Requires deep reasoning               |
| Multi-document cross-analysis  | Opus              | Complex reasoning across sources      |
| Regulatory compliance analysis | Opus              | High-stakes, requires precision       |

**Cost Example:**

- **Haiku** for metadata extraction: 100K input, 5K output = $0.10
- **Sonnet** for same task: 100K input, 5K output = $0.38 (3.8x more expensive)
- **Opus** for same task: 100K input, 5K output = $1.88 (18.8x more expensive)

**Savings Potential:** 75-90% by using Haiku instead of Opus for simple tasks

---

### 2. Prompt Caching (90% Cost Reduction)

**Cost Impact:** 90% reduction on cached tokens
**Implementation Complexity:** Low
**Recommended Priority:** CRITICAL

#### How Prompt Caching Works

Prompt caching allows you to reuse frequently repeated content in prompts (system instructions, legal templates, case law references) at 90% reduced cost.

**Pricing:**

- **Cache Write (first time):** 1.25x base cost (25% premium)
- **Cache Read (subsequent uses):** 0.1x base cost (90% savings)
- **Cache TTL:** 5 minutes (auto-refreshes on each use)

**Example Cost Calculation (Sonnet):**

| Scenario                    | Tokens | Cost Without Caching | Cost With Caching | Savings |
| --------------------------- | ------ | -------------------- | ----------------- | ------- |
| First request (cache write) | 10K    | $0.030               | $0.0375           | -25%    |
| 2nd request (cache hit)     | 10K    | $0.030               | $0.003            | 90%     |
| 10 requests in 1 hour       | 100K   | $0.300               | $0.064            | 79%     |
| 100 requests in 1 hour      | 1M     | $3.000               | $0.307            | 90%     |

**When to Use Prompt Caching:**

✅ **Ideal Use Cases:**

- System prompts with legal context (e.g., "You are a legal assistant specializing in...")
- Legal templates (contract templates, clause libraries)
- Case law references and precedents
- Multi-turn conversations with persistent context
- Document analysis with repeated instructions

❌ **Not Suitable For:**

- One-off requests (no caching benefit)
- Highly dynamic prompts that change every request
- Prompts < 1,024 tokens (below minimum cacheable size)

**Implementation Example:**

```typescript
// Using Anthropic SDK with prompt caching
const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 4096,
  system: [
    {
      type: 'text',
      text: 'You are a legal assistant specializing in contract law...',
      cache_control: { type: 'ephemeral' }, // Mark for caching
    },
  ],
  messages: [{ role: 'user', content: 'Review this contract: [contract text]' }],
});
```

**Best Practices:**

1. **Place static content first** (system prompts, templates, legal context)
2. **Place dynamic content last** (user questions, specific documents)
3. **Use minimum 1,024 tokens** for Sonnet (2,048 for Haiku)
4. **Structure prompts consistently** (same order, same formatting)
5. **Monitor cache hit rates** via Anthropic dashboard

**Savings Potential:** 70-90% on AI costs for multi-turn conversations and repeated tasks

---

### 3. Batch API (50% Cost Reduction)

**Cost Impact:** 50% reduction on all tokens
**Implementation Complexity:** Medium
**Recommended Priority:** HIGH

#### How Batch API Works

Batch API processes large volumes of requests asynchronously with a **24-hour completion window** at **50% discount**.

**Pricing (Sonnet Example):**

- **Standard API:** $3.00 / $15.00 per MTok (input/output)
- **Batch API:** $1.50 / $7.50 per MTok (input/output)

**Batch Processing Details:**

- Up to **10,000 queries per batch**
- Processing time: **<24 hours** (usually faster)
- Available for: Claude 3.5 Sonnet, Claude 4.1 Opus, Claude 3.5 Haiku

**When to Use Batch API:**

✅ **Ideal Use Cases:**

- Bulk document analysis (reviewing 100s of contracts)
- Overnight report generation
- Large-scale data extraction from documents
- Periodic compliance checks
- Monthly/quarterly legal analytics

❌ **Not Suitable For:**

- Real-time user interactions (chatbots, live Q&A)
- Time-sensitive tasks requiring immediate response
- Interactive workflows requiring sequential processing

**Implementation Example:**

```typescript
// Create a batch of requests
const batch = await anthropic.batches.create({
  requests: [
    {
      custom_id: 'contract-001',
      params: {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [{ role: 'user', content: 'Review this contract: [contract 1]' }],
      },
    },
    {
      custom_id: 'contract-002',
      params: {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [{ role: 'user', content: 'Review this contract: [contract 2]' }],
      },
    },
    // ... up to 10,000 requests
  ],
});

// Check batch status
const status = await anthropic.batches.retrieve(batch.id);
console.log(status.processing_status); // 'in_progress', 'ended'

// Retrieve results when complete
const results = await anthropic.batches.results(batch.id);
```

**Cost Example (Bulk Contract Review):**

- **100 contracts**, 10K tokens each = 1M total tokens
- **Standard API:** $3.00 (input) + $15.00 (output, 4K each) = $18.00
- **Batch API:** $1.50 (input) + $7.50 (output) = $9.00
- **Savings:** $9.00 (50%)

**Savings Potential:** 50% on all batch-eligible workloads

---

### 4. Combined Optimization (Up to 95% Savings)

**Cost Impact:** Up to 95% reduction
**Implementation Complexity:** High
**Recommended Priority:** HIGH (for eligible workloads)

#### Combining Prompt Caching + Batch API

You can **stack discounts** by using both prompt caching and batch API together:

**Discount Calculation:**

1. **Batch API:** 50% off base price
2. **Prompt Caching (cached tokens):** 90% off base price
3. **Combined:** Up to 95% discount on cached tokens in batch requests

**Example Cost Calculation (Sonnet, 1M cached tokens):**

| Method                | Input Cost | Output Cost | Total     | Savings  |
| --------------------- | ---------- | ----------- | --------- | -------- |
| Standard API          | $3.00      | $15.00      | $18.00    | Baseline |
| Batch API only        | $1.50      | $7.50       | $9.00     | 50%      |
| Caching only (cached) | $0.30      | $1.50       | $1.80     | 90%      |
| **Batch + Caching**   | **$0.15**  | **$0.75**   | **$0.90** | **95%**  |

**Real-World Legal Platform Example:**

**Scenario:** Monthly compliance review of 500 contracts

- **Per contract:** 20K tokens input (10K system prompt, 10K contract)
- **System prompt:** Same for all contracts (eligible for caching)
- **Processing:** Overnight batch job (not time-sensitive)

**Cost Breakdown:**

| Approach                          | Cost       | Notes                  |
| --------------------------------- | ---------- | ---------------------- |
| Standard API, no optimization     | $300.00    | $3/MTok × 10M tokens   |
| Batch API only                    | $150.00    | 50% off                |
| Caching only (90% cached)         | $57.00     | 90% off cached portion |
| **Batch + Caching (recommended)** | **$28.50** | 95% total savings      |

**Annual Savings:** $3,600 → $342 = **$3,258 saved per year** (on this single workflow)

---

## Implementation Roadmap

### Phase 1: Quick Wins (Week 1-2)

**Effort:** Low | **Impact:** High

1. **Enable Prompt Caching** for system prompts
   - Update ai-service to use `cache_control` for static prompts
   - Implement caching for legal templates and instructions
   - Monitor cache hit rates via Anthropic dashboard

2. **Implement Smart Model Selection**
   - Create task complexity classifier
   - Route simple tasks to Haiku, standard to Sonnet
   - Reserve Opus for complex/critical tasks only

**Expected Savings:** 40-60% reduction in AI costs

### Phase 2: Batch Processing (Week 3-4)

**Effort:** Medium | **Impact:** High

1. **Identify Batch-Eligible Workloads**
   - Document analysis pipelines
   - Report generation
   - Compliance checks
   - Analytics processing

2. **Implement Batch API Integration**
   - Create batch job scheduler
   - Build batch request formatting
   - Implement batch result processing

**Expected Savings:** Additional 20-30% reduction on batch-eligible workloads

### Phase 3: Advanced Optimization (Month 2)

**Effort:** High | **Impact:** Medium-High

1. **Combine Caching + Batching**
   - Refactor batch jobs to use prompt caching
   - Optimize prompt structure for cache efficiency
   - Monitor combined savings

2. **Token Usage Optimization**
   - Trim verbose prompts
   - Implement response length limits
   - Use structured outputs to reduce output tokens

**Expected Savings:** Additional 10-20% reduction

---

## Monitoring and Measurement

### Key Metrics to Track

1. **Cost per Request**
   - Track by model, task type, endpoint
   - Target: <$0.01 per simple task, <$0.10 per standard task

2. **Cache Hit Rate**
   - Target: >80% for repeated workflows
   - Monitor via Anthropic API usage dashboard

3. **Batch Utilization**
   - % of eligible workloads using Batch API
   - Target: >90% of non-real-time tasks

4. **Model Distribution**
   - % of requests per model (Haiku/Sonnet/Opus)
   - Target: 60% Haiku, 35% Sonnet, 5% Opus

### Cost Monitoring Dashboard

Implement real-time cost tracking:

```typescript
// Example cost tracking
interface CostMetrics {
  totalTokens: number;
  totalCost: number;
  costByModel: Record<string, number>;
  cacheHitRate: number;
  batchUtilization: number;
  avgCostPerRequest: number;
}

// Log to monitoring service (New Relic, Datadog, etc.)
```

---

## Cost Projections

### Legal Platform AI Cost Estimates

**Assumptions:**

- 100 active users
- 10 AI requests per user per day (1,000 requests/day, 30K requests/month)
- Average 5K tokens input, 2K tokens output per request

**Monthly Cost Scenarios:**

| Optimization Level                  | Monthly Cost | Annual Cost | Savings vs Baseline |
| ----------------------------------- | ------------ | ----------- | ------------------- |
| **No optimization** (all Sonnet)    | $1,260       | $15,120     | Baseline            |
| **Model selection** (60% Haiku)     | $588         | $7,056      | 53%                 |
| **+ Prompt caching** (80% hit rate) | $176         | $2,112      | 86%                 |
| **+ Batch API** (50% eligible)      | $132         | $1,584      | 90%                 |
| **Full optimization**               | **$126**     | **$1,512**  | **90%**             |

**Scaling Projections:**

| Users | Requests/Month | Full Optimization Cost | No Optimization Cost | Savings    |
| ----- | -------------- | ---------------------- | -------------------- | ---------- |
| 100   | 30K            | $126                   | $1,260               | $1,134/mo  |
| 500   | 150K           | $630                   | $6,300               | $5,670/mo  |
| 1,000 | 300K           | $1,260                 | $12,600              | $11,340/mo |
| 5,000 | 1.5M           | $6,300                 | $63,000              | $56,700/mo |

---

## Cost Optimization Checklist

### Development

- [ ] Implement model selection logic based on task complexity
- [ ] Enable prompt caching for system prompts and templates
- [ ] Structure prompts with static content first, dynamic last
- [ ] Implement Batch API for non-real-time workloads
- [ ] Add token usage tracking to all AI requests
- [ ] Set response length limits (`max_tokens`) appropriately
- [ ] Use structured outputs (JSON) to reduce verbose responses

### Configuration

- [ ] Set `ANTHROPIC_USE_PROMPT_CACHING=true`
- [ ] Set `ANTHROPIC_USE_BATCHING=true`
- [ ] Configure model defaults: Haiku (simple), Sonnet (standard), Opus (complex)
- [ ] Set appropriate `max_tokens` limits (4K for most tasks, 2K for simple)
- [ ] Configure fallback to Grok if Claude unavailable

### Monitoring

- [ ] Track cost per request by task type
- [ ] Monitor cache hit rates (target >80%)
- [ ] Monitor batch utilization (target >90% of eligible tasks)
- [ ] Track model distribution (target: 60% Haiku, 35% Sonnet, 5% Opus)
- [ ] Set budget alerts ($150/month warning, $200/month critical)
- [ ] Weekly cost review meetings

### Testing

- [ ] Validate quality with Haiku vs Sonnet for each task type
- [ ] Test cache effectiveness on real prompts
- [ ] Verify batch processing doesn't impact user workflows
- [ ] Load test with expected volumes
- [ ] Measure latency impact of caching

---

## Fallback Strategy: Grok

**When Claude Fails or Rate Limits:**

- **Primary:** Claude (optimized as above)
- **Fallback:** xAI Grok
- **Grok Pricing:** ~$5/MTok (comparable to Sonnet)

**Automatic Fallback Configuration:**

```bash
AI_PROVIDER=anthropic
AI_FALLBACK_ENABLED=true
GROK_API_KEY=xai-xxxxx
```

**Fallback Logic:**

1. Try Claude with configured model
2. If Claude fails (rate limit, downtime, API error)
3. Automatically retry with Grok
4. Log fallback event for monitoring

---

## Additional Resources

- **Anthropic Prompt Caching Docs:** https://docs.anthropic.com/claude/docs/prompt-caching
- **Anthropic Batch API Docs:** https://docs.anthropic.com/claude/docs/message-batches-api
- **Anthropic Pricing Calculator:** https://console.anthropic.com/settings/pricing
- **Claude Cookbook (Examples):** https://github.com/anthropics/anthropic-cookbook

---

## Version History

| Version | Date       | Author         | Changes                                 |
| ------- | ---------- | -------------- | --------------------------------------- |
| 1.0     | 2025-11-17 | Mary (Analyst) | Initial cost optimization guide created |

---

## Questions or Feedback?

Contact: Platform Architecture Team
