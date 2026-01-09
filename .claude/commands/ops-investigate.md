# Parallel Investigation

Guided investigation workflow that finds root causes efficiently through evidence-driven exploration with user checkpoints.

## Input

The user's input is: $ARGUMENTS

This can be:

- A symptom description (e.g., "documents not appearing")
- An OPS issue ID (e.g., "OPS-024")

**Platform context**: If investigating a UI issue, clarify whether it affects Mobile, Desktop, or Both. We have separate UI tracks.

---

## Phase 1: Quick Triage (60 seconds max)

**Goal**: Gather initial evidence autonomously before asking user for direction.

### Step 1.1: Load Existing Context (if issue ID provided)

```
Read in parallel:
- docs/ops/operations-log.md (find the issue)
- .claude/ops/ops-{id}-handoff.md (if exists)
```

### Step 1.2: Search for Evidence

Use Grep and Glob to find relevant code. Be specific:

```
# Search for error messages or symptoms
Grep: "{error text or symptom keywords}"

# Find related files
Glob: "**/*{feature-name}*"

# Check recent changes if relevant
git log --oneline -10 -- {suspected paths}
```

### Step 1.3: Read Key Files

Read the 2-3 most relevant files identified. Look for:

- Obvious bugs (typos, wrong variable names, missing imports)
- Recent changes that could have broken things
- TODO/FIXME comments in the area

### Step 1.4: Form Initial Hypothesis

Based on evidence, identify:

- **Most likely cause** (what the evidence points to)
- **Alternative possibility** (what else it could be)
- **Unknown area** (where you'd need to dig deeper)

---

## Checkpoint 1: Present Findings

Use AskUserQuestion to present what you found and get direction:

```
Question: "Based on my triage, where should I focus?"

Options:
1. {Most likely cause} - "Evidence: {one-line summary}"
2. {Alternative possibility} - "Evidence: {one-line summary}"
3. {Unknown area} - "Need to explore {what}"
4. (User can provide custom direction)
```

**Important**: Include concrete evidence in each option description. Don't just say "Frontend issue" - say "EmailList.tsx line 45 has empty array fallback".

---

## Phase 2: Focused Investigation

**Goal**: Deep dive into the direction user chose.

### If user chose a specific hypothesis:

1. Read all related files thoroughly
2. Trace the data/control flow
3. Identify the exact line(s) causing the issue
4. Verify by checking if fix would make sense

### If user wants broader exploration:

Use ONE Task agent with `subagent_type=Explore`:

```
"Investigate {user's direction} in this codebase.
Specific symptom: {symptom}
Already checked: {files from Phase 1}
Find: The exact cause and which file/line to fix."
```

Only spawn multiple agents if the problem genuinely spans multiple layers (frontend + backend + database).

### If using Playwright MCP (for UI issues):

```
1. Navigate to affected page
2. Check console for errors
3. Check network tab for failed requests
4. Take screenshot of current state
```

---

## Checkpoint 2: Confirm Root Cause

Use AskUserQuestion to confirm before documenting:

```
Question: "I believe I found the root cause. Confirm?"

Options:
1. "Yes, create/update issue" - Proceed to documentation
2. "Not quite, investigate {specific area}" - Back to Phase 2
3. "Need more evidence" - What specific evidence would help?
```

Present your finding clearly:

```markdown
**Root Cause**: {one sentence}
**File**: {path}:{line}
**Why it breaks**: {explanation}
**Suggested fix**: {brief description}
```

---

## Phase 3: Document (only after confirmation)

### For NEW issues:

Add to `docs/ops/operations-log.md`:

```markdown
### [OPS-XXX] {symptom as title}

| Field        | Value                 |
| ------------ | --------------------- |
| **Status**   | Root Cause Found      |
| **Priority** | {P1/P2/P3}            |
| **Platform** | {Mobile/Desktop/Both} |
| **Created**  | {date}                |

**Symptom**: {what user reported}

**Root Cause**: {what you found}

- File: `{path}:{line}`
- Issue: {specific problem}

**Fix**: {what needs to change}

**Verification**:

- [ ] Test with `pnpm dev`
- [ ] Run `pnpm preflight`
- [ ] Test with `pnpm preview` (if deployment-related)
```

Update the Quick Reference table at top of ops log.

### For EXISTING issues:

Update the issue with:

- Status → "Root Cause Found"
- Add Root Cause section
- Add to Session Log

### Create/Update Handoff File

`.claude/ops/ops-{id}-handoff.md`:

```markdown
# OPS-XXX: {title}

**Root Cause**: {summary}
**File**: `{path}:{line}`
**Fix**: {what to do}

## Evidence

{key findings from investigation}

## Next Steps

1. {specific first step}
2. Test with production data
3. Run preflight
```

---

## Final Report

```markdown
## Investigation Complete

**Issue**: OPS-XXX
**Root Cause**: {one line}
**File**: `{path}:{line}`

**Next**: Run `/ops-continue OPS-XXX` to implement the fix.
```

---

## Guidelines

- **Stay evidence-driven** - Don't guess, search and read
- **Exit early** - If Phase 1 finds the root cause, skip to documentation
- **Be specific** - "line 45 has bug" not "frontend issue"
- **Ask when stuck** - Use checkpoints to get user guidance
- **One agent first** - Only parallelize if truly needed
