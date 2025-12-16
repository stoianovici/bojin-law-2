# Production Rollout Playbook: Skills Feature Launch

**Story**: 2.14 - Skills Production Deployment and Monitoring
**Purpose**: Step-by-step execution guide for Tasks 3-5 (Canary → Beta → Full Deployment)
**Audience**: DevOps Engineers, Platform Team, Product Owner
**Prerequisites**: All code from Story 2.14 Tasks 1-2, 6-9 complete, production infrastructure deployed

---

## 🎯 Rollout Strategy Overview

This playbook implements a **staged rollout strategy** to minimize risk:

| Phase      | Users | Duration | Rollback Time | Risk Level |
| ---------- | ----- | -------- | ------------- | ---------- |
| **Canary** | 5%    | 72 hours | 2 minutes     | Low        |
| **Beta**   | 25%   | 1 week   | 5 minutes     | Medium     |
| **Full**   | 100%  | Ongoing  | 15 minutes    | High       |

**Key Principle**: At each phase, we validate metrics before proceeding. Any degradation triggers immediate rollback.

---

## 📋 Pre-Deployment Checklist

Complete ALL items before starting Phase 1:

### Infrastructure Validation

- [ ] Production environment deployed on Render.com
- [ ] PostgreSQL database accessible (skills tables exist)
- [ ] Redis cache operational (256MB available)
- [ ] All environment variables configured
- [ ] Claude Skills API key valid (test with health check)

### Monitoring Setup (Tasks 6-7 Complete)

- [ ] New Relic dashboards deployed and accessible
- [ ] PagerDuty/Slack alerts configured and tested
- [ ] Health check endpoint returning 200 OK
- [ ] Custom metrics flowing to New Relic
- [ ] Log aggregation working (Winston → New Relic Logs)

### Code Deployment

- [ ] All code from Stories 2.11-2.14 merged to main
- [ ] Staging environment validated (smoke tests passing)
- [ ] Load tests executed successfully (Task 1 results reviewed)
- [ ] Security audit recommendations implemented (Task 2)
- [ ] Rollback procedures tested in staging

### Team Readiness

- [ ] Operations runbooks reviewed (Task 8)
- [ ] Team training completed (Task 9)
- [ ] On-call schedule confirmed (24/7 coverage)
- [ ] Incident response procedures posted
- [ ] Stakeholders notified of rollout schedule

### Baseline Metrics Captured

Capture these metrics for 7 days BEFORE enabling skills:

```bash
# Run baseline collection script
node scripts/monitoring/capture-baseline-metrics.js --days 7

# Expected output:
# - Average response time: X ms
# - Error rate: Y%
# - Average cost per request: $Z
# - P95/P99 response times
# - Daily request volume
```

**Baseline targets** (without skills):

- Response time p95: < 3000ms
- Error rate: < 1%
- Cost per request: ~$0.03
- Request volume: ~10,000/day

---

## 🕐 Phase 1: Canary Deployment (5%)

**Goal**: Validate skills work correctly with minimal user impact
**Duration**: 72 hours (3 days)
**Users affected**: 5% (~500 users if 10k requests/day)
**Acceptance Criteria**: AC#1 (staged rollout), AC#4 (performance), AC#6 (error rate)

### Day 1 - 9:00 AM: Enable Canary

**Prerequisites**:

- [ ] All pre-deployment checklist items complete
- [ ] Product Owner approval received
- [ ] DevOps engineer on-call for next 72 hours

**Execution Steps**:

```bash
# 1. Verify production status
curl https://legal-platform-web.onrender.com/health
# Expected: {"status":"healthy","services":{"all":"healthy"}}

# 2. Set rollout percentage to 5%
node scripts/deployment/set-rollout.js --percentage 5 --phase canary

# 3. Verify rollout applied
curl https://legal-platform-web.onrender.com/api/feature-flags/skills_rollout
# Expected: {"enabled":true,"percentage":5}

# 4. Test with canary user
node scripts/deployment/test-canary-user.js --userId <test-user-id>
# Expected: Skills enabled for this user

# 5. Start continuous monitoring
node scripts/deployment/monitor-canary.js --duration 72 --phase canary &
# This runs in background, outputs to logs/canary-monitor.log
```

**Post-Deployment**:

- [ ] Verify skills_rollout feature flag shows 5% in database
- [ ] Check New Relic dashboard shows canary metrics flowing
- [ ] Confirm alerts are active (test with dummy alert)
- [ ] Post to #engineering Slack: "Canary rollout (5%) enabled at [TIME]"

### Days 1-3: Continuous Monitoring

**Monitor these metrics every 2-4 hours**:

#### Critical Metrics (Auto-Alert)

| Metric              | Target  | Alert Threshold | Current  |
| ------------------- | ------- | --------------- | -------- |
| Error Rate          | < 2%    | > 5%            | \_\_\_%  |
| Response Time (p95) | < 5s    | > 10s           | \_\_\_ms |
| Skills API Success  | > 95%   | < 90%           | \_\_\_%  |
| Cost Per Request    | < $0.02 | > $0.05         | $\_\_\_  |

#### Secondary Metrics (Manual Review)

| Metric          | Target | Warning Threshold | Current |
| --------------- | ------ | ----------------- | ------- |
| Cache Hit Rate  | > 40%  | < 30%             | \_\_\_% |
| Token Reduction | > 70%  | < 60%             | \_\_\_% |
| Fallback Rate   | < 5%   | > 15%             | \_\_\_% |
| Memory Usage    | < 80%  | > 90%             | \_\_\_% |

**Dashboard URLs**:

- New Relic APM: `https://one.newrelic.com/...` (bookmark)
- Skills Dashboard: `https://your-app.onrender.com/admin/skills-dashboard`
- Render Metrics: `https://dashboard.render.com/...`

**Daily Report Generation**:

```bash
# Run at 9 AM each day
node scripts/monitoring/generate-canary-report.js --date $(date +%Y-%m-%d)

# Review report at: reports/canary-day-1.md, day-2.md, day-3.md
```

**Daily Report Template**:

```markdown
## Canary Report - Day [1/2/3]

### Metrics Summary

- Total requests with skills: [NUMBER]
- Error rate: [X]% (baseline: [Y]%)
- Avg response time: [X]ms (baseline: [Y]ms)
- Cost per request: $[X] (baseline: $[Y])
- Skills success rate: [X]%

### Issues Detected

- [Issue 1 description]
- [Issue 2 description]

### User Feedback

- [Feedback item 1]
- [Feedback item 2]

### Recommendation

[ ] Proceed to Beta | [ ] Hold and investigate | [ ] Rollback
```

### Day 3 - 5:00 PM: Hold/Proceed Decision

**Decision Meeting Attendees**:

- Product Owner (decision maker)
- DevOps Lead
- Engineering Manager
- On-call engineer

**Decision Criteria**:

✅ **PROCEED to Beta (25%) if ALL true**:

- Error rate < 2% (AC#6)
- Response time p95 < 5s (AC#4)
- No critical incidents (SEV1/SEV2)
- Cost savings trending toward >35% (AC#5)
- No major user complaints
- All monitoring systems operational

⚠️ **HOLD and investigate if ANY true**:

- Error rate 2-5%
- Response time p95 5-10s
- 1-2 SEV3 incidents
- Cost savings 20-35%
- Minor user complaints

🚨 **ROLLBACK immediately if ANY true**:

- Error rate > 5%
- Response time p95 > 10s
- Any SEV1/SEV2 incidents
- Skills API completely failing
- Data corruption detected
- Security incident

**If PROCEED approved**:

```bash
# Document decision
echo "DECISION: PROCEED to Beta" >> logs/rollout-decisions.log
echo "Date: $(date)" >> logs/rollout-decisions.log
echo "Approver: [NAME]" >> logs/rollout-decisions.log

# Schedule Beta rollout for 24 hours later (Day 4, 9 AM)
```

**If HOLD**:

- Extend canary monitoring for 48 more hours
- Investigate and fix issues
- Re-evaluate after fixes deployed

**If ROLLBACK**:

- Follow emergency rollback procedures (see below)
- Conduct incident retrospective
- Fix issues before retry

---

## 🕑 Phase 2: Beta Deployment (25%)

**Goal**: Validate skills at moderate scale with broader user base
**Duration**: 1 week (7 days)
**Users affected**: 25% (~2,500 users)
**Acceptance Criteria**: AC#1 (staged rollout), AC#5 (cost savings)

### Day 4 - 9:00 AM: Enable Beta

**Prerequisites**:

- [ ] Canary phase completed successfully
- [ ] Hold/Proceed decision: PROCEED
- [ ] Product Owner approval for Beta phase
- [ ] Engineering team available for next 7 days

**Execution Steps**:

```bash
# 1. Verify canary still healthy
curl https://legal-platform-web.onrender.com/health

# 2. Increase rollout to 25%
node scripts/deployment/set-rollout.js --percentage 25 --phase beta

# 3. Verify rollout applied
curl https://legal-platform-web.onrender.com/api/feature-flags/skills_rollout
# Expected: {"enabled":true,"percentage":25}

# 4. Start beta monitoring
node scripts/deployment/monitor-beta.js --duration 168 --phase beta &
# Runs for 168 hours (7 days)

# 5. Post to Slack
# "#engineering: Beta rollout (25%) enabled at [TIME]"
```

### Days 4-10: Weekly Monitoring

**Daily Checks** (9 AM each day):

```bash
# Generate daily report
node scripts/monitoring/generate-beta-report.js --date $(date +%Y-%m-%d)

# Check for alerts
node scripts/monitoring/check-alerts.js --since "24 hours ago"

# Review cost trends
node scripts/monitoring/cost-report.js --timeframe daily
```

**Metrics to Track**:

- All metrics from Canary phase
- **NEW**: Cost savings percentage (target >35%)
- **NEW**: User satisfaction scores (if survey deployed)
- **NEW**: Skill selection distribution (which skills used most)
- **NEW**: Cache effectiveness over time

**Mid-Week Check-in** (Day 7):

Hold a review meeting at mid-week:

- Review 3 days of beta metrics
- Identify any optimization opportunities
- Fine-tune caching strategy if needed
- Adjust skill selection thresholds if needed

**Optimization Actions**:

```bash
# If cache hit rate < 40%:
node scripts/optimization/increase-cache-ttl.js --ttl 7200

# If specific skill timing out frequently:
node scripts/optimization/adjust-skill-timeout.js --skillId [ID] --timeout 10000

# If cost savings < 35%:
node scripts/optimization/review-model-routing.js --suggest-changes
```

### Day 10 - 5:00 PM: Hold/Proceed Decision

**Decision Criteria**:

✅ **PROCEED to Full (100%) if ALL true**:

- All canary criteria still met
- **Cost savings > 35%** (AC#5) ⭐
- Cache hit rate > 40%
- No regression in error rates or performance
- User feedback neutral or positive
- Team confident in stability

⚠️ **HOLD if ANY true**:

- Cost savings 30-35% (close but not meeting AC#5)
- Cache hit rate 30-40%
- Minor performance regression
- Need more optimization time

🚨 **ROLLBACK if ANY true**:

- Any critical rollback criteria from Canary phase
- Cost savings declining (< 30%)
- Performance significantly degraded

**If PROCEED approved**:

```bash
# Document decision
echo "DECISION: PROCEED to Full Deployment" >> logs/rollout-decisions.log
echo "Date: $(date)" >> logs/rollout-decisions.log
echo "Cost Savings Achieved: [X]%" >> logs/rollout-decisions.log

# Schedule full rollout for 24 hours later (Day 11, 9 AM)
```

---

## 🕒 Phase 3: Full Deployment (100%)

**Goal**: Enable skills for all users and validate SLA compliance
**Duration**: 48 hours intensive monitoring, then ongoing
**Users affected**: 100% (all users)
**Acceptance Criteria**: AC#1, AC#5, AC#9 (SLA validation)

### Day 11 - 9:00 AM: Enable Full Deployment

**Prerequisites**:

- [ ] Beta phase completed successfully
- [ ] Cost savings validated > 35% (AC#5)
- [ ] Product Owner approval for full deployment
- [ ] All engineering team on high alert for 48 hours
- [ ] Customer support briefed on new feature

**Execution Steps**:

```bash
# 1. Final pre-flight check
node scripts/deployment/pre-flight-check.js --phase full
# Validates all systems healthy

# 2. Enable for 100% of users
node scripts/deployment/set-rollout.js --percentage 100 --phase full

# 3. Verify rollout
curl https://legal-platform-web.onrender.com/api/feature-flags/skills_rollout
# Expected: {"enabled":true,"percentage":100}

# 4. Start intensive monitoring (48 hours)
node scripts/deployment/monitor-full.js --duration 48 --intensive &

# 5. Post to all channels
# "#engineering: Full deployment (100%) enabled at [TIME]"
# "#customer-support: Skills feature now live for all users"
```

### Days 11-12: Intensive Monitoring (48 hours)

**Monitoring Frequency**: Every 1-2 hours for first 48 hours

**Critical Metrics** (AC#4, AC#6, AC#9):
| Metric | Target (AC) | Current | Status |
|--------|-------------|---------|--------|
| **Response Time p95** | < 5s (AC#4) | **_ms | ✅/❌ |
| **Error Rate** | < 2% (AC#6) | _**% | ✅/❌ |
| **Uptime** | 99.9% (AC#9) | **_% | ✅/❌ |
| **Cost Savings** | > 35% (AC#5) | _**% | ✅/❌ |
| Skills Success Rate | > 95% | **_% | ✅/❌ |
| Memory Usage | < 85% | _**% | ✅/❌ |

**Hourly Checks**:

```bash
# Run every hour
node scripts/monitoring/hourly-check.js

# Check for any alerts
node scripts/monitoring/check-alerts.js --since "1 hour ago"

# If any alerts fired:
# 1. Review New Relic dashboard
# 2. Check error logs
# 3. Assess if rollback needed
# 4. Document in incident log
```

**SLA Validation** (AC#9):

```bash
# At 24 hours and 48 hours, validate SLA metrics
node scripts/monitoring/validate-sla.js --hours 24

# Expected output:
# ✅ Uptime: 99.95% (target: 99.9%)
# ✅ Response time p95: 4.2s (target: <5s)
# ✅ Error rate: 1.3% (target: <2%)
# ✅ SLA COMPLIANCE: PASS
```

**Cost Validation** (AC#5):

```bash
# At 48 hours, validate cost savings sustained
node scripts/monitoring/validate-cost-savings.js --hours 48

# Expected output:
# ✅ Cost savings: 37.2% (target: >35%)
# ✅ Total cost with skills: $2,150
# ✅ Estimated cost without skills: $3,422
# ✅ Total savings: $1,272
# ✅ COST SAVINGS TARGET: MET
```

### Day 13: Declare Victory or Rollback

**Final Validation Checklist**:

- [ ] 48 hours of intensive monitoring complete
- [ ] Response time p95 < 5s consistently (AC#4) ✅
- [ ] Error rate < 2% consistently (AC#6) ✅
- [ ] Cost savings > 35% validated (AC#5) ✅
- [ ] SLA compliance validated (AC#9) ✅
- [ ] No critical incidents (SEV1/SEV2)
- [ ] User feedback positive or neutral
- [ ] Team confidence high

**If ALL criteria met**:

```bash
# Mark rollout as successful
node scripts/deployment/mark-rollout-complete.js

# Generate final report
node scripts/monitoring/generate-final-report.js

# Post to Slack
# "#engineering: 🎉 Skills feature fully deployed and stable!"
# "#leadership: Skills deployment complete - 37% cost savings achieved"

# Update Story 2.14 status to "Complete"
# Schedule Task 10 (Post-Deployment Review) for 1 week later
```

**If criteria NOT met**:

- Assess which metric failed
- Determine if fixable without rollback
- If not fixable quickly → **ROLLBACK**

---

## 🚨 Emergency Rollback Procedures

**When to Rollback**:

- Error rate > 5%
- Response time p95 > 10s
- SEV1/SEV2 incident
- Skills API completely failing
- Data corruption
- Security incident
- Cost spike > 150% of baseline

### Rollback Method 1: Feature Flag (2 minutes) ⚡ FASTEST

```bash
# Instantly disable skills for all users
node scripts/deployment/set-rollout.js --percentage 0 --emergency

# Verify disabled
curl https://legal-platform-web.onrender.com/api/feature-flags/skills_rollout
# Expected: {"enabled":false,"percentage":0}

# Monitor for recovery (error rates should drop immediately)
watch -n 10 'node scripts/monitoring/check-error-rate.js'
```

**Recovery Time**: ~2 minutes
**Impact**: Skills disabled, app falls back to non-skills routing (graceful degradation)

### Rollback Method 2: Environment Variable (5 minutes)

```bash
# If feature flag system failing, use env var
# In Render Dashboard:
# 1. Go to ai-service → Environment
# 2. Set ANTHROPIC_SKILLS_ENABLED=false
# 3. Click "Save & Redeploy"

# Or via Render API:
curl -X PUT https://api.render.com/v1/services/[SERVICE_ID]/env-vars \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -d '{"key":"ANTHROPIC_SKILLS_ENABLED","value":"false"}'

# Wait for redeploy (~3 minutes)
```

**Recovery Time**: ~5 minutes
**Impact**: Service restart required, brief interruption

### Rollback Method 3: Code Revert (10 minutes)

```bash
# If entire deployment needs rollback
# 1. Find previous working deployment ID in Render
# 2. Click "Rollback" in Render Dashboard
# 3. Confirm rollback

# Or via Render API:
curl -X POST https://api.render.com/v1/services/[SERVICE_ID]/rollback \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -d '{"deployId":"[PREVIOUS_DEPLOY_ID]"}'

# Monitor deployment
curl https://api.render.com/v1/services/[SERVICE_ID]/deploys/[DEPLOY_ID]
```

**Recovery Time**: ~10-15 minutes (full redeploy)
**Impact**: Full service restart, returns to previous version

### Rollback Method 4: Circuit Breaker (15 minutes)

```bash
# If issue is with Claude Skills API itself
# Enable circuit breaker to fail fast

node scripts/deployment/enable-circuit-breaker.js --service skills-api

# This will:
# - Detect Skills API failures
# - Automatically fallback to non-skills routing
# - Prevent cascading failures
```

**Recovery Time**: ~15 minutes (code change + deploy)
**Impact**: Gradual degradation as circuit breaker opens

### Post-Rollback Actions

**Immediate** (within 15 minutes):

- [ ] Verify error rates returned to baseline
- [ ] Confirm all services healthy
- [ ] Post incident update to Slack
- [ ] Notify stakeholders

**Within 1 hour**:

- [ ] Create incident report (use template in docs/runbooks/incident-response.md)
- [ ] Identify root cause
- [ ] Assign engineer to investigate
- [ ] Create fix plan

**Within 24 hours**:

- [ ] Root cause analysis complete
- [ ] Fix implemented and tested in staging
- [ ] Incident retrospective scheduled
- [ ] Decide on retry timeline

---

## 📊 Success Metrics Summary

**Acceptance Criteria Validation**:

| AC    | Requirement                    | How to Validate                | Must Pass |
| ----- | ------------------------------ | ------------------------------ | --------- |
| AC#1  | Staged rollout 5% → 25% → 100% | Follow Phases 1-3              | ✅        |
| AC#2  | Monitoring alerts configured   | Task 6 complete before rollout | ✅        |
| AC#3  | Rollback tested                | Test in staging before Phase 1 | ✅        |
| AC#4  | Response time < 5s             | Check p95 in New Relic         | ✅        |
| AC#5  | Cost savings > 35%             | Validate at Phase 2 end        | ✅        |
| AC#6  | Error rate < 2%                | Monitor continuously           | ✅        |
| AC#7  | Documentation complete         | Tasks 8-9 complete             | ✅        |
| AC#8  | Team training done             | Task 9 complete                | ✅        |
| AC#9  | SLA validated                  | Check at Phase 3 end           | ✅        |
| AC#10 | Post-deploy review             | Schedule Task 10 after success | ✅        |

---

## 📅 Timeline Template

**Week 1**:

- **Monday 9 AM**: Enable Canary (5%)
- **Monday-Thursday**: Monitor canary metrics
- **Thursday 5 PM**: Hold/Proceed decision meeting
- **Friday 9 AM**: Enable Beta (25%)

**Week 2**:

- **Monday-Thursday**: Monitor beta metrics, optimize
- **Wednesday**: Mid-week check-in meeting
- **Thursday 5 PM**: Hold/Proceed decision meeting
- **Friday 9 AM**: Enable Full (100%)

**Week 3**:

- **Monday-Tuesday**: Intensive monitoring (48 hours)
- **Wednesday**: Declare success or rollback
- **Thursday**: Post-deployment review (Task 10)
- **Friday**: Celebrate! 🎉

---

## 🔗 Related Documents

- **Monitoring Setup**: `docs/runbooks/performance-tuning.md`
- **Alert Configuration**: Story 2.14 Task 6 implementation
- **Incident Response**: `docs/runbooks/incident-response.md`
- **Rollback Procedures**: `docs/runbooks/skills-rollback.md`
- **Cost Optimization**: `docs/runbooks/cost-optimization.md`
- **Security Audit**: `docs/security/skills-security-audit.md`

---

## 🎯 Key Success Factors

1. **Don't rush**: Each phase needs full duration for proper validation
2. **Monitor continuously**: Automated monitoring catches issues early
3. **Clear decision criteria**: Remove emotion from hold/proceed decisions
4. **Have rollback ready**: Test rollback procedures before starting
5. **Communicate clearly**: Keep all stakeholders informed at each phase
6. **Document everything**: Every decision, metric, and issue logged
7. **Trust the data**: Metrics drive decisions, not opinions
8. **Team readiness**: Ensure on-call coverage and training complete

---

## ✅ Final Checklist

Before marking Story 2.14 as complete:

- [ ] All 3 phases executed successfully
- [ ] All 10 Acceptance Criteria validated
- [ ] SLA compliance documented (AC#9)
- [ ] Cost savings validated > 35% (AC#5)
- [ ] Performance benchmarks met (AC#4, AC#6)
- [ ] Team training completed (AC#8)
- [ ] Post-deployment review conducted (AC#10)
- [ ] All documentation updated
- [ ] Monitoring dashboards operational
- [ ] Customer feedback collected

**Story 2.14 Status**: Ready for Production ✅

---

_Last Updated: 2025-11-19_
_Version: 1.0_
_Owner: DevOps Team_
