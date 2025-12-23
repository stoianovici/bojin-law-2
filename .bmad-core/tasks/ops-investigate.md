# Operations Investigation Task

Guided investigation workflow for operations issues. Evidence-driven with user checkpoints.

## Overview

This task uses a 3-phase approach:

1. **Quick Triage** - Autonomous evidence gathering (60 seconds)
2. **Focused Investigation** - Deep dive based on user direction
3. **Documentation** - Only after root cause confirmed

## Phase 1: Quick Triage

### Gather Evidence

```bash
# Search for symptoms/errors
Grep: "{symptom keywords}"

# Find related files
Glob: "**/*{feature}*"

# Recent changes
git log --oneline -10 -- {paths}
```

### Read Key Files

Read 2-3 most relevant files. Look for:

- Obvious bugs
- Recent changes
- TODO/FIXME comments

### Form Hypothesis

Identify:

- Most likely cause (with evidence)
- Alternative possibility
- Unknown areas needing exploration

## Checkpoint 1: Get Direction

Present findings to user with AskUserQuestion:

- Option 1: Most likely cause
- Option 2: Alternative
- Option 3: Explore unknown area

Include concrete evidence in each option.

## Phase 2: Focused Investigation

Based on user's choice:

**For specific hypothesis**: Read all related files, trace data flow, find exact line.

**For broader exploration**: Use ONE Task agent with `subagent_type=Explore`.

**For UI issues**: Use Playwright MCP to check console/network errors.

## Checkpoint 2: Confirm Root Cause

Present finding:

```markdown
**Root Cause**: {one sentence}
**File**: {path}:{line}
**Why**: {explanation}
**Fix**: {description}
```

Ask user to confirm before documenting.

## Phase 3: Document

Only after confirmation:

1. Update `docs/ops/operations-log.md`
2. Create/update `.ai/ops-{id}-handoff.md`
3. Report final summary

## Guidelines

- Stay evidence-driven
- Exit early if root cause found in Phase 1
- Be specific (file:line, not "frontend issue")
- One agent first, parallelize only if needed
