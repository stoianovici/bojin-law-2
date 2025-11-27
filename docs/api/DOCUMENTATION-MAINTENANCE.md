# API Documentation Maintenance Guide

> **Story 2.7:** API Documentation and Developer Portal

This document provides guidelines for maintaining API documentation and ensuring it stays up-to-date.

---

## Documentation Inventory

### Core Documentation Files

| File | Purpose | Update Frequency | Owner |
|------|---------|------------------|-------|
| [README.md](./README.md) | Master API documentation index | As needed | Backend Team |
| [schema/schema.md](./schema/schema.md) | Auto-generated GraphQL schema | Automatic on schema change | Auto-generated |
| [playground-guide.md](./playground-guide.md) | Interactive testing guide | Quarterly | Backend Team |
| [case-management-api.md](./case-management-api.md) | Case API reference | On feature changes | Backend Team |
| [error-handling.md](./error-handling.md) | Error codes and handling | On error changes | Backend Team |
| [versioning-strategy.md](./versioning-strategy.md) | API versioning policy | Annually | API Governance |
| [breaking-changes.md](./breaking-changes.md) | Breaking change process | Annually | API Governance |

### Supporting Files

| File | Purpose |
|------|---------|
| [collections/legal-platform.postman.json](./collections/legal-platform.postman.json) | Postman API collection |
| [DOCUMENTATION-MAINTENANCE.md](./DOCUMENTATION-MAINTENANCE.md) | This file |

---

## Maintenance Checklist

### Weekly Tasks

- [ ] Review and respond to API documentation issues
- [ ] Check for broken links in documentation
- [ ] Monitor API changelog for updates

### Monthly Tasks

- [ ] Update API examples if schema changed
- [ ] Verify Postman collection still works
- [ ] Check that auto-generated schema docs are current
- [ ] Review and update error codes if new ones added

### Quarterly Tasks

- [ ] Review all documentation for accuracy
- [ ] Update code examples with latest best practices
- [ ] Validate all external links
- [ ] Solicit feedback from API consumers
- [ ] Update screenshots/images if UI changed

### Annually Tasks

- [ ] Review versioning strategy
- [ ] Review breaking change process
- [ ] Update tech stack references
- [ ] Archive outdated migration guides
- [ ] Conduct documentation audit

---

## Auto-Generated Documentation

### Schema Documentation

**Location:** `docs/api/schema/schema.md`

**Generation Command:**
```bash
cd services/gateway
pnpm docs:generate
```

**Automation:**
- Auto-generated via GitHub Actions on schema changes
- Triggered on push to main/develop
- Workflow: `.github/workflows/docs-generation.yml`

**Manual Regeneration:**
```bash
# From project root
cd services/gateway
pnpm docs:generate

# Verify output
cat ../../docs/api/schema/schema.md
```

---

## Documentation Update Triggers

### When to Update Documentation

| Trigger | Files to Update |
|---------|-----------------|
| **New GraphQL type added** | schema.md (auto), case-management-api.md, playground-guide.md |
| **New query/mutation** | case-management-api.md, playground-guide.md, Postman collection |
| **Field deprecated** | schema.md (auto), breaking-changes.md, migration guide |
| **Error code added** | error-handling.md |
| **Authentication changed** | README.md, playground-guide.md |
| **Breaking change announced** | breaking-changes.md, versioning-strategy.md, email |
| **API version released** | README.md, CHANGELOG.md |

---

## Link Validation

### Internal Links to Check

Run this checklist quarterly:

**README.md:**
- [ ] Link to playground-guide.md
- [ ] Link to schema/schema.md
- [ ] Link to case-management-api.md
- [ ] Link to error-handling.md
- [ ] Link to versioning-strategy.md
- [ ] Link to breaking-changes.md

**playground-guide.md:**
- [ ] Link to schema/schema.md
- [ ] Link to case-management-api.md
- [ ] Link to error-handling.md

**error-handling.md:**
- [ ] Link to ../architecture/error-handling-strategy.md
- [ ] Link to README.md
- [ ] Link to playground-guide.md

**versioning-strategy.md:**
- [ ] Link to breaking-changes.md
- [ ] Link to README.md
- [ ] Link to schema/schema.md

**breaking-changes.md:**
- [ ] Link to versioning-strategy.md
- [ ] Link to README.md
- [ ] Link to error-handling.md

### External Links to Check

- [ ] GraphQL specification links
- [ ] Azure AD documentation links
- [ ] GitHub repository links
- [ ] Support email addresses

---

## Code Example Validation

### Testing Code Examples

Before releasing documentation updates:

1. **GraphQL Queries/Mutations**
   - Copy examples into Apollo Sandbox
   - Verify they execute without errors
   - Check responses match documented format

2. **JavaScript/TypeScript Examples**
   - Create test file with example code
   - Run with `ts-node` or in test suite
   - Verify no syntax errors

3. **Bash Commands**
   - Run each command in clean environment
   - Verify expected output
   - Check error handling

### Example Testing Script

```bash
#!/bin/bash
# test-documentation-examples.sh

echo "Testing API documentation examples..."

# Test schema generation
cd services/gateway
pnpm docs:generate || exit 1
echo "✓ Schema generation works"

# Test Postman collection is valid JSON
jq empty ../../docs/api/collections/legal-platform.postman.json || exit 1
echo "✓ Postman collection is valid JSON"

# TODO: Add GraphQL query tests
# TODO: Add code example tests

echo "All tests passed!"
```

---

## Style Guidelines

### Writing Style

- **Voice:** Second person ("you")
- **Tone:** Professional but friendly
- **Code blocks:** Always specify language
- **Links:** Use descriptive text, not "click here"
- **Examples:** Include both request and response
- **Headings:** Sentence case

### Formatting Standards

```markdown
# Main Title (H1)

> Blockquote for important notes

## Major Section (H2)

### Subsection (H3)

**Bold** for emphasis
`code` for inline code
[Link text](./path)

```language
code block with language specified
```

| Table | Formatting |
|-------|------------|
| Value | Aligned |
```

### Common Patterns

**API Endpoints:**
```markdown
**Development:** http://localhost:4000/graphql
**Production:** https://api.legal-platform.com/graphql
```

**Query Examples:**
```markdown
**Query:**
```graphql
query GetCase($id: UUID!) {
  case(id: $id) {
    id
    title
  }
}
```

**Variables:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```
```

---

## Feedback Collection

### Gathering User Feedback

**Channels:**
1. GitHub Issues (documentation label)
2. API support email
3. Quarterly surveys
4. Direct user interviews

**Questions to Ask:**
- Is the documentation easy to navigate?
- Are examples clear and helpful?
- What topics need more detail?
- What's missing from the docs?
- How could we improve?

**Acting on Feedback:**
1. Triage feedback weekly
2. Prioritize high-impact improvements
3. Update documentation
4. Close feedback loop with users

---

## Version Control

### Git Workflow

**Branch Naming:**
```
docs/api/[feature-name]
```

**Commit Messages:**
```
docs: [brief description]

- Detailed change 1
- Detailed change 2

Story: 2.7
```

**Pull Request Template:**
```markdown
## Documentation Changes

### What Changed
[Description of changes]

### Checklist
- [ ] All links validated
- [ ] Code examples tested
- [ ] Consistent formatting
- [ ] No typos or grammatical errors
- [ ] Auto-generated docs regenerated if needed

### Related
Story: [Story ID]
Issue: [Issue ID if applicable]
```

---

## Emergency Updates

### Urgent Documentation Fixes

For critical errors in documentation:

1. **Identify Issue**
   - Incorrect API endpoint
   - Broken authentication examples
   - Security vulnerability in example code
   - Wrong error codes

2. **Quick Fix Process**
   ```bash
   # Create hotfix branch
   git checkout -b docs/hotfix/[issue]

   # Make minimal necessary changes
   # ...

   # Commit and push
   git commit -m "docs: hotfix - [description]"
   git push

   # Create PR with "URGENT" label
   ```

3. **Post-Fix Actions**
   - Notify stakeholders
   - Document what went wrong
   - Update processes to prevent recurrence

---

## Metrics and Analytics

### Documentation Health Metrics

Track these metrics quarterly:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Doc Coverage** | 100% of API surface | Compare schema to docs |
| **Link Health** | 0 broken links | Automated link checker |
| **Freshness** | Updated within 1 week of changes | Git history analysis |
| **User Satisfaction** | >80% satisfied | Quarterly survey |
| **Support Tickets** | <10/month for doc issues | Ticket analysis |

---

## Automation Opportunities

### Current Automation

✅ **Implemented:**
- Schema documentation auto-generation
- CI/CD integration for schema docs
- Auto-commit of generated docs

⏳ **Planned:**
- Link checker in CI/CD
- Code example validation
- Spell check automation
- Documentation coverage reports

---

## Contact and Support

### Documentation Team

- **Primary Maintainer:** Backend Team Lead
- **Contributors:** Backend Engineers
- **Reviews:** API Governance Committee

### Getting Help

- **Documentation Issues:** GitHub Issues with `documentation` label
- **Content Questions:** api-docs@legal-platform.com
- **Process Questions:** See [CONTRIBUTING.md](../../CONTRIBUTING.md)

---

## Appendix: Useful Commands

### Documentation Commands

```bash
# Generate schema documentation
cd services/gateway && pnpm docs:generate

# Find broken internal links
grep -r "\[.*\](\..*)" docs/api/ | grep -v ".md:"

# Count documentation files
find docs/api -name "*.md" | wc -l

# Find TODO/FIXME in docs
grep -r "TODO\|FIXME" docs/api/

# Validate JSON files
find docs/api -name "*.json" -exec jq empty {} \;

# Check file freshness
find docs/api -name "*.md" -mtime +90
```

---

**Last Updated:** 2025-11-21
**Story:** 2.7 - API Documentation and Developer Portal
**Maintained By:** Backend Team
