# Seed Data Schema Documentation

## Overview

This document defines the structure and content of seed data for the Legal Platform development and testing environments.

## Law Firm Entity

**Count:** 1

```json
{
  "name": "Demo Law Firm S.R.L.",
  "address": "Strada Demo 123, Bucharest, Romania",
  "vat_id": "RO12345678",
  "email": "demo@lawfirm.ro",
  "phone": "+40-123-456-789",
  "website": "https://demo.lawfirm.ro"
}
```

## Sample Users

**Count:** 5 (1 Partner + 2 Associates + 2 Paralegals)

| ID  | Role      | First Name | Last Name  | Email                      | Azure AD ID      |
| --- | --------- | ---------- | ---------- | -------------------------- | ---------------- |
| 1   | Partner   | Alex       | Popescu    | partner@demo.lawfirm.ro    | aad-partner-demo |
| 2   | Associate | Maria      | Ionescu    | associate1@demo.lawfirm.ro | aad-assoc1-demo  |
| 3   | Associate | Ion        | Georgescu  | associate2@demo.lawfirm.ro | aad-assoc2-demo  |
| 4   | Paralegal | Elena      | Popa       | paralegal1@demo.lawfirm.ro | aad-para1-demo   |
| 5   | Paralegal | Mihai      | Dumitrescu | paralegal2@demo.lawfirm.ro | aad-para2-demo   |

**User Attributes:**

- All users: `is_active: true`, `created_at: NOW() - random(30-365 days)`
- Partner: `can_approve_documents: true`, `can_manage_cases: true`
- Associates: `can_approve_documents: false`, `can_manage_cases: true`
- Paralegals: `can_approve_documents: false`, `can_manage_cases: false`

## Sample Cases

**Count:** 10

### Case Distribution by Status:

- Active: 4 cases
- OnHold: 2 cases
- Closed: 2 cases
- Archived: 2 cases

### Case Distribution by Type:

Mix of all case types from enum:

- Civil: 3 cases
- Criminal: 2 cases
- Corporate: 2 cases
- Intellectual Property: 1 case
- Family: 1 case
- Labor: 1 case

### Case Template Structure:

```json
{
  "case_number": "CASE-2024-001",
  "title": "Contract Dispute - ABC Corp vs XYZ Ltd",
  "case_type": "Civil",
  "status": "Active",
  "client_id": "uuid",
  "assigned_partner_id": "uuid",
  "assigned_associate_id": "uuid",
  "description": "Contract dispute regarding delivery terms",
  "opened_date": "2024-01-15",
  "closed_date": null,
  "priority": "High",
  "court_name": "Bucharest Tribunal",
  "judge_name": "Judge Ion Vasilescu",
  "next_hearing_date": "2025-02-15"
}
```

### Sample Cases:

1. **CASE-2024-001**: Contract Dispute - ABC Corp vs XYZ Ltd (Civil, Active, High Priority)
2. **CASE-2024-002**: Patent Infringement Case (IP, Active, Critical Priority)
3. **CASE-2024-003**: Employment Termination Dispute (Labor, Active, Medium Priority)
4. **CASE-2024-004**: Corporate Merger Due Diligence (Corporate, Active, High Priority)
5. **CASE-2024-005**: Fraud Investigation (Criminal, OnHold, Critical Priority)
6. **CASE-2023-106**: Property Boundary Dispute (Civil, OnHold, Low Priority)
7. **CASE-2023-089**: Divorce Settlement (Family, Closed, Medium Priority)
8. **CASE-2023-054**: Contract Negotiation - Successful (Corporate, Closed, Low Priority)
9. **CASE-2022-231**: Assault Case - Convicted (Criminal, Archived, High Priority)
10. **CASE-2022-189**: Civil Suit - Settled (Civil, Archived, Medium Priority)

## Sample Documents

**Count:** 20

### Document Distribution by Type:

- Contract: 4 docs
- Pleading: 4 docs
- Motion: 3 docs
- Brief: 3 docs
- Evidence: 3 docs
- Correspondence: 2 docs
- Other: 1 doc

### Document Distribution by Status:

- Draft: 8 docs
- Review: 6 docs
- Approved: 4 docs
- Filed: 2 docs

### AI Generated Distribution:

- `ai_generated: true`: 10 docs (50%)
- `ai_generated: false`: 10 docs (50%)

### Document Template Structure:

```json
{
  "title": "Purchase Agreement - ABC Corp",
  "document_type": "Contract",
  "status": "Draft",
  "case_id": "uuid",
  "created_by_user_id": "uuid",
  "file_name": "purchase_agreement_abc_2024.pdf",
  "file_size_bytes": 245680,
  "mime_type": "application/pdf",
  "storage_url": "r2://legal-docs/2024/01/purchase_agreement_abc_2024.pdf",
  "version": 1,
  "ai_generated": false,
  "content_embedding": null,
  "created_at": "2024-01-20T10:00:00Z",
  "updated_at": "2024-01-20T10:00:00Z"
}
```

### Key Test Cases in Documents:

- Version history: 3 docs with multiple versions
- Large files: 2 docs > 5MB
- Small files: 2 docs < 100KB
- Various MIME types: PDF, DOCX, TXT
- Unicode filenames: 2 docs with Romanian characters
- Edge cases: Empty description, very long titles (>200 chars)

## Sample Tasks

**Count:** 30

### Task Distribution by Type:

- Research: 8 tasks
- DocumentCreation: 7 tasks
- DocumentReview: 5 tasks
- ClientCommunication: 4 tasks
- CourtFiling: 3 tasks
- CasePreparation: 3 tasks

### Task Distribution by Status:

- Pending: 12 tasks
- InProgress: 10 tasks
- Completed: 8 tasks

### Task Distribution by Due Date:

- Overdue (past): 5 tasks
- Due soon (next 7 days): 8 tasks
- Due later (7-30 days): 10 tasks
- Future (>30 days): 7 tasks

### Task Template Structure:

```json
{
  "title": "Draft purchase agreement for ABC Corp",
  "description": "Create initial draft of purchase agreement including standard clauses",
  "task_type": "DocumentCreation",
  "status": "InProgress",
  "priority": "High",
  "case_id": "uuid",
  "assigned_to_user_id": "uuid",
  "created_by_user_id": "uuid",
  "due_date": "2025-01-25",
  "estimated_hours": 4.0,
  "actual_hours": 2.5,
  "completed_at": null,
  "created_at": "2025-01-15T09:00:00Z",
  "updated_at": "2025-01-20T14:30:00Z"
}
```

### Task Assignment Distribution:

- Partner: 5 tasks (mostly review/approval)
- Associate 1: 10 tasks (mixed types)
- Associate 2: 8 tasks (research heavy)
- Paralegal 1: 12 tasks (document creation, filing)
- Paralegal 2: 10 tasks (research, client communication)
- Unassigned: 5 tasks

### Key Test Cases in Tasks:

- Overdue tasks: Test priority/alert systems
- Tasks with no estimated hours: Test time tracking
- Completed tasks: Test reporting/analytics
- Tasks across multiple cases: Test workload distribution
- Tasks with dependencies: Test workflow sequencing

## Edge Cases and Testing Scenarios

### Data Integrity Tests:

1. **Orphaned records**: Ensure all foreign keys reference existing records
2. **Circular dependencies**: No case → document → task → case loops
3. **Date consistency**: created_at < updated_at, opened_date < closed_date
4. **Enum validation**: All status/type fields use valid enum values
5. **NULL handling**: Optional fields properly handle NULL values

### Performance Tests:

1. **Large data volumes**: Cases with 50+ documents, 100+ tasks
2. **Deep nesting**: Cases with subcases, tasks with subtasks
3. **Complex queries**: Filter cases by multiple criteria
4. **Aggregations**: Count documents by type, sum hours by user

### Security Tests:

1. **Access control**: Users can only access their firm's data
2. **Role permissions**: Paralegals can't approve documents
3. **Audit trail**: All modifications logged with user ID and timestamp
4. **Data isolation**: Firm data not leaked across tenants

### Unicode and Localization:

1. **Romanian characters**: ă, â, î, ș, ț in names and addresses
2. **Date formats**: DD-MM-YYYY for Romanian locale
3. **Currency**: RON (Romanian Leu) in financial fields
4. **Phone numbers**: +40 prefix for Romanian numbers

## Idempotency Requirements

The seed script must be idempotent (safe to run multiple times):

1. **Check before insert**: Query for existing firm by VAT ID
2. **Upsert users**: Use email as unique key
3. **Skip if exists**: Don't duplicate cases with same case_number
4. **Transaction safety**: Wrap all operations in database transaction
5. **Rollback on error**: Revert all changes if any insertion fails

## UUID Generation Strategy

All primary keys use UUID v4:

```typescript
import { randomUUID } from 'crypto';

const firmId = randomUUID(); // e.g., "550e8400-e29b-41d4-a716-446655440000"
```

## Timestamp Generation

Use consistent timestamp generation:

```typescript
const now = new Date();
const pastDate = new Date(now.getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000);
```

## Mock Data Generators

For realistic test data:

1. **Names**: Use common Romanian names
2. **Addresses**: Use valid Bucharest street patterns
3. **Emails**: Use `@demo.lawfirm.ro` domain to avoid conflicts
4. **Phone numbers**: Use +40-123-xxx-xxx pattern (non-real)
5. **VAT IDs**: Use RO123456xx pattern (non-real)
6. **Case numbers**: Use CASE-YYYY-NNN pattern

## Execution Order

Critical order to maintain referential integrity:

1. Create Law Firm
2. Create Users (reference firm_id)
3. Create Cases (reference firm_id, partner_id, associate_id)
4. Create Documents (reference case_id, user_id)
5. Create Tasks (reference case_id, assigned_to_user_id, created_by_user_id)

## Cleanup Script

For resetting development database:

```sql
-- Delete in reverse order to maintain foreign key constraints
DELETE FROM tasks WHERE case_id IN (SELECT id FROM cases WHERE firm_id = 'demo-firm-uuid');
DELETE FROM documents WHERE case_id IN (SELECT id FROM cases WHERE firm_id = 'demo-firm-uuid');
DELETE FROM cases WHERE firm_id = 'demo-firm-uuid';
DELETE FROM users WHERE firm_id = 'demo-firm-uuid';
DELETE FROM firms WHERE vat_id = 'RO12345678';
```

## Validation Checklist

After running seed script, verify:

- [ ] Firm count: 1
- [ ] User count: 5
- [ ] Case count: 10
- [ ] Document count: 20
- [ ] Task count: 30
- [ ] All foreign keys valid (no NULL in required references)
- [ ] No duplicate case_numbers
- [ ] No duplicate user emails
- [ ] All enum values valid
- [ ] All timestamps reasonable (not in future)
- [ ] AI-generated documents: exactly 10
- [ ] Case status distribution: 4 Active, 2 OnHold, 2 Closed, 2 Archived
