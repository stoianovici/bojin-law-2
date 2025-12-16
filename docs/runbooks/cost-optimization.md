# Skills Cost Optimization Guide

**Story**: 2.14 - Skills Production Deployment and Monitoring
**Version**: 1.0
**Last Updated**: 2025-11-19
**Owner**: Platform Operations Team

---

## Cost Targets (AC#5)

| Metric           | Target | Alert Threshold |
| ---------------- | ------ | --------------- |
| Cost Savings     | >35%   | <30%            |
| Cost per Request | <$0.02 | >$0.03          |
| Daily AI Cost    | Varies | >$150           |
| Token Reduction  | >70%   | <60%            |

---

## Cost Breakdown

### Model Pricing (Anthropic Claude)

| Model  | Input (per 1M tokens) | Output (per 1M tokens) | Use Case           |
| ------ | --------------------- | ---------------------- | ------------------ |
| Haiku  | $0.25                 | $1.25                  | Simple, fast tasks |
| Sonnet | $3.00                 | $15.00                 | Most tasks         |
| Opus   | $15.00                | $75.00                 | Complex reasoning  |

### Skills Impact on Costs

**Without Skills**:

- Average tokens per request: 10,000
- Model: Sonnet (most requests)
- Cost per request: ~$0.18

**With Skills** (Target):

- Average tokens per request: 3,000 (70% reduction)
- Model mix: 60% Haiku, 35% Sonnet, 5% Opus
- Cost per request: ~$0.015
- **Savings: 92% → 35%+ overall savings after overhead**

---

## Cost Monitoring

### Daily Cost Report

```bash
# Generate daily cost report
node scripts/monitoring/daily-cost-report.js

# Expected output:
# Date: 2025-11-19
# Total Cost: $85.50
# Baseline Cost (without skills): $132.00
# Savings: $46.50 (35.2%)
#
# Model Distribution:
# - Haiku: 58% ($24.50)
# - Sonnet: 37% ($54.00)
# - Opus: 5% ($7.00)
#
# Token Usage:
# - Total: 45M tokens
# - With skills: 28M tokens
# - Without skills: 95M tokens
# - Reduction: 70.5%
```

### Cost Tracking Implementation

```typescript
// File: services/ai-service/src/monitoring/CostTracker.ts
// From Story 2.11

const costTracker = new CostTracker();

// Track individual request
await costTracker.trackUsage({
  model: 'claude-3-haiku-20240307',
  inputTokens: 1500,
  outputTokens: 500,
  skillsUsed: ['contract-analysis-ro'],
  savingsFromSkills: 0.72, // 72% token reduction
});

// Generate report
const report = await costTracker.generateReport(
  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
  new Date()
);

console.log('Cost Report:', {
  actualCost: report.actualCost,
  baselineCost: report.baselineCost,
  savingsPercent: report.savingsPercent,
  tokensSaved: report.tokensSaved,
});
```

---

## Optimization Strategies

### 1. Skill Configuration Optimization

**Problem**: Skills using too many tokens

**Diagnosis**:

```typescript
const expensiveSkills = await db.query(`
  SELECT
    skill_id,
    AVG(tokens_used) as avg_tokens,
    SUM(cost_usd) as total_cost,
    COUNT(*) as executions
  FROM skill_usage_logs
  WHERE timestamp > NOW() - INTERVAL '7 days'
  GROUP BY skill_id
  HAVING AVG(tokens_used) > 5000
  ORDER BY total_cost DESC
`);

console.log('Skills using >5K tokens:', expensiveSkills);
```

**Optimizations**:

```typescript
// Option 1: Reduce max_tokens
await skillsManager.updateSkill(skillId, {
  config: {
    max_tokens: 4000, // Reduce from 8000
    temperature: 0.3,
  },
});

// Option 2: Optimize skill content
// - Remove unnecessary examples
// - Use more concise instructions
// - Reduce context window
// - Use skill-specific prompts instead of generic ones

// Option 3: Split complex skills
// Before: One skill does everything (8000 tokens)
// After: Two specialized skills (2000 tokens each)
```

**Expected Impact**:

- Token usage: -40%
- Cost per request: -35%
- Response time: -20%

---

### 2. Model Selection Optimization

**Problem**: Too many requests using expensive models (Sonnet/Opus)

**Diagnosis**:

```typescript
const modelDistribution = await db.query(`
  SELECT
    model,
    COUNT(*) as count,
    SUM(cost_usd) as total_cost,
    AVG(cost_usd) as avg_cost
  FROM skill_usage_logs
  WHERE timestamp > NOW() - INTERVAL '24 hours'
  GROUP BY model
  ORDER BY total_cost DESC
`);

console.log('Model distribution:', modelDistribution);
// Target: 60% Haiku, 35% Sonnet, 5% Opus
```

**Optimizations**:

```typescript
// Option 1: Tune routing thresholds
// File: services/ai-service/src/routing/SkillSelector.ts

class SkillSelector {
  selectModel(request: Request, skillEffectiveness: number): Model {
    // Bias towards Haiku for simple tasks
    if (skillEffectiveness > 0.85 && request.complexity < 0.3) {
      return 'claude-3-haiku-20240307';  // Use Haiku more often
    }

    if (skillEffectiveness > 0.7) {
      return 'claude-3-sonnet-20240229';
    }

    return 'claude-3-opus-20240229';  // Only for complex tasks
  }
}

// Option 2: Implement cost-aware routing
async selectModelWithCostConstraint(request: Request, maxCost: number): Promise<Model> {
  // Calculate estimated cost for each model
  const haikuCost = estimateCost('haiku', request.estimatedTokens);
  const sonnetCost = estimateCost('sonnet', request.estimatedTokens);

  if (haikuCost < maxCost && request.complexity < 0.5) {
    return 'claude-3-haiku-20240307';
  }

  if (sonnetCost < maxCost) {
    return 'claude-3-sonnet-20240229';
  }

  // Fallback or reject if over budget
  throw new Error(`Request exceeds cost budget: $${maxCost}`);
}
```

**Expected Impact**:

- Haiku usage: 40% → 60%
- Average cost per request: -25%
- Total savings: 30% → 40%

---

### 3. Cache Optimization for Cost

**Problem**: Low cache hit rate increases API costs

**Diagnosis**:

```bash
# Check cache hit rate
redis-cli -u $REDIS_URL INFO stats | grep keyspace_hits

# Calculate cost savings from cache
cached_requests=$(redis-cli -u $REDIS_URL GET "metrics:cache:hits:daily")
cost_per_request=0.015
cache_savings=$(echo "$cached_requests * $cost_per_request" | bc)

echo "Daily cache savings: \$$cache_savings"
```

**Optimizations**:

```typescript
// Option 1: Increase cache TTL for stable skills
const skillsManager = new SkillsManager(apiClient, {
  cacheTTL: 7200, // 2 hours for stable skills
  maxCacheSize: 200,
});

// Option 2: Implement smart caching strategy
class SmartSkillCache {
  getCacheTTL(skillId: string, effectiveness: number): number {
    // High effectiveness = longer cache
    if (effectiveness > 0.9) return 7200; // 2 hours
    if (effectiveness > 0.8) return 3600; // 1 hour
    return 1800; // 30 minutes
  }

  async cacheSkill(skillId: string, skill: Skill, effectiveness: number) {
    const ttl = this.getCacheTTL(skillId, effectiveness);
    await redis.setex(`skill:cache:${skillId}`, ttl, JSON.stringify(skill));
  }
}

// Option 3: Prefetch popular skills
async function prefetchPopularSkills() {
  const popular = await getPopularSkills((limit = 10));
  for (const skillId of popular) {
    await skillsManager.getSkill(skillId, (useCache = true));
  }
}

// Run on startup and hourly
prefetchPopularSkills();
setInterval(prefetchPopularSkills, 60 * 60 * 1000);
```

**Expected Impact**:

- Cache hit rate: 30% → 50%
- Cached requests per day: +5,000
- Daily cost savings: +$75

---

### 4. Skill Effectiveness Optimization

**Problem**: Low-effectiveness skills not providing value

**Diagnosis**:

```typescript
const skillEffectiveness = await db.query(`
  SELECT
    skill_id,
    AVG(tokens_saved) as avg_token_savings,
    AVG(cost_usd) as avg_cost,
    COUNT(*) as usage_count,
    AVG(tokens_saved) * COUNT(*) as total_tokens_saved
  FROM skill_usage_logs
  WHERE timestamp > NOW() - INTERVAL '7 days'
  GROUP BY skill_id
  ORDER BY total_tokens_saved DESC
`);

// Identify skills with <50% token savings
const ineffectiveSkills = skillEffectiveness.filter((s) => s.avg_token_savings < 0.5);
console.log('Ineffective skills:', ineffectiveSkills);
```

**Optimizations**:

```typescript
// Option 1: Disable low-effectiveness skills
for (const skill of ineffectiveSkills) {
  if (skill.avg_token_savings < 0.3) {
    await skillsManager.deleteSkill(skill.skill_id);
    console.log(`Disabled ineffective skill: ${skill.skill_id}`);
  }
}

// Option 2: Improve skill prompts
// - Add more specific examples
// - Clarify instructions
// - Reduce prompt overhead

// Option 3: Adjust skill selection thresholds
const skillSelector = new SkillSelector(registry);
skillSelector.setEffectivenessThreshold(0.7); // Only use skills with >70% savings
```

**Expected Impact**:

- Remove 2-3 ineffective skills
- Focus usage on high-value skills
- Cost savings: +5-10%

---

### 5. Request Batching

**Problem**: Individual requests have overhead

**Optimization**:

```typescript
class BatchedSkillExecutor {
  private queue: Request[] = [];
  private batchSize = 5;
  private batchInterval = 100; // ms

  async execute(request: Request): Promise<Response> {
    this.queue.push(request);

    if (this.queue.length >= this.batchSize) {
      return this.executeBatch();
    }

    // Wait for more requests or timeout
    await this.wait(this.batchInterval);
    return this.executeBatch();
  }

  private async executeBatch(): Promise<Response[]> {
    const batch = this.queue.splice(0, this.batchSize);

    // Execute all in parallel
    const responses = await Promise.all(batch.map((req) => this.executeSkill(req)));

    return responses;
  }
}
```

**Expected Impact**:

- Reduced API overhead
- Potential cost savings: 5-10%
- Improved throughput

---

## Cost Alerting

### Alert Configuration

```yaml
# File: monitoring/alerts/cost-alerts.yml

alerts:
  - name: Daily Cost Exceeded
    condition: daily_cost > $150
    action: notify_slack
    channel: #cost-alerts
    severity: warning

  - name: Cost Savings Below Target
    condition: savings_percent < 30%
    duration: 24 hours
    action: page_oncall
    severity: high

  - name: Unexpected Cost Spike
    condition: hourly_cost > avg(hourly_cost, 24h) * 2
    action: notify_slack
    channel: #cost-alerts
    severity: warning

  - name: Model Distribution Skewed
    condition: opus_percent > 10%
    duration: 1 hour
    action: notify_email
    severity: medium
```

### Implementation

```typescript
class CostAlerter {
  async checkAndAlert() {
    const report = await costTracker.generateReport(
      new Date(Date.now() - 24 * 60 * 60 * 1000),
      new Date()
    );

    // Alert on high cost
    if (report.actualCost > 150) {
      await this.sendSlackAlert(
        '#cost-alerts',
        `⚠️ Daily cost exceeded: $${report.actualCost.toFixed(2)}`
      );
    }

    // Alert on low savings
    if (report.savingsPercent < 30) {
      await this.sendPagerDutyAlert(
        'high',
        `Cost savings below target: ${report.savingsPercent.toFixed(1)}%`
      );
    }

    // Alert on model distribution
    const opusPercent = (report.modelBreakdown.opus / report.actualCost) * 100;
    if (opusPercent > 10) {
      await this.sendEmailAlert(
        'engineering@example.com',
        `Opus usage elevated: ${opusPercent.toFixed(1)}%`
      );
    }
  }
}

// Run every hour
setInterval(() => new CostAlerter().checkAndAlert(), 60 * 60 * 1000);
```

---

## Cost Analysis & Reporting

### Weekly Cost Review

```bash
# Generate weekly report
node scripts/monitoring/weekly-cost-report.js

# Expected output:
# Week: Nov 13-19, 2025
# Total Cost: $598.50
# Baseline Cost: $924.00
# Savings: $325.50 (35.2%)
#
# Top Cost Drivers:
# 1. Contract Analysis: $245.00 (41%)
# 2. Document Drafting: $198.50 (33%)
# 3. Legal Research: $95.00 (16%)
# 4. Compliance Check: $60.00 (10%)
#
# Optimization Opportunities:
# - Increase Haiku usage for Contract Analysis
# - Optimize Document Drafting prompts
# - Cache more Legal Research results
```

### Cost Projection

```typescript
async function projectMonthlyCost(): Promise<CostProjection> {
  const costTracker = new CostTracker();

  // Get 7-day historical data
  const historicalData = await costTracker.getHistoricalCosts(7);
  const avgDailyCost = historicalData.reduce((sum, day) => sum + day.cost, 0) / 7;

  // Project to monthly
  const monthlyProjection = avgDailyCost * 30;
  const monthlyBaseline = (avgDailyCost * 30) / (1 - 0.35); // Assume 35% savings
  const monthlySavings = monthlyBaseline - monthlyProjection;

  return {
    projectedCost: monthlyProjection,
    baselineCost: monthlyBaseline,
    projectedSavings: monthlySavings,
    savingsPercent: (monthlySavings / monthlyBaseline) * 100,
  };
}

// Example output:
// Projected Monthly Cost: $2,550
// Baseline Cost (without skills): $3,923
// Projected Savings: $1,373 (35%)
```

---

## Cost Optimization Checklist

### Daily

- [ ] Review daily cost report
- [ ] Check cost alerts
- [ ] Verify savings >35%

### Weekly

- [ ] Analyze model distribution
- [ ] Review skill effectiveness
- [ ] Identify optimization opportunities
- [ ] Generate weekly cost report

### Monthly

- [ ] Conduct cost review meeting
- [ ] Update cost projections
- [ ] Implement approved optimizations
- [ ] Review and adjust budgets

---

## Cost-Related Incidents

### Scenario: Cost Spike (>50% above baseline)

**Investigation**:

```typescript
// 1. Identify time of spike
const costByHour = await db.query(`
  SELECT
    DATE_TRUNC('hour', timestamp) as hour,
    SUM(cost_usd) as hourly_cost
  FROM skill_usage_logs
  WHERE timestamp > NOW() - INTERVAL '24 hours'
  GROUP BY hour
  ORDER BY hour DESC
`);

// 2. Identify cause
const expensiveRequests = await db.query(
  `
  SELECT *
  FROM skill_usage_logs
  WHERE timestamp BETWEEN $1 AND $2
  AND cost_usd > 0.05
  ORDER BY cost_usd DESC
  LIMIT 20
`,
  [spikeStart, spikeEnd]
);
```

**Mitigation**:

1. Disable expensive skill if problematic
2. Reduce rollout percentage
3. Implement rate limiting
4. Add cost caps per user/request

---

## Related Documents

- [Skills Deployment Runbook](./skills-deployment.md)
- [Performance Tuning Guide](./performance-tuning.md)
- [Incident Response Guide](./incident-response.md)

---

## Change Log

| Date       | Version | Changes                | Author            |
| ---------- | ------- | ---------------------- | ----------------- |
| 2025-11-19 | 1.0     | Initial guide creation | James (Dev Agent) |
