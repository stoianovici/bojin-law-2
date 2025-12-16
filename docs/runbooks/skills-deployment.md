# Skills Deployment Runbook

**Story**: 2.14 - Skills Production Deployment and Monitoring
**Version**: 1.0
**Last Updated**: 2025-11-19
**Owner**: Platform Operations Team

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Deployment Process](#deployment-process)
3. [Validation Steps](#validation-steps)
4. [Troubleshooting](#troubleshooting)
5. [FAQ](#faq)

---

## Prerequisites

### Infrastructure Requirements

- ✅ Story 2.11 infrastructure deployed (SkillsAPIClient, SkillsManager, SkillsRegistry)
- ✅ Story 2.12 skills tested and validated
- ✅ Story 2.13 routing configured (SkillSelector, fallback logic)
- ✅ Database schema migrated (`001_add_skills_tables.sql`)
- ✅ Redis cache configured and operational
- ✅ Environment variables configured (see below)

### Required Environment Variables

```bash
# Anthropic API Configuration
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_SKILLS_ENABLED=true
ANTHROPIC_SKILLS_BETA_VERSION=skills-2025-10-02
ANTHROPIC_CODE_EXECUTION_BETA_VERSION=code-execution-2025-08-25

# Skills Configuration
SKILLS_CACHE_TTL=3600  # 1 hour
SKILLS_MAX_CACHE_SIZE=100
SKILLS_UPLOAD_TIMEOUT=30000  # 30 seconds

# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Monitoring
NEW_RELIC_LICENSE_KEY=...
NEW_RELIC_APP_NAME=legal-platform-ai-service
```

Validate configuration:

```bash
cd services/ai-service
./scripts/validate-skills-env.sh
```

---

## Deployment Process

### Step 1: Pre-Deployment Validation

**Run validation checks:**

```bash
# 1. Check environment configuration
npm run validate:env

# 2. Run all tests
cd services/ai-service
npm run test

# 3. Verify database connectivity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM skills;"

# 4. Verify Redis connectivity
redis-cli -u $REDIS_URL PING

# 5. Run type checking
npm run type-check
```

**Expected Results:**

- ✅ All tests passing
- ✅ Database connection successful
- ✅ Redis responds with `PONG`
- ✅ No TypeScript errors

---

### Step 2: Skill Upload

**Upload skill to production:**

```typescript
import { SkillsAPIClient } from './src/skills/SkillsAPIClient';
import { SkillsManager } from './src/skills/SkillsManager';

// Initialize clients
const apiClient = new SkillsAPIClient({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  betaVersion: 'skills-2025-10-02',
});

const skillsManager = new SkillsManager(apiClient, {
  cacheTTL: 3600,
  maxCacheSize: 100,
});

// Upload skill
const skillPayload = {
  display_name: 'Contract Analysis - Romanian',
  description: 'Analyzes Romanian legal contracts for key terms and obligations',
  type: 'code' as const,
  category: 'analysis' as const,
  content: skillContent, // Read from skills/contract-analysis/SKILL.md
  version: '1.0.0',
  config: {
    max_tokens: 8000,
    temperature: 0.3,
  },
};

try {
  const metadata = await skillsManager.uploadSkill(skillPayload);
  console.log('✅ Skill uploaded:', metadata.skill_id);
} catch (error) {
  console.error('❌ Upload failed:', error);
  // See troubleshooting section
}
```

---

### Step 3: Registry Configuration

**Update SkillsRegistry pattern matching:**

```typescript
// File: services/ai-service/src/skills/SkillsRegistry.ts
// Add new skill pattern

const skillPatterns = [
  {
    skillId: metadata.skill_id,
    patterns: [/contract.*analy[sz]is/i, /analiz[ăa].*contract/i, /review.*agreement/i],
    category: 'legal_analysis',
    priority: 1,
    minConfidence: 0.7,
  },
  // ... existing patterns
];
```

**Deploy updated registry:**

```bash
# Build and deploy
npm run build
git add services/ai-service/src/skills/SkillsRegistry.ts
git commit -m "feat: add Contract Analysis skill pattern"
git push origin main

# Render auto-deploys on push to main
```

---

### Step 4: Feature Flag Rollout

**Enable skill for subset of users:**

```typescript
// File: services/ai-service/src/feature-flags/RolloutManager.ts

const rolloutManager = new RolloutManager();

// Stage 1: 5% rollout
await rolloutManager.setRolloutPercentage(5);
console.log('✅ Skill enabled for 5% of users');

// Monitor for 72 hours before proceeding
// See monitoring runbook for metrics to track
```

---

### Step 5: Monitoring Setup

**Configure monitoring for new skill:**

```typescript
// File: services/ai-service/src/monitoring/SkillsMetricsCollector.ts

// Add custom metrics
newrelic.recordMetric(`Custom/Skills/${skillId}/ExecutionTime`, executionTime);
newrelic.recordMetric(`Custom/Skills/${skillId}/TokenSavings`, tokenSavings);
newrelic.recordMetric(`Custom/Skills/${skillId}/SuccessRate`, success ? 1 : 0);
```

**Set up alerts:**

See `skills-monitoring-alerts.md` for alert configuration

---

### Step 6: Validation Post-Deployment

**Verify skill is working:**

```bash
# 1. Check skill is listed
curl -H "x-api-key: $ANTHROPIC_API_KEY" \
     -H "anthropic-beta: skills-2025-10-02" \
     https://api.anthropic.com/v1/skills | jq '.skills[] | select(.display_name=="Contract Analysis - Romanian")'

# 2. Test skill execution
npm run test -- tests/integration/skills.test.ts --testNamePattern="Contract Analysis"

# 3. Check New Relic metrics
# Navigate to: Dashboards > Skills Overview
# Verify: skill_id appears in execution logs

# 4. Verify cache warming
redis-cli -u $REDIS_URL KEYS "skill:cache:*" | grep $SKILL_ID
```

**Expected Results:**

- ✅ Skill appears in API listing
- ✅ Integration tests pass
- ✅ Metrics appearing in New Relic
- ✅ Skill cached in Redis

---

## Validation Steps

### Health Check Validation

```bash
curl https://legal-platform-ai-service.onrender.com/health | jq
```

**Expected response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-11-19T10:00:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "claude_api": "healthy",
    "skills_api": "healthy"
  },
  "skills_metrics": {
    "active_skills_count": 4,
    "cache_hit_rate": 0.42,
    "avg_response_time_ms": 3200,
    "error_rate_percent": 0.8
  }
}
```

### Performance Validation

```bash
# Run load test against staging
npm run test:load:staging

# Expected results (from AC#4, AC#6):
# - P95 response time: <5000ms
# - Error rate: <2%
# - Success rate: >98%
```

### Cost Validation

```typescript
// Check cost savings (AC#5: >35%)
const costTracker = new CostTracker();
const report = await costTracker.generateReport(
  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
  new Date()
);

console.log(`Savings: ${report.savingsPercent}%`);
// Expected: >35%
```

---

## Troubleshooting

### Issue: Skill Upload Fails with 400 Bad Request

**Symptoms:**

```
SkillUploadError: Failed to upload skill: Validation failed
```

**Diagnosis:**

1. Check skill content validation
2. Verify dangerous patterns not present
3. Confirm content size <1MB

**Resolution:**

```bash
# Run validation locally
node -e "
const { SkillsManager } = require('./dist/skills/SkillsManager');
const manager = new SkillsManager(apiClient);
try {
  manager.validateSkill(payload);
  console.log('✅ Validation passed');
} catch (error) {
  console.error('❌ Validation errors:', error.validationErrors);
}
"
```

---

### Issue: Skill Not Appearing in Registry Recommendations

**Symptoms:**

- Skill uploaded successfully
- Not being recommended for relevant queries

**Diagnosis:**

1. Check pattern matching configuration
2. Verify skill category and type
3. Check effectiveness score

**Resolution:**

```typescript
// Test pattern matching
const registry = new SkillsRegistry(db);
const recommendations = await registry.recommendSkills('I need to analyze this contract', {
  type: 'code',
  category: 'analysis',
});

console.log('Recommendations:', recommendations);
// Verify your skill appears in results
```

---

### Issue: High Cache Miss Rate

**Symptoms:**

- Cache hit rate <30%
- Increased API costs
- Slower response times

**Diagnosis:**

```bash
# Check Redis memory usage
redis-cli -u $REDIS_URL INFO memory | grep used_memory_human

# Check cache key patterns
redis-cli -u $REDIS_URL KEYS "skill:cache:*" | wc -l

# Check TTL settings
redis-cli -u $REDIS_URL TTL "skill:cache:$SKILL_ID"
```

**Resolution:**

1. Increase cache TTL if appropriate
2. Warm cache for frequently used skills
3. Increase Redis memory allocation

```typescript
// Warm cache for critical skills
const criticalSkills = ['skill-id-1', 'skill-id-2', 'skill-id-3'];
for (const skillId of criticalSkills) {
  await skillsManager.getSkill(skillId, (useCache = true));
}
```

---

### Issue: Skill Execution Timeout

**Symptoms:**

```
SkillAPIError: Request timeout after 30000ms
```

**Diagnosis:**

1. Check skill complexity
2. Verify Claude API status
3. Review skill configuration

**Resolution:**

```typescript
// Option 1: Increase timeout
const apiClient = new SkillsAPIClient({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 60000, // Increase to 60s
});

// Option 2: Reduce skill complexity
// Review skill content and optimize prompts
// Reduce max_tokens if possible

// Option 3: Implement circuit breaker
// See incident-response.md for details
```

---

### Issue: Cost Savings Below Target (<35%)

**Symptoms:**

- Cost savings consistently <35%
- Model distribution skewed to expensive models

**Diagnosis:**

```typescript
const costTracker = new CostTracker();
const report = await costTracker.generateReport(startDate, endDate);

console.log('Model breakdown:', report.modelBreakdown);
// Expected: High Haiku usage, moderate Sonnet, low Opus
```

**Resolution:**

1. Review skill effectiveness scores
2. Optimize skill selection logic
3. Tune routing thresholds

See `cost-optimization.md` for detailed guidance

---

## FAQ

### Q: How long does it take to deploy a new skill?

**A:** Full deployment process takes 3-7 days:

- Day 0: Upload and validate skill
- Days 1-3: 5% canary deployment with monitoring
- Days 3-10: 25% beta deployment with monitoring
- Day 10+: Full 100% deployment

### Q: Can I roll back a skill deployment?

**A:** Yes, use feature flags for instant rollback:

```typescript
const rolloutManager = new RolloutManager();
await rolloutManager.setRolloutPercentage(0); // Disable immediately
```

See `skills-rollback.md` for complete procedures.

### Q: How many skills can be deployed simultaneously?

**A:** Technical limit is 100 cached skills (configurable). Recommended:

- Start with 4-6 core skills
- Add 2-3 skills per month
- Monitor performance impact

### Q: What happens if Anthropic Skills API is down?

**A:** Automatic fallback to non-skills routing:

- Circuit breaker triggers after 3 consecutive failures
- Requests routed to standard Claude API
- No user-facing errors
- Alerts sent to on-call team

See `incident-response.md` for details.

### Q: How do I test a skill before production?

**A:** Use staging environment:

```bash
# 1. Deploy to staging
npm run deploy:staging

# 2. Run integration tests
npm run test:integration

# 3. Run load tests
npm run test:load:staging

# 4. Validate manually via staging UI
# Navigate to: https://staging.legal-platform.onrender.com
```

### Q: Can skills access user data or environment variables?

**A:** No. Skills execute in Anthropic's isolated infrastructure:

- No access to local file system
- No access to environment variables
- No network access outside Anthropic's environment
- API-mediated communication only

See `skills-security-audit.md` for security details.

### Q: How do I monitor skill performance?

**A:** Multiple monitoring layers:

1. **New Relic Dashboard**: Real-time metrics
2. **Cost Tracker**: Daily cost reports
3. **Skills Registry**: Effectiveness scores
4. **Health Endpoint**: `/health` with skills metrics

See `skills-monitoring.md` for complete guide.

### Q: What's the process for emergency skill disable?

**A:**

```typescript
// Option 1: Feature flag (instant)
await rolloutManager.setRolloutPercentage(0);

// Option 2: Remove from registry (requires deploy)
// Comment out skill pattern in SkillsRegistry.ts

// Option 3: Circuit breaker (automatic)
// Triggers automatically on repeated failures
```

Priority: Option 1 for immediate disable.

---

## Related Documents

- [Skills Rollback Procedures](./skills-rollback.md)
- [Incident Response Guide](./incident-response.md)
- [Performance Tuning Guide](./performance-tuning.md)
- [Cost Optimization Guide](./cost-optimization.md)
- [Security Audit Report](../security/skills-security-audit.md)
- [Monitoring Setup Guide](./skills-monitoring.md)

---

## Change Log

| Date       | Version | Changes                  | Author            |
| ---------- | ------- | ------------------------ | ----------------- |
| 2025-11-19 | 1.0     | Initial runbook creation | James (Dev Agent) |

---

## Contact & Support

**On-Call Engineer**: See PagerDuty rotation
**Slack Channel**: #skills-deployment
**Incident Reporting**: File in PagerDuty or Slack #incidents
**Documentation Updates**: Create PR against docs/runbooks/
