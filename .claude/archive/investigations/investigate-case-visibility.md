# Investigation: Associate Users Cannot See Cases in /cases Page

**Slug**: case-visibility
**Date**: 2026-01-12
**Status**: Investigation Complete
**Severity**: High
**Next step**: `/debug case-visibility` to implement fix

---

## Bug Summary

**Reported symptom**: User bianca.iaici (role: Associate) can see email folders for 2 cases in the email sidebar but sees 0 cases on the `/cases` page. The user expects Associates to see all cases regardless of assignment.

**Reproduction steps**:

1. Log in as bianca.iaici@bojin-law.com (role: Associate)
2. Navigate to `/cases`
3. Observe: 0 cases displayed
4. Navigate to email section
5. Observe: 2 case folders visible in email sidebar

**Expected behavior**: Associates should be able to see all cases in the firm (per user requirement)

**Actual behavior**: Associates can only see cases they are explicitly assigned to via `case_team` table, but the email sidebar shows all cases

**Frequency**: Always - consistent behavior based on role logic

---

## Root Cause Analysis

### The Bug

**Root cause**: Inconsistent access control logic between the `cases` query and `emailsByCase` query. The `/cases` page uses role-based filtering that excludes non-Partners from seeing unassigned cases, while the email sidebar query shows all firm cases regardless of role.

**Location**: `services/gateway/src/graphql/resolvers/case.resolvers.ts:450-457`

**Code path**:

```
/cases page → GET_CASES query → cases resolver → role-based filtering → empty result for unassigned Associates
```

vs

```
Email sidebar → EMAIL_BY_CASE query → emailsByCase resolver → no role filtering → all cases shown
```

**Type**: Logic error / Access control inconsistency

### Why It Happens

The `cases` query resolver at line 450-457 explicitly filters cases based on user role:

```typescript
// Filter by assigned cases for non-Partners/BusinessOwners
if (args.assignedToMe || (user.role !== 'Partner' && user.role !== 'BusinessOwner')) {
  const assignments = await prisma.caseTeam.findMany({
    where: { userId: user.id },
    select: { caseId: true },
  });
  where.id = { in: assignments.map((a) => a.caseId) };
}
```

This means:

- **Partners/BusinessOwners**: See all cases in the firm
- **Associates/AssociateJr/Paralegals**: Only see cases they're assigned to via `case_team`

However, the `emailsByCase` resolver at line 1104-1107 uses a different approach:

```typescript
const allActiveCases = await prisma.case.findMany({
  where: {
    firmId: user.firmId,
    status: { in: [CaseStatus.Active, CaseStatus.PendingApproval] },
  },
  ...
});
```

This fetches **all active cases for the firm** without any role-based filtering.

### Database State

Verified data for bianca.iaici@bojin-law.com:

- **User ID**: `e3de464e-7864-48cb-a3ef-70012ab656d7`
- **Role**: `Associate`
- **Firm**: bojin-law
- **Case assignments in case_team**: 0 (not assigned to any cases)
- **Total cases in firm**: 2 ("Anulare incident plata CIP" and "Heliport\*")

### Why It Wasn't Caught

1. The two queries were likely developed at different times with different assumptions
2. No integration tests verify consistent access control across different views
3. The discrepancy only surfaces when a user has role-based restrictions but views the same data through different queries

---

## Impact Assessment

**Affected functionality**:

- `/cases` page - Shows incorrect (empty) results for Associates not assigned to cases
- Data inconsistency between case list and email sidebar

**Blast radius**: Moderate - affects all Associates who aren't explicitly assigned to cases

**Related code**:

- `services/gateway/src/graphql/resolvers/case.resolvers.ts`: Main cases query with role filtering
- `services/gateway/src/graphql/resolvers/email.resolvers.ts`: emailsByCase query without role filtering
- `apps/web/src/hooks/useCases.ts`: Frontend hook consuming cases query

**Risk of similar bugs**: Medium - other queries may have inconsistent access control patterns

---

## Proposed Fix Approaches

### Option A: Make Associates See All Cases (Match Email Behavior)

**Approach**: Remove the role-based filtering from the `cases` query so Associates can see all cases like Partners do. This matches the email sidebar behavior and the user's stated requirement.

**Files to change**:

- `services/gateway/src/graphql/resolvers/case.resolvers.ts`: Remove lines 450-457 or adjust the condition

**Change**:

```typescript
// BEFORE (line 450-457):
if (args.assignedToMe || (user.role !== 'Partner' && user.role !== 'BusinessOwner')) {
  const assignments = await prisma.caseTeam.findMany({
    where: { userId: user.id },
    select: { caseId: true },
  });
  where.id = { in: assignments.map((a) => a.caseId) };
}

// AFTER:
// Only filter when explicitly requested
if (args.assignedToMe) {
  const assignments = await prisma.caseTeam.findMany({
    where: { userId: user.id },
    select: { caseId: true },
  });
  where.id = { in: assignments.map((a) => a.caseId) };
}
```

**Pros**:

- Matches the user's stated requirement ("should be able to see all cases")
- Consistent with email sidebar behavior
- Simple change

**Cons**:

- Changes existing security model - verify this is the intended behavior
- May expose case data to users who shouldn't see it

**Risk**: Low (if user requirement is accurate)

### Option B: Add Role Filtering to Email Sidebar (Match Cases Behavior)

**Approach**: Add role-based filtering to `emailsByCase` query to match the `cases` query behavior.

**Files to change**:

- `services/gateway/src/graphql/resolvers/email.resolvers.ts`: Add role filtering around line 1104

**Pros**:

- Maintains stricter security model
- Both views are consistent

**Cons**:

- Email sidebar would also show empty for unassigned Associates
- May not match user's stated requirement

**Risk**: Low (if current case restriction is intentional)

### Option C: Assign bianca.iaici to Cases

**Approach**: Add the user to the `case_team` table for the relevant cases, rather than changing the access model.

**Files to change**: Database data only (no code changes)

**SQL**:

```sql
INSERT INTO case_team (id, case_id, user_id, role, assigned_by, created_at)
VALUES
  (gen_random_uuid(), '4b0df848-1553-4033-bcbb-cb27ed288c75', 'e3de464e-7864-48cb-a3ef-70012ab656d7', 'Support', 'e3de464e-7864-48cb-a3ef-70012ab656d7', NOW()),
  (gen_random_uuid(), '0c649438-99f4-41ea-8d5b-4022eb50f7a2', 'e3de464e-7864-48cb-a3ef-70012ab656d7', 'Support', 'e3de464e-7864-48cb-a3ef-70012ab656d7', NOW());
```

**Pros**:

- No code changes needed
- Maintains existing security model

**Cons**:

- Doesn't fix the underlying inconsistency
- New cases would still not be visible to unassigned Associates
- Band-aid fix

**Risk**: Low

### Recommendation

**Option A is recommended** based on the user's explicit statement that "in her role she should be able to see all cases, irrespective of her being assigned to those cases."

The current behavior appears to be overly restrictive for Associates. The email sidebar already shows all cases to Associates, suggesting the firm's intended policy is for Associates to have visibility into all cases. The `cases` query should be updated to match this policy.

However, **verify with the user** that Associates should truly see all cases. If the current restriction was intentional (e.g., for junior associates), Option B might be appropriate instead.

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] bianca.iaici can now see both cases on `/cases` page
2. [ ] Partners still see all cases (no regression)
3. [ ] `assignedToMe` filter still works correctly when requested
4. [ ] Email sidebar behavior is unchanged (still shows all cases)
5. [ ] Case detail pages remain accessible for Associates

### Suggested Test Cases

```typescript
// case.resolvers.test.ts
describe('cases query', () => {
  it('should return all firm cases for Associate users', async () => {
    // Test that Associate role sees all cases without assignment
  });

  it('should filter to assigned cases when assignedToMe is true', async () => {
    // Test the explicit filter works correctly
  });

  it('should return all firm cases for Partner users', async () => {
    // Test Partner sees all cases (no change)
  });
});
```

---

## Investigation Notes

### Files Examined

| File                           | Purpose                         | Relevant Finding                                            |
| ------------------------------ | ------------------------------- | ----------------------------------------------------------- |
| `case.resolvers.ts:450-457`    | Cases query resolver            | Role-based filtering restricts Associates to assigned cases |
| `email.resolvers.ts:1104-1129` | EmailsByCase resolver           | No role filtering, shows all firm cases                     |
| `useEmailsByCase.ts`           | Frontend hook for email sidebar | Consumes emailsByCase query                                 |
| `EmailCaseSidebar.tsx`         | Email sidebar component         | Displays cases from emailsByCase data                       |

### Database Queries Run

```sql
-- User details
SELECT id, email, role FROM users WHERE email ILIKE '%bianca%';
-- Result: Associate role

-- Case assignments
SELECT * FROM case_team WHERE user_id = 'e3de464e-...';
-- Result: 0 rows (not assigned to any cases)

-- Firm cases
SELECT id, title FROM cases;
-- Result: 2 cases exist
```

### Questions Answered During Investigation

- Q: What role does bianca.iaici have?
- A: Associate (not Partner or BusinessOwner)

- Q: Is she assigned to any cases?
- A: No - 0 entries in case_team table for her user ID

- Q: Why can she see email folders but not cases?
- A: The emailsByCase query doesn't have role-based filtering, while the cases query does

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug case-visibility
```

The debug phase will:

1. Read this investigation document
2. Propose the specific implementation (likely Option A)
3. Get approval before making changes
4. Implement and verify the fix
