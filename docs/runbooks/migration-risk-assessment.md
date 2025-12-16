# Migration Risk Assessment Checklist

**Version:** 1.0
**Last Updated:** 2025-11-20
**Purpose:** Assess risk level and determine appropriate migration strategy

---

## How to Use This Checklist

1. **Complete assessment** for every production migration
2. **Calculate total risk score** using the scoring system
3. **Determine migration strategy** based on risk level
4. **Document assessment** and attach to migration PR
5. **Review with team** before proceeding

---

## Risk Assessment Questionnaire

### Section 1: Backward Compatibility

**Question 1.1:** Is this migration backward-compatible with the currently deployed application code?

- [ ] **Yes** - Current code will continue to work after migration (0 points)
- [ ] **Partially** - Current code will work with degraded functionality (5 points)
- [ ] **No** - Current code will break after migration (10 points)

**Question 1.2:** Can the migration be rolled back without data loss?

- [ ] **Yes** - Rollback is safe and simple (0 points)
- [ ] **Partially** - Rollback possible but complex (5 points)
- [ ] **No** - Rollback would cause data loss (10 points)

**Question 1.3:** Does the migration modify or delete existing columns/tables?

- [ ] **No** - Only adding new structures (0 points)
- [ ] **Modifying** - Changing existing structures (7 points)
- [ ] **Deleting** - Removing structures (10 points)

**Section 1 Subtotal:** **\_** / 30 points

---

### Section 2: Data Volume Impact

**Question 2.1:** How many rows will be affected by this migration?

- [ ] **< 10,000 rows** (0 points)
- [ ] **10,000 - 100,000 rows** (3 points)
- [ ] **100,000 - 1,000,000 rows** (5 points)
- [ ] **> 1,000,000 rows** (10 points)

**Question 2.2:** Does the migration include a large data backfill?

- [ ] **No backfill needed** (0 points)
- [ ] **Small backfill** (<100K rows) (2 points)
- [ ] **Medium backfill** (100K-1M rows) (5 points)
- [ ] **Large backfill** (>1M rows) (10 points)

**Question 2.3:** Estimated migration execution time?

- [ ] **< 1 minute** (0 points)
- [ ] **1-5 minutes** (3 points)
- [ ] **5-15 minutes** (7 points)
- [ ] **> 15 minutes** (10 points)

**Section 2 Subtotal:** **\_** / 30 points

---

### Section 3: Schema Complexity

**Question 3.1:** Does the migration involve foreign key constraints?

- [ ] **No foreign keys** (0 points)
- [ ] **Adding foreign keys** (3 points)
- [ ] **Modifying foreign keys** (7 points)
- [ ] **Cascading deletes/updates** (10 points)

**Question 3.2:** Does the migration create indexes?

- [ ] **No indexes** (0 points)
- [ ] **Using CONCURRENTLY** (1 point)
- [ ] **Without CONCURRENTLY on small table** (<100K rows) (5 points)
- [ ] **Without CONCURRENTLY on large table** (>100K rows) (10 points)

**Question 3.3:** Does the migration alter table structure in a breaking way?

- [ ] **No structural changes** (0 points)
- [ ] **Adding nullable columns** (2 points)
- [ ] **Changing column types** (7 points)
- [ ] **Renaming/removing columns** (10 points)

**Section 3 Subtotal:** **\_** / 30 points

---

### Section 4: Testing and Validation

**Question 4.1:** Has the migration been tested on staging with production-like data?

- [ ] **Yes** - Tested on staging with >80% production data volume (0 points)
- [ ] **Partially** - Tested on staging with smaller dataset (5 points)
- [ ] **No** - Not tested on staging (10 points)

**Question 4.2:** Has a rollback been tested on staging?

- [ ] **Yes** - Rollback tested successfully (0 points)
- [ ] **Partially** - Rollback procedure documented but not tested (5 points)
- [ ] **No** - Rollback not prepared (10 points)

**Question 4.3:** Are there automated tests for the migration?

- [ ] **Yes** - Integration tests cover migration (0 points)
- [ ] **Partially** - Some manual testing done (3 points)
- [ ] **No** - No automated tests (5 points)

**Section 4 Subtotal:** **\_** / 25 points

---

### Section 5: Production Impact

**Question 5.1:** Will this migration require application downtime?

- [ ] **No** - Zero downtime migration (0 points)
- [ ] **Minimal** - <5 minutes downtime (5 points)
- [ ] **Moderate** - 5-15 minutes downtime (7 points)
- [ ] **Extended** - >15 minutes downtime (10 points)

**Question 5.2:** What is the blast radius if migration fails?

- [ ] **Low** - Single feature affected (2 points)
- [ ] **Medium** - Multiple features affected (5 points)
- [ ] **High** - Core functionality broken (10 points)
- [ ] **Critical** - Application unusable (15 points)

**Question 5.3:** When is the migration scheduled?

- [ ] **Low traffic period** - Off-peak hours (0 points)
- [ ] **Medium traffic** - Regular business hours (5 points)
- [ ] **Peak traffic** - Highest usage period (10 points)

**Section 5 Subtotal:** **\_** / 35 points

---

## Risk Score Calculation

**Total Risk Score:** **\_** / 150 points

### Risk Level Determination

| Score Range | Risk Level           | Migration Strategy Required                |
| ----------- | -------------------- | ------------------------------------------ |
| **0-30**    | 🟢 **Low Risk**      | Standard migration procedure               |
| **31-60**   | 🟡 **Medium Risk**   | Enhanced testing + monitoring              |
| **61-90**   | 🟠 **High Risk**     | Expand-contract pattern + staged rollout   |
| **91-150**  | 🔴 **Critical Risk** | Blue-green deployment + extensive planning |

---

## Mitigation Strategies by Risk Level

### 🟢 Low Risk (0-30 points)

**Requirements:**

- [ ] Test on local and staging
- [ ] Create manual backup before migration
- [ ] Standard monitoring during migration
- [ ] Document rollback procedure

**Approval:** Dev lead approval required

**Communication:** Engineering team notification

---

### 🟡 Medium Risk (31-60 points)

**Requirements:**

- [ ] All Low Risk requirements
- [ ] Peer review of migration code
- [ ] Integration tests for migration
- [ ] Extended monitoring period (24 hours)
- [ ] Detailed rollback procedure tested on staging
- [ ] Schedule during low-traffic period

**Approval:** Dev lead + DevOps approval required

**Communication:** Engineering + product team notification 24 hours in advance

---

### 🟠 High Risk (61-90 points)

**Requirements:**

- [ ] All Medium Risk requirements
- [ ] Use expand-contract pattern (see [Migration Patterns](../architecture/database-migration-patterns.md))
- [ ] Feature flags for gradual rollout
- [ ] Multiple staging tests with production data volume
- [ ] Incident response team on standby
- [ ] Post-migration monitoring for 48 hours
- [ ] Detailed communication plan

**Approval:** Dev lead + DevOps + Engineering manager approval required

**Communication:** All stakeholders notified 48 hours in advance

**Special Considerations:**

- Consider splitting into multiple smaller migrations
- Schedule during maintenance window
- Prepare detailed rollback plan

---

### 🔴 Critical Risk (91-150 points)

**Requirements:**

- [ ] All High Risk requirements
- [ ] Blue-green deployment or canary release
- [ ] Extensive load testing on staging
- [ ] Multiple peer reviews
- [ ] Executive approval for downtime (if any)
- [ ] War room during migration (all hands on deck)
- [ ] Customer support team briefed
- [ ] Post-mortem scheduled

**Approval:** Dev lead + DevOps + Engineering manager + CTO approval required

**Communication:** All stakeholders + customers notified 1 week in advance

**Special Considerations:**

- Strongly consider breaking into smaller migrations
- Schedule during extended maintenance window
- Rehearse migration multiple times on staging
- Have dedicated rollback team

---

## Decision Tree

```
                                       Start
                                         |
                            Is migration backward-compatible?
                             /                            \
                           Yes                            No
                            |                              |
                 Can rollback without data loss?   Use expand-contract pattern
                   /                  \                    |
                 Yes                  No          Does it affect >100K rows?
                  |                   |              /              \
         Is execution time >5min?  Medium Risk    Yes              No
            /            \             |            |                |
          Yes            No       Add safety      High           Medium
           |             |        measures        Risk            Risk
    Medium Risk      Low Risk                      |               |
                                            Follow high         Follow medium
                                            risk protocol      risk protocol
```

---

## Migration Strategy Selection

Based on your risk assessment, select the appropriate strategy:

### Strategy A: Direct Migration (Low Risk only)

**Use when:**

- Risk score < 30
- Adding new tables/columns only
- No data backfill required
- Backward-compatible

**Steps:**

1. Test on local and staging
2. Create backup
3. Apply migration
4. Verify schema changes
5. Monitor for 1 hour

---

### Strategy B: Batched Migration (Medium Risk)

**Use when:**

- Risk score 31-60
- Large data backfills required
- Indexes without CONCURRENTLY
- Some breaking changes

**Steps:**

1. All Strategy A steps
2. Break into smaller batches (if applicable)
3. Add throttling between batches
4. Extended monitoring (24 hours)
5. Gradual rollout via feature flags

---

### Strategy C: Expand-Contract (High Risk)

**Use when:**

- Risk score 61-90
- Renaming columns/tables
- Changing column types
- Splitting/merging tables

**Steps:**

1. Follow expand-contract pattern (see [Migration Patterns](../architecture/database-migration-patterns.md))
2. Phase 1: Expand (add new structures)
3. Phase 2: Migrate (dual-write, backfill, switch reads)
4. Phase 3: Contract (remove old structures)
5. Each phase deployed separately with monitoring

---

### Strategy D: Blue-Green Deployment (Critical Risk)

**Use when:**

- Risk score > 90
- Cannot achieve zero downtime with expand-contract
- Requires extensive database restructuring
- Affects critical business functionality

**Steps:**

1. Clone production database to "green" environment
2. Apply migrations to green database
3. Deploy new code to green environment
4. Test green environment thoroughly
5. Switch traffic to green
6. Monitor for issues (keep blue running for quick rollback)
7. Decommission blue after 48 hours stability

---

## Risk Mitigation Checklist

Use this checklist to reduce risk before migration:

### Pre-Migration Risk Reduction

- [ ] **Split large migrations** into smaller, incremental changes
- [ ] **Add indexes CONCURRENTLY** to avoid locks
- [ ] **Use nullable columns first**, make required later
- [ ] **Batch large data updates** to avoid long transactions
- [ ] **Add feature flags** for gradual rollout
- [ ] **Test on production-scale data** on staging
- [ ] **Prepare automated rollback** scripts
- [ ] **Schedule during low-traffic period**
- [ ] **Have incident response team ready**

### During Migration Monitoring

- [ ] **Watch error rates** (threshold: <5%)
- [ ] **Monitor response times** (threshold: p95 <1000ms)
- [ ] **Check database connections** (threshold: <80% pool)
- [ ] **Track database locks** (threshold: no locks >30s)
- [ ] **Monitor query performance** (compare to baseline)

### Post-Migration Validation

- [ ] **Verify schema changes** applied correctly
- [ ] **Run data integrity checks** (foreign keys, constraints)
- [ ] **Test critical workflows** manually
- [ ] **Check application logs** for errors
- [ ] **Monitor for 24-48 hours** post-migration

---

## Example Risk Assessment

### Example: Adding User Email Verification Column

**Migration SQL:**

```sql
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;
CREATE INDEX CONCURRENTLY idx_users_email_verified ON users(email_verified);
```

**Assessment:**

| Section   | Score | Reasoning                                      |
| --------- | ----- | ---------------------------------------------- |
| Section 1 | 0     | Backward-compatible, can rollback, adding only |
| Section 2 | 5     | 500K users, small backfill, <1 min execution   |
| Section 3 | 1     | Index with CONCURRENTLY                        |
| Section 4 | 0     | Tested on staging, rollback tested, has tests  |
| Section 5 | 0     | Zero downtime, low blast radius, off-peak      |
| **Total** | **6** | **🟢 Low Risk**                                |

**Strategy:** Direct migration with standard procedure

---

## Document Usage Log

Keep a log of risk assessments for historical reference:

| Date       | Migration          | Risk Score | Risk Level | Outcome                   |
| ---------- | ------------------ | ---------- | ---------- | ------------------------- |
| 2025-11-20 | Add email_verified | 6          | 🟢 Low     | Success                   |
| _Date_     | _Name_             | _Score_    | _Level_    | _Success/Rollback/Issues_ |

---

## References

- [Database Migration Runbook](database-migration-runbook.md)
- [Migration Patterns Documentation](../architecture/database-migration-patterns.md)
- [Migration Communication Template](../templates/migration-announcement-template.md)
- [Operations Runbook](../../infrastructure/OPERATIONS_RUNBOOK.md)

---

**Document Version History:**

| Version | Date       | Author    | Changes          |
| ------- | ---------- | --------- | ---------------- |
| 1.0     | 2025-11-20 | Dev Agent | Initial creation |
