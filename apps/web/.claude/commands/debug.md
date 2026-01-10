# /debug - Careful Bug Investigation & Fix

**Purpose**: Methodically investigate and fix bugs without introducing new ones.
**Mode**: Collaborative (Claude asks questions, investigates, proposes, user approves)
**Philosophy**: Understand completely before changing anything.

## Invocation

```
/debug [slug or description of the bug]
```

---

## Phase 0: Check for Existing Investigation

**BEFORE doing anything else**, check if an investigation document exists:

```
.claude/work/investigations/investigate-{slug}.md
```

### If Investigation Exists

1. Read the investigation document
2. Summarize the root cause to the user
3. Present the proposed fix approaches from the document
4. Skip directly to **Phase 3: Propose Solution**

### If No Investigation Exists

Proceed to Phase 1 (Clarifying Questions).

> **Note**: For complex bugs, consider running `/investigate {slug}` first to produce a thorough analysis before fixing.

---

## Phase 1: Clarifying Questions (MANDATORY)

Before ANY investigation, ask the user these questions:

### Required Information

1. **Reproduction**: "How do I reproduce this bug? What are the exact steps?"
2. **Expected vs Actual**: "What should happen? What happens instead?"
3. **Scope**: "When did this start? Does it happen always or intermittently?"
4. **Environment**: "Any specific browser, device, or conditions where this occurs?"

### Optional Deep-Dive Questions (if applicable)

5. **Recent Changes**: "Were any changes made recently that might relate to this?"
6. **Error Messages**: "Are there any error messages in console/logs?"
7. **Related Features**: "Are there other features that might be affected?"

**STOP and wait for answers before proceeding.**

---

## Phase 2: Investigation (Read-Only)

Only after getting answers, investigate:

### Step 2.1: Map the Code Path

```
Goal: Trace the complete execution path without modifying anything
```

- Find the entry point (component, route, function)
- Follow the data flow through the code
- Identify all files involved
- Document the chain: trigger → logic → output

### Step 2.2: Reproduce Mentally

```
Goal: Understand WHY the bug happens, not just WHERE
```

- Read the code that handles the failing scenario
- Check edge cases and assumptions
- Look for race conditions, null checks, type issues
- Identify any implicit assumptions in the code

### Step 2.3: Check Related Code

```
Goal: Understand the blast radius
```

- What else uses this code/component?
- What would break if we change this?
- Are there tests? What do they cover?

### Output: Share Investigation Summary

Before proceeding, summarize findings to user:

```markdown
## Bug Investigation Summary

**Root Cause**: [What's actually wrong]
**Location**: [File:line where the bug originates]
**Code Path**: [Trigger → File1 → File2 → Bug manifestation]
**Impact**: [What's affected by this bug]
**Related Code**: [Other places that use this, might be affected]
```

---

## Phase 3: Propose Solution (Get Approval)

**NEVER implement without approval.**

### Present Options

If multiple approaches exist:

```markdown
## Proposed Fixes

### Option A: [Name]

- **Change**: [What would change]
- **Pros**: [Benefits]
- **Cons**: [Downsides/risks]
- **Files touched**: [List]

### Option B: [Name]

- **Change**: [What would change]
- **Pros**: [Benefits]
- **Cons**: [Downsides/risks]
- **Files touched**: [List]

**Recommendation**: Option [X] because [reason]
```

### Single Solution

If only one sensible approach:

```markdown
## Proposed Fix

**Change**: [Precise description of the fix]
**File(s)**: [Exact files and locations]
**Why this works**: [Explanation]
**Risk assessment**: [What could go wrong]
**Rollback plan**: [How to undo if needed]
```

### Ask for Approval

"Does this approach look correct? Should I proceed with the fix?"

**STOP and wait for approval before proceeding.**

---

## Phase 4: Implement Fix (Minimal Changes)

### Rules for Implementation

1. **SMALLEST possible change** - fix the bug, nothing else
2. **NO refactoring** - even if tempting
3. **NO "improvements"** - stick to the bug
4. **NO style changes** - unless directly related
5. **PRESERVE existing patterns** - match surrounding code style

### Implementation Checklist

- [ ] Read the target code one more time before editing
- [ ] Make the minimal fix
- [ ] Verify the change is correct
- [ ] Check for any unintended side effects

---

## Phase 5: Verification

### Step 5.1: Self-Review

```
Before asking user to test:
```

- Re-read the diff of changes
- Trace through the fix mentally
- Check: "Could this introduce a new bug?"
- Verify: "Does this handle all edge cases?"

### Step 5.2: User Verification

Ask user to:

1. Test the original bug scenario
2. Test related functionality
3. Confirm no regressions

### Step 5.3: Address Any Issues

If verification reveals problems:

- Go back to Phase 2
- DO NOT stack fixes on top of fixes
- Understand what went wrong first

---

## Rules

### DO

- Ask questions first, always
- Read all relevant code before changing
- Propose solutions before implementing
- Make minimal, focused changes
- Verify thoroughly

### DON'T

- Assume you understand the bug without questions
- Start fixing before investigating
- Implement without approval
- "Fix" other things you notice
- Skip verification

### Red Flags (pause and reconsider)

- "I'll just quickly fix this" → Stop, investigate first
- "While I'm here, I'll also..." → Stop, stay focused
- "This should work" → Stop, verify it works
- "I don't see how this relates but..." → Stop, understand first

---

## Example Session Flow

```
User: /debug the login button doesn't work

Claude: I'll help debug the login button issue. First, I need to understand the problem better:

1. **Reproduction**: What happens when you click the login button? Does nothing happen, or is there an error?
2. **Expected behavior**: Should it redirect to a dashboard, show a loading state, etc.?
3. **When it broke**: Was this working before? Any recent changes?
4. **Error messages**: Any errors in the browser console?

[User answers]

Claude: Thanks. Now I'll investigate the login flow...
[Investigation happens]

Claude: ## Investigation Summary
**Root Cause**: The onClick handler references `handleLogin` but it's not defined in scope after a recent refactor that moved auth logic to a hook.
**Location**: src/components/LoginButton.tsx:23
**Impact**: Login button is completely non-functional

## Proposed Fix
Import the `useAuth` hook and call `login()` from it instead of the missing `handleLogin`.

**Files**: src/components/LoginButton.tsx (1 line change)
**Risk**: Low - straightforward fix using existing pattern

Should I proceed?

[User approves]

Claude: [Implements fix]

Please test:
1. Click login button - does it work now?
2. Try invalid credentials - proper error message?
3. Logout and re-login - works correctly?
```

---

## Transition

When fix is verified:

1. Summarize what was fixed
2. If user wants to commit: "Run `/commit` to commit this fix"
