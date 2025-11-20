# Skills Performance Tuning Guide

**Story**: 2.14 - Skills Production Deployment and Monitoring
**Version**: 1.0
**Last Updated**: 2025-11-19
**Owner**: Platform Operations Team

---

## Performance Targets (AC#4, AC#6)

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| P95 Response Time | <5s | >7s |
| P99 Response Time | <10s | >15s |
| Error Rate | <2% | >5% |
| Timeout Rate | <1% | >2% |
| Cache Hit Rate | >40% | <30% |
| Routing Overhead | <100ms | >200ms |

---

## Performance Optimization Checklist

### Execution Performance
- [ ] Skills cache hit rate >40%
- [ ] Routing overhead <100ms (from Story 2.13)
- [ ] Skill execution <5s (AC#4)
- [ ] Error rate <2% (AC#6)
- [ ] Cost savings >35% (AC#5)

---

## Optimization Strategies

### 1. Cache Optimization

**Problem**: Low cache hit rate (<30%)

**Diagnosis**:
```bash
# Check cache metrics
redis-cli -u $REDIS_URL INFO stats | grep -E "keyspace_hits|keyspace_misses"

# Calculate hit rate
hits=$(redis-cli -u $REDIS_URL INFO stats | grep keyspace_hits | cut -d':' -f2)
misses=$(redis-cli -u $REDIS_URL INFO stats | grep keyspace_misses | cut -d':' -f2)
rate=$(echo "scale=2; $hits / ($hits + $misses) * 100" | bc)
echo "Cache hit rate: $rate%"
```

**Optimizations**:

```typescript
// Option 1: Increase cache TTL
const skillsManager = new SkillsManager(apiClient, {
  cacheTTL: 7200,  // Increase from 3600 (2 hours)
  maxCacheSize: 200,  // Increase from 100
});

// Option 2: Proactive cache warming
async function warmCache() {
  const popularSkills = await getPopularSkills(limit=20);
  for (const skillId of popularSkills) {
    await skillsManager.getSkill(skillId, useCache=true);
  }
}

// Run on startup and every hour
warmCache();
setInterval(warmCache, 60 * 60 * 1000);

// Option 3: Implement cache prefetching
async function prefetchSkillsForPattern(pattern: string) {
  const recommendations = await skillsRegistry.recommendSkills(pattern);
  for (const rec of recommendations.slice(0, 3)) {
    await skillsManager.getSkill(rec.skillId, useCache=true);
  }
}
```

**Expected Impact**:
- Cache hit rate: 30% → 50%
- Average response time: -20%
- Cost reduction: +5%

---

### 2. Routing Performance

**Problem**: High routing overhead (>100ms)

**Diagnosis**:
```typescript
const profiler = new PerformanceProfiler();

profiler.start('skill-selection');
const recommendations = await skillSelector.selectSkill(request);
const routingTime = profiler.end('skill-selection');

console.log(`Routing time: ${routingTime}ms`);
// Target: <100ms (from Story 2.13)
```

**Optimizations**:

```typescript
// Option 1: Optimize pattern matching
// File: services/ai-service/src/skills/SkillsRegistry.ts

// Before: Sequential pattern matching
patterns.forEach(pattern => {
  if (pattern.test(query)) matches.push(skillId);
});

// After: Early exit on match
for (const pattern of patterns) {
  if (pattern.test(query)) {
    matches.push(skillId);
    break;  // Stop on first match if priority-based
  }
}

// Option 2: Cache skill recommendations
const recommendationCache = new Map<string, SkillRecommendation[]>();

async function getCachedRecommendations(query: string) {
  const cacheKey = hash(query);  // Simple hash function
  if (recommendationCache.has(cacheKey)) {
    return recommendationCache.get(cacheKey);
  }

  const recommendations = await skillsRegistry.recommendSkills(query);
  recommendationCache.set(cacheKey, recommendations);
  return recommendations;
}

// Option 3: Simplify scoring algorithm
// Reduce relevance calculations, use simpler scoring
```

**Expected Impact**:
- Routing time: 150ms → 50ms
- Overall latency: -100ms
- Throughput: +15%

---

### 3. Skill Execution Performance

**Problem**: Slow skill execution (>5s p95)

**Diagnosis**:
```typescript
const slowSkills = await db.query(`
  SELECT
    skill_id,
    AVG(execution_time_ms) as avg_time,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95,
    COUNT(*) as executions
  FROM skill_usage_logs
  WHERE timestamp > NOW() - INTERVAL '24 hours'
  GROUP BY skill_id
  HAVING PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) > 5000
  ORDER BY p95 DESC
`);
```

**Optimizations**:

```typescript
// Option 1: Reduce max_tokens
await skillsManager.updateSkill(skillId, {
  config: {
    max_tokens: 4000,  // Reduce from 8000
    temperature: 0.3,
  }
});

// Option 2: Optimize skill prompts
// - Remove unnecessary context
// - Use more specific instructions
// - Reduce example count

// Option 3: Implement timeout circuit breaker
class SkillExecutor {
  private timeouts = new Map<string, number>();

  async executeWithCircuitBreaker(skillId: string, params: any) {
    // Track timeouts per skill
    if (this.timeouts.get(skillId) > 3) {
      console.warn(`Circuit open for skill ${skillId}, using fallback`);
      return this.executeFallback(params);
    }

    try {
      const result = await this.executeSkill(skillId, params, timeout=30000);
      this.timeouts.set(skillId, 0);  // Reset on success
      return result;
    } catch (error) {
      if (error.name === 'TimeoutError') {
        this.timeouts.set(skillId, (this.timeouts.get(skillId) || 0) + 1);
      }
      throw error;
    }
  }
}
```

**Expected Impact**:
- P95 execution time: 6s → 4s
- Timeout rate: 3% → 0.5%
- User satisfaction: +10%

---

### 4. Database Query Optimization

**Problem**: Slow queries for skill metadata

**Diagnosis**:
```sql
-- Enable query timing
\timing

-- Check slow queries
EXPLAIN ANALYZE
SELECT * FROM skills
WHERE category = 'analysis'
AND effectiveness_score > 0.7
ORDER BY effectiveness_score DESC;
```

**Optimizations**:

```sql
-- Option 1: Add composite index
CREATE INDEX idx_skills_category_effectiveness
ON skills(category, effectiveness_score DESC)
WHERE effectiveness_score > 0.7;

-- Option 2: Materialized view for frequently accessed data
CREATE MATERIALIZED VIEW skills_popular AS
SELECT
  skill_id,
  display_name,
  category,
  effectiveness_score,
  usage_count
FROM skills
WHERE effectiveness_score > 0.7
ORDER BY usage_count DESC;

-- Refresh periodically
REFRESH MATERIALIZED VIEW skills_popular;

-- Option 3: Query result caching
-- Cache skill metadata in Redis
await redis.setex(
  `skill:meta:${skillId}`,
  3600,
  JSON.stringify(skillMetadata)
);
```

**Expected Impact**:
- Query time: 500ms → 50ms
- Database CPU: -30%
- Overall latency: -200ms

---

### 5. Network & Infrastructure

**Problem**: High latency to Anthropic API

**Diagnosis**:
```bash
# Measure API latency
time curl -H "x-api-key: $ANTHROPIC_API_KEY" \
  https://api.anthropic.com/v1/skills

# Check from different regions
# US West: ~50ms
# US East: ~100ms
# Europe: ~150ms
```

**Optimizations**:

```typescript
// Option 1: Connection pooling
import { Agent } from 'https';

const agent = new Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 30000,
});

const apiClient = new SkillsAPIClient({
  apiKey: process.env.ANTHROPIC_API_KEY,
  httpAgent: agent,
});

// Option 2: Request multiplexing (HTTP/2)
// Enabled by default in modern Node.js

// Option 3: Parallel requests where appropriate
const [skill1, skill2, skill3] = await Promise.all([
  skillsManager.getSkill('skill-1'),
  skillsManager.getSkill('skill-2'),
  skillsManager.getSkill('skill-3'),
]);
```

**Expected Impact**:
- API latency: -20ms avg
- Connection overhead: -50ms
- Throughput: +25%

---

## Performance Monitoring

### Key Metrics to Track

```typescript
// 1. Execution time by skill
newrelic.recordMetric('Custom/Skills/ExecutionTime', executionTime);

// 2. Cache performance
newrelic.recordMetric('Custom/Cache/HitRate', cacheHitRate);
newrelic.recordMetric('Custom/Cache/Size', cacheSize);

// 3. Routing overhead
newrelic.recordMetric('Custom/Routing/Overhead', routingTime);

// 4. Error rates
newrelic.recordMetric('Custom/Skills/ErrorRate', errorRate);

// 5. Cost metrics
newrelic.recordMetric('Custom/Cost/TotalDaily', dailyCost);
newrelic.recordMetric('Custom/Cost/SavingsPercent', savingsPercent);
```

### Dashboard Setup

**New Relic Dashboard Query Examples**:

```sql
-- Average execution time by skill
SELECT average(duration)
FROM Transaction
WHERE name LIKE '%skills%'
FACET skillId
SINCE 1 hour ago

-- Cache hit rate over time
SELECT rate(sum(cacheHits), 1 minute) /
       rate(sum(cacheHits + cacheMisses), 1 minute) * 100
FROM Metric
TIMESERIES

-- Error rate by skill
SELECT percentage(count(*), WHERE error IS true)
FROM SkillExecution
FACET skillId
SINCE 1 hour ago
```

---

## Load Testing

Run regular load tests to validate performance:

```bash
# Run load test
npm run test:load

# Expected results (AC#4, AC#6):
# ✓ P95 response time: <5000ms
# ✓ P99 response time: <10000ms
# ✓ Error rate: <2%
# ✓ Success rate: >98%
```

---

## Performance Budget Validation

```typescript
import { validatePerformanceBudget } from './config/performance-budget';

const metrics = {
  executionTime: 4500,
  routingTime: 90,
  errorRate: 0.015,
  timeoutRate: 0.008,
  fallbackRate: 0.03,
  costPerRequest: 0.018,
  savingsPercent: 38,
};

const result = validatePerformanceBudget(metrics);

if (!result.passed) {
  console.error('Performance budget violations:');
  result.violations.forEach(v => console.error(`- ${v}`));
}
```

---

## Troubleshooting Performance Issues

### High Memory Usage

```bash
# Check Node.js heap usage
node -e "console.log(process.memoryUsage())"

# Profile memory
node --inspect services/ai-service/dist/index.js

# Chrome DevTools: chrome://inspect
```

**Common fixes**:
- Clear cache periodically
- Limit cache size
- Fix memory leaks
- Increase heap size

### High CPU Usage

```bash
# Profile CPU
node --prof services/ai-service/dist/index.js

# Generate profile
node --prof-process isolate-*.log > profile.txt
```

**Common fixes**:
- Optimize regex patterns
- Reduce synchronous operations
- Implement worker threads
- Scale horizontally

---

## Related Documents

- [Skills Deployment Runbook](./skills-deployment.md)
- [Cost Optimization Guide](./cost-optimization.md)
- [Incident Response Guide](./incident-response.md)

---

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-11-19 | 1.0 | Initial guide creation | James (Dev Agent) |
