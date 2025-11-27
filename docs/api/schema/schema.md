# GraphQL API Schema Documentation

> **Auto-generated documentation** from GraphQL schema files
> Last updated: 2025-11-21T08:36:33.434Z

---

## Table of Contents

- [Overview](#overview)
- [Scalars](#scalars)
- [Enums](#enums)
- [Types](#types)
- [Input Types](#input-types)
- [Queries](#queries)
- [Mutations](#mutations)
- [Full Schema SDL](#full-schema-sdl)

---

## Overview

This document provides comprehensive documentation for the Legal Platform GraphQL API.
The API uses GraphQL for flexible data fetching and includes built-in authentication
and authorization controls.

**Key Features:**
- 🔐 Authentication via Azure AD OAuth 2.0
- 🏢 Multi-tenant firm isolation
- 📝 Comprehensive audit logging
- 🔍 Full-text search capabilities
- ⚡ Real-time introspection in development

---

## Scalars

Custom scalar types used in the API.

### String

The `String` scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text.

### Float

The `Float` scalar type represents signed double-precision fractional values as specified by [IEEE 754](https://en.wikipedia.org/wiki/IEEE_floating_point).

### Boolean

The `Boolean` scalar type represents `true` or `false`.

### Int

The `Int` scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1.

### DateTime

Date and time scalar type conforming to ISO 8601 format
Example: 2025-01-15T10:30:00Z

### UUID

UUID scalar type conforming to RFC 4122
Example: 550e8400-e29b-41d4-a716-446655440000

### JSON

Arbitrary JSON data scalar type
Example: {"key": "value", "nested": {"data": 123}}

---

## Enums

Enumeration types representing fixed sets of values.

### CaseStatus

Case status lifecycle enum
- ACTIVE: Case is currently being worked on
- ON_HOLD: Case is temporarily paused
- CLOSED: Case has been concluded
- ARCHIVED: Case is closed and archived for long-term storage

**Values:**

- `ACTIVE`
- `ON_HOLD`
- `CLOSED`
- `ARCHIVED`

### CaseType

Case type categorization enum
- LITIGATION: Court litigation cases
- CONTRACT: Contract review and drafting
- ADVISORY: Legal advisory and consulting
- CRIMINAL: Criminal defense cases
- OTHER: Other types of legal matters

**Values:**

- `LITIGATION`
- `CONTRACT`
- `ADVISORY`
- `CRIMINAL`
- `OTHER`

### CaseActorRole

External party roles in a case (Romanian legal context)
- CLIENT: The client in this specific case
- OPPOSING_PARTY: The opposing party (partea adversă)
- OPPOSING_COUNSEL: Opposing counsel/lawyer (avocatul părții adverse)
- WITNESS: Witness to be called (martor)
- EXPERT: Expert witness or consultant (expert)

**Values:**

- `CLIENT`
- `OPPOSING_PARTY`
- `OPPOSING_COUNSEL`
- `WITNESS`
- `EXPERT`

### UserRole

User roles within the law firm
- PARTNER: Firm partner with full access
- ASSOCIATE: Associate lawyer with limited access
- PARALEGAL: Paralegal with task-specific access

**Values:**

- `PARTNER`
- `ASSOCIATE`
- `PARALEGAL`

---

## Types

Object types representing entities in the system.

### User

User type represents a lawyer or staff member at the firm

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `UUID!` | Unique identifier for the user |
| `firmId` | `UUID` | Firm the user belongs to (null for system users) |
| `email` | `String!` | User's email address (used for authentication) |
| `firstName` | `String!` | User's first name |
| `lastName` | `String!` | User's last name |
| `role` | `UserRole!` | User's role within the firm |
| `createdAt` | `DateTime!` | Timestamp when the user was created |

### Client

Client entity - represents the firm's client relationships

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `UUID!` | Unique identifier for the client |
| `firmId` | `UUID!` | Firm that manages this client |
| `name` | `String!` | Client's full name or organization name |
| `contactInfo` | `JSON` | Contact information as JSON (phone, email, etc.) |
| `address` | `String` | Physical address of the client |
| `createdAt` | `DateTime!` | Timestamp when the client record was created |
| `updatedAt` | `DateTime!` | Timestamp when the client record was last updated |

### Case

Case entity - represents legal cases managed by the firm

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `UUID!` | Unique identifier for the case |
| `firmId` | `UUID!` | Firm that manages this case |
| `caseNumber` | `String!` | Unique case number for tracking (auto-generated) |
| `title` | `String!` | Title or name of the case |
| `client` | `Client!` | Client associated with this case |
| `status` | `CaseStatus!` | Current status of the case |
| `type` | `CaseType!` | Type of legal case |
| `description` | `String!` | Detailed description of the case |
| `openedDate` | `DateTime!` | Date when the case was opened |
| `closedDate` | `DateTime` | Date when the case was closed (null if still open) |
| `value` | `Float` | Monetary value of the case (optional) |
| `metadata` | `JSON` | Additional case metadata as JSON (optional) |
| `teamMembers` | `[User!]!` | List of team members assigned to this case |
| `actors` | `[CaseActor!]!` | List of external actors involved in this case |
| `createdAt` | `DateTime!` | Timestamp when the case was created |
| `updatedAt` | `DateTime!` | Timestamp when the case was last updated |

### CaseTeam

Case team assignment - represents user assignments to cases

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `UUID!` | Unique identifier for the case team assignment |
| `caseId` | `UUID!` | Case this assignment belongs to |
| `userId` | `UUID!` | User assigned to the case |
| `user` | `User!` | User object for the assigned user |
| `role` | `String!` | Role of the user on the case team (e.g., Lead, Support, Observer) |
| `assignedAt` | `DateTime!` | Timestamp when the user was assigned to the case |
| `assignedBy` | `UUID` | ID of the user who created this assignment (optional) |

### CaseActor

Case actor - represents external parties involved in a case
These are people/entities external to the firm (clients, opposing parties, witnesses, etc.)

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `UUID!` | Unique identifier for the case actor |
| `caseId` | `UUID!` | Case this actor is involved in |
| `role` | `CaseActorRole!` | Role of the actor in the case |
| `name` | `String!` | Full name of the actor |
| `organization` | `String` | Organization or company the actor represents (optional) |
| `email` | `String` | Email address of the actor (optional) |
| `phone` | `String` | Phone number of the actor (optional) |
| `address` | `String` | Physical address of the actor (optional) |
| `notes` | `String` | Additional notes about this actor (optional) |
| `createdAt` | `DateTime!` | Timestamp when the actor was added to the case |
| `updatedAt` | `DateTime!` | Timestamp when the actor information was last updated |
| `createdBy` | `UUID!` | ID of the user who added this actor |

---

## Input Types

Input types used for mutations and complex query arguments.

### CreateCaseInput

Input for creating a new case

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `title` | `String!` | Title of the case (3-500 characters) |
| `clientId` | `UUID!` | Client ID - must reference an existing client |
| `type` | `CaseType!` | Type of case |
| `description` | `String!` | Detailed description of the case (minimum 10 characters) |
| `value` | `Float` | Monetary value of the case (optional) |
| `metadata` | `JSON` | Additional metadata as JSON (optional) |

### UpdateCaseInput

Input for updating an existing case
All fields are optional - only provided fields will be updated

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `title` | `String` | Updated title (3-500 characters if provided) |
| `status` | `CaseStatus` | Updated status |
| `type` | `CaseType` | Updated case type |
| `description` | `String` | Updated description |
| `closedDate` | `DateTime` | Case closure date |
| `value` | `Float` | Updated monetary value |
| `metadata` | `JSON` | Updated metadata |

### AssignTeamInput

Input for assigning a user to a case team

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `caseId` | `UUID!` | Case ID |
| `userId` | `UUID!` | User ID to assign |
| `role` | `String!` | Role of the user on the case team (e.g., Lead, Support, Observer) |

### AddCaseActorInput

Input for adding an external actor to a case

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `caseId` | `UUID!` | Case ID |
| `role` | `CaseActorRole!` | Role of the actor in the case |
| `name` | `String!` | Name of the actor (2-200 characters) |
| `organization` | `String` | Organization/company name (optional) |
| `email` | `String` | Email address (optional) |
| `phone` | `String` | Phone number (optional) |
| `address` | `String` | Physical address (optional) |
| `notes` | `String` | Additional notes about this actor (optional) |

### UpdateCaseActorInput

Input for updating a case actor
All fields are optional - only provided fields will be updated

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Updated name (2-200 characters if provided) |
| `organization` | `String` | Updated organization |
| `email` | `String` | Updated email |
| `phone` | `String` | Updated phone |
| `address` | `String` | Updated address |
| `notes` | `String` | Updated notes |

---

## Queries

Available query operations for fetching data.

### cases

Get multiple cases with optional filters
Authorization: Partners see all cases, Associates/Paralegals see only assigned cases

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `status` | `CaseStatus` | Filter by case status |
| `clientId` | `UUID` | Filter by client ID |
| `assignedToMe` | `Boolean` | Filter to cases assigned to the current user |

**Returns:** `[Case!]!`

### case

Get a single case by ID
Returns null if case not found or user is not authorized to view it
Authorization: User must be assigned to case OR be a Partner

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `id` | `UUID!` | - |

**Returns:** `Case`

### searchCases

Full-text search across case title, description, and client name
Returns results ordered by relevance
Authorization: Respects case access rules (Partners see all, others see assigned only)

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `query` | `String!` | Search query (minimum 3 characters) |
| `limit` | `Int` | Maximum number of results (default 50, max 100) |

**Returns:** `[Case!]!`

### caseActors

Get all actors for a specific case
Authorization: User must be assigned to case OR be a Partner

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `caseId` | `UUID!` | - |

**Returns:** `[CaseActor!]!`

### caseActorsByRole

Get actors for a case filtered by role
Authorization: User must be assigned to case OR be a Partner

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `caseId` | `UUID!` | - |
| `role` | `CaseActorRole!` | - |

**Returns:** `[CaseActor!]!`

---

## Mutations

Available mutation operations for modifying data.

### createCase

Create a new case
Side effects: Assigns creator to case team as "Lead", creates audit log entry
Authorization: Authenticated users can create cases

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `input` | `CreateCaseInput!` | - |

**Returns:** `Case!`

### updateCase

Update an existing case
Side effects: Creates audit log entry for each changed field
Authorization: User must be on case team OR be a Partner

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `id` | `UUID!` | - |
| `input` | `UpdateCaseInput!` | - |

**Returns:** `Case!`

### archiveCase

Archive a case (sets status to ARCHIVED)
Side effects: Sets closedDate to current date, creates audit log entry
Authorization: Partner role required

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `id` | `UUID!` | - |

**Returns:** `Case!`

### assignTeam

Assign a user to a case team
Side effects: Creates case team record, creates audit log entry
Authorization: User must be on case team OR be a Partner

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `input` | `AssignTeamInput!` | - |

**Returns:** `CaseTeam!`

### removeTeamMember

Remove a user from a case team
Side effects: Deletes case team record, creates audit log entry
Authorization: User must be on case team OR be a Partner

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `caseId` | `UUID!` | - |
| `userId` | `UUID!` | - |

**Returns:** `Boolean!`

### addCaseActor

Add an external actor to a case
Side effects: Creates case actor record, creates audit log entry
Authorization: User must be on case team OR be a Partner

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `input` | `AddCaseActorInput!` | - |

**Returns:** `CaseActor!`

### updateCaseActor

Update an existing case actor
Side effects: Updates case actor record, creates audit log for changed fields
Authorization: User must be on case team OR be a Partner

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `id` | `UUID!` | - |
| `input` | `UpdateCaseActorInput!` | - |

**Returns:** `CaseActor!`

### removeCaseActor

Remove an actor from a case
Side effects: Deletes case actor record, creates audit log entry
Authorization: User must be on case team OR be a Partner

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `id` | `UUID!` | - |

**Returns:** `Boolean!`

---

## Full Schema SDL

Complete GraphQL Schema Definition Language representation.

```graphql
"""User type represents a lawyer or staff member at the firm"""
type User {
  """Unique identifier for the user"""
  id: UUID!

  """Firm the user belongs to (null for system users)"""
  firmId: UUID

  """User's email address (used for authentication)"""
  email: String!

  """User's first name"""
  firstName: String!

  """User's last name"""
  lastName: String!

  """User's role within the firm"""
  role: UserRole!

  """Timestamp when the user was created"""
  createdAt: DateTime!
}

"""Client entity - represents the firm's client relationships"""
type Client {
  """Unique identifier for the client"""
  id: UUID!

  """Firm that manages this client"""
  firmId: UUID!

  """Client's full name or organization name"""
  name: String!

  """Contact information as JSON (phone, email, etc.)"""
  contactInfo: JSON

  """Physical address of the client"""
  address: String

  """Timestamp when the client record was created"""
  createdAt: DateTime!

  """Timestamp when the client record was last updated"""
  updatedAt: DateTime!
}

"""Case entity - represents legal cases managed by the firm"""
type Case {
  """Unique identifier for the case"""
  id: UUID!

  """Firm that manages this case"""
  firmId: UUID!

  """Unique case number for tracking (auto-generated)"""
  caseNumber: String!

  """Title or name of the case"""
  title: String!

  """Client associated with this case"""
  client: Client!

  """Current status of the case"""
  status: CaseStatus!

  """Type of legal case"""
  type: CaseType!

  """Detailed description of the case"""
  description: String!

  """Date when the case was opened"""
  openedDate: DateTime!

  """Date when the case was closed (null if still open)"""
  closedDate: DateTime

  """Monetary value of the case (optional)"""
  value: Float

  """Additional case metadata as JSON (optional)"""
  metadata: JSON

  """List of team members assigned to this case"""
  teamMembers: [User!]!

  """List of external actors involved in this case"""
  actors: [CaseActor!]!

  """Timestamp when the case was created"""
  createdAt: DateTime!

  """Timestamp when the case was last updated"""
  updatedAt: DateTime!
}

"""Case team assignment - represents user assignments to cases"""
type CaseTeam {
  """Unique identifier for the case team assignment"""
  id: UUID!

  """Case this assignment belongs to"""
  caseId: UUID!

  """User assigned to the case"""
  userId: UUID!

  """User object for the assigned user"""
  user: User!

  """Role of the user on the case team (e.g., Lead, Support, Observer)"""
  role: String!

  """Timestamp when the user was assigned to the case"""
  assignedAt: DateTime!

  """ID of the user who created this assignment (optional)"""
  assignedBy: UUID
}

"""
Case actor - represents external parties involved in a case
These are people/entities external to the firm (clients, opposing parties, witnesses, etc.)
"""
type CaseActor {
  """Unique identifier for the case actor"""
  id: UUID!

  """Case this actor is involved in"""
  caseId: UUID!

  """Role of the actor in the case"""
  role: CaseActorRole!

  """Full name of the actor"""
  name: String!

  """Organization or company the actor represents (optional)"""
  organization: String

  """Email address of the actor (optional)"""
  email: String

  """Phone number of the actor (optional)"""
  phone: String

  """Physical address of the actor (optional)"""
  address: String

  """Additional notes about this actor (optional)"""
  notes: String

  """Timestamp when the actor was added to the case"""
  createdAt: DateTime!

  """Timestamp when the actor information was last updated"""
  updatedAt: DateTime!

  """ID of the user who added this actor"""
  createdBy: UUID!
}

"""Input for creating a new case"""
input CreateCaseInput {
  """Title of the case (3-500 characters)"""
  title: String!

  """Client ID - must reference an existing client"""
  clientId: UUID!

  """Type of case"""
  type: CaseType!

  """Detailed description of the case (minimum 10 characters)"""
  description: String!

  """Monetary value of the case (optional)"""
  value: Float

  """Additional metadata as JSON (optional)"""
  metadata: JSON
}

"""
Input for updating an existing case
All fields are optional - only provided fields will be updated
"""
input UpdateCaseInput {
  """Updated title (3-500 characters if provided)"""
  title: String

  """Updated status"""
  status: CaseStatus

  """Updated case type"""
  type: CaseType

  """Updated description"""
  description: String

  """Case closure date"""
  closedDate: DateTime

  """Updated monetary value"""
  value: Float

  """Updated metadata"""
  metadata: JSON
}

"""Input for assigning a user to a case team"""
input AssignTeamInput {
  """Case ID"""
  caseId: UUID!

  """User ID to assign"""
  userId: UUID!

  """Role of the user on the case team (e.g., Lead, Support, Observer)"""
  role: String!
}

"""Input for adding an external actor to a case"""
input AddCaseActorInput {
  """Case ID"""
  caseId: UUID!

  """Role of the actor in the case"""
  role: CaseActorRole!

  """Name of the actor (2-200 characters)"""
  name: String!

  """Organization/company name (optional)"""
  organization: String

  """Email address (optional)"""
  email: String

  """Phone number (optional)"""
  phone: String

  """Physical address (optional)"""
  address: String

  """Additional notes about this actor (optional)"""
  notes: String
}

"""
Input for updating a case actor
All fields are optional - only provided fields will be updated
"""
input UpdateCaseActorInput {
  """Updated name (2-200 characters if provided)"""
  name: String

  """Updated organization"""
  organization: String

  """Updated email"""
  email: String

  """Updated phone"""
  phone: String

  """Updated address"""
  address: String

  """Updated notes"""
  notes: String
}

type Query {
  """
  Get multiple cases with optional filters
  Authorization: Partners see all cases, Associates/Paralegals see only assigned cases
  """
  cases(
    """Filter by case status"""
    status: CaseStatus

    """Filter by client ID"""
    clientId: UUID

    """Filter to cases assigned to the current user"""
    assignedToMe: Boolean
  ): [Case!]!

  """
  Get a single case by ID
  Returns null if case not found or user is not authorized to view it
  Authorization: User must be assigned to case OR be a Partner
  """
  case(id: UUID!): Case

  """
  Full-text search across case title, description, and client name
  Returns results ordered by relevance
  Authorization: Respects case access rules (Partners see all, others see assigned only)
  """
  searchCases(
    """Search query (minimum 3 characters)"""
    query: String!

    """Maximum number of results (default 50, max 100)"""
    limit: Int
  ): [Case!]!

  """
  Get all actors for a specific case
  Authorization: User must be assigned to case OR be a Partner
  """
  caseActors(caseId: UUID!): [CaseActor!]!

  """
  Get actors for a case filtered by role
  Authorization: User must be assigned to case OR be a Partner
  """
  caseActorsByRole(caseId: UUID!, role: CaseActorRole!): [CaseActor!]!
}

type Mutation {
  """
  Create a new case
  Side effects: Assigns creator to case team as "Lead", creates audit log entry
  Authorization: Authenticated users can create cases
  """
  createCase(input: CreateCaseInput!): Case!

  """
  Update an existing case
  Side effects: Creates audit log entry for each changed field
  Authorization: User must be on case team OR be a Partner
  """
  updateCase(id: UUID!, input: UpdateCaseInput!): Case!

  """
  Archive a case (sets status to ARCHIVED)
  Side effects: Sets closedDate to current date, creates audit log entry
  Authorization: Partner role required
  """
  archiveCase(id: UUID!): Case!

  """
  Assign a user to a case team
  Side effects: Creates case team record, creates audit log entry
  Authorization: User must be on case team OR be a Partner
  """
  assignTeam(input: AssignTeamInput!): CaseTeam!

  """
  Remove a user from a case team
  Side effects: Deletes case team record, creates audit log entry
  Authorization: User must be on case team OR be a Partner
  """
  removeTeamMember(caseId: UUID!, userId: UUID!): Boolean!

  """
  Add an external actor to a case
  Side effects: Creates case actor record, creates audit log entry
  Authorization: User must be on case team OR be a Partner
  """
  addCaseActor(input: AddCaseActorInput!): CaseActor!

  """
  Update an existing case actor
  Side effects: Updates case actor record, creates audit log for changed fields
  Authorization: User must be on case team OR be a Partner
  """
  updateCaseActor(id: UUID!, input: UpdateCaseActorInput!): CaseActor!

  """
  Remove an actor from a case
  Side effects: Deletes case actor record, creates audit log entry
  Authorization: User must be on case team OR be a Partner
  """
  removeCaseActor(id: UUID!): Boolean!
}

"""
Case status lifecycle enum
- ACTIVE: Case is currently being worked on
- ON_HOLD: Case is temporarily paused
- CLOSED: Case has been concluded
- ARCHIVED: Case is closed and archived for long-term storage
"""
enum CaseStatus {
  ACTIVE
  ON_HOLD
  CLOSED
  ARCHIVED
}

"""
Case type categorization enum
- LITIGATION: Court litigation cases
- CONTRACT: Contract review and drafting
- ADVISORY: Legal advisory and consulting
- CRIMINAL: Criminal defense cases
- OTHER: Other types of legal matters
"""
enum CaseType {
  LITIGATION
  CONTRACT
  ADVISORY
  CRIMINAL
  OTHER
}

"""
External party roles in a case (Romanian legal context)
- CLIENT: The client in this specific case
- OPPOSING_PARTY: The opposing party (partea adversă)
- OPPOSING_COUNSEL: Opposing counsel/lawyer (avocatul părții adverse)
- WITNESS: Witness to be called (martor)
- EXPERT: Expert witness or consultant (expert)
"""
enum CaseActorRole {
  CLIENT
  OPPOSING_PARTY
  OPPOSING_COUNSEL
  WITNESS
  EXPERT
}

"""
User roles within the law firm
- PARTNER: Firm partner with full access
- ASSOCIATE: Associate lawyer with limited access
- PARALEGAL: Paralegal with task-specific access
"""
enum UserRole {
  PARTNER
  ASSOCIATE
  PARALEGAL
}

"""
Date and time scalar type conforming to ISO 8601 format
Example: 2025-01-15T10:30:00Z
"""
scalar DateTime

"""
UUID scalar type conforming to RFC 4122
Example: 550e8400-e29b-41d4-a716-446655440000
"""
scalar UUID

"""
Arbitrary JSON data scalar type
Example: {"key": "value", "nested": {"data": 123}}
"""
scalar JSON
```
