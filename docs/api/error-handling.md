# API Error Handling

> **Story 2.7:** API Documentation and Developer Portal

This document describes error handling patterns for the Legal Platform GraphQL API, including error codes, formats, and best practices for handling errors in client applications.

---

## Table of Contents

- [GraphQL Error Format](#graphql-error-format)
- [Error Categories](#error-categories)
- [Error Codes](#error-codes)
- [Common Error Scenarios](#common-error-scenarios)
- [Error Handling Patterns](#error-handling-patterns)
- [Retry Strategies](#retry-strategies)
- [Best Practices](#best-practices)

---

## GraphQL Error Format

GraphQL errors follow a standard format with extensions for additional context.

### Standard GraphQL Error Response

```json
{
  "errors": [
    {
      "message": "Human-readable error message",
      "locations": [
        {
          "line": 2,
          "column": 3
        }
      ],
      "path": ["fieldName"],
      "extensions": {
        "code": "ERROR_CODE",
        "timestamp": "2025-01-15T10:30:00Z",
        "requestId": "req_abc123",
        "retryable": false,
        "details": {
          // Additional error context
        }
      }
    }
  ],
  "data": null
}
```

### Error Response Fields

| Field                   | Type      | Description                                        |
| ----------------------- | --------- | -------------------------------------------------- |
| `message`               | `string`  | Human-readable error description                   |
| `locations`             | `array`   | Query locations where error occurred               |
| `path`                  | `array`   | Path to the field that caused the error            |
| `extensions.code`       | `string`  | Machine-readable error code                        |
| `extensions.timestamp`  | `string`  | ISO 8601 timestamp of error                        |
| `extensions.requestId`  | `string`  | Unique request identifier for tracking             |
| `extensions.retryable`  | `boolean` | Whether the request can be retried                 |
| `extensions.retryAfter` | `number`  | Seconds to wait before retry (for rate limits)     |
| `extensions.details`    | `object`  | Additional error context (validation errors, etc.) |

---

## Error Categories

### 1. Validation Errors (400)

**Code:** `VALIDATION_ERROR`

Occurs when input data fails validation rules.

**Example Response:**

```json
{
  "errors": [
    {
      "message": "Validation failed for CreateCaseInput",
      "extensions": {
        "code": "VALIDATION_ERROR",
        "timestamp": "2025-01-15T10:30:00Z",
        "requestId": "req_abc123",
        "retryable": false,
        "details": {
          "fields": {
            "title": "Title must be between 3 and 500 characters",
            "description": "Description must be at least 10 characters"
          }
        }
      }
    }
  ],
  "data": null
}
```

**Common Causes:**

- Missing required fields
- Invalid field formats (e.g., invalid email)
- Value out of allowed range
- Invalid enum value
- Type mismatch

### 2. Authentication Errors (401)

**Code:** `UNAUTHENTICATED`

Occurs when the request lacks valid authentication credentials.

**Example Response:**

```json
{
  "errors": [
    {
      "message": "Authentication required",
      "extensions": {
        "code": "UNAUTHENTICATED",
        "timestamp": "2025-01-15T10:30:00Z",
        "requestId": "req_abc123",
        "retryable": false
      }
    }
  ],
  "data": null
}
```

**Common Causes:**

- Missing session cookie or authorization header
- Expired JWT token
- Invalid or revoked token
- User session not found in Redis

### 3. Authorization Errors (403)

**Code:** `FORBIDDEN`

Occurs when the authenticated user lacks permission for the requested operation.

**Example Response:**

```json
{
  "errors": [
    {
      "message": "Insufficient permissions to archive case",
      "extensions": {
        "code": "FORBIDDEN",
        "timestamp": "2025-01-15T10:30:00Z",
        "requestId": "req_abc123",
        "retryable": false,
        "details": {
          "required": "PARTNER",
          "actual": "PARALEGAL",
          "resource": "Case:550e8400-e29b-41d4-a716-446655440000"
        }
      }
    }
  ],
  "data": null
}
```

**Common Causes:**

- User role lacks required permissions
- User not assigned to case (for case-specific operations)
- Firm isolation violation (accessing another firm's data)
- Resource ownership mismatch

### 4. Not Found Errors (404)

**Code:** `NOT_FOUND`

Occurs when the requested resource does not exist.

**Example Response:**

```json
{
  "errors": [
    {
      "message": "Case not found",
      "extensions": {
        "code": "NOT_FOUND",
        "timestamp": "2025-01-15T10:30:00Z",
        "requestId": "req_abc123",
        "retryable": false,
        "details": {
          "resource": "Case",
          "id": "550e8400-e29b-41d4-a716-446655440000"
        }
      }
    }
  ],
  "data": {
    "case": null
  }
}
```

**Common Causes:**

- Resource ID does not exist
- Resource deleted or archived
- User lacks access to resource (firm isolation)

### 5. Rate Limit Errors (429)

**Code:** `RATE_LIMIT_EXCEEDED`

Occurs when the client exceeds rate limits.

**Example Response:**

```json
{
  "errors": [
    {
      "message": "Rate limit exceeded. Please try again later.",
      "extensions": {
        "code": "RATE_LIMIT_EXCEEDED",
        "timestamp": "2025-01-15T10:30:00Z",
        "requestId": "req_abc123",
        "retryable": true,
        "retryAfter": 60,
        "details": {
          "limit": 100,
          "window": "1m",
          "resetAt": "2025-01-15T10:31:00Z"
        }
      }
    }
  ],
  "data": null
}
```

**Common Causes:**

- Too many requests in time window
- Expensive query execution limits

### 6. Internal Server Errors (500)

**Code:** `INTERNAL_SERVER_ERROR`

Occurs due to unexpected server-side failures.

**Example Response:**

```json
{
  "errors": [
    {
      "message": "An unexpected error occurred. Please try again later.",
      "extensions": {
        "code": "INTERNAL_SERVER_ERROR",
        "timestamp": "2025-01-15T10:30:00Z",
        "requestId": "req_abc123",
        "retryable": true
      }
    }
  ],
  "data": null
}
```

**Common Causes:**

- Unhandled exceptions
- Database connection failures
- Third-party service failures
- Memory/resource exhaustion

### 7. Service Unavailable (503)

**Code:** `SERVICE_UNAVAILABLE`

Occurs when the service is temporarily unavailable.

**Example Response:**

```json
{
  "errors": [
    {
      "message": "Service temporarily unavailable. Please try again later.",
      "extensions": {
        "code": "SERVICE_UNAVAILABLE",
        "timestamp": "2025-01-15T10:30:00Z",
        "requestId": "req_abc123",
        "retryable": true,
        "retryAfter": 30
      }
    }
  ],
  "data": null
}
```

**Common Causes:**

- Planned maintenance
- Database unavailable
- Redis unavailable
- Deployment in progress

---

## Error Codes

### Complete Error Code Reference

| Code                    | HTTP Status | Description                       | Retryable |
| ----------------------- | ----------- | --------------------------------- | --------- |
| `VALIDATION_ERROR`      | 400         | Input validation failed           | ❌ No     |
| `UNAUTHENTICATED`       | 401         | Missing or invalid authentication | ❌ No     |
| `FORBIDDEN`             | 403         | Insufficient permissions          | ❌ No     |
| `NOT_FOUND`             | 404         | Resource not found                | ❌ No     |
| `CONFLICT`              | 409         | Resource already exists           | ❌ No     |
| `RATE_LIMIT_EXCEEDED`   | 429         | Too many requests                 | ✅ Yes    |
| `INTERNAL_SERVER_ERROR` | 500         | Unexpected server error           | ✅ Yes    |
| `SERVICE_UNAVAILABLE`   | 503         | Service temporarily down          | ✅ Yes    |
| `GATEWAY_TIMEOUT`       | 504         | Upstream service timeout          | ✅ Yes    |

---

## Common Error Scenarios

### Scenario 1: Creating a Case with Invalid Data

**Query:**

```graphql
mutation CreateCase($input: CreateCaseInput!) {
  createCase(input: $input) {
    id
    title
  }
}
```

**Variables:**

```json
{
  "input": {
    "title": "AB", // Too short (< 3 chars)
    "clientId": "invalid-uuid",
    "type": "LITIGATION",
    "description": "Short" // Too short (< 10 chars)
  }
}
```

**Error Response:**

```json
{
  "errors": [
    {
      "message": "Validation failed",
      "extensions": {
        "code": "VALIDATION_ERROR",
        "details": {
          "title": "Must be between 3 and 500 characters",
          "clientId": "Invalid UUID format",
          "description": "Must be at least 10 characters"
        }
      }
    }
  ]
}
```

### Scenario 2: Accessing Case Without Permission

**Query:**

```graphql
query GetCase($id: UUID!) {
  case(id: $id) {
    id
    title
  }
}
```

**Error Response:**

```json
{
  "errors": [
    {
      "message": "You do not have access to this case",
      "extensions": {
        "code": "FORBIDDEN",
        "details": {
          "reason": "User not assigned to case and not a Partner"
        }
      }
    }
  ],
  "data": {
    "case": null
  }
}
```

### Scenario 3: Archiving Case as Paralegal

**Mutation:**

```graphql
mutation ArchiveCase($id: UUID!) {
  archiveCase(id: $id) {
    id
    status
  }
}
```

**Error Response:**

```json
{
  "errors": [
    {
      "message": "Only Partners can archive cases",
      "extensions": {
        "code": "FORBIDDEN",
        "details": {
          "required": "PARTNER",
          "actual": "PARALEGAL"
        }
      }
    }
  ]
}
```

---

## Error Handling Patterns

### Frontend Error Handling (React Example)

```typescript
import { useMutation } from '@apollo/client';
import { CREATE_CASE } from './mutations';

function CreateCaseForm() {
  const [createCase, { loading, error }] = useMutation(CREATE_CASE);

  const handleSubmit = async (formData) => {
    try {
      const { data } = await createCase({
        variables: { input: formData },
      });
      console.log('Case created:', data.createCase);
    } catch (error) {
      handleGraphQLError(error);
    }
  };

  const handleGraphQLError = (error) => {
    if (!error.graphQLErrors) {
      console.error('Network error:', error);
      return;
    }

    error.graphQLErrors.forEach((err) => {
      const { code, details } = err.extensions;

      switch (code) {
        case 'VALIDATION_ERROR':
          // Show field-level validation errors
          Object.entries(details.fields).forEach(([field, message]) => {
            showFieldError(field, message);
          });
          break;

        case 'UNAUTHENTICATED':
          // Redirect to login
          router.push('/login');
          break;

        case 'FORBIDDEN':
          // Show permission denied message
          showError('You do not have permission to perform this action');
          break;

        case 'NOT_FOUND':
          // Show not found message
          showError(`${details.resource} not found`);
          break;

        case 'RATE_LIMIT_EXCEEDED':
          // Show rate limit message with retry time
          showError(`Too many requests. Please try again in ${err.extensions.retryAfter} seconds`);
          break;

        case 'INTERNAL_SERVER_ERROR':
        case 'SERVICE_UNAVAILABLE':
          // Show generic error with retry option
          showError('Something went wrong. Please try again later.', {
            retry: true,
            requestId: err.extensions.requestId,
          });
          break;

        default:
          showError(err.message);
      }
    });
  };
}
```

### Backend Error Handling (Resolver Example)

```typescript
import { GraphQLError } from 'graphql';

export const caseResolvers = {
  Mutation: {
    createCase: async (_parent, { input }, context) => {
      try {
        // Authentication check
        if (!context.user) {
          throw new GraphQLError('Authentication required', {
            extensions: {
              code: 'UNAUTHENTICATED',
              timestamp: new Date().toISOString(),
              requestId: context.requestId,
              retryable: false,
            },
          });
        }

        // Validation
        const validationErrors = validateCreateCaseInput(input);
        if (Object.keys(validationErrors).length > 0) {
          throw new GraphQLError('Validation failed', {
            extensions: {
              code: 'VALIDATION_ERROR',
              timestamp: new Date().toISOString(),
              requestId: context.requestId,
              retryable: false,
              details: { fields: validationErrors },
            },
          });
        }

        // Business logic
        const case = await caseService.createCase({
          ...input,
          firmId: context.user.firmId,
          createdBy: context.user.id,
        });

        return case;

      } catch (error) {
        // Handle unexpected errors
        if (error instanceof GraphQLError) {
          throw error;
        }

        console.error('Unexpected error:', error);
        throw new GraphQLError('An unexpected error occurred', {
          extensions: {
            code: 'INTERNAL_SERVER_ERROR',
            timestamp: new Date().toISOString(),
            requestId: context.requestId,
            retryable: true,
          },
        });
      }
    },
  },
};
```

---

## Retry Strategies

### Exponential Backoff

For retryable errors, use exponential backoff:

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const isRetryable = error.graphQLErrors?.some((err) => err.extensions?.retryable === true);

      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Usage
const result = await retryWithBackoff(async () => {
  return await createCase({ variables: { input: caseData } });
});
```

### Rate Limit Handling

For rate limit errors, respect the `retryAfter` value:

```typescript
function handleRateLimitError(error) {
  const rateLimitError = error.graphQLErrors.find(
    (err) => err.extensions?.code === 'RATE_LIMIT_EXCEEDED'
  );

  if (rateLimitError) {
    const retryAfter = rateLimitError.extensions.retryAfter || 60;
    console.log(`Rate limited. Retrying in ${retryAfter} seconds`);

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(retryRequest());
      }, retryAfter * 1000);
    });
  }
}
```

---

## Best Practices

### ✅ Do

1. **Always handle errors gracefully**
   - Show user-friendly messages
   - Log errors for debugging
   - Provide actionable feedback

2. **Check error codes for programmatic handling**

   ```typescript
   if (error.extensions?.code === 'VALIDATION_ERROR') {
     // Handle validation errors
   }
   ```

3. **Respect retry guidance**
   - Only retry when `retryable: true`
   - Use `retryAfter` for rate limits
   - Implement exponential backoff

4. **Include request ID in support tickets**
   - Helps backend team trace errors
   - Include timestamp for correlation

5. **Validate input before sending requests**
   - Reduce unnecessary API calls
   - Provide immediate feedback

### ❌ Don't

1. **Don't expose sensitive information in errors**
   - No database stack traces to users
   - No internal system details
   - No credentials in logs

2. **Don't retry non-retryable errors**
   - Validation errors won't succeed on retry
   - Authentication errors need new tokens
   - Authorization errors need permission changes

3. **Don't ignore error context**
   - Use `details` field for additional info
   - Check `path` for field-level errors
   - Review `locations` for query issues

4. **Don't assume all errors are fatal**
   - Some queries return partial data with errors
   - Check both `data` and `errors` fields

5. **Don't hardcode error messages**
   - Use error codes for logic
   - Display message to users
   - Support internationalization

---

## Additional Resources

- **GraphQL Error Specification:** https://spec.graphql.org/June2018/#sec-Errors
- **Architecture Error Strategy:** [docs/architecture/error-handling-strategy.md](../architecture/error-handling-strategy.md)
- **API Documentation:** [docs/api/README.md](./README.md)
- **Playground Guide:** [docs/api/playground-guide.md](./playground-guide.md)

---

**Last Updated:** 2025-11-21
**Story:** 2.7 - API Documentation and Developer Portal
