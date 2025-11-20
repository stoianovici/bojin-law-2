# Skills Infrastructure Incident Response Guide

**Story**: 2.14 - Skills Production Deployment and Monitoring
**Version**: 1.0
**Last Updated**: 2025-11-19
**Owner**: Platform Operations Team
**Criticality**: CRITICAL

---

## Overview

This guide provides structured procedures for responding to skills infrastructure incidents. Follow these procedures for consistent, efficient incident resolution.

**SLA Targets**:
- SEV1: 15min acknowledgment, 1 hour resolution
- SEV2: 30min acknowledgment, 4 hour resolution
- SEV3: 2 hour acknowledgment, 24 hour resolution

---

## Incident Severity Levels

| Level | Definition | Examples | Response Time | Escalation |
|-------|------------|----------|---------------|------------|
| SEV1 | Complete service outage | Skills API down, All requests failing | 15 minutes | Immediate page |
| SEV2 | Significant degradation | Error rate >10%, Response time >10s | 30 minutes | Page during business hours |
| SEV3 | Minor degradation | Error rate 5-10%, Cache issues | 2 hours | Slack notification |
| SEV4 | Low impact | Individual skill errors, Warnings | Next business day | Ticket only |

---

## Common Incidents

### SEV1: Complete Skills Outage

**Symptoms**:
- All skill-enhanced requests failing
- Health check failures
- Claude Skills API unreachable

**Diagnosis**:

```bash
# 1. Check health endpoint
curl https://legal-platform-ai-service.onrender.com/health | jq

# 2. Check Anthropic API status
curl -H "x-api-key: $ANTHROPIC_API_KEY" \
     https://api.anthropic.com/v1/skills | jq

# 3. Check service logs
render logs legal-platform-ai-service --tail | grep ERROR

# 4. Check New Relic APM
# Navigate to: APM > legal-platform-ai-service > Error analytics
```

**Common Causes**:
1. Anthropic API outage
2. Network connectivity issues
3. Invalid API credentials
4. Service deployment failure

**Mitigation Steps**:

```typescript
// 1. Enable circuit breaker (automatic fallback)
const circuitBreaker = new CircuitBreaker();
await circuitBreaker.open();  // Opens circuit, routes to fallback

// 2. Disable skills via feature flag
const rolloutManager = new RolloutManager();
await rolloutManager.setRolloutPercentage(0);

// 3. Verify fallback routing working
curl https://legal-platform-web.onrender.com/api/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{"type":"contract_analysis","content":"Test contract"}' | jq

// Should succeed without skills
```

**Recovery Steps**:

1. Verify Anthropic API status: https://status.anthropic.com
2. Test API connectivity manually
3. Gradually re-enable skills (1% → 5% → 25%)
4. Monitor for 1 hour before full rollout

**Prevention**:
- Implement health check monitoring with PagerDuty integration
- Add automatic circuit breaker
- Set up Anthropic status page monitoring

---

### SEV2: High Error Rate (>5%)

**Symptoms**:
- Error rate elevated but <50%
- Some requests succeeding
- Degraded user experience

**Diagnosis**:

```typescript
// 1. Check error distribution
const errorAnalysis = await db.query(`
  SELECT
    error_type,
    COUNT(*) as count,
    COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
  FROM skill_usage_logs
  WHERE timestamp > NOW() - INTERVAL '1 hour'
  AND success = false
  GROUP BY error_type
  ORDER BY count DESC
`);

// 2. Identify problematic skills
const problematicSkills = await db.query(`
  SELECT
    skill_id,
    COUNT(*) as error_count,
    AVG(execution_time_ms) as avg_time
  FROM skill_usage_logs
  WHERE timestamp > NOW() - INTERVAL '1 hour'
  AND success = false
  GROUP BY skill_id
  HAVING COUNT(*) > 10
  ORDER BY error_count DESC
`);

console.log('Problematic skills:', problematicSkills);
```

**Common Causes**:
1. Single skill failing repeatedly
2. Skill timeout issues
3. Invalid skill configuration
4. Rate limiting from Anthropic

**Mitigation Steps**:

```typescript
// Option 1: Disable specific skill
const skillsManager = new SkillsManager(apiClient);
await skillsManager.deleteSkill(problematicSkillId);

// Option 2: Reduce rollout percentage
const rolloutManager = new RolloutManager();
await rolloutManager.setRolloutPercentage(5);  // From higher percentage

// Option 3: Increase timeout
const apiClient = new SkillsAPIClient({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 60000,  // Increase from 30s to 60s
});
```

**Recovery Steps**:
1. Fix identified skill issues
2. Re-upload corrected skill
3. Test in staging
4. Gradually re-enable in production

---

### SEV2: Slow Response Times (p95 >7s)

**Symptoms**:
- Response times elevated
- User complaints about slowness
- Timeout warnings

**Diagnosis**:

```bash
# 1. Check New Relic transaction traces
# APM > Transactions > Slowest transactions

# 2. Profile skill execution times
node -e "
const db = require('./db');
const slowSkills = await db.query(\`
  SELECT
    skill_id,
    AVG(execution_time_ms) as avg_time,
    MAX(execution_time_ms) as max_time,
    COUNT(*) as executions
  FROM skill_usage_logs
  WHERE timestamp > NOW() - INTERVAL '1 hour'
  GROUP BY skill_id
  HAVING AVG(execution_time_ms) > 5000
  ORDER BY avg_time DESC
\`);
console.log(slowSkills);
"

# 3. Check cache hit rates
redis-cli -u $REDIS_URL INFO stats | grep keyspace_hits
```

**Common Causes**:
1. Low cache hit rate
2. Complex skill prompts
3. Anthropic API latency
4. Database query slowness

**Mitigation Steps**:

```typescript
// 1. Warm cache for frequently used skills
const popularSkills = await getPopularSkills();
for (const skillId of popularSkills) {
  await skillsManager.getSkill(skillId, useCache=true);
}

// 2. Optimize skill content
// Review skill prompts, reduce token counts
// Update skill configuration:
const updates = {
  config: {
    max_tokens: 4000,  // Reduce from 8000
    temperature: 0.3,
  }
};
await skillsManager.updateSkill(skillId, updates);

// 3. Scale up infrastructure
// Via Render dashboard: Increase to next tier
// Standard → Pro (4GB RAM, 2 CPU)
```

**Recovery Steps**:
1. Monitor response times after changes
2. Validate p95 <5s sustained for 1 hour
3. Document optimizations for future skills

---

### SEV3: Cache Performance Issues

**Symptoms**:
- Cache hit rate <30%
- Increased API costs
- Slower response times

**Diagnosis**:

```bash
# Check Redis stats
redis-cli -u $REDIS_URL INFO stats

# Key metrics:
# - keyspace_hits
# - keyspace_misses
# - used_memory
# - evicted_keys

# Check cache distribution
redis-cli -u $REDIS_URL --scan --pattern "skill:cache:*" | wc -l

# Check TTLs
redis-cli -u $REDIS_URL --scan --pattern "skill:cache:*" | \
  xargs -I{} redis-cli -u $REDIS_URL TTL {}
```

**Common Causes**:
1. TTL too short
2. Cache evictions (memory pressure)
3. Poor key distribution
4. Cache invalidation too aggressive

**Mitigation Steps**:

```typescript
// 1. Increase cache TTL
const skillsManager = new SkillsManager(apiClient, {
  cacheTTL: 7200,  // Increase from 3600 (1h to 2h)
  maxCacheSize: 200,  // Increase from 100
});

// 2. Increase Redis memory
// Via Render dashboard: Upgrade Redis plan
// Starter (256MB) → Standard (512MB)

// 3. Warm cache proactively
const criticalSkills = [
  'contract-analysis-ro',
  'document-drafting-ro',
  'legal-research-ro',
  'compliance-check-ro',
];

for (const skillId of criticalSkills) {
  await skillsManager.getSkill(skillId, useCache=true);
}
```

---

### SEV3: Cost Spike (>50% above baseline)

**Symptoms**:
- Daily costs significantly elevated
- Cost savings <35%
- Unusual token usage

**Diagnosis**:

```typescript
const costTracker = new CostTracker();

// 1. Analyze cost breakdown
const report = await costTracker.generateReport(
  new Date(Date.now() - 24 * 60 * 60 * 1000),  // Last 24h
  new Date()
);

console.log('Cost breakdown:', {
  total: report.actualCost,
  savings: report.savingsPercent,
  baseline: report.baselineCost,
  modelBreakdown: report.modelBreakdown,
});

// 2. Identify expensive skills
const expensiveSkills = await db.query(`
  SELECT
    skill_id,
    SUM(cost_usd) as total_cost,
    AVG(tokens_used) as avg_tokens,
    COUNT(*) as executions
  FROM skill_usage_logs
  WHERE timestamp > NOW() - INTERVAL '24 hours'
  GROUP BY skill_id
  ORDER BY total_cost DESC
  LIMIT 10
`);

console.log('Most expensive skills:', expensiveSkills);
```

**Common Causes**:
1. Skill misconfiguration (high max_tokens)
2. Unexpected usage spike
3. Inefficient skill prompts
4. Model routing issues

**Mitigation Steps**:

```typescript
// 1. Reduce max_tokens for expensive skills
await skillsManager.updateSkill(skillId, {
  config: {
    max_tokens: 4000,  // Reduce from higher value
    temperature: 0.3,
  }
});

// 2. Optimize skill selection
// Review SkillSelector thresholds
const skillSelector = new SkillSelector(registry);
skillSelector.setEffectivenessThreshold(0.8);  // Increase from 0.7

// 3. Set cost alerts
// Via New Relic: Alert when hourly cost >$10
```

**Recovery Steps**:
1. Identify root cause of cost spike
2. Implement cost optimizations
3. Monitor for 48 hours
4. Validate cost savings >35% sustained

---

## Incident Response Workflow

### Phase 1: Detection & Alert (0-5 minutes)

```bash
# Alert received via PagerDuty or Slack

# 1. Acknowledge incident
pagerduty acknowledge <incident-id>

# 2. Join incident channel
# Slack: #incident-[timestamp]

# 3. Initial assessment
curl https://legal-platform-ai-service.onrender.com/health | jq
```

### Phase 2: Triage & Diagnosis (5-15 minutes)

```bash
# 1. Determine severity
# Use severity matrix above

# 2. Check logs
render logs legal-platform-ai-service --tail

# 3. Check New Relic
# Dashboard > Skills Overview

# 4. Check Anthropic API status
curl https://status.anthropic.com/api/v2/status.json | jq

# 5. Identify root cause
# Review recent deployments, config changes, traffic patterns
```

### Phase 3: Mitigation (15-30 minutes)

```bash
# Based on incident type, execute appropriate mitigation:

# SEV1: Immediate rollback
# See skills-rollback.md

# SEV2: Partial rollback or fix
# Disable problematic skill or reduce rollout

# SEV3: Monitor and plan fix
# No immediate action unless escalating
```

### Phase 4: Resolution (30-60 minutes)

```bash
# 1. Verify mitigation successful
# Check metrics returned to normal

# 2. Implement permanent fix
# Deploy code changes or configuration updates

# 3. Test fix
# Run integration tests, load tests

# 4. Gradual rollout
# Re-enable skills gradually with monitoring
```

### Phase 5: Post-Incident (1-48 hours)

```bash
# 1. Write incident report (within 4 hours)
# Use template in docs/templates/incident-report.md

# 2. Schedule post-mortem (within 48 hours)
# Invite: Engineering, DevOps, Product, QA

# 3. Implement prevention measures
# Add monitoring, update runbooks, fix root cause

# 4. Communicate to stakeholders
# Email summary to leadership and affected teams
```

---

## Communication Templates

### SEV1 Incident Notification

```
@channel SEV1 INCIDENT: Skills service outage

Status: INVESTIGATING
Impact: All AI features unavailable
Started: [TIME] UTC
ETA: Under investigation

Incident Commander: [NAME]
War room: #incident-[ID]

Updates: Every 15 minutes
```

### Resolution Notification

```
@channel RESOLVED: Skills service restored

Duration: [X] minutes
Root cause: [BRIEF SUMMARY]
Impact: [X] users affected

Post-mortem: [DATE/TIME]
Incident report: [LINK]

Thank you for your patience.
```

---

## Escalation Matrix

| Time Since Alert | Contact | Method |
|------------------|---------|--------|
| 0-15 min | Primary On-Call | PagerDuty auto-page |
| 15-30 min | Secondary On-Call | Manual page |
| 30-60 min | Engineering Manager | Phone call |
| 60+ min or SEV1 | CTO | Phone call + Email |

---

## Tools & Access

### Required Access

- Render Dashboard: https://dashboard.render.com
- New Relic: https://one.newrelic.com
- PagerDuty: https://[org].pagerduty.com
- GitHub: https://github.com/[org]/[repo]
- Slack: #incidents, #skills-deployment

### Useful Commands

```bash
# Health check
curl https://legal-platform-ai-service.onrender.com/health | jq

# Logs (last 100 lines)
render logs legal-platform-ai-service --tail

# Deploy status
render services get legal-platform-ai-service

# Rollback
# See skills-rollback.md

# Cost check
node scripts/monitoring/daily-cost-report.js
```

---

## Related Documents

- [Skills Rollback Procedures](./skills-rollback.md)
- [Skills Deployment Runbook](./skills-deployment.md)
- [Performance Tuning Guide](./performance-tuning.md)
- [Cost Optimization Guide](./cost-optimization.md)

---

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-11-19 | 1.0 | Initial runbook creation | James (Dev Agent) |
