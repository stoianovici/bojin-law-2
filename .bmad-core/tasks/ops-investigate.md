# Operations Investigation Task

Deep investigation workflow for operations issues. Use this for systematic debugging.

## Prerequisites

- Active issue in ops log
- Issue status should be "Investigating" or earlier

## Investigation Workflow

### Phase 1: Understand the Problem

1. **Review Issue Details**
   - Read the issue description and reproduction steps
   - Understand what "working" looks like
   - Understand what "broken" looks like

2. **Reproduce the Issue**
   - Follow reproduction steps
   - Document exact error messages
   - Note any variations in behavior

### Phase 2: Gather Evidence

Use these tools in parallel where possible:

1. **Search for Error Messages**

   ```
   Use Grep to search for error text in codebase
   Use Grep to search in log files if available
   ```

2. **Find Related Code**

   ```
   Use Task tool with subagent_type=Explore
   Prompt: "Find all code related to {feature/component}"
   Thoroughness: "very thorough"
   ```

3. **Check Recent Changes**

   ```
   git log --oneline -20 -- {relevant paths}
   git diff {last known working commit}..HEAD -- {relevant paths}
   ```

4. **Review Dependencies**
   ```
   Check package.json for version changes
   Check for deprecated APIs
   ```

### Phase 3: Form Hypotheses

Based on evidence, form testable hypotheses:

```markdown
## Hypotheses

### H1: {First hypothesis}

- **Evidence for**: {what supports this}
- **Evidence against**: {what contradicts this}
- **Test**: {how to verify}
- **Status**: Untested / Confirmed / Rejected

### H2: {Second hypothesis}

...
```

### Phase 4: Test Hypotheses

For each hypothesis:

1. Design a minimal test
2. Execute the test
3. Document results
4. Update hypothesis status

### Phase 5: Root Cause Identification

When a hypothesis is confirmed:

1. **Document Root Cause**

   ```markdown
   #### Root Cause

   {Clear explanation of why the issue occurs}

   **Technical Details**:

   - File: {path}
   - Function/Component: {name}
   - Issue: {specific problem}

   **Why it worked before / Why it broke**:
   {explanation}
   ```

2. **Update Issue Status**
   - Change status to "Root Cause Found"
   - Log the finding in Session Log

### Phase 6: Plan Fix

Before implementing:

1. **Identify Fix Approach**
   - What needs to change?
   - Are there multiple approaches?
   - What are the trade-offs?

2. **Assess Risk**
   - What could this fix break?
   - What tests need to pass?
   - Is this a hotfix or can it wait?

3. **Document Plan**
   ```markdown
   #### Fix Plan

   - Approach: {description}
   - Files to modify: {list}
   - Tests to add/update: {list}
   - Rollback plan: {if fix causes issues}
   ```

## Output

Update the ops log issue with:

- [ ] Findings documented in Session Log
- [ ] Root Cause filled in (or current hypotheses if not yet found)
- [ ] Files Involved updated
- [ ] Status updated appropriately

## Tips

- **Work incrementally** - Don't try to solve everything at once
- **Document as you go** - Write findings immediately, not at the end
- **Trust the evidence** - Don't assume, verify
- **Take breaks** - Fresh eyes often see solutions
- **Ask for help** - If stuck after 3 hypotheses, consider if you need more info
