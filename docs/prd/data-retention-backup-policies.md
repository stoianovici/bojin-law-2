# Data Retention & Backup Policies

## Data Retention Requirements

**Legal Compliance Periods:**

- **Active Case Data:** Retained indefinitely while case is active
- **Closed Case Data:** 10 years from case closure date (Romanian Civil Code requirement)
- **Financial Records:** 10 years per Romanian accounting law
- **Client Communications:** 10 years from last interaction
- **Audit Logs:** 7 years for compliance and forensic purposes
- **System Logs:** 90 days for operational logs, 1 year for security logs
- **AI Training Data:** Anonymized and retained indefinitely for model improvement

**Data Categories & Retention:**

| Data Type        | Active Retention | Archive Period             | Purge After | Storage Location                  |
| ---------------- | ---------------- | -------------------------- | ----------- | --------------------------------- |
| Case Documents   | Indefinite       | 10 years post-closure      | 10 years    | Azure Blob (Hot) → Cool → Archive |
| Emails           | Indefinite       | 10 years post-case         | 10 years    | Exchange Online + Azure Blob      |
| Client Data      | Indefinite       | 10 years post-relationship | 10 years    | PostgreSQL + Blob                 |
| Time Entries     | Indefinite       | 10 years                   | 10 years    | PostgreSQL                        |
| Audit Trails     | 7 years          | N/A                        | 7 years     | PostgreSQL (partitioned)          |
| AI Conversations | 90 days          | 2 years (anonymized)       | 2 years     | PostgreSQL + Blob                 |
| User Sessions    | 30 days          | N/A                        | 30 days     | Redis → PostgreSQL                |

## Backup Strategy

**Backup Schedule:**

- **Real-time Replication:** PostgreSQL streaming replication to standby server
- **Incremental Backups:** Every 4 hours (6 daily backups)
- **Daily Snapshots:** Complete database and blob storage snapshots at 2 AM EET
- **Weekly Full Backups:** Sunday 3 AM EET with verification
- **Monthly Archives:** First Sunday of month, retained for 7 years

**Backup Storage:**

- **Primary:** Azure Backup vault in EU West (Amsterdam)
- **Secondary:** Cross-region replication to EU North (Stockholm)
- **Long-term:** Azure Archive Storage for monthly backups
- **Encryption:** AES-256 encryption for all backups at rest

**Recovery Objectives:**

- **Recovery Time Objective (RTO):** 4 hours for full system restore
- **Recovery Point Objective (RPO):** Maximum 4 hours data loss
- **Point-in-Time Recovery:** Any point within last 30 days
- **Archive Retrieval:** 24-48 hours for archived data

## Data Purge & Disposal

**Automatic Purge Process:**

1. **Notification:** 90 days before retention expiry, notify data owner
2. **Review Period:** 30-day grace period for retention extension requests
3. **Approval Workflow:** Partner-level approval required for purge
4. **Legal Hold Check:** Verify no active legal holds on data
5. **Purge Execution:** Secure deletion with DoD 5220.22-M standard
6. **Audit Trail:** Complete record of purged data maintained

**Manual Disposal Requests:**

- **Client Request:** GDPR right to erasure within 30 days
- **Validation:** Verify no legal obligations prevent deletion
- **Partial Deletion:** Anonymization where complete deletion not possible
- **Confirmation:** Written confirmation of deletion provided

## Disaster Recovery Plan

**Recovery Scenarios:**

1. **Single Service Failure:** Automatic failover to standby (< 1 minute)
2. **Database Corruption:** Restore from last clean backup (< 2 hours)
3. **Regional Outage:** Failover to secondary region (< 4 hours)
4. **Complete System Loss:** Full restore from backup (< 8 hours)
5. **Ransomware Attack:** Restore from immutable backups (< 6 hours)

**Testing Requirements:**

- **Monthly:** Backup restoration verification (sample data)
- **Quarterly:** Single service failover test
- **Annually:** Complete disaster recovery drill
- **Documentation:** Runbook maintained with step-by-step procedures
