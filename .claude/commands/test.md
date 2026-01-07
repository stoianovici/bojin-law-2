# /test - Implementation Verification

**Purpose**: Verify that implementation actually fulfills all Decisions.
**Mode**: Autonomous (fresh perspective, no implementation bias)
**Input**: `.claude/work/tasks/implement-{slug}.md`
**Output**: `.claude/work/tasks/test-{slug}.md`

## Invocation

```
/test implement-{slug}
```

## Why This Exists

The implementer has "curse of knowledge" - they know what they intended to build.
A fresh agent verifies what was ACTUALLY built matches the Decisions.

---

## Execution Steps

### 1. Load Context

```
Read:
- .claude/work/tasks/implement-{slug}.md → What was claimed done
- .claude/work/tasks/plan-{slug}.md → Original Decisions + Verify criteria
```

### 2. For Each Decision, Verify THREE things

| Check          | Question              | How to verify                            |
| -------------- | --------------------- | ---------------------------------------- |
| **Exists**     | Was code written?     | Find the file, locate the feature        |
| **Integrated** | Is it wired up?       | Check imports, JSX rendering, props      |
| **Functional** | Does it work?         | Execute the "Verify" criteria from plan  |

### 3. Verification Methods

**Exists check**:
- Glob/Grep for the file and feature
- Read the file, find the relevant code

**Integrated check**:
- Is component imported in parent?
- Is it rendered in JSX?
- Are props/callbacks wired (not stubs like `() => {}`)?
- Are required fields included in GraphQL queries?

**Functional check**:
- Use the "Verify" column from the Decisions table
- For UI: describe what should happen on user action
- For API: query and check response
- For backend: trace data flow

### 4. Report Findings

For each Decision, report:
- PASS - all three checks pass
- PARTIAL - code exists but not integrated or not functional
- FAIL - not implemented

---

## Output: Test Report

**Write to**: `.claude/work/tasks/test-{slug}.md`

```markdown
# Test: [Feature Name]

**Status**: [PASS / FAIL]
**Date**: [YYYY-MM-DD]
**Input**: `implement-{slug}.md`
**Decisions**: X/Y passing

---

## Test Results

| Decision | Exists | Integrated | Functional | Status |
|----------|--------|------------|------------|--------|
| [Name] | Yes/No | Yes/No | Yes/No | PASS/PARTIAL/FAIL |

---

## Issues Found

### 1. [Decision Name] - [NOT INTEGRATED / NOT FUNCTIONAL]

**Expected**: [What the Verify criteria says]
**Actual**: [What actually happens]
**Location**: `path/to/file.tsx:line`
**Fix**: [Specific fix needed]

---

## Recommendation

[If FAIL]:
- [ ] Fix issue 1: [brief]
- [ ] Fix issue 2: [brief]
- [ ] Re-run `/test implement-{slug}`

Do NOT proceed to `/commit` until all Decisions pass.

[If PASS]:
All Decisions verified. Proceed to `/commit`.
```

---

## Rules

- DO NOT trust the implement doc - verify everything fresh
- DO NOT skip functional verification (this is where bugs hide)
- REPORT all gaps, even minor ones
- BE SPECIFIC about location + fix for each issue
- CHECK for stub callbacks like `onClick={() => {}}` or `onSubmit={async () => {}}`
- CHECK for disabled props like `readOnly`, `disabled` that block functionality

## Common Failure Patterns

| Pattern | How to detect |
|---------|---------------|
| Component created but not imported | Grep for import statement in parent |
| Imported but not rendered | Search JSX for component tag |
| Rendered but props stubbed | Look for `={() => {}}` or `={async () => {}}` |
| Feature behind disabled flag | Look for `readOnly`, `disabled`, `hidden` props |
| GraphQL field not queried | Check query includes required fields |
| Backend resolver not registered | Check server.ts for resolver merge |

## Transition

**When all tests PASS**:
1. Update status to "PASS"
2. Tell user: "All Decisions verified. Run `/commit` to commit."

**When tests FAIL**:
1. Keep status as "FAIL"
2. Tell user: "X/Y Decisions incomplete. Fix issues above and re-run `/test implement-{slug}`"
3. Do NOT suggest committing partial work
