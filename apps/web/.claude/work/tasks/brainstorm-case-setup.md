# Brainstorm: New Case Setup

**Status**: Complete
**Date**: 2026-01-01
**Next step**: `/research brainstorm-case-setup`

---

## Context

**Project**: bojin-law-ui - AI-powered legal case management UI
**Tech stack**: Next.js 16, TypeScript, Tailwind, Apollo GraphQL, Zustand
**Backend**: bojin-law-2 gateway at localhost:4000/graphql
**Related docs**: `.claude/docs/architecture.md`

### Current State

- Case/Client one-to-many relationship exists in backend
- Mobile case creation form exists but limited (no client autocomplete, no team assignment)
- Email integration 80% complete - UI built, mutations not wired
- CaseActor model exists but deemed overcomplicated for actual needs

---

## Problem Statement

Design a proper case setup flow that handles:

1. **Same client, multiple cases** - need clear identification without relying on court numbers or email subject discipline
2. **Email auto-classification** - route emails to correct case with minimal manual work
3. **Flexible billing** - fixed price (current) and hourly per-role (growing)
4. **Role-based access** - partners, leads, support, observers with different permissions

---

## Decisions

### 1. Client-First Email Hierarchy

Emails are organized under clients first, then cases:

```
Client "Popescu Ion"
├── Case "Divorț 2024"
│   └── [case emails]
├── Case "Litigiu comercial"
│   └── [case emails]
└── [Unclassified Emails] ← from this client, not yet assigned
```

**Rationale**: Simple mental model. Even if case can't be determined, at least emails land under the right client.

### 2. Simplified Classification Model

Replace complex `CaseActor` entity with email domains at case level:

```
Case
├── keywords[]              # "divorț", "succesiune", "contract X"
├── emailDomains[]          # All domains relevant to this case
│   ├── (client domains inherited)
│   ├── associates (notary, accountant)
│   └── opposing party
└── courtFileNumbers[]      # Multiple per case, for court email matching
```

**Classification priority**:

1. Court file number match → INSTANȚE
2. Case emailDomains/keywords match → assign to case
3. Client emailDomains match → client's unclassified folder
4. AI confidence suggestion → NECLAR (uncertain)
5. Otherwise → NEATRIBUIT (global unassigned)

**Conversation threading**: First email assignment propagates to entire thread.

### 3. Client Entity Fields

```typescript
interface Client {
  id: string;
  name: string;
  businessNames: string[]; // Aliases, trading names
  emailDomains: string[]; // For auto-classification
  phoneNumbers: string[];
  address: string | null;
}
```

**Rationale**: Email domains (not full contact persons) sufficient for classification. Business names handle aliases.

### 4. Case Setup Fields

**Required at creation**:
| Field | Notes |
|-------|-------|
| client | Autocomplete selector, can create inline |
| title | Descriptive name |
| type | From firm's configured types |
| description | Brief summary |

**Optional at creation (editable later)**:
| Field | Notes |
|-------|-------|
| courtFileNumbers[] | Multiple allowed |
| keywords[] | For email matching |
| emailDomains[] | Associates, opposing party |
| teamMembers[] | Lead/Support/Observer |
| billingType | Fixed \| Hourly |
| fixedAmount | EUR, if fixed billing |
| hourlyRates | Per role, defaults from global settings |
| estimatedValue | For reporting |

**Auto-generated**:

- caseNumber: format configured in global settings by partner

### 5. Role-Based Permissions

| Role     | Cases Visible | Financials  | Edit Case | Internal Notes |
| -------- | ------------- | ----------- | --------- | -------------- |
| Partner  | All           | Full access | Yes       | Read/Write     |
| Lead     | Assigned only | No access   | Yes       | Read/Write     |
| Support  | Assigned only | No access   | Limited   | Read/Write     |
| Observer | Assigned only | No access   | No        | Read/Write     |

**Visibility flow**:

- New case: visible to all partners (for oversight)
- After approval/team assignment: visible only to assigned team + partners

### 6. Billing Configuration

**Fixed price**:

- Single `fixedAmount` field in EUR

**Hourly billing**:

- Rates per role (partner, associate, paralegal, etc.)
- Defaults from global firm settings
- Overridable per case
- All amounts in EUR

**Time tracking**:

- Users log time per task
- Tasks belong to cases
- Billable hours calculated from task time entries

### 7. Case Number Format

Configurable by partner in global settings. Examples:

- `2024/001`
- `CIV-2024-001`
- `{type}-{year}-{seq}`

### 8. Team Assignment

- Creator does NOT auto-become Lead
- Explicit assignment required
- Partners notified of new cases
- Team can be assigned at creation or later

---

## Rationale

| Choice                       | Why                                                 |
| ---------------------------- | --------------------------------------------------- |
| Client-first hierarchy       | Mirrors lawyer mental model, reduces cognitive load |
| Email domains over CaseActor | Simpler to maintain, sufficient for classification  |
| Conversation threading       | Reduces manual classification work dramatically     |
| Optional billing at creation | Doesn't block case setup, can finalize later        |
| Partner-only financials      | Sensitive data, clear separation of concerns        |
| Global case number format    | Firm-wide consistency, partner control              |

---

## Open Questions for Research

- [ ] How should the client autocomplete work? Search as you type? Minimum characters?
- [ ] What's the best UX for adding multiple email domains/keywords during case setup?
- [ ] How to handle the transition from current CaseActor model to simplified emailDomains?
- [ ] Global settings schema for case number format and default hourly rates
- [ ] How does the existing approval workflow (submitForApproval) fit with the new visibility rules?
- [ ] What mutations need to be created/modified for the new client fields?
- [ ] How to wire up the existing email assignment UI (NeclarAssignmentBar) with actual handlers?

---

## Out of Scope (for now)

- Matter grouping (cases are independent)
- Full contact person management per client
- SMS/call integration
- Multi-language keyword matching

---

## Next Step

Start a new session and run:

```
/research brainstorm-case-setup
```

This will investigate the backend schema, existing mutations, and UI patterns to answer the open questions.
