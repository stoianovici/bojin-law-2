# API Versioning Strategy

> **Story 2.7:** API Documentation and Developer Portal

This document defines the versioning strategy for the Legal Platform GraphQL API, including schema evolution practices, deprecation policies, and backward compatibility guidelines.

---

## Table of Contents

- [Versioning Approach](#versioning-approach)
- [Schema Evolution](#schema-evolution)
- [Breaking vs Non-Breaking Changes](#breaking-vs-non-breaking-changes)
- [Deprecation Process](#deprecation-process)
- [Version Support Lifecycle](#version-support-lifecycle)
- [Communication Guidelines](#communication-guidelines)
- [Best Practices](#best-practices)

---

## Versioning Approach

### GraphQL Schema Evolution

The Legal Platform API uses **schema evolution** rather than URL versioning. This approach is recommended by GraphQL best practices and provides several advantages:

**✅ Advantages:**
- Single endpoint for all clients
- Gradual migration path for clients
- No need to maintain multiple API versions
- Backward compatibility by default
- Clear deprecation warnings in schema

**❌ URL Versioning (Not Used):**
- `/v1/graphql`, `/v2/graphql` - NOT USED
- Requires maintaining multiple codebases
- Forces hard cutoffs for clients
- Increases infrastructure complexity

### Version Identification

API version is tracked through:

1. **Schema Version:** Embedded in schema description
2. **Release Tags:** Git tags (e.g., `api-v1.2.0`)
3. **Changelog:** [breaking-changes.md](./breaking-changes.md)
4. **Package Version:** `services/gateway/package.json`

Current API Version: **v1.0.0**

---

## Schema Evolution

### Adding New Capabilities (Non-Breaking)

New fields, types, and operations can be added without breaking existing clients.

#### Adding New Fields to Types

```graphql
# Before
type Case {
  id: UUID!
  title: String!
  status: CaseStatus!
}

# After (Non-Breaking)
type Case {
  id: UUID!
  title: String!
  status: CaseStatus!
  priority: Priority  # NEW: Optional field
}
```

✅ **Safe:** Existing queries continue to work. Clients can request the new field when ready.

#### Adding New Types

```graphql
# NEW: Completely new type
type Task {
  id: UUID!
  title: String!
  dueDate: DateTime
}
```

✅ **Safe:** New types don't affect existing queries.

#### Adding New Queries/Mutations

```graphql
type Query {
  cases: [Case!]!
  tasks: [Task!]!  # NEW: Additional query
}
```

✅ **Safe:** Existing clients don't need to use new operations.

#### Adding New Enum Values

```graphql
# Before
enum CaseStatus {
  ACTIVE
  ON_HOLD
  CLOSED
}

# After (Non-Breaking)
enum CaseStatus {
  ACTIVE
  ON_HOLD
  CLOSED
  ARCHIVED  # NEW: Added at the end
}
```

✅ **Safe:** Existing clients may receive new enum values, but should have default handling.

⚠️ **Client Consideration:** Clients should handle unknown enum values gracefully.

---

## Breaking vs Non-Breaking Changes

### Non-Breaking Changes (Safe to Deploy)

These changes maintain backward compatibility:

| Change | Example | Impact |
|--------|---------|--------|
| Add new field | `Case.priority: Priority` | ✅ None |
| Add new type | `type Task { ... }` | ✅ None |
| Add new query | `tasks: [Task!]!` | ✅ None |
| Add new mutation | `createTask(...)` | ✅ None |
| Add new enum value | `CaseStatus.ARCHIVED` | ⚠️ Minor (clients should handle unknown values) |
| Make required field optional | `closedDate: DateTime!` → `closedDate: DateTime` | ✅ None |
| Add new input field (optional) | `metadata: JSON` | ✅ None |

### Breaking Changes (Require Deprecation Period)

These changes break existing clients and require careful handling:

| Change | Example | Impact |
|--------|---------|--------|
| Remove field | Remove `Case.legacyField` | ❌ Breaks queries using that field |
| Rename field | `Case.clientId` → `Case.client_id` | ❌ Breaks existing queries |
| Change field type | `value: Float` → `value: Int` | ❌ Type mismatch errors |
| Make optional field required | `metadata: JSON` → `metadata: JSON!` | ❌ Breaks mutations |
| Remove enum value | Remove `CaseStatus.LEGACY` | ❌ Breaks filters/mutations |
| Change argument types | `(id: String!)` → `(id: UUID!)` | ❌ Type mismatch |
| Remove query/mutation | Remove `legacySearch` | ❌ Breaks clients using it |

---

## Deprecation Process

### Using @deprecated Directive

Fields and enum values can be marked as deprecated:

```graphql
type Case {
  id: UUID!
  title: String!

  """
  DEPRECATED: Use 'client' field instead.
  Will be removed in API v2.0 (2026-06-01)
  """
  clientId: UUID @deprecated(reason: "Use 'client.id' instead. Will be removed in v2.0 (2026-06-01)")

  """
  Client associated with this case
  """
  client: Client!
}
```

### Deprecation Timeline

**Minimum Deprecation Period:** 6 months

1. **Month 0: Deprecation Announced**
   - Field marked with `@deprecated` directive
   - Reason and migration path provided
   - Removal date specified (at least 6 months out)
   - Announcement sent to all API consumers
   - Documentation updated

2. **Month 1-5: Monitoring Phase**
   - Track usage of deprecated fields
   - Contact teams still using deprecated fields
   - Provide migration support

3. **Month 6: Final Warning**
   - Send final notice (30 days before removal)
   - Highlight remaining usage
   - Offer direct migration support

4. **Month 6+: Removal**
   - Remove deprecated field in next major version
   - Update documentation
   - Monitor for issues

### Deprecation Example

#### Step 1: Mark as Deprecated

```graphql
type Case {
  """
  DEPRECATED: Use 'status' field with CaseStatus enum instead.
  Will be removed on 2026-06-01.

  Migration:
  - ACTIVE → CaseStatus.ACTIVE
  - CLOSED → CaseStatus.CLOSED
  """
  isActive: Boolean @deprecated(reason: "Use 'status' field. Removal: 2026-06-01")

  """Current status of the case"""
  status: CaseStatus!
}
```

#### Step 2: Provide Migration Guide

```markdown
## Migrating from isActive to status

**Old Query:**
```graphql
query {
  case(id: "...") {
    isActive
  }
}
```

**New Query:**
```graphql
query {
  case(id: "...") {
    status  # Returns ACTIVE, ON_HOLD, CLOSED, or ARCHIVED
  }
}
```

**Mapping:**
- `isActive: true` → `status: ACTIVE`
- `isActive: false` → `status: CLOSED`
```

---

## Version Support Lifecycle

### Support Policy

| Version Type | Support Duration | Updates |
|--------------|------------------|---------|
| **Current (v1.x)** | Indefinite | Bug fixes, security patches, new features |
| **Previous (v0.x)** | 6 months after next major release | Critical security patches only |
| **Deprecated** | 0 months | None |

### Release Cadence

- **Major Releases (v1.0, v2.0):** Annually (includes breaking changes)
- **Minor Releases (v1.1, v1.2):** Quarterly (new features, no breaking changes)
- **Patch Releases (v1.0.1):** As needed (bug fixes, security patches)

### Version Numbering (SemVer)

```
v MAJOR . MINOR . PATCH
  │       │       │
  │       │       └─ Bug fixes, security patches
  │       └─────────── New features (backward compatible)
  └─────────────────── Breaking changes
```

**Examples:**
- `v1.0.0` → `v1.1.0`: Added new queries (safe)
- `v1.1.0` → `v1.1.1`: Fixed bug (safe)
- `v1.1.1` → `v2.0.0`: Removed deprecated fields (breaking)

---

## Communication Guidelines

### Before Making Changes

1. **Assess Impact**
   - Is this a breaking change?
   - How many clients are affected?
   - What's the migration path?

2. **Plan Timeline**
   - When will deprecation be announced?
   - When will removal occur?
   - Is 6 months sufficient?

3. **Prepare Documentation**
   - Migration guide
   - Code examples
   - FAQ

### Announcing Changes

#### Non-Breaking Changes

**Medium:** Release notes, changelog

**Template:**
```markdown
## API Update: v1.2.0 (2025-02-01)

### New Features
- Added `Case.priority` field for case prioritization
- Added `tasks` query for retrieving task lists

### No Action Required
These are non-breaking changes. Existing code will continue to work.
```

#### Breaking Changes

**Medium:** Email, Slack, API docs, in-schema warnings

**Template:**
```markdown
## BREAKING CHANGE NOTICE: Field Deprecation

**Field:** `Case.clientId`
**Reason:** Redundant with `Case.client.id`
**Deprecated:** 2025-12-01
**Removal Date:** 2026-06-01 (6 months)

### Action Required
Update queries to use `Case.client.id` instead of `Case.clientId`.

### Migration Guide
[Link to migration guide]

### Support
Contact api-support@legal-platform.com for assistance.
```

---

## Best Practices

### For API Maintainers

✅ **Do:**
- Add new fields rather than modifying existing ones
- Use `@deprecated` directive with clear migration paths
- Maintain at least 6-month deprecation period
- Monitor usage of deprecated fields
- Provide comprehensive migration guides
- Version changes using SemVer
- Communicate changes proactively

❌ **Don't:**
- Remove fields without deprecation period
- Change field types without new field
- Rush breaking changes
- Ignore feedback from API consumers
- Make breaking changes in minor versions

### For API Consumers

✅ **Do:**
- Handle unknown enum values gracefully
- Subscribe to API change notifications
- Test against new API versions before they're released
- Migrate away from deprecated fields promptly
- Use GraphQL introspection to detect changes
- Report issues with new features early

❌ **Don't:**
- Ignore deprecation warnings
- Rely on undocumented fields
- Skip schema validation
- Assume API never changes

### Schema Design Principles

1. **Additive Changes Preferred**
   ```graphql
   # Good: Add new optional field
   type Case {
     status: CaseStatus!
     priority: Priority  # New optional field
   }

   # Bad: Change existing field type
   type Case {
     status: String!  # Changed from CaseStatus enum
   }
   ```

2. **Provide Migration Paths**
   ```graphql
   type Case {
     # Old (deprecated)
     clientId: UUID @deprecated(reason: "Use client.id")

     # New (recommended)
     client: Client!
   }
   ```

3. **Use Semantic Field Names**
   ```graphql
   # Good: Clear intent
   createdAt: DateTime!
   updatedAt: DateTime!

   # Bad: Ambiguous
   date: DateTime!
   time: DateTime!
   ```

---

## Related Documentation

- **Breaking Changes Log:** [breaking-changes.md](./breaking-changes.md)
- **API Documentation:** [README.md](./README.md)
- **Schema Documentation:** [schema/schema.md](./schema/schema.md)
- **Error Handling:** [error-handling.md](./error-handling.md)

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-21 | 1.0.0 | Initial versioning strategy defined |

---

**Last Updated:** 2025-11-21
**Story:** 2.7 - API Documentation and Developer Portal
**Maintained By:** Backend Team
