# Skills Rollback Procedures

**Story**: 2.14 - Skills Production Deployment and Monitoring
**Version**: 1.0
**Last Updated**: 2025-11-19
**Owner**: Platform Operations Team
**Criticality**: HIGH - Production Safety

---

## Overview

This runbook provides step-by-step procedures for rolling back skills deployments when issues are detected. Rollback procedures are designed to minimize downtime and user impact.

**Recovery Time Objective (RTO)**: 5 minutes
**Recovery Point Objective (RPO)**: Current state (no data loss)

---

## Table of Contents

1. [Automatic Rollback Triggers](#automatic-rollback-triggers)
2. [Manual Rollback Procedures](#manual-rollback-procedures)
3. [Rollback Verification](#rollback-verification)
4. [Post-Rollback Actions](#post-rollback-actions)
5. [Emergency Contacts](#emergency-contacts)

---

## Automatic Rollback Triggers

The system automatically triggers rollbacks when these conditions are met:

| Trigger | Threshold | Action | Notification |
|---------|-----------|--------|--------------|
| Health check failures | 3 consecutive | Automatic rollback | PagerDuty SEV1 |
| Error rate spike | >10% for 5 minutes | Automatic rollback | PagerDuty SEV1 |
| Response time | p95 >10s for 5 minutes | Automatic rollback | Slack warning |
| Memory usage | >95% | Automatic rollback | PagerDuty SEV2 |
| Database connection | Failures for 2 minutes | Automatic rollback | PagerDuty SEV1 |

### Automatic Rollback Implementation

```typescript
// File: services/ai-service/src/monitoring/HealthChecker.ts

class HealthChecker {
  private consecutiveFailures = 0;
  private readonly maxFailures = 3;

  async checkHealth(): Promise<HealthStatus> {
    const health = await this.performHealthCheck();

    if (!health.healthy) {
      this.consecutiveFailures++;

      if (this.consecutiveFailures >= this.maxFailures) {
        await this.triggerAutomaticRollback();
      }
    } else {
      this.consecutiveFailures = 0;
    }

    return health;
  }

  private async triggerAutomaticRollback(): Promise<void> {
    console.error('[AUTO-ROLLBACK] Triggering automatic rollback');

    // Disable skills via feature flag
    const rolloutManager = new RolloutManager();
    await rolloutManager.setRolloutPercentage(0);

    // Send alerts
    await this.sendPagerDutyAlert('SEV1', 'Automatic rollback triggered');
    await this.sendSlackAlert('#incidents', 'Skills disabled due to health check failures');

    // Log to audit trail
    await this.logAuditEvent('AUTOMATIC_ROLLBACK', {
      reason: 'health_check_failures',
      consecutiveFailures: this.consecutiveFailures,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## Manual Rollback Procedures

### Decision Matrix: When to Roll Back

| Scenario | Severity | Rollback Required? | Timeline |
|----------|----------|-------------------|----------|
| Error rate 2-5% | LOW | Monitor | N/A |
| Error rate 5-10% | MEDIUM | Yes, within 15min | 15 minutes |
| Error rate >10% | CRITICAL | Yes, immediately | 2 minutes |
| Response time degradation <20% | LOW | Monitor | N/A |
| Response time degradation >20% | MEDIUM | Yes | 10 minutes |
| Cost spike <50% | LOW | Monitor | N/A |
| Cost spike >50% | MEDIUM | Yes | 30 minutes |
| Security vulnerability | CRITICAL | Yes, immediately | 5 minutes |
| Data corruption | CRITICAL | Yes, immediately | 2 minutes |

---

### Method 1: Feature Flag Rollback (Fastest - 2 minutes)

**Use when**: Immediate disable required, skills are causing issues

**Procedure**:

```bash
# Step 1: SSH into production server (or use Render shell)
render shell legal-platform-ai-service

# Step 2: Open Node.js REPL
node

# Step 3: Execute rollback
const { RolloutManager } = require('./dist/feature-flags/RolloutManager');
const rolloutManager = new RolloutManager();

// Disable skills for all users
await rolloutManager.setRolloutPercentage(0);

console.log('✅ Skills disabled for all users');

// Verify
const currentPercentage = await rolloutManager.getRolloutPercentage();
console.log(`Current rollout: ${currentPercentage}%`);  // Should be 0
```

**Timeline**: ~2 minutes

**Impact**:
- ✅ Instant disable of skills for all users
- ✅ No code deployment required
- ✅ Fallback to standard routing automatically
- ⚠️  No API restart needed

**Verification**:
```bash
# Check health endpoint
curl https://legal-platform-ai-service.onrender.com/health | jq '.skills_metrics'

# Verify skills are not being used
# active_skills_count should be 0 or very low
```

---

### Method 2: Environment Variable Rollback (5 minutes)

**Use when**: Need to disable skills at infrastructure level

**Procedure**:

```bash
# Step 1: Access Render Dashboard
open https://dashboard.render.com

# Step 2: Navigate to ai-service
# Services > legal-platform-ai-service > Environment

# Step 3: Update environment variable
# Change: ANTHROPIC_SKILLS_ENABLED=false

# Step 4: Trigger manual deploy
# Click "Manual Deploy" > "Deploy latest commit"

# Wait for deployment to complete (~3-5 minutes)
```

**Timeline**: ~5 minutes

**Impact**:
- ✅ Complete disable of skills functionality
- ⚠️  Requires service restart
- ⚠️  Brief downtime during restart (~30 seconds)

**Verification**:
```bash
# Check environment variable
render env list legal-platform-ai-service | grep ANTHROPIC_SKILLS_ENABLED

# Should show: ANTHROPIC_SKILLS_ENABLED=false
```

---

### Method 3: Code Deployment Rollback (10-15 minutes)

**Use when**: Feature flag and env var methods insufficient, code changes needed

**Procedure**:

```bash
# Step 1: Identify last good deployment
git log --oneline -10

# Example output:
# a1b2c3d feat: add new skill pattern
# e4f5g6h fix: update skill validation  <-- Last good commit
# i7j8k9l feat: implement skills integration

# Step 2: Revert to last good commit
git revert a1b2c3d --no-commit

# Or use git reset for complete rollback (destructive)
# git reset --hard e4f5g6h

# Step 3: Commit the revert
git commit -m "revert: rollback skills deployment due to production issues"

# Step 4: Push to main (triggers auto-deploy)
git push origin main

# Step 5: Monitor Render deployment
render logs legal-platform-ai-service --tail

# Wait for successful deployment (~5-10 minutes)
```

**Timeline**: ~10-15 minutes

**Impact**:
- ✅ Complete code rollback
- ⚠️  Service restart required
- ⚠️  All recent changes reverted

**Verification**:
```bash
# Verify deployment
curl https://legal-platform-ai-service.onrender.com/health

# Check commit history
git log -1 --oneline

# Should show revert commit
```

---

### Method 4: Render Dashboard Rollback (5 minutes)

**Use when**: Need to rollback to previous deployment without code changes

**Procedure**:

```bash
# Step 1: Access Render Dashboard
open https://dashboard.render.com

# Step 2: Navigate to ai-service
# Services > legal-platform-ai-service > Events

# Step 3: Find last successful deployment
# Click on previous deployment from list

# Step 4: Click "Rollback to this deploy"
# Confirm rollback

# Wait for rollback to complete (~3-5 minutes)
```

**Timeline**: ~5 minutes

**Impact**:
- ✅ Fast rollback via UI
- ✅ No git operations needed
- ⚠️  Service restart required

**Verification**:
```bash
# Check current deployment
render services get legal-platform-ai-service

# Verify deployment timestamp matches rollback target
```

---

## Partial Rollback Procedures

### Rollback for Specific User Percentage

**Use when**: Issues affect only certain user cohorts

**Procedure**:

```typescript
const rolloutManager = new RolloutManager();

// Reduce rollout percentage
await rolloutManager.setRolloutPercentage(5);  // From 25% to 5%
console.log('✅ Rolled back to 5% of users');

// Monitor for 1 hour, then decide next action
```

---

### Rollback for Specific Skill

**Use when**: Single skill causing issues, others working fine

**Procedure**:

```typescript
// Method 1: Remove skill from registry (requires deploy)
// File: services/ai-service/src/skills/SkillsRegistry.ts

// Comment out problematic skill pattern
const skillPatterns = [
  // {
  //   skillId: 'problematic-skill-id',
  //   patterns: [...],
  //   category: 'analysis',
  // },
  // ... other skills remain active
];

// Method 2: Delete skill via API
const apiClient = new SkillsAPIClient({ apiKey: process.env.ANTHROPIC_API_KEY });
await apiClient.deleteSkill('problematic-skill-id');
console.log('✅ Skill deleted');

// Method 3: Circuit breaker (automatic)
// Circuit breaker opens automatically after repeated failures
// No manual intervention needed
```

---

## Rollback Verification

After executing rollback, verify success with these checks:

### 1. Health Check Verification

```bash
curl https://legal-platform-ai-service.onrender.com/health | jq

# Expected after rollback:
# {
#   "status": "healthy",
#   "services": {
#     "database": "healthy",
#     "redis": "healthy",
#     "claude_api": "healthy",
#     "skills_api": "healthy" or "disabled"
#   }
# }
```

### 2. Error Rate Verification

```bash
# Check New Relic error rate
# Should return to <2% within 5 minutes of rollback
```

### 3. Response Time Verification

```bash
# Run quick load test
artillery quick --count 100 --num 10 \
  https://legal-platform-web.onrender.com/api/ai/analyze

# Verify p95 <5s
```

### 4. Cost Verification

```typescript
const costTracker = new CostTracker();
const currentCost = await costTracker.getCurrentHourlyCost();

console.log(`Current hourly cost: $${currentCost}`);
// Should return to baseline after skills disabled
```

### 5. User Impact Verification

```bash
# Check recent error logs
render logs legal-platform-ai-service --tail | grep ERROR

# Should show decreased error frequency
```

---

## Post-Rollback Actions

After successful rollback, complete these steps:

### 1. Incident Documentation (Within 1 hour)

Create incident report:

```markdown
# Incident Report: Skills Rollback

**Date**: 2025-11-19
**Time**: 14:30 UTC
**Duration**: 15 minutes
**Severity**: SEV2

## Summary
Skills deployment rolled back due to elevated error rate.

## Timeline
- 14:15: Error rate increased to 8%
- 14:20: Manual rollback initiated
- 14:25: Rollback completed
- 14:30: Systems stable, error rate <2%

## Root Cause
[To be determined during post-mortem]

## Impact
- 300 users experienced elevated errors
- No data loss
- Average response time increased 2x during incident

## Resolution
- Rolled back skills to 0% via feature flag
- Errors returned to normal within 5 minutes

## Follow-up Actions
1. [ ] Conduct post-mortem within 48 hours
2. [ ] Identify root cause
3. [ ] Implement fix
4. [ ] Add monitoring/alerting for this scenario
5. [ ] Update runbooks if needed
```

### 2. Team Notification (Immediate)

```bash
# Slack notification
@channel Skills deployment has been rolled back due to [REASON].
Current status: STABLE
Error rate: <2%
Response time: Normal
Impact: [X] users affected

Incident report: [LINK]
Post-mortem scheduled: [DATE/TIME]
```

### 3. Stakeholder Communication (Within 2 hours)

Email template:

```
Subject: Skills Deployment Rollback - [DATE]

Hi team,

We rolled back the skills deployment today due to [REASON].

Current Status:
✅ Systems are stable
✅ Error rates normal (<2%)
✅ No data loss

Impact:
- Duration: [X] minutes
- Users affected: [X]
- Services impacted: AI analysis features

Next Steps:
1. Post-mortem scheduled for [DATE/TIME]
2. Root cause analysis in progress
3. Fix implementation timeline TBD
4. Re-deployment plan to be communicated

For questions, contact: [ON-CALL ENGINEER]
```

### 4. Root Cause Analysis (Within 48 hours)

Schedule post-mortem meeting with:
- Platform engineers
- DevOps team
- Product owner
- QA team

Agenda:
1. Timeline review
2. Root cause identification
3. Fix proposal
4. Prevention measures
5. Runbook updates

### 5. Re-deployment Plan (Within 1 week)

```markdown
# Re-deployment Plan

## Prerequisites
- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Additional monitoring added
- [ ] Tests updated
- [ ] Runbooks updated
- [ ] Team trained on new procedures

## Deployment Strategy
- Start with 1% rollout (lower than previous 5%)
- Extended monitoring period (1 week instead of 72 hours)
- More aggressive rollback thresholds
- Increased alert sensitivity

## Success Criteria
- Error rate <1% (stricter than 2%)
- Response time <4s p95 (stricter than 5s)
- Cost savings >40% (stricter than 35%)
- No incidents for 1 week

## Rollback Plan
- Immediate rollback if ANY criteria violated
- No gradual degradation tolerance
```

---

## Emergency Contacts

### On-Call Rotation

**PagerDuty**: https://[your-org].pagerduty.com/schedules

**Primary On-Call**: Check current rotation
**Secondary On-Call**: Check current rotation
**Escalation**: Engineering Manager

### Communication Channels

**Incidents**: #incidents (Slack)
**Skills Team**: #skills-deployment (Slack)
**General**: #engineering (Slack)

### External Contacts

**Anthropic Support**: support@anthropic.com
**Render Support**: support@render.com
**New Relic Support**: support@newrelic.com

### Escalation Path

1. Primary On-Call Engineer (0-15 minutes)
2. Secondary On-Call Engineer (15-30 minutes)
3. Engineering Manager (30-60 minutes)
4. CTO (60+ minutes or SEV1)

---

## Appendix: Rollback Decision Tree

```
Is there a production issue?
├─ NO → Continue monitoring
└─ YES → Is it skills-related?
    ├─ NO → Use general incident procedures
    └─ YES → What is the severity?
        ├─ LOW (Error rate 2-5%)
        │   └─ Monitor closely, prepare for rollback
        ├─ MEDIUM (Error rate 5-10% or response time >7s)
        │   └─ Execute Method 1: Feature Flag Rollback (2 min)
        └─ CRITICAL (Error rate >10% or security issue)
            └─ Execute Method 1: Feature Flag Rollback IMMEDIATELY (2 min)
                └─ If insufficient, execute Method 2: Environment Variable (5 min)
                    └─ If insufficient, execute Method 3: Code Rollback (15 min)
```

---

## Related Documents

- [Skills Deployment Runbook](./skills-deployment.md)
- [Incident Response Guide](./incident-response.md)
- [Performance Tuning Guide](./performance-tuning.md)
- [Monitoring Setup Guide](./skills-monitoring.md)

---

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-11-19 | 1.0 | Initial runbook creation | James (Dev Agent) |

---

**Remember**: When in doubt, roll back. It's always better to be safe and stable than to risk extended downtime.
