# Skills Production Training Guide

**Version:** 1.0
**Last Updated:** 2025-11-19
**Duration:** 7 hours total
**Audience:** Engineering team, DevOps, Support

---

## Table of Contents

1. [Skills Architecture Overview](#1-skills-architecture-overview) (2 hours)
2. [Deployment Procedures](#2-deployment-procedures) (1 hour)
3. [Monitoring and Alerts](#3-monitoring-and-alerts) (1 hour)
4. [Troubleshooting](#4-troubleshooting) (2 hours)
5. [Cost Management](#5-cost-management) (1 hour)
6. [Resources and References](#6-resources-and-references)

---

## 1. Skills Architecture Overview

**Duration:** 2 hours
**Objective:** Understand the complete Skills infrastructure and how components interact

### 1.1 What are Claude Skills?

Claude Skills (Beta API) allows Claude to use custom tools and capabilities:

- **Skills** = Specialized capabilities uploaded to Anthropic's infrastructure
- **Benefits**:
  - 70%+ token reduction for specialized tasks
  - Consistent, repeatable results
  - Domain-specific expertise without full context
  - Cached execution for improved performance

### 1.2 Skills Infrastructure Components

#### From Story 2.11: Core Infrastructure

**AnthropicEnhancedClient** (`services/ai-service/src/clients/AnthropicEnhancedClient.ts`)

- Extends Anthropic SDK with Skills beta flags
- Enables: `skills-2025-10-02`, `code-execution-2025-08-25`
- Handles Skills-enabled API calls

**SkillsManager** (`services/ai-service/src/skills/SkillsManager.ts`)

- Skill lifecycle management (upload, validation, caching)
- LRU + TTL caching for skill metadata
- Validation: dangerous patterns, size limits (100KB)
- Database persistence: `skills`, `skill_versions` tables

**SkillsRegistry** (`services/ai-service/src/skills/SkillsRegistry.ts`)

- Pattern-based skill discovery
- 8 task categories: Contract Analysis, Document Drafting, Legal Research, Compliance, Due Diligence, Dispute Resolution, IP Protection, Corporate Governance
- Maps user requests to appropriate skills

**CostTracker** (`services/ai-service/src/monitoring/CostTracker.ts`)

- Real-time cost tracking
- Savings percentage calculation (baseline vs skills)
- Historical cost analysis
- Database logging: `skill_usage_logs` table

#### From Story 2.12: Production Skills

**Core Legal Skills** (`skills/` directory)

1. **Contract Analysis** - Extract clauses, risks, obligations
2. **Document Drafting** - Generate legal documents from templates
3. **Legal Research** - Find precedents and regulations
4. **Compliance Check** - Validate against regulations

**Romanian Templates** (`packages/romanian-templates/`)

- 10 document templates for Romanian legal work
- Variable substitution format: `{{VARIABLE_NAME}}`
- Template registry with generation/validation

#### From Story 2.13: Skills Integration

**SkillSelector** (`services/ai-service/src/routing/SkillSelector.ts`)

- Pattern matching for skill selection
- Hybrid routing: skills + model selection
- Fallback logic for skill failures

**PerformanceOptimizer** (`services/ai-service/src/routing/PerformanceOptimizer.ts`)

- Routing overhead target: <100ms
- Cache warming strategies
- Performance monitoring

**ExperimentManager** (`services/ai-service/src/experiments/ExperimentManager.ts`)

- A/B testing framework
- Traffic splitting (control vs experiment)
- Statistical validation

#### From Story 2.14: Production Monitoring

**AlertsManager** (`services/ai-service/src/monitoring/AlertsManager.ts`)

- Multi-channel alerting: PagerDuty, Slack, Email
- Alert thresholds: error rate >5%, response time >10s, cost spike >150%
- Escalation policies for critical alerts

**SkillsMetricsCollector** (`services/ai-service/src/monitoring/SkillsMetricsCollector.ts`)

- New Relic integration
- Custom metrics: execution time, token savings, cost
- Model distribution tracking

**CostDashboard** (`services/ai-service/src/monitoring/CostDashboard.ts`)

- Cost validation (AC#5: >35% savings)
- Cost trend analysis
- Anomaly detection

**HealthChecker** (`services/ai-service/src/monitoring/HealthChecker.ts`)

- Service health: database, Redis, Claude API, Skills API
- Resource monitoring: CPU, memory
- Skills metrics: cache hit rate, error rate, response time

### 1.3 Data Flow

```
User Request
    ↓
RequestRouter (Story 2.13)
    ↓
SkillSelector (pattern matching)
    ↓
AnthropicEnhancedClient (with skills)
    ↓
Claude API (Anthropic infrastructure executes skill)
    ↓
Response with reduced tokens
    ↓
CostTracker (log savings)
    ↓
SkillsMetricsCollector (New Relic)
    ↓
User Response
```

### 1.4 Database Schema

**`skills` table** (from Story 2.11):

```sql
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  skill_id VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  skill_definition JSONB NOT NULL,
  version VARCHAR(50) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_skills_skill_id ON skills(skill_id);
CREATE INDEX idx_skills_active ON skills(active);
```

**`skill_usage_logs` table**:

```sql
CREATE TABLE skill_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id VARCHAR(255) NOT NULL,
  skill_ids TEXT[] NOT NULL,
  task_type VARCHAR(100),
  tokens_used INTEGER NOT NULL,
  tokens_saved_estimate INTEGER,
  cost_usd DECIMAL(10, 6),
  cost_saved_usd DECIMAL(10, 6),
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usage_logs_created_at ON skill_usage_logs(created_at);
CREATE INDEX idx_usage_logs_skill_ids ON skill_usage_logs USING GIN(skill_ids);
```

### 1.5 Hands-On Exercise (30 minutes)

**Exercise 1:** Review existing skills

```bash
cd /Users/mio/Desktop/dev/Bojin-law\ 2
ls -la skills/
cat skills/contract-analysis/SKILL.md
```

**Exercise 2:** Test AnthropicEnhancedClient

```typescript
import { AnthropicEnhancedClient } from './services/ai-service/src/clients/AnthropicEnhancedClient';

const client = new AnthropicEnhancedClient({ apiKey: process.env.ANTHROPIC_API_KEY });

const response = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Analyze this contract...' }],
  skills: [{ type: 'custom', custom_skill_id: 'contract-analysis' }],
});

console.log('Tokens used:', response.usage.input_tokens);
```

**Exercise 3:** Query cost savings

```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as requests,
  SUM(tokens_saved_estimate) as total_tokens_saved,
  SUM(cost_saved_usd) as total_cost_saved
FROM skill_usage_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 2. Deployment Procedures

**Duration:** 1 hour
**Objective:** Learn how to safely deploy skills to production

### 2.1 Pre-Deployment Checklist

From `docs/runbooks/skills-deployment.md`:

- [ ] Story 2.11 infrastructure deployed
- [ ] Story 2.12 skills tested in staging
- [ ] Story 2.13 routing configured
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Monitoring dashboards set up
- [ ] Alert channels configured (PagerDuty, Slack)
- [ ] Rollback plan reviewed
- [ ] On-call engineer assigned

### 2.2 Deployment Steps

#### Step 1: Upload Skill

```typescript
import { SkillsManager } from './services/ai-service/src/skills/SkillsManager';

const manager = new SkillsManager({ dbConnection, cacheConfig });

const skillDefinition = {
  skill_id: 'contract-analysis',
  display_name: 'Contract Analysis',
  description: 'Analyzes legal contracts for key clauses and risks',
  version: '1.0.0',
  content: skillContent, // From skills/contract-analysis/SKILL.md
};

await manager.uploadSkill(skillDefinition);
```

#### Step 2: Validate in Staging

```bash
# Run integration tests
npm run test:integration -- --grep "skills"

# Test skill execution
curl -X POST https://staging-api.example.com/api/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "document": "Sample contract...",
    "skill": "contract-analysis"
  }'
```

#### Step 3: Configure Routing

```typescript
import { SkillSelector } from './services/ai-service/src/routing/SkillSelector';

const selector = new SkillSelector({ registry });

// Update pattern matching
await selector.updatePatterns('contract-analysis', {
  keywords: ['contract', 'agreement', 'terms', 'clause'],
  minConfidence: 0.7,
});
```

#### Step 4: Deploy to Production

```bash
# Via Render.com Dashboard:
# 1. Navigate to service
# 2. Click "Manual Deploy"
# 3. Select branch: main
# 4. Click "Deploy"

# Monitor deployment
curl https://legal-platform-web.onrender.com/health
```

#### Step 5: Monitor for 24 Hours

- Check New Relic dashboards
- Review error rates in Sentry
- Monitor cost savings in CostDashboard
- Verify cache hit rates
- Check Slack alerts

### 2.3 Rollback Procedures

From `docs/runbooks/skills-rollback.md`:

**Method 1: Feature Flag Disable (Fastest - 2 minutes)**

```typescript
// Disable skills for all users
await rolloutManager.setRolloutPercentage(0);
```

**Method 2: Render Rollback (5 minutes)**

1. Access Render Dashboard
2. Navigate to service
3. Click "Rollback" → Select previous deployment
4. Confirm rollback

**Method 3: Deactivate Skill (10 minutes)**

```sql
UPDATE skills
SET active = false
WHERE skill_id = 'problematic-skill';
```

**Method 4: Emergency Circuit Breaker (15 minutes)**

```typescript
// In code
export const SKILLS_CIRCUIT_BREAKER = {
  enabled: false, // Toggle to disable all skills
  errorThreshold: 0.05, // 5%
  resetTimeout: 60000, // 1 minute
};
```

### 2.4 Hands-On Exercise (20 minutes)

**Exercise:** Practice rollback

1. Enable a test skill
2. Trigger an error condition
3. Execute rollback via feature flag
4. Verify fallback to non-skills routing
5. Re-enable skill
6. Confirm functionality restored

---

## 3. Monitoring and Alerts

**Duration:** 1 hour
**Objective:** Master monitoring dashboards and alert response

### 3.1 New Relic Dashboards

#### Dashboard 1: Skills Overview

**Location:** New Relic → Dashboards → Skills Overview

**Widgets:**

- Active Skills Count (gauge)
- Requests per Minute (line chart)
- Token Savings Percentage (gauge)
- Cost per Minute (line chart)
- Error Rate (gauge)

**NRQL Queries:**

```sql
-- Active Skills Count
SELECT uniqueCount(skillId)
FROM SkillExecution
SINCE 1 hour ago

-- Token Savings Percentage
SELECT average(tokenSavings / tokensUsed * 100) as 'Savings %'
FROM SkillExecution
SINCE 1 hour ago

-- Error Rate
SELECT percentage(count(*), WHERE success = false) as 'Error Rate'
FROM SkillExecution
SINCE 1 hour ago
```

#### Dashboard 2: Cost Optimization

**Widgets:**

- Daily Cost (billboard)
- Cost Savings (line chart)
- Model Distribution (pie chart)
- Cost per Request (histogram)

**NRQL Queries:**

```sql
-- Daily Cost
SELECT sum(cost) as 'Total Cost ($)'
FROM CostMetrics
SINCE 1 day ago

-- Cost Savings
SELECT sum(costWithoutSkills - costWithSkills) as 'Savings ($)'
FROM CostMetrics
SINCE 7 days ago
TIMESERIES 1 day
```

#### Dashboard 3: Performance Metrics

**Widgets:**

- P95 Response Time (gauge)
- Routing Overhead (line chart)
- Cache Hit Rate (gauge)
- Skill Execution Times (histogram)

### 3.2 Alert Configuration

From `services/ai-service/src/monitoring/AlertsManager.ts`:

**Critical Alerts (PagerDuty):**

1. **Skills Service Down**
   - Condition: `serviceHealth == 0`
   - Duration: 1 minute
   - Action: Page on-call

2. **High Skill Error Rate**
   - Condition: `skillErrorRate > 5%`
   - Duration: 5 minutes
   - Action: Page on-call

3. **Skills Response Time Critical**
   - Condition: `p95ResponseTime > 10s`
   - Duration: 5 minutes
   - Action: Page on-call

**Warning Alerts (Slack):**

1. **Elevated Timeout Rate**
   - Condition: `timeoutRate > 5%`
   - Duration: 10 minutes
   - Channel: #alerts-skills

2. **Low Cache Hit Rate**
   - Condition: `cacheHitRate < 30%`
   - Duration: 15 minutes
   - Channel: #alerts-skills

3. **Cost Spike Detected**
   - Condition: `costSpike > 150%`
   - Duration: Immediate
   - Channel: #alerts-cost

### 3.3 Alert Response Procedures

#### SEV1: Skills Service Down

**Immediate Actions (15 minutes):**

1. Check Render service status
2. Review New Relic error tracking
3. Check database connectivity
4. Verify Claude API status
5. Review recent deployments

**Mitigation:**

1. Enable circuit breaker
2. Fallback to non-skills routing
3. Scale up service if needed
4. Rollback if recent deployment

**Runbook:** `docs/runbooks/incident-response.md#sev1-complete-skills-outage`

#### SEV2: High Error Rate

**Actions (30 minutes):**

1. Identify which skills are failing
2. Check skill execution logs
3. Review error patterns in Sentry
4. Disable problematic skill if isolated
5. Investigate root cause

**Runbook:** `docs/runbooks/incident-response.md#sev1-high-error-rate`

### 3.4 Hands-On Exercise (20 minutes)

**Exercise 1:** Navigate New Relic Dashboards

- Log into New Relic
- Find Skills Overview dashboard
- Identify current token savings percentage
- Check p95 response time

**Exercise 2:** Test Alert

- Trigger test alert in Slack
- Verify PagerDuty integration
- Practice incident response workflow

---

## 4. Troubleshooting

**Duration:** 2 hours
**Objective:** Diagnose and resolve common production issues

### 4.1 Common Issues and Solutions

#### Issue 1: Low Cache Hit Rate (<30%)

**Symptoms:**

- Cache hit rate below 30%
- Increased response times
- Higher costs than expected

**Diagnosis:**

```typescript
// Check cache stats
const cacheStats = await skillsManager.getCacheStats();
console.log('Cache size:', cacheStats.size);
console.log('Hit rate:', cacheStats.hitRate);
console.log('Evictions:', cacheStats.evictions);
```

**Solutions:**

1. Increase Redis memory allocation
2. Adjust TTL settings (currently 1 hour)
3. Warm cache for popular skills
4. Review LRU eviction patterns

**Runbook:** `docs/runbooks/performance-tuning.md#cache-optimization`

#### Issue 2: Slow Response Times (>5s)

**Symptoms:**

- P95 response time >5s
- User complaints about slowness
- Timeout errors

**Diagnosis:**

```bash
# Check New Relic transaction traces
# Look for slowest components

# Check skill execution times
curl -X GET https://api.example.com/api/monitoring/skills/performance
```

**Solutions:**

1. Review skill complexity
2. Optimize skill prompts
3. Check routing overhead (<100ms target)
4. Investigate database query performance
5. Review model selection (Haiku vs Sonnet)

**Runbook:** `docs/runbooks/performance-tuning.md#slow-response-times`

#### Issue 3: Cost Savings Below 35%

**Symptoms:**

- Cost validation failing
- Savings percentage <35%
- Cost alerts in Slack

**Diagnosis:**

```typescript
const validation = await costDashboard.validateCostSavings(35, 7);
console.log('Achieved:', validation.achieved);
console.log('Actual savings:', validation.actualSavings);
console.log('Model breakdown:', validation.breakdown);
```

**Solutions:**

1. Review skill effectiveness by skill
2. Check if skills are being used (SkillSelector patterns)
3. Verify token estimates are accurate
4. Investigate model distribution (too much Haiku?)
5. Review recent skill changes

**Runbook:** `docs/runbooks/cost-optimization.md#savings-below-target`

#### Issue 4: Skill Upload Failures

**Symptoms:**

- Skill upload rejected
- Validation errors
- 400 Bad Request from API

**Diagnosis:**

```typescript
try {
  await skillsManager.uploadSkill(skillDef);
} catch (error) {
  console.error('Upload failed:', error.message);
  console.error('Validation errors:', error.validationErrors);
}
```

**Solutions:**

1. Check skill size (<100KB limit)
2. Review for dangerous patterns (eval, exec)
3. Validate JSON structure
4. Check API key permissions
5. Verify network connectivity

**Runbook:** `docs/runbooks/skills-deployment.md#troubleshooting-uploads`

#### Issue 5: High Timeout Rate (>5%)

**Symptoms:**

- Timeout alerts in Slack
- Skills taking >30s
- User frustration

**Diagnosis:**

```sql
SELECT
  skill_ids,
  COUNT(*) as timeout_count,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration
FROM skill_usage_logs
WHERE success = false
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY skill_ids
ORDER BY timeout_count DESC;
```

**Solutions:**

1. Identify which skills timeout most
2. Review skill prompt complexity
3. Consider skill redesign for complex tasks
4. Increase timeout thresholds (with caution)
5. Implement timeout handling/retries

**Runbook:** `docs/runbooks/performance-tuning.md#timeout-issues`

### 4.2 Debugging Tools

**Tool 1: Winston Logs**

```bash
# Stream logs
tail -f /var/log/ai-service/combined.log | grep "SkillExecution"

# Search for errors
grep -i "error" /var/log/ai-service/error.log | tail -20
```

**Tool 2: Database Queries**

```sql
-- Recent skill usage
SELECT * FROM skill_usage_logs
ORDER BY created_at DESC
LIMIT 10;

-- Failed executions
SELECT skill_ids, COUNT(*) as failures
FROM skill_usage_logs
WHERE success = false
  AND created_at > NOW() - INTERVAL '1 day'
GROUP BY skill_ids
ORDER BY failures DESC;

-- Cost analysis
SELECT
  DATE(created_at) as date,
  SUM(cost_usd) as total_cost,
  SUM(cost_saved_usd) as total_saved,
  SUM(cost_saved_usd) / NULLIF(SUM(cost_usd), 0) * 100 as savings_percent
FROM skill_usage_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at);
```

**Tool 3: Health Check Endpoint**

```bash
# Check service health
curl https://api.example.com/health | jq '.'

# Expected output:
# {
#   "status": "healthy",
#   "services": {
#     "database": "healthy",
#     "redis": "healthy",
#     "claudeAPI": "healthy",
#     "skillsAPI": "healthy"
#   },
#   "skillsMetrics": {
#     "activeSkillsCount": 4,
#     "cacheHitRate": 0.65,
#     "avgResponseTimeMs": 3200,
#     "errorRate": 0.01
#   }
# }
```

### 4.3 Hands-On Exercise (60 minutes)

**Scenario 1:** Cache Hit Rate Drops to 20%

- Diagnose using CostDashboard
- Identify eviction patterns
- Implement cache warming
- Verify improvement

**Scenario 2:** Cost Savings Fall to 28%

- Run cost validation
- Review model breakdown
- Check skill usage patterns
- Recommend optimizations

**Scenario 3:** Skill Timeouts Spike

- Query timeout logs
- Identify problematic skills
- Analyze skill complexity
- Propose solution

---

## 5. Cost Management

**Duration:** 1 hour
**Objective:** Monitor and optimize AI costs using Skills

### 5.1 Cost Targets (AC#5)

From Story 2.14:

- **Target:** >35% cost savings vs non-skills baseline
- **Monitoring:** Daily validation required
- **Alert:** Slack notification if <35%

### 5.2 Cost Monitoring

**Daily Cost Report:**

```bash
# Run automated cost report
node scripts/monitoring/daily-cost-report.js

# Output:
# ========================================
# DAILY COST REPORT
# Date: 2025-11-19
# ========================================
# Total Cost: $45.23
# Cost without Skills: $72.15
# Savings: $26.92 (37.3%)
# Tokens Saved: 125,430
# Requests with Skills: 1,247
# Model Distribution:
#   - Haiku: 45% ($12.50)
#   - Sonnet: 50% ($28.50)
#   - Opus: 5% ($4.23)
# ========================================
```

**Cost Dashboard:**

```typescript
import { CostDashboard } from './services/ai-service/src/monitoring/CostDashboard';

const dashboard = new CostDashboard(dbConnection);

// Validate savings
const validation = await dashboard.validateCostSavings(35, 7);

console.log(`Savings: ${validation.actualSavings.toFixed(1)}%`);
console.log(`Target Met: ${validation.achieved ? 'YES' : 'NO'}`);
console.log(
  `Total Saved: $${(validation.totalCostWithoutSkills - validation.totalCostWithSkills).toFixed(2)}`
);

// Model breakdown
console.log('\nModel Breakdown:');
console.log('Haiku:', validation.breakdown.haiku);
console.log('Sonnet:', validation.breakdown.sonnet);
console.log('Opus:', validation.breakdown.opus);
```

### 5.3 Cost Optimization Strategies

#### Strategy 1: Maximize Skills Usage

**Goal:** Use skills for 80%+ of eligible requests

**Actions:**

1. Review SkillSelector patterns
2. Expand skill coverage to more use cases
3. Train users on when to trigger skills
4. Monitor skill selection rate

**Metrics:**

```sql
SELECT
  COUNT(*) FILTER (WHERE skill_ids IS NOT NULL AND array_length(skill_ids, 1) > 0) as with_skills,
  COUNT(*) as total,
  (COUNT(*) FILTER (WHERE skill_ids IS NOT NULL AND array_length(skill_ids, 1) > 0)::float / COUNT(*) * 100) as percentage
FROM skill_usage_logs
WHERE created_at > NOW() - INTERVAL '1 day';
```

#### Strategy 2: Optimize Model Selection

**Goal:** Use cheapest model that meets quality requirements

**Cost Comparison:**

- Haiku: $0.25 / 1M input tokens, $1.25 / 1M output tokens
- Sonnet: $3.00 / 1M input tokens, $15.00 / 1M output tokens
- Opus: $15.00 / 1M input tokens, $75.00 / 1M output tokens

**Actions:**

1. Review tasks using Opus (most expensive)
2. Test if Sonnet + Skills can replace Opus
3. Use Haiku + Skills for simple tasks
4. Monitor quality metrics

#### Strategy 3: Increase Cache Hit Rate

**Goal:** >40% cache hit rate for deterministic requests

**Actions:**

1. Identify frequently requested analyses
2. Implement cache warming during low-traffic hours
3. Increase Redis memory allocation
4. Adjust TTL based on content freshness requirements

**Savings:**

- Cache hit = No API call = $0 cost
- 40% hit rate on 10,000 requests/day = 4,000 free requests
- Estimated savings: $200-400/day

#### Strategy 4: Skill Effectiveness Review

**Goal:** Identify and improve low-performing skills

**Query:**

```sql
SELECT
  skill_id,
  COUNT(*) as usage_count,
  AVG(tokens_saved_estimate) as avg_tokens_saved,
  AVG(cost_saved_usd) as avg_cost_saved,
  AVG(cost_saved_usd / NULLIF(cost_usd, 0) * 100) as savings_percent
FROM (
  SELECT
    unnest(skill_ids) as skill_id,
    tokens_saved_estimate,
    cost_usd,
    cost_saved_usd
  FROM skill_usage_logs
  WHERE created_at > NOW() - INTERVAL '7 days'
) t
GROUP BY skill_id
ORDER BY savings_percent DESC;
```

**Actions:**

1. Review skills with <30% savings
2. Optimize prompts
3. Consider skill redesign
4. Deprecate ineffective skills

### 5.4 Cost Projection

**Monthly Projection:**

```typescript
const projection = await costDashboard.getDetailedCostProjection(30);

console.log('Current Monthly Estimate:', projection.projection.currentCost);
console.log('Projected without Skills:', projection.projection.projectedCostWithoutSkills);
console.log('Monthly Savings:', projection.projection.estimatedSavings);
console.log('Savings Percentage:', projection.projection.savingsPercentage);
console.log('Confidence:', (projection.confidence * 100).toFixed(0) + '%');
console.log('Trend:', projection.trend);

console.log('\nRecommendations:');
projection.recommendations.forEach((rec, i) => {
  console.log(`${i + 1}. ${rec}`);
});
```

### 5.5 Cost Alerts

**Configure Cost Alerts:**

```yaml
# Alert when hourly cost >$10
- type: cost_spike
  threshold: 10
  period: hourly
  channels: [slack, email]

# Alert when daily savings <35%
- type: target_miss
  threshold: 35
  period: daily
  channels: [slack]

# Alert when monthly projection >$3000
- type: budget_exceeded
  threshold: 3000
  period: monthly
  channels: [pagerduty, slack, email]
```

### 5.6 Hands-On Exercise (20 minutes)

**Exercise 1:** Run cost validation

```typescript
// Validate last 7 days
const validation = await costDashboard.validateCostSavings(35, 7);

// Questions:
// 1. Is the 35% target met?
// 2. Which model contributes most to savings?
// 3. What actions would you take if below target?
```

**Exercise 2:** Analyze skill effectiveness

```sql
-- Run the skill effectiveness query
-- Identify top 3 and bottom 3 skills
-- Propose optimization for bottom skill
```

**Exercise 3:** Project future costs

```typescript
// Get 30-day projection
const projection = await costDashboard.getDetailedCostProjection(30);

// Questions:
// 1. What is the monthly cost estimate?
// 2. How much are we saving?
// 3. Is the trend increasing or decreasing?
```

---

## 6. Resources and References

### Documentation

**Stories:**

- [Story 2.11: Claude Skills Infrastructure](../stories/2.11.story.md)
- [Story 2.12: Core Legal Skills Development](../stories/2.12.story.md)
- [Story 2.13: Skills Integration with Model Routing](../stories/2.13.story.md)
- [Story 2.14: Skills Production Deployment](../stories/2.14.story.md)

**Runbooks:**

- [Skills Deployment](../runbooks/skills-deployment.md)
- [Rollback Procedures](../runbooks/skills-rollback.md)
- [Incident Response](../runbooks/incident-response.md)
- [Performance Tuning](../runbooks/performance-tuning.md)
- [Cost Optimization](../runbooks/cost-optimization.md)

**Architecture:**

- [Tech Stack](../architecture/tech-stack.md)
- [Coding Standards](../architecture/coding-standards.md)
- [Deployment Architecture](../architecture/deployment-architecture.md)
- [Monitoring and Observability](../architecture/monitoring-and-observability.md)

### External Resources

**Anthropic Documentation:**

- [Claude Skills API Beta](https://docs.anthropic.com/claude/docs/skills)
- [Prompt Caching](https://docs.anthropic.com/claude/docs/prompt-caching)
- [Claude API Reference](https://docs.anthropic.com/claude/reference)

**Monitoring:**

- [New Relic APM Documentation](https://docs.newrelic.com/docs/apm/)
- [New Relic Custom Metrics](https://docs.newrelic.com/docs/data-apis/custom-data/custom-events/collect-custom-attributes/)
- [Sentry Error Tracking](https://docs.sentry.io/)

**Infrastructure:**

- [Render Deployment](https://render.com/docs)
- [PostgreSQL 16 Documentation](https://www.postgresql.org/docs/16/)
- [Redis Documentation](https://redis.io/documentation)

### Support Channels

**Internal:**

- Slack: #skills-support
- On-Call: PagerDuty rotation
- Office Hours: Tuesdays 2-3 PM

**External:**

- Anthropic Support: support@anthropic.com
- Render Support: support@render.com
- New Relic Support: Via dashboard

### Training Assessment

**Knowledge Check:**

1. What are the 4 core legal skills from Story 2.12?
2. What is the target cost savings percentage (AC#5)?
3. What is the routing overhead target from Story 2.13?
4. Name 3 critical alert thresholds
5. What are the 4 rollback methods and their recovery times?
6. What database tables are used for skills?
7. What is the p95 response time target (AC#4)?
8. What cache hit rate should we target?
9. Name the 5 main monitoring components from Story 2.14
10. How do you trigger a rollback via feature flag?

**Answers:**

1. Contract Analysis, Document Drafting, Legal Research, Compliance Check
2. > 35% cost savings
3. <100ms routing overhead
4. Error rate >5%, response time >10s, cost spike >150%
5. Feature flag (2min), Render rollback (5min), Deactivate skill (10min), Circuit breaker (15min)
6. `skills`, `skill_versions`, `skill_usage_logs`
7. <5s at p95
8. > 40% (minimum 30%)
9. AlertsManager, SkillsMetricsCollector, CostDashboard, HealthChecker, (CostTracker)
10. `await rolloutManager.setRolloutPercentage(0);`

---

**Training Complete!**

You're now ready to support Skills in production. Remember:

- Monitor dashboards daily
- Respond to alerts within SLA
- Run cost validation weekly
- Review runbooks before incidents
- Ask questions in #skills-support

**Next Steps:**

1. Shadow on-call engineer
2. Practice incident response drills
3. Review recent production incidents
4. Set up your New Relic access
5. Test PagerDuty alerts

---

_Last Updated: 2025-11-19_
_Version: 1.0_
