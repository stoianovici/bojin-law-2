# GraphQL Playground Guide

> **Story 2.7:** API Documentation and Developer Portal

This guide explains how to use the GraphQL Playground (Apollo Sandbox) for testing and exploring the Legal Platform GraphQL API.

---

## Table of Contents

- [Accessing the Playground](#accessing-the-playground)
- [Authentication Setup](#authentication-setup)
- [Example Queries](#example-queries)
- [Example Mutations](#example-mutations)
- [Troubleshooting](#troubleshooting)

---

## Accessing the Playground

### Development Environment

The GraphQL Playground (Apollo Sandbox) is automatically available in development mode:

1. **Start the development server:**
   ```bash
   cd services/gateway
   pnpm dev
   ```

2. **Open your browser and navigate to:**
   ```
   http://localhost:4000/graphql
   ```

3. **Apollo Sandbox will load automatically** with:
   - Schema introspection enabled
   - Documentation explorer
   - Query history
   - Variable editor

### Production Environment

⚠️ **Security Notice:** Introspection and the playground are **disabled in production** for security reasons. Use the API collection (see Postman/Insomnia guide) for production testing.

---

## Authentication Setup

The GraphQL API requires authentication via Azure AD OAuth 2.0. Here's how to authenticate your requests:

### Method 1: Using Browser Session (Recommended for Local Development)

1. **Authenticate through the web application:**
   - Navigate to `http://localhost:3000` (frontend app)
   - Sign in with your Azure AD credentials
   - The session cookie will be set automatically

2. **Open Apollo Sandbox:**
   - Navigate to `http://localhost:4000/graphql`
   - Your queries will automatically include the session cookie
   - No additional configuration needed

### Method 2: Manual Headers (For Testing)

If you need to test with specific users or tokens:

1. **Click "Headers" in Apollo Sandbox**

2. **Add the session cookie header:**
   ```json
   {
     "cookie": "connect.sid=YOUR_SESSION_ID"
   }
   ```

   Or add authorization header (if using JWT directly):
   ```json
   {
     "authorization": "Bearer YOUR_JWT_TOKEN"
   }
   ```

3. **Obtain session ID from:**
   - Browser DevTools → Application → Cookies → `connect.sid`
   - Or use the authentication endpoint to get a token

---

## Example Queries

### Query 1: Get All Active Cases

Retrieve all active cases for the current user.

**Query:**
```graphql
query GetActiveCases {
  cases(status: ACTIVE) {
    id
    caseNumber
    title
    status
    type
    client {
      id
      name
      email: contactInfo
    }
    teamMembers {
      id
      firstName
      lastName
      role
    }
    openedDate
    value
  }
}
```

**Expected Response:**
```json
{
  "data": {
    "cases": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "caseNumber": "CASE-2025-001",
        "title": "Contract Dispute - Tech Corp",
        "status": "ACTIVE",
        "type": "LITIGATION",
        "client": {
          "id": "660e8400-e29b-41d4-a716-446655440111",
          "name": "Tech Corp Inc.",
          "contactInfo": {"email": "contact@techcorp.com"}
        },
        "teamMembers": [
          {
            "id": "770e8400-e29b-41d4-a716-446655440222",
            "firstName": "John",
            "lastName": "Doe",
            "role": "PARTNER"
          }
        ],
        "openedDate": "2025-01-15T10:00:00Z",
        "value": 250000.00
      }
    ]
  }
}
```

### Query 2: Get Single Case with Actors

Retrieve a specific case with all external actors.

**Query:**
```graphql
query GetCaseDetails($caseId: UUID!) {
  case(id: $caseId) {
    id
    caseNumber
    title
    description
    status
    type
    client {
      id
      name
      contactInfo
    }
    actors {
      id
      role
      name
      organization
      email
      phone
    }
    teamMembers {
      firstName
      lastName
      role
    }
    createdAt
    updatedAt
  }
}
```

**Variables:**
```json
{
  "caseId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Query 3: Search Cases

Full-text search across cases.

**Query:**
```graphql
query SearchCases($searchQuery: String!, $limit: Int) {
  searchCases(query: $searchQuery, limit: $limit) {
    id
    caseNumber
    title
    description
    status
    client {
      name
    }
    openedDate
  }
}
```

**Variables:**
```json
{
  "searchQuery": "contract dispute",
  "limit": 10
}
```

### Query 4: Get Cases Assigned to Me

Filter cases assigned to the current user.

**Query:**
```graphql
query GetMyCases {
  cases(assignedToMe: true) {
    id
    caseNumber
    title
    status
    type
    client {
      name
    }
    openedDate
  }
}
```

### Query 5: Get Case Actors by Role

Retrieve actors for a specific case filtered by role.

**Query:**
```graphql
query GetCaseWitnesses($caseId: UUID!) {
  caseActorsByRole(caseId: $caseId, role: WITNESS) {
    id
    name
    email
    phone
    address
    notes
  }
}
```

**Variables:**
```json
{
  "caseId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Example Mutations

### Mutation 1: Create New Case

Create a new legal case.

**Mutation:**
```graphql
mutation CreateNewCase($input: CreateCaseInput!) {
  createCase(input: $input) {
    id
    caseNumber
    title
    status
    type
    client {
      id
      name
    }
    teamMembers {
      firstName
      lastName
      role
    }
    openedDate
    createdAt
  }
}
```

**Variables:**
```json
{
  "input": {
    "title": "Contract Review - Acme Corp",
    "clientId": "660e8400-e29b-41d4-a716-446655440111",
    "type": "CONTRACT",
    "description": "Annual contract review for Acme Corporation's vendor agreements",
    "value": 50000.00,
    "metadata": {
      "priority": "high",
      "estimatedHours": 40
    }
  }
}
```

### Mutation 2: Update Case

Update an existing case.

**Mutation:**
```graphql
mutation UpdateCase($caseId: UUID!, $input: UpdateCaseInput!) {
  updateCase(id: $caseId, input: $input) {
    id
    title
    status
    description
    value
    updatedAt
  }
}
```

**Variables:**
```json
{
  "caseId": "550e8400-e29b-41d4-a716-446655440000",
  "input": {
    "status": "ON_HOLD",
    "description": "Waiting for client documents before proceeding",
    "value": 75000.00
  }
}
```

### Mutation 3: Assign Team Member

Assign a user to a case team.

**Mutation:**
```graphql
mutation AssignTeamMember($input: AssignTeamInput!) {
  assignTeam(input: $input) {
    id
    user {
      firstName
      lastName
      email
    }
    role
    assignedAt
  }
}
```

**Variables:**
```json
{
  "input": {
    "caseId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "770e8400-e29b-41d4-a716-446655440222",
    "role": "Lead"
  }
}
```

### Mutation 4: Add Case Actor

Add an external party to a case.

**Mutation:**
```graphql
mutation AddCaseActor($input: AddCaseActorInput!) {
  addCaseActor(input: $input) {
    id
    role
    name
    organization
    email
    phone
    createdAt
  }
}
```

**Variables:**
```json
{
  "input": {
    "caseId": "550e8400-e29b-41d4-a716-446655440000",
    "role": "OPPOSING_COUNSEL",
    "name": "Jane Smith",
    "organization": "Smith & Associates Law Firm",
    "email": "jsmith@smithlaw.com",
    "phone": "+40-21-123-4567"
  }
}
```

### Mutation 5: Archive Case

Archive a case (Partner role required).

**Mutation:**
```graphql
mutation ArchiveCase($caseId: UUID!) {
  archiveCase(id: $caseId) {
    id
    status
    closedDate
    updatedAt
  }
}
```

**Variables:**
```json
{
  "caseId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Troubleshooting

### Authentication Errors

**Problem:** `Unauthorized` or `Authentication required` errors

**Solutions:**
1. Verify you're authenticated through the frontend app
2. Check that your session cookie is valid
3. Ensure your user has the required permissions
4. Try logging out and logging back in

### Introspection Not Available

**Problem:** Schema explorer doesn't show types

**Solutions:**
1. Verify you're running in development mode (`NODE_ENV=development`)
2. Check that the server started without errors
3. Restart the development server

### Permission Denied Errors

**Problem:** `Insufficient permissions` or `Access denied` errors

**Solutions:**
1. Check your user role (some operations require Partner role)
2. Verify you're assigned to the case (for case-specific operations)
3. Ensure firm isolation is respected (you can only access your firm's data)

### Connection Errors

**Problem:** Cannot connect to GraphQL endpoint

**Solutions:**
1. Verify the server is running on port 4000
2. Check that no other service is using port 4000
3. Review server logs for startup errors
4. Ensure Redis is running (required for sessions)

---

## Additional Resources

- **Schema Documentation:** [docs/api/schema/schema.md](./schema/schema.md)
- **Case Management API:** [docs/api/case-management-api.md](./case-management-api.md)
- **Error Handling:** [docs/api/error-handling.md](./error-handling.md)
- **API Collection:** [docs/api/collections/](./collections/)

---

## Tips for Effective Testing

1. **Use Variables:** Always use variables for dynamic values instead of hardcoding them in queries
2. **Test Authorization:** Try operations with different user roles to verify permissions
3. **Check Error Messages:** GraphQL returns detailed error messages with field-level validation
4. **Enable Query History:** Apollo Sandbox saves your query history for easy reuse
5. **Use Fragments:** Define reusable fragments for common field selections
6. **Test Edge Cases:** Try null values, empty arrays, and boundary conditions
7. **Monitor Performance:** Check query execution time in the response panel

---

**Last Updated:** 2025-11-21
**Story:** 2.7 - API Documentation and Developer Portal
