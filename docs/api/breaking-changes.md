# Breaking Changes Process

> **Story 2.7:** API Documentation and Developer Portal

This document defines the process for proposing, communicating, and implementing breaking changes to the Legal Platform GraphQL API.

---

## Table of Contents

- [What is a Breaking Change?](#what-is-a-breaking-change)
- [Breaking Change Workflow](#breaking-change-workflow)
- [Communication Channels](#communication-channels)
- [Notification Timeline](#notification-timeline)
- [Change Log Format](#change-log-format)
- [Rollback Procedures](#rollback-procedures)
- [Developer Checklist](#developer-checklist)

---

## What is a Breaking Change?

A breaking change is any modification to the API that requires clients to update their code to continue functioning correctly.

### Breaking Change Examples

✅ **These ARE breaking changes:**

- Removing a field from a type
- Renaming a field or type
- Changing a field's type
- Making an optional field required
- Removing an enum value
- Changing argument types or requirements
- Removing a query or mutation
- Changing error response format

❌ **These are NOT breaking changes:**

- Adding a new optional field
- Adding a new type
- Adding a new query or mutation
- Adding a new enum value (with caveats)
- Making a required field optional
- Adding new optional arguments
- Adding more detailed error information
- Improving documentation

### Gray Areas

⚠️ **Potentially breaking (requires careful consideration):**

- Adding enum values (clients should handle unknown values)
- Changing performance characteristics significantly
- Modifying rate limits
- Changing authentication requirements
- Adding validation rules to existing fields

---

## Breaking Change Workflow

### Phase 1: Proposal (Weeks 1-2)

#### Step 1: Document the Proposal

Create a breaking change proposal document:

**Template: breaking-change-proposal.md**

```markdown
# Breaking Change Proposal: [Change Title]

## Metadata

- **Proposed By:** [Name]
- **Date:** [YYYY-MM-DD]
- **Target Version:** [e.g., v2.0.0]
- **Estimated Impact:** [Low/Medium/High]

## Summary

[1-2 sentence summary of the change]

## Motivation

[Why is this change necessary?]

## Current Behavior

[Describe current API behavior with examples]

## Proposed Behavior

[Describe new API behavior with examples]

## Breaking Change Details

[Specific fields/types/operations affected]

## Migration Path

[Step-by-step guide for clients to migrate]

## Estimated Impact

- Number of affected endpoints: [X]
- Estimated affected clients: [X]
- Estimated migration effort: [X hours/days]

## Alternatives Considered

[Other approaches and why they were rejected]

## Timeline

- Announcement: [Date]
- Deprecation: [Date]
- Removal: [Date] (minimum 6 months after deprecation)
```

#### Step 2: Internal Review

- **Technical Review:** Backend team evaluates feasibility
- **Product Review:** Product team assesses business impact
- **Security Review:** Security team evaluates security implications
- **Impact Assessment:** Analyze usage metrics for affected fields

**Review Checklist:**

- [ ] Is this change truly necessary?
- [ ] Have we considered non-breaking alternatives?
- [ ] Is the migration path clear?
- [ ] Is the timeline reasonable (6+ months)?
- [ ] Do we have metrics on current usage?

#### Step 3: Approval

Breaking changes require approval from:

- ✅ Backend Team Lead
- ✅ Product Owner
- ✅ API Governance Committee (if exists)

### Phase 2: Announcement (Week 3)

#### Step 1: Update Schema

Add `@deprecated` directive with clear migration path:

```graphql
type Case {
  """
  DEPRECATED: Use 'status' field instead.
  This field will be removed on 2026-06-01.

  Migration: Replace 'isActive' with 'status':
  - isActive: true → status: ACTIVE
  - isActive: false → status: CLOSED

  See: https://docs.legal-platform.com/api/migrations/isActive-to-status
  """
  isActive: Boolean
    @deprecated(
      reason: "Use 'status' field. Migration guide: https://docs.legal-platform.com/api/migrations/isActive-to-status. Removal date: 2026-06-01"
    )

  """
  Current status of the case
  """
  status: CaseStatus!
}
```

#### Step 2: Create Migration Guide

**Template: migrations/[field-name]-migration.md**

````markdown
# Migration Guide: isActive → status

## Overview

The `Case.isActive` field is deprecated and will be removed on 2026-06-01.

## Quick Migration

### Before

```graphql
query {
  case(id: "...") {
    isActive
  }
}
```
````

### After

```graphql
query {
  case(id: "...") {
    status
  }
}
```

## Field Mapping

| Old Value | New Value |
| --------- | --------- |
| `true`    | `ACTIVE`  |
| `false`   | `CLOSED`  |

## Code Examples

### JavaScript/TypeScript

```typescript
// Before
if (case.isActive) {
  // ...
}

// After
if (case.status === 'ACTIVE') {
  // ...
}
```

## Testing

[Test scenarios and expected results]

## Timeline

- **Deprecation:** 2025-12-01
- **Removal:** 2026-06-01

## Support

Questions? Contact api-support@legal-platform.com

```

#### Step 3: Communicate via All Channels

Send notifications via:
1. Email to all API consumers
2. Slack announcement in #api-updates
3. API documentation update
4. In-schema `@deprecated` directive
5. Blog post (for major changes)
6. Release notes

**Email Template:**

```

Subject: [ACTION REQUIRED] GraphQL API Breaking Change: Case.isActive Deprecation

Dear Legal Platform API Consumer,

We're announcing a breaking change to the Legal Platform GraphQL API.

**What's Changing:**
The `Case.isActive` field is being deprecated and will be removed on June 1, 2026.

**Why:**
The new `Case.status` field provides more granular case status tracking with
values: ACTIVE, ON_HOLD, CLOSED, and ARCHIVED.

**Action Required:**
Update your queries to use `Case.status` instead of `Case.isActive`.

**Migration Guide:**
https://docs.legal-platform.com/api/migrations/isActive-to-status

**Timeline:**

- December 1, 2025: Field deprecated (warning in schema)
- June 1, 2026: Field removed (6 months notice)

**Support:**
Contact api-support@legal-platform.com for migration assistance.

Thank you,
Legal Platform API Team

````

### Phase 3: Monitoring (Months 1-5)

#### Step 1: Track Usage

Monitor deprecated field usage:
- Log all requests using deprecated fields
- Generate weekly usage reports
- Identify teams still using deprecated fields

**Monitoring Query Example:**
```sql
SELECT
  user_firm,
  COUNT(*) as deprecated_field_uses,
  MAX(last_used_at) as last_use
FROM api_logs
WHERE query_contains_field = 'Case.isActive'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY user_firm
ORDER BY deprecated_field_uses DESC;
````

#### Step 2: Proactive Outreach

- **Week 4:** Send reminder to teams with >100 weekly uses
- **Week 8:** Personal outreach to high-usage teams
- **Week 12:** Offer migration support sessions
- **Week 20:** Final warning (30 days before removal)

### Phase 4: Final Warning (Month 6, Day -30)

**Final Notice Template:**

```
Subject: [URGENT] GraphQL API Breaking Change in 30 Days: Case.isActive Removal

Dear [Team Name],

This is a final reminder that the `Case.isActive` field will be removed
in 30 days on June 1, 2026.

**Current Status:**
Your team is still using this field in [X] queries per week.

**Immediate Action Required:**
Migrate to `Case.status` field before June 1, 2026.

**Affected Queries:**
[List of detected queries using the field]

**Migration Support:**
We're offering 1-on-1 migration support. Reply to this email to schedule.

**What Happens After June 1:**
Queries using `Case.isActive` will return GraphQL errors.

Migration Guide: https://docs.legal-platform.com/api/migrations/isActive-to-status

Urgent assistance: api-support@legal-platform.com

Legal Platform API Team
```

### Phase 5: Removal (Month 6+)

#### Step 1: Remove Field

```graphql
type Case {
  # isActive field REMOVED

  status: CaseStatus!
}
```

#### Step 2: Deploy with Monitoring

1. Deploy to staging environment
2. Run integration tests
3. Monitor for errors
4. Deploy to production during low-traffic window
5. Monitor production for 48 hours

#### Step 3: Update Documentation

- Update API documentation
- Update changelog
- Archive migration guides (keep for reference)
- Send completion announcement

**Completion Announcement:**

```
Subject: GraphQL API Update: Case.isActive Field Removed

The previously deprecated `Case.isActive` field has been removed as of
today (June 1, 2026).

All queries should now use `Case.status` instead.

If you experience issues, contact api-support@legal-platform.com.

Thank you for your cooperation during this migration.

Legal Platform API Team
```

---

## Communication Channels

### Primary Channels

1. **Email**
   - **To:** All registered API consumers
   - **When:** All breaking change announcements
   - **Format:** Plain text with links to docs

2. **Slack**
   - **Channel:** #api-updates
   - **When:** All announcements and reminders
   - **Format:** Markdown with @channel for urgent notices

3. **API Documentation**
   - **Location:** docs.legal-platform.com
   - **When:** Immediately upon announcement
   - **Content:** Migration guides, timelines

4. **In-Schema Warnings**
   - **Method:** `@deprecated` directive
   - **When:** From deprecation announcement
   - **Benefit:** Visible in GraphQL IDEs

### Secondary Channels

5. **Blog Posts**
   - **When:** Major API versions only
   - **Audience:** Public

6. **Release Notes**
   - **Location:** GitHub Releases
   - **When:** Every release
   - **Format:** Markdown changelog

7. **API Status Page**
   - **When:** During deployment of breaking changes
   - **Content:** Maintenance notices

---

## Notification Timeline

### Standard Timeline (6 Months)

| Week   | Action                  | Channel                         |
| ------ | ----------------------- | ------------------------------- |
| **0**  | Announce deprecation    | Email, Slack, Docs, Schema      |
| **4**  | First reminder          | Email to high-usage teams       |
| **8**  | Second reminder         | Slack, Email                    |
| **12** | Offer migration support | Email                           |
| **16** | Third reminder          | Email, Slack                    |
| **20** | Final warning (30 days) | Email (all), Slack (@channel)   |
| **24** | Removal deployed        | Email (completion), Slack, Blog |

### Expedited Timeline (3 Months for Critical Changes)

Only for security-critical changes. Requires executive approval.

| Week   | Action                                     |
| ------ | ------------------------------------------ |
| **0**  | Emergency announcement + migration support |
| **4**  | Reminder + direct support sessions         |
| **8**  | Final warning                              |
| **12** | Removal                                    |

---

## Change Log Format

### docs/api/CHANGELOG.md

```markdown
# API Changelog

## [Unreleased]

### Breaking Changes

- None

### Deprecated

- None

### Added

- New `Case.priority` field for case prioritization

### Changed

- Improved error messages for validation errors

### Fixed

- Fixed race condition in case assignment

## [2.0.0] - 2026-06-01

### Breaking Changes

- **REMOVED:** `Case.isActive` field (deprecated 2025-12-01)
  - Migration: Use `Case.status` instead
  - Guide: https://docs.legal-platform.com/api/migrations/isActive-to-status

### Added

- New `CaseStatus.ARCHIVED` enum value
- New `archiveCase` mutation

## [1.5.0] - 2026-03-01

### Deprecated

- `Case.isActive` field (removal: 2026-06-01)
  - Use `Case.status` instead

### Added

- New `Case.status` field with full lifecycle tracking

## [1.0.0] - 2025-11-21

### Added

- Initial GraphQL API release
- Case management queries and mutations
- Authentication via Azure AD OAuth 2.0
```

---

## Rollback Procedures

### When to Rollback

Rollback if:

- **Critical bugs** affecting >50% of users
- **Data corruption** or loss
- **Security vulnerabilities** introduced
- **Performance degradation** >2x slower
- **Unanticipated breaking changes** discovered

### Rollback Process

1. **Immediate Actions (0-15 minutes)**

   ```bash
   # Revert to previous deployment
   git revert <commit-hash>
   git push
   # Trigger emergency deployment
   ```

2. **Communication (15-30 minutes)**
   - Post to #api-updates: "API rollback in progress"
   - Email critical stakeholders
   - Update status page

3. **Post-Rollback (1-24 hours)**
   - Root cause analysis
   - Update tests to prevent recurrence
   - Revise migration timeline if needed
   - Communicate new timeline

### Rollback Checklist

- [ ] Database migrations rolled back (if any)
- [ ] Cache cleared
- [ ] Health checks passing
- [ ] Smoke tests passed
- [ ] Stakeholders notified
- [ ] Incident report filed

---

## Developer Checklist

### Before Proposing a Breaking Change

- [ ] Explored all non-breaking alternatives
- [ ] Documented clear migration path
- [ ] Assessed impact using metrics
- [ ] Prepared migration guide with examples
- [ ] Scheduled 6+ month timeline
- [ ] Obtained necessary approvals

### When Implementing a Breaking Change

- [ ] Added `@deprecated` directive to schema
- [ ] Created migration guide
- [ ] Updated API documentation
- [ ] Added monitoring for deprecated field usage
- [ ] Sent announcement via all channels
- [ ] Scheduled follow-up reminders
- [ ] Set up metrics dashboard

### Before Removing a Deprecated Field

- [ ] 6+ months have passed since deprecation
- [ ] All reminders sent per timeline
- [ ] Usage metrics reviewed (ideally 0 uses)
- [ ] Final warning sent 30 days prior
- [ ] Integration tests updated
- [ ] Rollback plan prepared
- [ ] Low-traffic deployment window scheduled

### After Removal

- [ ] Deployment successful
- [ ] No critical errors in logs
- [ ] Performance metrics normal
- [ ] Completion announcement sent
- [ ] Changelog updated
- [ ] Migration guide archived

---

## Examples

### Example 1: Field Removal

**Scenario:** Remove `Case.legacyId` field

**Timeline:**

- **2025-12-01:** Announce deprecation
- **2026-06-01:** Remove field

**Migration:**

```graphql
# Before
query {
  case(id: "...") {
    legacyId
  }
}

# After
query {
  case(id: "...") {
    id # Use standard UUID id instead
  }
}
```

### Example 2: Type Change

**Scenario:** Change `Case.value` from `Float` to `Money` type

**Migration:**

```graphql
# Before
type Case {
  value: Float
}

# After (Step 1: Add new field)
type Case {
  value: Float @deprecated(reason: "Use valueAmount field")
  valueAmount: Money # New structured type
}

# After (Step 2: Remove old field after 6 months)
type Case {
  valueAmount: Money
}
```

---

## Related Documentation

- **Versioning Strategy:** [versioning-strategy.md](./versioning-strategy.md)
- **API Documentation:** [README.md](./README.md)
- **Error Handling:** [error-handling.md](./error-handling.md)

---

**Last Updated:** 2025-11-21
**Story:** 2.7 - API Documentation and Developer Portal
**Maintained By:** Backend Team
