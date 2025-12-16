# Case Management API

**Story 2.6**: Case Management Data Model and API

This document describes the GraphQL API for managing legal cases, clients, case teams, and case actors (external parties).

> **💡 Looking for interactive examples?** See the [Playground Guide](./playground-guide.md) for hands-on query/mutation examples with variables, real-world scenarios, and error handling patterns.

## Table of Contents

- [Overview](#overview)
- [Data Models](#data-models)
- [Queries](#queries)
- [Mutations](#mutations)
- [Authorization](#authorization)
- [Examples](#examples)
- [Error Handling](#error-handling)

## Overview

The Case Management API provides comprehensive GraphQL operations for:

- **Cases**: Legal cases with status tracking, team assignments, and metadata
- **Clients**: Firm's client relationships
- **Case Teams**: User assignments to cases with roles (Lead, Support, Observer)
- **Case Actors**: External parties involved in cases (clients, opposing parties, counsel, witnesses, experts)
- **Audit Logging**: Automatic tracking of all case modifications

## Data Models

### Enums

#### CaseStatus

- `ACTIVE` - Case is currently being worked on
- `ON_HOLD` - Case is temporarily paused
- `CLOSED` - Case has been concluded
- `ARCHIVED` - Case is closed and archived for long-term storage

#### CaseType

- `LITIGATION` - Court litigation cases
- `CONTRACT` - Contract review and drafting
- `ADVISORY` - Legal advisory and consulting
- `CRIMINAL` - Criminal defense cases
- `OTHER` - Other types of legal matters

#### CaseActorRole (Romanian legal context)

- `CLIENT` - The client in this specific case
- `OPPOSING_PARTY` - The opposing party (partea adversă)
- `OPPOSING_COUNSEL` - Opposing counsel/lawyer (avocatul părții adverse)
- `WITNESS` - Witness to be called (martor)
- `EXPERT` - Expert witness or consultant (expert)

### Types

#### Client

```graphql
type Client {
  id: UUID!
  firmId: UUID!
  name: String!
  contactInfo: JSON
  address: String
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

#### Case

```graphql
type Case {
  id: UUID!
  firmId: UUID!
  caseNumber: String!
  title: String!
  client: Client!
  status: CaseStatus!
  type: CaseType!
  description: String!
  openedDate: DateTime!
  closedDate: DateTime
  value: Float
  metadata: JSON
  teamMembers: [User!]!
  actors: [CaseActor!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

#### CaseTeam

```graphql
type CaseTeam {
  id: UUID!
  caseId: UUID!
  userId: UUID!
  user: User!
  role: String!
  assignedAt: DateTime!
  assignedBy: UUID
}
```

#### CaseActor

```graphql
type CaseActor {
  id: UUID!
  caseId: UUID!
  role: CaseActorRole!
  name: String!
  organization: String
  email: String
  phone: String
  address: String
  notes: String
  createdAt: DateTime!
  updatedAt: DateTime!
  createdBy: UUID!
}
```

## Queries

### cases

Get multiple cases with optional filters.

**Authorization**: Partners see all cases, Associates/Paralegals see only assigned cases

```graphql
query {
  cases(
    status: CaseStatus
    clientId: UUID
    assignedToMe: Boolean
  ): [Case!]!
}
```

**Example**:

```graphql
query GetActiveCases {
  cases(status: ACTIVE) {
    id
    caseNumber
    title
    status
    client {
      name
    }
    teamMembers {
      firstName
      lastName
    }
  }
}
```

### case

Get a single case by ID.

**Authorization**: User must be assigned to case OR be a Partner

**Returns**: `Case` if found and authorized, `null` otherwise

```graphql
query {
  case(id: UUID!): Case
}
```

**Example**:

```graphql
query GetCase {
  case(id: "550e8400-e29b-41d4-a716-446655440000") {
    id
    caseNumber
    title
    description
    status
    type
    client {
      name
      contactInfo
    }
    teamMembers {
      id
      firstName
      lastName
      role
    }
    actors {
      id
      role
      name
      email
    }
  }
}
```

### searchCases

Full-text search across case title, description, and client name.

**Authorization**: Respects case access rules (Partners see all, others see assigned only)

**Minimum query length**: 3 characters

```graphql
query {
  searchCases(
    query: String!
    limit: Int # default 50, max 100
  ): [Case!]!
}
```

**Example**:

```graphql
query SearchCases {
  searchCases(query: "contract dispute", limit: 10) {
    id
    caseNumber
    title
    status
    client {
      name
    }
  }
}
```

### caseActors

Get all actors for a specific case.

**Authorization**: User must be assigned to case OR be a Partner

```graphql
query {
  caseActors(caseId: UUID!): [CaseActor!]!
}
```

**Example**:

```graphql
query GetCaseActors {
  caseActors(caseId: "550e8400-e29b-41d4-a716-446655440000") {
    id
    role
    name
    organization
    email
    phone
    notes
  }
}
```

### caseActorsByRole

Get actors for a case filtered by role.

**Authorization**: User must be assigned to case OR be a Partner

```graphql
query {
  caseActorsByRole(
    caseId: UUID!
    role: CaseActorRole!
  ): [CaseActor!]!
}
```

**Example**:

```graphql
query GetWitnesses {
  caseActorsByRole(caseId: "550e8400-e29b-41d4-a716-446655440000", role: WITNESS) {
    id
    name
    email
    phone
    notes
  }
}
```

## Mutations

### createCase

Create a new case.

**Side effects**: Assigns creator to case team as "Lead", creates audit log entry

**Authorization**: Authenticated users can create cases

```graphql
mutation {
  createCase(input: CreateCaseInput!): Case!
}

input CreateCaseInput {
  title: String! # 3-500 characters
  clientId: UUID!
  type: CaseType!
  description: String! # minimum 10 characters
  value: Float
  metadata: JSON
}
```

**Example**:

```graphql
mutation CreateNewCase {
  createCase(
    input: {
      title: "Contract Dispute - ABC Corp vs XYZ Ltd"
      clientId: "550e8400-e29b-41d4-a716-446655440000"
      type: LITIGATION
      description: "Contract dispute regarding delivery terms and payment schedule"
      value: 150000.50
      metadata: { courtName: "Bucharest Tribunal", urgency: "high" }
    }
  ) {
    id
    caseNumber
    title
    status
  }
}
```

### updateCase

Update an existing case.

**Side effects**: Creates audit log entry for each changed field

**Authorization**: User must be on case team OR be a Partner

```graphql
mutation {
  updateCase(
    id: UUID!
    input: UpdateCaseInput!
  ): Case!
}

input UpdateCaseInput {
  title: String # 3-500 characters if provided
  status: CaseStatus
  type: CaseType
  description: String
  closedDate: DateTime
  value: Float
  metadata: JSON
}
```

**Example**:

```graphql
mutation UpdateCaseStatus {
  updateCase(
    id: "550e8400-e29b-41d4-a716-446655440000"
    input: { status: CLOSED, closedDate: "2025-02-15T10:00:00Z" }
  ) {
    id
    status
    closedDate
  }
}
```

### archiveCase

Archive a case (sets status to ARCHIVED).

**Side effects**: Sets closedDate to current date, creates audit log entry

**Authorization**: Partner role required

**Restriction**: Can only archive cases with status CLOSED

```graphql
mutation {
  archiveCase(id: UUID!): Case!
}
```

**Example**:

```graphql
mutation ArchiveCase {
  archiveCase(id: "550e8400-e29b-41d4-a716-446655440000") {
    id
    status
    closedDate
  }
}
```

### assignTeam

Assign a user to a case team.

**Side effects**: Creates case team record, creates audit log entry

**Authorization**: User must be on case team OR be a Partner

```graphql
mutation {
  assignTeam(input: AssignTeamInput!): CaseTeam!
}

input AssignTeamInput {
  caseId: UUID!
  userId: UUID!
  role: String! # "Lead", "Support", "Observer", etc.
}
```

**Example**:

```graphql
mutation AssignTeamMember {
  assignTeam(
    input: {
      caseId: "550e8400-e29b-41d4-a716-446655440000"
      userId: "660e8400-e29b-41d4-a716-446655440001"
      role: "Support"
    }
  ) {
    id
    user {
      firstName
      lastName
    }
    role
    assignedAt
  }
}
```

### removeTeamMember

Remove a user from a case team.

**Side effects**: Deletes case team record, creates audit log entry

**Authorization**: User must be on case team OR be a Partner

```graphql
mutation {
  removeTeamMember(
    caseId: UUID!
    userId: UUID!
  ): Boolean!
}
```

### addCaseActor

Add an external actor to a case.

**Side effects**: Creates case actor record, creates audit log entry

**Authorization**: User must be on case team OR be a Partner

```graphql
mutation {
  addCaseActor(input: AddCaseActorInput!): CaseActor!
}

input AddCaseActorInput {
  caseId: UUID!
  role: CaseActorRole!
  name: String! # 2-200 characters
  organization: String
  email: String
  phone: String
  address: String
  notes: String
}
```

**Example**:

```graphql
mutation AddWitness {
  addCaseActor(
    input: {
      caseId: "550e8400-e29b-41d4-a716-446655440000"
      role: WITNESS
      name: "Elena Radu"
      email: "elena.radu@email.ro"
      phone: "+40-733-222-111"
      notes: "Key witness - former employee"
    }
  ) {
    id
    role
    name
    email
  }
}
```

### updateCaseActor

Update an existing case actor.

**Side effects**: Updates case actor record, creates audit log for changed fields

**Authorization**: User must be on case team OR be a Partner

```graphql
mutation {
  updateCaseActor(
    id: UUID!
    input: UpdateCaseActorInput!
  ): CaseActor!
}

input UpdateCaseActorInput {
  name: String # 2-200 characters if provided
  organization: String
  email: String
  phone: String
  address: String
  notes: String
}
```

### removeCaseActor

Remove an actor from a case.

**Side effects**: Deletes case actor record, creates audit log entry

**Authorization**: User must be on case team OR be a Partner

```graphql
mutation {
  removeCaseActor(id: UUID!): Boolean!
}
```

## Authorization

### Role-Based Access Control (RBAC)

#### Partner Role

- Can access ALL cases in their firm (no restrictions)
- Can create, update, archive any case
- Can assign/remove any user to/from case teams
- Can manage case actors

#### Associate Role

- Can only access cases they are assigned to via CaseTeam
- Can update cases they are assigned to
- Cannot archive cases (Partner only)
- Can assign users to cases they are on
- Can manage case actors on assigned cases

#### Paralegal Role

- Can only access cases they are assigned to via CaseTeam
- Can update cases they are assigned to
- Cannot archive cases (Partner only)
- Cannot assign users to cases
- Can manage case actors on assigned cases

### Authorization Errors

- `UNAUTHENTICATED` - User is not authenticated
- `FORBIDDEN` - User is authenticated but not authorized for this operation
- `NOT_FOUND` - Resource not found (or user is not authorized to know it exists)

## Examples

### Complete Case Management Workflow

```graphql
# 1. Create a new case
mutation CreateCase {
  createCase(
    input: {
      title: "Employment Dispute - Wrongful Termination"
      clientId: "550e8400-e29b-41d4-a716-446655440000"
      type: LITIGATION
      description: "Employee claims wrongful termination and seeks damages"
      value: 85000.00
    }
  ) {
    id
    caseNumber
  }
}

# 2. Assign team members
mutation AssignAssociate {
  assignTeam(input: { caseId: "new-case-id", userId: "associate-user-id", role: "Support" }) {
    id
    role
  }
}

# 3. Add case actors
mutation AddOpposingParty {
  addCaseActor(
    input: {
      caseId: "new-case-id"
      role: OPPOSING_PARTY
      name: "Former Employee Name"
      email: "former@email.ro"
      phone: "+40-722-111-222"
    }
  ) {
    id
    name
  }
}

mutation AddOpposingCounsel {
  addCaseActor(
    input: {
      caseId: "new-case-id"
      role: OPPOSING_COUNSEL
      name: "Opposing Law Firm"
      organization: "Law Firm SRL"
      email: "legal@lawfirm.ro"
      phone: "+40-21-555-7777"
    }
  ) {
    id
    name
  }
}

# 4. Add witnesses
mutation AddWitness {
  addCaseActor(
    input: {
      caseId: "new-case-id"
      role: WITNESS
      name: "Coworker Name"
      email: "witness@email.ro"
      notes: "Witnessed termination discussion"
    }
  ) {
    id
  }
}

# 5. Update case status as it progresses
mutation UpdateStatus {
  updateCase(id: "new-case-id", input: { status: CLOSED }) {
    id
    status
  }
}

# 6. Archive when finalized (Partner only)
mutation Archive {
  archiveCase(id: "new-case-id") {
    id
    status
  }
}
```

## Error Handling

### Common Errors

#### BAD_USER_INPUT

- Invalid input validation (title length, description length, etc.)
- Invalid status transitions (e.g., cannot reopen archived case)
- Search query too short (minimum 3 characters)

#### NOT_FOUND

- Case not found
- Client not found
- User not found
- Case actor not found

#### FORBIDDEN

- User not authorized to access case
- User not authorized to perform operation (e.g., non-Partner trying to archive)
- User not on case team

#### UNAUTHENTICATED

- No authentication token provided
- Invalid or expired authentication token

### Error Response Example

```json
{
  "errors": [
    {
      "message": "Not authorized to update this case",
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ]
}
```

## Audit Logging

All case modifications are automatically logged to the `CaseAuditLog` table with:

- Action type (CREATED, UPDATED, ARCHIVED, TEAM_ASSIGNED, etc.)
- User ID (who made the change)
- Timestamp
- Field-level changes (fieldName, oldValue, newValue)

Audit logs are never deleted and provide a complete history of case modifications.

## Full-Text Search

The search functionality uses PostgreSQL's `pg_trgm` extension for fuzzy text matching:

- Searches across case title, description, and client name
- Results ordered by relevance (similarity score)
- Minimum similarity threshold: 0.3 (30% match)
- Minimum query length: 3 characters
- Respects user authorization rules

**Performance**: Search queries complete in <200ms for 1000+ cases with proper GIN indexes.

---

**For more information**, see:

- [Architecture Documentation](../architecture/api-specification.md)
- [Data Models](../architecture/data-models.md)
- [Testing Strategy](../architecture/testing-strategy.md)
