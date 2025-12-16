# Database Migration Announcement Template

Use these templates to communicate database migrations to stakeholders.

---

## 24 Hours Before Migration

**Subject:** [SCHEDULED MAINTENANCE] Database Migration - [DATE] at [TIME]

**Audience:** Engineering team, Product team, Customer support

**Template:**

```
Team,

We will be performing a database migration on [DATE] at [TIME] [TIMEZONE].

📋 MIGRATION DETAILS

Purpose: [Brief description of migration - e.g., "Adding user authentication tables and indexes"]

Estimated Downtime: [X minutes] or [Zero downtime - blue-green deployment]

Affected Features:
- [Feature 1 - e.g., "User login may be temporarily unavailable"]
- [Feature 2 - e.g., "Case creation temporarily disabled"]
- [OR: "No user-facing impact expected"]

🕐 TIMELINE

- [TIME]: Maintenance window begins
- [TIME]: Database backup created
- [TIME]: Migration execution starts
- [TIME]: Expected completion
- [TIME]: Monitoring period begins
- [TIME]: Rollback deadline (if issues detected)

⚠️ IMPACT

Development/Staging: [Impact description]
Production: [Impact description]

During the maintenance window:
- [What will be unavailable]
- [What will continue to work]
- [Any user-facing changes]

📞 CONTACT INFORMATION

In case of issues:
- On-call engineer: [NAME] via [PHONE/SLACK]
- DevOps lead: [NAME] via [PHONE/SLACK]
- Slack channel: #engineering

🔄 ROLLBACK CRITERIA

We will rollback the migration if:
- Error rate >10% for >5 minutes
- Database connection failures >5%
- Critical functionality broken
- Data integrity issues detected

Thank you for your patience.

[Your Name]
DevOps Team
```

---

## 1 Hour Before Migration

**Subject:** [REMINDER] Database Migration Starting in 1 Hour

**Audience:** Engineering team

**Template:**

```
Team,

Reminder: Database migration starts in 1 hour.

Time: [TIME] [TIMEZONE]
Estimated Duration: [X minutes]
Expected Downtime: [X minutes] or [Zero]

🎯 FINAL CHECKS

Before we begin:
- [ ] Staging migration successful ✅
- [ ] Full test suite passing ✅
- [ ] Backup verified ✅
- [ ] Rollback procedure ready ✅
- [ ] On-call team standing by ✅

📊 STATUS UPDATES

I'll post updates every 15 minutes in #engineering during the migration.

If you notice any issues after the migration, please report immediately in #engineering.

[Your Name]
```

---

## During Migration (Progress Updates)

**Subject:** [IN PROGRESS] Database Migration Update

**Audience:** Engineering team (Slack #engineering channel)

**Template:**

```
🔄 Migration Update [T+15 minutes]

Status: [On Track / Delayed / Issues Detected]

Progress:
✅ Backup created
✅ Services stopped
🔄 Migration executing... (Step 3 of 5)
⏳ Pending: Verification, service restart

Current Step: [Brief description]
ETA to Completion: [X minutes]

[If issues: Brief description and action being taken]

Next update in 15 minutes.
```

---

## Migration Completed Successfully

**Subject:** ✅ [COMPLETE] Database Migration Successful

**Audience:** Engineering team, Product team, Customer support

**Template:**

```
✅ Database migration completed successfully!

⏱️ METRICS

Scheduled Time: [TIME]
Actual Start: [TIME]
Completion Time: [TIME]
Total Duration: [X minutes]
Actual Downtime: [X minutes] [or "Zero downtime achieved"]

✅ VERIFICATION

All checks passed:
- Migration applied successfully ✅
- Data integrity verified ✅
- Application health checks passing ✅
- Error rates normal (<1%) ✅
- Performance metrics normal ✅
- Critical workflows tested ✅

📊 STATUS

- All services: ✅ Operational
- Database: ✅ Healthy
- Error rate: [X%] (normal)
- Response time p95: [X]ms (normal)

🔍 MONITORING

We're continuing to monitor closely for the next 24 hours.

If you notice any issues, please report in #engineering immediately.

Thanks for your patience during the migration!

[Your Name]
DevOps Team
```

---

## Migration Completed with Issues (Non-Critical)

**Subject:** ⚠️ [COMPLETE] Database Migration - Monitoring for Issues

**Audience:** Engineering team

**Template:**

```
⚠️ Database migration completed with minor issues detected

⏱️ MIGRATION STATUS

Migration: ✅ Applied successfully
Services: ✅ Operational
Rollback: ❌ Not required

⚠️ ISSUES DETECTED

[Brief description of issues - e.g., "Slightly elevated response times on case search queries"]

Impact: [Low / Medium]
Affected Features: [List]
Users Impacted: [Estimated %]

🔧 ACTION PLAN

1. [Action being taken]
2. [Monitoring plan]
3. [Timeline for fix]

📊 CURRENT METRICS

- Error rate: [X%] [Above/Below threshold]
- Response time p95: [X]ms [Above/Below threshold]
- Database connections: [X%]

🔍 MONITORING

Extended monitoring in place for next 48 hours.
On-call team standing by.

Will send update in [X hours] or immediately if issues escalate.

[Your Name]
```

---

## Migration Rollback Initiated

**Subject:** 🚨 [URGENT] Database Migration Rollback in Progress

**Audience:** Engineering team, Management

**Template:**

```
🚨 Database migration rollback initiated

⚠️ SITUATION

Migration encountered critical issues and rollback is in progress.

Reason: [Brief description - e.g., "Error rate exceeded 10% threshold"]

Timeline:
- Migration started: [TIME]
- Issues detected: [TIME]
- Rollback initiated: [TIME]
- ETA to restoration: [X minutes]

📊 IMPACT

Current Status: 🚨 Services degraded
User Impact: [Description]
Downtime: [Current duration]

🔄 ROLLBACK PROGRESS

✅ Services stopped
🔄 Restoring from backup (in progress)
⏳ Service restart pending
⏳ Verification pending

📞 INCIDENT RESPONSE

Incident Commander: [NAME]
On-call: [NAME]
Support: [NAME]

Status updates every 10 minutes in #engineering.

We'll send an update as soon as rollback completes.

[Your Name]
```

---

## Migration Rollback Completed

**Subject:** ✅ [RESOLVED] Database Rollback Complete - Services Restored

**Audience:** Engineering team, Management

**Template:**

```
✅ Database rollback completed - Services restored

📊 RESOLUTION STATUS

Services: ✅ Fully operational
Database: ✅ Restored to pre-migration state
Application: ✅ Functional (previous version)

⏱️ INCIDENT TIMELINE

- Migration started: [TIME]
- Issues detected: [TIME]
- Rollback initiated: [TIME]
- Rollback completed: [TIME]
- Total incident duration: [X minutes]

✅ VERIFICATION

- Database restored from backup ✅
- Application rolled back to previous version ✅
- All services operational ✅
- Error rates normal ✅
- Critical workflows tested ✅

📋 POST-INCIDENT ACTIONS

1. Root cause analysis (scheduled for [DATE])
2. Migration fixes (in progress)
3. Retry timeline (TBD after analysis)
4. Runbook updates (TBD)

📞 SUPPORT

If you continue to experience issues, report in #engineering.

Thank you for your patience during this incident.

Detailed post-mortem will be shared by [DATE].

[Your Name]
DevOps Team
```

---

## Post-Migration Report (24-48 hours later)

**Subject:** [REPORT] Database Migration Post-Mortem

**Audience:** Engineering team, Management

**Template:**

```
Database Migration Post-Mortem Report

Migration: [Migration Name]
Date: [DATE]
Outcome: [Success / Success with Issues / Rollback]

📊 METRICS SUMMARY

**Timing:**
- Scheduled time: [X minutes]
- Actual time: [X minutes]
- Downtime: [X minutes]

**Performance (24h post-migration):**
- Error rate: [X%] (baseline: [Y%])
- Response time p95: [X]ms (baseline: [Y]ms)
- Database query performance: [Improved / Unchanged / Degraded]

**Impact:**
- User-reported issues: [Count]
- Support tickets: [Count]
- Rollback required: [Yes/No]

✅ SUCCESSES

1. [What went well]
2. [What went well]
3. [What went well]

⚠️ ISSUES ENCOUNTERED

1. [Issue description]
   - Root cause: [Description]
   - Resolution: [Description]
   - Prevention: [How we'll prevent in future]

📚 LESSONS LEARNED

1. [Lesson 1]
2. [Lesson 2]
3. [Lesson 3]

🔧 ACTION ITEMS

1. [Action] - Owner: [NAME] - Due: [DATE]
2. [Action] - Owner: [NAME] - Due: [DATE]
3. [Action] - Owner: [NAME] - Due: [DATE]

📖 RUNBOOK UPDATES

[List any updates made to migration runbook based on learnings]

Thanks to everyone involved in this migration!

[Your Name]
DevOps Team
```

---

## Template Customization Guidelines

### When to Send Each Template

| Template               | Timing                       | Audience                      |
| ---------------------- | ---------------------------- | ----------------------------- |
| 24 Hours Before        | T-24h                        | Engineering, Product, Support |
| 1 Hour Before          | T-1h                         | Engineering                   |
| Progress Updates       | Every 15min during migration | Engineering                   |
| Completion Success     | Immediately after            | Engineering, Product, Support |
| Completion with Issues | Immediately after            | Engineering                   |
| Rollback Initiated     | Immediately                  | Engineering, Management       |
| Rollback Complete      | Immediately after            | Engineering, Management       |
| Post-Mortem            | 24-48h after                 | Engineering, Management       |

### Customization Tips

1. **Be specific:** Replace all [PLACEHOLDERS] with actual information
2. **Be concise:** Keep announcements brief but informative
3. **Be transparent:** Communicate both successes and issues honestly
4. **Be timely:** Send updates on schedule, even if "no change"
5. **Be actionable:** Include clear next steps and contact information

### Tone Guidelines

- **Before migration:** Confident, prepared, informative
- **During migration:** Factual, timely, reassuring
- **After success:** Positive, thankful, metric-driven
- **After issues:** Transparent, action-oriented, accountable
- **After rollback:** Calm, solution-focused, learning-oriented

---

**Template Version:** 1.0
**Last Updated:** 2025-11-20
**Maintained by:** DevOps Team
