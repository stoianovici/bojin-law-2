# /investigate - Systematic Bug Investigation

**Purpose**: Thoroughly investigate a bug and document findings. No fixes allowed.
**Mode**: Read-only (Claude investigates, documents, user reviews)
**Philosophy**: Understand completely. Fix later.
**Output**: `.claude/work/investigations/investigate-{slug}.md`

## Invocation

```
/investigate [slug] [description of the bug or symptom]
```

Example:

```
/investigate login-redirect Login button redirects to wrong page after OAuth
```

---

## HARD RULES

### FORBIDDEN TOOLS - DO NOT USE

These tools are **COMPLETELY BLOCKED** during investigation:

- **Edit** - No file modifications
- **Write** - No file creation (except the analysis document)
- **NotebookEdit** - No notebook modifications
- **Bash** with file-modifying commands (sed, awk, tee, >, >>)

### ALLOWED TOOLS

- **Read** - Read any file
- **Glob** - Find files by pattern
- **Grep** - Search file contents
- **Bash** - Only for:
  - `git log`, `git diff`, `git blame` (history investigation)
  - `curl`, `httpie` (API testing)
  - `pnpm test` (running existing tests)
  - `pnpm typecheck` (type checking)
  - Log viewing commands
- **Task** - Spawn investigation sub-agents
- **WebSearch**, **WebFetch** - Research external documentation

**If you feel the urge to fix something, STOP. Document it in the analysis instead.**

---

## Phase 1: Understand the Report

Before investigating, clarify the bug with the user:

### Required Questions

1. **Reproduction**: "What are the exact steps to reproduce this?"
2. **Expected vs Actual**: "What should happen? What happens instead?"
3. **Frequency**: "Does this happen always, or intermittently?"
4. **When it started**: "When did you first notice this? Any recent changes?"

### Optional Questions (if relevant)

5. **Environment**: "Browser, device, OS, user account?"
6. **Error messages**: "Any errors in console, terminal, or logs?"
7. **Workarounds**: "Is there any way to make it work?"

**STOP and wait for answers before proceeding.**

---

## Phase 2: Reproduce & Observe

### 2.1 Reproduce the Bug

- Follow the user's reproduction steps exactly
- Note what you observe at each step
- Capture any error messages or unexpected behavior
- Document the exact conditions under which it fails

### 2.2 Identify the Boundary

- Find the simplest case that triggers the bug
- Find cases where the bug does NOT occur
- Document what differentiates working vs broken states

---

## Phase 3: Trace the Code Path

### 3.1 Find the Entry Point

- Locate where user interaction enters the code
- Identify the component/route/function that handles it

### 3.2 Follow the Data Flow

For each step in the execution:

1. What function/component is involved?
2. What data comes in?
3. What transformation happens?
4. What data goes out?
5. Where does it go next?

Document the complete chain:

```
User clicks → Component A → Hook B → API call C → Response handling D → State update E → Render F
```

### 3.3 Identify the Failure Point

- Where exactly does the expected behavior diverge from actual?
- What assumption is violated?
- What condition is not handled?

---

## Phase 4: Analyze Root Cause

### 4.1 Determine Root Cause Type

Classify the bug:

- **Logic error**: Wrong algorithm/condition
- **State bug**: Incorrect state management
- **Race condition**: Timing-dependent failure
- **Type error**: Type mismatch or null/undefined
- **Data bug**: Incorrect data shape or validation
- **Integration bug**: Mismatch between components
- **Environment bug**: Config/dependency issue

### 4.2 Why Did This Happen?

- What was the original intent of the code?
- What assumption was made that turned out to be wrong?
- Was there a recent change that introduced this?
- Is this a regression or a latent bug?

### 4.3 Why Wasn't This Caught?

- Are there tests? Do they cover this case?
- Is this an edge case that wasn't considered?
- Does the type system protect against this?

---

## Phase 5: Assess Impact

### 5.1 Blast Radius

- What functionality is affected?
- How many users/features are impacted?
- Is data integrity at risk?

### 5.2 Related Code

- What else uses the buggy code?
- Could the same bug exist elsewhere?
- What would break if we change this code?

### 5.3 Severity Assessment

- **Critical**: Data loss, security issue, complete feature broken
- **High**: Major feature broken, no workaround
- **Medium**: Feature partially broken, workaround exists
- **Low**: Minor inconvenience, cosmetic issue

---

## Phase 6: Document Analysis

**MANDATORY**: Write the investigation document before ending.

### Output Location

`.claude/work/investigations/investigate-{slug}.md`

Create the directory if it doesn't exist.

### Document Template

```markdown
# Investigation: {Bug Title}

**Slug**: {slug}
**Date**: {YYYY-MM-DD}
**Status**: Investigation Complete
**Severity**: {Critical|High|Medium|Low}
**Next step**: `/debug {slug}` to implement fix

---

## Bug Summary

**Reported symptom**: {What the user described}
**Reproduction steps**:

1. {Step 1}
2. {Step 2}
3. {Step 3}

**Expected behavior**: {What should happen}
**Actual behavior**: {What happens instead}
**Frequency**: {Always|Intermittent|Specific conditions}

---

## Root Cause Analysis

### The Bug

**Root cause**: {One-sentence description of why this happens}

**Location**: `{file_path}:{line_number}`

**Code path**:
```

{Entry point} → {Step 1} → {Step 2} → {Failure point}

````

**Type**: {Logic error|State bug|Race condition|Type error|Data bug|Integration bug|Environment bug}

### Why It Happens

{2-3 paragraph explanation of the underlying issue. Include code snippets if helpful.}

### Why It Wasn't Caught

{Explain gap in testing/types/validation that allowed this to slip through}

---

## Impact Assessment

**Affected functionality**:
- {Feature 1}
- {Feature 2}

**Blast radius**: {Localized|Moderate|Wide}

**Related code**:
- `{file1.ts}`: {Why relevant}
- `{file2.ts}`: {Why relevant}

**Risk of similar bugs**: {Low|Medium|High} - {Explanation}

---

## Proposed Fix Approaches

### Option A: {Name}

**Approach**: {Description}
**Files to change**:
- `{file1.ts}`: {What to change}
- `{file2.ts}`: {What to change}

**Pros**:
- {Pro 1}
- {Pro 2}

**Cons**:
- {Con 1}

**Risk**: {Low|Medium|High}

### Option B: {Name}

{Same structure as Option A}

### Recommendation

{Which option and why}

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Original bug no longer reproduces
2. [ ] {Related scenario 1} still works
3. [ ] {Related scenario 2} still works
4. [ ] {Edge case 1} is handled correctly

### Suggested Test Cases

If adding automated tests:

```typescript
// {file}.test.ts
describe('{feature}', () => {
  it('{should do X when Y}', () => {
    // Test for the bug fix
  });

  it('{should handle edge case Z}', () => {
    // Test for related edge case
  });
});
````

---

## Investigation Notes

### Files Examined

| File      | Purpose   | Relevant Finding |
| --------- | --------- | ---------------- |
| `{file1}` | {Purpose} | {What was found} |
| `{file2}` | {Purpose} | {What was found} |

### Git History

{Any relevant commits or recent changes}

### Questions Answered During Investigation

- Q: {Question from user}
- A: {What was discovered}

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug {slug}
```

The debug phase will:

1. Read this investigation document
2. Propose the specific implementation
3. Get approval before making changes
4. Implement and verify the fix

```

---

## Rules

### DO

- Ask clarifying questions first
- Read all relevant code before drawing conclusions
- Follow the complete code path, not just the obvious parts
- Consider edge cases and race conditions
- Document everything you discover
- Consider multiple fix approaches
- Write the investigation document before ending

### DON'T

- Touch any code files (Edit, Write are forbidden)
- Jump to conclusions without tracing the code
- Assume the bug is where the error appears
- Skip documenting because "the fix is obvious"
- End the investigation without writing the document

### When You Feel Like Fixing

If you discover an obvious fix:

1. **DO NOT** implement it
2. Document it clearly in "Proposed Fix Approaches"
3. Note: "This appears straightforward to fix" in the recommendation
4. Hand off to `/debug {slug}` for implementation

The separation is intentional. Investigation and implementation are different cognitive modes.

---

## Transition

When investigation is complete:

1. Ensure document is written to `.claude/work/investigations/investigate-{slug}.md`

2. Summarize findings to user:
   > "Investigation complete. Root cause: {one-liner}. Document saved to `.claude/work/investigations/investigate-{slug}.md`."

3. Recommend next step:
   > "When ready to fix, run `/debug {slug}` - it will read this investigation and propose an implementation."

---

## Example Session

```

User: /investigate login-redirect Login button goes to /dashboard instead of /cases after login

Claude: I'll investigate the login redirect issue. First, some questions:

1. **Reproduction**: What are the exact steps? Login with SSO? Username/password?
2. **Expected**: Should it redirect to /cases specifically, or to a user's last page?
3. **Frequency**: Does this happen every login, or only sometimes?
4. **Recent changes**: Any auth-related changes recently?

User: SSO login. Should go to /cases for new users, last page for returning. Happens every time. We updated the auth hook last week.

Claude: Thanks. Let me trace through the login flow...

[Investigation proceeds - Claude reads auth hook, login component, redirect logic, session storage, etc.]

Claude: Investigation complete.

**Root cause**: The `useAuthRedirect` hook was refactored last week and the default redirect changed from `/cases` to `/dashboard` on line 47. The "last page" logic exists but isn't being reached because the condition on line 43 always evaluates to true for new users.

Document saved to `.claude/work/investigations/investigate-login-redirect.md`.

When ready to fix, run `/debug login-redirect`.

```

```
